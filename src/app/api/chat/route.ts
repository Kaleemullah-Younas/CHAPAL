import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import {
  streamGeminiResponse,
  generateChatTitle,
  createTextPart,
  createImagePart,
  ChatMessage,
  AllKeysExhaustedError,
} from '@/lib/gemini';
import { Part } from '@google/generative-ai';
import {
  analyzeLayer1,
  needsSemanticAnalysis,
  getLayer2Indicators,
  DetectionResult,
  getAnomalyTypeLabel,
  AnomalyDetail,
} from '@/lib/anomaly-detection';
import { analyzeWithGroq, SemanticAnalysisResult } from '@/lib/groq';

export const runtime = 'nodejs';

// Thinking stages for UI animation
export type ThinkingStage =
  | 'analyzing_safety'
  | 'checking_injection'
  | 'detecting_emotion'
  | 'semantic_analysis'
  | 'generating_response'
  | 'complete';

interface Attachment {
  type: 'image' | 'document';
  url: string;
  name: string;
  base64?: string;
  mimeType?: string;
  extractedText?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      chatId,
      message,
      attachments = [],
    } = body as {
      chatId: string;
      message: string;
      attachments?: Attachment[];
    };

    // Verify chat belongs to user
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId: session.user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Build parts for the current message
    const currentParts: Part[] = [];

    // Add text content
    if (message) {
      currentParts.push(createTextPart(message));
    }

    // Process attachments
    for (const attachment of attachments) {
      if (
        attachment.type === 'image' &&
        attachment.base64 &&
        attachment.mimeType
      ) {
        // For images, send to Gemini directly
        currentParts.push(
          createImagePart(attachment.base64, attachment.mimeType),
        );
      } else if (attachment.type === 'document' && attachment.extractedText) {
        // For documents, include OCR text
        currentParts.push(
          createTextPart(
            `[Document: ${attachment.name}]\n${attachment.extractedText}`,
          ),
        );
      }
    }

    // Build chat history for Gemini
    const geminiHistory: ChatMessage[] = chat.messages.map(msg => {
      const msgAttachments = msg.attachments as Attachment[] | null;
      const parts: Part[] = [createTextPart(msg.content)];

      // Note: We can't include image data for history as we don't store base64
      // Only include document text context if available
      if (msgAttachments) {
        for (const att of msgAttachments) {
          if (att.type === 'document' && att.extractedText) {
            parts.push(
              createTextPart(`[Document: ${att.name}]\n${att.extractedText}`),
            );
          }
        }
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts,
      };
    });

    // Add current user message
    geminiHistory.push({
      role: 'user',
      parts: currentParts,
    });

    // ============== CHAPAL Layer 1: Deterministic Anomaly Detection ==============
    const layer1Result: DetectionResult = analyzeLayer1(message);

    // Check if Layer 2 semantic analysis is needed
    const { needsAnalysis: needsLayer2, reasons: layer2Reasons } =
      needsSemanticAnalysis(message);
    const layer2Indicators = needsLayer2 ? getLayer2Indicators(message) : [];

    // Save user message to database with detection results
    const attachmentsForDb = attachments.map(a => ({
      type: a.type,
      url: a.url,
      name: a.name,
      extractedText: a.extractedText,
    }));

    const userMessage = await prisma.message.create({
      data: {
        chatId,
        role: 'user',
        content: message,
        attachments: attachmentsForDb.length > 0 ? attachmentsForDb : null,
        isBlocked: layer1Result.isBlocked,
        isWarning: layer1Result.isWarning,
        safetyScore: layer1Result.safetyScore,
        userEmotion: layer1Result.userEmotion,
        emotionIntensity: layer1Result.emotionIntensity,
        isPendingReview: false, // Will be updated after Layer 2 if needed
      },
    });

    // If message is blocked by Layer 1, create anomaly log and return blocked response
    if (layer1Result.isBlocked) {
      // Get primary anomaly for logging
      const primaryAnomaly = layer1Result.anomalies[0];

      // Create anomaly log for admin (informational, no human review needed for Layer 1)
      await prisma.anomalyLog.create({
        data: {
          messageId: userMessage.id,
          userId: session.user.id,
          userEmail: session.user.email,
          chatId,
          anomalyType: primaryAnomaly?.type || 'unknown',
          severity: primaryAnomaly?.severity || 'high',
          layer: 'deterministic',
          userQuery: message,
          aiResponse: null, // Blocked before AI generation
          detectionDetails: layer1Result as object,
          safetyScore: layer1Result.safetyScore,
          userEmotion: layer1Result.userEmotion,
          status: 'blocked', // Auto-blocked, no review needed
        },
      });

      // Return blocked response
      return NextResponse.json({
        blocked: true,
        layer: 'deterministic',
        detection: {
          layer: 'deterministic',
          isBlocked: true,
          isWarning: false,
          isPendingReview: false,
          isSafe: false,
          safetyScore: layer1Result.safetyScore,
          accuracyScore: 100,
          userEmotion: layer1Result.userEmotion,
          emotionIntensity: layer1Result.emotionIntensity,
          anomalies: layer1Result.anomalies.map(a => ({
            type: a.type,
            subType: a.subType,
            severity: a.severity,
            message: a.message,
          })),
          blockMessage:
            layer1Result.userMessage ||
            `Message Blocked. ${primaryAnomaly?.message || 'Security protocols triggered'}. This incident has been logged.`,
        },
        messageId: userMessage.id,
      });
    }

    // Generate title for new chats
    if (chat.messages.length === 0 && message) {
      const title = await generateChatTitle(message);
      await prisma.chat.update({
        where: { id: chatId },
        data: { title },
      });
    }

    // Create streaming response
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        // ============== STAGE 1: Send thinking stages ==============
        const sendThinkingStage = (stage: ThinkingStage, message: string) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ thinking: { stage, message } })}\n\n`,
            ),
          );
        };

        // Send initial Layer 1 detection results
        sendThinkingStage('analyzing_safety', 'Analyzing safety protocols...');
        await new Promise(resolve => setTimeout(resolve, 300));

        sendThinkingStage(
          'checking_injection',
          'Checking for injection attempts...',
        );
        await new Promise(resolve => setTimeout(resolve, 200));

        sendThinkingStage(
          'detecting_emotion',
          'Detecting emotional context...',
        );
        await new Promise(resolve => setTimeout(resolve, 200));

        // Send Layer 1 detection results
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              detection: {
                layer: 'deterministic',
                isBlocked: layer1Result.isBlocked,
                isWarning: layer1Result.isWarning,
                isPendingReview: false,
                isSafe: layer1Result.isSafe,
                safetyScore: layer1Result.safetyScore,
                accuracyScore: 100,
                userEmotion: layer1Result.userEmotion,
                emotionIntensity: layer1Result.emotionIntensity,
                anomalies: layer1Result.anomalies.map(a => ({
                  type: a.type,
                  subType: a.subType,
                  severity: a.severity,
                  message: a.message,
                  layer: a.layer,
                })),
                needsLayer2: needsLayer2,
                layer2Reasons: layer2Reasons,
              },
            })}\n\n`,
          ),
        );

        sendThinkingStage('generating_response', 'Generating response...');

        const systemPrompt = `You are a helpful AI assistant. Be concise but thorough in your responses. If the user shares images or documents, analyze them carefully and provide relevant insights.`;

        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            if (attempt > 1) {
              // Send retry notification to client
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ retry: attempt, maxRetries })}\n\n`,
                ),
              );
              // Wait a bit before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }

            fullResponse = '';
            for await (const chunk of streamGeminiResponse(
              geminiHistory,
              systemPrompt,
            )) {
              fullResponse += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
              );
            }

            // ============== LAYER 2: Semantic Analysis (if needed) ==============
            let semanticResult: SemanticAnalysisResult | null = null;
            let isPendingReview = false;
            let finalAccuracyScore = 100;

            if (needsLayer2) {
              sendThinkingStage(
                'semantic_analysis',
                'Running semantic analysis with Llama 3.1...',
              );

              try {
                semanticResult = await analyzeWithGroq(message, fullResponse);
                finalAccuracyScore = semanticResult.accuracyScore;

                // Check if human review is needed
                isPendingReview = semanticResult.requiresHumanReview;

                // Send Layer 2 results
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      semanticAnalysis: {
                        isHallucination: semanticResult.isHallucination,
                        hallucinationConfidence:
                          semanticResult.hallucinationConfidence,
                        accuracyScore: semanticResult.accuracyScore,
                        isMedicalAdvice: semanticResult.isMedicalAdvice,
                        isPsychological: semanticResult.isPsychological,
                        contextType: semanticResult.contextType,
                        userEmotion: semanticResult.userEmotion,
                        emotionIntensity: semanticResult.emotionIntensity,
                        emotionalConcern: semanticResult.emotionalConcern,
                        requiresHumanReview: semanticResult.requiresHumanReview,
                        reviewReason: semanticResult.reviewReason,
                        riskLevel: semanticResult.riskLevel,
                      },
                    })}\n\n`,
                  ),
                );
              } catch (groqError) {
                console.error('Groq analysis error:', groqError);
                // Continue without blocking if Groq fails
              }
            }

            // Save assistant message to database
            const assistantMessage = await prisma.message.create({
              data: {
                chatId,
                role: 'assistant',
                content: isPendingReview ? '' : fullResponse, // Hide content if pending review
                originalContent: isPendingReview ? fullResponse : null, // Store original for admin
                isPendingReview,
                accuracyScore: finalAccuracyScore,
                semanticAnalysis: (semanticResult as object) || null,
              },
            });

            // If Layer 2 requires human review, create anomaly log
            if (isPendingReview && semanticResult) {
              await prisma.anomalyLog.create({
                data: {
                  messageId: assistantMessage.id, // Link to assistant message
                  userId: session.user.id,
                  userEmail: session.user.email,
                  chatId,
                  anomalyType: semanticResult.isMedicalAdvice
                    ? 'medical'
                    : semanticResult.isHallucination
                      ? 'hallucination'
                      : semanticResult.isPsychological
                        ? 'context'
                        : 'unknown',
                  severity: semanticResult.riskLevel,
                  layer: 'semantic',
                  userQuery: message,
                  aiResponse: fullResponse,
                  detectionDetails: {
                    layer1: layer1Result,
                    layer2: semanticResult,
                  } as object,
                  safetyScore: layer1Result.safetyScore,
                  accuracyScore: semanticResult.accuracyScore,
                  userEmotion: semanticResult.userEmotion,
                  status: 'pending', // Awaiting human review
                },
              });

              // Update user message to mark as pending review
              await prisma.message.update({
                where: { id: userMessage.id },
                data: { isPendingReview: true },
              });
            }
            // If Layer 1 has warnings, log for informational purposes
            else if (
              layer1Result.isWarning &&
              layer1Result.shouldLogForReview
            ) {
              const primaryAnomaly = layer1Result.anomalies[0];
              await prisma.anomalyLog.create({
                data: {
                  messageId: userMessage.id,
                  userId: session.user.id,
                  userEmail: session.user.email,
                  chatId,
                  anomalyType: primaryAnomaly?.type || 'unknown',
                  severity: primaryAnomaly?.severity || 'medium',
                  layer: 'deterministic',
                  userQuery: message,
                  aiResponse: fullResponse,
                  detectionDetails: layer1Result as object,
                  safetyScore: layer1Result.safetyScore,
                  userEmotion: layer1Result.userEmotion,
                  status: 'flagged', // Just flagged, no review needed
                },
              });
            }

            // Update chat's updatedAt
            await prisma.chat.update({
              where: { id: chatId },
              data: { updatedAt: new Date() },
            });

            sendThinkingStage('complete', 'Analysis complete');

            // Send final response with all analysis
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  isPendingReview,
                  accuracyScore: finalAccuracyScore,
                  pendingMessage: isPendingReview
                    ? 'This response requires human verification. Our team of experts will review it and notify you once approved. This ensures the highest quality and accuracy of information, especially for sensitive topics.'
                    : null,
                })}\n\n`,
              ),
            );
            controller.close();
            return; // Success, exit the retry loop
          } catch (error) {
            console.error(
              `Streaming error (attempt ${attempt}/${maxRetries}):`,
              error,
            );
            lastError =
              error instanceof Error ? error : new Error(String(error));

            // If all API keys are exhausted, don't retry
            if (error instanceof AllKeysExhaustedError) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: 'All API keys are rate limited. Please try again later.' })}\n\n`,
                ),
              );
              controller.close();
              return;
            }

            if (attempt === maxRetries) {
              // All retries exhausted
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: 'Failed to generate response after 3 attempts. Please try again.' })}\n\n`,
                ),
              );
              controller.close();
            }
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
