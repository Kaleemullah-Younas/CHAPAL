'use client';

interface AnomalyLog {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

interface TransparencyPanelProps {
  safetyScore: number;
  accuracyScore: number;
  userEmotion: string;
  anomalyLogs: AnomalyLog[];
  isAnalyzing?: boolean;
}

export function TransparencyPanel({
  safetyScore = 100,
  accuracyScore = 98,
  userEmotion = 'Neutral',
  anomalyLogs = [],
  isAnalyzing = false,
}: TransparencyPanelProps) {
  const getSafetyColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-danger';
  };

  const getSafetyBgColor = (score: number) => {
    if (score >= 80) return 'bg-success';
    if (score >= 50) return 'bg-warning';
    return 'bg-danger';
  };

  const getEmotionIcon = (emotion: string) => {
    const emotionLower = emotion.toLowerCase();
    if (emotionLower.includes('happy') || emotionLower.includes('positive')) {
      return '😊';
    }
    if (emotionLower.includes('sad') || emotionLower.includes('distressed')) {
      return '😔';
    }
    if (emotionLower.includes('angry') || emotionLower.includes('hostile')) {
      return '😠';
    }
    if (emotionLower.includes('anxious') || emotionLower.includes('worried')) {
      return '😰';
    }
    if (emotionLower.includes('curious')) {
      return '🤔';
    }
    return '😐';
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'badge-danger';
      case 'medium':
        return 'badge-warning';
      default:
        return 'badge-safe';
    }
  };

  return (
    <aside className="w-80 h-full bg-white border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
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
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm">
              Live Session Analysis
            </h2>
            <p className="text-xs text-muted-foreground">
              Real-time AI monitoring
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Safety Score Gauge */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">
              Safety Score
            </span>
            <span
              className={`text-2xl font-bold ${getSafetyColor(safetyScore)}`}
            >
              {safetyScore}%
            </span>
          </div>
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getSafetyBgColor(safetyScore)}`}
              style={{ width: `${safetyScore}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Critical</span>
            <span>Safe</span>
          </div>
        </div>

        {/* Emotion Detector */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
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
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
            <span className="text-sm font-medium text-foreground">
              Emotion Detected
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getEmotionIcon(userEmotion)}</span>
            <div>
              <p className="font-semibold text-foreground">{userEmotion}</p>
              <p className="text-xs text-muted-foreground">
                User sentiment analysis
              </p>
            </div>
          </div>
        </div>

        {/* Accuracy Meter */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
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
              className="text-emerald-500"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span className="text-sm font-medium text-foreground">
              Response Accuracy
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-emerald-600">
              {accuracyScore}%
            </span>
            <span className="text-sm text-muted-foreground">relevance</span>
          </div>
        </div>

        {/* Live Flag Log */}
        <div>
          <div className="flex items-center gap-2 mb-3">
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
              className="text-amber-500"
            >
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" x2="4" y1="22" y2="15" />
            </svg>
            <span className="text-sm font-medium text-foreground">
              Live Flag Log
            </span>
            {isAnalyzing && (
              <span className="flex items-center gap-1 text-xs text-primary">
                <span className="animate-pulse">●</span> Analyzing
              </span>
            )}
          </div>

          {anomalyLogs.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
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
                className="mx-auto mb-2 opacity-50"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <p className="text-sm">No anomalies detected</p>
              <p className="text-xs">Session is clean</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {anomalyLogs.map(log => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg text-sm"
                >
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadge(log.severity)}`}
                  >
                    {log.severity.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">
                      {log.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-slate-50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
          <span>Protected by CHAPAL AI Guardrails</span>
        </div>
      </div>
    </aside>
  );
}
