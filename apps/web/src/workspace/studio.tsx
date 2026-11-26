import {useState} from 'react'
import {WorkspaceExplorer,type OpenWorkflow} from './explorer'
import {ApiWorkbench} from '../pages/api-workbench'
export function WorkspaceStudio(){
 const [file,setFile]=useState<OpenWorkflow>()
 const [panel,setPanel]=useState<'explorer'|'studio'>(location.pathname==='/api'||new URLSearchParams(location.search).has('path')?'studio':'explorer')
 return <section><div className="lab-tabs"><button aria-pressed={panel==='explorer'} onClick={()=>setPanel('explorer')}>Explorer</button><button aria-pressed={panel==='studio'} onClick={()=>setPanel('studio')}>Workflow Studio</button></div><div className="workspace-unified"><div className={panel==='explorer'?'workspace-visible':'workspace-secondary'}><WorkspaceExplorer onOpen={next=>{setFile(next);setPanel('studio')}}/></div><div className={panel==='studio'?'workspace-visible':'workspace-secondary'}><ApiWorkbench file={file}/></div></div></section>
}
