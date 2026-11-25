import {useState} from 'react'
import {useQuery} from '@tanstack/react-query'
type Entry={name:string;path:string;type:string;size?:number;html_url?:string}
async function request(repo:string,resource:string,params:URLSearchParams,signal:AbortSignal){
 const res=await fetch('/v1/github/'+repo+'/'+resource+'?'+params,{signal,redirect:'error',credentials:'same-origin'})
 if(!res.ok)throw Error('HTTP '+res.status)
 return res.json()
}
function RepositoryFiles({repo}:{repo:string}){
 const [ref,setRef]=useState('')
 const [path,setPath]=useState('')
 const branches=useQuery({queryKey:['file-branches',repo],queryFn:({signal})=>request(repo,'branches',new URLSearchParams({limit:'100'}),signal),staleTime:60000})
 const files=useQuery({queryKey:['files',repo,ref,path],queryFn:({signal})=>request(repo,'files',new URLSearchParams({path,...(ref?{ref}:{})}),signal),staleTime:30000})
 const rows:Entry[]=Array.isArray(files.data?.data)?files.data.data:[]
 return <details open><summary>{repo}</summary><label>Branch <select value={ref} onChange={e=>{setRef(e.target.value);setPath('')}}><option value="">Default branch</option>{(branches.data?.data??[]).map((b:{name:string})=><option key={b.name}>{b.name}</option>)}</select></label>{branches.error&&<p>{branches.error.message}</p>}<div className="lab-tabs"><button onClick={()=>setPath('')}>Root</button>{path.split('/').filter(Boolean).map((part,i)=><button key={i} onClick={()=>setPath(path.split('/').slice(0,i+1).join('/'))}>{part}</button>)}</div>{files.isPending&&<p>Loading files…</p>}{files.error&&<p role="alert">{files.error.message}</p>}<div className="lab-ast-list">{[...rows].sort((a,b)=>Number(b.type==='dir')-Number(a.type==='dir')||a.name.localeCompare(b.name)).map(f=><div key={f.path}>{f.type==='dir'?<button onClick={()=>setPath(f.path)}>📁 {f.name}</button>:<><span>📄 {f.name}</span> {f.path.startsWith('.github/workflows/')&&/\.ya?ml$/.test(f.path)&&<a href={'/api?'+new URLSearchParams({repo,path:f.path,...(ref?{ref}:{})})}>Open workflow</a>} {f.html_url?.startsWith('https://github.com/')&&<a href={f.html_url} target="_blank" rel="noreferrer">GitHub</a>}</>}</div>)}</div></details>
}
export function FileExplorer({repos}:{repos:string[]}){return <>{repos.map(repo=><RepositoryFiles key={repo} repo={repo}/>)}</>}
