import {parseDocument,isMap,isSeq,isScalar,isAlias} from 'yaml'
export {validateWorkflow} from './validate.ts'
export {inspectWorkflow} from './inspect.ts'
import {inspectWorkflow} from './inspect.ts'

export type SourceRange={from:number;to:number}
export type SyntaxNode={path:(string|number)[];kind:string;range:SourceRange|null}
export type SourcePatch={from:number;to:number;insert:string}
export function parseWorkflow(source:string){
 const doc=parseDocument(source,{version:'1.2',uniqueKeys:true,keepSourceTokens:true})
 const nodes:SyntaxNode[]=[]
 function walk(node:unknown,path:(string|number)[],depth:number){
  if(depth>100||nodes.length>=20000)return
  if(!isMap(node)&&!isSeq(node)&&!isScalar(node)&&!isAlias(node))return
  nodes.push({path,kind:isMap(node)?'map':isSeq(node)?'sequence':isAlias(node)?'alias':'scalar',range:node.range?{from:node.range[0],to:node.range[1]}:null})
  if(isMap(node))for(const pair of node.items){if(isScalar(pair.key)&&typeof pair.key.value==='string')walk(pair.value,[...path,pair.key.value],depth+1)}
  if(isSeq(node))node.items.forEach((child,i)=>walk(child,[...path,i],depth+1))
 }
 walk(doc.contents,[],0)
 return {...inspectWorkflow(source),nodes,offsetEncoding:'utf-16' as const,truncated:nodes.length>=20000}
}
export function applySourcePatches(source:string,patches:SourcePatch[]){
 const ordered=[...patches].sort((a,b)=>a.from-b.from||a.to-b.to)
 let cursor=0,result=''
 for(const p of ordered){
  if(!Number.isSafeInteger(p.from)||!Number.isSafeInteger(p.to)||p.from<cursor||p.to<p.from||p.to>source.length)throw Error('Invalid or overlapping source patch')
  result+=source.slice(cursor,p.from)+p.insert
  cursor=p.to
 }
 return result+source.slice(cursor)
}
export function replaceScalar(source:string,path:(string|number)[],value:string){
 const doc=parseDocument(source,{version:'1.2',uniqueKeys:true,keepSourceTokens:true})
 if(doc.errors.length)throw Error('Invalid source YAML')
 const node=doc.getIn(path,true)
 if(!isScalar(node)||!node.range||typeof node.value!=='string'||node.type==='BLOCK_LITERAL'||node.type==='BLOCK_FOLDED'||node.anchor||node.tag)throw Error('Only untagged inline string scalars are supported')
 const patch={from:node.range[0],to:node.range[1],insert:JSON.stringify(value)}
 const yaml=applySourcePatches(source,[patch])
 const result=parseWorkflow(yaml)
 return {yaml,patches:[patch],...result}
}

export * from './adapters.ts'

export function editJobNeeds(source:string,id:string,needs:string[]){
 const doc=parseDocument(source,{version:'1.2',uniqueKeys:true,keepSourceTokens:true})
 if(doc.errors.length)throw Error('Invalid source YAML')
 const job=doc.getIn(['jobs',id],true)
 if(!isMap(job)||job.flow||job.anchor||job.tag)throw Error('Only plain block jobs are supported')
 const existing=job.get('needs',true)
 const unique=[...new Set(needs)]
 if(unique.includes(id)||unique.some(n=>!isMap(doc.getIn(['jobs',n],true))))throw Error('Invalid dependency')
 const insert=JSON.stringify(unique)
 let patch:SourcePatch
 if(existing!==undefined){
  if((!isScalar(existing)&&!isSeq(existing))||!existing.range||existing.anchor||existing.tag||existing.comment||existing.commentBefore||isSeq(existing)&&(!existing.flow||existing.items.some(n=>!isScalar(n)||n.comment||n.commentBefore||n.anchor||n.tag)))throw Error('Complex needs syntax requires manual editing')
  patch={from:existing.range[0],to:existing.range[1],insert}
 }else{
  const first=job.items[0]?.key
  if(!isScalar(first)||!first.range)throw Error('Job has no insertion point')
  const from=first.range[0]
  const lineStart=source.lastIndexOf('\n',from-1)+1
  const indent=source.slice(lineStart,from)
  if(!/^ +$/.test(indent))throw Error('Unsupported indentation')
  patch={from,to:from,insert:'needs: '+insert+(source.includes('\r\n')?'\r\n':'\n')+indent}
 }
 const yaml=applySourcePatches(source,[patch])
 const result=parseWorkflow(yaml)
 if(!result.valid)throw Error('Dependency edit would produce invalid workflow')
 return {yaml,patches:[patch],...result}
}

