import { z } from 'zod';
import { insertUserProfileSchema, insertUserStockSchema, insertClubSchema, userProfiles, quests, stocks, userStocks, clubs } from './schema';

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
  // User Profiles
  profiles: {
    get: {
      method: 'GET' as const,
      path: '/api/profiles/me',
      responses: {
        200: z.custom<typeof userProfiles.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    updateStats: {
        method: 'POST' as const,
        path: '/api/profiles/stats',
        input: z.object({ streak: z.number(), xp: z.number(), level: z.number(), hearts: z.number() }),
        responses: {
            200: z.custom<typeof userProfiles.$inferSelect>(),
        }
    },
    replenishHearts: {
      method: 'POST' as const,
      path: '/api/profiles/hearts/replenish',
      input: z.object({ amount: z.number() }),
      responses: {
        200: z.custom<typeof userProfiles.$inferSelect>(),
      }
    },
    updateLanguage: {
      method: 'PATCH' as const,
      path: '/api/profiles/language',
      input: z.object({ language: z.enum(['en', 'ko', 'ja']) }),
      responses: {
        200: z.custom<typeof userProfiles.$inferSelect>(),
      }
    }
  },

  // Legacy user routes (for compatibility)
  users: {
    get: {
      method: 'GET' as const,
      path: '/api/users/:id',
      responses: {
        200: z.custom<typeof userProfiles.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    updateStats: {
        method: 'POST' as const,
        path: '/api/users/:id/stats',
        input: z.object({ streak: z.number(), xp: z.number(), level: z.number(), hearts: z.number() }),
        responses: {
            200: z.custom<typeof userProfiles.$inferSelect>(),
        }
    },
    replenishHearts: {
      method: 'POST' as const,
      path: '/api/users/:id/hearts/replenish',
      input: z.object({ amount: z.number() }),
      responses: {
        200: z.custom<typeof userProfiles.$inferSelect>(),
      }
    },
    updateLanguage: {
      method: 'PATCH' as const,
      path: '/api/users/:id/language',
      input: z.object({ language: z.enum(['en', 'ko', 'ja']) }),
      responses: {
        200: z.custom<typeof userProfiles.$inferSelect>(),
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
        200: z.array(z.custom<typeof stocks.$inferSelect>()),
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
      path: '/api/quests',
      responses: {
        200: z.array(z.custom<typeof quests.$inferSelect>()),
      },
    },
    complete: {
      method: 'POST' as const,
      path: '/api/quests/:id/complete',
      input: z.object({ answerIndex: z.number() }),
      responses: {
        200: z.object({
            success: z.boolean(),
            xpGained: z.number(),
            correct: z.boolean(),
            explanation: z.string().optional(),
            newStreak: z.number().optional(),
            newLevel: z.number().optional(),
            newHearts: z.number().optional()
        }),
        404: errorSchemas.notFound,
      },
    },
  },

  // Watchlist
  watchlist: {
    list: {
      method: 'GET' as const,
      path: '/api/watchlist',
      responses: {
        200: z.array(z.custom<typeof userStocks.$inferSelect>()),
      },
    },
    add: {
      method: 'POST' as const,
      path: '/api/watchlist',
      input: z.object({ symbol: z.string() }),
      responses: {
        201: z.custom<typeof userStocks.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    remove: {
      method: 'DELETE' as const,
      path: '/api/watchlist/:symbol',
      responses: {
        204: z.void(),
      },
    },
  },

  // Social Clubs
  clubs: {
    list: {
      method: 'GET' as const,
      path: '/api/clubs',
      responses: {
        200: z.array(z.custom<typeof clubs.$inferSelect>()),
      },
    },
    getUserClubs: {
      method: 'GET' as const,
      path: '/api/users/:id/clubs',
      responses: {
        200: z.array(z.custom<typeof clubs.$inferSelect>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/clubs',
      input: insertClubSchema,
      responses: {
        201: z.custom<typeof clubs.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    join: {
      method: 'POST' as const,
      path: '/api/clubs/:id/join',
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
      },
    },
  }
};

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
