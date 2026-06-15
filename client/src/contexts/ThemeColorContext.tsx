import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUser } from "@/hooks/use-user";

export type ThemeColor = "green" | "blue" | "pink" | "dark";

interface ThemeColorContextType {
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
}

const ThemeColorContext = createContext<ThemeColorContextType | undefined>(undefined);

const THEME_COLORS: Record<ThemeColor, {
  light: Record<string, string>;
  dark: Record<string, string>;
  forceDark?: boolean;
}> = {
  green: {
    light: {
      "--background":                "138 35% 97%",
      "--card":                      "138 20% 99%",
      "--primary":                   "142 76% 36%",
      "--primary-foreground":        "144 100% 97%",
      "--primary-border":            "142 76% 28%",
      "--accent":                    "142 50% 92%",
      "--accent-foreground":         "142 76% 30%",
      "--accent-border":             "142 50% 85%",
      "--ring":                      "142 76% 36%",
      "--sidebar-primary":           "142 76% 36%",
      "--sidebar-primary-foreground":"144 100% 97%",
      "--sidebar-primary-border":    "142 76% 28%",
      "--sidebar-accent":            "142 50% 92%",
      "--sidebar-accent-foreground": "142 76% 30%",
      "--sidebar-accent-border":     "142 50% 85%",
      "--sidebar-ring":              "142 76% 36%",
      "--chart-1":                   "142 76% 36%",
    },
    dark: {
      "--background":                "140 18% 8%",
      "--card":                      "140 15% 10%",
      "--primary":                   "142 76% 45%",
      "--primary-foreground":        "140 30% 6%",
      "--primary-border":            "142 76% 55%",
      "--accent":                    "142 50% 18%",
      "--accent-foreground":         "142 76% 70%",
      "--accent-border":             "142 50% 25%",
      "--ring":                      "142 76% 45%",
      "--sidebar-primary":           "142 76% 45%",
      "--sidebar-primary-foreground":"140 30% 6%",
      "--sidebar-primary-border":    "142 76% 55%",
      "--sidebar-accent":            "142 50% 18%",
      "--sidebar-accent-foreground": "142 76% 70%",
      "--sidebar-accent-border":     "142 50% 25%",
      "--sidebar-ring":              "142 76% 45%",
      "--chart-1":                   "142 76% 45%",
    },
  },
  blue: {
    light: {
      "--background":                "214 40% 97%",
      "--card":                      "214 25% 99%",
      "--primary":                   "217 91% 50%",
      "--primary-foreground":        "210 100% 97%",
      "--primary-border":            "217 91% 40%",
      "--accent":                    "214 50% 92%",
      "--accent-foreground":         "217 91% 35%",
      "--accent-border":             "214 50% 85%",
      "--ring":                      "217 91% 50%",
      "--sidebar-primary":           "217 91% 50%",
      "--sidebar-primary-foreground":"210 100% 97%",
      "--sidebar-primary-border":    "217 91% 40%",
      "--sidebar-accent":            "214 50% 92%",
      "--sidebar-accent-foreground": "217 91% 35%",
      "--sidebar-accent-border":     "214 50% 85%",
      "--sidebar-ring":              "217 91% 50%",
      "--chart-1":                   "217 91% 50%",
    },
    dark: {
      "--background":                "217 20% 8%",
      "--card":                      "217 18% 11%",
      "--primary":                   "217 91% 60%",
      "--primary-foreground":        "217 30% 6%",
      "--primary-border":            "217 91% 70%",
      "--accent":                    "217 50% 18%",
      "--accent-foreground":         "217 91% 75%",
      "--accent-border":             "217 50% 25%",
      "--ring":                      "217 91% 60%",
      "--sidebar-primary":           "217 91% 60%",
      "--sidebar-primary-foreground":"217 30% 6%",
      "--sidebar-primary-border":    "217 91% 70%",
      "--sidebar-accent":            "217 50% 18%",
      "--sidebar-accent-foreground": "217 91% 75%",
      "--sidebar-accent-border":     "217 50% 25%",
      "--sidebar-ring":              "217 91% 60%",
      "--chart-1":                   "217 91% 60%",
    },
  },
  pink: {
    light: {
      "--background":                "330 40% 97%",
      "--card":                      "330 20% 99%",
      "--primary":                   "330 81% 55%",
      "--primary-foreground":        "330 100% 97%",
      "--primary-border":            "330 81% 45%",
      "--accent":                    "330 50% 92%",
      "--accent-foreground":         "330 81% 40%",
      "--accent-border":             "330 50% 85%",
      "--ring":                      "330 81% 55%",
      "--sidebar-primary":           "330 81% 55%",
      "--sidebar-primary-foreground":"330 100% 97%",
      "--sidebar-primary-border":    "330 81% 45%",
      "--sidebar-accent":            "330 50% 92%",
      "--sidebar-accent-foreground": "330 81% 40%",
      "--sidebar-accent-border":     "330 50% 85%",
      "--sidebar-ring":              "330 81% 55%",
      "--chart-1":                   "330 81% 55%",
    },
    dark: {
      "--background":                "330 20% 8%",
      "--card":                      "330 15% 11%",
      "--primary":                   "330 81% 60%",
      "--primary-foreground":        "330 30% 6%",
      "--primary-border":            "330 81% 70%",
      "--accent":                    "330 50% 18%",
      "--accent-foreground":         "330 81% 75%",
      "--accent-border":             "330 50% 25%",
      "--ring":                      "330 81% 60%",
      "--sidebar-primary":           "330 81% 60%",
      "--sidebar-primary-foreground":"330 30% 6%",
      "--sidebar-primary-border":    "330 81% 70%",
      "--sidebar-accent":            "330 50% 18%",
      "--sidebar-accent-foreground": "330 81% 75%",
      "--sidebar-accent-border":     "330 50% 25%",
      "--sidebar-ring":              "330 81% 60%",
      "--chart-1":                   "330 81% 60%",
    },
  },
  dark: {
    forceDark: true,
    light: {
      "--background":                "240 12% 9%",
      "--card":                      "240 10% 12%",
      "--primary":                   "258 85% 65%",
      "--primary-foreground":        "258 30% 6%",
      "--primary-border":            "258 85% 75%",
      "--accent":                    "258 40% 20%",
      "--accent-foreground":         "258 85% 80%",
      "--accent-border":             "258 40% 28%",
      "--ring":                      "258 85% 65%",
      "--sidebar-primary":           "258 85% 65%",
      "--sidebar-primary-foreground":"258 30% 6%",
      "--sidebar-primary-border":    "258 85% 75%",
      "--sidebar-accent":            "258 40% 20%",
      "--sidebar-accent-foreground": "258 85% 80%",
      "--sidebar-accent-border":     "258 40% 28%",
      "--sidebar-ring":              "258 85% 65%",
      "--chart-1":                   "258 85% 65%",
    },
    dark: {
      "--background":                "240 12% 9%",
      "--card":                      "240 10% 12%",
      "--primary":                   "258 85% 65%",
      "--primary-foreground":        "258 30% 6%",
      "--primary-border":            "258 85% 75%",
      "--accent":                    "258 40% 20%",
      "--accent-foreground":         "258 85% 80%",
      "--accent-border":             "258 40% 28%",
      "--ring":                      "258 85% 65%",
      "--sidebar-primary":           "258 85% 65%",
      "--sidebar-primary-foreground":"258 30% 6%",
      "--sidebar-primary-border":    "258 85% 75%",
      "--sidebar-accent":            "258 40% 20%",
      "--sidebar-accent-foreground": "258 85% 80%",
      "--sidebar-accent-border":     "258 40% 28%",
      "--sidebar-ring":              "258 85% 65%",
      "--chart-1":                   "258 85% 65%",
    },
  },
};

