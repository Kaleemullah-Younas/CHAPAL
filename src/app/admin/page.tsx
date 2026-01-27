'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useSession, signOut } from '@/lib/auth-client';
import Link from 'next/link';
import Image from 'next/image';

// Type definition for anomalies
interface Anomaly {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  chatId: string;
  messageId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  anomalyType: string;
  userQuery: string;
  aiResponse: string | null;
  detectionDetails: unknown;
  safetyScore: number;
  userEmotion: string;
  status: 'pending' | 'approved' | 'blocked' | 'corrected';
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminResponse: string | null;
  reviewNotes: string | null;
}

// Type definition for semantic review anomalies (Layer 2)
interface SemanticReviewAnomaly {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  chatId: string;
  messageId: string;
  anomalyType: string;
  severity: string;
  userQuery: string;
  aiResponse: string | null;
  detectionDetails: unknown;
  safetyScore: number;
  userEmotion: string;
  layer: string | null;
  accuracyScore: number | null;
  semanticAnalysis: {
    isHallucination?: boolean;
    accuracyScore?: number;
    isMedicalAdvice?: boolean;
    isPsychological?: boolean;
    emotionalConcern?: boolean;
    riskLevel?: string;
  } | null;
}

// Type for review iteration history
interface ReviewIteration {
  response: string;
  adminInstructions: string;
  rating: number;
  timestamp: string;
}

// Type definition for pending human reviews (blocked chats)
interface PendingHumanReview {
  id: string;
  title: string | null;
  userId: string;
  userEmail: string;
  userName: string;
  humanReviewReason: string | null;
  humanReviewMessage: string | null;
  humanReviewMessageId: string | null;
  updatedAt: string;
  messages: {
    id: string;
    role: string;
    content: string;
    originalContent: string | null;
    isPendingReview: boolean;
    createdAt: string;
  }[];
}

// Helper to get llama report from detection details
function getLlamaReport(anomaly: Anomaly) {
  const details = anomaly.detectionDetails as {
    anomalies?: Array<{ message: string; confidence: number; type: string }>;
  } | null;
  const firstAnomaly = details?.anomalies?.[0];
  return {
    violation: anomaly.anomalyType,
    confidence: firstAnomaly?.confidence
      ? `${firstAnomaly.confidence}%`
      : 'High',
    reason: firstAnomaly?.message || 'Detected by CHAPAL Layer 1',
  };
}

