import React, { useState } from 'react'
import { SortableTree, type TreeItem } from '../../../src'

const data: TreeItem[] = [
  {
    title: 'src',
    expanded: true,
    children: [
      { title: 'index.ts' },
      {
        title: 'components',
        children: [{ title: 'Button.tsx' }, { title: 'Input.tsx' }],
      },
    ],
  },
  {
    title: 'docs',
    children: [{ title: 'guide.md' }],
  },
  { title: 'README.md' },
]

const KEYS: Array<[string, string]> = [
  ['↓ / ↑', 'Move to the next / previous visible row'],
  ['→', 'Expand a collapsed node, or move to its first child'],
  ['←', 'Collapse an expanded node, or move to its parent'],
  ['Home / End', 'Move to the first / last visible row'],
  ['Enter / Space', 'Toggle the focused node'],
]

/** On a drag handle, and then during the drag it starts. */
const DRAG_KEYS: Array<[string, string]> = [
  ['Space / Enter', 'Pick the row up — press again to drop it'],
  ['↓ / ↑', 'Choose which row it lands next to'],
  ['→ / ←', 'Nest it one level deeper / shallower'],
  ['Esc', 'Cancel, leaving the tree as it was'],
]

const KeyboardNavigation: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>(data)
  const [keyboardNavigation, setKeyboardNavigation] = useState(true)
  const [rowDirection, setRowDirection] = useState<'ltr' | 'rtl'>('ltr')

  return (
    <div style={{ width: 700 }}>
      {/* A `role="tree"` needs an accessible name. This story names it with
       * `aria-labelledby` pointing at the visible heading; `aria-label="Project
       * files"` would do the same job without a visible label. */}
      <h3 id="rst-a11y-heading" style={{ margin: '0 0 8px' }}>
        Project files
      </h3>

      <p style={{ margin: '0 0 8px' }}>
        Press <kbd>Tab</kbd> to enter the tree — one row is in the tab sequence
        at a time (a roving tabindex) — then use the keys below. Left and right
        swap under <code>rowDirection=&quot;rtl&quot;</code>.
      </p>

      <label style={{ marginInlineEnd: 16 }}>
        <input
          type="checkbox"
          checked={keyboardNavigation}
          onChange={(event) => setKeyboardNavigation(event.target.checked)}
        />{' '}
        keyboardNavigation
      </label>
      <label>
        <input
          type="checkbox"
          checked={rowDirection === 'rtl'}
          onChange={(event) =>
            setRowDirection(event.target.checked ? 'rtl' : 'ltr')
          }
        />{' '}
        rowDirection=&quot;rtl&quot;
      </label>

      <div style={{ height: 300, marginTop: 8 }}>
        <SortableTree
          aria-labelledby="rst-a11y-heading"
          treeData={treeData}
          onChange={setTreeData}
          keyboardNavigation={keyboardNavigation}
          rowDirection={rowDirection}
        />
      </div>

      <table
        style={{ marginTop: 8, borderCollapse: 'collapse', fontSize: 13 }}
        aria-label="Keyboard shortcuts">
        <tbody>
          {KEYS.map(([key, action]) => (
            <tr key={key}>
              <th
                scope="row"
                style={{
                  textAlign: 'start',
                  paddingInlineEnd: 12,
                  fontFamily: 'monospace',
                  fontWeight: 'normal',
                }}>
                {key}
              </th>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 8, fontSize: 13 }}>
        Turning <code>keyboardNavigation</code> off leaves the ARIA roles and
        the roving tabindex in place and stops the arrow keys being handled, so
        the surrounding app can bind them itself. Keystrokes from an{' '}
        <code>input</code>, <code>textarea</code>, <code>select</code> or{' '}
        <code>contenteditable</code> inside a row are never intercepted either
        way — inline renaming keeps working.
      </p>
      <p style={{ marginTop: 8, fontSize: 13 }}>
        <strong>Drag and drop works from the keyboard.</strong> Tab from a row
        to its drag handle, then:
      </p>
      <table
        style={{ marginTop: 8, borderCollapse: 'collapse', fontSize: 13 }}
        aria-label="Keyboard drag-and-drop shortcuts">
        <tbody>
          {DRAG_KEYS.map(([key, action]) => (
            <tr key={key}>
              <th
                scope="row"
                style={{
                  textAlign: 'start',
                  paddingInlineEnd: 12,
                  fontFamily: 'monospace',
                  fontWeight: 'normal',
                }}>
                {key}
              </th>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 8, fontSize: 13 }}>
        Up and down choose <em>where</em> the row lands; left and right choose{' '}
        <em>how deeply it nests</em>, the same split as a mouse drag, and they
        mirror under <code>rowDirection=&quot;rtl&quot;</code>. A polite live
        region narrates each step, including where the node finally landed. The
        drag handle shares its row&apos;s tab stop, so the tree as a whole stays
        a single stop however many rows are on screen.
      </p>
    </div>
  )
}

export default KeyboardNavigation
