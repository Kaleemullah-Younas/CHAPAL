'use client';

import { ChatSidebar } from '@/components/chat';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50/50">
      <ChatSidebar />
      <main className="flex-1 flex overflow-hidden">{children}</main>
    </div>
  );
}
