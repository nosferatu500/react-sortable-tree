# React Sortable Tree

![NPM version](https://img.shields.io/npm/v/@nosferatu500/react-sortable-tree.svg?style=flat)
![NPM license](https://img.shields.io/npm/l/@nosferatu500/react-sortable-tree.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/@nosferatu500/react-sortable-tree.svg?style=flat)](https://npmcharts.com/compare/@nosferatu500/react-sortable-tree?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/@nosferatu500/react-sortable-tree.svg?style=flat)](https://npmcharts.com/compare/@nosferatu500/react-sortable-tree?minimal=true)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

Drag-and-drop sortable representation of hierarchical data for React 19 with virtualized rendering powered by [`virtua`](https://github.com/inokawa/virtua) and [`react-dnd`](https://react-dnd.github.io/react-dnd/). [Storybook demos](https://nosferatu500.github.io/react-sortable-tree/) cover both basic and advanced scenarios.

## Getting started

Install the package together with its peer dependencies:

```sh
npm install @nosferatu500/react-sortable-tree react-dnd react-dnd-html5-backend
# or
yarn add @nosferatu500/react-sortable-tree react-dnd react-dnd-html5-backend
```

The bundle is ESM-only and includes all styles via runtime injection (no separate CSS file is required).

## Quick start

```tsx
import { useState } from 'react'
import { SortableTree, TreeItem } from '@nosferatu500/react-sortable-tree'

const initialData: TreeItem[] = [
  { title: 'Chicken', children: [{ title: 'Egg' }] },
  { title: 'Fish', children: [{ title: 'Fingerling' }] },
]

export function ExampleTree() {
  const [treeData, setTreeData] = useState(initialData)

  return (
    <div style={{ height: 400 }}>
      <SortableTree treeData={treeData} onChange={setTreeData} />
    </div>
  )
}
```

Already have a surrounding `react-dnd` context? Use the context-less export instead:

```tsx
import { SortableTreeWithoutDndContext } from '@nosferatu500/react-sortable-tree'
```

## Component props

All props are typed in `ReactSortableTreeProps` (see `src/react-sortable-tree.tsx`).

### Required props

| Prop       | Type                             | Description                                                                       |
| ---------- | -------------------------------- | --------------------------------------------------------------------------------- |
| `treeData` | `TreeItem[]`                     | Array of tree nodes with `{ title?, subtitle?, expanded?, children?, ...custom }` |
| `onChange` | `(treeData: TreeItem[]) => void` | Called on every tree data change                                                  |

### Appearance & layout

| Prop                   | Type                                            | Default | Description                        |
| ---------------------- | ----------------------------------------------- | ------- | ---------------------------------- |
| `rowHeight`            | `number \| ((treeIndex, node, path) => number)` | `62`    | Height of each row in pixels       |
| `rowDirection`         | `'ltr' \| 'rtl'`                                | `'ltr'` | Layout direction                   |
| `scaffoldBlockPxWidth` | `number`                                        | `44`    | Width of indent per level          |
| `slideRegionSize`      | `number`                                        | `100`   | Size of the drag slide region      |
| `style`                | `CSSProperties`                                 | -       | Styles for the outer container     |
| `innerStyle`           | `CSSProperties`                                 | -       | Styles for the virtual list        |
| `className`            | `string`                                        | -       | Class name for the outer container |

### Theming & custom renderers

| Prop                  | Type            | Description                                    |
| --------------------- | --------------- | ---------------------------------------------- |
| `theme`               | `ThemeProps`    | Theme object (see [Theming](#theming) section) |
| `nodeContentRenderer` | `ComponentType` | Custom component for node content              |
| `treeNodeRenderer`    | `ComponentType` | Custom component for the entire tree row       |
| `placeholderRenderer` | `ComponentType` | Custom component for empty tree state          |

### Drag & drop

| Prop                      | Type                               | Default      | Description                            |
| ------------------------- | ---------------------------------- | ------------ | -------------------------------------- |
| `canDrag`                 | `boolean \| ((params) => boolean)` | `true`       | Whether nodes can be dragged           |
| `canDrop`                 | `(params) => boolean`              | -            | Validate if a drop is allowed          |
| `canNodeHaveChildren`     | `(node) => boolean`                | `() => true` | Whether a node can have children       |
| `maxDepth`                | `number`                           | -            | Maximum nesting depth                  |
| `shouldCopyOnOutsideDrop` | `boolean \| ((params) => boolean)` | `false`      | Copy node when dropped outside         |
| `dndType`                 | `string`                           | -            | Custom drag type for multi-tree setups |
| `onMoveNode`              | `(params) => void`                 | -            | Called after a node is moved           |
| `onDragStateChanged`      | `(params) => void`                 | -            | Called when drag state changes         |

### Search

| Prop                      | Type                  | Description                     |
| ------------------------- | --------------------- | ------------------------------- |
| `searchQuery`             | `string`              | Search query string             |
| `searchMethod`            | `(params) => boolean` | Custom search matching function |
| `searchFocusOffset`       | `number`              | Index of the focused match      |
| `searchFinishCallback`    | `(matches) => void`   | Called when search completes    |
| `onlyExpandSearchedNodes` | `boolean`             | Collapse non-matching paths     |

### Other

| Prop                        | Type                         | Description                         |
| --------------------------- | ---------------------------- | ----------------------------------- |
| `generateNodeProps`         | `(params) => object`         | Add custom props to each node       |
| `getNodeKey`                | `(node) => string \| number` | Generate stable node keys           |
| `onVisibilityToggle`        | `(params) => void`           | Called when node expands/collapses  |
| `loadCollapsedLazyChildren` | `boolean`                    | Load lazy children before expanding |
| `virtuaRef`                 | `RefObject<VListHandle>`     | Direct access to the virtual list   |
| `dragDropManager`           | `object`                     | External react-dnd manager          |

## Theming

The component supports theming through CSS variables, the `theme` prop, and custom renderers.

### CSS Variables

Override these CSS variables on the `.rst__tree` class or a parent element:

```css
.my-custom-theme .rst__tree {
  --rst-row-height: 62px;
  --rst-block-width: 44px;
  --rst-handle-width: 44px;
  --rst-line-color: #000;
  --rst-line-highlight: #36c2f6;
  --rst-line-highlight-arrow: white;
  --rst-primary-color: #36c2f6;
  --rst-focus-color: #fc6421;
  --rst-match-color: #0080ff;
  --rst-bg-landing: lightblue;
  --rst-bg-cancel: #e6a8ad;
  --rst-text-color: #333;
  --rst-icon-color: #6db3f2;
  --rst-button-bg: #fff;
  --rst-button-border: #989898;
}
```

### Theme prop

The `theme` prop accepts an object with these properties:

```ts
type ThemeProps = {
  style?: React.CSSProperties
  innerStyle?: React.CSSProperties
  scaffoldBlockPxWidth?: number
  slideRegionSize?: number
  treeNodeRenderer?: React.ComponentType
  nodeContentRenderer?: React.ComponentType
  placeholderRenderer?: React.ComponentType
  dndType?: string
}
```

Theme values are merged with component props, with direct props taking precedence.

### Example: File Explorer Theme

The library includes a File Explorer theme example in the Storybook demos:

```tsx
import { SortableTree } from '@nosferatu500/react-sortable-tree'
import {
  fileExplorerTheme,
  FILE_EXPLORER_THEME_CLASS,
} from './themes/file-explorer'

function FileTree() {
  const [treeData, setTreeData] = useState([
    {
      title: 'src',
      isDirectory: true,
      expanded: true,
      children: [{ title: 'index.ts' }, { title: 'App.tsx' }],
    },
    { title: 'package.json' },
  ])

  return (
    <div className={FILE_EXPLORER_THEME_CLASS}>
      <SortableTree
        treeData={treeData}
        onChange={setTreeData}
        theme={fileExplorerTheme}
        rowHeight={28}
        // Only folders can have children
        canNodeHaveChildren={(node) => node.isDirectory === true}
        // Only allow dropping into folders
        canDrop={({ nextParent }) =>
          !nextParent || nextParent.isDirectory === true
        }
      />
    </div>
  )
}
```

For dark mode, add the `rst__file-explorer-dark` class to the wrapper.

### Creating custom themes

To create a custom theme:

1. Create a custom `nodeContentRenderer` component (see `src/node-renderer-default.tsx` for reference)
2. Add CSS styles with your theme class
3. Export a theme object:

```ts
export const myTheme = {
  nodeContentRenderer: MyCustomNodeRenderer,
  scaffoldBlockPxWidth: 24,
  slideRegionSize: 50,
}
```

## Data helper functions

Utilities exported from the package:

### Node manipulation

- `addNodeUnderParent({ treeData, newNode, parentKey, getNodeKey, expandParent?, addAsFirstChild? })` - Add a node under a parent
- `insertNode({ treeData, newNode, depth, minimumTreeIndex, getNodeKey, expandParent? })` - Insert a node at a specific position
- `removeNode({ treeData, path, getNodeKey })` - Remove a node by path
- `removeNodeAtPath({ treeData, path, getNodeKey })` - Remove a node at exact path
- `changeNodeAtPath({ treeData, path, newNode, getNodeKey })` - Update a node at path

### Tree inspection

- `getNodeAtPath({ treeData, path, getNodeKey })` - Get node at path
- `getDescendantCount({ node })` - Count all descendants
- `getDepth(node)` - Get nesting depth of a node
- `isDescendant(older, younger)` - Check parent-child relationship
- `getVisibleNodeCount({ treeData })` - Count visible (expanded) nodes

### Tree traversal

- `walk({ treeData, getNodeKey, callback, ignoreCollapsed? })` - Walk tree depth-first
- `map({ treeData, getNodeKey, callback, ignoreCollapsed? })` - Transform all nodes
- `toggleExpandedForAll({ treeData, expanded })` - Expand or collapse all nodes
- `find({ treeData, getNodeKey, searchQuery, searchMethod, expandAllMatchPaths? })` - Search with path expansion

### Data conversion

- `getFlatDataFromTree({ treeData, getNodeKey, ignoreCollapsed? })` - Convert to flat array
- `getTreeFromFlatData({ flatData, getKey, getParentKey, rootKey? })` - Convert from flat array

### Default handlers

- `defaultGetNodeKey({ treeIndex })` - Default key generator (uses index)
- `defaultSearchMethod({ node, searchQuery })` - Default search (matches title)

## License

MIT
