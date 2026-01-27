import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/db';
import { TRPCError } from '@trpc/server';
import { deleteFromCloudinary } from '@/lib/cloudinary';

// Extract public ID from Cloudinary URL
// URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{folder}/{public_id}
// For images: extension is NOT part of public_id (Cloudinary adds it)
// For raw files: extension IS part of public_id (e.g., document.pdf)
function extractPublicIdFromUrl(
  url: string,
  isRawFile: boolean = false,
): string | null {
  try {
    // Remove any query parameters first
    const urlWithoutQuery = url.split('?')[0];

    // Decode URL-encoded characters (e.g., %20 -> space)
    const decodedUrl = decodeURIComponent(urlWithoutQuery);

    if (isRawFile) {
      // For raw files, keep the full path including extension
      // Match /upload/ followed by optional version (v + any alphanumeric), then capture the rest
      const regex = /\/upload\/(?:v[a-zA-Z0-9]+\/)?(.+)$/;
      const match = decodedUrl.match(regex);
      return match ? match[1] : null;
    } else {
      // For images, strip the extension
      const regex = /\/upload\/(?:v[a-zA-Z0-9]+\/)?(.+?)(?:\.[^./]+)?$/;
      const match = decodedUrl.match(regex);
      return match ? match[1] : null;
    }
  } catch {
    return null;
  }
}

