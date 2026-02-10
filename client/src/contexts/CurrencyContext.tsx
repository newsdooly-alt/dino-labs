import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface ExchangeRateData {
  rate: number;
  source: string;
  timestamp: number;
}

interface CurrencyContextType {
  currency: "usd" | "krw";
  setCurrency: (c: "usd" | "krw") => void;
  exchangeRate: number;
  isLoadingRate: boolean;
  formatPrice: (usdValue: number | null | undefined, opts?: { compact?: boolean; decimals?: number }) => string;
  formatMarketCap: (usdValue: number | null | undefined) => string;
  currencySymbol: string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const DEFAULT_RATE = 1380;

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<"usd" | "krw">(() => {
    const saved = localStorage.getItem("dinolingo_currency");
    return (saved === "krw" ? "krw" : "usd");
  });

  const { data: rateData, isLoading: isLoadingRate } = useQuery<ExchangeRateData>({
    queryKey: ["/api/exchange-rate"],
    queryFn: async () => {
      const res = await fetch("/api/exchange-rate");
      if (!res.ok) throw new Error("Failed to fetch exchange rate");
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
  });

  const exchangeRate = rateData?.rate ?? DEFAULT_RATE;

  const setCurrency = useCallback((c: "usd" | "krw") => {
    setCurrencyState(c);
    localStorage.setItem("dinolingo_currency", c);
  }, []);

  const currencySymbol = currency === "krw" ? "₩" : "$";

  const formatPrice = useCallback((usdValue: number | null | undefined, opts?: { compact?: boolean; decimals?: number }) => {
    if (usdValue === null || usdValue === undefined) return "--";
    const decimals = opts?.decimals ?? 2;

    if (currency === "krw") {
      const krwValue = usdValue * exchangeRate;
      if (opts?.compact) {
        if (krwValue >= 1e12) return `₩${(krwValue / 1e12).toFixed(1)}조`;
        if (krwValue >= 1e8) return `₩${(krwValue / 1e8).toFixed(1)}억`;
        if (krwValue >= 1e4) return `₩${(krwValue / 1e4).toFixed(0)}만`;
      }
      return `₩${Math.round(krwValue).toLocaleString()}`;
    }

    return `$${usdValue.toFixed(decimals)}`;
  }, [currency, exchangeRate]);

  const formatMarketCap = useCallback((usdValue: number | null | undefined) => {
    if (!usdValue) return "--";

    if (currency === "krw") {
      const krwValue = usdValue * exchangeRate;
      if (krwValue >= 1e16) return `₩${(krwValue / 1e16).toFixed(2)}경`;
      if (krwValue >= 1e12) return `₩${(krwValue / 1e12).toFixed(2)}조`;
      if (krwValue >= 1e8) return `₩${(krwValue / 1e8).toFixed(2)}억`;
      return `₩${krwValue.toLocaleString()}`;
    }

    if (usdValue >= 1e12) return `$${(usdValue / 1e12).toFixed(2)}T`;
    if (usdValue >= 1e9) return `$${(usdValue / 1e9).toFixed(2)}B`;
    if (usdValue >= 1e6) return `$${(usdValue / 1e6).toFixed(2)}M`;
    return `$${usdValue.toLocaleString()}`;
  }, [currency, exchangeRate]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, exchangeRate, isLoadingRate, formatPrice, formatMarketCap, currencySymbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
