import {githubToken,type GitHubCredentials} from './github-auth'
import {GatewayError} from './repository-read'

type Env=GitHubCredentials & {ORB_CI_REPOSITORIES?:string}
export {validateWorkflow} from '@orb/workflow-core'
import {validateWorkflow} from '@orb/workflow-core'

export async function workflowSource(env:Env,owner:string,repo:string,path:string,ref?:string){
  if(!(env.ORB_CI_REPOSITORIES??'').split(',').some(v=>v.trim().toLowerCase()===(owner+'/'+repo).toLowerCase()))throw new GatewayError(404,'Repository unavailable')
  if(!/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(path))throw new GatewayError(404,'Workflow unavailable')
  const token=await githubToken(env).catch(()=>null)
  if(!token)throw new GatewayError(503,'GitHub credentials unavailable')
  const url=new URL('https://api.github.com/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/'))
  if(ref)url.searchParams.set('ref',ref)
  const response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'orb-api','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(15000)})
  if(response.status===404)throw new GatewayError(404,'Workflow unavailable')
  if(response.status===429||(!response.ok&&response.headers.get('x-ratelimit-remaining')==='0'))throw new GatewayError(429,'GitHub rate limit exceeded')
  if(!response.ok)throw new GatewayError(502,'GitHub request failed')
  const data=await response.json<{type:string;sha:string;size:number;encoding:string;content:string}>()
  if(data.type!=='file'||data.encoding!=='base64'||data.size>262144||typeof data.content!=='string')throw new GatewayError(502,'Unsupported workflow content')
  const yaml=new TextDecoder('utf-8').decode(Uint8Array.from(atob(data.content.replace(/\s/g,'')),c=>c.charCodeAt(0)))
  return {repository:owner+'/'+repo,path,ref:ref??null,sha:data.sha,yaml,...validateWorkflow(yaml)}
}
