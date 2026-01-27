'use client';

import PusherClient from 'pusher-js';

// Singleton Pusher client instance
let pusherClient: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (!pusherClient) {
    pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return pusherClient;
}

// Event types for type safety
export const PUSHER_EVENTS = {
  CHAT_UPDATED: 'chat-updated',
  ADMIN_RESPONSE: 'admin-response',
  HUMAN_REVIEW_RESOLVED: 'human-review-resolved',
  NOTIFICATION: 'notification',
} as const;

// Helper to get channel name for a specific chat
export function getChatChannelName(chatId: string): string {
  return `chat-${chatId}`;
}

// Helper to get channel name for a user's notifications
export function getUserChannelName(userId: string): string {
  return `user-${userId}`;
}

// Type for admin response event payload
export interface AdminResponseEvent {
  chatId: string;
  action: 'approve' | 'block' | 'admin_response';
  responseLabel: string;
  adminResponse?: string;
  messageId?: string;
  timestamp: string;
}

// Type for chat updated event payload
export interface ChatUpdatedEvent {
  chatId: string;
  updateType: 'message_added' | 'review_resolved' | 'status_changed';
  timestamp: string;
}

// Type for notification event payload
export interface NotificationEvent {
  id: string;
  chatId: string;
  chatTitle: string;
  action: 'approve' | 'block' | 'admin_response' | 'warning';
  message: string;
  timestamp: string;
}
