'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter, useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import {
  ChatMessage,
  ChatInput,
  TransparencyPanel,
  SimulationToolbar,
  ThinkingAnimation,
  PendingReviewMessage,
} from '@/components/chat';
import type { ThinkingStage } from '@/components/chat';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  getPusherClient,
  getChatChannelName,
  PUSHER_EVENTS,
  type AdminResponseEvent,
} from '@/lib/pusher-client';

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
  // CHAPAL detection states
  isBlocked?: boolean;
  isWarning?: boolean;
  isPendingReview?: boolean;
  blockMessage?: string;
  warningType?: string;
  pendingMessage?: string;
  // Human Review states
  humanReviewStatus?: 'approved' | 'blocked' | 'admin_response' | null;
  humanReviewResponse?: string | null;
  isAdminCorrected?: boolean;
  correctedAt?: Date | string;
}

interface AnomalyLog {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  layer?: 'deterministic' | 'semantic';
}

interface DetectionAnomaly {
  type: string;
  subType?: string;
  severity: string;
  message: string;
  layer?: string;
}

interface DetectionResult {
  layer?: 'deterministic' | 'semantic';
  isBlocked: boolean;
  isWarning: boolean;
  isPendingReview?: boolean;
  isSafe: boolean;
  safetyScore: number;
  accuracyScore?: number;
  userEmotion: string;
  emotionIntensity?: 'low' | 'medium' | 'high';
  anomalies: DetectionAnomaly[];
  blockMessage?: string;
  needsLayer2?: boolean;
  layer2Reasons?: string[];
}

interface SemanticAnalysis {
  isHallucination?: boolean;
  hallucinationConfidence?: number;
  accuracyScore?: number;
  isMedicalAdvice?: boolean;
  isPsychological?: boolean;
  contextType?: string;
  userEmotion?: string;
  emotionIntensity?: 'low' | 'medium' | 'high';
  emotionalConcern?: boolean;
  requiresHumanReview?: boolean;
  reviewReason?: string;
  riskLevel?: string;
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

  // Current message detection state
  const [currentDetection, setCurrentDetection] =
    useState<DetectionResult | null>(null);

  // Thinking stage state
  const [thinkingStage, setThinkingStage] = useState<ThinkingStage | null>(
    null,
  );
  const [thinkingMessage, setThinkingMessage] = useState('');

  // Semantic analysis state
  const [semanticAnalysis, setSemanticAnalysis] =
    useState<SemanticAnalysis | null>(null);

