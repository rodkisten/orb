import {forwardRef,useEffect,useImperativeHandle,useRef} from 'react'
import {EditorState} from '@codemirror/state'
import {EditorView} from '@codemirror/view'
import {basicSetup} from 'codemirror'
import {yaml} from '@codemirror/lang-yaml'
import {oneDark} from '@codemirror/theme-one-dark'
export type SourceEditorHandle={select:(from:number,to:number)=>void}
export const SourceEditor=forwardRef<SourceEditorHandle,{value:string;onChange:(value:string)=>void;onCursor?:(offset:number)=>void}>(function SourceEditor({value,onChange,onCursor},ref){
 const host=useRef<HTMLDivElement>(null)
 const view=useRef<EditorView|null>(null)
 const change=useRef(onChange)
 change.current=onChange
 const cursor=useRef(onCursor)
 cursor.current=onCursor
 useEffect(()=>{
  if(!host.current)return
  const editor=new EditorView({parent:host.current,state:EditorState.create({doc:value,extensions:[basicSetup,yaml(),oneDark,EditorView.lineWrapping,EditorView.contentAttributes.of({'aria-label':'YAML source',autocapitalize:'off',spellcheck:'false'}),EditorView.theme({'&':{minHeight:'300px'},'.cm-scroller':{maxHeight:'65vh',overflow:'auto'}}),EditorView.updateListener.of(u=>{if(u.docChanged)change.current(u.state.doc.toString());if(u.selectionSet||u.docChanged)cursor.current?.(u.state.selection.main.from)})]})})
  view.current=editor
  return ()=>{view.current=null;editor.destroy()}
 },[])
 useEffect(()=>{const e=view.current;if(e&&e.state.doc.toString()!==value)e.dispatch({changes:{from:0,to:e.state.doc.length,insert:value}})},[value])
 useImperativeHandle(ref,()=>({select(from,to){const e=view.current;if(!e||from<0||to<from||to>e.state.doc.length)return;e.dispatch({selection:{anchor:from,head:to},effects:EditorView.scrollIntoView(from,{y:'center'})});e.focus()}}),[])
 return <div ref={host}/>
})
