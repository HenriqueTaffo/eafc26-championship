import type { StorybookConfig } from "@storybook/react-vite";

process.env.STORYBOOK = "true";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx|mdx)"],
  addons: ["@storybook/addon-a11y", "@chromatic-com/storybook"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  async viteFinal(viteConfig) {
    const stripPwaPlugins = (plugins: NonNullable<typeof viteConfig.plugins>) =>
      plugins.flatMap((plugin) => {
        if (!plugin) return [];
        if (Array.isArray(plugin)) return stripPwaPlugins(plugin);
        return plugin.name === "vite-plugin-pwa" ? [] : [plugin];
      });

    viteConfig.plugins = stripPwaPlugins(viteConfig.plugins || []);

    return viteConfig;
  },
};

export default config;
