"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage({ type: "", text: "" });

        try {
            const { error } = await (authClient as any).forgetPassword({
                email,
                redirectTo: "/reset-password",
            });

            if (error) {
                setMessage({ type: "error", text: error.message || "Failed to send reset email" });
            } else {
                setMessage({ type: "success", text: "Check your email for the reset link" });
                setEmail(""); // Clear input
            }
        } catch {
            setMessage({ type: "error", text: "An unexpected error occurred" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-sm">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground">Forgot Password</h2>
                    <p className="mt-2 text-muted-foreground">
                        Enter your email to receive a password reset link
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {message.text && (
                        <div className={`rounded-lg p-3 text-sm ${message.type === "error" ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600"}`}>
                            {message.text}
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground placeholder-muted-foreground outline-none transition-all duration-300 focus:border-foreground focus:ring-1 focus:ring-foreground"
                            placeholder="you@example.com"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex h-12 w-full items-center justify-center rounded-xl bg-primary font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                        {isSubmitting ? "Sending..." : "Send Reset Link"}
                    </button>

                    <div className="text-center">
                        <Link href="/signin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                            Back to Sign In
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
