'use client';

import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { UserDropdown } from '@/components/UserDropdown';

export function Header() {
  const { data: session, isPending } = useSession();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo with Shield Icon */}
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold text-foreground hover:text-primary transition-all duration-300"
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

        {/* Status Indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          <span className="text-xs font-medium text-success">
            System Active: Monitoring via AI Guardrails
          </span>
        </div>

        {/* Auth Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {isPending ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
          ) : session ? (
            <>
              <Link
                href="/chat"
                className="flex h-9 items-center justify-center rounded-lg px-3 sm:px-4 text-sm font-medium text-muted-foreground transition-all duration-300 hover:text-foreground hover:bg-muted cursor-pointer"
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
                  className="mr-2"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Chat
              </Link>
              <UserDropdown user={session.user} />
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="flex h-9 items-center justify-center rounded-lg px-3 sm:px-4 text-sm font-medium text-muted-foreground transition-all duration-300 hover:text-foreground cursor-pointer"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="flex h-9 items-center justify-center rounded-lg bg-primary px-3 sm:px-5 text-sm font-medium text-primary-foreground transition-all duration-300 hover:bg-primary/90 shadow-sm cursor-pointer"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
