import React, { useState } from 'react'
import {
  SortableTree,
  changeNodeAtPath,
  defaultGetNodeKey,
  type TreeItem,
} from '../../../src'

const data: TreeItem[] = [
  { name: 'IT Manager' },
  {
    name: 'Regional Manager',
    expanded: true,
    children: [{ name: 'Branch Manager' }],
  },
]

const ModifyNodes: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>(data)

  return (
    <div style={{ height: 300, width: 700 }}>
      <SortableTree
        treeData={treeData}
        onChange={setTreeData}
        generateNodeProps={({ node, path }) => ({
          title: (
            <input
              style={{ fontSize: '1.1rem' }}
              // Custom fields come off TreeItem's index signature as
              // `unknown`, so coerce before handing to a controlled input.
              value={String(node.name ?? '')}
              onChange={(event) => {
                const name = event.target.value

                setTreeData(
                  changeNodeAtPath({
                    treeData,
                    path,
                    getNodeKey: defaultGetNodeKey,
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
