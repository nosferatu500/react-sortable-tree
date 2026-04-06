import React, { useState } from 'react'
import { SortableTree } from '../../../src'

const Callbacks: React.FC = () => {
  const [treeData, setTreeData] = useState([
    { title: 'A', expanded: true, children: [{ title: 'B' }] },
    { title: 'C' },
  ])
  const [lastMovePrevPath, setLlastMovePrevPath] = useState<any>(null)
  const [lastMoveNextPath, setLastMoveNextPath] = useState<any>(null)
  const [lastMoveNode, setLastMoveNode] = useState<any>(null)

  const recordCall = (name: string, args: any) => {
    console.log(`${name} called with arguments:`, args)
  }

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
            setLlastMovePrevPath(prevPath)
            setLastMoveNextPath(nextPath)
            setLastMoveNode(node)
          }}
          onDragStateChanged={(args) => recordCall('onDragStateChanged', args)}
        />
      </div>
      {lastMoveNode && (
        <div>
          Node &quot;{lastMoveNode.title}&quot; moved from path [
          {lastMovePrevPath.join(',')}] to path [{lastMoveNextPath.join(',')}
          ].
        </div>
      )}
    </div>
  )
}

export default Callbacks
