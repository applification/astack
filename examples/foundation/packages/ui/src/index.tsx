import type { ComponentProps, ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Circle, CircleCheck, ClipboardList } from 'lucide-react';
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
  embedded = false,
}: {
  actions?: ReactNode;
  children: ReactNode;
  embedded?: boolean;
}) {
  return (
    <main className={clsx('workspace', embedded && 'workspace-embedded')}>
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
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'error';
}) {
  return (
    <p
      className={clsx('notice', tone === 'error' && 'notice-error')}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}
export function WorkItemList({
  items,
  pendingId,
  onStatusChange,
  emptyMessage = 'Add a work item to get started.',
}: {
  items: WorkItem[];
  pendingId?: string;
  onStatusChange: (item: WorkItem) => void;
  emptyMessage?: string;
}) {
  if (items.length === 0)
    return (
      <div className="empty">
        <ClipboardList size={28} aria-hidden="true" />
        <h2>Nothing here yet</h2>
        <p>{emptyMessage}</p>
      </div>
    );
  return (
    <ul className="work-list">
      {items.map((item) => (
        <li className="work-item" key={item.id}>
          {item.status === 'done' ? (
            <CircleCheck className="status-icon" size={20} aria-hidden="true" />
          ) : (
            <Circle className="status-icon" size={20} aria-hidden="true" />
          )}
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
