import Pusher from 'pusher';

// Pusher server instance for triggering events
export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// Event types for type safety
export const PUSHER_EVENTS = {
  CHAT_UPDATED: 'chat-updated',
  ADMIN_RESPONSE: 'admin-response',
  HUMAN_REVIEW_RESOLVED: 'human-review-resolved',
  NOTIFICATION: 'notification',
} as const;

// Helper to get channel name for a user's chats
export function getUserChannelName(userId: string): string {
  return `user-${userId}`;
}

// Helper to get channel name for a specific chat
export function getChatChannelName(chatId: string): string {
  return `chat-${chatId}`;
}
