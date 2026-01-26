import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/db';
import { TRPCError } from '@trpc/server';

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
      });

      if (!chat) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat not found',
        });
      }

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
});
