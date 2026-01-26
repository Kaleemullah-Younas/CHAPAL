'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

export default function ChatPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const router = useRouter();

  const createChat = trpc.chat.createChat.useMutation({
    onSuccess: chat => {
      router.push(`/chat/${chat.id}`);
    },
  });

  if (sessionPending) {
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

  const handleNewChat = () => {
    createChat.mutate({});
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold mb-2">Welcome to Chapal AI</h1>
        <p className="text-muted-foreground mb-6">
          Start a conversation with our AI assistant. You can ask questions,
          upload images for analysis, or share PDF documents.
        </p>

        <button
          onClick={handleNewChat}
          disabled={createChat.isPending}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
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
            <path d="M12 5v14M5 12h14" />
          </svg>
          {createChat.isPending ? 'Creating...' : 'Start New Chat'}
        </button>

        <div className="mt-8 grid grid-cols-2 gap-4 text-left">
          <div className="p-4 bg-muted/50 rounded-lg">
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
                className="text-primary"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <span className="font-medium text-sm">Image Analysis</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload images and get detailed AI analysis
            </p>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
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
                className="text-primary"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="font-medium text-sm">PDF Documents</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Share PDFs with automatic text extraction
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
