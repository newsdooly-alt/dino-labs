import { z } from 'zod';
import { insertUserSchema, insertUserStockSchema, users, quests, stocks, userStocks } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  // User Management
  users: {
    get: {
      method: 'GET' as const,
      path: '/api/users/:id',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    // For MVP, we might just have a "get current user" or "login" helper
    // Simplified: Just use ID 1 for everything in MVP or simple auth
    create: {
      method: 'POST' as const,
      path: '/api/users',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    updateStreak: {
        method: 'POST' as const,
        path: '/api/users/:id/streak',
        responses: {
            200: z.custom<typeof users.$inferSelect>(),
        }
    }
  },

  // Stock Market Data
  stocks: {
    search: {
      method: 'GET' as const,
      path: '/api/stocks/search',
      input: z.object({ query: z.string() }),
      responses: {
        200: z.array(z.custom<typeof stocks.$inferSelect>()), // Returns simple list
      },
    },
    quote: {
      method: 'GET' as const,
      path: '/api/stocks/:symbol/quote',
      responses: {
        200: z.object({
          symbol: z.string(),
          price: z.number(),
          change: z.number(),
          changePercent: z.number(),
          name: z.string().optional(),
        }),
        404: errorSchemas.notFound,
      },
    },
  },

  // Quests (Daily)
  quests: {
    list: {
      method: 'GET' as const,
      path: '/api/quests', // Gets daily quests for user (implied user or query param)
      input: z.object({ userId: z.coerce.number() }),
      responses: {
        200: z.array(z.custom<typeof quests.$inferSelect>()),
      },
    },
    complete: {
      method: 'POST' as const,
      path: '/api/quests/:id/complete',
      input: z.object({ answerIndex: z.number(), userId: z.number() }),
      responses: {
        200: z.object({
            success: z.boolean(),
            xpGained: z.number(),
            correct: z.boolean(),
            explanation: z.string().optional(),
            newStreak: z.number().optional(),
            newLevel: z.number().optional()
        }),
        404: errorSchemas.notFound,
      },
    },
    generate: { // Admin or dev trigger, or auto-triggered on get
        method: 'POST' as const,
        path: '/api/quests/generate',
        input: z.object({ userId: z.number() }),
        responses: {
            200: z.array(z.custom<typeof quests.$inferSelect>()),
        }
    }
  },

  // Watchlist
  watchlist: {
    list: {
      method: 'GET' as const,
      path: '/api/watchlist',
      input: z.object({ userId: z.coerce.number() }),
      responses: {
        200: z.array(z.custom<typeof stocks.$inferSelect>()),
      },
    },
    add: {
      method: 'POST' as const,
      path: '/api/watchlist',
      input: insertUserStockSchema,
      responses: {
        201: z.custom<typeof userStocks.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    remove: {
      method: 'DELETE' as const,
      path: '/api/watchlist/:symbol', // Using symbol for easier access
      input: z.object({ userId: z.coerce.number() }).optional(), // passed as query
      responses: {
        204: z.void(),
      },
    },
  },
};

// ============================================
// HELPER
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// ============================================
// TYPES
// ============================================
export type StockQuote = z.infer<typeof api.stocks.quote.responses[200]>;
export type QuestCompleteResponse = z.infer<typeof api.quests.complete.responses[200]>;
