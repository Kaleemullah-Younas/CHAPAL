import { betterFetch } from "@better-fetch/fetch";
import { NextResponse, type NextRequest } from "next/server";
import type { Session } from "better-auth/types";

export default async function authMiddleware(request: NextRequest) {
    const { data: sessionData } = await betterFetch<{ session: Session, user: any }>("/api/auth/get-session", {
        baseURL: request.nextUrl.origin,
        headers: {
            // get the cookie from the request
            cookie: request.headers.get("cookie") || "",
        },
    });

    const isAuthPage = ["/signin", "/signup", "/verify-email", "/forgot-password", "/reset-password"].some(path => request.nextUrl.pathname.startsWith(path));
    const isPublicPage = request.nextUrl.pathname === "/"; // Landing page

    if (!sessionData && !isAuthPage && !isPublicPage) {
        return NextResponse.redirect(new URL("/signin", request.url));
    }

    if (sessionData) {
        // Enforce Email Verification
        if (!sessionData.user.emailVerified && !request.nextUrl.pathname.startsWith("/verify-email") && !request.nextUrl.pathname.startsWith("/api")) {
            return NextResponse.redirect(new URL("/verify-email", request.url));
        }

        // If logged in and on auth page, redirect to dashboard
        // Also redirect FROM /verify-email if ALREADY verified (and not verifying via token?) 
        // Actually if they have a token, we might want to let them stay? 
        // But the user asked "if user is verified, /verify-email should redirect to /"
        if (sessionData.user.emailVerified && request.nextUrl.pathname.startsWith("/verify-email")) {
            // Exception: If processing a token, they might want to see "Verified!"? 
            // But usually if verified, they are good.
            return NextResponse.redirect(new URL("/", request.url));
        }

        if (isAuthPage && !request.nextUrl.pathname.startsWith("/reset-password") && !request.nextUrl.pathname.startsWith("/verify-email")) {
            return NextResponse.redirect(new URL("/", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