  // Transparency panel state
  const [safetyScore, setSafetyScore] = useState(100);
  const [accuracyScore, setAccuracyScore] = useState(100);
  const [userEmotion, setUserEmotion] = useState('Neutral');
  const [emotionIntensity, setEmotionIntensity] = useState<
    'low' | 'medium' | 'high'
  >('low');
  const [anomalyLogs, setAnomalyLogs] = useState<AnomalyLog[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<
    'deterministic' | 'semantic'
  >('deterministic');

  // Track all detection history for cumulative calculations
  const [detectionHistory, setDetectionHistory] = useState<{
    safetyScores: number[];
    accuracyScores: number[];
    emotions: { emotion: string; intensity: 'low' | 'medium' | 'high' }[];
  }>({ safetyScores: [], accuracyScores: [], emotions: [] });

  // Helper function to calculate and update cumulative panel state from history
  const recalculatePanelState = (history: {
    safetyScores: number[];
    accuracyScores: number[];
    emotions: { emotion: string; intensity: 'low' | 'medium' | 'high' }[];
  }) => {
    // Calculate average safety score
    if (history.safetyScores.length > 0) {
      const avgSafety = Math.round(
        history.safetyScores.reduce((a, b) => a + b, 0) /
          history.safetyScores.length,
      );
      setSafetyScore(avgSafety);
    }

    // Calculate average accuracy score
    if (history.accuracyScores.length > 0) {
      const avgAccuracy = Math.round(
        history.accuracyScores.reduce((a, b) => a + b, 0) /
          history.accuracyScores.length,
      );
      setAccuracyScore(avgAccuracy);
    }

    // Calculate predominant emotion
    if (history.emotions.length > 0) {
      const emotionCounts: Record<string, number> = {};
      const intensityCounts: Record<string, number> = {
        low: 0,
        medium: 0,
        high: 0,
      };

      for (const e of history.emotions) {
        emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
        intensityCounts[e.intensity]++;
      }

      let predominantEmotion = 'Neutral';
      let maxCount = 0;
      for (const [emotion, count] of Object.entries(emotionCounts)) {
        if (count > maxCount) {
          maxCount = count;
          predominantEmotion = emotion;
        }
      }
      setUserEmotion(predominantEmotion);

      // Find predominant intensity
      if (
        intensityCounts.high > intensityCounts.medium &&
        intensityCounts.high > intensityCounts.low
      ) {
        setEmotionIntensity('high');
      } else if (intensityCounts.medium > intensityCounts.low) {
        setEmotionIntensity('medium');
      } else {
        setEmotionIntensity('low');
      }
    }
  };

  const utils = trpc.useUtils();

  const { data: chat, isLoading: chatLoading } = trpc.chat.getChatById.useQuery(
    { chatId },
    {
      enabled: !!chatId && !!session,
      refetchOnWindowFocus: false,
    },
  );

  // Fetch persisted anomaly logs for this chat
  const { data: persistedAnomalyData } = trpc.chat.getAnomalyLogs.useQuery(
    { chatId },
    {
      enabled: !!chatId && !!session,
      refetchOnWindowFocus: false,
    },
  );

  // Load persisted anomaly logs and panel state when data is fetched
  useEffect(() => {
    if (persistedAnomalyData) {
      // Restore anomaly logs
      if (persistedAnomalyData.logs && persistedAnomalyData.logs.length > 0) {
        setAnomalyLogs(persistedAnomalyData.logs);
      }

      // Restore panel state (safety score, emotion, accuracy)
      if (persistedAnomalyData.panelState) {
        const {
          safetyScore: savedSafetyScore,
          accuracyScore: savedAccuracyScore,
          userEmotion: savedUserEmotion,
          emotionIntensity: savedEmotionIntensity,
          layer,
        } = persistedAnomalyData.panelState;
        setSafetyScore(savedSafetyScore);
        setAccuracyScore(savedAccuracyScore);
        setUserEmotion(savedUserEmotion);
        setEmotionIntensity(savedEmotionIntensity);
        setCurrentLayer(layer);
      }

      // Restore detection history for cumulative calculations
      if (persistedAnomalyData.detectionHistory) {
        setDetectionHistory(persistedAnomalyData.detectionHistory);
      }
    }
  }, [persistedAnomalyData]);

  // Update messages when chat data loads
  useEffect(() => {
    if (chat?.messages) {
      setMessages(prev => {
        // Only preserve local blocked messages if chat is still blocked
        // If admin has responded (isHumanReviewBlocked is false), remove local blocked messages
        const localBlockedMessages = chat.isHumanReviewBlocked
          ? prev.filter(
              m =>
                m.isBlocked &&
                m.role === 'assistant' &&
                m.id.startsWith('blocked-'),
            )
          : []; // Don't keep blocked messages if chat is unblocked

        const dbMessages = chat.messages.map(m => {
          // Safely cast attachments from Prisma Json type
          const atts = m.attachments as unknown;
          const typedAttachments = Array.isArray(atts)
            ? (atts as MessageAttachment[])
            : null;

          // Determine human review status based on chat state
          let humanReviewStatus:
            | 'approved'
            | 'blocked'
            | 'admin_response'
            | null = null;
          if (chat.humanReviewStatus && chat.humanReviewMessageId === m.id) {
            humanReviewStatus = chat.humanReviewStatus as
              | 'approved'
              | 'blocked'
              | 'admin_response';
          }

          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            attachments: typedAttachments,
            createdAt: new Date(m.createdAt),
            isPendingReview: m.isPendingReview,
            isAdminCorrected: m.isAdminCorrected,
            correctedAt: m.correctedAt ?? undefined,
            humanReviewStatus,
          };
        });

        // Append local blocked messages to DB messages
        return [...dbMessages, ...localBlockedMessages];
      });
    }
  }, [chat]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Subscribe to Pusher for real-time admin response updates
  useEffect(() => {
    if (!chatId) return;

    const pusher = getPusherClient();
    const channelName = getChatChannelName(chatId);

    console.log(`[Pusher Client] Subscribing to channel: ${channelName}`);

    const channel = pusher.subscribe(channelName);

    // Log connection state
    channel.bind('pusher:subscription_succeeded', () => {
      console.log(`[Pusher Client] Successfully subscribed to ${channelName}`);
    });

    channel.bind('pusher:subscription_error', (error: unknown) => {
      console.error(
        `[Pusher Client] Subscription error for ${channelName}:`,
        error,
      );
    });

    // Handle admin response event - refetch chat data
    const handleAdminResponse = (data: AdminResponseEvent) => {
      console.log('[Pusher Client] Received admin response event:', data);
      // Refetch the chat data to get the updated messages
      utils.chat.getChatById.invalidate({ chatId });
    };

    channel.bind(PUSHER_EVENTS.ADMIN_RESPONSE, handleAdminResponse);

    // Cleanup on unmount
    return () => {
      console.log(`[Pusher Client] Unsubscribing from channel: ${channelName}`);
      channel.unbind(PUSHER_EVENTS.ADMIN_RESPONSE, handleAdminResponse);
      channel.unbind('pusher:subscription_succeeded');
      channel.unbind('pusher:subscription_error');
      pusher.unsubscribe(channelName);
    };
  }, [chatId, utils.chat.getChatById]);

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
      setIsAnalyzing(true);
      setCurrentDetection(null);
      setSemanticAnalysis(null);
      setThinkingStage(null);
      setThinkingMessage('');
      setCurrentLayer('deterministic');

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

      // Check if response is blocked (non-streaming JSON response)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        setIsAnalyzing(false);

        if (data.blocked) {
          // Handle blocked message
          const detection = data.detection as DetectionResult;
          setCurrentDetection(detection);

          // Add safety score and emotion to history (blocked messages always have anomalies)
          setDetectionHistory(prev => {
            const updatedHistory = {
              safetyScores: [...prev.safetyScores, detection.safetyScore],
              accuracyScores:
                detection.accuracyScore !== undefined
                  ? [...prev.accuracyScores, detection.accuracyScore]
                  : prev.accuracyScores,
              emotions: [
                ...prev.emotions,
                {
                  emotion: detection.userEmotion,
                  intensity: detection.emotionIntensity || 'low',
                },
              ],
            };
            recalculatePanelState(updatedHistory);
            return updatedHistory;
          });
          setCurrentLayer(detection.layer || 'deterministic');

          // Add to anomaly logs
          if (detection.anomalies.length > 0) {
            const newLogs = detection.anomalies.map((a, i) => ({
              id: `${Date.now()}-${i}`,
              timestamp: new Date().toLocaleTimeString(),
              type: a.message,
              message: `${a.type}${a.subType ? ` (${a.subType})` : ''}`,
              severity: (a.severity === 'critical' ? 'high' : a.severity) as
                | 'low'
                | 'medium'
                | 'high',
              layer: (detection.layer || 'deterministic') as
                | 'deterministic'
                | 'semantic',
            }));
            setAnomalyLogs(prev => [...newLogs, ...prev]);
          }

          // Add blocked response message
          const blockedMessage: Message = {
            id: `blocked-${Date.now()}`,
            role: 'assistant',
            content: '',
            attachments: null,
            createdAt: new Date(),
            isBlocked: true,
            blockMessage:
              detection.blockMessage ||
              'Message Blocked. Security protocols triggered.',
          };
          setMessages(prev => [...prev, blockedMessage]);
          setIsStreaming(false);
          setThinkingStage(null);

          // If chat is blocked (safety issue), invalidate chat data to get updated isHumanReviewBlocked status
          if (data.chatBlocked) {
            utils.chat.getChatById.invalidate({ chatId });
          }

          // Refresh sidebar chat list
          utils.chat.getChats.invalidate();
          return;
        }
      }

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let detectionProcessed = false;
      let semanticProcessed = false;

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

