# Changelog

## [7.0.0] - 2026-08-10

### Breaking: the `react-dnd` peer dependency changed packages

6.0.0 asked for `react-dnd@^16` and `react-dnd-html5-backend@^16`. 7.0.0 asks for
a maintained fork instead:

```diff
- npm i react-dnd react-dnd-html5-backend
+ npm i @nosferatu500/react-dnd @nosferatu500/react-dnd-html5-backend
```

If you never imported `react-dnd` yourself, that is the whole migration — install
the two scoped packages and remove the two unscoped ones. Nothing in this
library's own API changed as a result.

**If you do import it** — a custom `nodeContentRenderer`, your own drag source or
drop target, `SortableTreeWithoutDndContext` with your own `DndProvider` — then
change your imports to the scoped names and note three things from the fork:

- **Connectors are ordinary ref callbacks.** `ref={connectDragSource}` typechecks
  directly; delete any `as unknown as React.Ref` cast. Two connectors on one
  element need a block-bodied callback — never `ref={(n) => drag(drop(n))}`,
  which hands React the connector's return value.
- **`monitor.getItem()` is typed `T | null`**, which it always was at runtime.
  Prefer the non-null `item` argument that `drop`, `hover`, `canDrop` and `end`
  already receive.
- **The packages are ESM only** and need Node >= 22.12; see `engines` below.

**Why:** upstream `react-dnd` has had no release since 2022, no declared React 19
support, and an open React 19 bug where `isDragging` reads `false` when dragging
downwards. Its connector types were also the sole reason this library needed
`as unknown as React.Ref` casts internally.

This is why 7.0.0 is a major rather than a patch on 6.0.0: a peer dependency
pointing at a differently-named package cannot be satisfied by an existing
install, so it needs the version bump that makes consumers look.

### Fixed: `ReferenceError: dndType is not defined` on an empty tree

**Upgrade if you are on 6.0.0.** Rendering a tree with no rows threw immediately,
and the drag-end and placeholder-drop callbacks were broken the same way.

The React Compiler *outlines* callbacks it judges to be constant, moving them to
module scope. Its capture analysis missed variables belonging to an enclosing
factory: the internal drag-and-drop wrappers are built by functions that take
`dndType`, `treeId` and `getHandlers` as parameters, and the compiled output
referenced those from module scope, where they do not exist.

The three wrappers now opt out of the compiler. They are thin wrappers around
`useDrag`/`useDrop`; the memoization that matters is in the row renderers and the
tree-data helpers, which are still compiled.

**This shipped because nothing tested the built bundle** — the suite runs against
sources, so compiler output was never executed. `npm run test:build` now renders
the real bundle, including the empty-tree path, and it runs in CI after `build`
and again in `prepublishOnly`.

### Added: drag and drop from the keyboard

The last accessibility gap is closed. `SortableTree` composes
`@nosferatu500/react-dnd-keyboard-backend`, so a node can be picked up, moved,
nested and dropped without a pointer, and a polite live region narrates it.

Tab from a row to its drag handle, then:

| Key                       | Action                                     |
| ------------------------- | ------------------------------------------ |
| <kbd>Space</kbd> / <kbd>Enter</kbd> | Pick up; press again to drop      |
| <kbd>↓</kbd> <kbd>↑</kbd> | Choose which row it lands next to           |
| <kbd>→</kbd> <kbd>←</kbd> | Nest one level deeper / shallower           |
| <kbd>Esc</kbd>            | Cancel, leaving the tree as it was          |

Up and down choose *where*, left and right choose *how deeply* — the same split
as a pointer drag, where horizontal movement is the only thing that nests a node.
They mirror under `rowDirection="rtl"`. Announcements cover pick-up, each move,
depth changes (including a request the surrounding rows refuse) and where the
node finally landed.

Nothing to configure, and no change to `useDrag`/`useDrop` usage.

### Added: `withTreeKeyboard`

```tsx
import { withTreeKeyboard } from '@nosferatu500/react-sortable-tree'

<DndProvider backend={withTreeKeyboard(TouchBackend)}>
  <SortableTreeWithoutDndContext … />
</DndProvider>
```

