/**
 * 13F Database Sync Service
 *
 * Fetches 13F data from SEC EDGAR for all tracked investors and persists it
 * to the PostgreSQL database. Data is served from the DB on subsequent requests,
 * eliminating per-user API calls.
 *
 * Sync schedule: quarterly (90-day stale threshold by default)
 * On-demand sync available via POST /api/13f-sync/:investorId
 */

import { fetchLatest13F, INVESTOR_CIK_MAP } from "./sec13FService";
import { storage } from "./storage";
import type { InvestorHolding } from "@shared/schema";

const STALE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export function isStale(lastSynced: Date | null): boolean {
  if (!lastSynced) return true;
  return Date.now() - lastSynced.getTime() > STALE_MS;
}

export interface SyncResult {
  investorId: string;
  success: boolean;
  holdingCount: number;
  reportDate: string;
  filingDate: string;
  top1?: string;
  error?: string;
}

export async function syncInvestor(investorId: string): Promise<SyncResult> {
  const cik = INVESTOR_CIK_MAP[investorId];
  if (!cik) {
    return { investorId, success: false, holdingCount: 0, reportDate: "", filingDate: "", error: "No CIK mapping" };
  }

  try {
    console.log(`[13F Sync] Starting sync for ${investorId}...`);
    const data = await fetchLatest13F(investorId, cik);

    const holdings: Omit<InvestorHolding, "id">[] = data.holdings.map(h => ({
      investorId,
      rank: h.rank,
      ticker: h.ticker,
      cusip: h.cusip,
      companyName: h.company,
      shares: h.shares,
      valueUSD: h.value,
      weight: h.weight,
      putCall: h.putCall,
    }));

    await storage.replaceInvestorHoldings(investorId, holdings);
    await storage.upsertInvestorPortfolio({
      investorId,
      cik,
      entityName: data.entityName,
      reportDate: data.periodOfReport,
      filingDate: data.filingDate,
      lastSynced: new Date(),
      totalValueUSD: data.totalValueUSD,
      holdingCount: data.holdingCount,
    });

    const top1 = data.holdings[0];
    console.log(
      `[13F Sync] ✓ ${investorId}: ${data.holdingCount} holdings saved. ` +
      `#1: ${top1?.ticker || top1?.company} (${top1?.weight}%)`
    );

    return {
      investorId,
      success: true,
      holdingCount: data.holdingCount,
      reportDate: data.periodOfReport,
      filingDate: data.filingDate,
      top1: top1 ? `${top1.ticker || top1.company} (${top1.weight}%)` : undefined,
    };
  } catch (err: any) {
    console.error(`[13F Sync] ✗ ${investorId}: ${err.message}`);
    return { investorId, success: false, holdingCount: 0, reportDate: "", filingDate: "", error: err.message };
  }
}

export async function syncAll(
  investorIds?: string[],
  onProgress?: (result: SyncResult) => void,
): Promise<SyncResult[]> {
  const ids = investorIds ?? Object.keys(INVESTOR_CIK_MAP);
  const results: SyncResult[] = [];

  for (const id of ids) {
    const result = await syncInvestor(id);
    results.push(result);
    onProgress?.(result);
    await new Promise(r => setTimeout(r, 300));
  }

  return results;
}

export async function getOrFetch13F(investorId: string): Promise<{
  investorId: string;
  cik: string;
  entityName: string;
  periodOfReport: string;
  filingDate: string;
  lastSynced: string;
  totalValueUSD: number;
  holdingCount: number;
  holdings: {
    rank: number; ticker: string; cusip: string; company: string;
    value: number; shares: number; weight: number; putCall: string;
  }[];
  source: string;
  fromDB: boolean;
}> {
  const portfolio = await storage.getInvestorPortfolio(investorId);

  if (portfolio && !isStale(portfolio.lastSynced)) {
    const dbHoldings = await storage.getInvestorHoldings(investorId);
    console.log(`[13F] DB hit for ${investorId}: ${dbHoldings.length} holdings`);
    return {
      investorId,
      cik: portfolio.cik,
      entityName: portfolio.entityName,
      periodOfReport: portfolio.reportDate,
      filingDate: portfolio.filingDate,
      lastSynced: portfolio.lastSynced.toISOString(),
      totalValueUSD: portfolio.totalValueUSD,
      holdingCount: portfolio.holdingCount,
      holdings: dbHoldings.map(h => ({
        rank: h.rank,
        ticker: h.ticker,
        cusip: h.cusip,
        company: h.companyName,
        value: h.valueUSD,
        shares: h.shares,
        weight: h.weight,
        putCall: h.putCall,
      })),
      source: `DB · SEC EDGAR 13F-HR · ${portfolio.entityName} · Period: ${portfolio.reportDate} · Filed: ${portfolio.filingDate}`,
      fromDB: true,
    };
  }

  console.log(`[13F] DB miss or stale for ${investorId}, fetching from SEC EDGAR...`);
  const syncResult = await syncInvestor(investorId);
  if (!syncResult.success) {
    throw new Error(syncResult.error || "Failed to fetch from SEC EDGAR");
  }

  const portfolio2 = await storage.getInvestorPortfolio(investorId);
  const dbHoldings = await storage.getInvestorHoldings(investorId);

  return {
    investorId,
    cik: portfolio2?.cik ?? "",
    entityName: portfolio2?.entityName ?? investorId,
    periodOfReport: portfolio2?.reportDate ?? "",
    filingDate: portfolio2?.filingDate ?? "",
    lastSynced: (portfolio2?.lastSynced ?? new Date()).toISOString(),
    totalValueUSD: portfolio2?.totalValueUSD ?? 0,
    holdingCount: portfolio2?.holdingCount ?? dbHoldings.length,
    holdings: dbHoldings.map(h => ({
      rank: h.rank,
      ticker: h.ticker,
      cusip: h.cusip,
      company: h.companyName,
      value: h.valueUSD,
      shares: h.shares,
      weight: h.weight,
      putCall: h.putCall,
    })),
    source: `SEC EDGAR 13F-HR · ${portfolio2?.entityName ?? investorId} · Period: ${portfolio2?.reportDate} · Filed: ${portfolio2?.filingDate}`,
    fromDB: false,
  };
}
