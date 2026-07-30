import React, { useState } from 'react'
import { SortableTree, type TreeItem } from '../../../src'

const data = [
  {
    title: 'Managers',
    expanded: true,
    children: [
      {
        title: 'Rob',
        children: [],
        isPerson: true,
      },
      {
        title: 'Joe',
        children: [],
        isPerson: true,
      },
    ],
  },
  {
    title: 'Clerks',
    expanded: true,
    children: [
      {
        title: 'Bertha',
        children: [],
        isPerson: true,
      },
      {
        title: 'Billy',
        children: [],
        isPerson: true,
      },
    ],
  },
]

const ChildlessNodes: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>(data)

  return (
    <div style={{ height: 300, width: 700 }}>
      <SortableTree
        canNodeHaveChildren={(node) => !node.isPerson}
        treeData={treeData}
        onChange={setTreeData}
      />
    </div>
  )
}

export default ChildlessNodes
