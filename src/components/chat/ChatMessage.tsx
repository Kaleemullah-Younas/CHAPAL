'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PendingReviewMessage } from './ThinkingAnimation';

interface Attachment {
  type: 'image' | 'document';
  url: string;
  name: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[] | null;
  createdAt: Date | string;
  // CHAPAL detection states
  isBlocked?: boolean;
  isWarning?: boolean;
  blockMessage?: string;
  warningType?: string;
  // Layer 2 - Human-in-the-loop states
  isPendingReview?: boolean;
  pendingMessage?: string;
  isAdminCorrected?: boolean;
  correctedAt?: Date | string;
  // Human Review states
  humanReviewStatus?: 'approved' | 'blocked' | 'admin_response' | null;
  humanReviewResponse?: string | null;
}

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const attachments = message.attachments as Attachment[] | null;

  // Blocked message (System Block Bubble)
  if (message.isBlocked && message.role === 'assistant') {
    return (
      <div className="flex gap-4 p-4 bg-rose-50 border-l-4 border-rose-500">
        {/* Stop Icon */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-rose-500/20 text-rose-600">
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
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2 py-1 bg-rose-500/20 text-rose-700 rounded-full">
              🚫 BLOCKED
            </span>
          </div>
          <p className="text-rose-800 font-medium">
            {message.content ||
              message.blockMessage ||
              'Message Blocked. Security protocols triggered. This incident has been logged for Admin review.'}
          </p>
        </div>
      </div>
    );
  }

  // Pending Review message (Layer 2 - Human-in-the-loop)
  if (message.isPendingReview && message.role === 'assistant') {
    return (
      <PendingReviewMessage
        message={
          message.pendingMessage ||
          'Response requires human verification before display.'
        }
      />
    );
  }

  // Human Review - Approved by Admin
  if (
    message.humanReviewStatus === 'approved' &&
    message.role === 'assistant'
  ) {
    return (
      <div className="flex gap-4 p-4 bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-emerald-500">
        {/* Approved Icon */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-500/20 text-emerald-600">
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
          >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2 py-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-full">
              ✅ Approved by Admin
            </span>
            {message.correctedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(message.correctedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // Human Review - Blocked by Admin
  if (message.humanReviewStatus === 'blocked' && message.role === 'assistant') {
    return (
      <div className="flex gap-4 p-4 bg-rose-50 dark:bg-rose-950/30 border-l-4 border-rose-500">
        {/* Blocked Icon */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-rose-500/20 text-rose-600">
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
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2 py-1 bg-rose-500/20 text-rose-700 dark:text-rose-300 rounded-full">
              🚫 Admin has blocked this response
            </span>
            {message.correctedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(message.correctedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <p className="text-rose-800 dark:text-rose-200">
            This AI response was reviewed and blocked by an administrator as it
            may contain inaccurate or harmful information.
          </p>
        </div>
      </div>
    );
  }

  // Human Review - Admin Response (explicit status or isAdminCorrected for new messages)
  // This handles admin-created assistant messages (role: assistant, isAdminCorrected: true)
  // Only show for assistant messages - user messages should display normally
  if (
    (message.humanReviewStatus === 'admin_response' ||
      message.isAdminCorrected) &&
    message.role === 'assistant'
  ) {
    return (
      <div className="flex gap-4 p-4 bg-muted/30">
        {/* Admin Avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md">
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
            <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="M4.93 4.93l1.41 1.41" />
            <path d="M17.66 17.66l1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="M6.34 17.66l-1.41 1.41" />
            <path d="M19.07 4.93l-1.41 1.41" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">Admin</span>
            <span className="text-xs px-1.5 py-0.5 bg-violet-500 text-white rounded font-medium">
              Human Response
            </span>
            {message.correctedAt && (
              <span className="text-xs text-muted-foreground">
                · {new Date(message.correctedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // Human Review - Approved (Layer 2 - AI response verified by admin)
  // This is for messages that were approved (not a custom admin response)
  if (
    message.humanReviewStatus === 'approved' &&
    message.role === 'assistant'
  ) {
    return (
      <div className="flex gap-4 p-4 bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500">
        {/* Verified Icon */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-500/20 text-blue-600">
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
          >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2 py-1 bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-full">
              ✓ Approved by Admin
            </span>
            {message.correctedAt && (
              <span className="text-xs text-muted-foreground">
                Reviewed {new Date(message.correctedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // Warning message (AI Warning Bubble)
  if (message.isWarning && message.role === 'assistant') {
    return (
      <div className="flex gap-4 p-4 bg-amber-50 border-l-4 border-amber-500">
        {/* Warning Icon */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-500/20 text-amber-600">
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
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2 py-1 bg-amber-500/20 text-amber-700 rounded-full">
              ⚠️ Context Warning:{' '}
              {message.warningType || 'Medical/Psychological Topic'}
            </span>
          </div>
          <div className="prose prose-sm max-w-none text-amber-900">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-4 p-4 ${isUser ? 'bg-transparent' : 'bg-muted/30'}`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-accent text-accent-foreground'
        }`}
      >
        {isUser ? (
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
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
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
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((attachment, index) => (
              <div key={index} className="relative group">
                {attachment.type === 'image' ? (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="max-w-xs max-h-48 rounded-lg border border-border object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                ) : (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
                  >
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
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="text-sm truncate max-w-[150px]">
                      {attachment.name}
                    </span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message Text */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre: ({ children }) => (
                <pre className="bg-muted p-3 rounded-lg overflow-x-auto">
                  {children}
                </pre>
              ),
              code: ({ className, children, ...props }) => {
                const isInline = !className;
                return isInline ? (
                  <code
                    className="bg-muted px-1.5 py-0.5 rounded text-sm"
                    {...props}
                  >
                    {children}
                  </code>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {children}
                </a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-1" />
          )}
        </div>
      </div>
    </div>
  );
}
