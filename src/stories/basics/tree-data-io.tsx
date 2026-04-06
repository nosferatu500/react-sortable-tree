import React, { useState } from 'react'
import {
  SortableTree,
  getFlatDataFromTree,
  getTreeFromFlatData,
} from '../../../src'

const initialData = [
  { id: '1', name: 'N1', parent: null },
  { id: '2', name: 'N2', parent: null },
  { id: '3', name: 'N3', parent: 2 },
  { id: '4', name: 'N4', parent: 3 },
]

const TreeDataIO: React.FC = () => {
  const [treeData, setTreeData] = useState(
    getTreeFromFlatData({
      flatData: initialData.map((node) => ({ ...node, title: node.name })),
      getKey: (node) => node.id, // resolve a node's key
      getParentKey: (node) => node.parent, // resolve a node's parent's key
      rootKey: null, // The value of the parent key when there is no parent (i.e., at root level)
    })
  )

  const flatData = getFlatDataFromTree({
    treeData,
    getNodeKey: ({ node }) => node.id, // This ensures your "id" properties are exported in the path
    ignoreCollapsed: false, // Makes sure you traverse every node in the tree, not just the visible ones
  }).map(({ node, path }) => ({
    id: node.id,
    name: node.name,

    // The last entry in the path is this node's key
    // The second to last entry (accessed here) is the parent node's key
    parent: path.length > 1 ? path.at(-2) : null,
  }))

  return (
    <div>
      ↓treeData for this tree was generated from flat data similar to DB rows↓
      <div style={{ height: 300, width: 700 }}>
        <SortableTree treeData={treeData} onChange={setTreeData} />
      </div>
      <hr />
      ↓This flat data is generated from the modified tree data↓
      <ul>
        {flatData.map(({ id, name, parent }) => (
          <li key={id}>
            id: {id}, name: {name}, parent: {parent || 'null'}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TreeDataIO
