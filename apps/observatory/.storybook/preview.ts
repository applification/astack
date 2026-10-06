import "@astack/ui/styles.css";
import { createElement } from "react";
import { ThemeProvider, initializeTheme } from "../src/theme";
import type { Preview } from "@storybook/react-vite";

initializeTheme();
export default {
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => createElement(ThemeProvider, null, createElement(Story)),
  ],
} satisfies Preview;
