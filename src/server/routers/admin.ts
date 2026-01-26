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
        },
      });

      // If approved (false positive), update the message to not be blocked
      if (action === 'approve' && anomaly.message) {
        await prisma.message.update({
          where: { id: anomaly.messageId },
          data: {
            isBlocked: false,
            isWarning: false,
            isPendingReview: false,
          },
        });
      }

      // If corrected, update the original message with corrected content
      // This is the "human-in-the-loop" feedback loop
      if (action === 'correct' && adminResponse && anomaly.messageId) {
        // Update the original message with corrected response
        await prisma.message.update({
          where: { id: anomaly.messageId },
          data: {
            // Store original for learning
            originalContent: anomaly.message?.content,
            // Replace with corrected content
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

        // Update anomaly log to track feedback was applied
        await prisma.anomalyLog.update({
          where: { id },
          data: {
            feedbackApplied: true,
            feedbackNotes: reviewNotes || 'Admin corrected the response',
          },
        });
      }

      return {
        success: true,
        status: statusMap[action],
        anomalyId: updatedAnomaly.id,
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
