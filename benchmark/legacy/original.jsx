/**
 * Harness for the original react-sortable-tree (2.8.0, last published 2020).
 *
 * It lives in this workspace, not next to the other two harnesses, so that
 * `react` resolves to the React 16 copy installed here. 16.14 is the newest
 * React the library's peer range allows.
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { SortableTreeWithoutDndContext } from 'react-sortable-tree'
import 'react-sortable-tree/style.css'
import {
  afterPaint,
  domNodeCount,
  findScroller,
  forceLayout,
  measureScroll,
  nestedTree,
  register,
  timed,
} from '../harness/bench-core.js'
import { createStore } from '../harness/store.js'
import { VIEWPORT, ROW_HEIGHT } from '../harness/layout.js'

const store = createStore([])

class App extends React.Component {
  componentDidMount() {
    this.unsubscribe = store.subscribe(() => this.forceUpdate())
  }

  componentWillUnmount() {
    this.unsubscribe()
  }

  render() {
    return (
      <div style={VIEWPORT}>
        <SortableTreeWithoutDndContext
          treeData={store.get()}
          onChange={store.set}
          rowHeight={ROW_HEIGHT}
        />
      </div>
    )
  }
}

const container = document.getElementById('root')
// react-virtualized renders rows as grid cells.
const rowCount = () => container.querySelectorAll('.rst__node').length

// A React 16 legacy root already commits synchronously, so no flushSync
// equivalent is needed to make these timings comparable with the React 19 pages.
const setFirstGroupExpanded = (expanded) =>
  timed(() => {
    const next = store
      .get()
      .map((node, i) => (i === 0 ? { ...node, expanded } : node))
    store.set(next)
    forceLayout(container)
  }, rowCount)

register({
  name: 'original',

  mount(total) {
    store.set(nestedTree(total))
    return timed(() => {
      ReactDOM.render(
        <DndProvider backend={HTML5Backend}>
          <App />
        </DndProvider>,
        container
      )
      forceLayout(container)
    }, rowCount)
  },

  async reset() {
    ReactDOM.unmountComponentAtNode(container)
    container.innerHTML = ''
    store.set([])
    await afterPaint()
  },

  collapseFirstGroup: () => setFirstGroupExpanded(false),
  expandFirstGroup: () => setFirstGroupExpanded(true),
  domNodes: () => domNodeCount(container),
  rows: rowCount,
  scroll: (steps) => measureScroll(findScroller(container), steps),
})
