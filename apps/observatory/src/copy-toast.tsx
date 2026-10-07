import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type CopyNotice =
  { kind: "copied" } | { kind: "failed"; fullValue: string | null };
const CopyToastContext = createContext<((notice: CopyNotice) => void) | null>(
  null,
);

export function useCopyToast() {
  const notify = useContext(CopyToastContext);
  if (!notify) throw new Error("Copy controls require CopyToastProvider");
  return notify;
}

export function CopyToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<CopyNotice | null>(null);
  const notify = useCallback((next: CopyNotice) => setNotice(next), []);

  useEffect(() => {
    if (notice?.kind !== "copied") return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <CopyToastContext.Provider value={notify}>
      {children}
      {notice &&
        createPortal(
          <div
            className="copy-toast"
            role={notice.kind === "copied" ? "status" : "alert"}
          >
            <div>
              <p>
                {notice.kind === "copied"
                  ? "Copied"
                  : "Copy unavailable; select the full value."}
              </p>
              {notice.kind === "failed" && notice.fullValue && (
                <code>{notice.fullValue}</code>
              )}
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss copy notification"
              onClick={() => setNotice(null)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>,
          document.body,
        )}
    </CopyToastContext.Provider>
  );
}
