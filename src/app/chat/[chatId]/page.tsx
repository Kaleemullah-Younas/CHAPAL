'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter, useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { ChatMessage, ChatInput } from '@/components/chat';
import { useState, useRef, useEffect } from 'react';

interface Attachment {
  file: File;
  preview: string;
  type: 'image' | 'document';
}

interface UploadedAttachment {
  type: 'image' | 'document';
  url: string;
  name: string;
  base64?: string;
  mimeType?: string;
  extractedText?: string;
}

interface MessageAttachment {
  type: 'image' | 'document';
  url: string;
  name: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: MessageAttachment[] | null;
  createdAt: Date | string;
}

export default function ChatDetailPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const router = useRouter();
  const params = useParams();
  const chatId = params.chatId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [retryInfo, setRetryInfo] = useState<{
    attempt: number;
    maxRetries: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  const { data: chat, isLoading: chatLoading } = trpc.chat.getChatById.useQuery(
    { chatId },
    {
      enabled: !!chatId && !!session,
      refetchOnWindowFocus: false,
    },
  );

  // Update messages when chat data loads
  useEffect(() => {
    if (chat?.messages) {
      setMessages(
        chat.messages.map(m => {
          // Safely cast attachments from Prisma Json type
          const atts = m.attachments as unknown;
          const typedAttachments = Array.isArray(atts)
            ? (atts as MessageAttachment[])
            : null;

          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            attachments: typedAttachments,
            createdAt: new Date(m.createdAt),
          };
        }),
      );
    }
  }, [chat]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const uploadFile = async (
    file: File,
    type: 'image' | 'document',
  ): Promise<UploadedAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }

    return await response.json();
  };

  const handleSend = async (message: string, attachments: Attachment[]) => {
    if (!chatId) return;

    try {
      setIsUploading(attachments.length > 0);

      // Upload attachments first
      const uploadedAttachments: UploadedAttachment[] = [];
      for (const attachment of attachments) {
        const uploaded = await uploadFile(attachment.file, attachment.type);
        uploadedAttachments.push(uploaded);
      }

      setIsUploading(false);

      // Add user message to UI immediately
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        attachments: uploadedAttachments.map(a => ({
          type: a.type,
          url: a.url,
          name: a.name,
        })),
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Start streaming
      setIsStreaming(true);
      setStreamingContent('');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          message,
          attachments: uploadedAttachments,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.retry) {
                  // Show retry notification
                  setRetryInfo({
                    attempt: data.retry,
                    maxRetries: data.maxRetries,
                  });
                  setStreamingContent('');
                  fullContent = '';
                } else if (data.text) {
                  setRetryInfo(null); // Clear retry info once we get text
                  fullContent += data.text;
                  setStreamingContent(fullContent);
                } else if (data.done) {
                  // Streaming complete
                  setRetryInfo(null);
                  const assistantMessage: Message = {
                    id: `temp-assistant-${Date.now()}`,
                    role: 'assistant',
                    content: fullContent,
                    attachments: null,
                    createdAt: new Date(),
                  };
                  setMessages(prev => [...prev, assistantMessage]);
                  setStreamingContent('');
                  setIsStreaming(false);

                  // Refresh chat data
                  utils.chat.getChats.invalidate();
                  utils.chat.getChatById.invalidate({ chatId });
                } else if (data.error) {
                  setRetryInfo(null);
                  throw new Error(data.error);
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsStreaming(false);
      setIsUploading(false);
      setStreamingContent('');
      setRetryInfo(null);
      // Could add error toast here
    }
  };

  if (sessionPending || chatLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    router.push('/signin');
    return null;
  }

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium mb-2">Chat not found</h2>
          <button
            onClick={() => router.push('/chat')}
            className="text-primary hover:underline"
          >
            Go back to chats
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-background">
        <h1 className="font-medium truncate">{chat.title || 'New Chat'}</h1>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isStreaming ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto mb-4 opacity-50"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p>Start the conversation by sending a message</p>
            </div>
          </div>
        ) : (
          <div>
            {messages.map(message => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isStreaming && streamingContent && (
              <ChatMessage
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  attachments: null,
                  createdAt: new Date(),
                }}
                isStreaming={true}
              />
            )}
            {isStreaming && retryInfo && (
              <div className="flex gap-4 p-4 bg-muted/30">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-yellow-500/20 text-yellow-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 21h5v-5" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
                  <span>
                    Retrying... Attempt {retryInfo.attempt} of{' '}
                    {retryInfo.maxRetries}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Upload indicator */}
      {isUploading && (
        <div className="px-4 py-2 bg-muted/50 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Uploading files...
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isStreaming || isUploading}
        disabled={isStreaming || isUploading}
      />
    </div>
  );
}
