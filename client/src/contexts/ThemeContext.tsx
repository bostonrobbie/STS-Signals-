import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

// Use a dedicated key that is ONLY set when user explicitly clicks the toggle
const USER_CHOICE_KEY = "theme_user_choice";

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = true,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      // Only respect explicit user choice; otherwise default to light
      const userChoice = localStorage.getItem(USER_CHOICE_KEY);
      if (userChoice === "light" || userChoice === "dark") {
        return userChoice;
      }
      return defaultTheme; // "light"
    }
    return defaultTheme;
  });

  const [serverSynced, setServerSynced] = useState(false);

  // Get auth state - useAuth is safe to call here since ThemeProvider is inside AuthProvider
  let user: { id: number } | null = null;
  let authLoading = true;
  try {
    const auth = useAuth();
    user = auth.user as { id: number } | null;
    authLoading = auth.loading;
  } catch {
    // useAuth might not be available (e.g., outside AuthProvider)
    user = null;
    authLoading = false;
  }

  // Fetch user preferences from server (includes themePreference)
  const { data: prefsData } = trpc.user.getPreferences.useQuery(undefined, {
    enabled: !!user && !authLoading,
  });

  // Mutation to save theme preference to server
  const saveThemeMutation = trpc.user.setPreferences.useMutation();

  // Sync theme from server when user data loads
  useEffect(() => {
    if (prefsData?.themePreference && !serverSynced) {
      const serverTheme = prefsData.themePreference as Theme;
      setTheme(serverTheme);
      localStorage.setItem(USER_CHOICE_KEY, serverTheme);
      setServerSynced(true);
    }
  }, [prefsData, serverSynced]);

  // Apply theme class to document root whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    if (!switchable) return;
    setTheme(prev => {
      const next = prev === "light" ? "dark" : "light";
      // Save explicit user choice to localStorage
      localStorage.setItem(USER_CHOICE_KEY, next);
      // Save to server if user is logged in
      if (user) {
        saveThemeMutation.mutate({ themePreference: next });
      }
      return next;
    });
  }, [switchable, user, saveThemeMutation]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: switchable ? toggleTheme : undefined,
        switchable,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
