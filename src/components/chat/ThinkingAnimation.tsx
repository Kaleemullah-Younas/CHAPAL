'use client';

export type ThinkingStage =
  | 'analyzing_safety'
  | 'checking_injection'
  | 'detecting_emotion'
  | 'semantic_analysis'
  | 'generating_response'
  | 'complete';

interface ThinkingAnimationProps {
  stage: ThinkingStage;
  message: string;
  isVisible: boolean;
}

const STAGE_CONFIG: Record<
  ThinkingStage,
  { icon: string; color: string; label: string }
> = {
  analyzing_safety: {
    icon: '🛡️',
    color: 'text-blue-500',
    label: 'Safety Analysis',
  },
  checking_injection: {
    icon: '🔒',
    color: 'text-purple-500',
    label: 'Injection Check',
  },
  detecting_emotion: {
    icon: '💭',
    color: 'text-pink-500',
    label: 'Emotion Detection',
  },
  semantic_analysis: {
    icon: '🧠',
    color: 'text-indigo-500',
    label: 'Semantic Analysis',
  },
  generating_response: {
    icon: '✨',
    color: 'text-amber-500',
    label: 'Generating Response',
  },
  complete: {
    icon: '✅',
    color: 'text-emerald-500',
    label: 'Complete',
  },
};

export function ThinkingAnimation({
  stage,
  message,
  isVisible,
}: ThinkingAnimationProps) {
  if (!isVisible) return null;

  const config = STAGE_CONFIG[stage];
  const stages: ThinkingStage[] = [
    'analyzing_safety',
    'checking_injection',
    'detecting_emotion',
    'semantic_analysis',
    'generating_response',
  ];

  const currentIndex = stages.indexOf(stage);

  return (
    <div className="flex gap-4 p-4 bg-gradient-to-r from-primary/5 to-transparent border-b border-border">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary/10">
        <span className="text-lg animate-pulse">{config.icon}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className={`font-medium ${config.color}`}>{config.label}</span>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>

        {/* Progress dots */}
        <div className="flex items-center gap-2 mt-3">
          {stages.map((s, index) => {
            const stageConfig = STAGE_CONFIG[s];
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={s} className="flex items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-600'
                      : isCurrent
                        ? 'bg-primary/20 text-primary ring-2 ring-primary/30'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                  title={stageConfig.label}
                >
                  {isCompleted ? '✓' : stageConfig.icon}
                </div>
                {index < stages.length - 1 && (
                  <div
                    className={`w-4 h-0.5 ${
                      isCompleted ? 'bg-emerald-300' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Compact inline thinking indicator for chat bubble
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-sm">AI is thinking...</span>
    </div>
  );
}

// Pending review message component
export function PendingReviewMessage({ message }: { message: string }) {
  return (
    <div className="flex gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-amber-100">
        <span className="text-xl">⏳</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-amber-700">
            Pending Human Review
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-200 text-amber-800">
            Layer 2
          </span>
        </div>
        <p className="text-sm text-amber-600">{message}</p>
        <div className="flex items-center gap-2 mt-2 text-xs text-amber-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>You&apos;ll be notified when reviewed</span>
        </div>
      </div>
    </div>
  );
}
