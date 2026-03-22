import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Building2, TrendingUp, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

type OwnerTab = "insiders" | "managers" | "funds";

interface InsiderTrade {
  ticker: string;
  owner: string;
  relationship: string;
  date: string;
  transactionType: string;
  shares: number;
  price: number;
  value: number;
  filingUrl?: string;
}

interface Holder {
  holder: string;
  shares: number;
  dateReported: string;
  pctHeld: number;
  value: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
type FmtFn = (value: number | null | undefined, opts?: any) => string;

function fmtDate(d: string): string {
  if (!d || d === "nan" || d === "None") return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  } catch { return d; }
}

function txnBadge(type: string) {
  const t = type.toLowerCase();
  if (t.includes("buy") || t.includes("purchase") || t.includes("acqui"))
    return { label: type, color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
  if (t.includes("sale") || t.includes("sell") || t.includes("dispos"))
    return { label: type, color: "bg-red-500/15 text-red-600 border-red-500/30" };
  if (t.includes("option") || t.includes("exercise"))
    return { label: type, color: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
  return { label: type, color: "bg-muted text-muted-foreground border-border" };
}

// ── Row background for quick scanning ────────────────────────────────────────
function rowBg(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("buy") || t.includes("purchase") || t.includes("acqui")) return "bg-emerald-500/5";
  if (t.includes("sale") || t.includes("sell") || t.includes("dispos"))   return "bg-red-500/5";
  return "";
}

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({ id, active, icon, label, onClick }: {
  id: OwnerTab; active: boolean; icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap",
        active
          ? "border-primary text-primary bg-primary/5"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
      data-testid={`ownership-tab-${id}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ lang }: { lang: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
      <Users className="w-8 h-8 opacity-30" />
      <p className="text-sm">
        {lang === "ko" ? "데이터를 불러올 수 없습니다." : "No data available."}
      </p>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-px">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4 py-2.5 animate-pulse">
          <div className="h-4 bg-muted rounded flex-1" style={{ opacity: 1 - i * 0.1 }} />
          <div className="h-4 bg-muted rounded w-16" style={{ opacity: 1 - i * 0.1 }} />
          <div className="h-4 bg-muted rounded w-20" style={{ opacity: 1 - i * 0.1 }} />
        </div>
      ))}
    </div>
  );
}

// ── Insider table ─────────────────────────────────────────────────────────────
function InsiderTable({ trades, lang, fmtPrice, fmtVal }: {
  trades: InsiderTrade[];
  lang: string;
  fmtPrice: FmtFn;
  fmtVal: FmtFn;
}) {
  if (!trades.length) return <EmptyState lang={lang} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] min-w-[560px]">
        <thead>
          <tr className="border-b border-border/60">
            {["Date", "Name", "Role", "Type", "Shares", "Price", "Value", ""].map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {trades.map((t, i) => {
            const badge = txnBadge(t.transactionType);
            return (
              <tr key={i} className={cn("transition-colors hover:bg-muted/40", rowBg(t.transactionType))}>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(t.date)}</td>
                <td className="px-3 py-2 font-semibold text-foreground max-w-[120px] truncate" title={t.owner}>{t.owner || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-[100px] truncate" title={t.relationship}>{t.relationship || "—"}</td>
                <td className="px-3 py-2">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold", badge.color)}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-3 py-2 tabular-nums text-right">{t.shares ? t.shares.toLocaleString() : "—"}</td>
                <td className="px-3 py-2 tabular-nums text-right">
                  {t.price > 0 ? fmtPrice(t.price, { nativeCurrency: "USD" }) : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums text-right font-medium">
                  {t.value > 0 ? fmtVal(t.value, { nativeCurrency: "USD" }) : "—"}
                </td>
                <td className="px-3 py-2">
                  {t.filingUrl && t.filingUrl !== "nan" && t.filingUrl !== "None" && (
                    <a
                      href={t.filingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/70 transition-colors"
                      title="SEC Filing"
                      data-testid={`insider-filing-link-${i}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Holders table (Managers & Funds) ─────────────────────────────────────────
function HoldersTable({ holders, lang, fmtVal }: { holders: Holder[]; lang: string; fmtVal: FmtFn }) {
  if (!holders.length) return <EmptyState lang={lang} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] min-w-[420px]">
        <thead>
          <tr className="border-b border-border/60">
            {[lang === "ko" ? "기관명" : "Institution", lang === "ko" ? "보유주" : "Shares", lang === "ko" ? "비중" : "% Held", lang === "ko" ? "평가액" : "Value", lang === "ko" ? "보고일" : "Reported"].map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {holders.map((h, i) => (
            <tr key={i} className="transition-colors hover:bg-muted/40">
              <td className="px-3 py-2 font-semibold text-foreground max-w-[160px] truncate" title={h.holder}>{h.holder || "—"}</td>
              <td className="px-3 py-2 tabular-nums text-right">{h.shares ? h.shares.toLocaleString() : "—"}</td>
              <td className="px-3 py-2 tabular-nums text-right">
                <span className={cn("font-bold", h.pctHeld > 5 ? "text-primary" : "text-foreground")}>
                  {h.pctHeld ? `${h.pctHeld.toFixed(2)}%` : "—"}
                </span>
              </td>
              <td className="px-3 py-2 tabular-nums text-right">
                {h.value > 0 ? fmtVal(h.value, { nativeCurrency: "USD" }) : "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(h.dateReported)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OwnershipPanel({ symbol, lang }: { symbol: string; lang: string }) {
  const { formatPrice, formatMarketCap } = useCurrency();
  const [tab, setTab] = useState<OwnerTab>("insiders");
  const L = (ko: string, en: string, ja?: string) =>
    lang === "ko" ? ko : lang === "ja" ? (ja ?? en) : en;

  const insidersQuery = useQuery<{ ticker: string; trades: InsiderTrade[] }>({
    queryKey: ["/api/ownership/insiders", symbol],
    queryFn: async () => {
      const r = await fetch(`/api/ownership?ticker=${symbol}&type=insiders`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 2,
    enabled: tab === "insiders",
  });

  const managersQuery = useQuery<{ ticker: string; holders: Holder[] }>({
    queryKey: ["/api/ownership/managers", symbol],
    queryFn: async () => {
      const r = await fetch(`/api/ownership?ticker=${symbol}&type=managers`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 2,
    enabled: tab === "managers",
  });

  const fundsQuery = useQuery<{ ticker: string; holders: Holder[] }>({
    queryKey: ["/api/ownership/funds", symbol],
    queryFn: async () => {
      const r = await fetch(`/api/ownership?ticker=${symbol}&type=funds`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 2,
    enabled: tab === "funds",
  });

  const currentQuery =
    tab === "insiders" ? insidersQuery :
    tab === "managers" ? managersQuery : fundsQuery;

  return (
    <div className="flex flex-col h-full" data-testid="ownership-panel">

      {/* Tab bar */}
      <div className="flex border-b border-border/60 bg-muted/20 shrink-0">
        <TabBtn
          id="insiders" active={tab === "insiders"}
          icon={<Users className="w-3.5 h-3.5" />}
          label={L("내부자", "Insiders", "インサイダー")}
          onClick={() => setTab("insiders")}
        />
        <TabBtn
          id="managers" active={tab === "managers"}
          icon={<Building2 className="w-3.5 h-3.5" />}
          label={L("기관", "Managers", "機関投資家")}
          onClick={() => setTab("managers")}
        />
        <TabBtn
          id="funds" active={tab === "funds"}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label={L("펀드", "Funds", "ファンド")}
          onClick={() => setTab("funds")}
        />
        {currentQuery.isRefetching && (
          <div className="ml-auto flex items-center pr-3">
            <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Legend */}
      {tab === "insiders" && (
        <div className="flex items-center gap-3 px-4 py-2 text-[10px] text-muted-foreground bg-muted/10 border-b border-border/30 shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />
            {L("매수 강조", "Buy highlighted", "買い強調")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-red-500/40" />
            {L("매도 강조", "Sale highlighted", "売り強調")}
          </span>
          <span className="ml-auto font-mono text-[9px] text-muted-foreground/60">
            {symbol}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {currentQuery.isLoading ? (
          <TableSkeleton />
        ) : tab === "insiders" ? (
          <InsiderTable
            trades={insidersQuery.data?.trades ?? []}
            lang={lang}
            fmtPrice={formatPrice}
            fmtVal={formatMarketCap}
          />
        ) : tab === "managers" ? (
          <HoldersTable holders={managersQuery.data?.holders ?? []} lang={lang} fmtVal={formatMarketCap} />
        ) : (
          <HoldersTable holders={fundsQuery.data?.holders ?? []} lang={lang} fmtVal={formatMarketCap} />
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-border/30 text-[10px] text-muted-foreground/60 shrink-0 bg-muted/10">
        {tab === "insiders"
          ? L("SEC Form 4 내부자 거래 신고 | yfinance", "SEC Form 4 insider transactions | yfinance", "SEC Form 4 インサイダー取引 | yfinance")
          : tab === "managers"
          ? L("13F 기관 보유 현황 | yfinance", "13F institutional holdings | yfinance", "13F 機関保有状況 | yfinance")
          : L("뮤추얼펀드 보유 현황 | yfinance", "Mutual fund holdings | yfinance", "ミューチュアルファンド保有 | yfinance")
        }
      </div>
    </div>
  );
}
