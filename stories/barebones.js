import React, { useState } from 'react'
import SortableTree from '../src'
// In your own app, you would need to use import styles once in the app
// import 'react-sortable-tree/styles.css';

export const BarebonesExample = () => {
  const [treeData, setTreeData] = useState([{ title: 'Chicken', expanded: true, children: [{ title: 'Egg' }] }]);
  
  return (
    <div style={{ height: 300 }}>
      <SortableTree
        treeData={treeData}
        onChange={setTreeData}
      />
    </div>
  )
}
