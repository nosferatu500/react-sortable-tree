import React, { Component } from 'react'
import { DndProvider, DndContext } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { SortableTreeWithExternalManager } from '../src'
// In your own app, you would need to use import styles once in the app
// import 'react-sortable-tree/styles.css';

export default class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      treeData: [
        { title: 'Chicken', expanded: true, children: [{ title: 'Egg' }] },
      ],
    }
  }

  render() {
    return (
      <div style={{ height: 300 }}>
        <DndProvider backend={HTML5Backend}>
          <DndContext.Consumer>
            {({ dragDropManager }) =>
              !dragDropManager ? undefined : (
                <SortableTreeWithExternalManager
                  dragDropManager={dragDropManager}
                  treeData={this.state.treeData}
                  onChange={(treeData) => this.setState({ treeData })}
                />
              )
            }
          </DndContext.Consumer>
        </DndProvider>
      </div>
    )
  }
}
