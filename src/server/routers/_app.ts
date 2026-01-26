import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

import { testRouter } from './testing';
import { adminRouter } from './admin';
import { chatRouter } from './chat';

export const appRouter = router({
  test: testRouter,
  admin: adminRouter,
  chat: chatRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
