import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../trpc";

export const testRouter = router({
    getTestMessage: publicProcedure
        .query(() => {
            return {
                message: "This is a message from the test router!",
                timestamp: new Date().toISOString(),
            };
        }),

    getSecretMessage: protectedProcedure
        .query(({ ctx }) => {
            return {
                message: `Hello ${ctx.session.user.name}, this is a protected message!`,
                user: ctx.session.user // Safe to return? usually yes for demo
            };
        })
});
