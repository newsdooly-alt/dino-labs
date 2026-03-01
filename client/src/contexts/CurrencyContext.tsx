import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface ExchangeRateData {
  rate: number;
  rateJPY: number;
  rates: { KRW: number; JPY: number };
  source: string;
  timestamp: number;
}

interface FormatOptions {
  compact?: boolean;
  decimals?: number;
  nativeCurrency?: string;
}

export type CurrencyType = "usd" | "krw" | "jpy";

interface CurrencyContextType {
  currency: CurrencyType;
  setCurrency: (c: CurrencyType) => void;
  exchangeRate: number;
  exchangeRateJPY: number;
  isLoadingRate: boolean;
  formatPrice: (value: number | null | undefined, opts?: FormatOptions) => string;
  formatMarketCap: (value: number | null | undefined, opts?: { nativeCurrency?: string }) => string;
  currencySymbol: string;
  isKoreanStock: (symbol: string) => boolean;
  isJapaneseStock: (symbol: string) => boolean;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const DEFAULT_RATE_KRW = 1380;
const DEFAULT_RATE_JPY = 150;

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyType>(() => {
    const saved = localStorage.getItem("dinolingo_currency");
    return (saved === "krw" ? "krw" : saved === "jpy" ? "jpy" : "usd");
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

  const exchangeRate = rateData?.rates?.KRW ?? rateData?.rate ?? DEFAULT_RATE_KRW;
  const exchangeRateJPY = rateData?.rates?.JPY ?? rateData?.rateJPY ?? DEFAULT_RATE_JPY;

  const setCurrency = useCallback((c: CurrencyType) => {
    setCurrencyState(c);
    localStorage.setItem("dinolingo_currency", c);
  }, []);

  const currencySymbol = currency === "krw" ? "₩" : currency === "jpy" ? "¥" : "$";

  const isKoreanStock = useCallback((symbol: string) => {
    const s = symbol.toUpperCase();
    return s.endsWith('.KS') || s.endsWith('.KQ');
  }, []);

  const isJapaneseStock = useCallback((symbol: string) => {
    const s = symbol.toUpperCase();
    return s.endsWith('.T');
  }, []);

  const formatKrw = useCallback((krwValue: number, compact?: boolean) => {
    if (compact) {
      if (krwValue >= 1e12) return `₩${(krwValue / 1e12).toFixed(1)}조`;
      if (krwValue >= 1e8) return `₩${(krwValue / 1e8).toFixed(1)}억`;
      if (krwValue >= 1e4) return `₩${(krwValue / 1e4).toFixed(0)}만`;
    }
    return `₩${Math.round(krwValue).toLocaleString()}`;
  }, []);

  const formatJpy = useCallback((jpyValue: number, compact?: boolean) => {
    if (compact) {
      if (jpyValue >= 1e12) return `¥${(jpyValue / 1e12).toFixed(1)}T`;
      if (jpyValue >= 1e8) return `¥${(jpyValue / 1e8).toFixed(1)}억`;
      if (jpyValue >= 1e4) return `¥${(jpyValue / 1e4).toFixed(0)}만`;
    }
    return `¥${Math.round(jpyValue).toLocaleString()}`;
  }, []);

  const formatPrice = useCallback((value: number | null | undefined, opts?: FormatOptions) => {
    if (value === null || value === undefined) return "--";
    const decimals = opts?.decimals ?? 2;
    const nativeCurrency = opts?.nativeCurrency?.toUpperCase();

    if (nativeCurrency === 'KRW') {
      if (currency === 'krw') return formatKrw(value, opts?.compact);
      if (currency === 'jpy') {
        const jpyValue = (value / exchangeRate) * exchangeRateJPY;
        return formatJpy(jpyValue, opts?.compact);
      }
      return `$${(value / exchangeRate).toFixed(decimals)}`;
    }

    if (nativeCurrency === 'JPY') {
      if (currency === 'jpy') return formatJpy(value, opts?.compact);
      if (currency === 'krw') {
        const krwValue = (value / exchangeRateJPY) * exchangeRate;
        return formatKrw(krwValue, opts?.compact);
      }
      return `$${(value / exchangeRateJPY).toFixed(decimals)}`;
    }

    if (currency === "krw") return formatKrw(value * exchangeRate, opts?.compact);
    if (currency === "jpy") return formatJpy(value * exchangeRateJPY, opts?.compact);
    return `$${value.toFixed(decimals)}`;
  }, [currency, exchangeRate, exchangeRateJPY, formatKrw, formatJpy]);

  const formatMarketCap = useCallback((value: number | null | undefined, opts?: { nativeCurrency?: string }) => {
    if (!value) return "--";
    const nativeCurrency = opts?.nativeCurrency?.toUpperCase();

    const formatUSD = (v: number) => {
      if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
      if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
      if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
      return `$${v.toLocaleString()}`;
    };
    const formatKrwCap = (v: number) => {
      if (v >= 1e16) return `₩${(v / 1e16).toFixed(2)}경`;
      if (v >= 1e12) return `₩${(v / 1e12).toFixed(2)}조`;
      if (v >= 1e8)  return `₩${(v / 1e8).toFixed(2)}억`;
      return `₩${v.toLocaleString()}`;
    };
    const formatJpyCap = (v: number) => {
      if (v >= 1e12) return `¥${(v / 1e12).toFixed(2)}T`;
      if (v >= 1e9)  return `¥${(v / 1e9).toFixed(2)}B`;
      if (v >= 1e8)  return `¥${(v / 1e8).toFixed(2)}억`;
      return `¥${v.toLocaleString()}`;
    };

    const toUSD = (v: number, native?: string) => {
      if (native === 'KRW') return v / exchangeRate;
      if (native === 'JPY') return v / exchangeRateJPY;
      return v;
    };

    if (currency === 'usd') return formatUSD(toUSD(value, nativeCurrency));
    if (currency === 'krw') {
      const krwVal = nativeCurrency === 'KRW' ? value : nativeCurrency === 'JPY' ? (value / exchangeRateJPY) * exchangeRate : value * exchangeRate;
      return formatKrwCap(krwVal);
    }
    if (currency === 'jpy') {
      const jpyVal = nativeCurrency === 'JPY' ? value : nativeCurrency === 'KRW' ? (value / exchangeRate) * exchangeRateJPY : value * exchangeRateJPY;
      return formatJpyCap(jpyVal);
    }
    return formatUSD(value);
  }, [currency, exchangeRate, exchangeRateJPY]);

  return (
    <CurrencyContext.Provider value={{
      currency, setCurrency, exchangeRate, exchangeRateJPY, isLoadingRate,
      formatPrice, formatMarketCap, currencySymbol, isKoreanStock, isJapaneseStock
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within a CurrencyProvider");
  return context;
}
