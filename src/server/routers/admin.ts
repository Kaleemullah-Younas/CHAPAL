import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '@/lib/db';
import {
  pusher,
  getChatChannelName,
  getUserChannelName,
  PUSHER_EVENTS,
} from '@/lib/pusher-server';
import { streamGeminiResponse, ChatMessage } from '@/lib/gemini';
import {
  storeFeedback,
  storeApprovedResponse,
  searchSimilarFeedback,
  buildLearningContext,
  getFeedbackStats,
  batchIndexExistingFeedback,
} from '@/lib/pinecone';

// Type for user with role
type UserWithRole = {
  id: string;
  role: string;
};

// Middleware to check if user is admin
const isAdmin = protectedProcedure.use(({ ctx, next }) => {
  const user = ctx.session.user as UserWithRole;
  if (user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
  return next();
});

export const adminRouter = router({
  // Search users by name or ID
  searchUsers: isAdmin
    .input(
      z.object({
        query: z.string().min(1),
        page: z.number().default(1),
        limit: z.number().default(10),
      }),
    )
    .query(async ({ input }) => {
      const { query, page, limit } = input;
      const skip = (page - 1) * limit;

      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { id: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
          image: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      const total = await prisma.user.count({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { id: { contains: query, mode: 'insensitive' } },
          ],
        },
      });

      return {
        users,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      };
    }),

  // Get all users with pagination
  getAllUsers: isAdmin
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
      }),
    )
    .query(async ({ input }) => {
      const { page, limit } = input;
      const skip = (page - 1) * limit;

      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
          image: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      const total = await prisma.user.count();

      return {
        users,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      };
    }),

  // Make user an admin
  makeAdmin: isAdmin
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { userId } = input;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      if (user.role === 'admin') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User is already an admin',
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: 'admin' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      return updatedUser;
    }),

  // Remove admin role (make user)
  removeAdmin: isAdmin
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = input;

      // Prevent admin from removing their own admin role
      if (userId === ctx.session.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot remove your own admin role',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      if (user.role !== 'admin') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User is not an admin',
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: 'user' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      return updatedUser;
    }),

  // Issue a warning to a user (max 3 warnings before blocking)
  // This does NOT close the anomaly - admin can still respond to it
  warnUser: isAdmin
    .input(
      z.object({
        userId: z.string(),
        anomalyId: z.string().optional(), // Link to the anomaly that triggered warning (for reference)
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId, anomalyId } = input;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      if (user.isBlocked) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User is already blocked',
        });
      }

      // No upper limit on warnings - admin can warn as many times as needed
      // if (user.warningCount >= 3) ... (removed constraint)

      const newWarningCount = user.warningCount + 1;

      // Update user warning count
      await prisma.user.update({
        where: { id: userId },
        data: { warningCount: newWarningCount },
      });

      // Get anomaly details for notification (if provided)
      let chatId: string | null = null;
      if (anomalyId) {
        const anomaly = await prisma.anomalyLog.findUnique({
          where: { id: anomalyId },
          select: { chatId: true },
        });
        chatId = anomaly?.chatId || null;
      }

      // Send notification to user via Pusher
      try {
        const userChannelName = getUserChannelName(userId);

        // Persist notification in database if we have a chatId
        // This ensures badge count works and notification persists
        let messageId = `warning-${Date.now()}`;

        if (chatId) {
          // Create a system message in the chat
          const warningMessage = await prisma.message.create({
            data: {
              chatId,
              role: 'assistant', // Use assistant role but content indicates system warning
              content: `⚠️ SYSTEM WARNING: You have been warned ${newWarningCount} time${newWarningCount === 1 ? '' : 's'}.`,
              isWarning: true,
              hasNotification: true,
              notificationRead: false,
              // We can rely on createdAt for timestamp
            },
          });
          messageId = warningMessage.id;
        }

        await pusher.trigger(userChannelName, PUSHER_EVENTS.NOTIFICATION, {
          id: messageId,
          chatId: chatId || '',
          chatTitle: 'System Warning',
          action: 'warning',
          warningCount: newWarningCount,
          message: `⚠️ You have been warned ${newWarningCount} time${newWarningCount === 1 ? '' : 's'}.`,
          timestamp: new Date().toISOString(),
        });
        console.log(`[Pusher] Warning notification sent to user ${userId}`);
      } catch (pusherError) {
        console.error(
          '[Pusher] Failed to send warning notification:',
          pusherError,
        );
      }

      return { success: true, warningCount: newWarningCount };
    }),

  // Get warning count for a user
  getUserWarningCount: isAdmin
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { warningCount: true, isBlocked: true },
      });
      return {
        warningCount: user?.warningCount ?? 0,
        isBlocked: user?.isBlocked ?? false,
      };
    }),

  // Get admin stats
  getStats: isAdmin.query(async () => {
    const [
      totalUsers,
      totalAdmins,
      verifiedUsers,
      totalAnomalies,
      pendingAnomalies,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.anomalyLog.count(),
      prisma.anomalyLog.count({ where: { status: 'pending' } }),
    ]);

    // Get top violation type
    const anomalyTypes = await prisma.anomalyLog.groupBy({
      by: ['anomalyType'],
      _count: { anomalyType: true },
      orderBy: { _count: { anomalyType: 'desc' } },
      take: 1,
    });

    const topViolationType = anomalyTypes[0]?.anomalyType || 'None';

    return {
      totalUsers,
      totalAdmins,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      totalAnomalies,
      pendingAnomalies,
      topViolationType,
    };
  }),

  // ============== CHAPAL Anomaly Management ==============

  // Get all anomalies with pagination
  getAnomalies: isAdmin
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        status: z
          .enum(['pending', 'approved', 'blocked', 'corrected', 'all'])
          .default('all'),
        severity: z
          .enum(['critical', 'high', 'medium', 'low', 'all'])
          .default('all'),
      }),
    )
    .query(async ({ input }) => {
      const { page, limit, status, severity } = input;
      const skip = (page - 1) * limit;

      const whereClause: Record<string, unknown> = {};
      if (status !== 'all') {
        whereClause.status = status;
      }
      if (severity !== 'all') {
        whereClause.severity = severity;
      }

      const [anomalies, total] = await Promise.all([
        prisma.anomalyLog.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            message: {
              select: {
                id: true,
                content: true,
                isBlocked: true,
                isWarning: true,
              },
            },
          },
        }),
        prisma.anomalyLog.count({ where: whereClause }),
      ]);

      return {
        anomalies: anomalies.map(a => ({
          id: a.id,
          timestamp: a.createdAt.toISOString(),
          userId: a.userId,
          userEmail: a.userEmail,
          chatId: a.chatId,
          messageId: a.messageId,
          anomalyType: a.anomalyType,
          severity: a.severity,
          userQuery: a.userQuery,
          aiResponse: a.aiResponse,
          detectionDetails: a.detectionDetails,
          safetyScore: a.safetyScore,
          userEmotion: a.userEmotion,
          status: a.status,
          reviewedBy: a.reviewedBy,
          reviewedAt: a.reviewedAt?.toISOString(),
          adminResponse: a.adminResponse,
          reviewNotes: a.reviewNotes,
        })),
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      };
    }),

  // Get single anomaly by ID
  getAnomalyById: isAdmin
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const anomaly = await prisma.anomalyLog.findUnique({
        where: { id: input.id },
        include: {
          message: {
            select: {
              id: true,
              content: true,
              isBlocked: true,
              isWarning: true,
              chat: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      if (!anomaly) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Anomaly not found',
        });
      }

      return {
        id: anomaly.id,
        timestamp: anomaly.createdAt.toISOString(),
        userId: anomaly.userId,
        userEmail: anomaly.userEmail,
        chatId: anomaly.chatId,
        messageId: anomaly.messageId,
        anomalyType: anomaly.anomalyType,
        severity: anomaly.severity,
        userQuery: anomaly.userQuery,
        aiResponse: anomaly.aiResponse,
        detectionDetails: anomaly.detectionDetails,
        safetyScore: anomaly.safetyScore,
        userEmotion: anomaly.userEmotion,
        status: anomaly.status,
        reviewedBy: anomaly.reviewedBy,
        reviewedAt: anomaly.reviewedAt?.toISOString(),
        adminResponse: anomaly.adminResponse,
        reviewNotes: anomaly.reviewNotes,
        message: anomaly.message,
      };
    }),

  // Review anomaly (approve, confirm block, or correct)
  reviewAnomaly: isAdmin
    .input(
      z.object({
        id: z.string(),
        action: z.enum(['approve', 'block', 'correct']),
        adminResponse: z.string().optional(), // For 'correct' action
        reviewNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, action, adminResponse, reviewNotes } = input;

      const anomaly = await prisma.anomalyLog.findUnique({
        where: { id },
        include: { message: true },
      });

      if (!anomaly) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Anomaly not found',
        });
      }

      // Map action to status
      const statusMap = {
        approve: 'approved',
        block: 'blocked',
        correct: 'corrected',
      };

      // Update the anomaly log
      const updatedAnomaly = await prisma.anomalyLog.update({
        where: { id },
        data: {
          status: statusMap[action],
          reviewedBy: ctx.session.user.id,
          reviewedAt: new Date(),
          adminResponse: action === 'correct' ? adminResponse : null,
          reviewNotes,
          feedbackApplied: true,
        },
      });

      // ============== STORE FEEDBACK IN PINECONE FOR LEARNING ==============
      // Store approved or corrected responses for AI learning
      if (action === 'approve' || action === 'correct') {
        try {
          const chatMessages = await prisma.message.findMany({
            where: { chatId: anomaly.chatId },
            orderBy: { createdAt: 'asc' },
            take: 10,
            select: { role: true, content: true },
          });

          let pineconeVectorId: string | undefined;

          if (action === 'correct' && adminResponse) {
            // Store as HUMAN RESPONSE - admin wrote this manually
            pineconeVectorId = await storeFeedback({
              userQuery: anomaly.userQuery,
              originalAiResponse: anomaly.aiResponse || '',
              adminResponse: adminResponse,
              adminInstructions:
                reviewNotes || 'Admin provided corrected response',
              anomalyType: anomaly.anomalyType,
              severity: anomaly.severity,
              chatContext: chatMessages.map(m => ({
                role: m.role,
                content: m.content,
              })),
              rating: 5, // Human responses get top rating
              iterationCount: 1,
              userId: anomaly.userId,
              chatId: anomaly.chatId,
              anomalyId: anomaly.id,
              responseSource: 'human', // Admin wrote this
              wasRegenerated: false,
            });
          } else if (action === 'approve') {
            // Store as AI response approved without changes
            pineconeVectorId = await storeApprovedResponse({
              userQuery: anomaly.userQuery,
              aiResponse: anomaly.aiResponse || '',
              anomalyType: anomaly.anomalyType,
              severity: anomaly.severity,
              chatContext: chatMessages.map(m => ({
                role: m.role,
                content: m.content,
              })),
              userId: anomaly.userId,
              chatId: anomaly.chatId,
              anomalyId: anomaly.id,
            });
          }

          if (pineconeVectorId) {
            await prisma.anomalyLog.update({
              where: { id },
              data: {
                pineconeVectorId,
                isIndexedInPinecone: true,
              },
            });
            console.log(
              `[Pinecone] Stored feedback for anomaly ${id}: ${pineconeVectorId}`,
            );
          }
        } catch (pineconeError) {
          console.error('[Pinecone] Error storing feedback:', pineconeError);
        }
      }

      // Check if this is a Layer 2 semantic review (chat is blocked)
      const chat = await prisma.chat.findUnique({
        where: { id: anomaly.chatId },
      });
      const isLayer2 = anomaly.layer === 'semantic';
      const isChatBlocked = chat?.isHumanReviewBlocked;

      // If approved (false positive), update the message and show original AI response
      if (action === 'approve' && anomaly.message) {
        // For Layer 2, show the original AI response with "Approved by Admin" label
        const originalContent =
          anomaly.message.originalContent || anomaly.aiResponse || '';

        await prisma.message.update({
          where: { id: anomaly.messageId },
          data: {
            content: originalContent,
            isBlocked: false,
            isWarning: false,
            isPendingReview: false,
            isAdminCorrected: true,
            correctedBy: ctx.session.user.id,
            correctedAt: new Date(),
            hasNotification: true,
            notificationRead: false,
          },
        });

        // Unblock the chat if it was blocked
        if (isChatBlocked) {
          await prisma.chat.update({
            where: { id: anomaly.chatId },
            data: {
              isHumanReviewBlocked: false,
              humanReviewStatus: 'approved',
              humanReviewAdminId: ctx.session.user.id,
              humanReviewedAt: new Date(),
              humanReviewLocked: true,
              humanReviewMessage: '✅ Approved by Admin',
            },
          });
        }

        // Trigger Pusher event to notify user's chat in real-time
        const approveChannelName = getChatChannelName(anomaly.chatId);
        console.log(
          `[Pusher] Triggering approve event on channel: ${approveChannelName}, event: ${PUSHER_EVENTS.ADMIN_RESPONSE}`,
        );

        try {
          await pusher.trigger(
            approveChannelName,
            PUSHER_EVENTS.ADMIN_RESPONSE,
            {
              chatId: anomaly.chatId,
              action: 'approve',
              responseLabel: '✅ Approved by Admin',
              adminResponse: originalContent,
              messageId: anomaly.messageId,
              timestamp: new Date().toISOString(),
            },
          );
          console.log('[Pusher] Approve event triggered successfully');

          // Also trigger notification to user channel
          const userChannelName = getUserChannelName(anomaly.userId);
          const chatForTitle = await prisma.chat.findUnique({
            where: { id: anomaly.chatId },
            select: { title: true },
          });
          await pusher.trigger(userChannelName, PUSHER_EVENTS.NOTIFICATION, {
            id: anomaly.messageId,
            chatId: anomaly.chatId,
            chatTitle: chatForTitle?.title || 'Untitled Chat',
            action: 'approve',
            message: 'Admin approved the AI response',
            timestamp: new Date().toISOString(),
          });
          console.log('[Pusher] User notification triggered successfully');
        } catch (pusherError) {
          console.error(
            '[Pusher] Failed to trigger approve event:',
            pusherError,
          );
        }
      }

      // If blocked, block the USER completely (dead user)
      if (action === 'block') {
        // Block the user
        await prisma.user.update({
          where: { id: anomaly.userId },
          data: {
            isBlocked: true,
            blockedAt: new Date(),
            blockedBy: ctx.session.user.id,
            blockedReason: `Blocked due to ${anomaly.anomalyType} violation`,
          },
        });

        // Update message
        if (anomaly.message) {
          await prisma.message.update({
            where: { id: anomaly.messageId },
            data: {
              content: '',
              isBlocked: true,
              isPendingReview: false,
              hasNotification: true,
              notificationRead: false,
            },
          });
        }

        // Unblock the chat (user is blocked anyway)
        if (isChatBlocked) {
          await prisma.chat.update({
            where: { id: anomaly.chatId },
            data: {
              isHumanReviewBlocked: false,
              humanReviewStatus: 'blocked',
              humanReviewAdminId: ctx.session.user.id,
              humanReviewedAt: new Date(),
              humanReviewLocked: true,
              humanReviewMessage: '🚫 Account blocked by Admin',
            },
          });
        }
      }

      // If corrected, update the existing assistant message with the admin response
      // This is the "human-in-the-loop" feedback loop
      if (action === 'correct' && adminResponse && anomaly.messageId) {
        // Update the existing message with the admin response
        if (anomaly.message) {
          await prisma.message.update({
            where: { id: anomaly.messageId },
            data: {
              // Replace content with admin response
              content: adminResponse,
              // Store original AI response for learning
              originalContent:
                anomaly.message.originalContent || anomaly.aiResponse,
              // Mark as admin corrected
              isAdminCorrected: true,
              correctedBy: ctx.session.user.id,
              correctedAt: new Date(),
              // No longer pending
              isPendingReview: false,
              isBlocked: false,
              isWarning: false,
              // Notification for user
              hasNotification: true,
              notificationRead: false,
            },
          });
        }

        // Unblock the chat if it was blocked
        if (isChatBlocked) {
          await prisma.chat.update({
            where: { id: anomaly.chatId },
            data: {
              isHumanReviewBlocked: false,
              humanReviewStatus: 'admin_response',
              humanReviewAdminId: ctx.session.user.id,
              humanReviewResponse: adminResponse,
              humanReviewedAt: new Date(),
              humanReviewLocked: true,
              humanReviewMessage: '👤 Admin Response',
            },
          });
        }

        // Trigger Pusher event to notify user's chat in real-time
        const anomalyChannelName = getChatChannelName(anomaly.chatId);
        console.log(
          `[Pusher] Triggering event on channel: ${anomalyChannelName}, event: ${PUSHER_EVENTS.ADMIN_RESPONSE}`,
        );

        try {
          await pusher.trigger(
            anomalyChannelName,
            PUSHER_EVENTS.ADMIN_RESPONSE,
            {
              chatId: anomaly.chatId,
              action: 'correct',
              responseLabel: '👤 Admin Response',
              adminResponse,
              messageId: anomaly.messageId,
              timestamp: new Date().toISOString(),
            },
          );
          console.log('[Pusher] Event triggered successfully');

          // Also trigger notification to user channel
          const userChannelName = getUserChannelName(anomaly.userId);
          const chatForTitle = await prisma.chat.findUnique({
            where: { id: anomaly.chatId },
            select: { title: true },
          });
          await pusher.trigger(userChannelName, PUSHER_EVENTS.NOTIFICATION, {
            id: anomaly.messageId,
            chatId: anomaly.chatId,
            chatTitle: chatForTitle?.title || 'Untitled Chat',
            action: 'admin_response',
            message: 'Admin responded to your chat',
            timestamp: new Date().toISOString(),
          });
          console.log('[Pusher] User notification triggered successfully');
        } catch (pusherError) {
          console.error('[Pusher] Failed to trigger event:', pusherError);
        }
      }

      return {
        success: true,
        status: statusMap[action],
        anomalyId: updatedAnomaly.id,
      };
    }),

  // Human Review Action - Approve, Block, or Write Custom Response
  // This unblocks the chat and allows user to continue messaging
  humanReviewAction: isAdmin
    .input(
      z.object({
        chatId: z.string(),
        action: z.enum(['approve', 'block', 'admin_response']),
        adminResponse: z.string().optional(), // For 'admin_response' action
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { chatId, action, adminResponse } = input;

      // Find the chat
      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat not found',
        });
      }

      // Check if already reviewed (locked)
      if (chat.humanReviewLocked) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'This review has already been completed. Admin response is locked.',
        });
      }

      // Check if chat is actually pending review
      if (!chat.isHumanReviewBlocked || chat.humanReviewStatus !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This chat is not pending human review',
        });
      }

      // For admin_response action, adminResponse is required
      if (action === 'admin_response' && !adminResponse?.trim()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Admin response is required for this action',
        });
      }

      // Find the original AI message that triggered the review
      const pendingMessage = chat.humanReviewMessageId
        ? await prisma.message.findUnique({
            where: { id: chat.humanReviewMessageId },
          })
        : null;

      // Also find the associated anomaly log
      const anomalyLog = chat.humanReviewMessageId
        ? await prisma.anomalyLog.findFirst({
            where: { messageId: chat.humanReviewMessageId },
          })
        : null;

      // Prepare the response content and label based on action
      let responseContent = '';
      let responseLabel = '';

      if (action === 'approve') {
        // Approve the AI response - show original AI response with "Approved by Admin" label
        responseContent =
          pendingMessage?.originalContent || pendingMessage?.content || '';
        responseLabel = '✅ Approved by Admin';
      } else if (action === 'block') {
        // Block the USER completely - they are a dead user now
        responseContent = '';
        responseLabel = '🚫 Account blocked by Admin';

        // Block the user completely
        await prisma.user.update({
          where: { id: chat.userId },
          data: {
            isBlocked: true,
            blockedAt: new Date(),
            blockedBy: ctx.session.user.id,
            blockedReason: `Blocked due to ${chat.humanReviewReason || 'policy violation'} in chat review`,
          },
        });
      } else if (action === 'admin_response') {
        // Admin writes custom response
        responseContent = adminResponse || '';
        responseLabel = '👤 Admin Response';
      }

      // Handle the message update differently based on whether it's a user or assistant message
      // For Layer 1 safety blocks, the pending message is the USER message (no AI response was generated)
      // In this case, we need to CREATE a new assistant message for the admin response
      let adminResponseMessageId: string | null = null;

      if (pendingMessage) {
        if (pendingMessage.role === 'user') {
          // This is a Layer 1 safety block - the user message was blocked before AI could respond
          // Create a new assistant message with the admin response
          if (action === 'admin_response') {
            const adminMessage = await prisma.message.create({
              data: {
                chatId,
                role: 'assistant',
                content: responseContent || adminResponse || '',
                isPendingReview: false,
                isAdminCorrected: true,
                correctedBy: ctx.session.user.id,
                correctedAt: new Date(),
                hasNotification: true,
                notificationRead: false,
              },
            });
            adminResponseMessageId = adminMessage.id;
          }

          // Mark the original user message as no longer pending (but don't modify its content)
          await prisma.message.update({
            where: { id: pendingMessage.id },
            data: {
              isPendingReview: false,
              isBlocked: action === 'block',
            },
          });
        } else {
          // This is a Layer 2 review - the pending message is an existing assistant message
          if (action === 'admin_response') {
            // Create a NEW assistant message for the admin response
            // instead of replacing the original AI response
            const adminMessage = await prisma.message.create({
              data: {
                chatId,
                role: 'assistant',
                content: responseContent || adminResponse || '',
                isPendingReview: false,
                isAdminCorrected: true,
                correctedBy: ctx.session.user.id,
                correctedAt: new Date(),
                hasNotification: true,
                notificationRead: false,
              },
            });
            adminResponseMessageId = adminMessage.id;

            // Mark the original assistant message as no longer pending (keep original content)
            await prisma.message.update({
              where: { id: pendingMessage.id },
              data: {
                isPendingReview: false,
                isBlocked: false,
              },
            });
          } else {
            // For approve/block actions, update the existing message
            await prisma.message.update({
              where: { id: pendingMessage.id },
              data: {
                content:
                  action === 'approve'
                    ? responseContent
                    : pendingMessage.content,
                isPendingReview: false,
                isAdminCorrected: action === 'approve',
                isBlocked: action === 'block',
                correctedBy: ctx.session.user.id,
                correctedAt: new Date(),
                hasNotification: true,
                notificationRead: false,
              },
            });
          }
        }
      }

      // Update the anomaly log
      if (anomalyLog) {
        await prisma.anomalyLog.update({
          where: { id: anomalyLog.id },
          data: {
            status:
              action === 'approve'
                ? 'approved'
                : action === 'block'
                  ? 'blocked'
                  : 'corrected',
            reviewedBy: ctx.session.user.id,
            reviewedAt: new Date(),
            adminResponse: action === 'admin_response' ? adminResponse : null,
            feedbackApplied: true,
          },
        });
      }

      // Update the chat to unblock it and mark as reviewed
      // For 'block' action, the user is blocked entirely so this doesn't matter much
      await prisma.chat.update({
        where: { id: chatId },
        data: {
          isHumanReviewBlocked: false, // Unblock the chat (user is blocked if action=block)
          humanReviewStatus: action,
          humanReviewAdminId: ctx.session.user.id,
          humanReviewResponse:
            action === 'admin_response' ? adminResponse : null,
          humanReviewedAt: new Date(),
          humanReviewLocked: true, // Lock the review - admin can only respond once
          humanReviewMessage: responseLabel, // Update the message to show the result
          // Update the message ID to point to the admin response message if one was created
          humanReviewMessageId:
            adminResponseMessageId || chat.humanReviewMessageId,
        },
      });

      // Trigger Pusher event to notify user's chat in real-time
      const channelName = getChatChannelName(chatId);
      console.log(
        `[Pusher] Triggering event on channel: ${channelName}, event: ${PUSHER_EVENTS.ADMIN_RESPONSE}`,
      );

      try {
        await pusher.trigger(channelName, PUSHER_EVENTS.ADMIN_RESPONSE, {
          chatId,
          action,
          responseLabel,
          adminResponse:
            action === 'admin_response' ? adminResponse : undefined,
          messageId: adminResponseMessageId || chat.humanReviewMessageId,
          timestamp: new Date().toISOString(),
        });
        console.log('[Pusher] Event triggered successfully');

        // Also trigger notification to user channel (not for block action since user is blocked)
        if (action !== 'block') {
          const userChannelName = getUserChannelName(chat.userId);
          await pusher.trigger(userChannelName, PUSHER_EVENTS.NOTIFICATION, {
            id: adminResponseMessageId || chat.humanReviewMessageId,
            chatId,
            chatTitle: chat.title || 'Untitled Chat',
            action,
            message:
              action === 'approve'
                ? 'Admin approved the AI response'
                : 'Admin responded to your chat',
            timestamp: new Date().toISOString(),
          });
          console.log('[Pusher] User notification triggered successfully');
        }
      } catch (pusherError) {
        console.error('[Pusher] Failed to trigger event:', pusherError);
      }

      return {
        success: true,
        action,
        chatId,
        responseLabel,
      };
    }),

  // Get chats pending human review
  getPendingHumanReviews: isAdmin
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
      }),
    )
    .query(async ({ input }) => {
      const { page, limit } = input;
      const skip = (page - 1) * limit;

      const [chats, total] = await Promise.all([
        prisma.chat.findMany({
          where: {
            isHumanReviewBlocked: true,
            humanReviewStatus: 'pending',
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 5, // Last 5 messages for context
              select: {
                id: true,
                role: true,
                content: true,
                originalContent: true,
                isPendingReview: true,
                createdAt: true,
              },
            },
          },
        }),
        prisma.chat.count({
          where: {
            isHumanReviewBlocked: true,
            humanReviewStatus: 'pending',
          },
        }),
      ]);

      return {
        chats: chats.map(chat => ({
          id: chat.id,
          title: chat.title,
          userId: chat.userId,
          userEmail: chat.user.email,
          userName: chat.user.name,
          humanReviewReason: chat.humanReviewReason,
          humanReviewMessage: chat.humanReviewMessage,
          humanReviewMessageId: chat.humanReviewMessageId,
          updatedAt: chat.updatedAt.toISOString(),
          messages: chat.messages.reverse().map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            originalContent: m.originalContent,
            isPendingReview: m.isPendingReview,
            createdAt: m.createdAt.toISOString(),
          })),
        })),
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      };
    }),

  // Get the AI's original response for a pending review
  getOriginalAIResponse: isAdmin
    .input(z.object({ messageId: z.string() }))
    .query(async ({ input }) => {
      const message = await prisma.message.findUnique({
        where: { id: input.messageId },
        select: {
          id: true,
          content: true,
          originalContent: true,
          isPendingReview: true,
        },
      });

      if (!message) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Message not found',
        });
      }

      // Also get the anomaly log for context
      const anomalyLog = await prisma.anomalyLog.findFirst({
        where: { messageId: input.messageId },
        select: {
          aiResponse: true,
          userQuery: true,
          anomalyType: true,
          severity: true,
          detectionDetails: true,
        },
      });

      return {
        messageId: message.id,
        originalContent:
          message.originalContent || anomalyLog?.aiResponse || '',
        userQuery: anomalyLog?.userQuery || '',
        anomalyType: anomalyLog?.anomalyType || 'unknown',
        severity: anomalyLog?.severity || 'medium',
        detectionDetails: anomalyLog?.detectionDetails,
      };
    }),

  // Get pending Layer 2 reviews (semantic analysis requiring human verification)
  getPendingSemanticReviews: isAdmin
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
      }),
    )
    .query(async ({ input }) => {
      const { page, limit } = input;
      const skip = (page - 1) * limit;

      const [anomalies, total] = await Promise.all([
        prisma.anomalyLog.findMany({
          where: {
            layer: 'semantic',
            status: 'pending',
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            message: {
              select: {
                id: true,
                content: true,
                isPendingReview: true,
                accuracyScore: true,
                semanticAnalysis: true,
              },
            },
          },
        }),
        prisma.anomalyLog.count({
          where: {
            layer: 'semantic',
            status: 'pending',
          },
        }),
      ]);

      return {
        anomalies: anomalies.map(a => ({
          id: a.id,
          timestamp: a.createdAt.toISOString(),
          userId: a.userId,
          userEmail: a.userEmail,
          chatId: a.chatId,
          messageId: a.messageId,
          anomalyType: a.anomalyType,
          severity: a.severity,
          userQuery: a.userQuery,
          aiResponse: a.aiResponse,
          detectionDetails: a.detectionDetails,
          safetyScore: a.safetyScore,
          userEmotion: a.userEmotion,
          layer: a.layer,
          accuracyScore: a.accuracyScore,
          semanticAnalysis: a.message?.semanticAnalysis,
        })),
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      };
    }),

  // Mark user notification as read
  markNotificationRead: isAdmin
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.message.update({
        where: { id: input.messageId },
        data: { notificationRead: true },
      });
      return { success: true };
    }),

  // Get anomaly statistics for dashboard
  getAnomalyStats: isAdmin.query(async () => {
    const [
      totalAnomalies,
      pendingCount,
      blockedCount,
      approvedCount,
      correctedCount,
    ] = await Promise.all([
      prisma.anomalyLog.count(),
      prisma.anomalyLog.count({ where: { status: 'pending' } }),
      prisma.anomalyLog.count({ where: { status: 'blocked' } }),
      prisma.anomalyLog.count({ where: { status: 'approved' } }),
      prisma.anomalyLog.count({ where: { status: 'corrected' } }),
    ]);

    // Get counts by anomaly type
    const typeStats = await prisma.anomalyLog.groupBy({
      by: ['anomalyType'],
      _count: { anomalyType: true },
    });

    // Get counts by severity
    const severityStats = await prisma.anomalyLog.groupBy({
      by: ['severity'],
      _count: { severity: true },
    });

    // Get recent activity (last 24 hours)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAnomalies = await prisma.anomalyLog.count({
      where: { createdAt: { gte: last24h } },
    });

    return {
      total: totalAnomalies,
      pending: pendingCount,
      blocked: blockedCount,
      approved: approvedCount,
      corrected: correctedCount,
      byType: typeStats.reduce(
        (acc, curr) => {
          acc[curr.anomalyType] = curr._count.anomalyType;
          return acc;
        },
        {} as Record<string, number>,
      ),
      bySeverity: severityStats.reduce(
        (acc, curr) => {
          acc[curr.severity] = curr._count.severity;
          return acc;
        },
        {} as Record<string, number>,
      ),
      recentAnomalies,
    };
  }),

  // ============== Human-in-the-Loop Semantic Review ==============

  // Get review history for an anomaly (all iterations)
  getSemanticReviewHistory: isAdmin
    .input(z.object({ anomalyId: z.string() }))
    .query(async ({ input }) => {
      const anomaly = await prisma.anomalyLog.findUnique({
        where: { id: input.anomalyId },
        include: {
          message: {
            include: {
              chat: {
                include: {
                  messages: {
                    orderBy: { createdAt: 'asc' },
                    take: 20, // Get conversation context
                    select: {
                      id: true,
                      role: true,
                      content: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!anomaly) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Anomaly not found',
        });
      }

      // Parse review iterations from JSON
      const iterations =
        (anomaly.reviewIterations as Array<{
          response: string;
          adminInstructions: string;
          rating: number;
          timestamp: string;
        }>) || [];

      return {
        anomalyId: anomaly.id,
        userQuery: anomaly.userQuery,
        originalAiResponse: anomaly.aiResponse || '',
        currentResponse: anomaly.adminResponse || anomaly.aiResponse || '',
        iterations,
        iterationCount: anomaly.iterationCount,
        status: anomaly.status,
        severity: anomaly.severity,
        anomalyType: anomaly.anomalyType,
        accuracyScore: anomaly.accuracyScore,
        chatContext:
          anomaly.message?.chat?.messages.map(m => ({
            role: m.role,
            content: m.content,
          })) || [],
      };
    }),

  // Regenerate AI response with admin instructions
  regenerateSemanticResponse: isAdmin
    .input(
      z.object({
        anomalyId: z.string(),
        adminInstructions: z.string().min(1),
        currentResponseRating: z.number().min(1).max(5),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { anomalyId, adminInstructions, currentResponseRating } = input;

      const anomaly = await prisma.anomalyLog.findUnique({
        where: { id: anomalyId },
        include: {
          message: {
            include: {
              chat: {
                include: {
                  messages: {
                    orderBy: { createdAt: 'asc' },
                    take: 10, // Get recent conversation context
                    select: {
                      role: true,
                      content: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!anomaly) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Anomaly not found',
        });
      }

      if (anomaly.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This review has already been completed',
        });
      }

      // Get current iterations
      const existingIterations =
        (anomaly.reviewIterations as Array<{
          response: string;
          adminInstructions: string;
          rating: number;
          timestamp: string;
        }>) || [];

      // Current response to rate (either last iteration or original)
      const currentResponse =
        existingIterations.length > 0
          ? existingIterations[existingIterations.length - 1].response
          : anomaly.aiResponse || '';

      // Add current response with rating to iterations
      const newIteration = {
        response: currentResponse,
        adminInstructions,
        rating: currentResponseRating,
        timestamp: new Date().toISOString(),
      };

      const updatedIterations = [...existingIterations, newIteration];

      // Build the prompt for regeneration with all context
      const iterationsContext = updatedIterations
        .map(
          (iter, idx) =>
            `--- Attempt ${idx + 1} ---
Response: ${iter.response}
Admin Rating: ${iter.rating}/5 stars
Admin Feedback: ${iter.adminInstructions}
`,
        )
        .join('\n');

      // ============== PINECONE SIMILARITY SEARCH ==============
      // Search for similar cases from previous admin corrections
      let learningContext = '';
      try {
        console.log(
          '[Pinecone] Searching for similar feedback for query:',
          anomaly.userQuery.substring(0, 100),
        );
        const similarFeedback = await searchSimilarFeedback(anomaly.userQuery, {
          topK: 5,
          minRating: 3,
          includeHumanResponses: true, // Admin-written responses (highest value)
          includeAiApproved: true, // AI responses approved by admin
          includeChatHistory: false, // Only use admin-reviewed content for learning
        });

        if (similarFeedback.length > 0) {
          learningContext = buildLearningContext(similarFeedback, 3);
          console.log(
            `[Pinecone] Found ${similarFeedback.length} similar cases for learning context`,
          );
        }
      } catch (pineconeError) {
        // Log but don't fail - Pinecone is enhancement, not required
        console.error(
          '[Pinecone] Error searching similar feedback:',
          pineconeError,
        );
      }

      const systemPrompt = `You are a helpful AI assistant. The admin has reviewed your previous responses and provided feedback. Generate an improved response based on the following context:

IMPORTANT GUIDELINES:
- This is a sensitive query that requires careful handling
- The admin has rated previous attempts and provided specific feedback
- Incorporate ALL admin feedback to improve the response
- Be accurate, helpful, and safe
- Do NOT provide medical diagnoses or specific medication recommendations
- If the query is about health, recommend seeking professional medical advice
${learningContext}
USER'S ORIGINAL QUERY:
${anomaly.userQuery}

CONVERSATION CONTEXT:
${anomaly.message?.chat?.messages.map(m => `${m.role}: ${m.content}`).join('\n') || 'No prior context'}

PREVIOUS ATTEMPTS AND ADMIN FEEDBACK:
${iterationsContext}

Generate an improved response that addresses all the admin's feedback. Be concise, accurate, and helpful while maintaining safety guidelines.`;

      // Generate new response using Gemini
      const messages: ChatMessage[] = [
        {
          role: 'user',
          parts: [{ text: anomaly.userQuery }],
        },
      ];

      let newResponse = '';
      try {
        for await (const chunk of streamGeminiResponse(
          messages,
          systemPrompt,
        )) {
          newResponse += chunk;
        }
      } catch (error) {
        console.error('Error generating response:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate new response',
        });
      }

      // Update the anomaly with new iteration history
      await prisma.anomalyLog.update({
        where: { id: anomalyId },
        data: {
          reviewIterations: updatedIterations,
          iterationCount: updatedIterations.length,
          adminResponse: newResponse, // Store latest response
        },
      });

      return {
        success: true,
        newResponse,
        iterationCount: updatedIterations.length,
      };
    }),

  // Approve semantic review response (send to client)
  approveSemanticReview: isAdmin
    .input(
      z.object({
        anomalyId: z.string(),
        finalRating: z.number().min(1).max(5).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { anomalyId, finalRating } = input;

      const anomaly = await prisma.anomalyLog.findUnique({
        where: { id: anomalyId },
        include: { message: true },
      });

      if (!anomaly) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Anomaly not found',
        });
      }

      if (anomaly.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This review has already been completed',
        });
      }

      // Get the current response (either from iterations or original)
      const existingIterations =
        (anomaly.reviewIterations as Array<{
          response: string;
          adminInstructions: string;
          rating: number;
          timestamp: string;
        }>) || [];

      const approvedResponse =
        anomaly.adminResponse || anomaly.aiResponse || '';

      // If there's a final rating, add it to iterations
      if (finalRating && existingIterations.length > 0) {
        const lastIteration = existingIterations[existingIterations.length - 1];
        // Only update if this is rating a new response
        if (lastIteration.response !== approvedResponse) {
          existingIterations.push({
            response: approvedResponse,
            adminInstructions: 'APPROVED',
            rating: finalRating,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Update the anomaly log
      await prisma.anomalyLog.update({
        where: { id: anomalyId },
        data: {
          status: 'corrected',
          reviewedBy: ctx.session.user.id,
          reviewedAt: new Date(),
          adminResponse: approvedResponse,
          reviewIterations: existingIterations,
          feedbackApplied: true,
          reviewNotes: `Approved after ${existingIterations.length} iterations. Final rating: ${finalRating || 'N/A'}`,
        },
      });

      // ============== STORE FEEDBACK IN PINECONE FOR LEARNING ==============
      // This helps the AI learn from admin corrections over time
      let pineconeVectorId: string | undefined;
      try {
        // Get chat context for the feedback
        const chatMessages = await prisma.message.findMany({
          where: { chatId: anomaly.chatId },
          orderBy: { createdAt: 'asc' },
          take: 10,
          select: { role: true, content: true },
        });

        // Determine the response type:
        // - If iterations > 0: AI was regenerated with feedback, then approved
        // - If no iterations but response differs: This shouldn't happen in semantic review flow
        // - If no iterations and response same: Original AI response approved
        const wasRegenerated = existingIterations.length > 0;

        if (wasRegenerated) {
          // AI REGENERATED AND APPROVED - AI wrote it but with admin guidance
          const lastIteration =
            existingIterations[existingIterations.length - 1];
          pineconeVectorId = await storeFeedback({
            userQuery: anomaly.userQuery,
            originalAiResponse: anomaly.aiResponse || '',
            adminResponse: approvedResponse,
            adminInstructions:
              lastIteration?.adminInstructions || 'Approved after review',
            anomalyType: anomaly.anomalyType,
            severity: anomaly.severity,
            chatContext: chatMessages.map(m => ({
              role: m.role,
              content: m.content,
            })),
            rating: finalRating || lastIteration?.rating || 4,
            iterationCount: existingIterations.length,
            userId: anomaly.userId,
            chatId: anomaly.chatId,
            anomalyId: anomaly.id,
            responseSource: 'ai', // AI wrote this (with guidance)
            wasRegenerated: true,
          });
        } else {
          // AI ORIGINAL APPROVED - Original AI response approved without changes
          pineconeVectorId = await storeApprovedResponse({
            userQuery: anomaly.userQuery,
            aiResponse: approvedResponse,
            anomalyType: anomaly.anomalyType,
            severity: anomaly.severity,
            chatContext: chatMessages.map(m => ({
              role: m.role,
              content: m.content,
            })),
            userId: anomaly.userId,
            chatId: anomaly.chatId,
            anomalyId: anomaly.id,
          });
        }

        // Update anomaly with Pinecone vector ID
        if (pineconeVectorId) {
          await prisma.anomalyLog.update({
            where: { id: anomalyId },
            data: {
              pineconeVectorId,
              isIndexedInPinecone: true,
            },
          });
          console.log(
            `[Pinecone] Stored feedback for anomaly ${anomalyId}: ${pineconeVectorId}`,
          );
        }
      } catch (pineconeError) {
        // Log but don't fail - Pinecone is enhancement, not required
        console.error('[Pinecone] Error storing feedback:', pineconeError);
      }

      // Update the message with approved response
      if (anomaly.message) {
        await prisma.message.update({
          where: { id: anomaly.messageId },
          data: {
            content: approvedResponse,
            isBlocked: false,
            isWarning: false,
            isPendingReview: false,
            isAdminCorrected: true,
            correctedBy: ctx.session.user.id,
            correctedAt: new Date(),
            hasNotification: true,
            notificationRead: false,
          },
        });
      }

      // Unblock the chat
      const chat = await prisma.chat.findUnique({
        where: { id: anomaly.chatId },
      });

      if (chat?.isHumanReviewBlocked) {
        await prisma.chat.update({
          where: { id: anomaly.chatId },
          data: {
            isHumanReviewBlocked: false,
            humanReviewStatus: 'corrected',
            humanReviewAdminId: ctx.session.user.id,
            humanReviewedAt: new Date(),
            humanReviewLocked: true,
            humanReviewMessage: '✅ Response reviewed and approved by Admin',
            humanReviewResponse: approvedResponse,
          },
        });
      }

      // Trigger Pusher event to send response to client in real-time
      const channelName = getChatChannelName(anomaly.chatId);
      console.log(
        `[Pusher] Triggering semantic review approval on channel: ${channelName}`,
      );

      try {
        await pusher.trigger(channelName, PUSHER_EVENTS.ADMIN_RESPONSE, {
          chatId: anomaly.chatId,
          action: 'semantic_approved',
          responseLabel: '✅ Response reviewed and approved',
          adminResponse: approvedResponse,
          messageId: anomaly.messageId,
          timestamp: new Date().toISOString(),
        });
        console.log('[Pusher] Semantic review approval sent successfully');

        // Also notify the user
        const userChannelName = getUserChannelName(anomaly.userId);
        await pusher.trigger(userChannelName, PUSHER_EVENTS.NOTIFICATION, {
          id: anomaly.messageId,
          chatId: anomaly.chatId,
          chatTitle: chat?.title || 'Untitled Chat',
          action: 'semantic_approved',
          message:
            'Your message has been reviewed and a response is now available',
          timestamp: new Date().toISOString(),
        });
      } catch (pusherError) {
        console.error('[Pusher] Failed to send approval:', pusherError);
      }

      return {
        success: true,
        approvedResponse,
        iterationCount: existingIterations.length,
      };
    }),

  // Block user from semantic review
  blockUserFromSemanticReview: isAdmin
    .input(z.object({ anomalyId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { anomalyId } = input;

      const anomaly = await prisma.anomalyLog.findUnique({
        where: { id: anomalyId },
      });

      if (!anomaly) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Anomaly not found',
        });
      }

      // Block the user
      await prisma.user.update({
        where: { id: anomaly.userId },
        data: {
          isBlocked: true,
          blockedAt: new Date(),
          blockedBy: ctx.session.user.id,
          blockedReason: `Blocked due to ${anomaly.anomalyType} during semantic review`,
        },
      });

      // Update anomaly status
      await prisma.anomalyLog.update({
        where: { id: anomalyId },
        data: {
          status: 'blocked',
          reviewedBy: ctx.session.user.id,
          reviewedAt: new Date(),
          reviewNotes: 'User blocked during semantic review',
        },
      });

      // Update message
      if (anomaly.messageId) {
        await prisma.message.update({
          where: { id: anomaly.messageId },
          data: {
            content: '',
            isBlocked: true,
            isPendingReview: false,
          },
        });
      }

      // Unblock the chat (user is blocked anyway)
      await prisma.chat.update({
        where: { id: anomaly.chatId },
        data: {
          isHumanReviewBlocked: false,
          humanReviewStatus: 'blocked',
          humanReviewAdminId: ctx.session.user.id,
          humanReviewedAt: new Date(),
          humanReviewLocked: true,
          humanReviewMessage: '🚫 Account blocked by Admin',
        },
      });

      return { success: true };
    }),

  // ============== PINECONE LEARNING MANAGEMENT ==============

  // Get Pinecone feedback statistics
  getPineconeFeedbackStats: isAdmin.query(async () => {
    try {
      const stats = await getFeedbackStats();

      // Also get database stats for comparison
      const [totalAnomalies, indexedAnomalies, approvedCount, correctedCount] =
        await Promise.all([
          prisma.anomalyLog.count(),
          prisma.anomalyLog.count({ where: { isIndexedInPinecone: true } }),
          prisma.anomalyLog.count({ where: { status: 'approved' } }),
          prisma.anomalyLog.count({ where: { status: 'corrected' } }),
        ]);

      return {
        pinecone: stats,
        database: {
          totalAnomalies,
          indexedAnomalies,
          notIndexed: totalAnomalies - indexedAnomalies,
          approvedCount,
          correctedCount,
        },
      };
    } catch (error) {
      console.error('[Pinecone] Error getting stats:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get Pinecone stats',
      });
    }
  }),

  // Bootstrap Pinecone with existing approved/corrected anomalies
  // This indexes all historical feedback that hasn't been indexed yet
  bootstrapPineconeFeedback: isAdmin.mutation(async () => {
    try {
      // Get all approved/corrected anomalies that haven't been indexed
      const unindexedAnomalies = await prisma.anomalyLog.findMany({
        where: {
          OR: [{ status: 'approved' }, { status: 'corrected' }],
          isIndexedInPinecone: false,
        },
        include: {
          message: {
            include: {
              chat: {
                include: {
                  messages: {
                    orderBy: { createdAt: 'asc' },
                    take: 10,
                    select: { role: true, content: true },
                  },
                },
              },
            },
          },
        },
      });

      console.log(
        `[Pinecone] Found ${unindexedAnomalies.length} unindexed anomalies to bootstrap`,
      );

      // Prepare feedback items for batch indexing
      const feedbackItems = unindexedAnomalies
        .filter(a => a.userQuery && (a.adminResponse || a.aiResponse))
        .map(a => {
          const iterations =
            (a.reviewIterations as Array<{
              adminInstructions: string;
              rating: number;
            }>) || [];
          const lastIteration = iterations[iterations.length - 1];

          // Determine response source:
          // - If status is 'corrected' and adminResponse differs from aiResponse: human wrote it
          // - If status is 'corrected' and has iterations: AI regenerated with guidance
          // - If status is 'approved': original AI response was approved
          const hasIterations = iterations.length > 0;
          const adminWroteResponse =
            a.status === 'corrected' &&
            !hasIterations &&
            a.adminResponse !== a.aiResponse;

          const responseSource: 'human' | 'ai' = adminWroteResponse
            ? 'human'
            : 'ai';
          const wasRegenerated = hasIterations;

          return {
            userQuery: a.userQuery,
            originalAiResponse: a.aiResponse || '',
            adminResponse: a.adminResponse || a.aiResponse || '',
            adminInstructions:
              lastIteration?.adminInstructions ||
              a.reviewNotes ||
              'Admin reviewed',
            anomalyType: a.anomalyType,
            severity: a.severity,
            chatContext:
              a.message?.chat?.messages.map(m => ({
                role: m.role,
                content: m.content,
              })) || [],
            rating:
              lastIteration?.rating ||
              (a.status === 'approved'
                ? 5
                : responseSource === 'human'
                  ? 5
                  : 4),
            iterationCount: a.iterationCount,
            userId: a.userId,
            chatId: a.chatId,
            anomalyId: a.id,
            responseSource,
            wasRegenerated,
          };
        });

      // Batch index the feedback
      const indexedCount = await batchIndexExistingFeedback(feedbackItems);

      // Update the indexed status in database
      if (indexedCount > 0) {
        const indexedIds = feedbackItems
          .slice(0, indexedCount)
          .map(f => f.anomalyId);
        await prisma.anomalyLog.updateMany({
          where: { id: { in: indexedIds } },
          data: { isIndexedInPinecone: true },
        });
      }

      return {
        success: true,
        totalFound: unindexedAnomalies.length,
        indexedCount,
        message: `Successfully indexed ${indexedCount} feedback items into Pinecone`,
      };
    } catch (error) {
      console.error('[Pinecone] Error bootstrapping feedback:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to bootstrap Pinecone feedback',
      });
    }
  }),

  // Test similarity search with a sample query
  testSimilaritySearch: isAdmin
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const results = await searchSimilarFeedback(input.query, {
          topK: 5,
          includeHumanResponses: true,
          includeAiApproved: true,
          includeChatHistory: false,
        });

        return {
          success: true,
          query: input.query,
          resultsCount: results.length,
          results: results.map(r => ({
            id: r.id,
            score: r.score,
            userQuery: r.metadata.userQuery,
            adminResponse: r.metadata.adminResponse?.substring(0, 200) + '...',
            category: r.metadata.category,
            responseSource: r.metadata.responseSource, // 'human' or 'ai'
            wasRegenerated: r.metadata.wasRegenerated,
            rating: r.metadata.rating,
            anomalyType: r.metadata.anomalyType,
          })),
        };
      } catch (error) {
        console.error('[Pinecone] Error testing similarity search:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to perform similarity search',
        });
      }
    }),
});
