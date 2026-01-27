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
} as const;

// Helper to get channel name for a specific chat
export function getChatChannelName(chatId: string): string {
  return `chat-${chatId}`;
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
