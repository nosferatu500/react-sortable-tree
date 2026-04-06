import React, { useState } from 'react'
import { SortableTree, changeNodeAtPath } from '../../../src'

const data = [
  { name: 'IT Manager' },
  {
    name: 'Regional Manager',
    expanded: true,
    children: [{ name: 'Branch Manager' }],
  },
]

const ModifyNodes: React.FC = () => {
  const [treeData, setTreeData] = useState<any>(data)

  const getNodeKey = ({ treeIndex }: { treeIndex: number }) => treeIndex

  return (
    <div style={{ height: 300, width: 700 }}>
      <SortableTree
        treeData={treeData}
        onChange={setTreeData}
        generateNodeProps={({ node, path }) => ({
          title: (
            <input
              style={{ fontSize: '1.1rem' }}
              value={node.name}
              onChange={(event) => {
                const name = event.target.value

                setTreeData(
                  changeNodeAtPath({
                    treeData,
                    path,
                    getNodeKey,
                    newNode: { ...node, name },
                  })
                )
              }}
            />
          ),
        })}
      />
    </div>
  )
}

export default ModifyNodes
