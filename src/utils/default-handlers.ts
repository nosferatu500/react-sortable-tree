import { ReactNode } from "react";

export interface GetTreeItemChildren {
    done: (children: TreeItem[]) => void;
    node: TreeItem;
    path: number[];
    lowerSiblingCounts: number[];
    treeIndex: number;
}

export type GetTreeItemChildrenFn = (data: GetTreeItemChildren) => void;

export type GetNodeKeyFunction = (data: TreeIndex & TreeNode) => string | number;

export interface TreeItem {
    title?: ReactNode | undefined;
    subtitle?: ReactNode | undefined;
    expanded?: boolean | undefined;
    children?: TreeItem[] | GetTreeItemChildrenFn | undefined;
    [x: string]: any;
}

export interface TreeNode {
    node: TreeItem;
}

export interface TreePath {
    path: number[];
}

export interface TreeIndex {
    treeIndex: number;
}

export interface FullTree {
    treeData: TreeItem[] | undefined;
}

export interface NodeData extends TreeNode, TreePath, TreeIndex {}

export interface SearchData extends NodeData {
    searchQuery: string;
}

export const defaultGetNodeKey = ({ treeIndex }: TreeIndex) => treeIndex;

// Cheap hack to get the text of a react object
const getReactElementText = (parent: any) => {
    if (typeof parent === "string") {
        return parent;
    }

    if (
        parent === undefined ||
        typeof parent !== "object" ||
        !parent.props ||
        !parent.props.children ||
        (typeof parent.props.children !== "string" && typeof parent.props.children !== "object")
    ) {
        return "";
    }

    if (typeof parent.props.children === "string") {
        return parent.props.children;
    }

    return parent.props.children.map((child: any) => getReactElementText(child)).join("");
};

// Search for a query string inside a node property
const stringSearch = (key: string, searchQuery: string, node: TreeItem, path: number[], treeIndex: number) => {
    if (typeof node[key] === "function") {
        // Search within text after calling its function to generate the text
        return String(node[key]({ node, path, treeIndex })).includes(searchQuery);
    }
    if (typeof node[key] === "object") {
        // Search within text inside react elements
        return getReactElementText(node[key]).includes(searchQuery);
    }

    // Search within string
    return node[key] && String(node[key]).includes(searchQuery);
};

export const defaultSearchMethod = ({ node, path, treeIndex, searchQuery }: SearchData): boolean => {
    return (
        stringSearch("title", searchQuery, node, path, treeIndex) ||
        stringSearch("subtitle", searchQuery, node, path, treeIndex)
    );
};
