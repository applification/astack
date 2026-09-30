import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { RecordList } from './RecordList';
import { records } from '../records';
const meta = { title: 'Reference/Records', component: RecordList,
  args: { items: records, onSelect: () => {} },
  render: args => { const [, update] = useArgs(); return <RecordList {...args} onSelect={id => update({ selectedId: id })} />; } } satisfies Meta<typeof RecordList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const Selected: Story = { args: { selectedId: 'alpha' } };
export const Empty: Story = { args: { items: [] } };
export const Error: Story = { args: { error: 'Unable to load the latest records.' } };
