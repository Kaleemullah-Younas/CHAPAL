import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { auth } from "@/lib/auth";

const createContext = async (req: Request) => {
    const session = await auth.api.getSession({
        headers: req.headers,
    });
    return {
        session,
    };
};

const handler = (req: Request) =>
    fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext: () => createContext(req),
    });

export { handler as GET, handler as POST };
export type Context = Awaited<ReturnType<typeof createContext>>;
