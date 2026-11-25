import {useState} from 'react'
import {useQueries} from '@tanstack/react-query'
import {useWorkspace} from './context'
const tabs={Workflows:'actions/workflows',Files:'files',Branches:'branches',PRs:'pulls',Commits:'commits',Runs:'actions/runs'} as const
type Tab=keyof typeof tabs
type Item={id?:number;sha?:string;name?:string;path?:string;title?:string;html_url?:string;status?:string;conclusion?:string;type?:string;commit?:{message?:string}}
async function load(repo:string,tab:Tab,signal:AbortSignal){
 const items:Item[]=[]
 for(let page=1;page<=20;page++){
  const response=await fetch('/v1/github/'+repo+'/'+tabs[tab]+'?limit=100&page='+page,{signal,credentials:'same-origin',redirect:'error'})
  if(!response.ok)throw Error('HTTP '+response.status)
  const data=await response.json()
  const rows=Array.isArray(data.data)?data.data:data.data?.workflows??data.data?.workflow_runs
  if(!Array.isArray(rows))throw Error('Unexpected response')
  items.push(...rows)
  if(!data.hasNext||tab==='Files')return {items,truncated:false}
 }
 return {items,truncated:true}
}
export function WorkspaceExplorer(){
 const {repos,selection}=useWorkspace()
 const [tab,setTab]=useState<Tab>('Workflows')
 const [filter,setFilter]=useState('')
 const queries=useQueries({queries:repos.map(repo=>({queryKey:['workspace',repo,tab],queryFn:({signal}:{signal:AbortSignal})=>load(repo,tab,signal),staleTime:60000}))})
 return <section><p className="eyebrow">ORB / WORKSPACE</p><h1>Workspace Explorer</h1><p>{selection} · {repos.length} repositories</p><div className="lab-tabs">{(Object.keys(tabs) as Tab[]).map(t=><button key={t} aria-pressed={t===tab} onClick={()=>setTab(t)}>{t}</button>)}</div><input aria-label="Filter results" placeholder="Filter results" value={filter} onChange={e=>setFilter(e.target.value)} autoCapitalize="none"/><button onClick={()=>queries.forEach(q=>void q.refetch())}>Refresh</button>{repos.map((repo,i)=>{const q=queries[i];const items=q.data?.items??[];return <details key={repo} open><summary>{repo} · {q.isPending?'Loading…':items.length}</summary>{q.error&&<p role="alert">{q.error.message}</p>}{q.data?.truncated&&<p>Showing first 2,000 items.</p>}<div className="lab-ast-list">{items.filter(item=>JSON.stringify(item).toLowerCase().includes(filter.toLowerCase())).map((item,j)=><div key={item.id??item.sha??item.path??j}><strong>{item.name??item.title??item.commit?.message??item.path??item.sha??'Item'}</strong> <small>{item.status??item.type??''} {item.conclusion??''}</small>{item.html_url?.startsWith('https://github.com/')&&<> · <a href={item.html_url} target="_blank" rel="noreferrer">GitHub</a></>}</div>)}</div></details>})}</section>
}
