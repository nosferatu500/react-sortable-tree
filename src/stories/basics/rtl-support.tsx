import React, { useState } from 'react'
import { SortableTree } from '../../../src'

const rtlData = [
  {
    title: 'المجلد الرئيسي (Main)',
    expanded: true,
    children: [
      { title: 'ملف واحد (File 1)' },
      { title: 'ملف اثنان (File 2)' },
      { 
        title: 'مجلد فرعي (Subfolder)', 
        expanded: false,
        children: [{ title: 'عنصر مخفي (Hidden)' }]
      },
    ],
  },
  { title: 'عنصر آخر (Another Node)' },
];

const RTLSupport: React.FC = () => {
  const [treeData, setTreeData] = useState(rtlData);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('rtl');

  return (
    <div style={{ width: 700 }}>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <strong>Current Direction: {direction.toUpperCase()}</strong>
        <button 
          onClick={() => setDirection(prev => prev === 'rtl' ? 'ltr' : 'rtl')}
          style={{ padding: '5px 10px', cursor: 'pointer' }}
        >
          Toggle Direction
        </button>
      </div>

      <div style={{ height: 400, border: '1px solid #ccc' }}>
        <SortableTree
          rowDirection={direction}
          treeData={treeData}
          onChange={setTreeData}
        />
      </div>
    </div>
  )
}

export default RTLSupport;
