import {ActionInspector} from './action-inspector'
import {useState} from 'react'
export type BuilderEdit={kind:'add-job'|'duplicate-job'|'add-step';job:string;id?:string;name?:string;run?:string;uses?:string;inputs?:Record<string,string>}
export function BuilderForm({body,disabled,onEdit}:{body:string;disabled:boolean;onEdit:(edit:BuilderEdit)=>void}){
 const [kind,setKind]=useState<BuilderEdit['kind']>('add-job')
 const [job,setJob]=useState('')
 const [id,setId]=useState('')
 const [name,setName]=useState('')
 const [mode,setMode]=useState<'run'|'uses'>('run')
 const [value,setValue]=useState('')
 const [inputs,setInputs]=useState<Record<string,string>>({})
 let jobs:string[]=[]
 try{const data=JSON.parse(body);if(Array.isArray(data.jobs))jobs=data.jobs.map((j:{id:string})=>j.id)}catch{}
 const selected=jobs.includes(job)?job:jobs[0]??''
 return <details><summary>Job & Step Editor</summary><form onSubmit={e=>{e.preventDefault();onEdit({kind,job:selected,...(kind==='add-step'?{name,[mode]:value,...(mode==='uses'?{inputs}:{})}:{id})})}}><fieldset disabled={disabled||!jobs.length}><label>Operation<select value={kind} onChange={e=>setKind(e.target.value as BuilderEdit['kind'])}><option value="add-job">Add job</option><option value="duplicate-job">Duplicate job</option><option value="add-step">Add step</option></select></label>{kind!=='add-job'&&<label>Job<select value={selected} onChange={e=>setJob(e.target.value)}>{jobs.map(j=><option key={j}>{j}</option>)}</select></label>}{kind==='add-step'?<><label>Name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Type<select value={mode} onChange={e=>setMode(e.target.value as 'run'|'uses')}><option>run</option><option>uses</option></select></label><label>{mode}<textarea required value={value} onChange={e=>{setValue(e.target.value);setInputs({})}} autoCapitalize="none"/></label>{mode==='uses'&&<ActionInspector uses={value} onUses={v=>{setValue(v);setInputs({})}} inputs={inputs} onInputs={setInputs}/>}</>:<label>New job ID<input required pattern="[A-Za-z_][A-Za-z0-9_-]*" value={id} onChange={e=>setId(e.target.value)} autoCapitalize="none"/></label>}<button type="submit">Review patch</button></fieldset></form></details>
}
