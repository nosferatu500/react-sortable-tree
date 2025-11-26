import React from 'react'
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import BarebonesExampleNoContext from './barebones-no-context'
import ChildlessNodes from './childless-nodes'
import DragOutToRemoveExample from './drag-out-to-remove'
import ExternalNodeExample from './external-node'
import GenerateNodePropsExample from './generate-node-props'
import OnlyExpandSearchedNodesExample from './only-expand-searched-node'
import TouchSupportExample from './touch-support'
import TreeToTreeExample from './tree-to-tree'

const meta: Meta<typeof ExternalNodeExample> = {
  title: "Advanced",
  component: ExternalNodeExample,
};

export default meta;

type Story = StoryObj<typeof ExternalNodeExample>;

export const DragFromExternalSource: Story = {
  render: () => <ExternalNodeExample />,
};

export const TouchSupport: Story = {
  render: () => <TouchSupportExample />,
};

export const TreeToTreeDragging: Story = {
  render: () => <TreeToTreeExample />,
};

export const PlayingWithGenerateNodeProps: Story = {
  render: () => <GenerateNodePropsExample />,
};

export const DragOutToRemove: Story = {
  render: () => <DragOutToRemoveExample />,
};

export const OnlyExpandSearchedNodes: Story = {
  render: () => <OnlyExpandSearchedNodesExample />,
};

export const PreventSomeNodesFromHavingChildren: Story = {
  render: () => <ChildlessNodes />,
};

export const MinimalImplementationWithoutDndContext: Story = {
  render: () => <BarebonesExampleNoContext />,
};
