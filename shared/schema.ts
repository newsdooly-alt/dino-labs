import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, doublePrecision } from "drizzle-orm/pg-core";
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
  totalXp: integer("total_xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  hearts: integer("hearts").default(5).notNull(),
  themeColor: text("theme_color").default("green").notNull(), // "green" | "blue" | "pink"
  favoriteStocks: text("favorite_stocks").array().default([]).notNull(),
  language: text("language").default("ko").notNull(),
  skillLevel: text("skill_level").default("beginner").notNull(), // "beginner" | "intermediate" | "advanced"
  lastDailyQuestAt: timestamp("last_daily_quest_at"),
  recentQuestTypes: text("recent_quest_types").array().default([]).notNull(),
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

// 13F Database tables — quarterly holdings snapshots
export const investorPortfolios = pgTable("investor_portfolios", {
  id: serial("id").primaryKey(),
  investorId: text("investor_id").notNull().unique(),
  cik: text("cik").notNull().default(""),
  entityName: text("entity_name").notNull().default(""),
  reportDate: text("report_date").notNull().default(""),
  filingDate: text("filing_date").notNull().default(""),
  lastSynced: timestamp("last_synced").defaultNow().notNull(),
  totalValueUSD: doublePrecision("total_value_usd").notNull().default(0),
  holdingCount: integer("holding_count").notNull().default(0),
});

export const investorHoldings = pgTable("investor_holdings", {
  id: serial("id").primaryKey(),
  investorId: text("investor_id").notNull(),
  rank: integer("rank").notNull(),
  ticker: text("ticker").notNull().default(""),
  cusip: text("cusip").notNull().default(""),
  companyName: text("company_name").notNull(),
  shares: doublePrecision("shares").notNull().default(0),
  valueUSD: doublePrecision("value_usd").notNull().default(0),
  weight: doublePrecision("weight").notNull().default(0),
  putCall: text("put_call").notNull().default(""),
});

// Mock Portfolio Holdings
export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull().default(""),
  shares: doublePrecision("shares").notNull().default(0),
  avgCost: doublePrecision("avg_cost").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  sector: text("sector").notNull().default(""),
  addedAt: timestamp("added_at").defaultNow(),
});

// === SCHEMAS ===

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ streak: true, xp: true, totalXp: true, level: true, hearts: true, lastDailyQuestAt: true, createdAt: true });
export const insertStockSchema = createInsertSchema(stocks).omit({ id: true, updatedAt: true });
export const insertQuestSchema = createInsertSchema(quests).omit({ id: true, isCompleted: true, createdAt: true });
export const insertUserStockSchema = createInsertSchema(userStocks).omit({ id: true, addedAt: true });
export const insertClubSchema = createInsertSchema(clubs).omit({ id: true, memberCount: true, createdAt: true });
export const insertPredictionSchema = createInsertSchema(predictions).omit({ id: true, status: true, createdAt: true, resolvedAt: true });
export const insertDinoEggSchema = createInsertSchema(dinoEggs).omit({ id: true, isHatched: true, hatchedAt: true, createdAt: true });
export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldings).omit({ id: true, addedAt: true });

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

export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type InsertPortfolioHolding = z.infer<typeof insertPortfolioHoldingSchema>;

export type InvestorPortfolio = typeof investorPortfolios.$inferSelect;
export type InvestorHolding = typeof investorHoldings.$inferSelect;

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
