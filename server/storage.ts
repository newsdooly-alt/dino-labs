import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { 
  users, stocks, quests, userStocks,
  type User, type InsertUser, type Stock, type InsertStock, type Quest, type InsertQuest, type UserStock, type InsertUserStock
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStreak(id: number, streak: number, xp: number, level: number): Promise<User>;

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
  
  // Watchlist
  getWatchlist(userId: number): Promise<Stock[]>;
  addToWatchlist(userId: number, symbol: string): Promise<UserStock>;
  removeFromWatchlist(userId: number, symbol: string): Promise<void>;
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

  async updateUserStreak(id: number, streak: number, xp: number, level: number): Promise<User> {
      const [user] = await db.update(users)
        .set({ streak, xp, level })
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
    // Simple ilike search
    return await db.select().from(stocks)
        .where(sql`lower(${stocks.symbol}) like ${`%${query.toLowerCase()}%`} OR lower(${stocks.name}) like ${`%${query.toLowerCase()}%`}`)
        .limit(10);
  }

  // Quests
  async getQuests(userId: number): Promise<Quest[]> {
    // Get incomplete quests for the user, or quests created today
    // For MVP, just get all non-completed or recent ones
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

  // Watchlist
  async getWatchlist(userId: number): Promise<Stock[]> {
    // Join userStocks and stocks
    // This is a bit manual in drizzle without relations defined, but simple enough
    // Actually, let's just query userStocks and then get stocks. Or a join.
    // For MVP, let's assume we store minimal info or just fetch.
    // Better:
    const userStockEntries = await db.select().from(userStocks).where(eq(userStocks.userId, userId));
    const symbols = userStockEntries.map(us => us.symbol);
    
    if (symbols.length === 0) return [];
    
    return await db.select().from(stocks).where(sql`${stocks.symbol} IN ${symbols}`);
  }

  async addToWatchlist(userId: number, symbol: string): Promise<UserStock> {
    // Check if exists
    const existing = await db.select().from(userStocks)
        .where(sql`${userStocks.userId} = ${userId} AND ${userStocks.symbol} = ${symbol}`);
    
    if (existing.length > 0) return existing[0];

    const [item] = await db.insert(userStocks).values({ userId, symbol }).returning();
    return item;
  }

  async removeFromWatchlist(userId: number, symbol: string): Promise<void> {
    await db.delete(userStocks)
        .where(sql`${userStocks.userId} = ${userId} AND ${userStocks.symbol} = ${symbol}`);
  }
}

export const storage = new DatabaseStorage();
