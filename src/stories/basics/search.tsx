import React, { useState } from 'react'
import { SortableTree } from '../../../src'

const Search: React.FC = () => {
  const title = 'Hay'

  // For generating a haystack (you probably won't need to do this)
  const getStack = (left: number, hasNeedle: any = false): any => {
    if (left === 0) {
      return hasNeedle ? { title: 'Needle' } : { title }
    }

    return {
      title,
      children: [
        {
          title,
          children: [getStack(left - 1, hasNeedle && left % 2), { title }],
        },
        { title },
        {
          title,
          children: [
            { title },
            getStack(left - 1, hasNeedle && (left + 1) % 2),
          ],
        },
      ],
    }
  }

  const [searchString, setSearchString] = useState('')
  const [searchFocusIndex, setSearchFocusIndex] = useState(0)
  const [searchFoundCount, setSearchFoundCount] = useState(0)
  const [treeData, setTreeData] = useState([
    {
      title: 'Haystack',
      children: [getStack(3, true), getStack(3), { title }, getStack(2, true)],
    },
  ])

  // Case insensitive search of `node.title`
  const customSearchMethod = ({ node, searchQuery }: any) =>
    searchQuery && node.title.toLowerCase().includes(searchQuery.toLowerCase())

  const selectPrevMatch = () =>
    setSearchFocusIndex(
      searchFocusIndex === null
        ? searchFoundCount - 1
        : (searchFoundCount + searchFocusIndex - 1) % searchFoundCount
    )

  const selectNextMatch = () =>
    setSearchFocusIndex(
      searchFocusIndex === null ? 0 : (searchFocusIndex + 1) % searchFoundCount
    )

  return (
    <div>
      <h2>Find the needle!</h2>
      <form
        style={{ display: 'inline-block' }}
        onSubmit={(event) => {
          event.preventDefault()
        }}>
        <input
          id="find-box"
          type="text"
          placeholder="Search..."
          style={{ fontSize: '1rem' }}
          value={searchString}
          onChange={(event) => setSearchString(event.target.value)}
        />

        <button
          type="button"
          disabled={!searchFoundCount}
          onClick={selectPrevMatch}>
          &lt;
        </button>

        <button
          type="submit"
          disabled={!searchFoundCount}
          onClick={selectNextMatch}>
          &gt;
        </button>

        <span>
          &nbsp;
          {searchFoundCount > 0 ? searchFocusIndex + 1 : 0}
          &nbsp;/&nbsp;
          {searchFoundCount || 0}
        </span>
      </form>

      <div style={{ height: 300, width: 700 }}>
        <SortableTree
          treeData={treeData}
          onChange={setTreeData}
          //
          // Custom comparison for matching during search.
          // This is optional, and defaults to a case sensitive search of
          // the title and subtitle values.
          // see `defaultSearchMethod` in https://github.com/frontend-collective/react-sortable-tree/blob/master/src/utils/default-handlers.js
          searchMethod={customSearchMethod}
          //
          // The query string used in the search. This is required for searching.
          searchQuery={searchString}
          //
          // When matches are found, this property lets you highlight a specific
          // match and scroll to it. This is optional.
          searchFocusOffset={searchFocusIndex}
          //
          // This callback returns the matches from the search,
          // including their `node`s, `treeIndex`es, and `path`s
          // Here I just use it to note how many matches were found.
          // This is optional, but without it, the only thing searches
          // do natively is outline the matching nodes.
          searchFinishCallback={(matches) => {
            setSearchFoundCount(matches.length)
            setSearchFocusIndex(
              matches.length > 0 ? searchFocusIndex % matches.length : 0
            )
          }}
        />
      </div>
    </div>
  )
}

export default Search
