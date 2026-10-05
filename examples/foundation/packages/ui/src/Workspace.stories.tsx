import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { WorkItem } from '@foundation/domain';
import { Button, Input, Notice, WorkItemList, Workspace } from './index';
import './styles.css';

const fixtures: WorkItem[] = [
  { id: 'one', title: 'Confirm the acceptance cases', status: 'open' },
  { id: 'two', title: 'Retain the running-product evidence', status: 'done' },
];

function ReferenceFrame({
  embedded = false,
  state = 'mixed',
  dark = false,
}: {
  embedded?: boolean;
  state?: 'mixed' | 'empty' | 'loading' | 'pending' | 'error';
  dark?: boolean;
}) {
  const [items, setItems] = useState(fixtures);
  return (
    <div className={dark ? 'theme-dark' : undefined}>
      <Workspace embedded={embedded}>
        {!embedded && (
          <>
            <form
              className="create-form"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <div className="field">
                <label htmlFor="title">Title</label>
                <Input id="title" placeholder="What needs doing?" />
              </div>
              <Button type="submit">Add work item</Button>
            </form>
            <nav className="filters" aria-label="Work item filters">
              {['All items', 'Open', 'Done'].map((label, index) => (
                <a
                  href={`?status=${['all', 'open', 'done'][index]}`}
                  key={label}
                  aria-current={index === 0 ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                >
                  {label}
                </a>
              ))}
            </nav>
          </>
        )}
        {state === 'error' && (
          <Notice tone="error">
            Saving failed. Your work item has not been confirmed as changed.
          </Notice>
        )}
        {state === 'loading' ? (
          <Notice>Loading work items…</Notice>
        ) : (
          <WorkItemList
            items={state === 'empty' ? [] : items}
            {...(state === 'pending' ? { pendingId: 'one' } : {})}
            emptyMessage={
              embedded
                ? 'Ask your assistant to add a work item.'
                : 'Add a work item to get started.'
            }
            onStatusChange={(selected) => {
              setItems((current) =>
                current.map((item) =>
                  item.id === selected.id
                    ? {
                        ...item,
                        status: item.status === 'open' ? 'done' : 'open',
                      }
                    : item,
                ),
              );
            }}
          />
        )}
      </Workspace>
    </div>
  );
}

const meta = {
  title: 'Work items/Workspace',
  component: ReferenceFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ReferenceFrame>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WebMixed: Story = {};
export const WebNarrow: Story = {};
export const WebEmpty: Story = { args: { state: 'empty' } };
export const WebLoading: Story = { args: { state: 'loading' } };
export const McpMixed: Story = { args: { embedded: true } };
export const McpDark: Story = { args: { embedded: true, dark: true } };
export const McpSaving: Story = { args: { embedded: true, state: 'pending' } };
export const McpError: Story = { args: { embedded: true, state: 'error' } };
export const McpEmpty: Story = { args: { embedded: true, state: 'empty' } };
