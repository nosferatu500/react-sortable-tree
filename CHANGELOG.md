# Changelog

## [6.0.0] - 2026-07-31

### Breaking Changes

#### React Version Support

- **Dropped React 18 support** — minimum version is now React 19.0.0
- Peer dependencies changed to `react: ^19.0.0` and `react-dom: ^19.0.0`
  (was `^18.0.0 || ^19.0.0`)

#### React Compiler is now always on

- **The published bundle is compiled by React Compiler.** There is no longer an
  un-compiled build path, and the `build:compiler` script has been removed — plain
  `npm run build` produces the compiled output.
- This is what required dropping React 18: the compiled output imports
  `react/compiler-runtime`, which React 19 exports and React 18 does not. React 19-only
  peers mean no `react-compiler-runtime` polyfill is needed.
- Consumers do not need to configure anything. If your app also runs React Compiler,
  it will simply skip this package's already-compiled code.

#### CSS is a real stylesheet again — you must import it

- **Runtime style injection is gone.** v5 appended four `<style>` elements at import
  time; v6 emits `lib/style.css` and consumers import it themselves:

  ```js
  import '@nosferatu500/react-sortable-tree/style.css'
  ```

  This restores the v4 import path, so projects upgrading from v4 keep the same line.

- **Why:** injection put ~14 kB of stylesheet into every consumer's JS bundle — even
  for consumers who only imported a tree utility and never rendered the component —
  required `style-src 'unsafe-inline'` under a strict CSP with no way to supply a
  nonce, emitted nothing during SSR (so server-rendered HTML flashed unstyled at
  hydration), and left override order dependent on bundler module evaluation order.

- **Measured effect** on a minified consumer bundle (peers external):

  | consumer                           | v5      | v6      |
  | ---------------------------------- | ------- | ------- |
  | imports only `getTreeFromFlatData` | 18.0 kB | 3.6 kB  |
  | imports `SortableTree`             | 43.7 kB | 29.2 kB |

  plus a separately cached 12.2 kB stylesheet that your own build minifies.

- **All component rules are now in a `rst` cascade layer.** Unlayered CSS beats layered
  CSS regardless of specificity, so overrides no longer need `!important` or selector
  escalation. Order it against your own layers with `@layer rst, components;` if you use
  layers. The `@property` declarations remain unlayered — they are global registrations,
  not cascade participants.

- `sideEffects` narrowed from `true` to `["**/*.css"]`, since the JS is now pure.

#### `immer` is no longer a dependency

- Tree mutations use hand-rolled structural sharing instead of `produce()`. Behaviour is
  unchanged — inputs are still never mutated and untouched branches still keep object
  identity — but the package now has three runtime dependencies instead of four.
- If you were relying on `immer` being installed transitively, add it to your own
  dependencies.

### Added

#### Accessibility: the tree is now an actual ARIA tree

v5 exposed no tree semantics at all and could not be operated from the keyboard. v6
implements the [WAI-ARIA tree view pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/).

- `role="tree"` on the container and `role="treeitem"` per row, with `aria-level`,
  `aria-setsize`, `aria-posinset`, and `aria-expanded` (only on nodes that have
  children). The virtualizer's scroll container and row wrappers are marked
  presentational so the treeitems are properly owned by the tree.
- **Keyboard navigation**, on by default: arrows to move, <kbd>→</kbd>/<kbd>←</kbd> to
  expand/collapse or jump to first child/parent, <kbd>Home</kbd>/<kbd>End</kbd>, and
  <kbd>Enter</kbd>/<kbd>Space</kbd> to toggle. Left/right swap under
  `rowDirection="rtl"`. One row is in the tab sequence at a time (roving tabindex).
- Keys the tree does not handle are left alone, and keystrokes from an `input`,
  `textarea`, `select`, or `contenteditable` inside a row are never intercepted, so
  inline editing keeps working.
- New props: **`aria-label`** and **`aria-labelledby`** (give the tree an accessible
  name — a `role="tree"` needs one), and **`keyboardNavigation`** (default `true`; set
  `false` to bind the arrow keys yourself while keeping the roles).

Keyboard-driven *drag and drop* is still not supported; that needs a drag backend with a
keyboard sensor and is planned alongside the move off `react-dnd`.

### Fixed

- **`insertNode` reported the wrong `path` and `parentNode` for any nested insert.**
  It returned `path: [newNodeKey]` and `parentNode: null` no matter where the node
  actually landed, because the recursion carried its `isPseudoRoot` flag into every
  child. Since `moveNode` forwards these values, **`onMoveNode` reported the wrong
  `nextPath` and `nextParentNode` for every drop below the root level.**

- **`changeNodeAtPath` handed a revoked Immer draft to function `newNode` callbacks.**
  Retaining that node past the call — to inspect the replaced node, or push it onto an
  undo stack — threw `TypeError: Cannot perform 'get' on a proxy that has been revoked`.
  Callbacks now receive a plain object.

### Performance

Measured on a 10,200-node tree, before/after in one interleaved process:

