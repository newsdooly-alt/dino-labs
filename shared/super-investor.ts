import { z } from "zod";
import { translations } from "@/lib/translations";

export const superInvestorSchema = z.object({
  id: z.string(),
  name: z.string(),
  firm: z.string(),
  country: z.enum(["US", "KR"]),
  aum: z.number(),
  aumUnit: z.string(),
  initials: z.string(),
  avatarColor: z.string(),
  biographyEn: z.string(),
  biographyKo: z.string(),
  styleEn: z.string(),
  styleKo: z.string(),
  styleTagsEn: z.array(z.string()),
  styleTagsKo: z.array(z.string()),
  lastUpdated: z.string(),
  filingType: z.string(),
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
    whyTheyBoughtKo: z.string()
  }))
});

export type SuperInvestor = z.infer<typeof superInvestorSchema>;
