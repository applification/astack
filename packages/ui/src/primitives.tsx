import { useState, type ComponentProps, type ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline: "border border-border bg-card text-foreground hover:bg-muted",
        badge:
          "max-w-full rounded-lg border border-border bg-card px-3 text-left text-foreground hover:bg-muted aria-expanded:border-link aria-expanded:bg-muted",
        ghost: "text-link hover:bg-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    />
  );
}
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    />
  );
}
export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function HelpCard({
  label,
  trigger,
  children,
}: {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [visibility, setVisibility] = useState<"closed" | "hover" | "pinned">(
    "closed",
  );
  const close = () => setVisibility("closed");
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root
        open={visibility !== "closed"}
        onOpenChange={(open) =>
          setVisibility((previous) =>
            previous === "pinned" ? previous : open ? "hover" : "closed",
          )
        }
      >
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="help-trigger"
            aria-label={label}
            onPointerDown={(event) => event.preventDefault()}
            onBlur={close}
            onClick={(event) => {
              // Keep activated help open through pointer movement and automatic scrolling.
              event.preventDefault();
              setVisibility("pinned");
            }}
          >
            {trigger}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="help-card"
            sideOffset={8}
            collisionPadding={12}
            onEscapeKeyDown={close}
            onPointerDownOutside={close}
          >
            {children}
            <Tooltip.Arrow className="help-card-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
