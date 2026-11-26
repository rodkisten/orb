import {useMemo} from 'react'
export function PatchReview({before,after}:{before:string;after:string}){
 const diff=useMemo(()=>{
  const a=before.split('\n'),b=after.split('\n')
  let start=0,end=0
  while(start<Math.min(a.length,b.length)&&a[start]===b[start])start++
  while(end<Math.min(a.length,b.length)-start&&a[a.length-1-end]===b[b.length-1-end])end++
  return {start,removed:a.slice(start,a.length-end),added:b.slice(start,b.length-end),context:a.slice(Math.max(0,start-3),start),tail:a.slice(a.length-end,a.length-end+3)}
 },[before,after])
 return <section aria-label="Proposed YAML diff"><h3>Review YAML patch</h3><small>{diff.removed.length} removed · {diff.added.length} added · line {diff.start+1}</small><pre className="orb-patch-review">{diff.context.map((line,i)=><div key={'c'+i}>  {line}</div>)}{diff.removed.map((line,i)=><div className="orb-patch-removed" key={'r'+i}>- {line}</div>)}{diff.added.map((line,i)=><div className="orb-patch-added" key={'a'+i}>+ {line}</div>)}{diff.tail.map((line,i)=><div key={'t'+i}>  {line}</div>)}</pre></section>
}
