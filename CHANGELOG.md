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

### Migration Guide

#### From v5.x to v6.x

1. **Update React** to 19.0.0 or higher. There are no other required changes — the
   component API is unchanged from v5.

   ```sh
   npm install react@^19 react-dom@^19
   ```

2. **If you were building this package from source** and relied on `build:compiler`,
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
