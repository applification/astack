import type { ComponentProps, ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { WorkItem } from '@foundation/domain';

// shadcn's button/input pattern, with styling kept in the portable package.
const buttonVariants = cva('button', {
  variants: {
    variant: { primary: 'button-primary', secondary: 'button-secondary' },
  },
  defaultVariants: { variant: 'primary' },
});
export function Button({
  className,
  variant = 'primary',
  asChild = false,
  ...props
}: ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary';
  asChild?: boolean;
}) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      className={twMerge(clsx(buttonVariants({ variant }), className))}
      {...props}
    />
  );
}
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={twMerge(clsx('input', className))} {...props} />;
}
export function Workspace({
  actions,
  children,
}: {
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="workspace">
      <header className="page-header">
        <div>
          <p className="eyebrow">ASTACK REFERENCE</p>
          <h1>Work items</h1>
          <p className="subtitle">Keep a clear record of what needs doing.</p>
        </div>
        {actions}
      </header>
      {children}
    </main>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="notice" role="status">
      {children}
    </p>
  );
}
export function WorkItemList({
  items,
  pendingId,
  onStatusChange,
}: {
  items: WorkItem[];
  pendingId?: string;
  onStatusChange: (item: WorkItem) => void;
}) {
  if (items.length === 0)
    return (
      <div className="empty">
        <h2>Nothing here yet</h2>
        <p>Add a work item to get started.</p>
      </div>
    );
  return (
    <ul className="work-list">
      {items.map((item) => (
        <li className="work-item" key={item.id}>
          <span className={`status-dot ${item.status}`} aria-hidden="true" />
          <div className="item-copy">
            <h2>{item.title}</h2>
            <span className="item-state">
              {item.status === 'done' ? 'Completed' : 'Ready to work on'}
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={pendingId !== undefined}
            onClick={() => {
              onStatusChange(item);
            }}
          >
            {pendingId === item.id
              ? 'Saving…'
              : item.status === 'open'
                ? 'Mark done'
                : 'Reopen'}
          </Button>
        </li>
      ))}
    </ul>
  );
}
