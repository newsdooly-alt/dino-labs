import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), 
  streak: integer("streak").default(0).notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  hearts: integer("hearts").default(5).notNull(), // Added hearts (lives)
  language: text("language").default("en").notNull(), // Added language preference
  lastDailyQuestAt: timestamp("last_daily_quest_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  sector: text("sector"),
  lastPrice: text("last_price"), 
  changePercent: text("change_percent"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quests = pgTable("quests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), 
  type: text("type").notNull(), 
  question: text("question").notNull(),
  options: jsonb("options").notNull(), 
  correctAnswer: integer("correct_answer").notNull(), 
  explanation: text("explanation"),
  xpReward: integer("xp_reward").default(10).notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userStocks = pgTable("user_stocks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: text("symbol").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

// Social Clubs
export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  topic: text("topic").notNull(), // Stock symbol or general topic
  memberCount: integer("member_count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Club Memberships
export const clubMembers = pgTable("club_members", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull().references(() => clubs.id),
  userId: integer("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// === SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, streak: true, xp: true, level: true, hearts: true, lastDailyQuestAt: true, createdAt: true });
export const insertStockSchema = createInsertSchema(stocks).omit({ id: true, updatedAt: true });
export const insertQuestSchema = createInsertSchema(quests).omit({ id: true, isCompleted: true, createdAt: true });
export const insertUserStockSchema = createInsertSchema(userStocks).omit({ id: true, addedAt: true });
export const insertClubSchema = createInsertSchema(clubs).omit({ id: true, memberCount: true, createdAt: true });

// === TYPES ===

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;

export type Quest = typeof quests.$inferSelect;
export type InsertQuest = z.infer<typeof insertQuestSchema>;

export type UserStock = typeof userStocks.$inferSelect;
export type InsertUserStock = z.infer<typeof insertUserStockSchema>;

export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;

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
  answerIndex: number;
  userId: number;
};

export type CreateUserRequest = InsertUser;
