import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUser } from "@/hooks/use-user";

type ThemeColor = "green" | "blue" | "pink";

interface ThemeColorContextType {
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
}

const ThemeColorContext = createContext<ThemeColorContextType | undefined>(undefined);

const THEME_COLORS: Record<ThemeColor, {
  light: Record<string, string>;
  dark: Record<string, string>;
}> = {
  green: {
    light: {
      "--primary": "142 76% 36%",
      "--primary-foreground": "144 100% 97%",
      "--primary-border": "142 76% 28%",
      "--accent": "142 50% 92%",
      "--accent-foreground": "142 76% 30%",
      "--accent-border": "142 50% 85%",
      "--ring": "142 76% 36%",
      "--sidebar-primary": "142 76% 36%",
      "--sidebar-primary-foreground": "144 100% 97%",
      "--sidebar-primary-border": "142 76% 28%",
      "--sidebar-accent": "142 50% 92%",
      "--sidebar-accent-foreground": "142 76% 30%",
      "--sidebar-accent-border": "142 50% 85%",
      "--sidebar-ring": "142 76% 36%",
      "--chart-1": "142 76% 36%",
    },
    dark: {
      "--primary": "142 76% 45%",
      "--primary-foreground": "140 30% 6%",
      "--primary-border": "142 76% 55%",
      "--accent": "142 50% 18%",
      "--accent-foreground": "142 76% 70%",
      "--accent-border": "142 50% 25%",
      "--ring": "142 76% 45%",
      "--sidebar-primary": "142 76% 45%",
      "--sidebar-primary-foreground": "140 30% 6%",
      "--sidebar-primary-border": "142 76% 55%",
      "--sidebar-accent": "142 50% 18%",
      "--sidebar-accent-foreground": "142 76% 70%",
      "--sidebar-accent-border": "142 50% 25%",
      "--sidebar-ring": "142 76% 45%",
      "--chart-1": "142 76% 45%",
    },
  },
  blue: {
    light: {
      "--primary": "217 91% 50%",
      "--primary-foreground": "210 100% 97%",
      "--primary-border": "217 91% 40%",
      "--accent": "214 50% 92%",
      "--accent-foreground": "217 91% 35%",
      "--accent-border": "214 50% 85%",
      "--ring": "217 91% 50%",
      "--sidebar-primary": "217 91% 50%",
      "--sidebar-primary-foreground": "210 100% 97%",
      "--sidebar-primary-border": "217 91% 40%",
      "--sidebar-accent": "214 50% 92%",
      "--sidebar-accent-foreground": "217 91% 35%",
      "--sidebar-accent-border": "214 50% 85%",
      "--sidebar-ring": "217 91% 50%",
      "--chart-1": "217 91% 50%",
    },
    dark: {
      "--primary": "217 91% 60%",
      "--primary-foreground": "217 30% 6%",
      "--primary-border": "217 91% 70%",
      "--accent": "217 50% 18%",
      "--accent-foreground": "217 91% 75%",
      "--accent-border": "217 50% 25%",
      "--ring": "217 91% 60%",
      "--sidebar-primary": "217 91% 60%",
      "--sidebar-primary-foreground": "217 30% 6%",
      "--sidebar-primary-border": "217 91% 70%",
      "--sidebar-accent": "217 50% 18%",
      "--sidebar-accent-foreground": "217 91% 75%",
      "--sidebar-accent-border": "217 50% 25%",
      "--sidebar-ring": "217 91% 60%",
      "--chart-1": "217 91% 60%",
    },
  },
  pink: {
    light: {
      "--primary": "330 81% 55%",
      "--primary-foreground": "330 100% 97%",
      "--primary-border": "330 81% 45%",
      "--accent": "330 50% 92%",
      "--accent-foreground": "330 81% 40%",
      "--accent-border": "330 50% 85%",
      "--ring": "330 81% 55%",
      "--sidebar-primary": "330 81% 55%",
      "--sidebar-primary-foreground": "330 100% 97%",
      "--sidebar-primary-border": "330 81% 45%",
      "--sidebar-accent": "330 50% 92%",
      "--sidebar-accent-foreground": "330 81% 40%",
      "--sidebar-accent-border": "330 50% 85%",
      "--sidebar-ring": "330 81% 55%",
      "--chart-1": "330 81% 55%",
    },
    dark: {
      "--primary": "330 81% 60%",
      "--primary-foreground": "330 30% 6%",
      "--primary-border": "330 81% 70%",
      "--accent": "330 50% 18%",
      "--accent-foreground": "330 81% 75%",
      "--accent-border": "330 50% 25%",
      "--ring": "330 81% 60%",
      "--sidebar-primary": "330 81% 60%",
      "--sidebar-primary-foreground": "330 30% 6%",
      "--sidebar-primary-border": "330 81% 70%",
      "--sidebar-accent": "330 50% 18%",
      "--sidebar-accent-foreground": "330 81% 75%",
      "--sidebar-accent-border": "330 50% 25%",
      "--sidebar-ring": "330 81% 60%",
      "--chart-1": "330 81% 60%",
    },
  },
};

function applyThemeColor(color: ThemeColor) {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const mode = isDark ? "dark" : "light";
  const vars = THEME_COLORS[color][mode];
  
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function ThemeColorProvider({ children }: { children: React.ReactNode }) {
  const { data: user } = useUser();
  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
    const saved = localStorage.getItem("dinolingo_theme_color");
    return (saved as ThemeColor) || "green";
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
