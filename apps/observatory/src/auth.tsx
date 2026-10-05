import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

function useAuthentication() {
  const [state, setState] = useState<
    "loading" | "authenticated" | "denied" | "offline"
  >("loading");
  const [credential, setCredential] = useState("");
  const fetchAccessToken = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_CONVEX_SITE_URL}/auth/session`,
        {
          method: credential ? "POST" : "GET",
          ...(credential
            ? { headers: { authorization: `Bearer ${credential}` } }
            : {}),
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) {
        setState(response.status === 401 ? "denied" : "offline");
        return null;
      }
      const result: unknown = await response.json();
      if (
        typeof result !== "object" ||
        result === null ||
        !("token" in result) ||
        typeof result.token !== "string"
      ) {
        setState("offline");
        return null;
      }
      setState("authenticated");
      return result.token;
    } catch {
      setState("offline");
      return null;
    }
  }, [credential]);
  useEffect(() => {
    void fetchAccessToken();
  }, [fetchAccessToken]);
  const authenticate = (value: string) => {
    setState("loading");
    if (value.trim() === credential) void fetchAccessToken();
    else setCredential(value.trim());
  };
  return {
    isLoading: state === "loading",
    isAuthenticated: state === "authenticated",
    fetchAccessToken,
    authenticate,
    state,
  };
}
const AuthContext = createContext<ReturnType<typeof useAuthentication> | null>(
  null,
);
export function OwnerAuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthentication();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
export function useOwnerAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("Missing authentication provider");
  return auth;
}
