import { useRef, useState } from 'react';
import { useAuth } from '@workos-inc/authkit-react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { Link } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { api } from '@foundation/backend/api';
import type { Id } from '@foundation/backend/types';
import { z } from 'zod';
import { errorMessage, titleSchema } from '@foundation/domain';
import type { WorkItem } from '@foundation/domain';
import { Button, Input, Notice, WorkItemList, Workspace } from '@foundation/ui';

function LoginButton() {
  const { signIn } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function login() {
    setPending(true);
    setError(undefined);
    try {
      await signIn();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          login().catch((failure: unknown) => {
            setError(errorMessage(failure));
          });
        }}
      >
        {pending ? 'Opening sign in…' : 'Sign in'}
      </Button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
function CreateForm({
  onCreate,
}: {
  onCreate: (title: string) => Promise<unknown>;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { title: '' },
    validators: { onChange: z.object({ title: titleSchema }) },
    onSubmit: async ({ value }) => {
      setError(undefined);
      try {
        await onCreate(titleSchema.parse(value.title));
        form.reset();
      } catch (failure) {
        setError(errorMessage(failure));
      }
    },
  });
  return (
    <form
      className="create-form"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit().catch((failure: unknown) => {
          setError(errorMessage(failure));
        });
      }}
    >
      <form.Field name="title">
        {(field) => (
          <div className="field">
            <label htmlFor="title">Title</label>
            <Input
              id="title"
              name="title"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value);
              }}
              aria-describedby={
                field.state.meta.errors.length ? 'title-error' : undefined
              }
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.isTouched &&
              field.state.meta.errors.length > 0 && (
                <p id="title-error" className="error">
                  {field.state.meta.errors
                    .map((issue) => issue?.message)
                    .join(', ')}
                </p>
              )}
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <Button type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add work item'}
          </Button>
        )}
      </form.Subscribe>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
export function WorkItemsFeature({
  status,
}: {
  status: 'all' | 'open' | 'done';
}) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const items = useQuery(api.workItems.list, isAuthenticated ? {} : 'skip');
  const create = useMutation(api.workItems.create);
  const changeStatus = useMutation(api.workItems.setStatus);
  const [pendingId, setPendingId] = useState<string>();
  const saving = useRef(false);
  const [error, setError] = useState<string>();
  async function toggle(item: WorkItem) {
    if (saving.current) return;
    saving.current = true;
    setPendingId(item.id);
    setError(undefined);
    try {
      await changeStatus({
        // The portable DTO has a string ID; Convex's v.id validator checks it at the boundary.
        id: item.id as Id<'workItems'>,
        status: item.status === 'open' ? 'done' : 'open',
      });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      saving.current = false;
      setPendingId(undefined);
    }
  }
  return (
    <Workspace>
      {isLoading ? (
        <Notice>Checking your session…</Notice>
      ) : !isAuthenticated ? (
        <>
          <Notice>Sign in to access your private work items.</Notice>
          <LoginButton />
        </>
      ) : (
        <>
          <CreateForm onCreate={(title) => create({ title })} />
          <nav className="filters" aria-label="Work item filters">
            {(['all', 'open', 'done'] as const).map((filter) => (
              <Link
                to="/"
                search={{ status: filter }}
                key={filter}
                aria-current={filter === status ? 'page' : undefined}
              >
                {filter === 'all'
                  ? 'All items'
                  : filter === 'open'
                    ? 'Open'
                    : 'Done'}
              </Link>
            ))}
          </nav>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {items ? (
            <WorkItemList
              items={items.filter(
                (item) => status === 'all' || item.status === status,
              )}
              {...(pendingId ? { pendingId } : {})}
              onStatusChange={(item) => {
                toggle(item).catch((failure: unknown) => {
                  setError(errorMessage(failure));
                });
              }}
            />
          ) : (
            <Notice>Loading work items…</Notice>
          )}
        </>
      )}
    </Workspace>
  );
}
