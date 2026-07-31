import React, { useRef, useState } from 'react'
import {
  SortableTree,
  type GetNodeKeyFunction,
  type TreeItem,
} from '../../../src'

const GROUPS = 10
const PER_GROUP = 999 // 10 groups + 10 × 999 children = 10,000 nodes

const makeData = (): TreeItem[] =>
  Array.from({ length: GROUPS }, (_group, g) => ({
    id: `g${g}`,
    title: `Group ${g + 1}`,
    expanded: true,
    children: Array.from({ length: PER_GROUP }, (_item, i) => ({
      id: `g${g}-n${i}`,
      title: `Group ${g + 1} · item ${i + 1}`,
    })),
  }))

// A stable id beats the default `({ treeIndex }) => treeIndex` at this size:
// positional keys shift on every reorder, so React remounts rows it could have
// moved instead.
const getNodeKey: GetNodeKeyFunction = ({ node }) => String(node['id'])

const LargeTree: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>(makeData)
  const containerRef = useRef<HTMLDivElement>(null)
  const [rendered, setRendered] = useState<number | undefined>(undefined)

  const countRenderedRows = () =>
    setRendered(
      containerRef.current?.querySelectorAll('.rst__node').length ?? 0
    )

  const total = GROUPS + GROUPS * PER_GROUP

  return (
    <div style={{ width: 700 }}>
      <p style={{ margin: '0 0 8px' }}>
        {total.toLocaleString()} nodes, all expanded. Rows are virtualized by{' '}
        <a href="https://github.com/inokawa/virtua">virtua</a>, so only the
        visible window is in the DOM — scroll and count again, the number barely
        moves.
      </p>

      <button type="button" onClick={countRenderedRows}>
        Count rows in the DOM
      </button>
      {rendered !== undefined && (
        <span style={{ marginInlineStart: 8, fontFamily: 'monospace' }}>
          {rendered} of {total.toLocaleString()} rows rendered
        </span>
      )}

      <div ref={containerRef} style={{ height: 400, marginTop: 8 }}>
        <SortableTree
          aria-label={`${total.toLocaleString()} nodes`}
          treeData={treeData}
          onChange={setTreeData}
          getNodeKey={getNodeKey}
        />
      </div>
    </div>
  )
}

export default LargeTree
