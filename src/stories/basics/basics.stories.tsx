import React from 'react'
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import AddRemoveExample from './add-remove'
import BarebonesExample from './barebones'
import CallbacksExample from './callbacks'
import CanDropExample from './can-drop'
import ModifyNodesExample from './modify-nodes'
import RowDirectionExample from './rtl-support'
import SearchExample from './search'
import TreeDataIOExample from './tree-data-io'
import DarkModeExample from './dark-mode'

const meta: Meta<typeof BarebonesExample> = {
  title: "Basics",
  component: BarebonesExample,
};

export default meta;

type Story = StoryObj<typeof BarebonesExample>;

export const MinimalImplementation: Story = {
  render: () => <BarebonesExample />,
};

export const TreeDataImportExport: Story = {
  render: () => <TreeDataIOExample />,
};

export const AddAndRemoveNodesProgrammatically: Story = {
  render: () => <AddRemoveExample />,
};

export const ModifyNodes: Story = {
  render: () => <ModifyNodesExample />,
};

export const PreventDrop: Story = {
  render: () => <CanDropExample />,
};

export const Search: Story = {
  render: () => <SearchExample />,
};

export const Callbacks: Story = {
  render: () => <CallbacksExample />,
};

export const RowDirectionSupport: Story = {
  render: () => <RowDirectionExample />,
};

export const DarkModeTheme: Story = {
  render: () => <DarkModeExample />,
};
