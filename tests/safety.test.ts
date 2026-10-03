import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {seed} from '../src/seed.ts';
import {parseDocuments,unwrapMcpJson} from '../server/documents.ts';
import {readPermit,reserveOneRequest} from '../server/budget.ts';
import {allowLivePost} from '../server/index.ts';
import {boundedSanityFetch} from '../server/bounded-fetch.ts';
import {loadCredentials,loadProjectCredentials} from '../server/config.ts';
import {LiveAgentFailure} from '../server/live-failure.ts';

test('failure evidence keeps the bounded trace without provider bodies or credentials',()=>{
  const secret='test-secret-must-not-appear';
  const original=Object.assign(new Error(secret),{status:403,body:{token:secret},headers:{Authorization:secret}});
  const failure=new LiveAgentFailure(original,[{at:'test',actor:'harness',tool:'model_http_request',detail:'Sanity model round-trip 1/4.',ok:true}]);
  assert.equal(failure.safeDiagnostics.modelRequests,1);assert.equal(failure.safeDiagnostics.status,403);
  assert.equal(JSON.stringify(failure).includes(secret),false);assert.equal(failure.message.includes(secret),false);
});

test('project bootstrap permits seeding without weakening full agent or private-file guards',()=>{
  const dir=mkdtempSync(join(tmpdir(),'clerk-bootstrap-'));const path=join(dir,'credentials.json');
  const previous=process.env.CONSTRAINT_CLERK_CREDENTIAL_FILE;
  const partial={organizationId:'testorg',projectId:'testnew',dataset:'production',contentAgentToken:'test-token-not-a-real-secret',contextToken:'test-context-not-a-real-secret'};
  try {
    process.env.CONSTRAINT_CLERK_CREDENTIAL_FILE=path;
    writeFileSync(path,JSON.stringify(partial),{mode:0o600});
    assert.equal(loadProjectCredentials().projectId,'testnew');
    assert.throws(()=>loadCredentials());
    writeFileSync(path,JSON.stringify({...partial,projectId:'0k0a3q37'}));
    assert.throws(()=>loadProjectCredentials(),/explicitly excluded/);
    writeFileSync(path,JSON.stringify(partial));chmodSync(path,0o644);
    assert.throws(()=>loadProjectCredentials(),/mode-0600/);
  }finally{
    if(previous===undefined) delete process.env.CONSTRAINT_CLERK_CREDENTIAL_FILE;else process.env.CONSTRAINT_CLERK_CREDENTIAL_FILE=previous;
    rmSync(dir,{recursive:true,force:true});
  }
});

test('live evidence parser rejects cropping-sized payloads, duplicate IDs and missing references',()=>{
  assert.equal(parseDocuments(seed).length,19);
  assert.throws(()=>parseDocuments([...seed,seed[0]]));
  assert.throws(()=>parseDocuments(seed.filter(d=>d._id!=='cc-passage-north')));
  assert.throws(()=>parseDocuments(Array.from({length:33},(_,i)=>({...seed[0],_id:`cc-test-${i}`}))));
  assert.throws(()=>unwrapMcpJson({isError:true,content:[]}));
  assert.throws(()=>unwrapMcpJson({content:[{type:'text',text:'not JSON'}]}));
});
test('one live permit remains consumed across restarts and refuses stale or paid caps',()=>{
  const dir=mkdtempSync(join(tmpdir(),'clerk-budget-'));const path=join(dir,'permit.json');
  const now=Date.now();
  const permit={purpose:'constraint-clerk-live-falsifier',cashLimitUsd:0,paidOveragesAllowed:false,includedCreditsRemaining:1000,observedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60_000).toISOString(),maxConversations:1,maxAgentToolCalls:4,maxSteps:4,evidenceRef:'test-only-free-allowance'};
  try {
    writeFileSync(path,JSON.stringify(permit),{mode:0o600});reserveOneRequest(path);
    assert.throws(()=>reserveOneRequest(path),/already consumed/);
    assert.throws(()=>readPermit(path,now+21*60_000),/stale/);
    writeFileSync(path,JSON.stringify({...permit,paidOveragesAllowed:true}));assert.throws(()=>readPermit(path));
    writeFileSync(path,JSON.stringify({...permit,cashLimitUsd:1}));assert.throws(()=>readPermit(path));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('an external webpage or simple form cannot spend the local live budget',()=>{
  assert.equal(allowLivePost({headers:{origin:'https://evil.example','x-constraint-clerk':'1','content-type':'application/json'}}),false);
  assert.equal(allowLivePost({headers:{origin:'http://127.0.0.1:5289','content-type':'application/x-www-form-urlencoded'}}),false);
  assert.equal(allowLivePost({headers:{origin:'http://127.0.0.1:5289','x-constraint-clerk':'1','content-type':'application/json'}}),true);
});
test('model responses are byte-bounded before vulnerable response handlers read them',async()=>{
  let calls=0;
  const fetcher:typeof fetch=async()=>{calls++;return new Response('x'.repeat(32));};
  const safe=boundedSanityFetch(fetcher,16);
  const response=await safe('https://api.sanity.io/example');
  await assert.rejects(()=>response.text(),/byte limit/);
  await assert.rejects(()=>safe('https://evil.example/example'),/official Sanity/);
  assert.equal(calls,1);
});
