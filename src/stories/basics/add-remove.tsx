import React, { useState } from 'react'
import {
  SortableTree,
  addNodeUnderParent,
  removeNodeAtPath,
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

const AddRemove: React.FC = () => {
  const [treeData, setTreeData] = useState<any>([
    { title: 'Peter Olofsson' },
    { title: 'Karl Johansson' },
  ])
  const [addAsFirstChild, setAddAsFirstChild] = useState(false)

  const getNodeKey = ({ treeIndex }: { treeIndex: number }) => treeIndex
  const getRandomName = () =>
    firstNames[Math.floor(Math.random() * firstNames.length)]

  return (
    <div>
      <div style={{ height: 300, width: 700 }}>
        <SortableTree
          treeData={treeData}
          onChange={setTreeData}
          generateNodeProps={({ node, path }) => ({
            buttons: [
              <button
                onClick={() => {
                  setTreeData(
                    addNodeUnderParent({
                      treeData,
                      parentKey: path.at(-1),
                      expandParent: true,
                      getNodeKey,
                      newNode: {
                        title: `${getRandomName()} ${
                          node.title.split(' ')[0]
                        }sson`,
                      },
                      addAsFirstChild,
                    }).treeData
                  )
                }}>
                Add Child
              </button>,
              <button
                onClick={() => {
                  setTreeData(
                    removeNodeAtPath({
                      treeData,
                      path,
                      getNodeKey,
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
        onClick={() => {
          setTreeData(
            treeData.concat({
              title: `${getRandomName()} ${getRandomName()}sson`,
            })
          )
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