`SortableTree` already applies it to `HTML5Backend`. Reach for it whenever you
supply your own provider — with `SortableTreeWithoutDndContext`, or to swap in
`TouchBackend`. A bare pointer backend has no keyboard gesture at all, and losing
it is silent, so this is not an optional nicety for those setups.

### Fixed: a drop could land the node back where it started

A drop recomputed its position from row props that the last hover had already
slid, so the position it committed could resolve to the node's origin instead of
where the preview showed it. A pointer drag hid this because the browser keeps
firing `dragover` until the two agree — but a single hover followed by a drop did
not, which is every keyboard drop.

Drops now commit the position the preview was showing. Pointer drags no longer
depend on hover convergence either.

### Fixed: the roving tabindex could desync after a drop

A keyboard drop leaves focus on the dragged row while the row lands somewhere
new, so the tab stop and the focused element ended up on different rows and the
next arrow key acted on the wrong one. The tab stop now follows the moved row,
and only when focus is actually inside the tree.

### Changed: node content renderers receive `isActiveRow`

Custom `nodeContentRenderer` implementations get a new `isActiveRow: boolean`.
Put it on whatever you connect as the drag source:

```tsx
<div ref={connectDragSource} tabIndex={isActiveRow ? 0 : -1} />
```

The keyboard backend makes every connected drag source focusable, which would be
one tab stop per visible row in a tree the ARIA pattern says must have exactly
one. An explicit `tabIndex` keeps the handle inside the tree's single roving tab
stop — the backend never overwrites an attribute the element already carries.

**If your renderer spreads unknown props onto a DOM element**, destructure
`isActiveRow` out first, or React will warn about an unrecognized attribute.

The default renderer's drag handle also gained `role="button"` and an
`aria-label` — without a name, announcements said "Picked up ." for every row.

### Breaking: the React peer range is now `^19.2.0`

Raised from `^19.0.0`, which understated the real floor rather than describing it.
This library calls `useEffectEvent` — for `onChange`, `onMoveNode`,
`onVisibilityToggle`, the search callbacks and the move announcement — and that
hook first shipped in React **19.2**. On React 19.0 or 19.1 the old range
installed cleanly and then failed at render.

`npm install react@^19.2 react-dom@^19.2` if you are below it.

### Changed: `engines.node` is now `>=22.12`

Raised from `>=22`, because `@nosferatu500/react-dnd` 19 requires it. Node 22.12
is the first release that can `require()` an ES module, which is what lets those
packages ship ESM only.

### Measured: install got smaller, bundle got slightly bigger

Re-running the cross-library benchmark against 7.0.0:

|                                         | v6.0.0  | v7.0.0      |
| --------------------------------------- | ------- | ----------- |
| npm packages installed                  | 13      | **8**       |
| `node_modules` on disk                  | 5.1 MB  | **4.6 MB**  |
| JS min+gzip, library alone              | 15.3 kB | 16.0 kB     |
| JS min+gzip, with the drag-and-drop stack | 28.0 kB | 30.9 kB   |

The install shrank because the `react-dnd` fork dropped four utility packages of its own.
The ~2.9 kB of extra JS is keyboard dragging and its live region.

Runtime is unchanged within run-to-run noise at every tree size, with one exception:
**expanding a group costs about 1 ms more on small trees** (2.4 → 3.1 ms at 1,000 nodes),
which is enough for the original v2.8.0 to take that cell on a separated range. The likely
cause is each row registering with two composed backends instead of one — the price of
keyboard support — but that attribution is not yet measured. Tracked in
[MODERNIZATION.md](./MODERNIZATION.md).

### Added: the screen-reader announcements can be localised

Keyboard drag and drop narrates itself through a live region, and **every string
used to be hard-coded English** with no way to replace them: non-English apps got
English announcements. Both sources now have a route out.

The backend's own strings — the static instructions, pick-up, movement, drop and
cancellation — go through `withTreeKeyboard`, which forwards the keyboard
backend's `announcements` and `describeNode`:

```jsx
const backend = withTreeKeyboard(HTML5Backend, {
  announcements: {
    instructions: 'Appuyez sur Espace pour saisir cet élément.',
    pickUp: ({ source }) => `${source} saisi.`,
  },
})
```

