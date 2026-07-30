import React, { useState } from 'react'
import {
  SortableTree,
  changeNodeAtPath,
  type GetNodeKeyFunction,
  type TreeItem,
} from '../../../src'

const data: TreeItem[] = [
  { id: 1, position: 'Goalkeeper' },
  { id: 2, position: 'Wing-back' },
  {
    id: 3,
    position: 'Striker',
    children: [{ id: 4, position: 'Full-back' }],
  },
]

const TEAM_COLORS = ['Red', 'Black', 'Green', 'Blue']

const getNodeKey: GetNodeKeyFunction = ({ node }) => Number(node.id)

const GenerateNodeProps: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>(data)

  return (
    <div style={{ height: 300, width: 700 }}>
      <SortableTree
        treeData={treeData}
        onChange={setTreeData}
        getNodeKey={getNodeKey}
        generateNodeProps={({ node, path }) => {
          const rootLevelIndex = Math.max(
            0,
            treeData.findIndex((n) => path[0] === n.id)
          )
          const playerColor = TEAM_COLORS[rootLevelIndex]

          return {
            style: {
              boxShadow: `0 0 0 4px ${playerColor.toLowerCase()}`,
              textShadow:
                path.length === 1
                  ? `1px 1px 1px ${playerColor.toLowerCase()}`
                  : 'none',
            },
            title: `${playerColor} ${
              path.length === 1 ? 'Captain' : String(node.position)
            }`,
            onClick: () => {
              setTreeData(
                changeNodeAtPath({
                  treeData,
                  path,
                  getNodeKey,
                  newNode: { ...node, expanded: !node.expanded },
                })
              )
            },
          }
        }}
      />
    </div>
  )
}

export default GenerateNodeProps
