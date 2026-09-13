// Regression audit for the launch fixes. The original findings are preserved in
// docs/audits/launch-2026-09-12/REPORT.md; this command checks current behaviour.
const {spawnSync}=require('node:child_process');
for(const args of [['test'],['run','lint']]){
 const result=spawnSync('npm',args,{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
const types=spawnSync('npx',['tsc','--noEmit'],{stdio:'inherit'});
process.exitCode=types.status||0;