The tree's own — where a node landed, and what depth an arrow key produced — are
per-tree rather than per-backend, so they arrive as a prop:

```jsx
<SortableTree
  announcements={{
    moved: ({ node, depth }) => `${node.title} : profondeur ${depth}.`,
    depth: ({ depth, changed }) =>
      `Profondeur ${depth}${changed ? '' : ', inchangée'}.`,
  }}
/>
```

Each key falls back on its own, so overriding one message leaves the rest in
English rather than silencing them. `defaultTreeAnnouncements` is exported for
wrapping a default instead of replacing it, along with the
`TreeAnnouncements`, `MoveAnnouncement` and `DepthAnnouncement` types.

Only `announcements` and `describeNode` are forwarded, and the
`TreeKeyboardOptions` type says so: `getNextTarget` and `onNavigate` are what make
the backend tree-shaped, and a consumer who replaced either would silently lose
depth control or the vertical arrows. Call `withKeyboard` directly for that.

Additive — the defaults are the previous strings verbatim.

### Changed: the drag-and-drop stack is on 19.2.0

The peer range is `@nosferatu500/react-dnd` and
`@nosferatu500/react-dnd-html5-backend` at `^19.2.0`. Nothing this library exposes
changed with it, and neither of 19.2.0's breaking changes reaches a consumer of
this package — they land on hand-rolled monitor doubles, and on `drop` handlers
that return a promise.

From keyboard-backend 19.1.0, this library uses `isKeyboardDrag()` to tell a
keyboard drag from a pointer one, and `onNavigate` to take the horizontal arrows
for depth. Both replaced workarounds — reading a diagnostics counter off the
backend, and a `Window` capture listener racing the backend's own `Document` one.
Two upstream fixes from it are visible here: picking a row up no longer previews
it jumping to the top of the tree, and a drag source that wraps controls of its
own now gets `role="group"` rather than an invalid nested `role="button"`.

19.2.0 adds one thing worth knowing about if you supply your own `DndProvider`: a
provider is no longer limited to a single backend. `composeBackends` runs several
at once, so supporting a mouse and a finger no longer means detecting which to
install — see `withTreeKeyboard` below. Its asynchronous drop support is what the
new `onDrop` prop is built on.

### Added: `onDrop`, for a move that has to be saved before it is real

`onChange` and `onMoveNode` both fire the moment a move commits and cannot fail —
they say *this happened*. `onDrop` says *make this stick*, and it is **awaited**:

```jsx
<SortableTree
  treeData={treeData}
  onChange={setTreeData}
  onDrop={async ({ treeData }, signal) => {
    await fetch('/api/tree', { method: 'PUT', body: JSON.stringify(treeData), signal })
  }}
/>
```

Returning a promise gives the tree the three states a save really has:

- **pending** — the move is committed optimistically, so the tree is not frozen
  under the cursor while a request is in flight. The moved row carries
  `aria-busy` and the new `rst__rowSettling` class, and a custom
  `nodeContentRenderer` receives an `isSettling` prop.
- **resolved** — the move is announced to screen readers as done, only now.
- **rejected** — the tree reverts to the data from before the drop and emits
  `onChange` with it, so a consumer that only listens to `onChange` still ends up
  consistent. Previously there was no rollback, revert or catch anywhere: a
  failed save left the tree showing a move that never happened.

`signal` aborts when the drop can no longer affect anything, so forward it to
`fetch`. An `AbortError` after it fires is the tree's own doing and neither
reverts nor announces. The rejection reason also reaches
`monitor.getDropError()` and the environment's uncaught-error handling.

**Nothing changes without it.** A tree with no `onDrop` keeps a fully synchronous
drop, which is deliberate rather than incidental: it is what keeps
`getDropResult()` readable inside `end`, where the copy-or-remove bookkeeping for
a drop into another tree happens.

Screen-reader strings for the three states are English, like the rest of them —
the localisation gap is unchanged, not widened by a different mechanism.

See the `Advanced/AsyncDrop` story.

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

#### Lazy `children` loaders return their children instead of calling `done`

A node's `children` can still be a function, but it now **returns** the children — or a
promise for them — and the `done` callback it used to receive is gone:

