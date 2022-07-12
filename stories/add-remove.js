import React, { Component } from 'react'
import SortableTree from '../src'
// In your own app, you would need to use import styles once in the app
// import 'react-sortable-tree/styles.css';

const firstNames = [
  'Abraham',
  'Adam',
  'Agnar',
  'Albert',
  'Albin',
  'Albrecht',
  'Alexander',
  'Alfred',
  'Alvar',
  'Ander',
  'Andrea',
  'Arthur',
  'Axel',
  'Bengt',
  'Bernhard',
  'Carl',
  'Daniel',
  'Einar',
  'Elmer',
  'Eric',
  'Erik',
  'Gerhard',
  'Gunnar',
  'Gustaf',
  'Harald',
  'Herbert',
  'Herman',
  'Johan',
  'John',
  'Karl',
  'Leif',
  'Leonard',
  'Martin',
  'Matt',
  'Mikael',
  'Nikla',
  'Norman',
  'Oliver',
  'Olof',
  'Olvir',
  'Otto',
  'Patrik',
  'Peter',
  'Petter',
  'Robert',
  'Rupert',
  'Sigurd',
  'Simon',
]

export default class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      treeData: [{ title: 'Peter Olofsson' }, { title: 'Karl Johansson' }],
      addAsFirstChild: false,
    }
  }

  render() {
    const getRandomName = () =>
      firstNames[Math.floor(Math.random() * firstNames.length)]
    return (
      <div>
        <div style={{ height: 300 }}>
          <SortableTree
            treeData={this.state.treeData}
            onChange={(treeData) => this.setState({ treeData })}
          />
        </div>

        <button
          onClick={() =>
            this.setState((state) => ({
              treeData: state.treeData.concat({
                title: `${getRandomName()} ${getRandomName()}sson`,
              }),
            }))
          }>
          Add more
        </button>
        <br />
        <label htmlFor="addAsFirstChild">
          Add new nodes at start
          <input
            name="addAsFirstChild"
            type="checkbox"
            checked={this.state.addAsFirstChild}
            onChange={() =>
              this.setState((state) => ({
                addAsFirstChild: !state.addAsFirstChild,
              }))
            }
          />
        </label>
      </div>
    )
  }
}
