import {useQuery} from "@tanstack/react-query";
import {Activity} from "lucide-react";
type Run={status:string;conclusion:string|null;name:string;run_started_at:string;updated_at:string};
type Job={id:number;name:string;status:string;conclusion:string|null;steps?:{number:number;name:string;status:string;conclusion:string|null}[]};
async function read<T>(url:string,signal:AbortSignal){const r=await fetch(url,{signal,credentials:"same-origin",redirect:"error",cache:"no-store"});if(!r.ok)throw Error("Run lookup failed ("+r.status+")");return r.json() as Promise<{data:T;hasNext:boolean}>}
export function RunTracker({repo,id}:{repo:string;id:number}){
 const base="/v1/github/"+repo.split("/").map(encodeURIComponent).join("/")+"/actions/runs/"+id;
 const run=useQuery({queryKey:["run",repo,id],queryFn:({signal})=>read<Run>(base,signal),refetchInterval:q=>q.state.data?.data.status==="completed"?false:10000,retry:false});
 const jobs=useQuery({queryKey:["run-jobs",repo,id],queryFn:({signal})=>read<{jobs:Job[]}>(base+"/jobs?limit=100",signal),refetchInterval:q=>run.data?.data.status==="completed"&&q.state.data?.data.jobs.every(j=>j.status==="completed")?false:10000,retry:false});
 const data=run.data?.data;
 return <section className="orb-expression rounded-xl border border-border p-3"><h3><Activity size={16}/> Run #{id}</h3><strong>{data?.name??"Waiting for GitHub"}</strong><p>{data?.conclusion??data?.status??"Loading…"}</p>{run.error&&<p role="alert">{String(run.error)}</p>}<a href={"https://github.com/"+repo+"/actions/runs/"+id} target="_blank" rel="noreferrer">Open exact run logs</a>{jobs.error&&<p role="alert">{String(jobs.error)}</p>}{jobs.data?.data.jobs.map(j=><details key={j.id} className="rounded border border-border p-2"><summary>{j.name} · {j.conclusion??j.status}</summary>{j.steps?.map(s=><p key={s.number}>{s.number}. {s.name} · {s.conclusion??s.status}</p>)}<a href={"https://github.com/"+repo+"/actions/runs/"+id+"/job/"+j.id} target="_blank" rel="noreferrer">Job logs</a></details>)}{jobs.data?.hasNext&&<small>First 100 jobs shown.</small>}<small>Refreshes every 10 seconds while active.</small></section>
}
