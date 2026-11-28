import Studio,{type StudioAdapter} from '@code/workflow-studio';
import {useEffect,useMemo,useState} from 'react';
import {useWorkspace} from '../workspace/context';
import {useRouteState,updateRoute} from '../workspace/state';
import type {OpenWorkflow} from '../workspace/explorer';
export function ApiWorkbench({file}:{file?:OpenWorkflow}={}) {
 const {repos}=useWorkspace();const route=useRouteState();const [controller,setController]=useState<AbortController|null>(null);
 useEffect(()=>{const next=new AbortController();setController(next);return()=>next.abort();},[]);
 const adapter=useMemo<StudioAdapter|null>(()=>controller?({
  namespace:'orb:'+repos.join(','),repositories:repos,route,navigate:updateRoute,signal:controller.signal,
  mode:location.pathname==='/api'?'api':'studio',canDispatch:location.origin==='https://orb.migos.club',
  draftsDatabase:'orb-workflow-drafts',sessionsDatabase:'orb-session',
  request:(path,init={})=>fetch(path,{...init,credentials:'same-origin',redirect:'error'}),
 }):null,[repos.join(','),route,controller]);
 return adapter?<div style={{height:'min(85dvh,1200px)',minHeight:400}}><Studio adapter={adapter} file={file}/></div>:null;
}
