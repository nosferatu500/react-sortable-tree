import type { Meta, StoryObj } from '@storybook/react-vite'
import KeyboardNavigationExample from './keyboard-navigation'

const meta: Meta<typeof KeyboardNavigationExample> = {
  title: 'Accessibility',
  component: KeyboardNavigationExample,
}

export default meta

type Story = StoryObj<typeof KeyboardNavigationExample>

export const KeyboardNavigation: Story = {
  render: () => <KeyboardNavigationExample />,
}
