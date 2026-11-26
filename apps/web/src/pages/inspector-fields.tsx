import {useState,type ReactNode} from "react";
import {Button} from "../components/ui/button";
import {ChevronDown} from "lucide-react";
export function InspectorFields({groups,values,render}:{groups:{title:string;keys:string[]}[];values:Record<string,string>;render:(key:string)=>ReactNode}){
 const [open,setOpen]=useState<string[]>([groups[0]?.title??""]);
 return <div className="orb-field-groups">{groups.map(group=><section key={group.title} className="orb-field-group"><Button type="button" variant="ghost" aria-expanded={open.includes(group.title)} onClick={()=>setOpen(old=>old.includes(group.title)?old.filter(x=>x!==group.title):[...old,group.title])}><span>{group.title}</span><small>{group.keys.filter(k=>values[k]?.trim()).length||""}</small><ChevronDown size={14}/></Button>{open.includes(group.title)&&<div className="orb-field-content">{group.keys.map(render)}</div>}</section>)}</div>
}
