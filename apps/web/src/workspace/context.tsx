import {sessionDB,useRouteState,updateRoute} from './state'
import {createContext,useContext,useState,useEffect,type ReactNode} from 'react'
const apps=['rodverse/rodverse','rodkisten/orb','rodkisten/photointel','rodkisten/userscripts-cf','rodkisten/shell','rodkisten/jardim','rodkisten/ast-explorer','rodkisten/ejc','rodkisten/github','rodkisten/rodtui','rodkisten/rodlog','rodkisten/zsh']
const groups:Record<string,string[]>={all:apps,platform:apps.filter(r=>/rodverse|orb|github/.test(r)),tools:apps.filter(r=>/shell|userscripts|ast-explorer|rodtui|rodlog|zsh/.test(r)),personal:apps.filter(r=>/jardim|photointel|ejc/.test(r))}
type Group={id:string;name:string;repos:string[]}
type Stored={selection:string;custom:Group[]}
const storageKey='orb.workspace.v1'
function restore():Stored{
 try{
 const raw=JSON.parse(localStorage.getItem(storageKey)??'{}')
 const custom:Group[]=Array.isArray(raw.custom)?raw.custom.filter((g:Group)=>typeof g.id==='string'&&g.id.startsWith('custom:')&&typeof g.name==='string'&&Array.isArray(g.repos)).map((g:Group)=>({...g,repos:[...new Set(g.repos.filter(r=>apps.includes(r)))]})).filter((g:Group)=>g.repos.length):[]
 const selection=new URLSearchParams(location.search).get('context')??raw.selection??'all'
 return {custom,selection:groups[selection]||apps.includes(selection)||custom.some(g=>g.id===selection)?selection:'all'}
 }catch{return {selection:'all',custom:[]}}
}
type State={selection:string;repos:string[];custom:Group[];choose:(v:string)=>void;save:(name:string,repos:string[],id?:string)=>void;remove:(id:string)=>void}
const Context=createContext<State|null>(null)
export function WorkspaceProvider({children}:{children:ReactNode}){
 const [state,setState]=useState(restore)
 const route=useRouteState()
 useEffect(()=>{let alive=true;void sessionDB.sessions.get('workspace').then(row=>{if(alive&&row){const saved=row.value as Stored;setState(old=>({...old,...saved,selection:route.context??saved.selection}))}}).catch(()=>{});return()=>{alive=false}},[])
 useEffect(()=>{if(route.context&& (groups[route.context]||apps.includes(route.context)||state.custom.some(g=>g.id===route.context)))setState(old=>old.selection===route.context?old:{...old,selection:route.context})},[route.context,state.custom])
 function update(next:Stored){setState(next);updateRoute({context:next.selection,repo:null,path:null,ref:null});void sessionDB.sessions.put({id:'workspace',value:next}).catch(console.error)}
 function choose(v:string){update({...state,selection:v})}
 function save(name:string,repos:string[],id?:string){
  const valid=[...new Set(repos.filter(r=>apps.includes(r)))]
  if(!name.trim()||!valid.length)return
  const key=id??'custom:'+crypto.randomUUID()
  update({selection:key,custom:[...state.custom.filter(g=>g.id!==key),{id:key,name:name.trim().slice(0,80),repos:valid}]})
 }
 function remove(id:string){update({selection:state.selection===id?'all':state.selection,custom:state.custom.filter(g=>g.id!==id)})}
 return <Context.Provider value={{...state,repos:groups[state.selection]??state.custom.find(g=>g.id===state.selection)?.repos??[state.selection],choose,save,remove}}>{children}</Context.Provider>
}
export function useWorkspace(){const value=useContext(Context);if(!value)throw Error('WorkspaceProvider required');return value}
export function ContextSelector(){
 const {selection,choose,custom,save,remove}=useWorkspace()
 const [open,setOpen]=useState(false)
 const [name,setName]=useState('')
 const [selected,setSelected]=useState<string[]>([])
 const [editing,setEditing]=useState<string|undefined>()
 function edit(){const g=custom.find(g=>g.id===selection);setEditing(g?.id);setName(g?.name??'');setSelected(g?.repos??[]);setOpen(true)}
 return <div className="workspace-context"><select aria-label="Workspace context" value={selection} onChange={e=>choose(e.target.value)}><optgroup label="Groups">{Object.keys(groups).map(g=><option key={g} value={g}>{g}</option>)}</optgroup><optgroup label="My workspaces">{custom.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</optgroup><optgroup label="Apps">{apps.map(a=><option key={a}>{a}</option>)}</optgroup></select><button onClick={edit} aria-label="Manage workspaces">Edit groups</button>{open&&<div className="workspace-dialog" role="dialog" aria-label="Manage workspace"><form onSubmit={e=>{e.preventDefault();save(name,selected,editing);setOpen(false)}}><h3>{editing?'Edit workspace':'New workspace'}</h3><input aria-label="Workspace name" value={name} maxLength={80} onChange={e=>setName(e.target.value)} placeholder="Workspace name" required/><div className="workspace-apps">{apps.map(a=><label key={a}><input type="checkbox" checked={selected.includes(a)} onChange={e=>setSelected(v=>e.target.checked?[...v,a]:v.filter(x=>x!==a))}/>{a}</label>)}</div><div className="lab-tabs"><button type="submit" disabled={!name.trim()||!selected.length}>Save workspace</button><button type="button" onClick={()=>setOpen(false)}>Cancel</button>{editing&&<button type="button" onClick={()=>{remove(editing);setOpen(false)}}>Delete group</button>}</div></form></div>}</div>
}
