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

  // Animate navbar - full width at top, shrinks to rounded rectangle on scroll
  const navWidth = useTransform(
    scrollY,
    [0, 100],
    ['100%', 'min(800px, 90vw)'],
  );
  const navY = useTransform(scrollY, [0, 100], [0, 8]);
  const navPadding = useTransform(scrollY, [0, 100], ['8px 24px', '6px 16px']);
  const navBorderRadius = useTransform(scrollY, [0, 100], [0, 20]);
  const navBackground = useTransform(
    scrollY,
    [0, 100],
    ['rgba(255, 255, 255, 0.85)', 'rgba(255, 255, 255, 0.95)'],
  );
  const navShadow = useTransform(
    scrollY,
    [0, 100],
    [
      '0 1px 3px rgba(76, 118, 156, 0.05)',
      '0 8px 32px rgba(76, 118, 156, 0.12)',
    ],
  );
  const navBorder = useTransform(
    scrollY,
    [0, 100],
    [
      '1px solid rgba(137, 201, 250, 0.1)',
      '1px solid rgba(137, 201, 250, 0.3)',
    ],
  );

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 flex justify-center"
      style={{
        paddingTop: navY,
        paddingLeft: isScrolled ? 16 : 0,
        paddingRight: isScrolled ? 16 : 0,
      }}
    >
      <motion.nav
        className="backdrop-blur-xl"
        style={{
          width: navWidth,
          backgroundColor: navBackground,
          boxShadow: navShadow,
          padding: navPadding,
          borderRadius: navBorderRadius,
          border: navBorder,
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-foreground hover:text-primary transition-all duration-300"
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <img
                src="/logo.svg"
                alt="CHAPAL Logo"
                width={28}
                height={28}
                className="drop-shadow-sm"
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
      </motion.nav>
    </motion.header>
  );
}
