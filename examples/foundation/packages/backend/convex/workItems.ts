import { titleSchema } from '@foundation/domain';
import type { WorkItem } from '@foundation/domain';
import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { denyUnavailableItem, requireUser } from './lib/identity';

const statusValidator = v.union(v.literal('open'), v.literal('done'));
const workItemValidator = v.object({
  id: v.string(),
  title: v.string(),
  status: statusValidator,
});

export const list = query({
  args: {},
  returns: v.array(workItemValidator),
  handler: async (ctx): Promise<WorkItem[]> => {
    const identity = await requireUser(ctx.auth);
    const rows = await ctx.db
      .query('workItems')
      .withIndex('by_owner', (q) => q.eq('owner', identity.subject))
      .order('desc')
      .take(100);
    return rows.map((row) => ({
      id: row._id,
      title: row.title,
      status: row.status,
    }));
  },
});

export const create = mutation({
  args: { title: v.string() },
  returns: workItemValidator,
  handler: async (ctx, args): Promise<WorkItem> => {
    const identity = await requireUser(ctx.auth);
    const parsed = titleSchema.safeParse(args.title);
    if (!parsed.success) {
      throw new ConvexError({
        code: 'INVALID_TITLE',
        message: 'Enter a valid, non-empty work item title.',
      });
    }
    const id = await ctx.db.insert('workItems', {
      title: parsed.data,
      status: 'open',
      owner: identity.subject,
    });
    return { id, title: parsed.data, status: 'open' };
  },
});

export const setStatus = mutation({
  args: { id: v.id('workItems'), status: statusValidator },
  returns: workItemValidator,
  handler: async (ctx, args): Promise<WorkItem> => {
    const identity = await requireUser(ctx.auth);
    const row = await ctx.db.get(args.id);
    if (row === null || row.owner !== identity.subject) denyUnavailableItem();
    await ctx.db.patch(args.id, { status: args.status });
    return { id: row._id, title: row.title, status: args.status };
  },
});

export const deleteItem = mutation({
  args: { id: v.id('workItems') },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const identity = await requireUser(ctx.auth);
    const row = await ctx.db.get(args.id);
    if (row === null || row.owner !== identity.subject) denyUnavailableItem();
    await ctx.db.delete(args.id);
    return null;
  },
});
