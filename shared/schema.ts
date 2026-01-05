import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // Simple for MVP
  streak: integer("streak").default(0).notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  lastDailyQuestAt: timestamp("last_daily_quest_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  sector: text("sector"),
  lastPrice: text("last_price"), // stored as string to avoid float precision issues or just for display
  changePercent: text("change_percent"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily quests for users
export const quests = pgTable("quests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // User specific quests for simplicity in MVP
  type: text("type").notNull(), // 'term', 'pattern', 'news'
  question: text("question").notNull(),
  options: jsonb("options").notNull(), // Array of strings
  correctAnswer: integer("correct_answer").notNull(), // Index of correct option
  explanation: text("explanation"),
  xpReward: integer("xp_reward").default(10).notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Watchlist
export const userStocks = pgTable("user_stocks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: text("symbol").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

// === SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, streak: true, xp: true, level: true, lastDailyQuestAt: true, createdAt: true });
export const insertStockSchema = createInsertSchema(stocks).omit({ id: true, updatedAt: true });
export const insertQuestSchema = createInsertSchema(quests).omit({ id: true, isCompleted: true, createdAt: true });
export const insertUserStockSchema = createInsertSchema(userStocks).omit({ id: true, addedAt: true });

// === TYPES ===

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;

export type Quest = typeof quests.$inferSelect;
export type InsertQuest = z.infer<typeof insertQuestSchema>;

export type UserStock = typeof userStocks.$inferSelect;
export type InsertUserStock = z.infer<typeof insertUserStockSchema>;

// === API TYPES ===

export type StockResponse = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  name?: string;
};

export type QuestResponse = Quest;
export type UserResponse = User;

export type CompleteQuestRequest = {
  answerIndex: integer;
};

export type CreateUserRequest = InsertUser;