                // Handle thinking stages
                if (data.thinking) {
                  setThinkingStage(data.thinking.stage as ThinkingStage);
                  setThinkingMessage(data.thinking.message);
                }

                // Handle detection results (Layer 1)
                if (data.detection && !detectionProcessed) {
                  detectionProcessed = true;
                  const detection = data.detection as DetectionResult;
                  setCurrentDetection(detection);
                  setIsAnalyzing(false);

                  // Always add safety score and emotion to history (for cumulative chat analysis)
                  setDetectionHistory(prev => {
                    const updatedHistory = {
                      safetyScores: [
                        ...prev.safetyScores,
                        detection.safetyScore,
                      ],
                      accuracyScores: prev.accuracyScores,
                      emotions: [
                        ...prev.emotions,
                        {
                          emotion: detection.userEmotion,
                          intensity: detection.emotionIntensity || 'low',
                        },
                      ],
                    };
                    recalculatePanelState(updatedHistory);
                    return updatedHistory;
                  });

                  setCurrentLayer(detection.layer || 'deterministic');

                  // Add anomalies to log
                  if (detection.anomalies.length > 0) {
                    const newLogs = detection.anomalies.map((a, i) => ({
                      id: `${Date.now()}-${i}`,
                      timestamp: new Date().toLocaleTimeString(),
                      type: a.message,
                      message: `${a.type}${a.subType ? ` (${a.subType})` : ''}`,
                      severity: (a.severity === 'critical'
                        ? 'high'
                        : a.severity) as 'low' | 'medium' | 'high',
                      layer: (a.layer || 'deterministic') as
                        | 'deterministic'
                        | 'semantic',
                    }));
                    setAnomalyLogs(prev => [...newLogs, ...prev]);
                  }
                }
                // Handle semantic analysis results (Layer 2)
                else if (data.semanticAnalysis && !semanticProcessed) {
                  semanticProcessed = true;
                  const semantic = data.semanticAnalysis as SemanticAnalysis;
                  setSemanticAnalysis(semantic);
                  setCurrentLayer('semantic');

                  // Update accuracy score from Layer 2 (don't add duplicate safety/emotion)
                  if (semantic.accuracyScore !== undefined) {
                    setDetectionHistory(prev => {
                      const updatedHistory = {
                        ...prev,
                        accuracyScores: [
                          ...prev.accuracyScores,
                          semantic.accuracyScore!,
                        ],
                      };
                      recalculatePanelState(updatedHistory);
                      return updatedHistory;
                    });
                  }
                } else if (data.retry) {
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
                  setThinkingStage(null);

                  // Check if pending review (Layer 2 human-in-the-loop)
                  const isPendingReview = data.isPendingReview || false;
                  const pendingMessage = data.pendingMessage || null;

                  // Determine if this is a warning message
                  const isWarning = currentDetection?.isWarning || false;
                  const warningType = currentDetection?.anomalies[0]?.message;

                  const assistantMessage: Message = {
                    id: `temp-assistant-${Date.now()}`,
                    role: 'assistant',
                    content: isPendingReview ? '' : fullContent,
                    attachments: null,
                    createdAt: new Date(),
                    isWarning: isWarning,
                    warningType: warningType,
                    isPendingReview: isPendingReview,
                    pendingMessage: pendingMessage,
                  };
                  setMessages(prev => [...prev, assistantMessage]);
                  setStreamingContent('');
                  setIsStreaming(false);

                  // Update accuracy from final response
                  if (data.accuracyScore !== undefined) {
                    setAccuracyScore(data.accuracyScore);
                  }

                  // Refresh chat data
                  utils.chat.getChats.invalidate();
                  utils.chat.getChatById.invalidate({ chatId });
                } else if (data.error) {
                  setRetryInfo(null);
                  setThinkingStage(null);
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
      setIsAnalyzing(false);
      setThinkingStage(null);
      // Could add error toast here
    }
  };

  // Handle simulation toolbar - now uses real anomaly detection
  const handleSimulation = (prompt: string) => {
    // The real anomaly detection is now handled by the API
    // Just send the message normally
    handleSend(prompt, []);
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
              {/* Thinking Animation */}
              {isStreaming && thinkingStage && !streamingContent && (
                <ThinkingAnimation
                  stage={thinkingStage}
                  message={thinkingMessage}
                  isVisible={true}
                />
              )}
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
          isHumanReviewBlocked={chat?.isHumanReviewBlocked}
          humanReviewMessage={chat?.humanReviewMessage || undefined}
        />
      </div>

      {/* Transparency Panel */}
      <TransparencyPanel
        safetyScore={safetyScore}
        accuracyScore={accuracyScore}
        userEmotion={userEmotion}
        emotionIntensity={emotionIntensity}
        anomalyLogs={anomalyLogs}
        isAnalyzing={isAnalyzing}
        thinkingStage={thinkingStage}
        thinkingMessage={thinkingMessage}
        semanticAnalysis={semanticAnalysis}
        layer={currentLayer}
      />
    </>
  );
}
