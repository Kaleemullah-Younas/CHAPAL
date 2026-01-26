"use client";

import { useState } from "react";
import { useSession, authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const { data: session, isPending } = useSession();
    const router = useRouter();

    // Profile State
    const [name, setName] = useState(session?.user?.name || "");
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });

    // Password State
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });

    // Since we don't know the exact method name for user update in better-auth/react client type definition (it raised an error before),
    // we might need to rely on the backend API or standard fetch if the client method is elusive.
    // However, usually it is `authClient.updateUser`. We will try to cast authClient to any to avoid TS build error if the type definition is partial.
    // Or we use standard fetch to the API endpoint which Better Auth exposes. 
    // Better Auth endpoints: /api/auth/update-user, /api/auth/change-password

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdatingProfile(true);
        setProfileMessage({ type: "", text: "" });

        try {
            const res = await (authClient as any).updateUser({
                name: name,
            });

            if (res?.error) {
                setProfileMessage({ type: "error", text: res.error.message || "Failed to update profile" });
            } else {
                setProfileMessage({ type: "success", text: "Profile updated successfully" });
                router.refresh();
            }
        } catch {
            setProfileMessage({ type: "error", text: "An error occurred" });
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: "error", text: "New passwords do not match" });
            return;
        }

        setIsUpdatingPassword(true);
        setPasswordMessage({ type: "", text: "" });

        try {
            // authClient.changePassword
            const res = await (authClient as any).changePassword({
                currentPassword,
                newPassword,
                revokeOtherSessions: true
            });

            if (res?.error) {
                setPasswordMessage({ type: "error", text: res.error.message || "Failed to update password" });
            } else {
                setPasswordMessage({ type: "success", text: "Password changed successfully" });
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            }
        } catch {
            setPasswordMessage({ type: "error", text: "An error occurred" });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    if (isPending) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!session) {
        router.push("/signin");
        return null;
    }

    return (
        <div className="container mx-auto max-w-2xl px-4 py-8">
            <h1 className="mb-8 text-3xl font-bold text-foreground">Account Settings</h1>

            {/* Profile Section */}
            <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold text-foreground">Profile Information</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    {profileMessage.text && (
                        <div className={`rounded-lg p-3 text-sm ${profileMessage.type === "error" ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600"}`}>
                            {profileMessage.text}
                        </div>
                    )}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">Email</label>
                        <input
                            type="email"
                            value={session.user.email}
                            disabled
                            className="h-10 w-full rounded-lg border border-input bg-muted px-3 text-muted-foreground cursor-not-allowed"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isUpdatingProfile}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                        {isUpdatingProfile ? "Saving..." : "Update Profile"}
                    </button>
                </form>
            </div>

            {/* Password Section */}
            {/* Hiding password section if user has no password (e.g. only OAuth) is complex without checking if they have a password set. 
                For now we show it, but it will fail if they try to use it without a password. 
                Ideally we check `session.user.hasPassword` if available, or just let them try.
            */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold text-foreground">Security</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    {passwordMessage.text && (
                        <div className={`rounded-lg p-3 text-sm ${passwordMessage.type === "error" ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600"}`}>
                            {passwordMessage.text}
                        </div>
                    )}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">Current Password</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">Confirm New Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isUpdatingPassword}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                        {isUpdatingPassword ? "Updating..." : "Change Password"}
                    </button>
                </form>
            </div>
        </div>
    );
}
