import { z } from "zod";
import { publicProcedure, router } from "../trpc";

import { testRouter } from "./testing";

export const appRouter = router({
    test: testRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
