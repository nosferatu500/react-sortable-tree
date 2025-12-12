

# React Sortable Tree

![NPM version](https://img.shields.io/npm/v/@nosferatu500/react-sortable-tree.svg?style=flat)
![NPM license](https://img.shields.io/npm/l/@nosferatu500/react-sortable-tree.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/@nosferatu500/react-sortable-tree.svg?style=flat)](https://npmcharts.com/compare/@nosferatu500/react-sortable-tree?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/@nosferatu500/react-sortable-tree.svg?style=flat)](https://npmcharts.com/compare/@nosferatu500/react-sortable-tree?minimal=true)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

Drag-and-drop sortable representation of hierarchical data for React 18/19 with virtualized rendering powered by [`virtua`](https://github.com/wellyshen/virtua) and [`react-dnd`](https://react-dnd.github.io/react-dnd/). [Storybook demos](https://nosferatu500.github.io/react-sortable-tree/) cover both basic and advanced scenarios.

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
import SortableTree, { TreeItem } from '@nosferatu500/react-sortable-tree'

const initialData: TreeItem[] = [
  { title: 'Chicken', children: [{ title: 'Egg' }] },
  { title: 'Fish', children: [{ title: 'Fingerling' }] },
]

export function ExampleTree() {
  const [treeData, setTreeData] = useState(initialData)

  return (
    <div style={{ height: 400 }}>
      <SortableTree
        treeData={treeData}
        onChange={setTreeData}
        getNodeKey={({ node }) => node.id ?? node.title}
      />
    </div>
  )
}
```

Already have a surrounding `react-dnd` context? Use the context-less export instead:

```tsx
import { SortableTreeWithoutDndContext } from '@nosferatu500/react-sortable-tree'
```

## Component props

All props are typed in `ReactSortableTreeProps` (see `src/react-sortable-tree.tsx`). Key options:

- `treeData` (required): array of `TreeItem` objects `{ title?, subtitle?, expanded?, children? }`.
- `onChange` (required): `(treeData) => void` called on every change.
- `getNodeKey`: `(data) => string | number` to generate stable paths (defaults to index).
- `generateNodeProps`: customize nodes (buttons, styles, extra props).
- Drag & drop control: `canDrag`, `canDrop`, `canNodeHaveChildren`, `shouldCopyOnOutsideDrop`, `onMoveNode`, `onDragStateChanged`, `dndType`.
- Appearance & layout: `rowHeight` (number or function), `rowDirection` (`'ltr' | 'rtl'`), `scaffoldBlockPxWidth`, `slideRegionSize`, `style`, `innerStyle`, `className`, `theme`, `nodeContentRenderer`, `placeholderRenderer`, `treeNodeRenderer`, `virtuaRef` for direct access to the virtual list.
- Search: `searchQuery`, `searchMethod`, `searchFocusOffset`, `onlyExpandSearchedNodes`, `searchFinishCallback`.
- Behavior: `maxDepth`, `loadCollapsedLazyChildren`, `onVisibilityToggle`.
- Integration: `dragDropManager` for external `react-dnd` providers.

## Data helper functions

Utilities exported from `src/utils/tree-data-utils.ts`:

- `addNodeUnderParent`, `insertNode`: place a node under a path with depth control.
- `removeNode`, `removeNodeAtPath`, `changeNodeAtPath`: update or delete nodes immutably.
- `getNodeAtPath`, `getDescendantCount`, `getDepth`: inspect tree structure.
- `map`, `walk`, `toggleExpandedForAll`: traverse or mutate trees.
- `getFlatDataFromTree`, `getTreeFromFlatData`: convert between nested and flat data.
- `getVisibleNodeCount`, `getVisibleNodeInfoAtIndex`, `find`: search and pagination helpers.
- `isDescendant`: check parent-child relationships.

Default helpers from `src/utils/default-handlers.ts` include `defaultGetNodeKey` and `defaultSearchMethod`.

## License

MIT