// Human-in-the-Loop Review Modal
function ReviewModal({
  isOpen,
  onClose,
  anomaly,
  onApprove,
  onBlock,
  onCorrect,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  anomaly: Anomaly | null;
  onApprove: () => void;
  onBlock: () => void;
  onCorrect: (response: string) => void;
  isLoading?: boolean;
}) {
  const [correctedResponse, setCorrectedResponse] = useState('');
  const [activeAction, setActiveAction] = useState<
    'approve' | 'block' | 'correct' | null
  >(null);

  if (!isOpen || !anomaly) return null;

  // Check if anomaly has already been reviewed (locked)
  const isLocked = anomaly.status !== 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 bg-gradient-to-r from-primary/10 to-transparent border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  ADMIN REVIEW
                </h2>
                <p className="text-sm text-muted-foreground">
                  Review and take action on flagged interaction
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Left Side: Context */}
            <div className="p-6 border-r border-border bg-slate-50">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
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
                  className="text-muted-foreground"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Context (Read Only)
              </h3>

              {/* User Query */}
              <div className="mb-4">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  User Query
                </label>
                <div className="p-3 bg-white rounded-lg border border-border text-sm">
                  {anomaly.userQuery}
                </div>
              </div>

              {/* AI Response */}
              <div className="mb-4">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {anomaly.aiResponse
                    ? 'AI Response (Pending Review)'
                    : 'AI Response (Not Generated)'}
                </label>
                <div
                  className={`p-3 bg-white rounded-lg border text-sm ${anomaly.aiResponse ? 'border-amber-200' : 'border-rose-200'}`}
                >
                  {anomaly.aiResponse ||
                    'Message was blocked before AI could generate a response.'}
                </div>
                {anomaly.aiResponse && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Review the AI response above. If it&apos;s appropriate,
                    click &quot;Approve&quot; to show it to the user.
                  </p>
                )}
              </div>

              {/* Llama Auditor Report */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  AI Auditor Report
                </label>
                {(() => {
                  const report = getLlamaReport(anomaly);
                  return (
                    <div className="p-4 bg-white rounded-lg border border-border space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Violation:
                        </span>
                        <span className="text-sm font-medium text-rose-600">
                          {report.violation}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Confidence:
                        </span>
                        <span className="text-sm font-medium">
                          {report.confidence}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Safety Score:
                        </span>
                        <span
                          className={`text-sm font-medium ${anomaly.safetyScore < 50 ? 'text-rose-600' : anomaly.safetyScore < 80 ? 'text-amber-600' : 'text-emerald-600'}`}
                        >
                          {anomaly.safetyScore}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          User Emotion:
                        </span>
                        <span className="text-sm font-medium">
                          {anomaly.userEmotion}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <span className="text-sm text-muted-foreground">
                          Reason:
                        </span>
                        <p className="text-sm mt-1">{report.reason}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Side: Actions */}
            <div className="p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
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
                  className="text-muted-foreground"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                </svg>
                Intervention Actions
              </h3>

              {/* Locked State Banner */}
              {isLocked && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-amber-600"
                      >
                        <rect
                          width="18"
                          height="11"
                          x="3"
                          y="11"
                          rx="2"
                          ry="2"
                        />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-amber-800">
                        Review Locked
                      </p>
                      <p className="text-sm text-amber-600">
                        This anomaly has already been reviewed ({anomaly.status}
                        ).
                        {anomaly.reviewedAt &&
                          ` Reviewed on ${new Date(anomaly.reviewedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {/* Option A: Approve */}
                <button
                  onClick={() => !isLocked && setActiveAction('approve')}
                  disabled={isLocked}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    isLocked
                      ? 'border-border bg-muted/50 opacity-60 cursor-not-allowed'
                      : activeAction === 'approve'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-border hover:border-emerald-300 hover:bg-emerald-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-emerald-600"
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Approve (False Positive)
                      </p>
                      <p className="text-sm text-muted-foreground">
                        This message was actually safe. Unblock chat and show AI
                        response to user.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Option B: Block User */}
                <button
                  onClick={() => !isLocked && setActiveAction('block')}
                  disabled={isLocked}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    isLocked
                      ? 'border-border bg-muted/50 opacity-60 cursor-not-allowed'
                      : activeAction === 'block'
                        ? 'border-rose-500 bg-rose-50'
                        : 'border-border hover:border-rose-300 hover:bg-rose-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-rose-600"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="m4.9 4.9 14.2 14.2" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Block User Account
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Severe violation. Block user from the entire app
                        permanently.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Option C: Specialist Correction */}
                <button
                  onClick={() => !isLocked && setActiveAction('correct')}
                  disabled={isLocked}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    isLocked
                      ? 'border-border bg-muted/50 opacity-60 cursor-not-allowed'
                      : activeAction === 'correct'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary"
                      >
                        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Specialist Correction
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Rewrite response and send corrected version to user.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Correction Text Area */}
                {activeAction === 'correct' && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Corrected Response
                    </label>
                    <textarea
                      value={correctedResponse}
                      onChange={e => setCorrectedResponse(e.target.value)}
                      placeholder="Write the safe and appropriate response here..."
                      className="w-full h-32 p-3 rounded-xl border border-border bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 h-11 rounded-xl border border-border font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {isLocked ? 'Close' : 'Cancel'}
                </button>
                {!isLocked && (
                  <button
                    onClick={() => {
                      if (activeAction === 'approve') onApprove();
                      else if (activeAction === 'block') onBlock();
                      else if (activeAction === 'correct' && correctedResponse)
                        onCorrect(correctedResponse);
                    }}
                    disabled={
                      isLoading ||
                      !activeAction ||
                      (activeAction === 'correct' && !correctedResponse)
                    }
                    className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      'Submit Decision'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Human Review Action Modal - For blocked chats
function HumanReviewActionModal({
  isOpen,
  onClose,
  chat,
  originalAIResponse,
  onApprove,
  onBlock,
  onRespond,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  chat: PendingHumanReview | null;
  originalAIResponse: string;
  onApprove: () => void;
  onBlock: () => void;
  onRespond: (response: string) => void;
  isLoading?: boolean;
}) {
  const [adminResponse, setAdminResponse] = useState('');
  const [activeAction, setActiveAction] = useState<
    'approve' | 'block' | 'respond' | null
  >(null);

  if (!isOpen || !chat) return null;

  // Get reason badge info
  const reasonBadges: Record<
    string,
    { color: string; icon: string; label: string }
  > = {
    hallucination: {
      color: 'bg-purple-100 text-purple-700',
      icon: '🎭',
      label: 'Hallucination Risk',
    },
    medical: {
      color: 'bg-rose-100 text-rose-700',
      icon: '⚕️',
      label: 'Medical Advice',
    },
    self_harm: {
      color: 'bg-red-100 text-red-700',
      icon: '💙',
      label: 'Self-Harm Concern',
    },
    psychological: {
      color: 'bg-violet-100 text-violet-700',
      icon: '🧠',
      label: 'Psychological',
    },
    serious_medical: {
      color: 'bg-red-100 text-red-700',
      icon: '⚕️',
      label: 'Serious Medical Advice',
    },
    pii: {
      color: 'bg-purple-100 text-purple-700',
      icon: '🔐',
      label: 'PII Leak',
    },
    prompt_injection: {
      color: 'bg-rose-100 text-rose-700',
      icon: '🔓',
      label: 'Prompt Injection',
    },
    safety: {
      color: 'bg-red-100 text-red-700',
      icon: '🚨',
      label: 'Safety Violation',
    },
    policy_violation: {
      color: 'bg-orange-100 text-orange-700',
      icon: '🚫',
      label: 'Policy Violation',
    },
    sudden_spike: {
      color: 'bg-yellow-100 text-yellow-700',
      icon: '⚡',
      label: 'Sudden Spike',
    },
    unknown: {
      color: 'bg-gray-100 text-gray-700',
      icon: '❓',
      label: 'Review Required',
    },
  };
  const reason = chat.humanReviewReason || 'unknown';
  const badge = reasonBadges[reason] || reasonBadges.unknown;

  // Get the last user message
  const userMessage = [...chat.messages].reverse().find(m => m.role === 'user');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-transparent border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-indigo-600"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Human Review Required
                </h2>
                <p className="text-sm text-muted-foreground">
                  User&apos;s chat is blocked until you take action
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* User Info and Reason */}
          <div className="mb-6 p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-4 mb-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {chat.userName || 'Unknown User'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {chat.userEmail}
                </p>
              </div>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${badge.color}`}
              >
                {badge.icon} {badge.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Chat:{' '}
              <span className="font-medium text-foreground">
                {chat.title || 'Untitled Chat'}
              </span>
            </p>
          </div>

          {/* User's Query */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              User&apos;s Query
            </h3>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {userMessage?.content || 'No query available'}
              </p>
            </div>
          </div>

          {/* AI Response (Hidden from User) */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              AI Response
              <span className="text-xs font-normal px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                Hidden from user
              </span>
            </h3>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {originalAIResponse || 'No AI response available'}
              </p>
            </div>
          </div>

          {/* Action Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Choose Your Action
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              ⚠️ Note: Admin can only respond once. This action cannot be
              changed after submission.
            </p>

            {/* Option A: Approve AI Response */}
            <button
              onClick={() => setActiveAction('approve')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                activeAction === 'approve'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-border hover:border-emerald-300 hover:bg-emerald-50/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-emerald-600"
                  >
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Approve AI Response
                  </p>
                  <p className="text-sm text-muted-foreground">
                    The AI response is safe. Show it to the user with
                    &quot;Approved by Admin&quot; label.
                  </p>
                </div>
              </div>
            </button>

            {/* Option B: Block User Account */}
            <button
              onClick={() => setActiveAction('block')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                activeAction === 'block'
                  ? 'border-rose-500 bg-rose-50'
                  : 'border-border hover:border-rose-300 hover:bg-rose-50/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-rose-600"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m4.9 4.9 14.2 14.2" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Block User Account
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Severe violation. Block user from the entire app
                    permanently.
                  </p>
                </div>
              </div>
            </button>

            {/* Option C: Write Custom Response */}
            <button
              onClick={() => setActiveAction('respond')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                activeAction === 'respond'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-border hover:border-indigo-300 hover:bg-indigo-50/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-indigo-600"
                  >
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Write Custom Response
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Provide your own response to the user with &quot;Admin
                    Response&quot; label.
                  </p>
                </div>
              </div>
            </button>

            {/* Custom Response Text Area */}
            {activeAction === 'respond' && (
              <div className="mt-4">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Your Response to the User
                </label>
                <textarea
                  value={adminResponse}
                  onChange={e => setAdminResponse(e.target.value)}
                  placeholder="Write your response here. Be helpful, accurate, and supportive..."
                  className="w-full h-40 p-3 rounded-xl border border-border bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-4 border-t border-border bg-slate-50 flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 h-11 rounded-xl border border-border font-medium text-muted-foreground hover:bg-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (activeAction === 'approve') onApprove();
                else if (activeAction === 'block') onBlock();
                else if (activeAction === 'respond' && adminResponse.trim())
                  onRespond(adminResponse.trim());
              }}
              disabled={
                !activeAction ||
                (activeAction === 'respond' && !adminResponse.trim()) ||
                isLoading
              }
              className="flex-1 h-11 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                'Submit Decision'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Star rating component - Used in SemanticReviewModal
function StarRating({
  rating,
  onChange,
  disabled,
}: {
  rating: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => !disabled && onChange(star)}
          disabled={disabled}
          className={`p-0.5 transition-all ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={star <= rating ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={star <= rating ? 'text-amber-400' : 'text-gray-300'}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">
        {rating === 1 && 'Poor'}
        {rating === 2 && 'Needs Improvement'}
        {rating === 3 && 'Acceptable'}
        {rating === 4 && 'Good'}
        {rating === 5 && 'Excellent'}
      </span>
    </div>
  );
}

// Human-in-the-Loop Semantic Review Modal (Layer 2)
// This modal allows admins to review AI responses, rate them, regenerate with instructions, and approve
function SemanticReviewModal({
  isOpen,
  onClose,
  anomaly,
  onApprove,
  onBlock,
  onRegenerate,
  isLoading,
  isRegenerating,
  currentResponse,
  iterations,
}: {
  isOpen: boolean;
  onClose: () => void;
  anomaly: SemanticReviewAnomaly | null;
  onApprove: (rating: number) => void;
  onBlock: () => void;
  onRegenerate: (instructions: string, rating: number) => void;
  isLoading?: boolean;
  isRegenerating?: boolean;
  currentResponse: string;
  iterations: ReviewIteration[];
}) {
  const [adminInstructions, setAdminInstructions] = useState('');
  const [currentRating, setCurrentRating] = useState(3);
  const [showHistory, setShowHistory] = useState(false);

  // Reset state when modal opens
  useState(() => {
    if (isOpen) {
      setAdminInstructions('');
      setCurrentRating(3);
      setShowHistory(false);
    }
  });

  if (!isOpen || !anomaly) return null;

  const displayResponse =
    currentResponse || anomaly.aiResponse || 'No response generated';
  const iterationCount = iterations.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Human-in-the-Loop Review
                </h2>
                <p className="text-sm text-muted-foreground">
                  Review, rate, and refine AI response before sending to user
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {iterationCount > 0 && (
                <span className="px-3 py-1.5 text-sm font-medium bg-indigo-100 text-indigo-700 rounded-full">
                  Iteration #{iterationCount + 1}
                </span>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/80 rounded-lg transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-2 divide-x divide-border">
            {/* Left Column: Context */}
            <div className="p-6 space-y-6 bg-slate-50/50">
              {/* User Info */}
              <div className="p-4 bg-white rounded-xl border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-medium">
                    {anomaly.userEmail.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {anomaly.userEmail}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(anomaly.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                {/* Flags */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    🚫 Chat Blocked
                  </span>
                  {anomaly.semanticAnalysis?.isMedicalAdvice && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-700">
                      🏥 Medical Context
                    </span>
                  )}
                  {anomaly.semanticAnalysis?.isHallucination && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                      🎭 Hallucination Risk
                    </span>
                  )}
                  {anomaly.accuracyScore !== null && (
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        anomaly.accuracyScore >= 80
                          ? 'bg-emerald-100 text-emerald-700'
                          : anomaly.accuracyScore >= 60
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      📊 Accuracy: {anomaly.accuracyScore}%
                    </span>
                  )}
                </div>
              </div>

              {/* User Query */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
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
                    className="text-blue-500"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  User&apos;s Query
                </h3>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {anomaly.userQuery}
                  </p>
                </div>
              </div>

              {/* Iteration History */}
              {iterations.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full flex items-center justify-between p-3 bg-white border border-border rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground flex items-center gap-2">
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
                        className="text-indigo-500"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Previous Iterations ({iterations.length})
                    </span>
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
                      className={`transition-transform ${showHistory ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showHistory && (
                    <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
                      {iterations.map((iter, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white border border-border rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Iteration #{idx + 1}
                            </span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <svg
                                  key={star}
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill={
                                    star <= iter.rating
                                      ? 'currentColor'
                                      : 'none'
                                  }
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className={
                                    star <= iter.rating
                                      ? 'text-amber-400'
                                      : 'text-gray-300'
                                  }
                                >
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Response:
                          </p>
                          <p className="text-xs text-foreground line-clamp-2 mb-2">
                            {iter.response}
                          </p>
                          <p className="text-xs text-muted-foreground mb-1">
                            Admin Feedback:
                          </p>
                          <p className="text-xs text-indigo-600 italic">
                            {iter.adminInstructions}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Current Response & Actions */}
            <div className="p-6 space-y-6">
              {/* Current AI Response */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
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
                    className="text-purple-500"
                  >
                    <path d="M12 8V4H8" />
                    <rect width="16" height="12" x="4" y="8" rx="2" />
                    <path d="M2 14h2" />
                    <path d="M20 14h2" />
                    <path d="M15 13v2" />
                    <path d="M9 13v2" />
                  </svg>
                  Current AI Response
                  <span className="text-xs font-normal px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                    Hidden from user
                  </span>
                </h3>
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl max-h-48 overflow-y-auto">
                  {isRegenerating ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground">
                          Generating improved response...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {displayResponse}
                    </p>
                  )}
                </div>
              </div>

              {/* Rating Section */}
              <div className="p-4 bg-white border border-border rounded-xl">
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  Rate This Response
                </h4>
                <StarRating
                  rating={currentRating}
                  onChange={setCurrentRating}
                  disabled={isLoading || isRegenerating}
                />
              </div>

              {/* Admin Instructions for Regeneration */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
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
                    className="text-indigo-500"
                  >
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  Instructions for Improvement (Optional)
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Provide specific feedback to guide the AI in generating a
                  better response
                </p>
                <textarea
                  value={adminInstructions}
                  onChange={e => setAdminInstructions(e.target.value)}
                  placeholder="e.g., 'Be more empathetic', 'Don't recommend specific medications', 'Include a disclaimer about seeking professional help'..."
                  className="w-full h-24 p-3 rounded-xl border border-border bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={isLoading || isRegenerating}
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Regenerate Button */}
                <button
                  onClick={() => {
                    if (adminInstructions.trim()) {
                      onRegenerate(adminInstructions.trim(), currentRating);
                      setAdminInstructions('');
                    }
                  }}
                  disabled={
                    !adminInstructions.trim() || isLoading || isRegenerating
                  }
                  className="w-full p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-left transition-all hover:border-indigo-400 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-white"
                      >
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 16h5v5" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-indigo-700">
                        Regenerate with Instructions
                      </p>
                      <p className="text-sm text-indigo-600/70">
                        AI will create a new response based on your feedback
                      </p>
                    </div>
                  </div>
                </button>

                <div className="flex gap-3">
                  {/* Block User Button */}
                  <button
                    onClick={onBlock}
                    disabled={isLoading || isRegenerating}
                    className="flex-1 p-4 rounded-xl border-2 border-rose-200 bg-rose-50 text-left transition-all hover:border-rose-400 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-white"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="m4.9 4.9 14.2 14.2" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-rose-700">Block User</p>
                        <p className="text-xs text-rose-600/70">
                          Severe violation
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Approve Button */}
                  <button
                    onClick={() => onApprove(currentRating)}
                    disabled={isLoading || isRegenerating}
                    className="flex-1 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-left transition-all hover:border-emerald-400 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-white"
                        >
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-emerald-700">
                          Approve & Send
                        </p>
                        <p className="text-xs text-emerald-600/70">
                          Send to user in realtime
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-slate-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              💡 Tip: Rate the response and provide specific instructions to
              help AI improve. Higher-rated responses help train better AI
              behavior.
            </p>
            <button
              onClick={onClose}
              disabled={isLoading || isRegenerating}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// User Management Modal (existing functionality)
function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  confirmVariant = 'primary',
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  confirmVariant?: 'primary' | 'danger';
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-border bg-white p-6 shadow-xl">
        <div
          className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmVariant === 'danger' ? 'bg-red-500/10' : 'bg-primary/10'}`}
        >
          {confirmVariant === 'danger' ? (
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-semibold text-foreground text-center mb-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-11 rounded-xl border border-input bg-white text-foreground font-medium transition-all duration-200 hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 h-11 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center ${confirmVariant === 'danger' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-primary text-primary-foreground hover:opacity-90'}`}
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Warning Action Cell - Shows warning buttons or block button based on user's warning count
function WarningActionCell({
  anomaly,
  onReview,
  onWarn,
  onBlock,
  isWarnLoading,
}: {
  anomaly: Anomaly;
  onReview: (anomaly: Anomaly) => void;
  onWarn: (userId: string, anomalyId: string) => void;
  onBlock: (anomaly: Anomaly) => void;
  isWarnLoading: boolean;
}) {
  const { data: warningData, isLoading: warningLoading } =
    trpc.admin.getUserWarningCount.useQuery(
      { userId: anomaly.userId },
      { enabled: anomaly.status === 'pending' },
    );

  // For non-pending anomalies, just show View button
  if (anomaly.status !== 'pending') {
    return (
      <button
        onClick={() => onReview(anomaly)}
        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
      >
        View
      </button>
    );
  }

  // Loading state
  if (warningLoading) {
    return (
      <div className="flex items-center justify-end gap-2">
        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const warningCount = warningData?.warningCount ?? 0;
  const isBlocked = warningData?.isBlocked ?? false;

  // Determine action buttons

  if (isBlocked) {
    return (
      <span className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-100 rounded-full">
        Blocked
      </span>
    );
  }

  const nextWarning = warningCount + 1;
  const warningColors = {
    1: 'text-amber-600 bg-amber-50 hover:bg-amber-100',
    2: 'text-orange-600 bg-orange-50 hover:bg-orange-100',
    3: 'text-red-600 bg-red-50 hover:bg-red-100',
  };
  // Default color for warnings > 3
  const defaultWarningColor = 'text-red-700 bg-red-50 hover:bg-red-100';
  const warningColorClass =
    nextWarning <= 3
      ? warningColors[nextWarning as 1 | 2 | 3]
      : defaultWarningColor;
  const displayWarningCount = nextWarning > 3 ? 3 : nextWarning;

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Show Warning button only if less than 3 warnings */}
      {warningCount < 3 && (
        <button
          onClick={() => onWarn(anomaly.userId, anomaly.id)}
          disabled={isWarnLoading}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${warningColorClass}`}
        >
          {isWarnLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              Warning...
            </span>
          ) : (
            `Warning ${displayWarningCount}`
          )}
        </button>
      )}

      {/* Show Block button if 3 or more warnings */}
      {warningCount >= 3 && (
        <button
          onClick={() => onBlock(anomaly)}
          disabled={isWarnLoading}
          className="px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-50"
        >
          Block User
        </button>
      )}

      <button
        onClick={() => onReview(anomaly)}
        className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
      >
        Review
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'triage' | 'semantic' | 'users'>(
    'triage',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [anomalyPage, setAnomalyPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    'pending' | 'approved' | 'blocked' | 'corrected' | 'all'
  >('all');

  // Modal state for user management
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'makeAdmin' | 'removeAdmin' | null;
    userId: string | null;
    userName: string | null;
  }>({
    isOpen: false,
    type: null,
    userId: null,
    userName: null,
  });

  const utils = trpc.useUtils();

  // Fetch stats
  const { data: stats, isLoading: statsLoading } =
    trpc.admin.getStats.useQuery();

  // Fetch anomaly stats (polling every 5 seconds)
  const { data: anomalyStats } = trpc.admin.getAnomalyStats.useQuery(
    undefined,
    {
      refetchInterval: 5000,
    },
  );

  // Fetch anomalies from database (polling every 5 seconds)
  const { data: anomaliesData, isLoading: anomaliesLoading } =
    trpc.admin.getAnomalies.useQuery(
      {
        page: anomalyPage,
        limit: 20,
        status: statusFilter,
      },
      {
        refetchInterval: 5000,
      },
    );

  // Fetch Layer 2 semantic reviews (human-in-the-loop pending, polling every 5 seconds)
  const [semanticPage, setSemanticPage] = useState(1);
  const semanticReviewsQuery = trpc.admin.getPendingSemanticReviews.useQuery(
    {
      page: semanticPage,
      limit: 20,
    },
    {
      refetchInterval: 5000,
    },
  );
  const semanticReviewsData = semanticReviewsQuery.data as
    | {
        anomalies: SemanticReviewAnomaly[];
        total: number;
        pages: number;
        currentPage: number;
      }
    | undefined;
  const semanticLoading = semanticReviewsQuery.isLoading;

  // Fetch pending human reviews (blocked chats awaiting admin action, polling every 5 seconds)
  const [humanReviewPage, setHumanReviewPage] = useState(1);
  const pendingHumanReviewsQuery = trpc.admin.getPendingHumanReviews.useQuery(
    {
      page: humanReviewPage,
      limit: 20,
    },
    {
      refetchInterval: 5000,
    },
  );
  const pendingHumanReviewsData = pendingHumanReviewsQuery.data as
    | {
        chats: PendingHumanReview[];
        total: number;
        pages: number;
        currentPage: number;
      }
    | undefined;
  const humanReviewsLoading = pendingHumanReviewsQuery.isLoading;

  // State for human review modal
  const [humanReviewModalOpen, setHumanReviewModalOpen] = useState(false);
  const [selectedChatForReview, setSelectedChatForReview] =
    useState<PendingHumanReview | null>(null);
  const [originalAIResponse, setOriginalAIResponse] = useState<string>('');

  // State for semantic review modal (Human-in-the-Loop Layer 2)
  const [semanticReviewModalOpen, setSemanticReviewModalOpen] = useState(false);
  const [selectedSemanticAnomaly, setSelectedSemanticAnomaly] =
    useState<SemanticReviewAnomaly | null>(null);
  const [semanticCurrentResponse, setSemanticCurrentResponse] = useState('');
  const [semanticIterations, setSemanticIterations] = useState<
    ReviewIteration[]
  >([]);

  // Fetch users
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch,
  } = isSearching && searchQuery
    ? trpc.admin.searchUsers.useQuery({
        query: searchQuery,
        page: currentPage,
        limit: 10,
      })
    : trpc.admin.getAllUsers.useQuery({ page: currentPage, limit: 10 });

  // Mutations
  const makeAdminMutation = trpc.admin.makeAdmin.useMutation({
    onSuccess: () => {
      refetch();
      closeModal();
    },
  });
  const removeAdminMutation = trpc.admin.removeAdmin.useMutation({
    onSuccess: () => {
      refetch();
      closeModal();
    },
  });

  // Anomaly review mutation
  const reviewAnomalyMutation = trpc.admin.reviewAnomaly.useMutation({
    onSuccess: () => {
      utils.admin.getAnomalies.invalidate();
      utils.admin.getAnomalyStats.invalidate();
      utils.admin.getStats.invalidate();
      utils.admin.getPendingSemanticReviews.invalidate();
      setReviewModalOpen(false);
      setSelectedAnomaly(null);
    },
  });

  // Human review action mutation (for blocked chats)
  const humanReviewActionMutation = trpc.admin.humanReviewAction.useMutation({
    onSuccess: () => {
      utils.admin.getPendingHumanReviews.invalidate();
      utils.admin.getAnomalyStats.invalidate();
      utils.admin.getStats.invalidate();
      setHumanReviewModalOpen(false);
      setSelectedChatForReview(null);
      setOriginalAIResponse('');
    },
  });

  // Warn user mutation (for issuing warnings before blocking)
  const warnUserMutation = trpc.admin.warnUser.useMutation({
    onSuccess: () => {
      utils.admin.getAnomalies.invalidate();
      utils.admin.getUserWarningCount.invalidate();
      utils.admin.getAnomalyStats.invalidate();
      utils.admin.getStats.invalidate();
    },
  });

  // Semantic review mutations (Human-in-the-Loop Layer 2)
  const regenerateSemanticMutation =
    trpc.admin.regenerateSemanticResponse.useMutation({
      onSuccess: data => {
        setSemanticCurrentResponse(data.newResponse);
        // Refresh the review history
        if (selectedSemanticAnomaly) {
          utils.admin.getSemanticReviewHistory.invalidate({
            anomalyId: selectedSemanticAnomaly.id,
          });
        }
      },
    });

  const approveSemanticMutation = trpc.admin.approveSemanticReview.useMutation({
    onSuccess: () => {
      utils.admin.getPendingSemanticReviews.invalidate();
      utils.admin.getAnomalyStats.invalidate();
      utils.admin.getStats.invalidate();
      setSemanticReviewModalOpen(false);
      setSelectedSemanticAnomaly(null);
      setSemanticCurrentResponse('');
      setSemanticIterations([]);
    },
  });

  const blockSemanticMutation =
    trpc.admin.blockUserFromSemanticReview.useMutation({
      onSuccess: () => {
        utils.admin.getPendingSemanticReviews.invalidate();
        utils.admin.getAnomalyStats.invalidate();
        utils.admin.getStats.invalidate();
        setSemanticReviewModalOpen(false);
        setSelectedSemanticAnomaly(null);
        setSemanticCurrentResponse('');
        setSemanticIterations([]);
      },
    });

  // Handler to open human review modal and fetch original AI response
  const handleOpenHumanReviewModal = async (chat: PendingHumanReview) => {
    setSelectedChatForReview(chat);
    setHumanReviewModalOpen(true);

    // Find the pending review message to get original content
    const pendingMessage = chat.messages.find(m => m.isPendingReview);
    if (pendingMessage?.originalContent) {
      setOriginalAIResponse(pendingMessage.originalContent);
    } else {
      // If originalContent is not in the message, look for it from the AI response
      const aiMessage = chat.messages.find(m => m.role === 'assistant');
      setOriginalAIResponse(
        aiMessage?.originalContent ||
          aiMessage?.content ||
          'No AI response available',
      );
    }
  };

  // Human review action handlers
  const handleHumanReviewApprove = async () => {
    if (selectedChatForReview) {
      await humanReviewActionMutation.mutateAsync({
        chatId: selectedChatForReview.id,
        action: 'approve',
      });
    }
  };

  const handleHumanReviewBlock = async () => {
    if (selectedChatForReview) {
      await humanReviewActionMutation.mutateAsync({
        chatId: selectedChatForReview.id,
        action: 'block',
      });
    }
  };

  const handleHumanReviewRespond = async (response: string) => {
    if (selectedChatForReview) {
      await humanReviewActionMutation.mutateAsync({
        chatId: selectedChatForReview.id,
        action: 'admin_response',
        adminResponse: response,
      });
    }
  };

  // Semantic review handlers (Human-in-the-Loop Layer 2)
  const handleOpenSemanticReviewModal = (anomaly: SemanticReviewAnomaly) => {
    setSelectedSemanticAnomaly(anomaly);
    setSemanticCurrentResponse(anomaly.aiResponse || '');
    setSemanticIterations([]);
    setSemanticReviewModalOpen(true);
  };

  const handleSemanticRegenerate = async (
    instructions: string,
    rating: number,
  ) => {
    if (selectedSemanticAnomaly) {
      // Add current iteration to local state
      const newIteration: ReviewIteration = {
        response: semanticCurrentResponse,
        adminInstructions: instructions,
        rating,
        timestamp: new Date().toISOString(),
      };
      setSemanticIterations(prev => [...prev, newIteration]);

      await regenerateSemanticMutation.mutateAsync({
        anomalyId: selectedSemanticAnomaly.id,
        adminInstructions: instructions,
        currentResponseRating: rating,
      });
    }
  };

  const handleSemanticApprove = async (rating: number) => {
    if (selectedSemanticAnomaly) {
      await approveSemanticMutation.mutateAsync({
        anomalyId: selectedSemanticAnomaly.id,
        finalRating: rating,
      });
    }
  };

  const handleSemanticBlock = async () => {
    if (selectedSemanticAnomaly) {
      await blockSemanticMutation.mutateAsync({
        anomalyId: selectedSemanticAnomaly.id,
      });
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setCurrentPage(1);
  };

  const openMakeAdminModal = (userId: string, userName: string) => {
    setModalState({ isOpen: true, type: 'makeAdmin', userId, userName });
  };

  const openRemoveAdminModal = (userId: string, userName: string) => {
    setModalState({ isOpen: true, type: 'removeAdmin', userId, userName });
  };

  const closeModal = () => {
    setModalState({ isOpen: false, type: null, userId: null, userName: null });
  };

  const handleConfirmAction = async () => {
    if (!modalState.userId) return;
    if (modalState.type === 'makeAdmin') {
      await makeAdminMutation.mutateAsync({ userId: modalState.userId });
    } else if (modalState.type === 'removeAdmin') {
      await removeAdminMutation.mutateAsync({ userId: modalState.userId });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  const handleReview = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setReviewModalOpen(true);
  };

  const handleApprove = async () => {
    if (selectedAnomaly) {
      await reviewAnomalyMutation.mutateAsync({
        id: selectedAnomaly.id,
        action: 'approve',
        reviewNotes: 'Marked as false positive by admin',
      });
    }
  };

  const handleBlock = async () => {
    if (selectedAnomaly) {
      await reviewAnomalyMutation.mutateAsync({
        id: selectedAnomaly.id,
        action: 'block',
        reviewNotes: 'Block confirmed by admin',
      });
    }
  };

  const handleCorrect = async (response: string) => {
    if (selectedAnomaly) {
      await reviewAnomalyMutation.mutateAsync({
        id: selectedAnomaly.id,
        action: 'correct',
        adminResponse: response,
        reviewNotes: 'Response corrected and sent by admin',
      });
    }
  };

  // Handler for issuing warnings from the table
  const handleWarn = async (userId: string, anomalyId: string) => {
    await warnUserMutation.mutateAsync({ userId, anomalyId });
  };

  // Handler for blocking from the table (user has 3+ warnings)
  const handleBlockFromTable = async (anomaly: Anomaly) => {
    await reviewAnomalyMutation.mutateAsync({
      id: anomaly.id,
      action: 'block',
      reviewNotes: 'Blocked after 3 warnings by admin',
    });
  };

  // Use data from API with explicit typing
  const anomaliesRaw = anomaliesData?.anomalies;
  const anomalies: Anomaly[] = anomaliesRaw
    ? (anomaliesRaw as unknown as Anomaly[])
    : [];
  const pendingCount = stats?.pendingAnomalies || 0;
  const topViolation = stats?.topViolationType || 'None';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Human Review Action Modal */}
      <HumanReviewActionModal
        isOpen={humanReviewModalOpen}
        onClose={() => {
          setHumanReviewModalOpen(false);
          setSelectedChatForReview(null);
          setOriginalAIResponse('');
        }}
        chat={selectedChatForReview}
        originalAIResponse={originalAIResponse}
        onApprove={handleHumanReviewApprove}
        onBlock={handleHumanReviewBlock}
        onRespond={handleHumanReviewRespond}
        isLoading={humanReviewActionMutation.isPending}
      />

      {/* User Management Modal */}
      <ConfirmModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={handleConfirmAction}
        title={
          modalState.type === 'makeAdmin'
            ? 'Grant Admin Privileges'
            : 'Remove Admin Privileges'
        }
        message={
          modalState.type === 'makeAdmin'
            ? `Are you sure you want to make ${modalState.userName} an admin?`
            : `Are you sure you want to remove admin privileges from ${modalState.userName}?`
        }
        confirmText={
          modalState.type === 'makeAdmin' ? 'Make Admin' : 'Remove Admin'
        }
        confirmVariant={
          modalState.type === 'removeAdmin' ? 'danger' : 'primary'
        }
        isLoading={makeAdminMutation.isPending || removeAdminMutation.isPending}
      />

      {/* Review Modal */}
      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setSelectedAnomaly(null);
        }}
        anomaly={selectedAnomaly}
        onApprove={handleApprove}
        onBlock={handleBlock}
        onCorrect={handleCorrect}
        isLoading={reviewAnomalyMutation.isPending}
      />

      {/* Semantic Review Modal (Human-in-the-Loop Layer 2) */}
      <SemanticReviewModal
        isOpen={semanticReviewModalOpen}
        onClose={() => {
          setSemanticReviewModalOpen(false);
          setSelectedSemanticAnomaly(null);
          setSemanticCurrentResponse('');
          setSemanticIterations([]);
        }}
        anomaly={selectedSemanticAnomaly}
        onApprove={handleSemanticApprove}
        onBlock={handleSemanticBlock}
        onRegenerate={handleSemanticRegenerate}
        isLoading={
          approveSemanticMutation.isPending || blockSemanticMutation.isPending
        }
        isRegenerating={regenerateSemanticMutation.isPending}
        currentResponse={semanticCurrentResponse}
        iterations={semanticIterations}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-bold text-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              CHAPAL
            </Link>
            <span className="px-2 py-1 rounded-full bg-rose-500/10 text-rose-600 text-xs font-medium">
              Admin Command Center
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="text-xs font-medium text-success">
                System Operational
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {session?.user?.name}
            </span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign Out
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-24 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage AI safety across all interactions
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-6 rounded-xl border border-border bg-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Total Anomalies
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {stats?.totalAnomalies || 0}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-rose-600"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-amber-200 bg-amber-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-amber-700 mb-1">
                  Pending Triage
                </div>
                <div className="text-3xl font-bold text-amber-700">
                  {pendingCount}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-200 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-amber-700"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Top Violation
                </div>
                <div className="text-xl font-bold text-foreground truncate max-w-[150px]">
                  {topViolation}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-purple-600"
                >
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Total Users
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {statsLoading ? '...' : stats?.totalUsers}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('triage')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'triage'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-2">
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
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Anomaly Triage
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
                  {pendingCount}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-2">
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
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              User Management
            </span>
          </button>
          <button
            onClick={() => setActiveTab('semantic')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'semantic'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-2">
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
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              Semantic Reviews (L2)
              {(semanticReviewsData?.total ?? 0) > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                  {semanticReviewsData?.total}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Triage Table */}
        {activeTab === 'triage' && (
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            {/* Filter Bar */}
            <div className="px-6 py-4 border-b border-border bg-slate-50 flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">
                Filter by status:
              </span>
              <div className="flex gap-2">
                {(
                  [
                    'all',
                    'pending',
                    'approved',
                    'blocked',
                    'corrected',
                  ] as const
                ).map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setAnomalyPage(1);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      statusFilter === status
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading State */}
            {anomaliesLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : anomalies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
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
                  className="mb-4 opacity-50"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <p className="text-lg font-medium">No anomalies found</p>
                <p className="text-sm">
                  The system is running smoothly. No flagged interactions to
                  review.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-slate-50">
                        <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                          Time
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                          User
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                          Severity
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                          Type
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                          Query
                        </th>
                        <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {anomalies.map(anomaly => (
                        <tr
                          key={anomaly.id}
                          className="border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {new Date(anomaly.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                              {anomaly.userEmail}
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                anomaly.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-700'
                                  : anomaly.severity === 'high'
                                    ? 'bg-orange-100 text-orange-700'
                                    : anomaly.severity === 'medium'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {anomaly.severity.charAt(0).toUpperCase() +
                                anomaly.severity.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-foreground">
                            {anomaly.anomalyType}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate">
                            {anomaly.userQuery}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                anomaly.status === 'pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : anomaly.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : anomaly.status === 'blocked'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {anomaly.status.charAt(0).toUpperCase() +
                                anomaly.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <WarningActionCell
                              anomaly={anomaly}
                              onReview={handleReview}
                              onWarn={handleWarn}
                              onBlock={handleBlockFromTable}
                              isWarnLoading={
                                warnUserMutation.isPending ||
                                reviewAnomalyMutation.isPending
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {anomaliesData && anomaliesData.pages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
                    <button
                      onClick={() => setAnomalyPage(p => Math.max(1, p - 1))}
                      disabled={anomalyPage === 1}
                      className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Page {anomalyPage} of {anomaliesData.pages}
                    </span>
                    <button
                      onClick={() =>
                        setAnomalyPage(p =>
                          Math.min(anomaliesData.pages, p + 1),
                        )
                      }
                      disabled={anomalyPage === anomaliesData.pages}
                      className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Layer 2 Semantic Reviews */}
        {activeTab === 'semantic' && (
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-blue-50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-600"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Human-in-the-Loop Reviews (Layer 2)
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Semantic analysis flagged responses requiring human
                    verification
                  </p>
                </div>
              </div>
            </div>

            {semanticLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : !semanticReviewsData?.anomalies?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mb-4 opacity-50"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <p className="text-lg font-medium">
                  No pending semantic reviews
                </p>
                <p className="text-sm">
                  All Layer 2 flagged responses have been reviewed
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {(semanticReviewsData?.anomalies || []).map(anomaly => {
                    const semantic = anomaly.semanticAnalysis;

                    return (
                      <div
                        key={anomaly.id}
                        className="p-6 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          {/* Risk Indicator */}
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              semantic?.riskLevel === 'high'
                                ? 'bg-rose-100 text-rose-600'
                                : semantic?.riskLevel === 'medium'
                                  ? 'bg-amber-100 text-amber-600'
                                  : 'bg-blue-100 text-blue-600'
                            }`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 16v-4" />
                              <path d="M12 8h.01" />
                            </svg>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-foreground">
                                {anomaly.userEmail}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(anomaly.timestamp).toLocaleString()}
                              </span>
                            </div>

                            {/* Flags */}
                            <div className="flex flex-wrap gap-2 mb-3">
                              {/* CHAT BLOCKING INDICATOR - Always show for Layer 2 */}
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 animate-pulse">
                                🚫 Chat Blocked - User Waiting
                              </span>
                              {semantic?.isHallucination && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                                  🎭 Hallucination Risk
                                </span>
                              )}
                              {semantic?.isMedicalAdvice && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-700">
                                  🏥 Medical Context
                                </span>
                              )}
                              {semantic?.isPsychological && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-700">
                                  🧠 Psychological
                                </span>
                              )}
                              {semantic?.emotionalConcern && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                                  💔 Emotional Concern
                                </span>
                              )}
                              {semantic?.accuracyScore !== undefined && (
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    semantic.accuracyScore >= 80
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : semantic.accuracyScore >= 60
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-rose-100 text-rose-700'
                                  }`}
                                >
                                  📊 Accuracy: {semantic.accuracyScore}%
                                </span>
                              )}
                            </div>

                            {/* User Query */}
                            <div className="mb-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                User Query:
                              </p>
                              <p className="text-sm text-foreground bg-muted/50 p-2 rounded-lg line-clamp-2">
                                {anomaly.userQuery}
                              </p>
                            </div>

                            {/* AI Response (Hidden from user) */}
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                AI Response (Hidden from user):
                              </p>
                              <p className="text-sm text-foreground bg-amber-50 border border-amber-200 p-2 rounded-lg line-clamp-3">
                                {anomaly.aiResponse || 'No response generated'}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex-shrink-0">
                            <button
                              onClick={() =>
                                handleOpenSemanticReviewModal(anomaly)
                              }
                              className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                              Review & Respond
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {semanticReviewsData.pages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
                    <button
                      onClick={() => setSemanticPage(p => Math.max(1, p - 1))}
                      disabled={semanticPage === 1}
                      className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Page {semanticPage} of {semanticReviewsData.pages}
                    </span>
                    <button
                      onClick={() =>
                        setSemanticPage(p =>
                          Math.min(semanticReviewsData.pages, p + 1),
                        )
                      }
                      disabled={semanticPage === semanticReviewsData.pages}
                      className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Users Table */}
        {activeTab === 'users' && (
          <>
            {/* Search Section */}
            <div className="mb-6">
              <form onSubmit={handleSearch} className="flex gap-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or user ID..."
                    className="h-12 w-full rounded-xl border border-border bg-white px-4 pr-24 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                  {isSearching && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-20 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!searchQuery}
                  className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  Search
                </button>
              </form>
            </div>

            <div className="rounded-xl border border-border bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-slate-50">
                      <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                        User
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                        User ID
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                        Role
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                        Joined
                      </th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-muted-foreground"
                        >
                          Loading...
                        </td>
                      </tr>
                    ) : usersData?.users.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-muted-foreground"
                        >
                          No users found
                        </td>
                      </tr>
                    ) : (
                      usersData?.users.map(user => (
                        <tr
                          key={user.id}
                          className="border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {user.image ? (
                                <Image
                                  src={user.image}
                                  alt={user.name}
                                  width={40}
                                  height={40}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-foreground">
                                  {user.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                              {user.id}
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.emailVerified ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}
                            >
                              {user.emailVerified ? 'Verified' : 'Unverified'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {user.id !== session?.user?.id &&
                              (user.role === 'admin' ? (
                                <button
                                  onClick={() =>
                                    openRemoveAdminModal(user.id, user.name)
                                  }
                                  className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                  Remove Admin
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    openMakeAdminModal(user.id, user.name)
                                  }
                                  className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                >
                                  Make Admin
                                </button>
                              ))}
                            {user.id === session?.user?.id && (
                              <span className="text-sm text-muted-foreground">
                                You
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {usersData && usersData.pages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Page {usersData.currentPage} of {usersData.pages} (
                    {usersData.total} total users)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-white hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage(p => Math.min(usersData.pages, p + 1))
                      }
                      disabled={currentPage === usersData.pages}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-white hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Error Messages */}
        {(makeAdminMutation.error || removeAdminMutation.error) && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600">
            {makeAdminMutation.error?.message ||
              removeAdminMutation.error?.message}
          </div>
        )}
      </main>
    </div>
  );
}
