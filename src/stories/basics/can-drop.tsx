import React, { useState } from 'react'
import { SortableTree, type CanDropParams, type TreeItem } from '../../../src'

const data = [
  {
    id: 'trap',
    title: 'Wicked witch',
    subtitle: 'Traps people',
    expanded: true,
    children: [{ id: 'trapped', title: 'Trapped' }],
  },
  {
    id: 'no-grandkids',
    title: 'Jeannie',
    subtitle: "Doesn't allow grandchildren",
    expanded: true,
    children: [{ id: 'jimmy', title: 'Jimmy' }],
  },
  {
    id: 'twin-1',
    title: 'Twin #1',
    isTwin: true,
    subtitle: "Doesn't play with other twin",
  },
  {
    id: 'twin-2',
    title: 'Twin #2',
    isTwin: true,
    subtitle: "Doesn't play with other twin",
  },
]

// This tree's `getNodeKey` returns the string `id`, so the paths handed to
// `canDrop` hold those ids. They are typed as a numeric path, so stringify
// before comparing against the ids below.
const canDrop = ({
  node,
  nextParent,
  prevPath,
  nextPath,
}: CanDropParams): boolean => {
  const prevKeys = prevPath.map(String)
  const nextKeys = nextPath.map(String)

  if (prevKeys.includes('trap') && !nextKeys.includes('trap')) {
    return false
  }

  if (node.isTwin && nextParent?.isTwin) {
    return false
  }

  const noGrandkidsDepth = nextKeys.indexOf('no-grandkids')
  return noGrandkidsDepth === -1 || nextKeys.length - noGrandkidsDepth <= 2
}

const CanDrop: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>(data)

  return (
    <div style={{ height: 300, width: 700 }}>
      <SortableTree
        treeData={treeData}
        canDrop={canDrop}
        // Need to set getNodeKey to get meaningful ids in paths
        getNodeKey={({ node }) => String(node.id)}
        onChange={setTreeData}
      />
    </div>
  )
}

export default CanDrop
