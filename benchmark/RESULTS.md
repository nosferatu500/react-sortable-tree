### Shipping cost

|  | this fork v7.0.0 | react-sortable-tree v2.8.0 | @minoru/react-dnd-treeview v3.5.4 |
| --- | --- | --- | --- |
| JS, minified + gzipped (library alone) | **16.0 kB** | 46.5 kB | 52.2 kB |
| JS, minified + gzipped (with `react-dnd` + HTML5 backend) | **30.9 kB** | 65.0 kB | 64.5 kB |
| Stylesheet, gzipped | **2.5 kB** | 3.2 kB | none (headless) |
| npm packages installed | **8** | 30 | 20 |
| `node_modules` on disk | **4.6 MB** | 12.9 MB | 14.6 MB |
| React versions supported | 19 | 16 only | 18, 19 |

### Runtime

| Nodes | Library | Mount CPU | Expand a group | Scroll top→bottom CPU | DOM elements | Event listeners | JS heap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | this fork | 4.8 ms | 3.2 ms | 62.7 ms | **177** | 254 | 3.1 MB |
| 100 | react-sortable-tree | 4.2 ms | 2.0 ms | 54.7 ms | 253 | **199** | 3.4 MB |
| 100 | @minoru | 7.0 ms | 3.3 ms | **11.6 ms** | 322 | 993 | 4.1 MB |
| 1,000 | this fork | 4.5 ms | 3.1 ms | 109 ms | **175** | 252 | 3.7 MB |
| 1,000 | react-sortable-tree | 4.1 ms | **2.2 ms** | 121 ms | 251 | **197** | 4.0 MB |
| 1,000 | @minoru | 63.7 ms | 23.4 ms | **26.8 ms** | 3,022 | 8,193 | 16.2 MB |
| 10,000 | this fork | 6.9 ms | 6.8 ms | 94.4 ms | **175** | 252 | 8.2 MB |
| 10,000 | react-sortable-tree | 9.4 ms | 4.7 ms | 109 ms | 251 | **197** | **6.3 MB** |
| 10,000 | @minoru | 2,228 ms | 584 ms | **43.2 ms** | 30,022 | 80,193 | 135.8 MB |

Scroll smoothness: p95 frame time ranged 8.7–9.3 ms across every library and size, and no run dropped a single frame. Scroll CPU above is therefore headroom consumed, not jank observed.

### First paint

| Nodes | this fork | react-sortable-tree | @minoru/react-dnd-treeview |
| --- | --- | --- | --- |
| 100 | 11.8 ms | 4.5 ms | 7.2 ms |
| 1,000 | 12.6 ms | **4.5 ms** | 63.1 ms |
| 10,000 | 12.0 ms | 9.1 ms | 2,242 ms |

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
