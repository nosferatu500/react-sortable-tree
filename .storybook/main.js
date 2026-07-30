/** @type {import('@storybook/react-vite').StorybookConfig} */

export default {
  stories: ['../src/**/*.stories.tsx'],

  addons: ['@storybook/addon-links', '@storybook/addon-docs'],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  docs: {},

  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
}
