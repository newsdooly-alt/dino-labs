import { db } from "./db";
import { eq, sql, and, desc } from "drizzle-orm";
import { 
  users, stocks, quests, userStocks, clubs, clubMembers,
  type User, type InsertUser, type Stock, type InsertStock, type Quest, type InsertQuest, type UserStock, type InsertUserStock,
  type Club, type InsertClub
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStats(id: number, streak: number, xp: number, level: number, hearts: number): Promise<User>;
  updateUserLanguage(id: number, language: string): Promise<User>;
  replenishHearts(id: number, amount: number): Promise<User>;

  // Stocks
  getStockBySymbol(symbol: string): Promise<Stock | undefined>;
  createStock(stock: InsertStock): Promise<Stock>;
  updateStockPrice(id: number, price: string, change: string): Promise<Stock>;
  getAllStocks(): Promise<Stock[]>;
  searchStocks(query: string): Promise<Stock[]>;

  // Quests
  getQuests(userId: number): Promise<Quest[]>;
  createQuest(quest: InsertQuest): Promise<Quest>;
  completeQuest(id: number, userId: number): Promise<Quest>;
  clearQuests(userId: number): Promise<void>;
  
  // Watchlist
  getWatchlist(userId: number): Promise<Stock[]>;
  addToWatchlist(userId: number, symbol: string): Promise<UserStock>;
  removeFromWatchlist(userId: number, symbol: string): Promise<void>;

  // Clubs
  getClubs(): Promise<Club[]>;
  getClubById(id: number): Promise<Club | undefined>;
  createClub(club: InsertClub, creatorId: number): Promise<Club>;
  joinClub(userId: number, clubId: number): Promise<void>;
  getUserClubs(userId: number): Promise<Club[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserStats(id: number, streak: number, xp: number, level: number, hearts: number): Promise<User> {
      const [user] = await db.update(users)
        .set({ streak, xp, level, hearts })
        .where(eq(users.id, id))
        .returning();
      return user;
  }

  async updateUserLanguage(id: number, language: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ language })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async replenishHearts(id: number, amount: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ hearts: sql`${users.hearts} + ${amount}` })
      .where(eq(users.id, id))
      .returning();
    return user;
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

  async getAllStocks(): Promise<Stock[]> {
      return await db.select().from(stocks);
  }

  async searchStocks(query: string): Promise<Stock[]> {
    return await db.select().from(stocks)
        .where(sql`lower(${stocks.symbol}) like ${`%${query.toLowerCase()}%`} OR lower(${stocks.name}) like ${`%${query.toLowerCase()}%`}`)
        .limit(10);
  }

  // Quests
  async getQuests(userId: number): Promise<Quest[]> {
    return await db.select().from(quests)
        .where(eq(quests.userId, userId))
        .orderBy(quests.createdAt);
  }

  async createQuest(insertQuest: InsertQuest): Promise<Quest> {
    const [quest] = await db.insert(quests).values(insertQuest).returning();
    return quest;
  }

  async completeQuest(id: number, userId: number): Promise<Quest> {
    const [quest] = await db.update(quests)
        .set({ isCompleted: true })
        .where(eq(quests.id, id))
        .returning();
    return quest;
  }

  async clearQuests(userId: number): Promise<void> {
    await db.delete(quests).where(eq(quests.userId, userId));
  }

  // Watchlist
  async getWatchlist(userId: number): Promise<Stock[]> {
    const userStockEntries = await db.select().from(userStocks).where(eq(userStocks.userId, userId));
    const symbols = userStockEntries.map(us => us.symbol);
    if (symbols.length === 0) return [];
    return await db.select().from(stocks).where(sql`${stocks.symbol} IN ${symbols}`);
  }

  async addToWatchlist(userId: number, symbol: string): Promise<UserStock> {
    const existing = await db.select().from(userStocks)
        .where(and(eq(userStocks.userId, userId), eq(userStocks.symbol, symbol)));
    if (existing.length > 0) return existing[0];
    const [item] = await db.insert(userStocks).values({ userId, symbol }).returning();
    return item;
  }

  async removeFromWatchlist(userId: number, symbol: string): Promise<void> {
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

  async createClub(insertClub: InsertClub, creatorId: number): Promise<Club> {
    const [club] = await db.insert(clubs).values(insertClub).returning();
    await db.insert(clubMembers).values({ clubId: club.id, userId: creatorId });
    return club;
  }

  async joinClub(userId: number, clubId: number): Promise<void> {
    const existing = await db.select().from(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)));
    if (existing.length === 0) {
      await db.insert(clubMembers).values({ clubId, userId });
      await db.update(clubs).set({ memberCount: sql`${clubs.memberCount} + 1` }).where(eq(clubs.id, clubId));
    }
  }

  async getUserClubs(userId: number): Promise<Club[]> {
    const memberships = await db.select().from(clubMembers).where(eq(clubMembers.userId, userId));
    const clubIds = memberships.map(m => m.clubId);
    if (clubIds.length === 0) return [];
    return await db.select().from(clubs).where(sql`${clubs.id} IN ${clubIds}`);
  }
}

export const storage = new DatabaseStorage();
