import { StrictMode, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@astack/ui";
import { OwnerAuthProvider, useOwnerAuth } from "./auth";
import { PrivateAccess } from "./private-access";
import { AccessLayout } from "./theme";

function AuthenticationFixture() {
  const auth = useOwnerAuth();
  const [key, setKey] = useState("");
  if (auth.isLoading)
    return (
      <AccessLayout>
        <h1>Connecting to Observatory</h1>
      </AccessLayout>
    );
  if (auth.isAuthenticated)
    return (
      <AccessLayout>
        <h1>Authenticated fixture</h1>
        <Button onClick={() => void auth.fetchAccessToken()}>
          Refresh session
        </Button>
      </AccessLayout>
    );
  return (
    <PrivateAccess
      offline={auth.state === "offline"}
      value={key}
      onChange={setKey}
      authenticate={auth.authenticate}
    />
  );
}
const meta = {
  title: "Observatory/Authentication",
  component: AuthenticationFixture,
  decorators: [
    (Story) => (
      <StrictMode>
        <OwnerAuthProvider>
          <Story />
        </OwnerAuthProvider>
      </StrictMode>
    ),
  ],
} satisfies Meta<typeof AuthenticationFixture>;
export default meta;
type Story = StoryObj<typeof meta>;
// Tests intercept only the external session endpoint; the real hook and form run.
export const RememberedAccess: Story = {};
