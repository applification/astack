import { z } from 'zod';

export const titleSchema = z
  .string()
  .trim()
  .min(1, 'Enter a title.')
  .max(160, 'Use at most 160 characters.');
export const statusSchema = z.enum(['open', 'done']);
export const WorkItemSchema = z.object({
  id: z.string().min(1),
  title: titleSchema,
  status: statusSchema,
});
export const WorkItemsResultSchema = z.object({
  items: z.array(WorkItemSchema),
});
export type WorkItem = z.infer<typeof WorkItemSchema>;
export type WorkStatus = z.infer<typeof statusSchema>;
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Try again.';
