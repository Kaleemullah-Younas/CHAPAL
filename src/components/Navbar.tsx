'use client';

import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { UserDropdown } from '@/components/UserDropdown';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Navbar() {
  const { data: session, isPending } = useSession();
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animate navbar width and position based on scroll
  const navWidth = useTransform(scrollY, [0, 100], ['100%', '90%']);
  const navY = useTransform(scrollY, [0, 100], [0, 8]);
  const navBorderRadius = useTransform(scrollY, [0, 100], [0, 24]);
  const navBackground = useTransform(
    scrollY,
    [0, 100],
    ['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.95)'],
  );

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 flex justify-center"
      style={{
        paddingTop: navY,
        paddingLeft: isScrolled ? '5%' : '0',
        paddingRight: isScrolled ? '5%' : '0',
      }}
    >
      <motion.nav
        className="backdrop-blur-xl border border-border/50 shadow-lg shadow-primary/5"
        style={{
          width: navWidth,
          borderRadius: navBorderRadius,
          backgroundColor: navBackground,
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-foreground hover:text-primary transition-all duration-300"
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <img
                src="/logo.svg"
                alt="CHAPAL Logo"
                width={36}
                height={36}
                className="drop-shadow-sm"
              />
            </motion.div>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              CHAPAL
            </span>
          </Link>

          {/* Navigation Links - Centered */}
          <div className="hidden md:flex items-center gap-1">
            {['Features', 'How it Works', 'Detection'].map(item => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary rounded-xl transition-all duration-300 hover:bg-primary/5"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {item}
              </motion.a>
            ))}
          </div>

          {/* Auth Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isPending ? (
              <div className="h-9 w-24 animate-pulse rounded-xl bg-muted" />
            ) : session ? (
              <>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href="/chat"
                    className="flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground transition-all duration-300 hover:text-primary hover:bg-primary/5"
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
                </motion.div>
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
                    className="flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground transition-all duration-300 hover:text-primary"
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
                    className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-accent px-5 text-sm font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-primary/25"
                  >
                    Get Started
                  </Link>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </motion.nav>
    </motion.header>
  );
}
