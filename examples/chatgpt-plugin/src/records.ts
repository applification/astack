import { z } from 'zod';
export const RecordSchema = z.object({ id: z.enum(['alpha', 'beta']), title: z.string(), summary: z.string() });
export const RecordsSchema = z.object({ records: z.array(RecordSchema) });
export type RecordItem = z.infer<typeof RecordSchema>;
export const records: RecordItem[] = [
  { id: 'alpha', title: 'First record', summary: 'A neutral fixture for selection and context.' },
  { id: 'beta', title: 'Second record', summary: 'A second fixture for filtering and deep links.' },
];
export const recordId = z.enum(['alpha', 'beta']);
export const readRecord = (id: string) => {
  const item = records.find(item => item.id === id);
  if (!item) throw new Error('Unknown record');
  return item;
};
