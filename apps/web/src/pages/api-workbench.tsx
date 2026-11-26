import {useRef,useState,useEffect} from 'react'
import {Send,Copy,Square,FolderGit2} from 'lucide-react'
import {useWorkspace} from '../workspace/context'
import {SourceEditor,type SourceEditorHandle} from './source-editor'
import {AstExplorer} from './ast-explorer'
const operations=['health','github/repositories','branches','pulls','commits','actions/workflows','actions/runs','workflow-source','parse','validate','inspect','transform'] as const
type Operation=typeof operations[number]
type Result={status:number;ms:number;bytes:number;body:string;headers:string}
const parserOps=['parse','validate','inspect','transform']
export function ApiWorkbench(){const {repos}=useWorkspace();return <Lab key={repos.join(',')} repos={repos}/>}
function Lab({repos}:{repos:string[]}){
 const [operation,setOperation]=useState<Operation>('workflow-source')
 const [repo,setRepo]=useState(()=>{const r=new URLSearchParams(location.search).get('repo');return r&&repos.includes(r)?r:repos[0]??''})
 const [ref,setRef]=useState(()=>new URLSearchParams(location.search).get('ref')??'main')
 const [path,setPath]=useState(()=>new URLSearchParams(location.search).get('path')??'.github/workflows/api-verify.yml')
 const [yaml,setYaml]=useState('')
 const [nodePath,setNodePath]=useState('["name"]')
 const [value,setValue]=useState('Orb verification')
 const [result,setResult]=useState<Result|null>(null)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [tab,setTab]=useState<'body'|'headers'|'ast'>('body')
 const editor=useRef<SourceEditorHandle>(null)
 const [parsedSource,setParsedSource]=useState('')
 const active=useRef<AbortController|null>(null)
 const [transformed,setTransformed]=useState<string|null>(null)
 const autoLoaded=useRef(false)
 const post=parserOps.includes(operation)
 const encodedRepo=repo.split('/').map(encodeURIComponent).join('/')
 const endpoint=post?'/v1/workflows/'+operation:operation==='health'||operation==='github/repositories'?'/v1/'+operation:'/v1/github/'+encodedRepo+'/'+operation+(operation==='workflow-source'?'?'+new URLSearchParams({path,ref}):'')
 async function send(){
  if(active.current)return
  const controller=new AbortController();active.current=controller;setBusy(true);setError('');setResult(null);setTransformed(null)
  const start=performance.now()
  try{
   if(!post&&!['health','github/repositories'].includes(operation)&&!/^[-\w.]+\/[-\w.]+$/.test(repo))throw Error('Use owner/repository')
   const body=post?JSON.stringify(operation==='transform'?{yaml,path:JSON.parse(nodePath),value}:{yaml}):undefined
   const response=await fetch(endpoint,{method:post?'POST':'GET',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:post?{'Content-Type':'application/json'}:undefined,body})
   const raw=await response.text();let formatted=raw
   try{const data=JSON.parse(raw);formatted=JSON.stringify(data,null,2);if(response.ok&&operation==='workflow-source'&&typeof data.yaml==='string')setYaml(data.yaml);if(response.ok&&operation==='transform'&&typeof data.yaml==='string')setTransformed(data.yaml)}catch{}
   const headers:string[]=[];response.headers.forEach((v,k)=>headers.push(k+': '+v))
   setParsedSource(yaml)
   setResult({status:response.status,ms:Math.round(performance.now()-start),bytes:new TextEncoder().encode(raw).length,body:formatted,headers:headers.join('\n')})
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{active.current=null;setBusy(false)}
 }
 useEffect(()=>{if(!autoLoaded.current&&new URLSearchParams(location.search).has('path')){autoLoaded.current=true;void send()}},[])
 return <section className="lab"><div className="heading"><div><p className="eyebrow">ORB / DEVELOPER TOOLS</p><h1>API Lab</h1><p>Real requests. Real repositories. No mock responses.</p></div></div>
 <div className="lab-layout"><aside className="lab-collection"><h3><FolderGit2 size={15}/> Operations</h3>{operations.map(op=><button key={op} disabled={busy} className={op===operation?'lab-selected':''} onClick={()=>setOperation(op)}><small>{parserOps.includes(op)?'POST':'GET'}</small>{op}</button>)}</aside>
 <div className="lab-workspace"><div className="lab-address"><code>{post?'POST':'GET'}</code><code>{endpoint}</code><button disabled={busy} onClick={send}><Send size={14}/> Send</button>{busy&&<button onClick={()=>active.current?.abort()} aria-label="Cancel"><Square size={14}/></button>}</div>
 <div className="lab-columns"><section className="lab-panel"><h3>Request</h3><label>Repository<select value={repo} onChange={e=>setRepo(e.target.value)}>{repos.map(r=><option key={r}>{r}</option>)}</select></label><label>Ref<input value={ref} onChange={e=>setRef(e.target.value)} autoCapitalize="none"/></label><label>Workflow path<input value={path} onChange={e=>setPath(e.target.value)} autoCapitalize="none"/></label><label>YAML source<SourceEditor ref={editor} value={yaml} onChange={setYaml}/></label>{operation==='transform'&&<><label>AST path (JSON)<input value={nodePath} onChange={e=>setNodePath(e.target.value)}/></label><label>Replacement<input value={value} onChange={e=>setValue(e.target.value)}/></label></>}</section>
 <section className="lab-panel"><h3>Response {result&&<small>{result.status} · {result.ms} ms · {result.bytes} B</small>}</h3><div className="lab-tabs"><button onClick={()=>setTab('body')}>Body</button><button onClick={()=>setTab('headers')}>Headers</button><button onClick={()=>setTab('ast')}>AST</button><button disabled={!result||tab==='ast'} onClick={()=>{if(result&&tab!=='ast')void navigator.clipboard.writeText(result[tab]).catch(()=>setError('Clipboard unavailable'))}}><Copy size={13}/></button></div>{transformed!==null&&transformed!==yaml&&<button onClick={()=>setYaml(transformed)}>Apply transformed YAML</button>}{error&&<p className="error" role="alert">{error}</p>}{tab==='ast'?<AstExplorer body={result?.body??''} stale={yaml!==(transformed??parsedSource)} onSelect={(path,from,to)=>{setNodePath(JSON.stringify(path));editor.current?.select(from,to)}}/>:<pre>{busy?'Waiting for server…':result?.[tab]??'Send a request to inspect the real response.'}</pre>}</section></div></div></div></section>
}
