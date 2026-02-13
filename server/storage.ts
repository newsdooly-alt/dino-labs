import { db } from "./db";
import { eq, sql, and, desc } from "drizzle-orm";
import { 
  userProfiles, stocks, quests, userStocks, clubs, clubMembers, dinoEggs,
  type UserProfile, type InsertUserProfile, type Stock, type InsertStock, 
  type Quest, type InsertQuest, type UserStock, type InsertUserStock,
  type Club, type InsertClub, type DinoEgg, type InsertDinoEgg
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";

export interface IStorage {
  // Users (auth)
  getUser(id: string): Promise<User | undefined>;
  
  // User Profiles
  getUserProfile(id: string): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserStats(id: string, streak: number, xp: number, level: number, hearts: number): Promise<UserProfile>;
  addXp(id: string, xpAmount: number): Promise<UserProfile>;
  updateUserLanguage(id: string, language: string): Promise<UserProfile>;
  updateSkillLevel(id: string, skillLevel: string): Promise<UserProfile>;
  replenishHearts(id: string, amount: number): Promise<UserProfile>;
  updateFavoriteStocks(id: string, stocks: string[]): Promise<UserProfile>;
  updateNickname(id: string, nickname: string): Promise<UserProfile>;
  updateThemeColor(id: string, themeColor: string): Promise<UserProfile>;
  updateProfileSettings(id: string, settings: { nickname?: string; themeColor?: string }): Promise<UserProfile>;
  getLeaderboard(limit?: number): Promise<UserProfile[]>;

  // Stocks
  getStockBySymbol(symbol: string): Promise<Stock | undefined>;
  createStock(stock: InsertStock): Promise<Stock>;
  updateStockPrice(id: number, price: string, change: string): Promise<Stock>;
  updateStockName(symbol: string, name: string): Promise<void>;
  getAllStocks(): Promise<Stock[]>;
  searchStocks(query: string): Promise<Stock[]>;

  // Quests
  getQuests(userId: string): Promise<Quest[]>;
  createQuest(quest: InsertQuest): Promise<Quest>;
  completeQuest(id: number, userId: string): Promise<Quest>;
  clearQuests(userId: string): Promise<void>;
  
  // Watchlist
  getWatchlist(userId: string): Promise<UserStock[]>;
  addToWatchlist(userId: string, symbol: string): Promise<UserStock>;
  removeFromWatchlist(userId: string, symbol: string): Promise<void>;

  // Clubs
  getClubs(): Promise<Club[]>;
  getClubById(id: number): Promise<Club | undefined>;
  createClub(club: InsertClub, creatorId: string): Promise<Club>;
  joinClub(userId: string, clubId: number): Promise<void>;
  getUserClubs(userId: string): Promise<Club[]>;

  // Dino Eggs
  getUserEggs(userId: string): Promise<DinoEgg[]>;
  createEgg(egg: InsertDinoEgg): Promise<DinoEgg>;
  hatchEgg(id: number, userId: string): Promise<DinoEgg>;
}

export class DatabaseStorage implements IStorage {
  // Users (auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // User Profiles
  async getUserProfile(id: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.id, id));
    return profile;
  }

  async createUserProfile(insertProfile: InsertUserProfile): Promise<UserProfile> {
    const [profile] = await db.insert(userProfiles).values(insertProfile).returning();
    return profile;
  }

  async upsertUserProfile(profileData: InsertUserProfile & { skillLevel?: string }): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values({
        ...profileData,
        skillLevel: profileData.skillLevel || "beginner",
      })
      .onConflictDoUpdate({
        target: userProfiles.id,
        set: {
          nickname: profileData.nickname,
          language: profileData.language,
          skillLevel: profileData.skillLevel,
        },
      })
      .returning();
    return profile;
  }

  async updateUserStats(id: string, streak: number, xp: number, level: number, hearts: number, xpGained?: number): Promise<UserProfile> {
    const setData: any = { streak, xp, level, hearts };
    if (xpGained && xpGained > 0) {
      setData.totalXp = sql`${userProfiles.totalXp} + ${xpGained}`;
    }
    const [profile] = await db.update(userProfiles)
      .set(setData)
      .where(eq(userProfiles.id, id))
      .returning();
    return profile;
  }

  async addXp(id: string, xpAmount: number): Promise<UserProfile> {
    const [profile] = await db.update(userProfiles)
      .set({
        xp: sql`${userProfiles.xp} + ${xpAmount}`,
        totalXp: sql`${userProfiles.totalXp} + ${xpAmount}`,
      })
      .where(eq(userProfiles.id, id))
      .returning();
    return profile;
  }

  async updateUserLanguage(id: string, language: string): Promise<UserProfile> {
    const [profile] = await db.update(userProfiles)
      .set({ language })
      .where(eq(userProfiles.id, id))
      .returning();
    return profile;
  }

  async updateSkillLevel(id: string, skillLevel: string): Promise<UserProfile> {
    const [profile] = await db.update(userProfiles)
      .set({ skillLevel })
      .where(eq(userProfiles.id, id))
      .returning();
    return profile;
  }

  async replenishHearts(id: string, amount: number): Promise<UserProfile> {
    const [profile] = await db.update(userProfiles)
      .set({ hearts: sql`${userProfiles.hearts} + ${amount}` })
      .where(eq(userProfiles.id, id))
      .returning();
    return profile;
  }

  async updateFavoriteStocks(id: string, favoriteStocks: string[]): Promise<UserProfile> {
    const [profile] = await db.update(userProfiles)
      .set({ favoriteStocks })
      .where(eq(userProfiles.id, id))
      .returning();
    return profile;
  }

  async updateNickname(id: string, nickname: string): Promise<UserProfile> {
    const [profile] = await db.update(userProfiles)
      .set({ nickname })
      .where(eq(userProfiles.id, id))
      .returning();
    return profile;
  }

  async updateThemeColor(id: string, themeColor: string): Promise<UserProfile> {
    const [profile] = await db.update(userProfiles)
      .set({ themeColor })
      .where(eq(userProfiles.id, id))
      .returning();
    return profile;
  }

  async updateProfileSettings(id: string, settings: { nickname?: string; themeColor?: string }): Promise<UserProfile> {
    const updateData: any = {};
    if (settings.nickname !== undefined) updateData.nickname = settings.nickname;
    if (settings.themeColor !== undefined) updateData.themeColor = settings.themeColor;
    const [profile] = await db.update(userProfiles)
      .set(updateData)
      .where(eq(userProfiles.id, id))
      .returning();
    return profile;
  }

  async getLeaderboard(limit: number = 50): Promise<UserProfile[]> {
    return db.select().from(userProfiles)
      .where(sql`${userProfiles.id} NOT LIKE 'bot_%'`)
      .orderBy(desc(userProfiles.totalXp))
      .limit(limit);
  }

  // Stocks
  async getStockBySymbol(symbol: string): Promise<Stock | undefined> {
    const [stock] = await db.select().from(stocks).where(eq(stocks.symbol, symbol));
    return stock;
  }

  async createStock(insertStock: InsertStock): Promise<Stock> {
    const [stock] = await db.insert(stocks).values(insertStock).returning();
    return stock;
  }

  async updateStockPrice(id: number, price: string, change: string): Promise<Stock> {
    const [stock] = await db.update(stocks)
        .set({ lastPrice: price, changePercent: change, updatedAt: new Date() })
        .where(eq(stocks.id, id))
        .returning();
    return stock;
  }

  async updateStockName(symbol: string, name: string): Promise<void> {
    await db.update(stocks)
        .set({ name })
        .where(eq(stocks.symbol, symbol));
  }

  async getAllStocks(): Promise<Stock[]> {
      return await db.select().from(stocks);
  }

  async searchStocks(query: string): Promise<Stock[]> {
    return await db.select().from(stocks)
        .where(sql`lower(${stocks.symbol}) like ${`%${query.toLowerCase()}%`} OR lower(${stocks.name}) like ${`%${query.toLowerCase()}%`}`)
        .limit(10);
  }

  // Quests
  async getQuests(userId: string): Promise<Quest[]> {
    return await db.select().from(quests)
        .where(eq(quests.userId, userId))
        .orderBy(quests.createdAt);
  }

  async createQuest(insertQuest: InsertQuest): Promise<Quest> {
    const [quest] = await db.insert(quests).values(insertQuest).returning();
    return quest;
  }

  async completeQuest(id: number, userId: string): Promise<Quest> {
    const [quest] = await db.update(quests)
        .set({ isCompleted: true })
        .where(eq(quests.id, id))
        .returning();
    return quest;
  }

  async clearQuests(userId: string): Promise<void> {
    await db.delete(quests).where(eq(quests.userId, userId));
  }

  // Watchlist
  async getWatchlist(userId: string): Promise<UserStock[]> {
    return await db.select().from(userStocks).where(eq(userStocks.userId, userId));
  }

  async addToWatchlist(userId: string, symbol: string): Promise<UserStock> {
    const existing = await db.select().from(userStocks)
        .where(and(eq(userStocks.userId, userId), eq(userStocks.symbol, symbol)));
    if (existing.length > 0) return existing[0];
    const [item] = await db.insert(userStocks).values({ userId, symbol }).returning();
    return item;
  }

  async removeFromWatchlist(userId: string, symbol: string): Promise<void> {
    await db.delete(userStocks)
        .where(and(eq(userStocks.userId, userId), eq(userStocks.symbol, symbol)));
  }

  // Clubs
  async getClubs(): Promise<Club[]> {
    return await db.select().from(clubs).orderBy(desc(clubs.memberCount));
  }

  async getClubById(id: number): Promise<Club | undefined> {
    const [club] = await db.select().from(clubs).where(eq(clubs.id, id));
    return club;
  }

  async createClub(insertClub: InsertClub, creatorId: string): Promise<Club> {
    const [club] = await db.insert(clubs).values(insertClub).returning();
    await db.insert(clubMembers).values({ clubId: club.id, userId: creatorId });
    return club;
  }

  async joinClub(userId: string, clubId: number): Promise<void> {
    const existing = await db.select().from(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)));
    if (existing.length === 0) {
      await db.insert(clubMembers).values({ clubId, userId });
      await db.update(clubs).set({ memberCount: sql`${clubs.memberCount} + 1` }).where(eq(clubs.id, clubId));
    }
  }

  async getUserClubs(userId: string): Promise<Club[]> {
    const memberships = await db.select().from(clubMembers).where(eq(clubMembers.userId, userId));
    const clubIds = memberships.map(m => m.clubId);
    if (clubIds.length === 0) return [];
    return await db.select().from(clubs).where(sql`${clubs.id} IN ${clubIds}`);
  }

  // Dino Eggs
  async getUserEggs(userId: string): Promise<DinoEgg[]> {
    return await db.select().from(dinoEggs).where(eq(dinoEggs.userId, userId)).orderBy(dinoEggs.createdAt);
  }

  async createEgg(insertEgg: InsertDinoEgg): Promise<DinoEgg> {
    const [egg] = await db.insert(dinoEggs).values(insertEgg).returning();
    return egg;
  }

  async hatchEgg(id: number, userId: string): Promise<DinoEgg> {
    const [egg] = await db.update(dinoEggs)
      .set({ isHatched: true, hatchedAt: new Date() })
      .where(and(eq(dinoEggs.id, id), eq(dinoEggs.userId, userId)))
      .returning();
    return egg;
  }
}

export const storage = new DatabaseStorage();
