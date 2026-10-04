import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),port=5192,url=`http://127.0.0.1:${port}/water-preview.html`;
const open=()=>{if(!process.argv.includes('--no-open'))spawn('cmd.exe',['/c','start','',url],{windowsHide:true,stdio:'ignore'}).unref();};
try{
 const response=await fetch(`http://127.0.0.1:${port}/__water_preview`,{signal:AbortSignal.timeout(800)});
 if(response.ok&&(await response.json()).root===root){console.log('Preview already running: '+url);open();process.exit(0);}
}catch{}
const server=await createServer({root,server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'water-preview-identification',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url==='/__water_preview'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({preview:'flannan-west-water',root}));}else next();});}}]});
try{await server.listen();console.log('\nWest landing water experiment\n'+url+'\nClose this window to stop the preview.\n');open();}catch(e){console.error(`Could not start on port ${port}: ${e.message}`);await server.close();process.exit(1);}
