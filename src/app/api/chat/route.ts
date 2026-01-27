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
  detectMedicalContent,
  detectMentalHealthContent,
  detectHallucinationContent,
  detectSuddenSpike,
  isUserSpikeBlocked,
  DetectionResult,
  getAnomalyTypeLabel,
  AnomalyDetail,
} from '@/lib/anomaly-detection';
import { analyzeWithGroq, SemanticAnalysisResult } from '@/lib/groq';
import { pusher, PUSHER_EVENTS } from '@/lib/pusher-server';

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

    // Check if user is blocked
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isBlocked: true },
    });

    if (user?.isBlocked) {
      return NextResponse.json(
        { error: 'Your account has been blocked. You cannot use the chatbot.' },
        { status: 403 },
      );
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

    // ============== LAYER 1: Sudden Spike Detection (DDoS Protection) ==============
    // Check for rapid message rate (potential DDoS/abuse)
    const isSimulatedDdos = message.includes('[DDOS_SIMULATION]');
    const spikeResult = detectSuddenSpike(session.user.id, isSimulatedDdos);

    // If spike detected and should block, block the chat immediately
    if (spikeResult.shouldBlock && spikeResult.anomaly) {
      // Get the chat to block it
      const chatToBlock = await prisma.chat.findFirst({
        where: {
          id: chatId,
          userId: session.user.id,
        },
      });

      if (chatToBlock) {
        // Block the chat
        await prisma.chat.update({
          where: { id: chatId },
          data: {
            isHumanReviewBlocked: true,
            humanReviewReason: 'sudden_spike',
            humanReviewStatus: 'pending',
            humanReviewMessage: `⚡ This chat has been blocked due to detected message spike (${spikeResult.messageCount} rapid messages). This has been flagged as a potential DDoS attack and sent for admin review.`,
          },
        });

        // Create a user message to log the spike
        const spikeUserMessage = await prisma.message.create({
          data: {
            chatId,
            role: 'user',
            content: message,
            isBlocked: true,
            isWarning: false,
            safetyScore: 0,
            userEmotion: 'Suspicious',
            emotionIntensity: 'high',
            isPendingReview: true,
          },
        });

        // Create blocked assistant message
        const spikeAssistantMessage = await prisma.message.create({
          data: {
            chatId,
            role: 'assistant',
            content: '',
            originalContent: null,
            isBlocked: true,
            isPendingReview: true,
          },
        });

        // Create anomaly log for admin review
        const anomalyLog = await prisma.anomalyLog.create({
          data: {
            messageId: spikeAssistantMessage.id,
            userId: session.user.id,
            userEmail: session.user.email,
            chatId,
            anomalyType: 'sudden_spike',
            severity: 'critical',
            layer: 'deterministic',
            userQuery: message,
            aiResponse: null,
            detectionDetails: {
              anomaly: {
                type: spikeResult.anomaly.type,
                subType: spikeResult.anomaly.subType || null,
                severity: spikeResult.anomaly.severity,
                message: spikeResult.anomaly.message,
                matchedPattern: spikeResult.anomaly.matchedPattern || null,
                confidence: spikeResult.anomaly.confidence,
                layer: spikeResult.anomaly.layer,
              },
              messageCount: spikeResult.messageCount,
              timestamp: new Date().toISOString(),
              isSimulation: isSimulatedDdos,
            },
            safetyScore: 0,
            userEmotion: 'Suspicious',
            status: 'pending',
          },
        });

        // Trigger real-time admin notification via Pusher
        try {
          await pusher.trigger('admin-channel', PUSHER_EVENTS.NOTIFICATION, {
            id: anomalyLog.id,
            type: 'sudden_spike',
            severity: 'critical',
            userEmail: session.user.email,
            chatId,
            message: `⚡ DDoS Attack Detected: ${spikeResult.messageCount} rapid messages from ${session.user.email}`,
            timestamp: new Date().toISOString(),
          });
        } catch (pusherError) {
          console.error('Failed to send Pusher notification:', pusherError);
        }

        // Return blocked response
        return NextResponse.json({
          blocked: true,
          chatBlocked: true,
          layer: 'deterministic',
          detection: {
            layer: 'deterministic',
            isBlocked: true,
            isWarning: false,
            isPendingReview: true,
            isSafe: false,
            safetyScore: 0,
            accuracyScore: 100,
            userEmotion: 'Suspicious',
            emotionIntensity: 'high',
            anomalies: [
              {
                type: spikeResult.anomaly.type,
                subType: spikeResult.anomaly.subType,
                severity: spikeResult.anomaly.severity,
                message: spikeResult.anomaly.message,
              },
            ],
            blockMessage: `🚫 Message Blocked: ${spikeResult.anomaly.message}. This chat has been blocked and sent for admin review.`,
            spikeDetected: true,
            messageCount: spikeResult.messageCount,
          },
          messageId: spikeUserMessage.id,
        });
      }
    }

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

    // Check if chat is blocked (pending admin review)
    if (chat.isHumanReviewBlocked) {
      return NextResponse.json({
        blocked: true,
        chatBlocked: true,
        layer: 'deterministic',
        detection: {
          layer: 'deterministic',
          isBlocked: true,
          isWarning: false,
          isPendingReview: true,
          isSafe: false,
          safetyScore: 0,
          accuracyScore: 100,
          userEmotion: 'Neutral',
          emotionIntensity: 'low',
          anomalies: [],
          blockMessage:
            chat.humanReviewMessage ||
            'This chat has been blocked and is pending admin review. Please start a new chat.',
        },
        messageId: null,
      });
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

    // Check for serious medical content that MUST be flagged for admin review
    const medicalAnomalies = detectMedicalContent(message);
    const hasSeriousMedicalQuery = medicalAnomalies.some(
      a => a.subType === 'serious_medical' || a.subType === 'emergency',
    );

    // Check for serious mental health content that MUST be flagged for admin review
    const mentalHealthAnomalies = detectMentalHealthContent(message);
    const hasSeriousMentalHealthQuery = mentalHealthAnomalies.some(
      a =>
        a.subType === 'crisis' ||
        a.subType === 'serious_mental_health' ||
        a.subType === 'emotional_distress',
    );

    // Check for hallucination-prone queries that should be flagged for verification
    const hallucinationAnomalies = detectHallucinationContent(message);
    const hasHighHallucinationRisk = hallucinationAnomalies.some(
      a => a.severity === 'high' || a.severity === 'critical',
    );

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

    // If message is blocked by Layer 1
    if (layer1Result.isBlocked) {
      // Get primary anomaly for logging
      const primaryAnomaly = layer1Result.anomalies[0];

      // Determine if this is a critical safety issue that should block the entire chat
      // Safety issues (self-harm, violence, illegal activity) should block the chat
      const isSafetyIssue = layer1Result.anomalies.some(
        a => a.type === 'safety' && a.severity === 'critical',
      );
      const safetySubType = layer1Result.anomalies.find(
        a => a.type === 'safety',
      )?.subType;

      // For safety issues, we still generate the AI response for admin review
      // but don't show it to the user until admin approves
      if (isSafetyIssue) {
        // Generate AI response for admin review (hidden from user)
        let generatedAIResponse: string | null = null;
        try {
          const systemPrompt = `You are a helpful AI assistant. Be concise but thorough in your responses. If the user shares images or documents, analyze them carefully and provide relevant insights.

IMPORTANT MEDICAL ADVICE GUIDELINES:
- You CAN provide basic wellness tips like: drink more water, walk more, get enough sleep, eat vegetables, stretch regularly, wash hands, take breaks from screens.
- You MUST NOT provide serious medical advice including: specific medication recommendations, dosages, diagnosis of conditions, treatment plans, or interpretation of symptoms for specific diseases.
- For any serious medical questions, politely redirect users to consult a healthcare professional.
- If asked about medications, dosages, or specific treatments, explain that you cannot provide that information and recommend consulting a doctor or pharmacist.`;

          // Generate response without streaming (for admin review)
          const responseChunks: string[] = [];
          for await (const chunk of streamGeminiResponse(
            geminiHistory,
            systemPrompt,
          )) {
            responseChunks.push(chunk);
          }
          generatedAIResponse = responseChunks.join('');
        } catch (error) {
          console.error(
            'Error generating AI response for admin review:',
            error,
          );
          // Continue even if generation fails - admin will see null response
        }

        // Update user message to mark as pending review
        await prisma.message.update({
          where: { id: userMessage.id },
          data: { isPendingReview: true },
        });

        // Create assistant message with hidden content (for admin to review)
        const assistantMessage = await prisma.message.create({
          data: {
            chatId,
            role: 'assistant',
            content: '', // Hidden from user
            originalContent: generatedAIResponse, // Stored for admin review
            isPendingReview: true,
            isBlocked: true,
          },
        });

        // Block the chat for admin review
        await prisma.chat.update({
          where: { id: chatId },
          data: {
            isHumanReviewBlocked: true,
            humanReviewReason: safetySubType || 'safety',
            humanReviewMessageId: assistantMessage.id,
            humanReviewStatus: 'pending',
            humanReviewMessage: `This chat has been blocked due to ${primaryAnomaly?.message?.toLowerCase() || 'safety concerns'}. An admin will review this conversation. Please start a new chat.`,
          },
        });

        // Create anomaly log for admin review with the generated AI response
        await prisma.anomalyLog.create({
          data: {
            messageId: assistantMessage.id,
            userId: session.user.id,
            userEmail: session.user.email,
            chatId,
            anomalyType: primaryAnomaly?.type || 'unknown',
            severity: primaryAnomaly?.severity || 'high',
            layer: 'deterministic',
            userQuery: message,
            aiResponse: generatedAIResponse, // Include AI response for admin review
            detectionDetails: layer1Result as object,
            safetyScore: layer1Result.safetyScore,
            userEmotion: layer1Result.userEmotion,
            status: 'pending', // Pending admin review
          },
        });

        // Return blocked response
        return NextResponse.json({
          blocked: true,
          chatBlocked: true,
          layer: 'deterministic',
          detection: {
            layer: 'deterministic',
            isBlocked: true,
            isWarning: false,
            isPendingReview: true,
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
            blockMessage: `🚫 Message Blocked: ${primaryAnomaly?.message || 'Safety protocols triggered'}. This chat has been blocked and sent for admin review. Please start a new chat.`,
          },
          messageId: userMessage.id,
        });
      }

      // For non-safety blocks (injection, etc.), block without AI generation
      // Create a blocked assistant message to persist the block state
      const blockMessage =
        layer1Result.userMessage ||
        `Message Blocked: ${primaryAnomaly?.message || 'Security protocols triggered'}. This incident has been logged.`;

      const blockedAssistantMessage = await prisma.message.create({
        data: {
          chatId,
          role: 'assistant',
          content: blockMessage,
          isBlocked: true,
          isPendingReview: false,
        },
      });

      await prisma.anomalyLog.create({
        data: {
          messageId: blockedAssistantMessage.id,
          userId: session.user.id,
          userEmail: session.user.email,
          chatId,
          anomalyType: primaryAnomaly?.type || 'unknown',
          severity: primaryAnomaly?.severity || 'high',
          layer: 'deterministic',
          userQuery: message,
          aiResponse: null,
          detectionDetails: layer1Result as object,
          safetyScore: layer1Result.safetyScore,
          userEmotion: layer1Result.userEmotion,
          status: 'blocked',
        },
      });

      // Return blocked response
      return NextResponse.json({
        blocked: true,
        chatBlocked: false,
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
          blockMessage: `🚫 ${blockMessage}`,
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

        const systemPrompt = `You are a helpful AI assistant. Be concise but thorough in your responses. If the user shares images or documents, analyze them carefully and provide relevant insights.

IMPORTANT MEDICAL ADVICE GUIDELINES:
- You CAN provide basic wellness tips like: drink more water, walk more, get enough sleep, eat vegetables, stretch regularly, wash hands, take breaks from screens.
- You MUST NOT provide serious medical advice including: specific medication recommendations, dosages, diagnosis of conditions, treatment plans, or interpretation of symptoms for specific diseases.
- For any serious medical questions, politely redirect users to consult a healthcare professional.
- If asked about medications, dosages, or specific treatments, explain that you cannot provide that information and recommend consulting a doctor or pharmacist.`;

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

            // FORCE admin review if serious medical query detected by pattern matching
            // This ensures medical queries are ALWAYS flagged regardless of Groq's analysis
            if (hasSeriousMedicalQuery) {
              isPendingReview = true;
            }

            // FORCE admin review if serious mental health content detected by pattern matching
            if (hasSeriousMentalHealthQuery) {
              isPendingReview = true;
            }

            // FORCE admin review if high hallucination risk detected by pattern matching
            if (hasHighHallucinationRisk) {
              isPendingReview = true;
            }

            if (needsLayer2) {
              sendThinkingStage(
                'semantic_analysis',
                'Running semantic analysis with Llama 3.1...',
              );

              try {
                semanticResult = await analyzeWithGroq(message, fullResponse);
                finalAccuracyScore = semanticResult.accuracyScore;

                // Check if human review is needed
                // Flag for review if medical advice is "serious" severity from Groq
                const isSeriousMedicalAdvice =
                  semanticResult.isMedicalAdvice &&
                  semanticResult.medicalAdviceSeverity === 'serious';

                // Flag for review if mental health is "moderate" or higher from Groq
                const isSeriousMentalHealth =
                  semanticResult.isMentalHealth &&
                  (semanticResult.mentalHealthSeverity === 'moderate' ||
                    semanticResult.mentalHealthSeverity === 'serious' ||
                    semanticResult.mentalHealthSeverity === 'crisis');

                // Flag for review if hallucination risk is medium or higher from Groq
                const isSeriousHallucination =
                  semanticResult.isHallucination &&
                  (semanticResult.hallucinationSeverity === 'medium' ||
                    semanticResult.hallucinationSeverity === 'high' ||
                    semanticResult.hallucinationSeverity === 'critical');

                // Combine: flag if Groq says so OR if pattern matching found serious content
                isPendingReview =
                  isPendingReview ||
                  semanticResult.requiresHumanReview ||
                  isSeriousMedicalAdvice ||
                  isSeriousMentalHealth ||
                  isSeriousHallucination;

                // If serious medical query (from pattern or Groq), set the review reason
                if (hasSeriousMedicalQuery || isSeriousMedicalAdvice) {
                  semanticResult.requiresHumanReview = true;
                  semanticResult.isMedicalAdvice = true;
                  semanticResult.medicalAdviceSeverity = 'serious';
                  semanticResult.reviewReason =
                    semanticResult.medicalAdviceReason ||
                    'Serious medical advice query detected - requires human expert review';
                }

                // If serious mental health content (from pattern or Groq), set the review reason
                if (hasSeriousMentalHealthQuery || isSeriousMentalHealth) {
                  semanticResult.requiresHumanReview = true;
                  semanticResult.isMentalHealth = true;
                  if (
                    !semanticResult.mentalHealthSeverity ||
                    semanticResult.mentalHealthSeverity === 'none' ||
                    semanticResult.mentalHealthSeverity === 'low'
                  ) {
                    semanticResult.mentalHealthSeverity = 'serious';
                  }
                  semanticResult.reviewReason =
                    semanticResult.mentalHealthReason ||
                    'Mental health content detected - requires human expert review for appropriate support';
                }

                // If high hallucination risk (from pattern or Groq), set the review reason
                if (hasHighHallucinationRisk || isSeriousHallucination) {
                  semanticResult.requiresHumanReview = true;
                  semanticResult.isHallucination = true;
                  if (
                    !semanticResult.hallucinationSeverity ||
                    semanticResult.hallucinationSeverity === 'none' ||
                    semanticResult.hallucinationSeverity === 'low'
                  ) {
                    semanticResult.hallucinationSeverity = 'high';
                  }
                  semanticResult.reviewReason =
                    semanticResult.hallucinationReason ||
                    'High hallucination risk detected - requires human verification for accuracy';
                }

                // Send Layer 2 results
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      semanticAnalysis: {
                        isHallucination: semanticResult.isHallucination,
                        hallucinationConfidence:
                          semanticResult.hallucinationConfidence,
                        hallucinationType: semanticResult.hallucinationType,
                        hallucinationSeverity:
                          semanticResult.hallucinationSeverity,
                        accuracyScore: semanticResult.accuracyScore,
                        isMedicalAdvice: semanticResult.isMedicalAdvice,
                        medicalAdviceSeverity:
                          semanticResult.medicalAdviceSeverity,
                        medicalAdviceReason: semanticResult.medicalAdviceReason,
                        isMentalHealth: semanticResult.isMentalHealth,
                        mentalHealthSeverity:
                          semanticResult.mentalHealthSeverity,
                        mentalHealthType: semanticResult.mentalHealthType,
                        mentalHealthReason: semanticResult.mentalHealthReason,
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

            // If human review is needed (from Layer 2 OR pattern matching), create anomaly log and BLOCK the chat
            if (isPendingReview) {
              // Determine the review reason for user-facing message
              // Prioritize based on severity: crisis > serious > medical/hallucination
              const isSeriousMedicalFromPattern = hasSeriousMedicalQuery;
              const isSeriousMedicalFromGroq =
                semanticResult?.isMedicalAdvice &&
                semanticResult?.medicalAdviceSeverity === 'serious';

              const isMentalHealthCrisis =
                semanticResult?.isMentalHealth &&
                semanticResult?.mentalHealthSeverity === 'crisis';
              const isSeriousMentalHealthFromPattern =
                hasSeriousMentalHealthQuery;
              const isSeriousMentalHealthFromGroq =
                semanticResult?.isMentalHealth &&
                (semanticResult?.mentalHealthSeverity === 'serious' ||
                  semanticResult?.mentalHealthSeverity === 'moderate');

              const isHighHallucinationFromPattern = hasHighHallucinationRisk;
              const isHighHallucinationFromGroq =
                semanticResult?.isHallucination &&
                (semanticResult?.hallucinationSeverity === 'high' ||
                  semanticResult?.hallucinationSeverity === 'critical');

              // Determine review reason with priority: crisis > mental_health > medical > hallucination
              let reviewReason: string;
              if (isMentalHealthCrisis) {
                reviewReason = 'mental_health_crisis';
              } else if (
                isSeriousMentalHealthFromPattern ||
                isSeriousMentalHealthFromGroq
              ) {
                reviewReason = 'mental_health';
              } else if (
                isSeriousMedicalFromPattern ||
                isSeriousMedicalFromGroq
              ) {
                reviewReason = 'serious_medical';
              } else if (semanticResult?.isMedicalAdvice) {
                reviewReason = 'medical';
              } else if (
                isHighHallucinationFromPattern ||
                isHighHallucinationFromGroq
              ) {
                reviewReason = 'hallucination';
              } else if (semanticResult?.emotionalConcern) {
                reviewReason = 'self_harm';
              } else if (semanticResult?.isPsychological) {
                reviewReason = 'psychological';
              } else if (semanticResult?.isHallucination) {
                reviewReason = 'hallucination';
              } else if (hasSeriousMentalHealthQuery) {
                reviewReason = 'mental_health';
              } else if (hasSeriousMedicalQuery) {
                reviewReason = 'serious_medical';
              } else if (hasHighHallucinationRisk) {
                reviewReason = 'hallucination';
              } else {
                reviewReason = 'unknown';
              }

              // Generate user-facing message
              const reviewMessages: Record<string, string> = {
                hallucination:
                  '🔍 AI response is being reviewed for accuracy. Our team will verify the information and respond shortly.',
                medical:
                  '⚕️ This query involves medical advice that requires human expert review. A qualified reviewer will respond shortly.',
                serious_medical:
                  '⚕️ This question involves serious medical advice that I cannot provide. For your safety, this has been flagged for review by a qualified human expert. Please consult a healthcare professional for medical concerns. An admin will review and respond shortly.',
                mental_health:
                  '💙 We care about your wellbeing. Your message involves mental health topics that require careful attention. A trained specialist is reviewing this to provide you with appropriate support.',
                mental_health_crisis:
                  "💙 We care deeply about your wellbeing. If you're in crisis, please reach out to a crisis helpline or emergency services immediately. A trained specialist is reviewing this conversation urgently to provide you with the best support.",
                self_harm:
                  '💙 We care about your wellbeing. A trained specialist is reviewing this conversation to provide you with the best support.',
                psychological:
                  '🧠 This query involves sensitive psychological content. A qualified reviewer will respond shortly.',
                unknown:
                  '🔒 This response requires human verification. Our team will review and respond shortly.',
              };

              await prisma.anomalyLog.create({
                data: {
                  messageId: assistantMessage.id, // Link to assistant message
                  userId: session.user.id,
                  userEmail: session.user.email,
                  chatId,
                  anomalyType: reviewReason,
                  severity: semanticResult?.riskLevel || 'high',
                  layer: semanticResult ? 'semantic' : 'deterministic',
                  userQuery: message,
                  aiResponse: fullResponse,
                  detectionDetails: {
                    layer1: layer1Result,
                    layer2: semanticResult,
                    medicalAnomalies: medicalAnomalies,
                    mentalHealthAnomalies: mentalHealthAnomalies,
                    hallucinationAnomalies: hallucinationAnomalies,
                    hasSeriousMedicalQuery,
                    hasSeriousMentalHealthQuery,
                    hasHighHallucinationRisk,
                  } as object,
                  safetyScore: layer1Result.safetyScore,
                  accuracyScore: semanticResult?.accuracyScore || 100,
                  userEmotion:
                    semanticResult?.userEmotion || layer1Result.userEmotion,
                  status: 'pending', // Awaiting human review
                },
              });

              // Update user message to mark as pending review
              await prisma.message.update({
                where: { id: userMessage.id },
                data: { isPendingReview: true },
              });

              // BLOCK the chat for human review
              await prisma.chat.update({
                where: { id: chatId },
                data: {
                  isHumanReviewBlocked: true,
                  humanReviewReason: reviewReason,
                  humanReviewMessageId: assistantMessage.id,
                  humanReviewStatus: 'pending',
                  humanReviewMessage:
                    reviewMessages[reviewReason] || reviewMessages['unknown'],
                  humanReviewLocked: false,
                },
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

            // Determine the review reason message if chat is blocked
            let humanReviewMessage: string | null = null;
            let finalReviewReason: string | null = null;
            if (isPendingReview) {
              // Determine review reason with same priority as above
              const isSeriousMedicalFromPattern = hasSeriousMedicalQuery;
              const isSeriousMedicalFromGroq =
                semanticResult?.isMedicalAdvice &&
                semanticResult?.medicalAdviceSeverity === 'serious';

              const isMentalHealthCrisis =
                semanticResult?.isMentalHealth &&
                semanticResult?.mentalHealthSeverity === 'crisis';
              const isSeriousMentalHealthFromPattern =
                hasSeriousMentalHealthQuery;
              const isSeriousMentalHealthFromGroq =
                semanticResult?.isMentalHealth &&
                (semanticResult?.mentalHealthSeverity === 'serious' ||
                  semanticResult?.mentalHealthSeverity === 'moderate');

              const isHighHallucinationFromPattern = hasHighHallucinationRisk;
              const isHighHallucinationFromGroq =
                semanticResult?.isHallucination &&
                (semanticResult?.hallucinationSeverity === 'high' ||
                  semanticResult?.hallucinationSeverity === 'critical');

              // Determine review reason with priority: crisis > mental_health > medical > hallucination
              if (isMentalHealthCrisis) {
                finalReviewReason = 'mental_health_crisis';
              } else if (
                isSeriousMentalHealthFromPattern ||
                isSeriousMentalHealthFromGroq
              ) {
                finalReviewReason = 'mental_health';
              } else if (
                isSeriousMedicalFromPattern ||
                isSeriousMedicalFromGroq
              ) {
                finalReviewReason = 'serious_medical';
              } else if (semanticResult?.isMedicalAdvice) {
                finalReviewReason = 'medical';
              } else if (
                isHighHallucinationFromPattern ||
                isHighHallucinationFromGroq
              ) {
                finalReviewReason = 'hallucination';
              } else if (semanticResult?.emotionalConcern) {
                finalReviewReason = 'self_harm';
              } else if (semanticResult?.isPsychological) {
                finalReviewReason = 'psychological';
              } else if (semanticResult?.isHallucination) {
                finalReviewReason = 'hallucination';
              } else if (hasSeriousMentalHealthQuery) {
                finalReviewReason = 'mental_health';
              } else if (hasSeriousMedicalQuery) {
                finalReviewReason = 'serious_medical';
              } else if (hasHighHallucinationRisk) {
                finalReviewReason = 'hallucination';
              } else {
                finalReviewReason = 'unknown';
              }

              const reviewMessages: Record<string, string> = {
                hallucination:
                  '🔍 AI response is being reviewed for accuracy. Our team will verify the information and respond shortly.',
                medical:
                  '⚕️ This query involves medical advice that requires human expert review. A qualified reviewer will respond shortly.',
                serious_medical:
                  '⚕️ This question involves serious medical advice that I cannot provide. For your safety, this has been flagged for review by a qualified human expert. Please consult a healthcare professional for medical concerns. An admin will review and respond shortly.',
                mental_health:
                  '💙 We care about your wellbeing. Your message involves mental health topics that require careful attention. A trained specialist is reviewing this to provide you with appropriate support.',
                mental_health_crisis:
                  "💙 We care deeply about your wellbeing. If you're in crisis, please reach out to a crisis helpline or emergency services immediately. A trained specialist is reviewing this conversation urgently to provide you with the best support.",
                self_harm:
                  '💙 We care about your wellbeing. A trained specialist is reviewing this conversation to provide you with the best support.',
                psychological:
                  '🧠 This query involves sensitive psychological content. A qualified reviewer will respond shortly.',
                unknown:
                  '🔒 This response requires human verification. Our team will review and respond shortly.',
              };
              humanReviewMessage =
                reviewMessages[finalReviewReason] || reviewMessages['unknown'];
            }

            // Send final response with all analysis
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  isPendingReview,
                  isChatBlocked: isPendingReview, // Chat is blocked for human review
                  accuracyScore: finalAccuracyScore,
                  pendingMessage: isPendingReview ? humanReviewMessage : null,
                  humanReviewReason: finalReviewReason,
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
