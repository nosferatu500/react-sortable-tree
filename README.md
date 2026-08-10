# React Sortable Tree

[![CI](https://github.com/nosferatu500/react-sortable-tree/actions/workflows/ci.yml/badge.svg)](https://github.com/nosferatu500/react-sortable-tree/actions/workflows/ci.yml)
![NPM version](https://img.shields.io/npm/v/@nosferatu500/react-sortable-tree.svg?style=flat)
![NPM license](https://img.shields.io/npm/l/@nosferatu500/react-sortable-tree.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/@nosferatu500/react-sortable-tree.svg?style=flat)](https://npmcharts.com/compare/@nosferatu500/react-sortable-tree?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/@nosferatu500/react-sortable-tree.svg?style=flat)](https://npmcharts.com/compare/@nosferatu500/react-sortable-tree?minimal=true)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

Drag-and-drop sortable representation of hierarchical data for React 19, usable by mouse, touch **and keyboard**, with virtualized rendering powered by [`virtua`](https://github.com/inokawa/virtua) and drag-and-drop by [`@nosferatu500/react-dnd`](https://github.com/nosferatu500/react-dnd). [Storybook demos](https://nosferatu500.github.io/react-sortable-tree/) cover both basic and advanced scenarios.

## Why this fork

This is a maintained fork of [`react-sortable-tree`](https://www.npmjs.com/package/react-sortable-tree)
by Chris Fritz, carrying its full git history. Upstream's last release was
**v2.8.0 in August 2020**, targeting React 16; this fork started in June 2021 to add
React 17 support and has been maintained since. The comparison below is against that
last upstream release. The component API is recognisably the same; everything underneath
has been rebuilt.

|                      | original v2.8.0 (Aug 2020)                         | this fork v7                                                                        |
| -------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Maintenance          | no releases since 2020                             | actively maintained                                                                 |
| React                | 16                                                 | 19 (incl. React Compiler)                                                           |
| Components           | class components                                   | function components + hooks                                                         |
| TypeScript           | none bundled — needed `@types/react-sortable-tree` | written in TS, `.d.ts` shipped                                                      |
| Accessibility        | one `aria-label`, no keyboard support              | full ARIA tree pattern, [keyboard navigation **and drag and drop**](#accessibility) |
| Virtualization       | `react-virtualized`                                | `virtua`                                                                            |
| Drag and drop        | `react-dnd` 11                                     | `@nosferatu500/react-dnd` 19 — a maintained fork                                    |
| Runtime dependencies | 7                                                  | 4                                                                                   |
| Module format        | CJS + ESM                                          | ESM only                                                                            |
| Styling              | plain CSS                                          | CSS custom properties, `@property`, `@layer`                                        |
| Tests                | Jest                                               | Vitest, 212 tests                                                                   |

**Migrating from the original?** You still import a stylesheet, just from the scoped
name (`import '@nosferatu500/react-sortable-tree/style.css'`). The main API change is
that `SortableTree` is a named export rather than the default. Props tied to the old
`react-virtualized` list no longer exist; `virtuaRef` exposes the virtual list instead.
The per-version migration notes in [CHANGELOG.md](./CHANGELOG.md) cover the rest.

## Benchmarks

Measured against the original release and against
[`@minoru/react-dnd-treeview`](https://github.com/minop1205/react-dnd-treeview), the
other actively maintained `react-dnd` tree for React. Same tree, same 600×900 viewport,
same 62px rows, an HTML5 drag-and-drop backend in all three, real Chrome. The harness,
the exact method and its known asymmetries live in [benchmark/](./benchmark/):

```sh
npm run bench:setup   # build + pack the fork, install the three workspaces
npm run bench         # writes benchmark/results.json and RESULTS.md
```

The original is benchmarked on React 16.14, the newest React its peer range allows;
the other two on React 19.2. Note the drag-and-drop layers differ by necessity: this fork
is on `@nosferatu500/react-dnd` 19 plus its keyboard backend, the other two on upstream
`react-dnd` 16. Medians of 11 runs after a discarded warm-up, on an Apple M4. A figure is
only **bolded** as a win where the winner's slowest run still beat the runner-up's fastest
run — `results.json` keeps the min/max behind every median so that test is reproducible
rather than a judgement call.

### Shipping cost

|                                                           | this fork v7.0.0 | react-sortable-tree v2.8.0 | @minoru/react-dnd-treeview v3.5.4 |
| --------------------------------------------------------- | ---------------- | -------------------------- | --------------------------------- |
| JS, minified + gzipped (library alone)                    | **16.0 kB**      | 46.5 kB                    | 52.2 kB                           |
| JS, minified + gzipped (with `react-dnd` + HTML5 backend) | **30.9 kB**      | 65.0 kB                    | 64.5 kB                           |
| Stylesheet, gzipped                                       | **2.5 kB**       | 3.2 kB                     | none (headless)                   |
| npm packages installed                                    | **8**            | 30                         | 20                                |
| `node_modules` on disk                                    | **4.6 MB**       | 12.9 MB                    | 14.6 MB                           |
| React versions supported                                  | 19               | 16 only                    | 18, 19                            |

### Runtime

Main-thread CPU time. A "group" is 1/10th of the tree, so expanding one at 10,000 nodes
reveals 999 rows.

| Nodes  | Library             | Mount CPU | Expand a group | Scroll top→bottom CPU | DOM elements | Event listeners | JS heap    |
| ------ | ------------------- | --------- | -------------- | --------------------- | ------------ | --------------- | ---------- |
| 100    | this fork           | 4.8 ms    | 3.2 ms         | 62.7 ms               | **177**      | 254             | 3.1 MB     |
| 100    | react-sortable-tree | 4.2 ms    | 2.0 ms         | 54.7 ms               | 253          | **199**         | 3.4 MB     |
| 100    | @minoru             | 7.0 ms    | 3.3 ms         | **11.6 ms**           | 322          | 993             | 4.1 MB     |
| 1,000  | this fork           | 4.5 ms    | 3.1 ms         | 109 ms                | **175**      | 252             | 3.7 MB     |
| 1,000  | react-sortable-tree | 4.1 ms    | **2.2 ms**     | 121 ms                | 251          | **197**         | 4.0 MB     |
| 1,000  | @minoru             | 63.7 ms   | 23.4 ms        | **26.8 ms**           | 3,022        | 8,193           | 16.2 MB    |
| 10,000 | this fork           | 6.9 ms    | 6.8 ms         | 94.4 ms               | **175**      | 252             | 8.2 MB     |
| 10,000 | react-sortable-tree | 9.4 ms    | 4.7 ms         | 109 ms                | 251          | **197**         | **6.3 MB** |
| 10,000 | @minoru             | 2,228 ms  | 584 ms         | **43.2 ms**           | 30,022       | 80,193          | 135.8 MB   |

**All three scrolled at full frame rate.** p95 frame time stayed between 8.7 ms and
9.3 ms for every library at every size, and not one run dropped a frame. The scroll
column is therefore headroom consumed, not jank observed — see below for why it is the
one column the virtualized libraries lose.

**This fork and the original are near-indistinguishable on CPU, with one exception.** Mount
and scroll have overlapping run-to-run ranges at every size, which is why neither is bolded
— one library is a fork of the other and both virtualize the same way. But **expanding a
group at 1,000 nodes now separates**: 2.9–3.9 ms for this fork against 1.6–2.3 ms for the
original, with no overlap, so the original takes that cell.

Scroll CPU rises from 100 to 1,000 nodes and then flattens (109 ms and 94.4 ms overlap).
The 40 scroll steps are a fixed count, so past ~1,000 nodes every step jumps further than
one viewport and replaces the whole rendered window — the cost per step saturates rather
than continuing to grow with the tree.

### First paint

Time until rows are actually on screen, which includes waiting for a display frame:

| Nodes  | this fork | react-sortable-tree | @minoru/react-dnd-treeview |
| ------ | --------- | ------------------- | -------------------------- |
| 100    | 11.8 ms   | 4.5 ms              | 7.2 ms                     |
| 1,000  | 12.6 ms   | **4.5 ms**          | 63.1 ms                    |
| 10,000 | 12.0 ms   | 9.1 ms              | 2,242 ms                   |

### Reading the results

**Where this fork wins.** A third of the bytes of either alternative, a third of the install
footprint, and a flat cost curve: mounting 10,000 nodes takes ~7 ms because only 13 rows are
ever in the DOM. Against `@minoru` at 10,000 nodes that is ~320× less mount CPU, ~86×
cheaper expands, ~171× fewer DOM elements and ~17× less heap. It is also the only one of the
three implementing the ARIA tree pattern — `role="treeitem"` with
`aria-level`/`aria-setsize`/`aria-posinset`/`aria-expanded`, a roving tabindex, arrow-key
navigation and keyboard drag and drop. The original exposes rows as `react-virtualized` grid
cells (`role="gridcell"` inside `role="grid"`), `@minoru` as `<li role="listitem">`; in
neither are rows focusable.

**Where this fork loses.** Rows appear about a frame later than the original
(12.6 ms vs 4.5 ms at 1,000 nodes) because `virtua` measures its viewport from a
ResizeObserver before it can fill it. At 10,000 nodes it holds more heap than the
original (8.2 MB vs 6.3 MB) and keeps a few more event listeners per viewport. Expanding a
group costs about 1 ms more than the original on small trees, which is the price of composing
a keyboard backend over the pointer one. Scrolling costs real CPU — ~94 ms to sweep the whole
tree against `@minoru`'s ~43 ms — because rows are re-rendered as they come into view instead
of already existing. That is the virtualization trade in one number: spend CPU while
scrolling, in exchange for a DOM and a heap that stop growing with the tree. Neither choice
dropped a frame here. And it is React 19 only: `@minoru` still supports React 18.

**When to pick `@minoru/react-dnd-treeview` instead.** It is the right call for small
trees where you want full markup control: it ships no CSS, animates expand/collapse with
`framer-motion`, bundles multi-backend touch support, and supports React 18. Scrolling is
cheaper because nothing re-renders. The cost is that everything is in the DOM — at 10,000
nodes that is 30,022 elements, 80,193 listeners, 136 MB of heap and a 2.2 second mount
that blocks the main thread. Even 1,000 nodes take 64 ms to mount, past the frame budget.
It also has no built-in search, no ARIA tree semantics and no keyboard navigation.

**The original v2.8.0** is a reasonable choice only if you are pinned to React 16. As the
table shows it is still a match on runtime — this is a fork of it — but it was last
published in August 2020, ships no TypeScript types, and pulls in 30 packages. It does
not run on React 19 at all: the harness mounts it there too and it throws
`A React Element from an older version of React was rendered`.

**Drag and drop is pointer-only in all three.** None of them supports keyboard-driven
reordering; this fork adds keyboard navigation and focus management, not keyboard
dragging.

## Getting started

Install the package together with its peer dependencies:

```sh
npm install @nosferatu500/react-sortable-tree \
  @nosferatu500/react-dnd @nosferatu500/react-dnd-html5-backend
# or
yarn add @nosferatu500/react-sortable-tree \
  @nosferatu500/react-dnd @nosferatu500/react-dnd-html5-backend
```

> **Upgrading from v6?** The peers changed packages: `react-dnd` and
> `react-dnd-html5-backend` became `@nosferatu500/react-dnd` and
> `@nosferatu500/react-dnd-html5-backend`. Upstream `react-dnd` has had no release since
> 2022 and no declared React 19 support. If you never imported `react-dnd` yourself, the
> install line above is the whole migration; see [CHANGELOG.md](./CHANGELOG.md) if you did.

Node >= 22.12 is required, because those packages are ESM-only and 22.12 is the first
release that can `require()` an ES module.

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

Already have a surrounding drag-and-drop context? Use the context-less export, and wrap
your own backend with `withTreeKeyboard` so keyboard dragging still works:

```tsx
import { DndProvider } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import {
  SortableTreeWithoutDndContext,
  withTreeKeyboard,
} from '@nosferatu500/react-sortable-tree'

// Once, at module scope — a new backend identity rebuilds the whole manager.
const backend = withTreeKeyboard(HTML5Backend)

;<DndProvider backend={backend}>
  <SortableTreeWithoutDndContext treeData={treeData} onChange={setTreeData} />
</DndProvider>
```

`SortableTree` does this for you. A bare pointer backend has no keyboard gesture at all,
and losing it is silent, so this matters whenever you supply the provider — including when
you swap in `TouchBackend`.

## Component props

All props are typed in `ReactSortableTreeProps` (see `src/react-sortable-tree.tsx`).

### Required props

| Prop       | Type                             | Description                                                                       |
| ---------- | -------------------------------- | --------------------------------------------------------------------------------- |
| `treeData` | `TreeItem[]`                     | Array of tree nodes with `{ title?, subtitle?, expanded?, children?, ...custom }` |
| `onChange` | `(treeData: TreeItem[]) => void` | Called on every tree data change                                                  |

`title` and `subtitle` take a value _or_ a function of the node, which is called with
`{ node, path, treeIndex }` when the row renders:

```tsx
const treeData: TreeItem[] = [
  { title: ({ treeIndex }) => <b>{`#${treeIndex} Chicken`}</b> },
]
```

A node's `children` can also be a function — see [Lazy children](#lazy-children).

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
| `getNodeKey`                | `(node) => string \| number` | Builds the segments of every `path` |
| `onVisibilityToggle`        | `(params) => void`           | Called when node expands/collapses  |
| `loadCollapsedLazyChildren` | `boolean`                    | Load lazy children before expanding |
| `virtuaRef`                 | `RefObject<VListHandle>`     | Direct access to the virtual list   |
| `dragDropManager`           | `object`                     | External drag-and-drop manager      |

#### `getNodeKey`

`getNodeKey` builds the segments of the `path` arrays you get back — in `onMoveNode`'s
`prevPath`/`nextPath`, in `onVisibilityToggle`, and in every helper that takes a `path`. The
default is `({ treeIndex }) => treeIndex`, so those paths are positions: they are only valid
against the tree they came from, and a stored path points somewhere else after a reorder.

Return your own stable id if you keep paths around, diff trees, or persist selection:

```tsx
<SortableTree
  treeData={treeData}
  onChange={setTreeData}
  getNodeKey={({ node }) => node.id}
/>
```

You do **not** need it to keep row state (an open editor, a checkbox, focus) attached to the
right row while rows move — rows are reconciled by node identity when you leave `getNodeKey`
unset. The one case that benefits: if you replace `treeData` with freshly built objects on
every change, supply `getNodeKey` so rows can still be matched across the replacement.

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

### Keyboard drag and drop

Nodes can be reordered **and re-nested** without a pointer. Tab from a row to its drag
handle, then:

| Key                                 | Action                                   |
| ----------------------------------- | ---------------------------------------- |
| <kbd>Space</kbd> / <kbd>Enter</kbd> | Pick the row up — press again to drop it |
| <kbd>↓</kbd> / <kbd>↑</kbd>         | Choose which row it lands next to        |
| <kbd>→</kbd> / <kbd>←</kbd>         | Nest it one level deeper / shallower     |
| <kbd>Esc</kbd>                      | Cancel, leaving the tree as it was       |

Up and down choose _where_ the row lands; left and right choose _how deeply it nests_ —
the same split as a pointer drag, where horizontal movement is the only thing that nests a
node. They mirror under `rowDirection="rtl"`.

Focus stays on the dragged row for the whole interaction and only the hover moves, so
`isOver` and `canDrop` behave exactly as they do under the mouse and existing highlight
styles keep working. A polite live region narrates each step — pick-up, each move, depth
changes (including a depth the surrounding rows refuse), and where the node finally landed.

Drops go through the same `onChange` and `onMoveNode` callbacks as a mouse drag.

The drag handle shares its row's tab stop, so the tree stays a single tab stop however many
rows are on screen. **Custom `nodeContentRenderer`s should do the same**: put the
`isActiveRow` prop on whatever you connect as the drag source, or every visible row becomes
its own tab stop.

```tsx
<div ref={connectDragSource} tabIndex={isActiveRow ? 0 : -1} />
```

## Lazy children

A node's `children` can be a function instead of an array. It is called when the node is
expanded — or immediately, for every such node, if you pass
`loadCollapsedLazyChildren` — and the node shows a loading indicator until its children
arrive. Return the children, or a promise for them:

```tsx
const treeData: TreeItem[] = [
  {
    title: 'Remote folder',
    children: async ({ node }) => {
      const res = await fetch(`/api/children?id=${String(node.id)}`)
      return (await res.json()) as TreeItem[]
    },
  },
]
```

The loaded children are written into the tree through `onChange`, like every other
change, so they end up in your own state.

Two things to know: the update is applied to the tree as it was when the loader was
called, and a node whose `children` is still a function may be asked to load again on a
later tree change. Loaders that fetch should therefore be idempotent or cached.

**Coming from v5?** The `done(children)` callback is gone — return the children instead:

```tsx
// v5
children: ({ done }) => {
  fetchChildren().then(done)
}

// v6
children: () => fetchChildren()
```

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
