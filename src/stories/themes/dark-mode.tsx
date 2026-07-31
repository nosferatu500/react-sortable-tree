import React, { useState } from 'react'
import { SortableTree, type TreeItem } from '../../index'

const darkModeStyles = `
  /* --- Global Variables Override for Dark Theme --- */
  .rst__theme-dark .rst__tree {
    /* Main Layout Lines */
    --rst-line-color: #555;               /* Dark grey connection lines */
    --rst-line-highlight: #4dbce9;        /* Bright blue guide lines */
    --rst-line-highlight-arrow: #222;     /* Arrow color matching bg */
    
    /* Colors */
    --rst-primary-color: #4dbce9;
    --rst-focus-color: #ff007b;
    --rst-match-color: #ffe600;
    
    /* Landing/Drop Zones */
    --rst-bg-landing: rgba(77, 188, 233, 0.2); /* Transparent Blue */
    --rst-bg-cancel: rgba(255, 0, 0, 0.2);     /* Transparent Red */
    
    /* Text */
    --rst-text-color: #f0f0f0;            /* Bright White-Grey */
    
    /* Button Colors */
    --rst-button-bg: #333;
    --rst-button-border: #666;
  }

  /* --- Row Content Styling (The Node Box) --- */
  .rst__theme-dark .rst__rowContents {
    background-color: #2b2b2b;            /* Dark Grey Background */
    border-color: #444;                   /* Subtle Border */
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
  }
  
  /* Ensure Title and Subtitle inherit the light color */
  .rst__theme-dark .rst__rowLabel,
  .rst__theme-dark .rst__rowTitle,
  .rst__theme-dark .rst__rowSubtitle {
    color: inherit; 
  }

  /* --- Drag Handle Styling (The "Drag Component") --- */
  .rst__theme-dark .rst__moveHandle {
    /* Make the handle dark slate instead of blue */
    background-color: #404040;
    border-color: #555;
    
    /* Optional: Add a subtle glow/highlight on hover */
    transition: background-color 0.2s;
  }
  
  .rst__theme-dark .rst__moveHandle:hover {
    background-color: #505050;
    border-color: #4dbce9; /* Blue border on hover to indicate action */
  }

  /* --- Buttons (+/-) --- */
  /* Invert standard white-bg buttons to look dark */
  .rst__theme-dark .rst__collapseButton, 
  .rst__theme-dark .rst__expandButton {
    background-color: #333;
    box-shadow: 0 0 0 1px #666;
    /* Use CSS filter to turn black icons (if default) to white, 
       or ensure they contrast well. */
    filter: invert(1) hue-rotate(180deg);
  }
  
  .rst__theme-dark .rst__collapseButton:focus, 
  .rst__theme-dark .rst__expandButton:focus {
    box-shadow: 0 0 0 1px #000, 0 0 1px 3px var(--rst-primary-color);
  }

  /* --- Highlight/Search --- */
  .rst__theme-dark .rst__rowSearchMatch {
    outline: solid 3px var(--rst-match-color);
    color: #fff;
  }
`

const DarkMode: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [treeData, setTreeData] = useState<TreeItem[]>([
    {
      title: 'Dark Mode Ready',
      subtitle: 'The text should be light grey now',
      expanded: true,
      children: [
        { title: 'Handle color updated' },
        { title: 'Background is dark slate' },
        {
          title: 'Deep Nested Node',
          expanded: true,
          children: [{ title: 'I am visible!' }],
        },
      ],
    },
    { title: 'Drag me around to test the handle' },
  ])

  const isDark = theme === 'dark'

  return (
    <div
      className={isDark ? 'rst__theme-dark' : ''}
      style={{
        width: 700,
        padding: '20px',
        // Simulate a full app background change
        backgroundColor: isDark ? '#121212' : '#fff',
        color: isDark ? '#fff' : '#333',
        transition: 'background-color 0.3s ease',
        borderRadius: '8px',
        minHeight: '500px',
      }}>
      {/* Inject styles */}
      <style>{darkModeStyles}</style>

      <div
        style={{
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
        }}>
        <strong>Current Theme: {theme.toUpperCase()}</strong>
        <button
          onClick={() =>
            setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
          }
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            backgroundColor: isDark ? '#333' : '#eee',
            color: isDark ? '#fff' : '#000',
            border: `1px solid ${isDark ? '#666' : '#ccc'}`,
            borderRadius: '4px',
            fontWeight: 'bold',
          }}>
          Toggle Theme
        </button>
      </div>

      <div style={{ height: 400 }}>
        <SortableTree
          aria-label="Dark mode tree"
          treeData={treeData}
          onChange={setTreeData}
        />
      </div>
    </div>
  )
}

export default DarkMode
