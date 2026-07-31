import React, { useState } from 'react'
import {
  SortableTree,
  type GetTreeItemChildrenFn,
  type TreeItem,
} from '../../../src'

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

/** Stands in for a real request. Resolves for most ids, rejects for `archive`. */
const fetchChildren = async (id: string): Promise<TreeItem[]> => {
  await delay(900)
  if (id === 'archive') {
    throw new Error('503 Service Unavailable')
  }
  return [
    { title: `${id}/Q1.pdf` },
    { title: `${id}/Q2.pdf` },
    { title: `${id}/Q3.pdf`, children: [{ title: `${id}/Q3-draft.pdf` }] },
  ]
}

const makeData = (note: (message: string) => void): TreeItem[] => {
  // The whole contract: return the children, or a promise for them. There is no
  // `done` callback — the node shows a loading indicator until the promise
  // settles.
  const load: GetTreeItemChildrenFn = async ({ node, path }) => {
    const id = String(node['id'])
    note(`load ${id} at path [${path.join(', ')}]`)
    try {
      return await fetchChildren(id)
    } catch (error) {
      // Handle failures in the loader. An *uncaught* rejection is deliberately
      // left unhandled by the tree, so it surfaces in the console instead of
      // vanishing — but the row then stays on its spinner, which is rarely what
      // you want a user to see.
      note(`failed ${id}: ${(error as Error).message}`)
      return [{ title: `Could not load ${id} — collapse and expand to retry` }]
    }
  }

  return [
    { id: 'reports', title: 'Reports (expand me)', children: load },
    { id: 'archive', title: 'Archive (fails on purpose)', children: load },
    {
      id: 'local',
      title: 'Local folder (ordinary array children)',
      expanded: true,
      children: [{ title: 'notes.md' }],
    },
  ]
}

type LogEntry = { id: number; message: string }

const LazyChildren: React.FC = () => {
  const [log, setLog] = useState<LogEntry[]>([])
  const [loadCollapsedLazyChildren, setLoadCollapsedLazyChildren] =
    useState(false)

  const note = (message: string) =>
    setLog((prev) => [...prev, { id: prev.length, message }])

  const [treeData, setTreeData] = useState<TreeItem[]>(() => makeData(note))

  const reset = () => {
    setLog([])
    setTreeData(makeData(note))
  }

  return (
    <div style={{ width: 700 }}>
      <p style={{ margin: '0 0 8px' }}>
        A node whose <code>children</code> is a function loads when the node is
        expanded. Pass <code>loadCollapsedLazyChildren</code> to load every such
        node up front instead.
      </p>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={loadCollapsedLazyChildren}
          onChange={(event) => {
            setLoadCollapsedLazyChildren(event.target.checked)
            reset()
          }}
        />{' '}
        loadCollapsedLazyChildren
      </label>
      <button type="button" onClick={reset} style={{ marginBottom: 8 }}>
        Reset
      </button>

      <div style={{ height: 300 }}>
        <SortableTree
          aria-label="Lazily loaded documents"
          treeData={treeData}
          onChange={setTreeData}
          loadCollapsedLazyChildren={loadCollapsedLazyChildren}
        />
      </div>

      <p style={{ margin: '8px 0 4px' }}>
        Loader calls — note that a node whose <code>children</code> is still a
        function can be asked to load again on a later tree change, so a real
        loader should be idempotent or cached:
      </p>
      <ol
        style={{
          margin: 0,
          maxHeight: 120,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: 12,
        }}>
        {log.map((entry) => (
          <li key={entry.id}>{entry.message}</li>
        ))}
      </ol>
    </div>
  )
}

export default LazyChildren