```tsx
// v5
children: ({ done }) => {
  fetchChildren().then(done)
}

// v6
children: () => fetchChildren()
//   or: children: async ({ node }) => (await fetch(`/api/children?id=${String(node.id)}`)).json()
```

- The argument object keeps `node`, `path`, `lowerSiblingCounts` and `treeIndex`; only
  `done` was removed. `GetTreeItemChildrenFn` is now
  `(data: GetTreeItemChildren) => TreeItem[] | Promise<TreeItem[]>`, so TypeScript points
  at every loader that needs updating.
- A rejected promise is left unhandled on purpose, so the failure is visible in the console
  and catchable by the consumer instead of leaving the node on its spinner.
- Unchanged, but now documented: the loaded children are applied to the tree as it was when
  the loader ran, and a node whose `children` is still a function may be asked to load
  again on a later tree change — so a fetching loader should be idempotent or cached.

#### `slideRegionSize` removed

- **The `slideRegionSize` prop is gone**, from both `ReactSortableTreeProps` and
  `ThemeProps`. It configured the auto-scroll region of `react-dnd-scrollzone`, which was
  removed back in v5 — since then nothing has read it, so passing it has had no effect
  for a whole major version while still appearing in the types and the documented prop
  table.
- If you pass it, delete it. TypeScript will point at every call site; there is no
  behaviour to replace, because there was none.

#### Package metadata

- **`engines.node` relaxed from `>=24.11` to `>=22`.** The old range was the repo's own
  development requirement leaking into a constraint on every install, and would fail on
  LTS-pinned CI. The published code's real floor is `Object.groupBy` (Node 21), so 22 is
  the oldest LTS that qualifies. The development requirement is now expressed as
  `devEngines` instead, which warns contributors without blocking consumers.
- `CHANGELOG.md` is now included in the published tarball.
- `author` is the current maintainer, with Chris Fritz credited under `contributors` as
  the original author; the LICENSE carries both copyright lines.
- Expanded `keywords` and a more descriptive `description`.

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

#### `title` and `subtitle` accept render functions in the types

Both fields have always supported a function of the node at runtime; the types said
`ReactNode`, so the documented form needed a cast. They are now
`TreeItemContent = Exclude<ReactNode, undefined> | ((data: NodeData) => ReactNode)`, which
is also the type of the `title`/`subtitle` overrides on `NodeRendererProps`.

```tsx
const treeData: TreeItem[] = [
  { title: ({ node, treeIndex }) => <b>{`${treeIndex}: ${node.name}`}</b> },
]
```

This is additive for code that builds nodes. If a **custom `nodeContentRenderer`** renders
`{node.title}` directly, TypeScript will now ask it to handle the function form — which it
had to anyway, since React throws on a function child. Branch the way the default renderer
does:

```tsx
{typeof node.title === 'function' ? node.title({ node, path, treeIndex }) : node.title}
```

#### `ThemeProps` is exported

The `theme` prop's type was documented but not importable. It is now exported, so custom
themes can be typed:

```ts
import type { ThemeProps } from '@nosferatu500/react-sortable-tree'

export const myTheme: ThemeProps = {
  nodeContentRenderer: MyRenderer,
  scaffoldBlockPxWidth: 24,
}
```

### Fixed

- **Row state stuck to the screen position instead of the node.** Rows were keyed by the
  last path segment, which under the default `getNodeKey` is the node's `treeIndex` — a
  *position*. Reordering therefore handed one node's row instance to another node, and
  expanding a node renumbered every row below it, so a custom `nodeContentRenderer`'s state
  (an open inline editor, a checkbox, focus) moved to the wrong row. It happened on ordinary
  expand/collapse, not just on drags.

  Rows are now keyed by `getNodeKey`'s value when you supply one — unchanged behaviour, and
  already correct — and otherwise by the node object's own identity. `getNodeKey` keeps its
  actual job, which is building the paths in `onMoveNode`, `changeNodeAtPath` and friends;
  it was only ever the wrong thing to reconcile by. No API change.

  Two consequences worth knowing:

  - If you **replace your whole tree with fresh objects** on every change *and* use the
    default `getNodeKey`, the visible rows now remount, where positional keys accidentally
    preserved them. Pass a `getNodeKey` that returns a stable id — which also makes your
    paths stable across reorders — or pass `({ treeIndex }) => treeIndex` explicitly to keep
    the old behaviour exactly.
  - If the **same node object appears twice** in one tree, the two rows now share a key and
    React logs "Encountered two children with the same key". Clone the node instead; edits
    through the helpers were already ambiguous for aliased nodes.

