const {setTimeout: wait}=require('node:timers/promises');
async function main(){
 const {GITHUB_REPOSITORY:repo,GITHUB_SHA:sha,GH_TOKEN:token}=process.env;
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo||'')||! /^[a-f0-9]{40}$/.test(sha||'')||!token)throw Error('Missing GitHub workflow context');
 const url=`https://api.github.com/repos/${repo}/actions/workflows/browser-validation.yml/runs?head_sha=${sha}&per_page=30`;
 const until=Date.now()+18*60*1000;
 while(Date.now()<until){
  const response=await fetch(url,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2026-03-10'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`Cannot inspect browser gate: HTTP ${response.status}`);
  const {workflow_runs:runs=[]}=await response.json();
  const run=runs.filter(r=>r.head_sha===sha&&!['skipped','cancelled'].includes(r.conclusion)).sort((a,b)=>b.id-a.id)[0];
  if(run?.status==='completed'){
   if(run.conclusion!=='success')throw Error(`Browser gate ${run.id}: ${run.conclusion}`);
   console.log(`BROWSER_GATE_VERIFIED ${run.id} ${sha}`);return;
  }
  console.log(`Waiting for browser gate for ${sha}: ${run?.status||'deployment pending'}`);
  await wait(15000);
 }
 throw Error('Timed out waiting for this commit to pass the browser gate');
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
