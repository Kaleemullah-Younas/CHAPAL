'use client';

import Link from 'next/link';
import { useSession, signOut } from '@/lib/auth-client';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserDropdown } from '@/components/UserDropdown';

export function Header() {
  const { data: session, isPending } = useSession();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-bold text-foreground hover:text-foreground/80 transition-all duration-300"
        >
          CHAPAL
        </Link>

        {/* Auth Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />

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
                className="flex h-9 items-center justify-center rounded-lg bg-primary px-3 sm:px-5 text-sm font-medium text-primary-foreground transition-all duration-300 hover:opacity-90 shadow-sm cursor-pointer"
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
