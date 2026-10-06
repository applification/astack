import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { z } from "zod";
import { Monitor, Moon, Sun } from "lucide-react";

const preferenceSchema = z.enum(["system", "light", "dark"]);
type Preference = z.infer<typeof preferenceSchema>;
export const themeStorageKey = "astack-observatory-theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");
function readPreference(): Preference {
  try {
    const value = preferenceSchema.safeParse(
      localStorage.getItem(themeStorageKey),
    );
    return value.success ? value.data : "system";
  } catch {
    return "system";
  }
}
function subscribeToSystemTheme(change: () => void) {
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
const systemIsDark = () => media.matches;
const themeContext = createContext<{
  preference: Preference;
  choose: (value: Preference) => void;
} | null>(null);

// Set before mounting React so a saved choice also applies to loading/error UI.
export function initializeTheme() {
  const preference = readPreference();
  document.documentElement.dataset.theme =
    preference === "system" ? (media.matches ? "dark" : "light") : preference;
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(readPreference);
  const darkSystem = useSyncExternalStore(subscribeToSystemTheme, systemIsDark);
  const resolved =
    preference === "system" ? (darkSystem ? "dark" : "light") : preference;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);
  function choose(value: Preference) {
    setPreference(value);
    try {
      localStorage.setItem(themeStorageKey, value);
    } catch {
      // Restricted storage still permits an in-memory appearance choice.
    }
  }
  return (
    <themeContext.Provider value={{ preference, choose }}>
      {children}
    </themeContext.Provider>
  );
}
export function ThemeControl() {
  const theme = useContext(themeContext);
  if (!theme) throw new Error("ThemeProvider required");
  const Icon =
    theme.preference === "system"
      ? Monitor
      : theme.preference === "dark"
        ? Moon
        : Sun;
  return (
    <label className="theme-control">
      <Icon size={16} aria-hidden="true" />
      <span className="sr-only">Color theme</span>
      <select
        aria-label="Color theme"
        value={theme.preference}
        onChange={(event) =>
          theme.choose(preferenceSchema.parse(event.target.value))
        }
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
export function Brand({ projectId }: { projectId?: string }) {
  return (
    <a
      className="brand"
      href={`#runs${projectId ? `?${new URLSearchParams({ project: projectId })}` : ""}`}
      aria-label="Astack Observatory home"
    >
      astack<span>.</span>
    </a>
  );
}
export function AccessLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-lockup">
            <Brand />
            <span className="product-label">Observatory</span>
          </div>
          <ThemeControl />
        </div>
      </header>
      <main className="auth-screen">{children}</main>
    </>
  );
}
