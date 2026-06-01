import type { Preview } from "@storybook/react-vite";
import "../css/app.css";
import "../src/styles/app.scss";

const preview: Preview = {
  parameters: {
    a11y: {
      test: "todo",
    },
    backgrounds: {
      default: "operational",
      values: [
        { name: "operational", value: "#070909" },
        { name: "panel", value: "#0a1012" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
