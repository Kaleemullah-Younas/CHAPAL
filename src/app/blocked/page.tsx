'use client';

import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export default function BlockedPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/signin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-rose-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        {/* Warning Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-rose-600 dark:text-rose-400"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m4.9 4.9 14.2 14.2" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Account Blocked
        </h1>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your account has been blocked by an administrator due to a violation
          of our community guidelines. If you believe this is a mistake, please
          contact our support team.
        </p>

        {/* Support Email */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Contact Support
          </p>
          <a
            href="mailto:support@chapal.ai"
            className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
          >
            support@chapal.ai
          </a>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="w-full h-12 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
