import { Button, Input } from "@astack/ui";
import { AccessLayout } from "./theme";

export function PrivateAccess({
  offline,
  value,
  onChange,
  authenticate,
}: {
  offline: boolean;
  value: string;
  onChange: (value: string) => void;
  authenticate: (value: string) => void;
}) {
  return (
    <AccessLayout>
      <p className="eyebrow">Private agent feedback</p>
      <h1>Private Observatory</h1>
      <p>
        {offline
          ? "The private service is unavailable. Check Tailscale and retry."
          : "Connect with your permitted Tailscale identity or the owner’s private access key."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          authenticate(value);
        }}
      >
        <label>
          Private access key
          <Input
            aria-label="Private access key"
            type="password"
            autoComplete="off"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <p className="subtitle">
          Your key is remembered in this browser after you sign in.
        </p>
        <div className="toolbar">
          <Button type="submit" disabled={!value.trim()}>
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
}
