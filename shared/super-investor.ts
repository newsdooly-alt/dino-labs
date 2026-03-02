import { z } from "zod";

export const INVESTOR_CATEGORIES = ["value", "growth", "macro", "hedge", "activist", "sovereign", "index"] as const;
export type InvestorCategory = typeof INVESTOR_CATEGORIES[number];

export const superInvestorSchema = z.object({
  id: z.string(),
  name: z.string(),
  firm: z.string(),
  country: z.string(),
  aum: z.number(),
  aumUnit: z.string(),
  initials: z.string(),
  avatarColor: z.string(),
  category: z.enum(INVESTOR_CATEGORIES),
  biographyEn: z.string(),
  biographyKo: z.string(),
  styleEn: z.string(),
  styleKo: z.string(),
  styleTagsEn: z.array(z.string()),
  styleTagsKo: z.array(z.string()),
  lastUpdated: z.string(),
  filingType: z.string(),
  dataSource: z.string().optional(),
  dataSourceUrl: z.string().optional(),
  sectorAllocation: z.array(z.object({
    sector: z.string(),
    weight: z.number(),
    color: z.string()
  })),
  holdings: z.array(z.object({
    ticker: z.string(),
    company: z.string(),
    sector: z.string(),
    shares: z.number(),
    weight: z.number(),
    change: z.enum(["Bought", "Sold", "Held", "New"]),
    changePct: z.number().nullable(),
    whyTheyBoughtEn: z.string(),
    whyTheyBoughtKo: z.string(),
    priceApprox: z.number().optional(),
    dataStatus: z.enum(["verified", "estimated", "verifying"]).optional(),
  }))
});

export type SuperInvestor = z.infer<typeof superInvestorSchema>;