export const chatRouter = router({
  // Get all chats for the current user
  getChats: protectedProcedure.query(async ({ ctx }) => {
    const chats = await prisma.chat.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return chats;
  }),

  // Get a specific chat with its messages
  getChatById: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const chat = await prisma.chat.findFirst({
        where: {
          id: input.chatId,
          userId: ctx.session.user.id,
        },
        select: {
          id: true,
          title: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            select: {
              id: true,
              role: true,
              content: true,
              attachments: true,
              chatId: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat not found',
        });
      }

      // Return with explicit typing to avoid deep instantiation
      return {
        id: chat.id,
        title: chat.title,
        userId: chat.userId,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messages: chat.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          attachments: m.attachments as
            | { type: string; url: string; name: string }[]
            | null,
          chatId: m.chatId,
          createdAt: m.createdAt,
        })),
      };
    }),

  // Create a new chat
  createChat: protectedProcedure
    .input(z.object({ title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const chat = await prisma.chat.create({
        data: {
          title: input.title || 'New Chat',
          userId: ctx.session.user.id,
        },
      });
      return chat;
    }),

  // Update chat title
  updateChatTitle: protectedProcedure
    .input(z.object({ chatId: z.string(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const chat = await prisma.chat.findFirst({
        where: {
          id: input.chatId,
          userId: ctx.session.user.id,
        },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat not found',
        });
      }

      return await prisma.chat.update({
        where: { id: input.chatId },
        data: { title: input.title },
      });
    }),

  // Delete a chat
  deleteChat: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const chat = await prisma.chat.findFirst({
        where: {
          id: input.chatId,
          userId: ctx.session.user.id,
        },
        include: {
          messages: {
            where: {
              attachments: { not: null },
            },
            select: {
              attachments: true,
            },
          },
        },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat not found',
        });
      }

      // Delete all Cloudinary assets from messages
      const deletePromises: Promise<void>[] = [];
      for (const message of chat.messages) {
        const attachments = message.attachments as
          | { type: string; url: string; name: string }[]
          | null;
        if (attachments && Array.isArray(attachments)) {
          for (const attachment of attachments) {
            // Determine the Cloudinary resource type based on attachment type
            // Images use 'image', documents (PDFs, etc.) use 'raw'
            const isRawFile = attachment.type !== 'image';
            const publicId = extractPublicIdFromUrl(attachment.url, isRawFile);
            console.log(
              `Deleting Cloudinary asset: type=${attachment.type}, isRawFile=${isRawFile}, url=${attachment.url}, publicId=${publicId}`,
            );
            if (publicId) {
              const resourceType: 'image' | 'raw' = isRawFile ? 'raw' : 'image';
              deletePromises.push(
                deleteFromCloudinary(publicId, resourceType).catch(err => {
                  console.error(
                    `Failed to delete Cloudinary asset ${publicId} (resourceType=${resourceType}):`,
                    err,
                  );
                }),
              );
            } else {
              console.error(
                `Failed to extract publicId from URL: ${attachment.url}`,
              );
            }
          }
        }
      }

      // Wait for all Cloudinary deletions to complete
      await Promise.all(deletePromises);

      // Delete the chat (messages will be cascade deleted)
      await prisma.chat.delete({
        where: { id: input.chatId },
      });

      return { success: true };
    }),

  // Add a message to a chat
  addMessage: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        attachments: z
          .array(
            z.object({
              type: z.enum(['image', 'document']),
              url: z.string(),
              name: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify chat belongs to user
      const chat = await prisma.chat.findFirst({
        where: {
          id: input.chatId,
          userId: ctx.session.user.id,
        },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat not found',
        });
      }

      const message = await prisma.message.create({
        data: {
          chatId: input.chatId,
          role: input.role,
          content: input.content,
          attachments: input.attachments || null,
        },
      });

      // Update chat's updatedAt
      await prisma.chat.update({
        where: { id: input.chatId },
        data: { updatedAt: new Date() },
      });

      return message;
    }),

  // Get messages for a chat
  getMessages: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const chat = await prisma.chat.findFirst({
        where: {
          id: input.chatId,
          userId: ctx.session.user.id,
        },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat not found',
        });
      }

      return await prisma.message.findMany({
        where: { chatId: input.chatId },
        orderBy: { createdAt: 'asc' },
      });
    }),

  // Get anomaly logs for a specific chat (for Live Flag Log persistence)
  getAnomalyLogs: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify chat belongs to user
      const chat = await prisma.chat.findFirst({
        where: {
          id: input.chatId,
          userId: ctx.session.user.id,
        },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat not found',
        });
      }

      // Get all messages with safety scores for this chat
      const messages = await prisma.message.findMany({
        where: { chatId: input.chatId },
        select: {
          safetyScore: true,
          accuracyScore: true,
          semanticAnalysis: true,
        },
      });

      // Get all anomaly logs for this chat
      const anomalyLogs = await prisma.anomalyLog.findMany({
        where: { chatId: input.chatId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          anomalyType: true,
          severity: true,
          layer: true,
          createdAt: true,
          detectionDetails: true,
          safetyScore: true,
          accuracyScore: true,
          userEmotion: true,
        },
      });

      // Calculate average safety score from all messages
      const safetyScores = messages
        .map(m => m.safetyScore)
        .filter((s): s is number => s !== null);
      const avgSafetyScore =
        safetyScores.length > 0
          ? Math.round(
              safetyScores.reduce((a, b) => a + b, 0) / safetyScores.length,
            )
          : 100;

      // Calculate average accuracy score only from messages with Layer 2 analysis
      // (messages where semanticAnalysis is not null had Layer 2 run)
      const accuracyScores = messages
        .filter(m => m.semanticAnalysis !== null && m.accuracyScore !== null)
        .map(m => m.accuracyScore as number);
      const avgAccuracyScore =
        accuracyScores.length > 0
          ? Math.round(
              accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length,
            )
          : 100;

      // Calculate predominant emotion from anomaly logs
      const emotionCounts: Record<string, number> = {};
      const intensityCounts: Record<string, number> = {
        low: 0,
        medium: 0,
        high: 0,
      };

      for (const log of anomalyLogs) {
        // Count emotions
        const emotion = log.userEmotion || 'Neutral';
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;

        // Count emotion intensities
        const details = log.detectionDetails as {
          emotionIntensity?: 'low' | 'medium' | 'high';
        } | null;
        const intensity = details?.emotionIntensity || 'low';
        intensityCounts[intensity]++;
      }

      // Find the most common emotion
      let predominantEmotion = 'Neutral';
      let maxCount = 0;
      for (const [emotion, count] of Object.entries(emotionCounts)) {
        if (count > maxCount) {
          maxCount = count;
          predominantEmotion = emotion;
        }
      }

      // Find the most common intensity
      let predominantIntensity: 'low' | 'medium' | 'high' = 'low';
      if (
        intensityCounts.high > intensityCounts.medium &&
        intensityCounts.high > intensityCounts.low
      ) {
        predominantIntensity = 'high';
      } else if (intensityCounts.medium > intensityCounts.low) {
        predominantIntensity = 'medium';
      }

      // Determine the current layer (semantic if any Layer 2 analysis exists)
      const hasSemanticAnalysis = anomalyLogs.some(
        log => log.layer === 'semantic',
      );
      const currentLayer = hasSemanticAnalysis ? 'semantic' : 'deterministic';

      // Transform to the format expected by TransparencyPanel
      const logs = anomalyLogs.map(log => {
        // Extract the descriptive message from detectionDetails
        const details = log.detectionDetails as {
          anomalies?: Array<{
            message?: string;
            type?: string;
            subType?: string;
          }>;
        } | null;

        // Get the first anomaly's message for display
        const primaryAnomaly = details?.anomalies?.[0];
        const displayMessage = primaryAnomaly?.message || log.anomalyType;

        return {
          id: log.id,
          timestamp: new Date(log.createdAt).toLocaleTimeString(),
          type: displayMessage,
          message: `${log.anomalyType}${primaryAnomaly?.subType ? ` (${primaryAnomaly.subType})` : ''}`,
          severity: (log.severity === 'critical' ? 'high' : log.severity) as
            | 'low'
            | 'medium'
            | 'high',
          layer: log.layer as 'deterministic' | 'semantic',
        };
      });

      // Prepare detection history for client-side cumulative calculations
      const emotionsHistory = anomalyLogs.map(log => {
        const details = log.detectionDetails as {
          emotionIntensity?: 'low' | 'medium' | 'high';
        } | null;
        return {
          emotion: log.userEmotion || 'Neutral',
          intensity: (details?.emotionIntensity || 'low') as
            | 'low'
            | 'medium'
            | 'high',
        };
      });

      return {
        logs,
        // Return aggregated panel state for the whole chat
        // Always return panel state - use calculated values if available, defaults otherwise
        panelState: {
          safetyScore: avgSafetyScore,
          accuracyScore: avgAccuracyScore,
          userEmotion: predominantEmotion,
          emotionIntensity: predominantIntensity,
          layer: currentLayer as 'deterministic' | 'semantic',
        },
        // Return raw detection history for client-side cumulative calculations
        detectionHistory: {
          safetyScores,
          accuracyScores,
          emotions: emotionsHistory,
        },
      };
    }),
});
