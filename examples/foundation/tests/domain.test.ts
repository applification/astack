import { describe, expect, test } from 'bun:test';
import { titleSchema, WorkItemsResultSchema } from '@foundation/domain';
describe('work-item boundary', () => {
  test('normalizes a title and rejects empty or oversized input', () => {
    expect(titleSchema.parse('  Verify persistence  ')).toBe(
      'Verify persistence',
    );
    expect(titleSchema.safeParse('   ').success).toBe(false);
    expect(titleSchema.safeParse('x'.repeat(161)).success).toBe(false);
  });
  test('rejects malformed host results before they reach presentation', () => {
    expect(
      WorkItemsResultSchema.safeParse({
        items: [{ id: 'one', title: 'Valid', status: 'unknown' }],
      }).success,
    ).toBe(false);
  });
});
