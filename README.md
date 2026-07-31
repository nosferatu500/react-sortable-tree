# React Sortable Tree

![NPM version](https://img.shields.io/npm/v/@nosferatu500/react-sortable-tree.svg?style=flat)
![NPM license](https://img.shields.io/npm/l/@nosferatu500/react-sortable-tree.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/@nosferatu500/react-sortable-tree.svg?style=flat)](https://npmcharts.com/compare/@nosferatu500/react-sortable-tree?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/@nosferatu500/react-sortable-tree.svg?style=flat)](https://npmcharts.com/compare/@nosferatu500/react-sortable-tree?minimal=true)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

Drag-and-drop sortable representation of hierarchical data for React 19 with virtualized rendering powered by [`virtua`](https://github.com/inokawa/virtua) and [`react-dnd`](https://react-dnd.github.io/react-dnd/). [Storybook demos](https://nosferatu500.github.io/react-sortable-tree/) cover both basic and advanced scenarios.

## Why this fork

This is a maintained fork of [`react-sortable-tree`](https://www.npmjs.com/package/react-sortable-tree)
by Chris Fritz, carrying its full git history. Upstream's last release was
**v2.8.0 in August 2020**, targeting React 16; this fork started in June 2021 to add
React 17 support and has been maintained since. The comparison below is against that
last upstream release. The component API is recognisably the same; everything underneath
has been rebuilt.

|                      | original v2.8.0 (Aug 2020)                         | this fork v6                                                   |
| -------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| Maintenance          | no releases since 2020                             | actively maintained                                            |
| React                | 16                                                 | 19 (incl. React Compiler)                                      |
| Components           | class components                                   | function components + hooks                                    |
| TypeScript           | none bundled — needed `@types/react-sortable-tree` | written in TS, `.d.ts` shipped                                 |
| Accessibility        | one `aria-label`, no keyboard support              | full ARIA tree pattern + [keyboard navigation](#accessibility) |
| Virtualization       | `react-virtualized`                                | `virtua`                                                       |
| `react-dnd`          | 11                                                 | 16                                                             |
| Runtime dependencies | 7                                                  | 3                                                              |
| Module format        | CJS + ESM                                          | ESM only                                                       |
| Styling              | plain CSS                                          | CSS custom properties, `@property`, `@layer`                   |
| Tests                | Jest                                               | Vitest, 164 tests                                              |

Dropped along the way: `prop-types`, `lodash.isequal`, `react-lifecycles-compat`,
`react-dnd-scrollzone`, and (in v6) `immer`.

Beyond the table, v6 rewrote the tree-mutation internals — `changeNodeAtPath` is ~70×
faster and a drag hover ~6.5× cheaper on a 10k-node tree — and stopped remounting every
row on each parent render. Two long-standing correctness bugs were fixed in the process.
See [CHANGELOG.md](./CHANGELOG.md) for measurements and [MODERNIZATION.md](./MODERNIZATION.md)
for what is still planned.

**Migrating from the original?** You still import a stylesheet, just from the scoped
name (`import '@nosferatu500/react-sortable-tree/style.css'`). The main API change is
that `SortableTree` is a named export rather than the default. Props tied to the old
`react-virtualized` list no longer exist; `virtuaRef` exposes the virtual list instead.
The per-version migration notes in [CHANGELOG.md](./CHANGELOG.md) cover the rest.

## Benchmarks

Measured against the original release and against
[`@minoru/react-dnd-treeview`](https://github.com/minop1205/react-dnd-treeview), the
other actively maintained `react-dnd` tree for React. Same tree, same 600×900 viewport,
same 62px rows, same `react-dnd` HTML5 backend, real Chrome. The harness, the exact
method and its known asymmetries live in [benchmark/](./benchmark/) — `npm run bench`
reproduces every number below into
[benchmark/results.json](./benchmark/results.json).

The original is benchmarked on React 16.14, the newest React its peer range allows;
the other two on React 19.2.

### Shipping cost

|                                                           | this fork v6.0.0 | react-sortable-tree v2.8.0 | @minoru/react-dnd-treeview v3.5.4 |
| --------------------------------------------------------- | ---------------- | -------------------------- | --------------------------------- |
| JS, minified + gzipped (library alone)                    | **15.3 kB**      | 46.4 kB                    | 52.2 kB                           |
| JS, minified + gzipped (with `react-dnd` + HTML5 backend) | **28.0 kB**      | 65.0 kB                    | 64.4 kB                           |
| Stylesheet, gzipped                                       | 2.5 kB           | 3.2 kB                     | none (headless)                   |
| npm packages installed                                    | **13**           | 30                         | 20                                |
| `node_modules` on disk                                    | **5.1 MB**       | 12.9 MB                    | 14.6 MB                           |
| React versions supported                                  | 19               | 16 only                    | 18, 19                            |

### Runtime

Main-thread CPU time, median of 5 runs. A "group" is 1/10th of the tree, so expanding one
at 10,000 nodes reveals 999 rows.

| Nodes  | Library             | Mount CPU  | Expand a group | Scroll top→bottom CPU | DOM elements | Event listeners | JS heap    |
| ------ | ------------------- | ---------- | -------------- | --------------------- | ------------ | --------------- | ---------- |
| 100    | this fork           | **4.6 ms** | 2.6 ms         | 70.2 ms               | **177**      | 253             | **3.0 MB** |
| 100    | react-sortable-tree | 4.8 ms     | **2.2 ms**     | 60.4 ms               | 253          | **199**         | 3.2 MB     |
| 100    | @minoru             | 7.2 ms     | 3.4 ms         | **18.1 ms**           | 322          | 993             | 4.0 MB     |
| 1,000  | this fork           | **4.4 ms** | 2.7 ms         | 111 ms                | **175**      | 251             | **3.5 MB** |
| 1,000  | react-sortable-tree | 4.5 ms     | **2.3 ms**     | 134 ms                | 251          | **197**         | 3.9 MB     |
| 1,000  | @minoru             | 63.6 ms    | 23.4 ms        | **26.9 ms**           | 3,022        | 8,193           | 16.1 MB    |
| 10,000 | this fork           | **7.7 ms** | 5.8 ms         | 102 ms                | **175**      | 251             | 8.0 MB     |
| 10,000 | react-sortable-tree | 9.1 ms     | **4.5 ms**     | 115 ms                | 251          | **197**         | **6.2 MB** |
| 10,000 | @minoru             | 2,504 ms   | 547 ms         | **52.4 ms**           | 30,022       | 80,193          | 135.7 MB   |

Time until rows are actually on screen, which includes waiting for a display frame:

| Nodes  | this fork | react-sortable-tree | @minoru/react-dnd-treeview |
| ------ | --------- | ------------------- | -------------------------- |
| 100    | 11.9 ms   | **4.3 ms**          | 7.3 ms                     |
| 1,000  | 12.2 ms   | **4.4 ms**          | 62.8 ms                    |
| 10,000 | 10.9 ms   | **8.7 ms**          | 2,520 ms                   |

### Reading the results

**Where this fork wins.** A third of the bytes of either alternative, less than half the
install footprint, and a flat cost curve: mounting 10,000 nodes takes 7.7 ms because only
13 rows are ever in the DOM. Against `@minoru` at 10,000 nodes that is ~325× less mount
CPU, ~95× cheaper expands, ~170× fewer DOM elements and ~17× less heap. It is also the
only one of the three implementing the ARIA tree pattern — `role="treeitem"` with
`aria-level`/`aria-setsize`/`aria-posinset`/`aria-expanded`, a roving tabindex and arrow-key
navigation. The original exposes rows as `react-virtualized` grid cells (`role="gridcell"`
inside `role="grid"`), `@minoru` as `<li role="listitem">`; in neither are rows focusable.

**Where this fork loses.** Rows appear roughly one frame later than the original at small
sizes (11.9 ms vs 4.3 ms at 100 nodes) because `virtua` measures its viewport from a
ResizeObserver before it can fill it. At 10,000 nodes it holds more heap than the original
(8.0 MB vs 6.2 MB) and keeps slightly more event listeners per viewport. Scrolling costs
real CPU — ~102 ms to sweep the whole tree, against `@minoru`'s ~52 ms, because rows are
re-rendered as they come into view instead of already existing. And it is React 19 only:
`@minoru` still supports React 18, and both modern libraries are ESM-only.

**When to pick `@minoru/react-dnd-treeview` instead.** It is the right call for small
trees where you want full markup control: it ships no CSS, animates expand/collapse with
`framer-motion`, bundles multi-backend touch support, and supports React 18. Scrolling is
cheaper because nothing re-renders. The cost is that everything is in the DOM — at 10,000
nodes that is 30,022 elements, 80,193 listeners, 136 MB of heap and a 2.5 second mount that
blocks the main thread. Even 1,000 nodes take 63.6 ms to mount, past the frame budget. It
also has no built-in search, no ARIA tree semantics and no keyboard navigation.

**The original v2.8.0** is a reasonable choice only if you are pinned to React 16. It
remains competitive on runtime — this is a fork of it, and virtualization is doing the work
in both — but it was last published in August 2020, ships no TypeScript types, and pulls in
30 packages.

**Drag and drop is pointer-only in all three.** None of them supports keyboard-driven
reordering; this fork adds keyboard navigation and focus management, not keyboard dragging.

## Getting started

Install the package together with its peer dependencies:

```sh
npm install @nosferatu500/react-sortable-tree react-dnd react-dnd-html5-backend
# or
yarn add @nosferatu500/react-sortable-tree react-dnd react-dnd-html5-backend
```

Then import the stylesheet once, anywhere in your app:

```js
import '@nosferatu500/react-sortable-tree/style.css'
```

The bundle is ESM-only. Styles ship as a real stylesheet rather than being injected at
runtime, so they work with a strict Content-Security-Policy, are present in
server-rendered HTML, and are minified and cached by your own build.

## Quick start

```tsx
import { useState } from 'react'
import { SortableTree, TreeItem } from '@nosferatu500/react-sortable-tree'
import '@nosferatu500/react-sortable-tree/style.css'

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

### Accessibility

| Prop                 | Type      | Default | Description                                      |
| -------------------- | --------- | ------- | ------------------------------------------------ |
| `aria-label`         | `string`  | -       | Accessible name for the tree                     |
| `aria-labelledby`    | `string`  | -       | Id of an element naming the tree                 |
| `keyboardNavigation` | `boolean` | `true`  | Set to `false` to opt out of built-in arrow keys |

## Accessibility

The tree implements the [WAI-ARIA tree view pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/).
Give it an accessible name — everything else is automatic:

```tsx
<SortableTree
  aria-label="Project files"
  treeData={treeData}
  onChange={setTreeData}
/>
```

Rows are exposed as `role="treeitem"` with `aria-level`, `aria-setsize`,
`aria-posinset`, and `aria-expanded` (the last only on nodes that actually have
children). Because the list is virtualized the DOM is flat, so depth and position are
stated explicitly rather than implied by nesting.

### Keyboard

One row is in the tab sequence at a time — a roving tabindex — so tabbing into the tree
lands on the active row and tabbing again leaves it.

| Key                                 | Action                                              |
| ----------------------------------- | --------------------------------------------------- |
| <kbd>↓</kbd> / <kbd>↑</kbd>         | Move to the next / previous visible row             |
| <kbd>→</kbd>                        | Expand a collapsed node, or move to its first child |
| <kbd>←</kbd>                        | Collapse an expanded node, or move to its parent    |
| <kbd>Home</kbd> / <kbd>End</kbd>    | Move to the first / last visible row                |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | Toggle the focused node                             |

<kbd>←</kbd> and <kbd>→</kbd> swap roles when `rowDirection="rtl"`. Keys the tree does
not handle are left alone, and keystrokes originating in an `input`, `textarea`,
`select`, or `contenteditable` inside a row are never intercepted — so inline renaming
keeps working.

Expanding or collapsing via the keyboard goes through the same `onChange` and
`onVisibilityToggle` callbacks as clicking the toggle.

Pass `keyboardNavigation={false}` to handle the arrow keys yourself; the ARIA roles and
the roving tabindex stay in place.

> **Drag and drop is still pointer-only.** Keyboard-accessible reordering needs a drag
> backend with a keyboard sensor, which is tracked as part of the planned move off
> `react-dnd`.

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

Every variable is declared with `@property`, so an invalid value falls back to the
default instead of collapsing the layout.

### Overriding rules with `@layer`

All of the component's rules live in a `rst` cascade layer. Unlayered CSS always beats
layered CSS regardless of specificity, so your own rules win without `!important` or
selector escalation:

```css
/* No .rst__tree prefix, no !important — this just wins. */
.rst__row {
  border-radius: 8px;
}
```

If you use cascade layers yourself, order `rst` explicitly to place it relative to your
own layers:

```css
@layer rst, components, utilities;
```

### Theme prop

The `theme` prop accepts an object with these properties:

```ts
type ThemeProps = {
  style?: React.CSSProperties
  innerStyle?: React.CSSProperties
  scaffoldBlockPxWidth?: number
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
