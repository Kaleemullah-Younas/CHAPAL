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
} from '@/lib/gemini';
import { Part } from '@google/generative-ai';

export const runtime = 'nodejs';

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

    // Save user message to database
    const attachmentsForDb = attachments.map(a => ({
      type: a.type,
      url: a.url,
      name: a.name,
      extractedText: a.extractedText,
    }));

    await prisma.message.create({
      data: {
        chatId,
        role: 'user',
        content: message,
        attachments: attachmentsForDb.length > 0 ? attachmentsForDb : null,
      },
    });

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

            // Save assistant message to database
            await prisma.message.create({
              data: {
                chatId,
                role: 'assistant',
                content: fullResponse,
              },
            });

            // Update chat's updatedAt
            await prisma.chat.update({
              where: { id: chatId },
              data: { updatedAt: new Date() },
            });

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`),
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
