import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-user";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  Plus, Trash2, Edit3, TrendingUp, TrendingDown, X, Search, Loader2,
  Wallet, BarChart3, PieChart as PieIcon, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getLocalizedCompanyName } from "@/lib/stockNames";
import { searchStockDatabase } from "@/lib/stockDatabase";

interface Holding {
  id: number;
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currency: string;
  sector: string;
  addedAt: string;
}

interface LiveQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  name?: string;
}

const SECTOR_COLORS = [
  "#6366f1","#22c55e","#f59e0b","#ef4444","#3b82f6",
  "#8b5cf6","#14b8a6","#f97316","#ec4899","#a3e635",
];

function formatMoney(n: number, currency = "USD"): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function Portfolio() {
  const { data: user } = useUser();
  const lang = (user?.language || "ko") as "ko" | "en" | "ja";
  const isKo = lang === "ko";
  const [, navigate] = useLocation();

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { data: holdings = [], isLoading } = useQuery<Holding[]>({
    queryKey: ["/api/portfolio/holdings"],
    staleTime: 30_000,
  });

  const symbols = holdings.map(h => h.symbol);
  const { data: liveData } = useQuery<{ quotes: LiveQuote[] }>({
    queryKey: ["/api/stocks/live", symbols.join(",")],
    queryFn: async () => {
      if (!symbols.length) return { quotes: [] };
      const res = await fetch(`/api/stocks/live?symbols=${symbols.join(",")}`, { credentials: "include" });
      if (!res.ok) return { quotes: [] };
      return res.json();
    },
    enabled: symbols.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const liveMap = Object.fromEntries((liveData?.quotes || []).map(q => [q.symbol, q]));

  const enriched = holdings.map(h => {
    const live = liveMap[h.symbol];
    const currentPrice = live?.price ?? h.avgCost;
    const cost = h.shares * h.avgCost;
    const value = h.shares * currentPrice;
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    return { ...h, currentPrice, value, cost, pnl, pnlPct, changePercent: live?.changePercent ?? 0 };
  });

  const totalCost = enriched.reduce((s, h) => s + h.cost, 0);
  const totalValue = enriched.reduce((s, h) => s + h.value, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const sectorData = Object.entries(
    enriched.reduce((acc, h) => {
      const sec = h.sector || "기타";
      acc[sec] = (acc[sec] || 0) + h.value;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/portfolio/holdings/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings"] }),
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-28 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{isKo ? "모의 포트폴리오" : "Mock Portfolio"}</h1>
            <p className="text-xs text-muted-foreground">{isKo ? "가상으로 종목을 담고 수익률을 확인하세요" : "Track your virtual holdings & P&L"}</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAdd(true)}
          data-testid="button-add-holding"
          className="flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          {isKo ? "종목 추가" : "Add Stock"}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: isKo ? "총 평가금액" : "Total Value",   value: formatMoney(totalValue),  color: "text-foreground" },
          { label: isKo ? "총 투자금액" : "Total Cost",    value: formatMoney(totalCost),   color: "text-muted-foreground" },
          { label: isKo ? "평가손익" : "Total P&L",        value: `${totalPnl >= 0 ? "+" : ""}${formatMoney(totalPnl)}`, color: totalPnl >= 0 ? "text-emerald-500" : "text-rose-500" },
          { label: isKo ? "수익률" : "Return",             value: `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%`, color: totalPnlPct >= 0 ? "text-emerald-500" : "text-rose-500" },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-0.5">{card.label}</p>
            <p className={cn("text-lg font-bold tabular-nums", card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings table */}
        <div className="lg:col-span-2 space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" />
            {isKo ? "보유 종목" : "Holdings"} ({holdings.length})
          </h2>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && holdings.length === 0 && (
            <div className="text-center py-16 rounded-2xl border border-dashed border-border">
              <Wallet className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">
                {isKo ? "아직 종목이 없습니다" : "No holdings yet"}
              </p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {isKo ? "종목 추가 버튼을 눌러 시작해 보세요" : "Click 'Add Stock' to get started"}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {enriched.map((h, idx) => {
              const isUp = h.pnl >= 0;
              const displayName = isKo ? getLocalizedCompanyName(h.name, lang) || h.name : h.name;
              return (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
                  data-testid={`holding-row-${h.symbol}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {h.symbol.replace(/\.(KS|KQ|T)$/, "").slice(0, 3)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{h.symbol}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">{formatMoney(h.value)}</p>
                          <p className={cn("text-xs font-semibold flex items-center justify-end gap-0.5", isUp ? "text-emerald-500" : "text-rose-500")}>
                            {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {isUp ? "+" : ""}{h.pnlPct.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>{h.shares}주 × ${h.currentPrice.toFixed(2)}</span>
                        <span className={cn("font-medium", isUp ? "text-emerald-500" : "text-rose-500")}>
                          {isUp ? "+" : ""}{formatMoney(h.pnl)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/terminal?symbol=${h.symbol}`)}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          {isKo ? "터미널에서 보기" : "View in Terminal"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditId(h.id)}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 transition-colors flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> {isKo ? "편집" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(h.id)}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors flex items-center gap-1"
                          data-testid={`button-delete-${h.symbol}`}
                        >
                          <Trash2 className="w-3 h-3" /> {isKo ? "삭제" : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Sector breakdown */}
        {sectorData.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <PieIcon className="w-4 h-4" />
              {isKo ? "섹터 비중" : "Sector Breakdown"}
            </h2>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sectorData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                      {sectorData.map((_, i) => (
                        <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatMoney(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {sectorData.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                      <span className="truncate max-w-[100px]">{s.name}</span>
                    </div>
                    <span className="text-muted-foreground font-medium">
                      {totalValue > 0 ? ((s.value / totalValue) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {(showAdd || editId !== null) && (
          <HoldingModal
            editHolding={editId !== null ? holdings.find(h => h.id === editId) : undefined}
            lang={lang}
            onClose={() => { setShowAdd(false); setEditId(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function HoldingModal({
  editHolding,
  lang,
  onClose,
}: {
  editHolding?: Holding;
  lang: "ko" | "en" | "ja";
  onClose: () => void;
}) {
  const isKo = lang === "ko";
  const isEdit = !!editHolding;

  const [symbol, setSymbol] = useState(editHolding?.symbol || "");
  const [name, setName] = useState(editHolding?.name || "");
  const [sector, setSector] = useState(editHolding?.sector || "");
  const [inputMode, setInputMode] = useState<"sharesAvg" | "totalAmount">("sharesAvg");
  const [shares, setShares] = useState(editHolding ? String(editHolding.shares) : "");
  const [avgCost, setAvgCost] = useState(editHolding ? String(editHolding.avgCost) : "");
  const [totalAmount, setTotalAmount] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = searchQ.length >= 1 ? searchStockDatabase(searchQ, 6) : [];

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/portfolio/holdings", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings"] }); onClose(); },
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/portfolio/holdings/${editHolding!.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings"] }); onClose(); },
  });

  function handleSubmit() {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;

    let finalShares = Number(shares);
    let finalAvgCost = Number(avgCost);

    if (inputMode === "totalAmount") {
      const total = Number(totalAmount);
      const cost = Number(avgCost);
      if (cost > 0 && total > 0) {
        finalShares = total / cost;
        finalAvgCost = cost;
      }
    }

    if (!finalShares || !finalAvgCost) return;

    const payload = { symbol: sym, name, sector, shares: finalShares, avgCost: finalAvgCost, currency: "USD" };
    if (isEdit) {
      editMutation.mutate({ shares: finalShares, avgCost: finalAvgCost, name, sector });
    } else {
      addMutation.mutate(payload);
    }
  }

  const isPending = addMutation.isPending || editMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">
            {isEdit ? (isKo ? "보유 편집" : "Edit Holding") : (isKo ? "종목 추가" : "Add Stock")}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Symbol search */}
          {!isEdit && (
            <div className="relative">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {isKo ? "종목 검색" : "Search Stock"}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQ}
                  onChange={e => { setSearchQ(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder={isKo ? "AAPL, 삼성전자, Tesla…" : "AAPL, Tesla, Samsung…"}
                  className="pl-9"
                  data-testid="input-symbol-search"
                />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {suggestions.map(s => (
                    <button
                      key={s.ticker}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 text-left transition-colors"
                      onClick={() => {
                        setSymbol(s.ticker);
                        setName(isKo ? s.ko : s.en);
                        setSector(s.sector || "");
                        setSearchQ(isKo ? s.ko : s.en);
                        setShowSuggestions(false);
                      }}
                    >
                      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{s.ticker}</span>
                      <span className="text-sm font-medium truncate">{isKo ? s.ko : s.en}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Symbol display */}
          {!isEdit && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {isKo ? "선택된 종목" : "Selected Symbol"}
              </label>
              <Input
                value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
                placeholder="AAPL"
                className="font-mono"
                data-testid="input-symbol"
              />
            </div>
          )}

          {/* Input mode toggle */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {isKo ? "입력 방식" : "Input Method"}
            </label>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {([
                { key: "sharesAvg", label: isKo ? "주수 + 평균단가" : "Shares + Avg Cost" },
                { key: "totalAmount", label: isKo ? "총 투자금액" : "Total Amount" },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setInputMode(opt.key)}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium transition-colors",
                    inputMode === opt.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {inputMode === "sharesAvg" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {isKo ? "보유 주수" : "Shares"}
                </label>
                <Input
                  type="number"
                  value={shares}
                  onChange={e => setShares(e.target.value)}
                  placeholder="10"
                  min="0"
                  data-testid="input-shares"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {isKo ? "평균 매수단가 ($)" : "Avg Cost ($)"}
                </label>
                <Input
                  type="number"
                  value={avgCost}
                  onChange={e => setAvgCost(e.target.value)}
                  placeholder="150.00"
                  min="0"
                  step="0.01"
                  data-testid="input-avg-cost"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {isKo ? "총 투자금액 ($)" : "Total Invested ($)"}
                </label>
                <Input
                  type="number"
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value)}
                  placeholder="1500.00"
                  min="0"
                  step="0.01"
                  data-testid="input-total-amount"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {isKo ? "평균 매수단가 ($)" : "Avg Price ($)"}
                </label>
                <Input
                  type="number"
                  value={avgCost}
                  onChange={e => setAvgCost(e.target.value)}
                  placeholder="150.00"
                  min="0"
                  step="0.01"
                  data-testid="input-avg-price"
                />
              </div>
            </div>
          )}

          {/* Preview */}
          {avgCost && (inputMode === "sharesAvg" ? shares : totalAmount) && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
              {inputMode === "sharesAvg" ? (
                <>
                  {isKo ? "총 투자금액" : "Total cost"}: <span className="font-bold text-foreground">
                    ${(Number(shares) * Number(avgCost)).toFixed(2)}
                  </span>
                </>
              ) : (
                <>
                  {isKo ? "계산된 주수" : "Calculated shares"}: <span className="font-bold text-foreground">
                    {Number(avgCost) > 0 ? (Number(totalAmount) / Number(avgCost)).toFixed(4) : "—"} {isKo ? "주" : "shares"}
                  </span>
                </>
              )}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isPending || !symbol}
            className="w-full"
            data-testid="button-submit-holding"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {isEdit ? (isKo ? "저장" : "Save") : (isKo ? "추가" : "Add")}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
