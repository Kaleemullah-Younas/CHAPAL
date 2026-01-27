'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession } from '@/lib/auth-client';
import { UserDropdown } from '@/components/UserDropdown';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import { NotificationBell } from '@/components/NotificationBell';

export function Navbar() {
  const { data: session, isPending } = useSession();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4">
      <nav className="w-full max-w-7xl bg-white/70 backdrop-blur-md rounded-2xl border border-accent/20 shadow-lg shadow-accent/5 px-6 py-3">
        <div className="flex items-center justify-between w-full">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-foreground hover:text-primary transition-all duration-300"
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <Image
                src="/logo.svg"
                alt="CHAPAL Logo"
                width={28}
                height={28}
                className="drop-shadow-sm w-7 h-auto"
                priority
              />
            </motion.div>
            <span className="text-primary font-bold font-heading">CHAPAL</span>
          </Link>

          {/* Navigation Links - Centered */}
          <div className="hidden md:flex items-center gap-0.5">
            {['Features', 'How it Works', 'Detection'].map(item => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-primary rounded-lg transition-all duration-300 hover:bg-primary/5"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {item}
              </motion.a>
            ))}
          </div>

          {/* Auth Actions */}
          <div className="flex items-center gap-2">
            {isPending ? (
              <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
            ) : session ? (
              <>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href="/chat"
                    className="flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-all duration-300 hover:text-primary hover:bg-primary/5"
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
                      className="mr-1.5"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Chat
                  </Link>
                </motion.div>
                <NotificationBell />
                <UserDropdown user={session.user} />
              </>
            ) : (
              <>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href="/signin"
                    className="flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-all duration-300 hover:text-primary"
                  >
                    Sign In
                  </Link>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Link
                    href="/signup"
                    className="flex h-8 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white transition-all duration-300 hover:bg-primary/90 hover:shadow-md"
                  >
                    Get Started
                  </Link>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
