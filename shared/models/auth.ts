import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
// Extended to support local auth with username/password
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  username: varchar("username").unique(),
  password: varchar("password"), // bcrypt hashed password for local auth
  authType: varchar("auth_type").default("oidc"), // "oidc" | "local" | "guest"
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email().optional(),
  language: z.enum(["en", "ko", "ja"]).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

export const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
