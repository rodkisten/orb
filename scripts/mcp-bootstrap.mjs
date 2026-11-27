import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const dir = join(homedir(), ".config", "orb");
const file = join(dir, "credentials.env");
const endpoint = "https://api.orb.migos.club/mcp";
const mode = process.argv[2];
process.umask(0o077);
async function main() {
  if (!["provision", "apply", "test"].includes(mode)) throw Error("Use provision, apply or test");
  if (mode !== "test" && (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN)) throw Error("Cloudflare account ID and API token required");
  const base = "https://api.cloudflare.com/client/v4/accounts/" + process.env.CLOUDFLARE_ACCOUNT_ID;
  async function cf(path, method="GET", body) {
    const res = await fetch(base+path,{method,headers:{Authorization:"Bearer "+process.env.CLOUDFLARE_API_TOKEN,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,redirect:"error",signal:AbortSignal.timeout(20000)});
    const data=await res.json();
    if(!res.ok || !data.success) throw Error("Cloudflare "+method+" failed: HTTP "+res.status);
    return data.result;
  }
  if(mode==="provision") {
    mkdirSync(dir,{recursive:true,mode:0o700});
    chmodSync(dir,0o700);
    if(existsSync(file)) throw Error("Credentials already exist; use apply or test");
    const apps=await cf("/access/apps?exact=true&domain=api.orb.migos.club");
    const matches=apps.filter(a=>a.domain==="api.orb.migos.club"&&a.type==="self_hosted");
    if(matches.length!==1) throw Error("Expected exactly one Orb Access application");
    const token=await cf("/access/service_tokens","POST",{name:"orb-mcp-local-"+randomBytes(6).toString("hex"),duration:"8760h"});
    const values={CF_ACCESS_CLIENT_ID:token.client_id,CF_ACCESS_CLIENT_SECRET:token.client_secret,ORB_DISPATCH_TOKEN:randomBytes(32).toString("hex"),ORB_ACCESS_TOKEN_ID:token.id,ORB_ACCESS_APP_ID:matches[0].id};
    for(const value of Object.values(values)) if(typeof value!=="string"||!/^[a-zA-Z0-9_.-]+$/.test(value)) throw Error("Unexpected credential format");
    writeFileSync(file,Object.entries(values).map(([k,v])=>"export "+k+"="+v).join("\n")+"\n",{mode:0o600,flag:"wx"});
    console.log("Credentials saved locally. Run apply --rotate-dispatch to activate.");
    return;
  }
  const values=Object.fromEntries(readFileSync(file,"utf8").trim().split("\n").map(line=>{const m=/^export ([A-Z_]+)=([a-zA-Z0-9_.-]+)$/.exec(line);if(!m)throw Error("Invalid credentials file");return [m[1],m[2]];}));
  for(const key of ["CF_ACCESS_CLIENT_ID","CF_ACCESS_CLIENT_SECRET","ORB_DISPATCH_TOKEN","ORB_ACCESS_TOKEN_ID","ORB_ACCESS_APP_ID"]) if(!values[key])throw Error("Missing "+key);
  if(mode==="apply") {
    if(!process.argv.includes("--rotate-dispatch"))throw Error("Explicit --rotate-dispatch required");
    const appPath="/access/apps/"+values.ORB_ACCESS_APP_ID;
    const app=await cf(appPath);
    if(app.domain!=="api.orb.migos.club"||app.type!=="self_hosted")throw Error("Unexpected Access application");
    const policies=await cf(appPath+"/policies");
    if(!policies.some(p=>p.decision==="non_identity"&&p.include?.some(r=>r.service_token?.token_id===values.ORB_ACCESS_TOKEN_ID))) await cf(appPath+"/policies","POST",{name:"Orb MCP local service",decision:"non_identity",include:[{service_token:{token_id:values.ORB_ACCESS_TOKEN_ID}}]});
    await cf("/workers/scripts/orb-api/secrets","PUT",{name:"ORB_DISPATCH_TOKEN",text:values.ORB_DISPATCH_TOKEN,type:"secret_text"});
    console.log("Access policy and Worker secret applied.");
  }
  async function rpc(method,params,id) {
    const response=await fetch(endpoint,{method:"POST",headers:{"CF-Access-Client-Id":values.CF_ACCESS_CLIENT_ID,"CF-Access-Client-Secret":values.CF_ACCESS_CLIENT_SECRET,Authorization:"Bearer "+values.ORB_DISPATCH_TOKEN,"Content-Type":"application/json",Accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id,method,params}),redirect:"manual",signal:AbortSignal.timeout(30000)});
    console.log(method+": HTTP "+response.status);
    if(!response.ok)throw Error("MCP request failed");
    const data=await response.json();
    if(data.error||!data.result)throw Error("MCP protocol error");
    return data.result;
  }
  await rpc("initialize",{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"orb-local-smoke",version:"1.0.0"}},1);
  const result=await rpc("tools/list",{},2);
  const names=result.tools.map(t=>t.name);
  for(const name of ["github_pr_logs","github_repository_ci","github_workflow_diagnose","github_pr_overview"])if(!names.includes(name))throw Error("Missing tool: "+name);
  console.log("MCP smoke passed; "+names.length+" tools discovered.");
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Bootstrap failed");process.exitCode=1;});
