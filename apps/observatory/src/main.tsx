import React, { Component, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  ConvexProviderWithAuth,
  ConvexReactClient,
  useConvexAuth,
} from "convex/react";
import { Button, Input } from "@astack/ui";
import "@astack/ui/styles.css";
import { App } from "./app";
import { useOwnerAuth, OwnerAuthProvider } from "./auth";
import { AccessLayout, ThemeProvider, initializeTheme } from "./theme";

initializeTheme();

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <AccessLayout>
        <h1>Observatory unavailable</h1>
        <p>The private service could not load this view.</p>
        <Button onClick={() => location.reload()}>Retry</Button>
      </AccessLayout>
    ) : (
      this.props.children
    );
  }
}
function AccessGate() {
  const auth = useConvexAuth();
  const access = useOwnerAuth();
  const [key, setKey] = useState("");
  if (auth.isLoading)
    return (
      <AccessLayout>
        <h1>Connecting to Observatory</h1>
        <p>Checking your private access…</p>
      </AccessLayout>
    );
  if (!auth.isAuthenticated)
    return (
      <AccessLayout>
        <p className="eyebrow">Private agent feedback</p>
        <h1>Private Observatory</h1>
        <p>
          {access.state === "offline"
            ? "The private service is unavailable. Check Tailscale and retry."
            : "Connect with your permitted Tailscale identity or the owner’s private access key."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            access.authenticate(key);
          }}
        >
          <label>
            Private access key
            <Input
              aria-label="Private access key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <div className="toolbar">
            <Button type="submit" disabled={!key.trim()}>
              Open Observatory
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => location.reload()}
            >
              Retry connection
            </Button>
          </div>
        </form>
      </AccessLayout>
    );
  return <App />;
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
const url: unknown = import.meta.env.VITE_CONVEX_URL;
if (typeof url !== "string" || !url.startsWith("https://"))
  createRoot(root).render(
    <ThemeProvider>
      <AccessLayout>
        <h1>Configure Observatory</h1>
        <p>Set the private Convex URL before building the app.</p>
      </AccessLayout>
    </ThemeProvider>,
  );
else {
  const client = new ConvexReactClient(url);
  createRoot(root).render(
    <React.StrictMode>
      <ThemeProvider>
        <ErrorBoundary>
          <OwnerAuthProvider>
            <ConvexProviderWithAuth client={client} useAuth={useOwnerAuth}>
              <AccessGate />
            </ConvexProviderWithAuth>
          </OwnerAuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </React.StrictMode>,
  );
}
