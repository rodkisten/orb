import {createContext,useContext,useState,type ReactNode} from 'react'
const apps=['rodverse/rodverse','rodkisten/orb','rodkisten/photointel','rodkisten/userscripts-cf','rodkisten/shell','rodkisten/jardim','rodkisten/ast-explorer','rodkisten/ejc','rodkisten/github']
const groups:Record<string,string[]>={all:apps,platform:apps.filter(r=>/rodverse|orb|github/.test(r)),tools:apps.filter(r=>/shell|userscripts|ast-explorer/.test(r)),personal:apps.filter(r=>/jardim|photointel|ejc/.test(r))}
type State={selection:string;repos:string[];choose:(v:string)=>void}
const Context=createContext<State>({selection:'all',repos:apps,choose:()=>{}})
export function WorkspaceProvider({children}:{children:ReactNode}){
 const [selection,setSelection]=useState(()=>{const q=new URLSearchParams(location.search).get('context');return q&& (groups[q]||apps.includes(q))?q:'all'})
 function choose(v:string){setSelection(v);const u=new URL(location.href);u.searchParams.set('context',v);history.replaceState(history.state,'',u)}
 return <Context.Provider value={{selection,repos:groups[selection]??[selection],choose}}>{children}</Context.Provider>
}
export const useWorkspace=()=>useContext(Context)
export function ContextSelector(){const {selection,choose}=useWorkspace();return <select aria-label="Workspace context" value={selection} onChange={e=>choose(e.target.value)}><optgroup label="Groups">{Object.keys(groups).map(g=><option key={g} value={g}>{g}</option>)}</optgroup><optgroup label="Apps">{apps.map(a=><option key={a}>{a}</option>)}</optgroup></select>}