- **A negative `searchFocusOffset` crashed the tree.** The range check only tested the
  upper bound, so `searchFocusOffset={-1}` read `searchMatches[-1].treeIndex` and threw
  `TypeError`. An offset that addresses no match is now simply ignored. Found by turning
  on `noUncheckedIndexedAccess`.

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

### Storybook

- New stories for the features v6 changed: **Basics/LazyChildren** (promise-returning
  loader, failure handling, and the fact that a still-pending loader can be called again),
  **Accessibility/KeyboardNavigation** (`aria-labelledby`, roving tabindex,
  `keyboardNavigation={false}`, rtl key mirroring) and **Advanced/LargeTree** (10,000 nodes,
  with a live count of how few rows reach the DOM).
- Every existing story now passes an `aria-label`, since a `role="tree"` needs an
  accessible name and the examples are what people copy.

### Types and internals

- **The tsconfig runs with `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
  `erasableSyntaxOnly` and `isolatedDeclarations`.** Consumer-visible effects are limited
  to the `ThemeProps` export above and explicit return types in the emitted `.d.ts`; the
  `searchFocusOffset` crash below was found by the first of those flags. Details and the
  measurements behind the traversal loops are in
  [MODERNIZATION.md](./MODERNIZATION.md) 4.5.

### Testing

The project had no tests before v6. It now has **190**, run with `npm test` (or
`npm run test:watch`):

- `src/utils/tree-data-utils.test.ts` (83) — every export of the tree-data module,
  including no-mutation and structural-sharing invariants. Both bugs above were found by
  these tests.
- `src/react-sortable-tree.test.tsx` (55) — component behaviour under
  `@testing-library/react` + jsdom: rendering, expand/collapse, search, every callback
  contract, custom renderers, theme precedence, lazy children, controlled updates.
- `src/utils/dnd-manager.test.tsx` (12) — real drags driven through react-dnd's
  `TestBackend`: begin/hover/drop/cancel, `canDrop` enforcement, and subtree integrity.
- `src/stories/stories.test.tsx` (4) — smoke tests for the Storybook examples added for
  lazy children, keyboard navigation and the 10,000-node tree.
- `src/utils/node-identity.test.ts` (11) — row identity, and every tree helper carrying it
  across a clone-on-write update.
- `src/accessibility.test.tsx` (25) — ARIA tree semantics, roving tabindex, and every
  keyboard interaction, including rtl mirroring and not hijacking nested inputs.

### Continuous integration

The project had no CI either. `.github/workflows/ci.yml` now runs the full verification
gate — `typecheck`, `lint`, `test`, `format:check`, `build`, `check:exports`,
`build-storybook` — on every pull request and on pushes to `stable`.

Its first useful act was catching a gate that only looked green: `npm test` reported all
190 tests passing and still exited non-zero, because virtua's smooth scroll calls
`Element.prototype.scrollTo`, which jsdom does not implement, and the rejection landed
outside any test. Covered now by a fourth jsdom shim in `vitest.setup.ts`.

### Migration Guide

#### From v5.x to v6.x

1. **Update React** to 19.0.0 or higher.

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

3. **If a node's `children` is a loader function**, return the children instead of calling
   `done`. TypeScript flags every call site.

   ```tsx
   // v5
   children: ({ done }) => {
     fetchChildren().then(done)
   }

   // v6
   children: () => fetchChildren()
   ```

4. **If you pass `slideRegionSize`**, delete it — it has had no effect since v5.

5. **If you have a custom `nodeContentRenderer`** that renders `{node.title}` or
   `{node.subtitle}` directly, handle the function form (it was always possible at runtime,
   and React throws on a function child):

   ```tsx
   {typeof node.title === 'function'
     ? node.title({ node, path, treeIndex })
     : node.title}
   ```

6. **If you were building this package from source** and relied on `build:compiler`,
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
