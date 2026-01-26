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
            {message.blockMessage ||
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

  // Admin Corrected message (Layer 2 - After review)
  if (message.isAdminCorrected && message.role === 'assistant') {
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
              ✓ Human Verified
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
