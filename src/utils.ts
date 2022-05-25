import NodeRendererDefault from './node-renderer-default'
import PlaceholderRendererDefault from './placeholder-renderer-default'
import TreeNode from './tree-node'

export const mergeTheme = (props: any) => {
  const merged = {
    ...props,
    style: props.theme
      ? { ...props.theme.style, ...props.style }
      : { ...props.style },
    innerStyle: props.theme
      ? { ...props.theme.innerStyle, ...props.innerStyle }
      : { ...props.innerStyle },
  }

  const overridableDefaults = {
    nodeContentRenderer: NodeRendererDefault,
    placeholderRenderer: PlaceholderRendererDefault,
    scaffoldBlockPxWidth: 44,
    slideRegionSize: 100,
    rowHeight: 62,
    treeNodeRenderer: TreeNode,
  }
  for (const propKey of Object.keys(overridableDefaults)) {
    // If prop has been specified, do not change it
    // If prop is specified in theme, use the theme setting
    // If all else fails, fall back to the default
    if (props[propKey] === undefined) {
      if (props.theme) {
        merged[propKey] =
          typeof props.theme[propKey] !== 'undefined'
            ? props.theme[propKey]
            : overridableDefaults[propKey]
      } else {
        merged[propKey] = overridableDefaults[propKey]
      }
    }
  }

  return merged
}
