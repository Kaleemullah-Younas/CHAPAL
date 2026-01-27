'use client';

import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BlockedPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/signin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <Link
              href="/"
              className="inline-block text-2xl font-bold text-foreground cursor-pointer"
            >
              CHAPAL
            </Link>
          </div>

          {/* Warning Icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-rose-100 flex items-center justify-center">
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
              className="text-rose-600"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m4.9 4.9 14.2 14.2" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-xl font-semibold text-foreground text-center mb-3">
            Account Blocked
          </h1>

          {/* Message */}
          <p className="text-muted-foreground text-center text-sm mb-6">
            Your account has been blocked by an administrator due to a violation
            of our community guidelines. If you believe this is a mistake,
            please contact our support team.
          </p>

          {/* Support Email */}
          <div className="bg-muted rounded-xl p-4 mb-6">
            <p className="text-xs text-muted-foreground mb-1 text-center">
              Contact Support
            </p>
            <a
              href="mailto:support@chapal.ai"
              className="block text-center text-primary font-medium hover:underline"
            >
              support@chapal.ai
            </a>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Sign Out
          </button>

          {/* Additional Info */}
          <p className="text-xs text-muted-foreground text-center mt-6">
            If you need immediate assistance, you can also reach us through our{' '}
            <a href="#" className="text-primary hover:underline">
              help center
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
