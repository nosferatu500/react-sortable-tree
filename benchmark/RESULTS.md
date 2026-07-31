### Shipping cost

|  | this fork v6.0.0 | react-sortable-tree v2.8.0 | @minoru/react-dnd-treeview v3.5.4 |
| --- | --- | --- | --- |
| JS, minified + gzipped (library alone) | **15.3 kB** | 46.4 kB | 52.2 kB |
| JS, minified + gzipped (with `react-dnd` + HTML5 backend) | **28.0 kB** | 65.0 kB | 64.4 kB |
| Stylesheet, gzipped | **2.5 kB** | 3.2 kB | none (headless) |
| npm packages installed | **13** | 30 | 20 |
| `node_modules` on disk | **5.1 MB** | 12.9 MB | 14.6 MB |
| React versions supported | 19 | 16 only | 18, 19 |

### Runtime

| Nodes | Library | Mount CPU | Expand a group | Scroll top→bottom CPU | DOM elements | Event listeners | JS heap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | this fork | 4.4 ms | 2.3 ms | 68.3 ms | **177** | 253 | 3.1 MB |
| 100 | react-sortable-tree | 5.5 ms | 2.5 ms | 69.8 ms | 253 | **199** | 3.4 MB |
| 100 | @minoru | 7.4 ms | 3.3 ms | **17.9 ms** | 322 | 993 | 4.1 MB |
| 1,000 | this fork | 4.9 ms | 2.4 ms | 112 ms | **175** | 251 | 3.6 MB |
| 1,000 | react-sortable-tree | 4.6 ms | 1.7 ms | 124 ms | 251 | **197** | 4.0 MB |
| 1,000 | @minoru | 64.3 ms | 23.8 ms | **26.5 ms** | 3,022 | 8,193 | 16.2 MB |
| 10,000 | this fork | 8.1 ms | 7.2 ms | 104 ms | **175** | 251 | 8.1 MB |
| 10,000 | react-sortable-tree | 10.1 ms | 4.8 ms | 113 ms | 251 | **197** | **6.3 MB** |
| 10,000 | @minoru | 2,437 ms | 567 ms | **48.7 ms** | 30,022 | 80,193 | 135.8 MB |

Scroll smoothness: p95 frame time ranged 8.4–9.3 ms across every library and size, and no run dropped a single frame. Scroll CPU above is therefore headroom consumed, not jank observed.

### First paint

| Nodes | this fork | react-sortable-tree | @minoru/react-dnd-treeview |
| --- | --- | --- | --- |
| 100 | 12.2 ms | 4.8 ms | 7.5 ms |
| 1,000 | 11.9 ms | **4.2 ms** | 61.0 ms |
| 10,000 | 11.6 ms | 9.6 ms | 2,453 ms |

### Environment

Apple M4, 10 cores, 32 GB, macOS.
Node v26.5.0. Median of 11 runs after a discarded warm-up.
React 19.2.8 for this fork and @minoru,
React 16.14.0 for the original.

Original on React 19: mounted = false.

```
Uncaught Error: A React Element from an older version of React was rendered. This is not supported. It can happen if:
- Multiple copies of the "react" package is used.
- A library pre-bundled an old copy of "react" or "react/jsx-runtime".
- A compiler tries to "inline" JSX instead of using the runtime.
```
