'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChatSidebar } from '@/components/chat';
import { useSession } from '@/lib/auth-client';
import { UserDropdown } from '@/components/UserDropdown';
import { NotificationBell } from '@/components/NotificationBell';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();

  return (
    <div className="flex flex-col h-screen bg-slate-50/50">
      {/* Chat Header */}
      <header className="flex-shrink-0 flex justify-center pt-4 px-4 z-50">
        <nav className="w-full max-w-7xl bg-white/70 backdrop-blur-md rounded-2xl border border-accent/20 shadow-lg shadow-accent/5 px-6 py-3">
          <div className="flex items-center justify-between w-full">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold text-foreground hover:text-primary transition-all duration-300"
            >
              <Image
                src="/logo.svg"
                alt="CHAPAL Logo"
                width={28}
                height={28}
                className="drop-shadow-sm w-7 h-auto"
                priority
              />
              <span className="text-primary font-bold font-heading">
                CHAPAL
              </span>
            </Link>

            <div className="flex items-center gap-2">
              {session && (
                <>
                  <NotificationBell />
                  <UserDropdown user={session.user} />
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <ChatSidebar />
        <main className="flex-1 flex overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
