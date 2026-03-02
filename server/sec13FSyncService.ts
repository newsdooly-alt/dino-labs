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

export interface Get13FResult {
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
  isStaleData: boolean;
}

/**
 * DB-only retrieval — NEVER auto-fetches from SEC on user request.
 * Returns null if no data is in the DB yet (caller shows "sync required" state).
 * Sync is triggered exclusively via syncInvestor() / POST /api/13f-sync/:investorId.
 */
export async function getOrFetch13F(investorId: string): Promise<Get13FResult | null> {
  const portfolio = await storage.getInvestorPortfolio(investorId);

  if (!portfolio) {
    console.log(`[13F] No DB data for ${investorId} — sync required via POST /api/13f-sync/${investorId}`);
    return null;
  }

  const dbHoldings = await storage.getInvestorHoldings(investorId);
  const stale = isStale(portfolio.lastSynced);
  console.log(`[13F] DB hit for ${investorId}: ${dbHoldings.length} holdings (stale=${stale})`);

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
    source: `DB · SEC EDGAR 13F-HR (검증됨) · ${portfolio.entityName} · 보고서 기준일: ${portfolio.reportDate} · 공시 일자: ${portfolio.filingDate}`,
    fromDB: true,
    isStaleData: stale,
  };
}