export type BuilderEdit={kind:'add-job'|'duplicate-job'|'add-step';job:string;id?:string;name?:string;run?:string;uses?:string}
export function editWorkflow(source:string,edit:BuilderEdit){
 const doc=parseDocument(source,{version:'1.2',uniqueKeys:true,keepSourceTokens:true})
 if(doc.errors.length)throw Error('Invalid YAML')
 const jobs=doc.get('jobs',true)
 if(!isMap(jobs)||jobs.flow||jobs.anchor||jobs.tag)throw Error('Expected plain block jobs')
 const newline=source.includes('\r\n')?'\r\n':'\n'
 function insertion(node:unknown,lines:string[]):SourcePatch{
  if(!isMap(node)&&!isSeq(node))throw Error('Expected block collection')
  if(node.flow||node.anchor||node.tag||!node.range)throw Error('Unsupported collection')
  const end=node.range[1]
  const from=source.lastIndexOf('\n',Math.max(0,end-1))+1
  const at=end===from?end:source.indexOf('\n',end)
  const pos=at<0?source.length:at===end&&end===from?end:at+1
  return {from:pos,to:pos,insert:(pos>0&&source[pos-1]!=='\n'?newline:'')+lines.join(newline)+newline}
 }
 function indentAt(offset:number){const start=source.lastIndexOf('\n',offset-1)+1;const prefix=source.slice(start,offset);if(!/^ *$/.test(prefix))throw Error('Unsupported indentation');return prefix}
 const first=jobs.items[0]?.key
 if(!isScalar(first)||!first.range)throw Error('Missing job insertion point')
 const indent=indentAt(first.range[0])
 const job=jobs.get(edit.job,true)
 let patch:SourcePatch
 if(edit.kind==='add-job'||edit.kind==='duplicate-job'){
  const id=edit.id??''
  if(!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)||jobs.has(id))throw Error('Invalid or duplicate job ID')
  if(edit.kind==='add-job')patch=insertion(jobs,[indent+id+':',indent+'  runs-on: ubuntu-latest',indent+'  steps:',indent+'    - run: "echo Ready"'])
  else{
   if(!isMap(job)||job.flow||job.anchor||job.tag||!job.range)throw Error('Unsupported job')
   const raw=source.slice(job.range[0],job.range[1])
   if(/[&*][A-Za-z0-9_-]+/.test(raw))throw Error('Anchors or aliases require manual duplication')
   patch=insertion(jobs,[indent+id+':',indent+'  '+raw.trimEnd()])
  }
 }else{
  if(!isMap(job)||job.flow||job.has('uses'))throw Error('Expected executable job')
  const steps=job.get('steps',true)
  if(!isSeq(steps)||steps.flow||!steps.items.length)throw Error('Expected existing block steps')
  const firstStep=steps.items[0]
  if(!isMap(firstStep)||!firstStep.range)throw Error('Unsupported step')
  const start=source.lastIndexOf('\n',firstStep.range[0]-1)+1
  const prefix=source.slice(start,firstStep.range[0]).match(/^( *)- +$/)
  if(!prefix)throw Error('Unsupported step indentation')
  if(Boolean(edit.run)===Boolean(edit.uses))throw Error('Choose run or uses')
  const line=edit.run?'run: '+JSON.stringify(edit.run):'uses: '+JSON.stringify(edit.uses)
  patch=insertion(steps,[prefix[1]+'- '+(edit.name?'name: '+JSON.stringify(edit.name):line),...(edit.name?[prefix[1]+'  '+line]:[])])
 }
 const yaml=applySourcePatches(source,[patch])
 const result=parseWorkflow(yaml)
 if(!result.valid)throw Error('Edit would produce invalid workflow')
 return {yaml,patches:[patch],...result}
}
