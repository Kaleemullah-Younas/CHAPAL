'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';

interface Chat {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ChatSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: chats, isLoading, refetch } = trpc.chat.getChats.useQuery();
  const createChat = trpc.chat.createChat.useMutation({
    onSuccess: chat => {
      refetch();
      router.push(`/chat/${chat.id}`);
    },
  });
  const deleteChat = trpc.chat.deleteChat.useMutation({
    onSuccess: () => {
      refetch();
      if (pathname.includes(deletingId || '')) {
        router.push('/chat');
      }
      setDeletingId(null);
    },
  });

  const handleNewChat = () => {
    createChat.mutate({});
  };

  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(chatId);
    deleteChat.mutate({ chatId });
  };

  return (
    <aside className="w-64 h-full bg-card border-r border-border flex flex-col">
      {/* New Chat Button */}
      <div className="p-3 border-b border-border">
        <button
          onClick={handleNewChat}
          disabled={createChat.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
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
            <path d="M12 5v14M5 12h14" />
          </svg>
          {createChat.isPending ? 'Creating...' : 'New Chat'}
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading chats...
          </div>
        ) : chats?.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No chats yet. Start a new conversation!
          </div>
        ) : (
          <nav className="p-2 space-y-1">
            {chats?.map((chat: Chat) => {
              const isActive = pathname === `/chat/${chat.id}`;
              return (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50'
                  }`}
                >
                  <span className="truncate flex-1">
                    {chat.title || 'New Chat'}
                  </span>
                  <button
                    onClick={e => handleDeleteChat(e, chat.id)}
                    className={`opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all ${
                      deletingId === chat.id ? 'opacity-100' : ''
                    }`}
                    disabled={deletingId === chat.id}
                  >
                    {deletingId === chat.id ? (
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
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
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
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    )}
                  </button>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </aside>
  );
}
