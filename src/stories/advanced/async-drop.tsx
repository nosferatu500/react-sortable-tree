import React, { useState } from 'react'
import { SortableTree, type TreeItem } from '../../../src'

/**
 * A move that has to be saved before it is real.
 *
 * `onChange` and `onMoveNode` both say "this happened" and cannot fail. `onDrop`
 * says "make this stick", and returning a promise from it is what gives the tree
 * the three states a save actually has:
 *
 * - **saving** — the move is committed optimistically, so the tree is not frozen
 *   under the cursor, and the moved row carries `aria-busy` plus the
 *   `rst__rowSettling` class.
 * - **saved** — announced to screen readers only now, rather than at drop time.
 * - **failed** — the tree reverts to the data from before the drop and emits
 *   `onChange` with it, so a consumer that only listens to `onChange` still ends
 *   up consistent. The rejection also reaches `monitor.getDropError()` and the
 *   environment's uncaught-error handling, which is why a failed save shows up
 *   in the console here.
 *
 * Toggle "make the save fail" and drag something to see the revert.
 */

const initialTree: TreeItem[] = [
  { title: 'Inbox' },
  {
    title: 'Projects',
    expanded: true,
    children: [{ title: 'Roadmap' }, { title: 'Budget' }],
  },
  { title: 'Archive' },
]

const SAVE_MS = 1200

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

const STATUS: Record<SaveState, string> = {
  idle: 'Drag a row to save a move.',
  saving: `Saving… (${SAVE_MS}ms)`,
  saved: 'Saved.',
  failed: 'Save failed — the tree was put back.',
}

const AsyncDrop: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>(initialTree)
  const [shouldFail, setShouldFail] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  return (
    <div>
      <p>{STATUS[saveState]}</p>

      <label>
        <input
          type="checkbox"
          checked={shouldFail}
          onChange={(event) => setShouldFail(event.target.checked)}
        />{' '}
        make the save fail
      </label>

      <div style={{ height: 320, width: 700 }}>
        <SortableTree
          aria-label="Tree whose moves are saved asynchronously"
          treeData={treeData}
          onChange={setTreeData}
          onDrop={async (params, signal) => {
            setSaveState('saving')
            // The signal aborts once the drop can no longer affect anything, so
            // a real implementation forwards it to `fetch`. Honouring it here
            // keeps a superseded save from reporting over a newer one.
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, SAVE_MS)
              signal.addEventListener('abort', () => {
                clearTimeout(timer)
                reject(signal.reason)
              })
            })

            if (shouldFail) {
              setSaveState('failed')
              throw new Error(
                `could not save the move of ${String(params.node.title)}`
              )
            }
            setSaveState('saved')
          }}
        />
      </div>
    </div>
  )
}

export default AsyncDrop
