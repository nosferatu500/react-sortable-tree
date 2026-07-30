import React, { useState } from 'react'
import {
  SortableTree,
  addNodeUnderParent,
  defaultGetNodeKey,
  removeNodeAtPath,
  type TreeItem,
} from '../../../src'

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

const getRandomName = () =>
  firstNames[Math.floor(Math.random() * firstNames.length)]

const AddRemove: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>([
    { title: 'Peter Olofsson' },
    { title: 'Karl Johansson' },
  ])
  const [addAsFirstChild, setAddAsFirstChild] = useState(false)

  return (
    <div>
      <div style={{ height: 300, width: 700 }}>
        <SortableTree
          treeData={treeData}
          onChange={setTreeData}
          generateNodeProps={({ node, path }) => ({
            buttons: [
              <button
                key="add-child"
                onClick={() => {
                  setTreeData(
                    addNodeUnderParent({
                      treeData,
                      parentKey: path.at(-1),
                      expandParent: true,
                      getNodeKey: defaultGetNodeKey,
                      newNode: {
                        // `title` is a ReactNode, so it has to be coerced
                        // before string operations.
                        title: `${getRandomName()} ${
                          String(node.title ?? '').split(' ', 1)[0]
                        }sson`,
                      },
                      addAsFirstChild,
                    }).treeData
                  )
                }}>
                Add Child
              </button>,
              <button
                key="remove"
                onClick={() => {
                  setTreeData(
                    removeNodeAtPath({
                      treeData,
                      path,
                      getNodeKey: defaultGetNodeKey,
                    })
                  )
                }}>
                Remove
              </button>,
            ],
          })}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setTreeData([
            ...treeData,
            { title: `${getRandomName()} ${getRandomName()}sson` },
          ])
        }}>
        Add more
      </button>
      <br />
      <label htmlFor="addAsFirstChild">
        Add new child node at start
        <input
          name="addAsFirstChild"
          type="checkbox"
          checked={addAsFirstChild}
          onChange={() => {
            setAddAsFirstChild((value) => !value)
          }}
        />
      </label>
    </div>
  )
}

export default AddRemove
