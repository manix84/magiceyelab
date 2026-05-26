import type { Preview } from "@storybook/react-vite";
import MockDate from "mockdate";
import { initialize, mswLoader } from "msw-storybook-addon";
import "../src/styles/global.scss";
import { mswHandlers } from "./msw-handlers";

initialize({ onUnhandledRequest: "bypass" });

const preview: Preview = {
  loaders: [mswLoader],
  parameters: {
    a11y: {
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    msw: {
      handlers: mswHandlers,
    },
  },
  async beforeEach() {
    MockDate.set("2026-05-26T11:05:59Z");
  },
};

export default preview;
