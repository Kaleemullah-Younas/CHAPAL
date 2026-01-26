"use client";

import { useEffect, useState, Suspense } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const router = useRouter();
    const { data: session } = useSession();

    const [status, setStatus] = useState<"verifying" | "success" | "error" | "waiting">("waiting");
    const [message, setMessage] = useState("");
    const [isResending, setIsResending] = useState(false);
    const [resendStatus, setResendStatus] = useState("");

    useEffect(() => {
        if (token) {
            setStatus("verifying");
            const verify = async () => {
                try {
                    const { error } = await authClient.verifyEmail({
                        query: { token }
                    });

                    if (error) {
                        setStatus("error");
                        setMessage(error.message || "Failed to verify email");
                    } else {
                        setStatus("success");
                        setTimeout(() => router.push("/"), 2000);
                    }
                } catch {
                    setStatus("error");
                    setMessage("An unexpected error occurred");
                }
            };
            verify();
        } else {
            // No token. If we are here, middleware sent us here (unverified)
            // Show "Please verify your email" UI.
            setStatus("error"); // Re-using error state or waiting state?
            setMessage("Please verify your email address to continue.");
        }
    }, [token, router]);

    const handleResendEmail = async () => {
        if (!session?.user?.email) return;

        setIsResending(true);
        setResendStatus("");

        try {
            const { error } = await authClient.sendVerificationEmail({
                email: session.user.email,
                callbackURL: "/verify-email" // Ensure it redirects back here with token
            });

            if (error) {
                setResendStatus(error.message || "Failed to send email");
            } else {
                setResendStatus("Email sent! Check your inbox.");
            }
        } catch {
            setResendStatus("Error sending email");
        } finally {
            setIsResending(false);
        }
    };

    // Redirect if verified (handled by middleware but good for client-side too)
    useEffect(() => {
        if (session?.user?.emailVerified && !token) {
            router.push("/");
        }
    }, [session, token, router]);

    if (status === "verifying") {
        return (
            <div className="flex flex-col items-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
                <p className="text-muted-foreground">Verifying your email...</p>
            </div>
        );
    }

    if (status === "success") {
        return (
            <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                    <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-foreground">Email Verified!</h2>
                <p className="text-muted-foreground">Redirecting you to the dashboard...</p>
            </div>
        );
    }

    // Default view (No token / Error)
    return (
        <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                <svg className="h-8 w-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            </div>

            <div>
                <h2 className="text-2xl font-bold text-foreground">Verify your Email</h2>
                <p className="mt-2 text-muted-foreground">
                    {token ? message : "You need to verify your email address to access the account."}
                </p>
                {session?.user?.email && (
                    <p className="mt-1 text-sm font-medium text-foreground">
                        Sent to: {session.user.email}
                    </p>
                )}
            </div>

            {session ? (
                <div className="space-y-4">
                    {resendStatus && (
                        <div className={`text-sm ${resendStatus.includes("sent") ? "text-green-600" : "text-red-500"}`}>
                            {resendStatus}
                        </div>
                    )}

                    <button
                        onClick={handleResendEmail}
                        disabled={isResending}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                    >
                        {isResending ? "Sending..." : "Resend Verification Email"}
                    </button>

                    <div>
                        <button
                            onClick={async () => {
                                await authClient.signOut();
                                router.push("/signin");
                            }}
                            className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            ) : (
                <div>
                    <button
                        onClick={async () => {
                            await authClient.signOut();
                            router.push("/signin");
                        }}
                        className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 cursor-pointer"
                    >
                        Back to Sign In
                    </button>
                </div>
            )}
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
                <Suspense fallback={<div className="text-center">Loading...</div>}>
                    <VerifyEmailContent />
                </Suspense>
            </div>
        </div>
    );
}
