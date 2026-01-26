'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useSession, signOut } from '@/lib/auth-client';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeToggle';

// Confirmation Modal Component
function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  confirmVariant = 'primary',
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  confirmVariant?: 'primary' | 'danger';
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div
          className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            confirmVariant === 'danger' ? 'bg-red-500/10' : 'bg-primary/10'
          }`}
        >
          {confirmVariant === 'danger' ? (
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          )}
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-foreground text-center mb-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-11 rounded-xl border border-input bg-background text-foreground font-medium transition-all duration-200 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 h-11 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center ${
              confirmVariant === 'danger'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            }`}
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);

  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'makeAdmin' | 'removeAdmin' | null;
    userId: string | null;
    userName: string | null;
  }>({
    isOpen: false,
    type: null,
    userId: null,
    userName: null,
  });

  // Fetch stats
  const { data: stats, isLoading: statsLoading } =
    trpc.admin.getStats.useQuery();

  // Fetch users (either search or all)
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch,
  } = isSearching && searchQuery
    ? trpc.admin.searchUsers.useQuery({
        query: searchQuery,
        page: currentPage,
        limit: 10,
      })
    : trpc.admin.getAllUsers.useQuery({ page: currentPage, limit: 10 });

  // Mutations
  const makeAdminMutation = trpc.admin.makeAdmin.useMutation({
    onSuccess: () => {
      refetch();
      closeModal();
    },
  });

  const removeAdminMutation = trpc.admin.removeAdmin.useMutation({
    onSuccess: () => {
      refetch();
      closeModal();
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setCurrentPage(1);
  };

  const openMakeAdminModal = (userId: string, userName: string) => {
    setModalState({
      isOpen: true,
      type: 'makeAdmin',
      userId,
      userName,
    });
  };

  const openRemoveAdminModal = (userId: string, userName: string) => {
    setModalState({
      isOpen: true,
      type: 'removeAdmin',
      userId,
      userName,
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      type: null,
      userId: null,
      userName: null,
    });
  };

  const handleConfirmAction = async () => {
    if (!modalState.userId) return;

    if (modalState.type === 'makeAdmin') {
      await makeAdminMutation.mutateAsync({ userId: modalState.userId });
    } else if (modalState.type === 'removeAdmin') {
      await removeAdminMutation.mutateAsync({ userId: modalState.userId });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={handleConfirmAction}
        title={
          modalState.type === 'makeAdmin'
            ? 'Grant Admin Privileges'
            : 'Remove Admin Privileges'
        }
        message={
          modalState.type === 'makeAdmin'
            ? `Are you sure you want to make ${modalState.userName} an admin? They will have full access to the admin dashboard.`
            : `Are you sure you want to remove admin privileges from ${modalState.userName}? They will lose access to the admin dashboard.`
        }
        confirmText={
          modalState.type === 'makeAdmin' ? 'Make Admin' : 'Remove Admin'
        }
        confirmVariant={
          modalState.type === 'removeAdmin' ? 'danger' : 'primary'
        }
        isLoading={makeAdminMutation.isPending || removeAdminMutation.isPending}
      />
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xl font-bold text-foreground hover:text-foreground/80 transition-all duration-300"
            >
              CHAPAL
            </Link>
            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">
              {session?.user?.name}
            </span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-24 pb-12">
        <h1 className="text-3xl font-bold text-foreground mb-8">
          Admin Dashboard
        </h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="text-sm text-muted-foreground mb-1">
              Total Users
            </div>
            <div className="text-3xl font-bold text-foreground">
              {statsLoading ? '...' : stats?.totalUsers}
            </div>
          </div>
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="text-sm text-muted-foreground mb-1">Admins</div>
            <div className="text-3xl font-bold text-foreground">
              {statsLoading ? '...' : stats?.totalAdmins}
            </div>
          </div>
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="text-sm text-muted-foreground mb-1">
              Verified Users
            </div>
            <div className="text-3xl font-bold text-green-600">
              {statsLoading ? '...' : stats?.verifiedUsers}
            </div>
          </div>
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="text-sm text-muted-foreground mb-1">
              Unverified Users
            </div>
            <div className="text-3xl font-bold text-yellow-600">
              {statsLoading ? '...' : stats?.unverifiedUsers}
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="mb-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or user ID..."
                className="h-12 w-full rounded-xl border border-input bg-background px-4 pr-24 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all duration-300"
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-20 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={!searchQuery}
              className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium transition-all duration-300 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Search
            </button>
          </form>
        </div>

        {/* Users Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                    User
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                    User ID
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                    Joined
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : usersData?.users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  usersData?.users.map(user => (
                    <tr
                      key={user.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.image ? (
                            <Image
                              src={user.image}
                              alt={user.name}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-foreground">
                              {user.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                          {user.id}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'admin'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.emailVerified
                              ? 'bg-green-500/10 text-green-600'
                              : 'bg-yellow-500/10 text-yellow-600'
                          }`}
                        >
                          {user.emailVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.id !== session?.user?.id &&
                          (user.role === 'admin' ? (
                            <button
                              onClick={() =>
                                openRemoveAdminModal(user.id, user.name)
                              }
                              disabled={removeAdminMutation.isPending}
                              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Remove Admin
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                openMakeAdminModal(user.id, user.name)
                              }
                              disabled={makeAdminMutation.isPending}
                              className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Make Admin
                            </button>
                          ))}
                        {user.id === session?.user?.id && (
                          <span className="text-sm text-muted-foreground">
                            You
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {usersData && usersData.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Page {usersData.currentPage} of {usersData.pages} (
                {usersData.total} total users)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-input bg-background hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setCurrentPage(p => Math.min(usersData.pages, p + 1))
                  }
                  disabled={currentPage === usersData.pages}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-input bg-background hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Messages */}
        {(makeAdminMutation.error || removeAdminMutation.error) && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
            {makeAdminMutation.error?.message ||
              removeAdminMutation.error?.message}
          </div>
        )}
      </main>
    </div>
  );
}
