import React, { useState } from 'react'
import { SortableTree } from '../../../src'

const TreeToTree: React.FC = () => {
  const [treeData1, setTreeData1] = useState([
    { title: 'node1', children: [{ title: 'Child node' }] },
    { title: 'node2' },
  ])
  const [treeData2, setTreeData2] = useState([
    { title: 'node3' },
    { title: 'node4' },
  ])

  const [shouldCopyOnOutsideDrop, setShouldCopyOnOutsideDrop] = useState(false)

  // Both trees need to share this same node type in their
  // `dndType` prop
  const externalNodeType = 'yourNodeType'

  return (
    <div>
      <div
        style={{
          height: 350,
          width: 350,
          float: 'left',
          border: 'solid black 1px',
        }}>
        <SortableTree
          treeData={treeData1}
          onChange={setTreeData1}
          dndType={externalNodeType}
          shouldCopyOnOutsideDrop={shouldCopyOnOutsideDrop}
        />
      </div>

      <div
        style={{
          height: 350,
          width: 350,
          float: 'left',
          border: 'solid black 1px',
        }}>
        <SortableTree
          treeData={treeData2}
          onChange={setTreeData2}
          dndType={externalNodeType}
          shouldCopyOnOutsideDrop={shouldCopyOnOutsideDrop}
        />
      </div>

      <div style={{ clear: 'both' }} />

      <div>
        <label htmlFor="should-copy" style={{ fontSize: '0.8rem' }}>
          Enable node copy via <b>shouldCopyOnOutsideDrop</b>:
          <input
            type="checkbox"
            id="should-copy"
            checked={shouldCopyOnOutsideDrop}
            onChange={(event) =>
              setShouldCopyOnOutsideDrop(event.target.checked)
            }
          />
        </label>
      </div>
    </div>
  )
}

export default TreeToTree
