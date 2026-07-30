import type { Meta, StoryObj } from '@storybook/react-vite'
import DarkModeExample from './dark-mode'
import FileExplorerExample from './file-explorer-example'

const meta: Meta<typeof FileExplorerExample> = {
  title: 'Themes',
  component: FileExplorerExample,
}

export default meta

type Story = StoryObj<typeof FileExplorerExample>

export const FileExplorer: Story = {
  render: () => <FileExplorerExample />,
}

export const DarkMode: Story = {
  render: () => <DarkModeExample />,
}
