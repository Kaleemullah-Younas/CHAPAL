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
    if (isRawFile) {
      // For raw files, keep the full path including extension
      const regex = /\/upload\/(?:v\d+\/)?(.+)$/;
      const match = url.match(regex);
      return match ? match[1] : null;
    } else {
      // For images, strip the extension
      const regex = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/;
      const match = url.match(regex);
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
            if (publicId) {
              const resourceType: 'image' | 'raw' = isRawFile ? 'raw' : 'image';
              deletePromises.push(
                deleteFromCloudinary(publicId, resourceType).catch(err => {
                  console.error(
                    `Failed to delete Cloudinary asset ${publicId}:`,
                    err,
                  );
                }),
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
});
