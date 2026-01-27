import { DocsSidebar } from '@/components/docs/DocsSidebar';

export default function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-white">
            <DocsSidebar />
            <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 lg:px-12">
                <div className="max-w-4xl">
                    {children}
                </div>
            </main>
        </div>
    );
}
