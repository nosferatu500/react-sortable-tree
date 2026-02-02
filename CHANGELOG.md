# Changelog

## [5.0.0-rc.2] - 2025

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
- New entry point: `lib/index.esm.js`
- Removed CommonJS build - consumers must use ESM imports
- CSS is now injected at runtime (removed separate `style.css` export)

#### Virtualization Library
- **Replaced `react-virtuoso` with `virtua`**
- If you were passing `virtuosoProps`, you now need to use `virtuaProps` with the virtua API
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

2. **Update imports** - ESM only:
   ```js
   // Before (v4)
   const SortableTree = require('@nosferatu500/react-sortable-tree')

   // After (v5)
   import SortableTree from '@nosferatu500/react-sortable-tree'
   ```

3. **Update virtualization props** if using custom virtuoso configuration:
   ```jsx
   // Before (v4)
   <SortableTree virtuosoProps={{ ... }} />

   // After (v5) - use virtua API
   <SortableTree virtuaProps={{ ... }} />
   ```

4. **Remove CSS import** - styles are now injected automatically:
   ```js
   // Before (v4)
   import '@nosferatu500/react-sortable-tree/style.css'

   // After (v5) - not needed
   ```

5. **Update Node.js** to version 24.11 or higher
