import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const credentialStorageKey = "astack-observatory-access-key";
function readCredential() {
  try {
    return localStorage.getItem(credentialStorageKey)?.trim() ?? "";
  } catch {
    return "";
  }
}

function useAuthentication() {
  const [state, setState] = useState<
    "loading" | "authenticated" | "denied" | "offline"
  >("loading");
  const [credential, setCredential] = useState(readCredential);
  const currentCredential = useRef(credential);
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
      if (currentCredential.current !== credential) return null;
      if (!response.ok) {
        if (response.status === 401 && credential) {
          try {
            if (localStorage.getItem(credentialStorageKey) === credential)
              localStorage.removeItem(credentialStorageKey);
          } catch {
            // Restricted storage still permits in-memory authentication.
          }
        }
        setState(response.status === 401 ? "denied" : "offline");
        return null;
      }
      const result: unknown = await response.json();
      if (currentCredential.current !== credential) return null;
      if (
        typeof result !== "object" ||
        result === null ||
        !("token" in result) ||
        typeof result.token !== "string" ||
        !result.token
      ) {
        setState("offline");
        return null;
      }
      if (credential) {
        try {
          localStorage.setItem(credentialStorageKey, credential);
        } catch {
          // Restricted storage still permits in-memory authentication.
        }
      }
      setState("authenticated");
      return result.token;
    } catch {
      if (currentCredential.current === credential) setState("offline");
      return null;
    }
  }, [credential]);
  useEffect(() => {
    void fetchAccessToken();
  }, [fetchAccessToken]);
  const authenticate = (value: string) => {
    const nextCredential = value.trim();
    currentCredential.current = nextCredential;
    setState("loading");
    if (nextCredential === credential) void fetchAccessToken();
    else setCredential(nextCredential);
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
