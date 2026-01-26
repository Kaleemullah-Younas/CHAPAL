'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter, useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import {
  ChatMessage,
  ChatInput,
  TransparencyPanel,
  SimulationToolbar,
} from '@/components/chat';
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

interface AnomalyLog {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
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

  // Transparency panel state
  const [safetyScore, setSafetyScore] = useState(100);
  const [accuracyScore, setAccuracyScore] = useState(98);
  const [userEmotion, setUserEmotion] = useState('Neutral');
  const [anomalyLogs, setAnomalyLogs] = useState<AnomalyLog[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  // Handle simulation toolbar
  const handleSimulation = (prompt: string) => {
    // Start analyzing
    setIsAnalyzing(true);

    // Simulate the message being sent
    handleSend(prompt, []);

    // Simulate anomaly detection (this would come from the API in real implementation)
    setTimeout(() => {
      setIsAnalyzing(false);

      // Detect type of anomaly based on prompt
      if (prompt.includes('Ignore previous instructions')) {
        setSafetyScore(15);
        setUserEmotion('Hostile');
        setAnomalyLogs(prev => [
          {
            id: `${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            type: 'Prompt Injection Detected',
            message: 'Attempted to override system instructions',
            severity: 'high',
          },
          ...prev,
        ]);
      } else if (prompt.includes('hopeless') || prompt.includes('end it all')) {
        setSafetyScore(35);
        setUserEmotion('Distressed');
        setAnomalyLogs(prev => [
          {
            id: `${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            type: 'Self-Harm Risk Detected',
            message: 'User expressing distress signals',
            severity: 'high',
          },
          ...prev,
        ]);
      } else if (prompt.includes('social security')) {
        setSafetyScore(45);
        setUserEmotion('Neutral');
        setAnomalyLogs(prev => [
          {
            id: `${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            type: 'PII Exposure Detected',
            message: 'Social Security Number shared',
            severity: 'high',
          },
          ...prev,
        ]);
      } else if (prompt.includes('President of Mars')) {
        setSafetyScore(70);
        setAccuracyScore(45);
        setUserEmotion('Curious');
        setAnomalyLogs(prev => [
          {
            id: `${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            type: 'Hallucination Risk',
            message: 'Query may produce factually incorrect response',
            severity: 'medium',
          },
          ...prev,
        ]);
      }
    }, 1500);
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
    <>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-white">
        {/* Chat Header */}
        <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-foreground truncate">
                {chat.title || 'New Chat'}
              </h1>
              <p className="text-xs text-muted-foreground">
                Protected by CHAPAL
              </p>
            </div>
          </div>
        </header>

        {/* Simulation Toolbar */}
        <SimulationToolbar
          onSimulate={handleSimulation}
          disabled={isStreaming || isUploading}
        />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !isStreaming ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center max-w-md px-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Start a Protected Conversation
                </h3>
                <p className="text-sm">
                  Your messages are monitored by CHAPAL&apos;s AI safety
                  guardrails. Try the simulation buttons above to see anomaly
                  detection in action.
                </p>
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

      {/* Transparency Panel */}
      <TransparencyPanel
        safetyScore={safetyScore}
        accuracyScore={accuracyScore}
        userEmotion={userEmotion}
        anomalyLogs={anomalyLogs}
        isAnalyzing={isAnalyzing}
      />
    </>
  );
}
