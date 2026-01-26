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
    const [totalUsers, totalAdmins, verifiedUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.user.count({ where: { emailVerified: true } }),
    ]);

    return {
      totalUsers,
      totalAdmins,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
    };
  }),
});
