import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkItemList, Workspace } from './index';
import './styles.css';

const meta = {
  title: 'Work items/List',
  component: WorkItemList,
  args: { onStatusChange: () => undefined },
  decorators: [
    (Story) => (
      <Workspace>
        <Story />
      </Workspace>
    ),
  ],
} satisfies Meta<typeof WorkItemList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = { args: { items: [] } };
export const Mixed: Story = {
  args: {
    items: [
      { id: 'one', title: 'Confirm the acceptance cases', status: 'open' },
      {
        id: 'two',
        title: 'Retain the running-product evidence',
        status: 'done',
      },
    ],
  },
};
export const Pending: Story = { args: { ...Mixed.args, pendingId: 'one' } };