function applyThemeColor(color: ThemeColor) {
  const root = document.documentElement;
  const config = THEME_COLORS[color];

  if (config.forceDark) {
    if (!root.classList.contains("dark")) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  }

  const isDark = root.classList.contains("dark");
  const mode = isDark ? "dark" : "light";
  const vars = config[mode];

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function ThemeColorProvider({ children }: { children: React.ReactNode }) {
  const { data: user } = useUser();
  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
    const saved = localStorage.getItem("dinolingo_theme_color");
    return (saved as ThemeColor) || "blue";
  });

  useEffect(() => {
    if (user && (user as any).themeColor) {
      const color = (user as any).themeColor as ThemeColor;
      if (color !== themeColor) {
        setThemeColorState(color);
      }
    }
  }, [user]);

  useEffect(() => {
    applyThemeColor(themeColor);
    localStorage.setItem("dinolingo_theme_color", themeColor);
  }, [themeColor]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      applyThemeColor(themeColor);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [themeColor]);

  const setThemeColor = useCallback((color: ThemeColor) => {
    setThemeColorState(color);
    applyThemeColor(color);
  }, []);

  return (
    <ThemeColorContext.Provider value={{ themeColor, setThemeColor }}>
      {children}
    </ThemeColorContext.Provider>
  );
}

export function useThemeColor() {
  const context = useContext(ThemeColorContext);
  if (context === undefined) {
    throw new Error("useThemeColor must be used within a ThemeColorProvider");
  }
  return context;
}
