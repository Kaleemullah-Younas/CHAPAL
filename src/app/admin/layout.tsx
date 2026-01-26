import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin - CHAPAL',
  description: 'CHAPAL Admin Dashboard',
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
