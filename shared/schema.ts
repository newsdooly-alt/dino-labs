import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";
export * from "./models/auth";

// === TABLE DEFINITIONS ===

// User game profiles - linked to auth users via id
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey(), // Links to auth users.id
  nickname: text("nickname"),
  streak: integer("streak").default(0).notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  hearts: integer("hearts").default(5).notNull(),
  favoriteStocks: text("favorite_stocks").array().default([]).notNull(),
  language: text("language").default("en").notNull(),
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
  userId: varchar("user_id").notNull(), // Now string to match auth user id
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
  userId: varchar("user_id").notNull(), // Now string to match auth user id
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
  userId: varchar("user_id").notNull(), // Now string to match auth user id
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Now string to match auth user id
  symbol: text("symbol").notNull(),
  prediction: text("prediction").notNull(), // "higher" | "lower"
  entryPrice: text("entry_price").notNull(),
  status: text("status").default("pending").notNull(), // "pending" | "won" | "lost"
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Dino Eggs - linked to user
export const dinoEggs = pgTable("dino_eggs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  dinoType: text("dino_type").notNull(),
  isHatched: boolean("is_hatched").default(false).notNull(),
  hatchedAt: timestamp("hatched_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === SCHEMAS ===

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ streak: true, xp: true, level: true, hearts: true, lastDailyQuestAt: true, createdAt: true });
export const insertStockSchema = createInsertSchema(stocks).omit({ id: true, updatedAt: true });
export const insertQuestSchema = createInsertSchema(quests).omit({ id: true, isCompleted: true, createdAt: true });
export const insertUserStockSchema = createInsertSchema(userStocks).omit({ id: true, addedAt: true });
export const insertClubSchema = createInsertSchema(clubs).omit({ id: true, memberCount: true, createdAt: true });
export const insertPredictionSchema = createInsertSchema(predictions).omit({ id: true, status: true, createdAt: true, resolvedAt: true });
export const insertDinoEggSchema = createInsertSchema(dinoEggs).omit({ id: true, isHatched: true, hatchedAt: true, createdAt: true });

// === TYPES ===

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;

export type Quest = typeof quests.$inferSelect;
export type InsertQuest = z.infer<typeof insertQuestSchema>;

export type UserStock = typeof userStocks.$inferSelect;
export type InsertUserStock = z.infer<typeof insertUserStockSchema>;

export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;

export type Prediction = typeof predictions.$inferSelect;
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;

export type DinoEgg = typeof dinoEggs.$inferSelect;
export type InsertDinoEgg = z.infer<typeof insertDinoEggSchema>;

// === API TYPES ===

export type StockResponse = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  name?: string;
};

export type QuestResponse = Quest;
export type UserProfileResponse = UserProfile;

export type CompleteQuestRequest = {
  answerIndex: number;
  userId: string;
};
