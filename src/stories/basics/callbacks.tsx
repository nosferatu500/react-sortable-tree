import React, { useState } from 'react'
import { SortableTree, type TreeItem, type TreeKey } from '../../../src'

const recordCall = (name: string, args: unknown) => {
  console.log(`${name} called with arguments:`, args)
}

const Callbacks: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>([
    { title: 'A', expanded: true, children: [{ title: 'B' }] },
    { title: 'C' },
  ])
  const [lastMovePrevPath, setLastMovePrevPath] = useState<TreeKey[] | null>(
    null
  )
  const [lastMoveNextPath, setLastMoveNextPath] = useState<TreeKey[] | null>(
    null
  )
  const [lastMoveNode, setLastMoveNode] = useState<TreeItem | null>(null)

  return (
    <div>
      Open your console to see callback parameter info
      <div style={{ height: 300, width: 700 }}>
        <SortableTree
          treeData={treeData}
          onChange={setTreeData}
          // Need to set getNodeKey to get meaningful ids in paths
          getNodeKey={({ node }) => `node${node.title}`}
          onVisibilityToggle={(args) => recordCall('onVisibilityToggle', args)}
          onMoveNode={(args) => {
            recordCall('onMoveNode', args)
            const { prevPath, nextPath, node } = args
            setLastMovePrevPath(prevPath)
            // `nextPath` is optional on the callback params.
            setLastMoveNextPath(nextPath ?? null)
            setLastMoveNode(node)
          }}
          onDragStateChanged={(args) => recordCall('onDragStateChanged', args)}
        />
      </div>
      {lastMoveNode && (
        <div>
          Node &quot;{String(lastMoveNode.title)}&quot; moved from path [
          {lastMovePrevPath?.join(',')}] to path [{lastMoveNextPath?.join(',')}
          ].
        </div>
      )}
    </div>
  )
}

export default Callbacks
