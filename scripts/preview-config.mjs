import {readFileSync,writeFileSync} from 'node:fs'
const pr=process.argv[2]
if(!/^[1-9][0-9]*$/.test(pr??''))throw Error('Invalid PR number')
const file=new URL('../apps/web/wrangler.jsonc',import.meta.url)
const config=JSON.parse(readFileSync(file,'utf8'))
config.name='orb-web-pr-'+pr
config.routes=[{pattern:pr+'.orb.migos.club',custom_domain:true}]
config.workers_dev=false
config.preview_urls=false
writeFileSync(new URL('./wrangler.preview.json',file),JSON.stringify(config,null,2)+'\n')
