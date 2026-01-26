"use client";

import { useState, Suspense } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const router = useRouter();

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setMessage({ type: "error", text: "Passwords do not match" });
            return;
        }

        if (!token) {
            setMessage({ type: "error", text: "Invalid or missing reset token" });
            return;
        }

        setIsSubmitting(true);
        setMessage({ type: "", text: "" });

        try {
            const { error } = await authClient.resetPassword({
                newPassword,
                token,
            });

            if (error) {
                setMessage({ type: "error", text: error.message || "Failed to reset password" });
            } else {
                setMessage({ type: "success", text: "Password reset successfully!" });
                setTimeout(() => router.push("/signin"), 2000);
            }
        } catch {
            setMessage({ type: "error", text: "An unexpected error occurred" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!token) {
        return (
            <div className="text-center">
                <p className="text-red-500 mb-4">Invalid or missing reset token.</p>
                <Link href="/forgot-password" className="text-primary hover:underline">Request a new link</Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {message.text && (
                <div className={`rounded-lg p-3 text-sm ${message.type === "error" ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600"}`}>
                    {message.text}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                    New Password
                </label>
                <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground placeholder-muted-foreground outline-none transition-all duration-300 focus:border-foreground focus:ring-1 focus:ring-foreground"
                    placeholder="••••••••"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Confirm Password
                </label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground placeholder-muted-foreground outline-none transition-all duration-300 focus:border-foreground focus:ring-1 focus:ring-foreground"
                    placeholder="••••••••"
                />
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-primary font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
                {isSubmitting ? "Resetting..." : "Reset Password"}
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-sm">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground">Reset Password</h2>
                </div>
                <Suspense fallback={<div className="text-center">Loading...</div>}>
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </div>
    );
}