| operation                             | v5        | v6       | change  |
| ------------------------------------- | --------- | -------- | ------- |
| `changeNodeAtPath`                    | 4.048 ms  | 0.058 ms | 70× faster |
| `addNodeUnderParent`                  | 19.346 ms | 0.377 ms | 51× faster |
| `getDescendantCount`                  | 0.0128 ms | 0.0023 ms | 5.6× faster |
| `insertNode`                          | 0.235 ms  | 0.060 ms | 3.9× faster |
| **one drag-hover event (end to end)** | **5.481 ms** | **0.845 ms** | **6.5× faster** |

**Rows are no longer remounted on every render.** In v5, `mergedProps` was rebuilt on
each render and the staleness cascaded into component _identity_ — `canNodeHaveChildren`
→ `treeNodeRenderer` was a fresh component type every time, and React reconciles by
type. Since the documented usage is `onChange={data => setTreeData(data)}`, every
expand, collapse and drop tore down and rebuilt every visible row along with its
registered drop target.

Measured with 8 rows and inline callback props, across 5 parent re-renders:

| | row mounts | row renders |
| --- | ---: | ---: |
| v5 | 8 → 48 (40 extra) | 64 |
| v6 | 8 → 8 (0 extra) | 64 |

Rows still re-render; they are simply updated in place now. This also means custom
`nodeContentRenderer` components keep their state and effects across parent renders
instead of being reinitialised.

The tree-data, search and drag-state effects no longer re-run on every render, and
`React.memo` was removed from the internal row wrapper: it could never hit, because each
row receives fresh `children` on every render. Making row memoization effective requires
a breaking change to how rows receive their content, deferred to v7.

The last row of the table above is the work done on every mousemove during a drag: 33%
of a 60 fps frame budget in v5, 5% in v6. Behind it:

- `changeNodeAtPath` no longer resolves the target path inside an Immer draft, which had
  been forcing a proxy for every sibling subtree instead of just the path being written.
- `getDescendantCount` is a direct recursive count instead of a traversal that allocated
  a `path` and `lowerSiblingCounts` array per level only to discard them.
- `dragHover` takes the inserted node's path from `insertNode`'s return value instead of
  re-flattening the entire tree on every mousemove to read one row.

### Testing

The project had no tests before v6. It now has **164**, run with `npm test` (or
`npm run test:watch`):

- `src/utils/tree-data-utils.test.ts` (83) — every export of the tree-data module,
  including no-mutation and structural-sharing invariants. Both bugs above were found by
  these tests.
- `src/react-sortable-tree.test.tsx` (45) — component behaviour under
  `@testing-library/react` + jsdom: rendering, expand/collapse, search, every callback
  contract, custom renderers, theme precedence, lazy children, controlled updates.
- `src/utils/dnd-manager.test.tsx` (12) — real drags driven through react-dnd's
  `TestBackend`: begin/hover/drop/cancel, `canDrop` enforcement, and subtree integrity.
- `src/accessibility.test.tsx` (25) — ARIA tree semantics, roving tabindex, and every
  keyboard interaction, including rtl mirroring and not hijacking nested inputs.

### Migration Guide

#### From v5.x to v6.x

1. **Update React** to 19.0.0 or higher. The component API is unchanged from v5.

   ```sh
   npm install react@^19 react-dom@^19
   ```

2. **Import the stylesheet.** This is the only required code change:

   ```js
   // v5 — styles injected themselves, nothing to import
   import { SortableTree } from '@nosferatu500/react-sortable-tree'

   // v6
   import { SortableTree } from '@nosferatu500/react-sortable-tree'
   import '@nosferatu500/react-sortable-tree/style.css'
   ```

   If you have CSS overriding the component, you can now delete any `!important` or
   `.rst__tree .rst__row`-style specificity hacks — unlayered rules beat the `rst`
   layer on their own.

3. **If you were building this package from source** and relied on `build:compiler`,
   use `build` instead:

   ```sh
   # Before (v5)
   npm run build            # un-compiled
   npm run build:compiler   # React Compiler

   # After (v6)
   npm run build            # always React Compiler
   ```

## [5.1.0] - 2026-07-30

First stable v5 release. Everything in the `5.0.0-rc.2` notes below applies; this entry
covers what changed after that release candidate.

### Breaking Changes

- **Build system migrated from Rollup to [`tsdown`](https://tsdown.dev)**
- **Entry point renamed from `lib/index.esm.js` to `lib/index.js`.** `"type": "module"`
  already makes `.js` unambiguous ESM, and it keeps the paths in the `exports` map
  stable. Declaration output is `lib/index.d.ts` (not `.d.mts`).
- Compile target raised to **ES2025** (`Object.groupBy`, `Array.prototype.toSpliced`
  are now used internally)

### New Features

- **Optional React Compiler build** via `npm run build:compiler`
  (made the default in v6)

### Fixed

- Crash in the external-node drag-and-drop example
- Build warnings from the previous Rollup pipeline
- Assorted type-level fixes across the public surface

### Other Changes

- CSS refactored onto a documented theming API: all knobs are CSS custom properties
  declared with `@property` so invalid consumer values fall back instead of collapsing
  the layout, and physical `left`/`right` rules were replaced with logical properties
  (`inset-inline-*`, `padding-inline-*`) for RTL correctness
- TypeScript 5.9 → 6.0
- Export correctness now verified in CI-ready form via `publint` and
  `@arethetypeswrong/cli` (`npm run check:exports`)
- Added `oxlint` alongside ESLint; lint rules applied to Storybook examples too
- Removed the CodeQL workflow

## [5.0.0-rc.2] - 2026-02-02

### Breaking Changes

#### React Version Support
- **Dropped React 17 support** - minimum version is now React 18.0.0
- Added React 19.0.0 support
- Peer dependencies changed to `react: ^18.0.0 || ^19.0.0`

#### Architecture: Class to Functional Components
- **Main `ReactSortableTree` component completely rewritten as a functional component**
- **`TreeNodeComponent` refactored from class to functional component**
- All components now use React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, etc.)
- Removed class-based lifecycle methods

