import React, { useState } from 'react'
import { SortableTree, TreeItem } from '../../index'
import {
  fileExplorerTheme,
  FILE_EXPLORER_THEME_CLASS,
  FILE_EXPLORER_DARK_CLASS,
} from './file-explorer'

const initialTreeData: TreeItem[] = [
  {
    title: 'src',
    isDirectory: true,
    expanded: true,
    children: [
      {
        title: 'components',
        isDirectory: true,
        expanded: true,
        children: [
          { title: 'Button.tsx' },
          { title: 'Button.css' },
          { title: 'Input.tsx' },
          { title: 'Input.css' },
          {
            title: 'forms',
            isDirectory: true,
            children: [
              { title: 'LoginForm.tsx' },
              { title: 'RegisterForm.tsx' },
            ],
          },
        ],
      },
      {
        title: 'hooks',
        isDirectory: true,
        children: [
          { title: 'useAuth.ts' },
          { title: 'useApi.ts' },
          { title: 'useLocalStorage.ts' },
        ],
      },
      {
        title: 'utils',
        isDirectory: true,
        children: [
          { title: 'helpers.ts' },
          { title: 'constants.ts' },
          { title: 'types.ts' },
        ],
      },
      { title: 'App.tsx' },
      { title: 'index.tsx' },
      { title: 'styles.css' },
    ],
  },
  {
    title: 'public',
    isDirectory: true,
    children: [
      { title: 'index.html' },
      { title: 'favicon.ico' },
      {
        title: 'images',
        isDirectory: true,
        children: [{ title: 'logo.png' }, { title: 'banner.jpg' }],
      },
    ],
  },
  { title: 'package.json' },
  { title: 'tsconfig.json' },
  { title: 'README.md' },
  { title: '.gitignore' },
]

// Rendered verbatim in the story as a usage snippet. The `{...}` braces are
// literal JSX being shown to the reader, not interpolations — hence the
// disabled rule.
/* eslint-disable unicorn/no-incorrect-template-string-interpolation */
const USAGE_SAMPLE = `import { fileExplorerTheme, FILE_EXPLORER_THEME_CLASS } from './themes/file-explorer'

<div className={FILE_EXPLORER_THEME_CLASS}>
  <SortableTree
    treeData={treeData}
    onChange={setTreeData}
    theme={fileExplorerTheme}
    rowHeight={28}
    // Only folders can have children
    canNodeHaveChildren={(node) => node.isDirectory === true}
    // Only allow dropping into folders
    canDrop={({ nextParent }) =>
      !nextParent || nextParent.isDirectory === true
    }
  />
</div>`
/* eslint-enable unicorn/no-incorrect-template-string-interpolation */

const FileExplorer: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [treeData, setTreeData] = useState<TreeItem[]>(initialTreeData)

  const isDark = theme === 'dark'

  const themeClasses = [
    FILE_EXPLORER_THEME_CLASS,
    isDark ? FILE_EXPLORER_DARK_CLASS : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      style={{
        padding: 20,
        backgroundColor: isDark ? '#252526' : '#f3f3f3',
        minHeight: '100vh',
        transition: 'background-color 0.3s ease',
      }}>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}>
        <strong style={{ color: isDark ? '#fff' : '#333' }}>
          File Explorer Theme
        </strong>
        <button
          onClick={() =>
            setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
          }
          style={{
            padding: '6px 12px',
            cursor: 'pointer',
            backgroundColor: isDark ? '#0e639c' : '#007acc',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            fontSize: 12,
          }}>
          Toggle {isDark ? 'Light' : 'Dark'} Mode
        </button>
      </div>

      <div
        className={themeClasses}
        style={{
          width: 300,
          borderRadius: 4,
          overflow: 'hidden',
          border: isDark ? '1px solid #3c3c3c' : '1px solid #e0e0e0',
        }}>
        <div style={{ height: 500 }}>
          <SortableTree
            treeData={treeData}
            onChange={setTreeData}
            theme={fileExplorerTheme}
            rowHeight={28}
            canNodeHaveChildren={(node) => node.isDirectory === true}
            canDrop={({ nextParent }) =>
              !nextParent || nextParent.isDirectory === true
            }
            generateNodeProps={({ node }) => ({
              buttons: [
                <button
                  key="delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    alert(`Delete: ${node.title}`)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    fontSize: 12,
                    color: isDark ? '#ccc' : '#666',
                  }}
                  title="Delete">
                  ×
                </button>,
              ],
            })}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          backgroundColor: isDark ? '#2d2d2d' : '#fff',
          borderRadius: 4,
          border: isDark ? '1px solid #3c3c3c' : '1px solid #e0e0e0',
          color: isDark ? '#ccc' : '#333',
          fontSize: 13,
        }}>
        <strong>Usage:</strong>
        <pre
          style={{
            margin: '10px 0 0',
            padding: 12,
            backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5',
            borderRadius: 4,
            overflow: 'auto',
            fontSize: 12,
          }}>
          {USAGE_SAMPLE}
        </pre>
      </div>
    </div>
  )
}

export default FileExplorer
