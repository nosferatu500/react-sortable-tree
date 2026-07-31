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
| 100 | this fork | 4.6 ms | 2.6 ms | 70.2 ms | 177 | 253 | 3.0 MB |
| 100 | react-sortable-tree | 4.8 ms | 2.2 ms | 60.4 ms | 253 | 199 | 3.2 MB |
| 100 | @minoru | 7.2 ms | 3.4 ms | 18.1 ms | 322 | 993 | 4.0 MB |
| 1,000 | this fork | 4.4 ms | 2.7 ms | 111 ms | 175 | 251 | 3.5 MB |
| 1,000 | react-sortable-tree | 4.5 ms | 2.3 ms | 134 ms | 251 | 197 | 3.9 MB |
| 1,000 | @minoru | 63.6 ms | 23.4 ms | 26.9 ms | 3,022 | 8,193 | 16.1 MB |
| 10,000 | this fork | 7.7 ms | 5.8 ms | 102 ms | 175 | 251 | 8.0 MB |
| 10,000 | react-sortable-tree | 9.1 ms | 4.5 ms | 115 ms | 251 | 197 | 6.2 MB |
| 10,000 | @minoru | 2,504 ms | 547 ms | 52.4 ms | 30,022 | 80,193 | 135.7 MB |

### First paint

| Nodes | this fork | react-sortable-tree | @minoru/react-dnd-treeview |
| --- | --- | --- | --- |
| 100 | 11.9 ms | 4.3 ms | 7.3 ms |
| 1,000 | 12.2 ms | 4.4 ms | 62.8 ms |
| 10,000 | 10.9 ms | 8.7 ms | 2,520 ms |

### Environment

Apple M4, 10 cores, 32 GB, macOS.
Node v26.5.0. Median of 5 runs after a discarded warm-up.
React 19.2.8 for this fork and @minoru,
React 16.14.0 for the original.

Original on React 19: mounted = false.

```
Uncaught Error: A React Element from an older version of React was rendered. This is not supported. It can happen if:
- Multiple copies of the "react" package is used.
- A library pre-bundled an old copy of "react" or "react/jsx-runtime".
- A compiler tries to "inline" JSX instead of using the runtime.
```