#### Package Output Format
- **Changed from dual-format (CJS + ESM) to ESM-only output**
- New entry point: `lib/index.esm.js` (renamed to `lib/index.js` in the final 5.0.0
  release — see above)
- Removed CommonJS build - consumers must use ESM imports
- **The default export was removed.** `SortableTree` is now a named export:
  `import { SortableTree } from '@nosferatu500/react-sortable-tree'`
- CSS is now injected at runtime (removed separate `style.css` export)

#### Virtualization Library
- **Replaced `react-virtuoso` with `virtua`**
- `virtuosoRef` was renamed to `virtuaRef` and now takes a
  `React.RefObject<VListHandle>` from `virtua`
- **`virtuosoProps` was removed with no replacement.** There is no prop for passing
  arbitrary options through to the virtual list; `virtuaRef` is the only escape hatch,
  and it exposes the imperative `VListHandle` (e.g. `scrollToIndex`) rather than
  configuration
- Simplified virtualization with better TypeScript support

#### React-DnD Upgrade (v14 → v16)
- **Upgraded from react-dnd v14.0.4 to v16.0.1**
- Internal implementation changed from HOC pattern to hooks (`useDrag`, `useDrop`)
- If you were using custom drag/drop implementations, review the react-dnd v16 migration guide

#### Dependencies Changed
- **Added:** `immer ^11.1.3` for immutable state updates
- **Removed:** `@nosferatu500/react-dnd-scrollzone`, `lodash.isequal`, `prop-types`

#### Node.js Version
- **Minimum Node.js version increased to 24.11+**

### New Features

#### React 19 Support
- Full compatibility with React 19
- Optional React Compiler support via `npm run build:compiler`
- Uses `useDeferredValue` and `useTransition` for improved performance
- Ref callback cleanup functions for better resource management

#### TypeScript Improvements
- Comprehensive type definitions in dedicated `types.ts`
- Strongly typed callbacks: `SearchParams`, `GenerateNodePropsParams`, `OnMoveNodeParams`, etc.
- All exported types available for consumers
- Removed all `@ts-nocheck` directives

#### Improved State Management
- Tree data manipulation now uses immer's `produce()` for cleaner immutable updates
- Better performance with structural sharing

#### Theme Support
- Restored FileExplorer theme
- New dark mode example in Storybook
- Updated RTL support

### Other Changes

#### Build System
- Migrated from Babel + ESBuild to TypeScript + Rollup
- PostCSS processing integrated into build pipeline
- Source maps enabled for debugging
- Declaration files properly bundled

#### Storybook
- Updated from Storybook 6.x to 10.x
- Stories reorganized into `basics` and `advanced` categories
- All stories converted to TypeScript

#### ESLint
- Migrated from `.eslintrc.json` to `eslint.config.mjs` (flat config)
- Updated rules for TypeScript and React 19 compatibility

#### Internal Refactoring
- DnD manager completely rewritten with hooks-based implementation
- Removed memoized tree data utils (no longer necessary with immer)
- Better SSR support with `useIsomorphicLayoutEffect`

### Migration Guide

#### From v4.x to v5.x

1. **Update React version** to 18.0.0 or higher

2. **Update imports** - ESM only, and **the default export was removed**. `SortableTree`
   is now a named export:
   ```js
   // Before (v4)
   const SortableTree = require('@nosferatu500/react-sortable-tree')
   // or
   import SortableTree from '@nosferatu500/react-sortable-tree'

   // After (v5)
   import { SortableTree } from '@nosferatu500/react-sortable-tree'
   ```

3. **Update virtualization props.** `virtuosoRef` became `virtuaRef`, and
   `virtuosoProps` was removed with no equivalent:
   ```jsx
   // Before (v4)
   <SortableTree virtuosoRef={ref} virtuosoProps={{ ... }} />

   // After (v5) - virtuaRef exposes virtua's VListHandle; there is no props passthrough
   <SortableTree virtuaRef={ref} />
   ```

4. **Remove CSS import** - styles are now injected automatically:
   ```js
   // Before (v4)
   import '@nosferatu500/react-sortable-tree/style.css'

   // After (v5) - not needed
   ```

5. **Update Node.js** to version 24.11 or higher
