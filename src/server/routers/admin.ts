import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '@/lib/db';

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

      // If corrected, create a NEW assistant message with the admin response
      // This is the "human-in-the-loop" feedback loop
      // The original message is preserved, and the admin response is added as a new message
      if (action === 'correct' && adminResponse && anomaly.messageId) {
        // Store original content for learning on the original message
        if (anomaly.message) {
          await prisma.message.update({
            where: { id: anomaly.messageId },
            data: {
              // Store original for learning
              originalContent: anomaly.message.content || anomaly.aiResponse,
              // No longer pending, keep original content
              isPendingReview: false,
              isBlocked: false,
              isWarning: false,
            },
          });
        }

        // Create a NEW assistant message with the admin response
        await prisma.message.create({
          data: {
            chatId: anomaly.chatId,
            role: 'assistant',
            content: adminResponse,
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
});
