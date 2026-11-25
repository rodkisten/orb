import {readFileSync,writeFileSync} from 'node:fs'
const pr=process.argv[2]
if(!/^[1-9][0-9]*$/.test(pr??''))throw Error('Invalid PR number')
for(const app of ['api','web']){
 const file=new URL('../apps/'+app+'/wrangler.jsonc',import.meta.url)
 const config=JSON.parse(readFileSync(file,'utf8'))
 config.name='orb-'+app+'-pr-'+pr
 config.routes=[{pattern:'pr'+pr+(app==='api'?'.api':'')+'.orb.migos.club',custom_domain:true}]
 config.workers_dev=false
 config.preview_urls=false
 if(app==='api'){
  config.main='src/preview.ts'
  delete config.triggers
  delete config.queues
 }else config.services=config.services.map(s=>s.binding==='API'?{...s,service:'orb-api-pr-'+pr}:s)
 writeFileSync(new URL('./wrangler.preview.json',file),JSON.stringify(config,null,2)+'\n')
}
