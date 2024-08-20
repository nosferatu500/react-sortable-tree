"use strict";(self.webpackChunk_nosferatu500_react_sortable_tree=self.webpackChunk_nosferatu500_react_sortable_tree||[]).push([[32],{"./src/stories/advanced/advanced.stories.tsx":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.r(__webpack_exports__),__webpack_require__.d(__webpack_exports__,{DragFromExternalSource:()=>DragFromExternalSource,DragOutToRemove:()=>advanced_stories_DragOutToRemove,MinimalImplementationWithoutDndContext:()=>MinimalImplementationWithoutDndContext,OnlyExpandSearchedNodes:()=>advanced_stories_OnlyExpandSearchedNodes,PlayingWithGenerateNodeProps:()=>PlayingWithGenerateNodeProps,PreventSomeNodesFromHavingChildren:()=>PreventSomeNodesFromHavingChildren,TouchSupport:()=>advanced_stories_TouchSupport,TreeToTreeDragging:()=>TreeToTreeDragging,__namedExportsOrder:()=>__namedExportsOrder,default:()=>advanced_stories});var react=__webpack_require__("./node_modules/react/index.js"),DndProvider=__webpack_require__("./node_modules/react-dnd/dist/esm/core/DndProvider.js"),esm=__webpack_require__("./node_modules/react-dnd-html5-backend/dist/esm/index.js"),src=__webpack_require__("./src/index.ts");const barebones_no_context=()=>{const[treeData,setTreeData]=(0,react.useState)([{title:"Chicken",expanded:!0,children:[{title:"Egg"}]}]);return react.createElement("div",{style:{height:300,width:700}},react.createElement(DndProvider.Q,{backend:esm.t2},react.createElement(src.qL,{treeData,onChange:setTreeData})))};try{barebonesnocontext.displayName="barebonesnocontext",barebonesnocontext.__docgenInfo={description:"",displayName:"barebonesnocontext",props:{}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/stories/advanced/barebones-no-context.tsx#barebonesnocontext"]={docgenInfo:barebonesnocontext.__docgenInfo,name:"barebonesnocontext",path:"src/stories/advanced/barebones-no-context.tsx#barebonesnocontext"})}catch(__react_docgen_typescript_loader_error){}const data=[{title:"Managers",expanded:!0,children:[{title:"Rob",children:[],isPerson:!0},{title:"Joe",children:[],isPerson:!0}]},{title:"Clerks",expanded:!0,children:[{title:"Bertha",children:[],isPerson:!0},{title:"Billy",children:[],isPerson:!0}]}],childless_nodes=()=>{const[treeData,setTreeData]=(0,react.useState)(data);return react.createElement("div",{style:{height:300,width:700}},react.createElement(src.XF,{canNodeHaveChildren:node=>!node.isPerson,treeData,onChange:setTreeData}))};try{childlessnodes.displayName="childlessnodes",childlessnodes.__docgenInfo={description:"",displayName:"childlessnodes",props:{}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/stories/advanced/childless-nodes.tsx#childlessnodes"]={docgenInfo:childlessnodes.__docgenInfo,name:"childlessnodes",path:"src/stories/advanced/childless-nodes.tsx#childlessnodes"})}catch(__react_docgen_typescript_loader_error){}var DropTarget=__webpack_require__("./node_modules/react-dnd/dist/esm/decorators/DropTarget.js");class trashAreaBaseComponent extends react.Component{render(){const{connectDropTarget,children,isOver}=this.props;return connectDropTarget(react.createElement("div",{style:{height:"100vh",padding:50,background:isOver?"pink":"transparent"}},children))}}const TrashAreaComponent=(0,DropTarget.T)("yourNodeType",{drop:(props,monitor)=>({...monitor.getItem(),treeId:"trash"})},((connect,monitor)=>({connectDropTarget:connect.dropTarget(),isOver:monitor.isOver({shallow:!0})})))(trashAreaBaseComponent),drag_out_to_remove=()=>{const[treeData,setTreeData]=(0,react.useState)([{title:"1"},{title:"2"},{title:"3"},{title:"4",expanded:!0,children:[{title:"5"}]}]);return react.createElement(DndProvider.Q,{backend:esm.t2},react.createElement("div",null,react.createElement(TrashAreaComponent,null,react.createElement("div",{style:{height:300,width:700}},react.createElement(src.qL,{treeData,onChange:setTreeData,dndType:"yourNodeType"})))))};try{dragouttoremove.displayName="dragouttoremove",dragouttoremove.__docgenInfo={description:"",displayName:"dragouttoremove",props:{}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/stories/advanced/drag-out-to-remove.tsx#dragouttoremove"]={docgenInfo:dragouttoremove.__docgenInfo,name:"dragouttoremove",path:"src/stories/advanced/drag-out-to-remove.tsx#dragouttoremove"})}catch(__react_docgen_typescript_loader_error){}var DragSource=__webpack_require__("./node_modules/react-dnd/dist/esm/decorators/DragSource.js");class externalNodeBaseComponent extends react.Component{render(){const{connectDragSource,node}=this.props;return connectDragSource(react.createElement("div",{style:{display:"inline-block",padding:"3px 5px",background:"blue",color:"white"}},node.title),{dropEffect:"copy"})}}const YourExternalNodeComponent=(0,DragSource.I)("yourNodeType",{beginDrag:componentProps=>({node:{...componentProps.node}})},(connect=>({connectDragSource:connect.dragSource()})))(externalNodeBaseComponent),external_node=()=>{const[treeData,setTreeData]=(0,react.useState)([{title:"Mama Rabbit"},{title:"Papa Rabbit"}]);return react.createElement(DndProvider.Q,{backend:esm.t2},react.createElement("div",null,react.createElement("div",{style:{height:300,width:700}},react.createElement(src.qL,{treeData,onChange:setTreeData,dndType:"yourNodeType"})),react.createElement(YourExternalNodeComponent,{node:{title:"Baby Rabbit"}}),"← drag this"))};try{externalnode.displayName="externalnode",externalnode.__docgenInfo={description:"",displayName:"externalnode",props:{}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/stories/advanced/external-node.tsx#externalnode"]={docgenInfo:externalnode.__docgenInfo,name:"externalnode",path:"src/stories/advanced/external-node.tsx#externalnode"})}catch(__react_docgen_typescript_loader_error){}const generate_node_props_data=[{id:1,position:"Goalkeeper"},{id:2,position:"Wing-back"},{id:3,position:"Striker",children:[{id:4,position:"Full-back"}]}],TEAM_COLORS=["Red","Black","Green","Blue"],generate_node_props=()=>{const[treeData,setTreeData]=(0,react.useState)(generate_node_props_data),getNodeKey=({node:{id}})=>id;return react.createElement("div",{style:{height:300,width:700}},react.createElement(src.XF,{treeData,onChange:setTreeData,getNodeKey,generateNodeProps:({node,path})=>{const rootLevelIndex=treeData.reduce(((acc,n,index)=>null!==acc?acc:path[0]===n.id?index:null),null)||0,playerColor=TEAM_COLORS[rootLevelIndex];return{style:{boxShadow:`0 0 0 4px ${playerColor.toLowerCase()}`,textShadow:1===path.length?`1px 1px 1px ${playerColor.toLowerCase()}`:"none"},title:`${playerColor} ${1===path.length?"Captain":node.position}`,onClick:()=>{setTreeData((0,src.rc)({treeData,path,getNodeKey,newNode:{...node,expanded:!node.expanded}}))}}}}))};try{generatenodeprops.displayName="generatenodeprops",generatenodeprops.__docgenInfo={description:"",displayName:"generatenodeprops",props:{}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/stories/advanced/generate-node-props.tsx#generatenodeprops"]={docgenInfo:generatenodeprops.__docgenInfo,name:"generatenodeprops",path:"src/stories/advanced/generate-node-props.tsx#generatenodeprops"})}catch(__react_docgen_typescript_loader_error){}const only_expand_searched_node=()=>{const getStack=(left,hasNeedle=!1)=>0===left?hasNeedle?{title:"Needle"}:{title:"Hay"}:{title:"Hay",children:[{title:"Hay",children:[getStack(left-1,hasNeedle&&left%2),{title:"Hay"}]},{title:"Hay"},{title:"Hay",children:[{title:"Hay"},getStack(left-1,hasNeedle&&(left+1)%2)]}]},[searchString,setSearchString]=(0,react.useState)(""),[searchFocusIndex,setSearchFocusIndex]=(0,react.useState)(0),[searchFoundCount,setSearchFoundCount]=(0,react.useState)(0),[treeData,setTreeData]=(0,react.useState)([{title:"Haystack",children:[getStack(3,!0),getStack(3),{title:"Hay"},getStack(2,!0)]}]);return react.createElement("div",null,react.createElement("h2",null,"Find the needle!"),react.createElement("form",{style:{display:"inline-block"},onSubmit:event=>{event.preventDefault()}},react.createElement("input",{id:"find-box",type:"text",placeholder:"Search...",style:{fontSize:"1rem"},value:searchString,onChange:event=>setSearchString(event.target.value)}),react.createElement("button",{type:"button",disabled:!searchFoundCount,onClick:()=>setSearchFocusIndex(null!==searchFocusIndex?(searchFoundCount+searchFocusIndex-1)%searchFoundCount:searchFoundCount-1)},"<"),react.createElement("button",{type:"submit",disabled:!searchFoundCount,onClick:()=>setSearchFocusIndex(null!==searchFocusIndex?(searchFocusIndex+1)%searchFoundCount:0)},">"),react.createElement("span",null," ",searchFoundCount>0?searchFocusIndex+1:0," / ",searchFoundCount||0)),react.createElement("div",{style:{height:300,width:700}},react.createElement(src.XF,{treeData,onChange:setTreeData,searchMethod:({node,searchQuery})=>searchQuery&&node.title.toLowerCase().indexOf(searchQuery.toLowerCase())>-1,searchQuery:searchString,searchFocusOffset:searchFocusIndex,searchFinishCallback:matches=>{setSearchFoundCount(matches.length),setSearchFocusIndex(matches.length>0?searchFocusIndex%matches.length:0)},onlyExpandSearchedNodes:!0})))};try{onlyexpandsearchednode.displayName="onlyexpandsearchednode",onlyexpandsearchednode.__docgenInfo={description:"",displayName:"onlyexpandsearchednode",props:{}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/stories/advanced/only-expand-searched-node.tsx#onlyexpandsearchednode"]={docgenInfo:onlyexpandsearchednode.__docgenInfo,name:"onlyexpandsearchednode",path:"src/stories/advanced/only-expand-searched-node.tsx#onlyexpandsearchednode"})}catch(__react_docgen_typescript_loader_error){}var dist_esm=__webpack_require__("./node_modules/react-dnd-touch-backend/dist/esm/index.js");const isTouchDevice=!(!("ontouchstart"in window)&&!navigator.maxTouchPoints),dndBackend=isTouchDevice?dist_esm.qi:esm.t2,touch_support=()=>{const[treeData,setTreeData]=(0,react.useState)([{title:"Chicken",expanded:!0,children:[{title:"Egg"}]}]);return react.createElement(DndProvider.Q,{backend:dndBackend},react.createElement("div",null,react.createElement("span",null,"This is ",!isTouchDevice&&"not ","a touch-supporting browser"),react.createElement("div",{style:{height:300,width:700}},react.createElement(src.qL,{treeData,onChange:setTreeData}))))};try{touchsupport.displayName="touchsupport",touchsupport.__docgenInfo={description:"",displayName:"touchsupport",props:{}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/stories/advanced/touch-support.tsx#touchsupport"]={docgenInfo:touchsupport.__docgenInfo,name:"touchsupport",path:"src/stories/advanced/touch-support.tsx#touchsupport"})}catch(__react_docgen_typescript_loader_error){}const tree_to_tree=()=>{const[treeData1,setTreeData1]=(0,react.useState)([{title:"node1",children:[{title:"Child node"}]},{title:"node2"}]),[treeData2,setTreeData2]=(0,react.useState)([{title:"node3"},{title:"node4"}]),[shouldCopyOnOutsideDrop,setShouldCopyOnOutsideDrop]=(0,react.useState)(!1);return react.createElement("div",null,react.createElement("div",{style:{height:350,width:350,float:"left",border:"solid black 1px"}},react.createElement(src.XF,{treeData:treeData1,onChange:setTreeData1,dndType:"yourNodeType",shouldCopyOnOutsideDrop})),react.createElement("div",{style:{height:350,width:350,float:"left",border:"solid black 1px"}},react.createElement(src.XF,{treeData:treeData2,onChange:setTreeData2,dndType:"yourNodeType",shouldCopyOnOutsideDrop})),react.createElement("div",{style:{clear:"both"}}),react.createElement("div",null,react.createElement("label",{htmlFor:"should-copy",style:{fontSize:"0.8rem"}},"Enable node copy via ",react.createElement("b",null,"shouldCopyOnOutsideDrop"),":",react.createElement("input",{type:"checkbox",id:"should-copy",checked:shouldCopyOnOutsideDrop,onChange:event=>setShouldCopyOnOutsideDrop(event.target.checked)}))))};try{treetotree.displayName="treetotree",treetotree.__docgenInfo={description:"",displayName:"treetotree",props:{}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/stories/advanced/tree-to-tree.tsx#treetotree"]={docgenInfo:treetotree.__docgenInfo,name:"treetotree",path:"src/stories/advanced/tree-to-tree.tsx#treetotree"})}catch(__react_docgen_typescript_loader_error){}const advanced_stories={title:"Advanced",component:external_node},DragFromExternalSource={render:()=>react.createElement(external_node,null)},advanced_stories_TouchSupport={render:()=>react.createElement(touch_support,null)},TreeToTreeDragging={render:()=>react.createElement(tree_to_tree,null)},PlayingWithGenerateNodeProps={render:()=>react.createElement(generate_node_props,null)},advanced_stories_DragOutToRemove={render:()=>react.createElement(drag_out_to_remove,null)},advanced_stories_OnlyExpandSearchedNodes={render:()=>react.createElement(only_expand_searched_node,null)},PreventSomeNodesFromHavingChildren={render:()=>react.createElement(childless_nodes,null)},MinimalImplementationWithoutDndContext={render:()=>react.createElement(barebones_no_context,null)},__namedExportsOrder=["DragFromExternalSource","TouchSupport","TreeToTreeDragging","PlayingWithGenerateNodeProps","DragOutToRemove","OnlyExpandSearchedNodes","PreventSomeNodesFromHavingChildren","MinimalImplementationWithoutDndContext"];DragFromExternalSource.parameters={...DragFromExternalSource.parameters,docs:{...DragFromExternalSource.parameters?.docs,source:{originalSource:"{\n  render: () => <ExternalNodeExample />\n}",...DragFromExternalSource.parameters?.docs?.source}}},advanced_stories_TouchSupport.parameters={...advanced_stories_TouchSupport.parameters,docs:{...advanced_stories_TouchSupport.parameters?.docs,source:{originalSource:"{\n  render: () => <TouchSupportExample />\n}",...advanced_stories_TouchSupport.parameters?.docs?.source}}},TreeToTreeDragging.parameters={...TreeToTreeDragging.parameters,docs:{...TreeToTreeDragging.parameters?.docs,source:{originalSource:"{\n  render: () => <TreeToTreeExample />\n}",...TreeToTreeDragging.parameters?.docs?.source}}},PlayingWithGenerateNodeProps.parameters={...PlayingWithGenerateNodeProps.parameters,docs:{...PlayingWithGenerateNodeProps.parameters?.docs,source:{originalSource:"{\n  render: () => <GenerateNodePropsExample />\n}",...PlayingWithGenerateNodeProps.parameters?.docs?.source}}},advanced_stories_DragOutToRemove.parameters={...advanced_stories_DragOutToRemove.parameters,docs:{...advanced_stories_DragOutToRemove.parameters?.docs,source:{originalSource:"{\n  render: () => <DragOutToRemoveExample />\n}",...advanced_stories_DragOutToRemove.parameters?.docs?.source}}},advanced_stories_OnlyExpandSearchedNodes.parameters={...advanced_stories_OnlyExpandSearchedNodes.parameters,docs:{...advanced_stories_OnlyExpandSearchedNodes.parameters?.docs,source:{originalSource:"{\n  render: () => <OnlyExpandSearchedNodesExample />\n}",...advanced_stories_OnlyExpandSearchedNodes.parameters?.docs?.source}}},PreventSomeNodesFromHavingChildren.parameters={...PreventSomeNodesFromHavingChildren.parameters,docs:{...PreventSomeNodesFromHavingChildren.parameters?.docs,source:{originalSource:"{\n  render: () => <ChildlessNodes />\n}",...PreventSomeNodesFromHavingChildren.parameters?.docs?.source}}},MinimalImplementationWithoutDndContext.parameters={...MinimalImplementationWithoutDndContext.parameters,docs:{...MinimalImplementationWithoutDndContext.parameters?.docs,source:{originalSource:"{\n  render: () => <BarebonesExampleNoContext />\n}",...MinimalImplementationWithoutDndContext.parameters?.docs?.source}}}}}]);