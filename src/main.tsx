import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {checkPlan,type Plan,type PlanResult} from './domain.ts';
import {seed,defaultPlan} from './seed.ts';
import type {AgentReply} from '../server/agent.ts';
import verification from './recorded-verification.json';
import './style.css';

function App() {
  const [plan,setPlan]=useState<Plan>(defaultPlan);
  const [checked,setChecked]=useState<Plan>(defaultPlan);
  const [selected,setSelected]=useState('cc-claim-north-current');
  const [error,setError]=useState('');
  const [liveAvailable,setLiveAvailable]=useState(false);
  const [busy,setBusy]=useState(false);
  const [reply,setReply]=useState<AgentReply|null>(null);
  const [recorded,setRecorded]=useState(false);
  const [question,setQuestion]=useState('Which clearance applies, and can this cart move meet the plan? Cite the current source and any superseded claim.');
  const local=useMemo(()=>checkPlan(seed,checked),[checked]);
  const result:PlanResult=reply?.result??local;
  const source=seed.find(d=>d._id===selected);
  const changed=JSON.stringify(plan)!==JSON.stringify(checked);
  useEffect(()=>{if(!import.meta.env.DEV)return;fetch('/api/status').then(r=>r.json()).then(s=>setLiveAvailable(s.available===true)).catch(()=>setLiveAvailable(false));},[]);
  function update(p:Partial<Plan>) {setPlan(old=>({...old,...p}));setReply(null);setRecorded(false);setError('');}
  function scenario(p:Partial<Plan>) {const next={...defaultPlan,...p};setPlan(next);setChecked(next);setReply(null);setRecorded(false);setError('');}
  function check() {try {checkPlan(seed,plan);setChecked({...plan});setReply(null);setRecorded(false);setError('');}catch(e){setError(e instanceof Error?e.message:'The plan could not be checked.');}}
  function showRecording(){setPlan({...defaultPlan});setChecked({...defaultPlan});setReply(verification.reply as AgentReply);setRecorded(true);setError('');}
  async function ask() {
    setBusy(true);setError('');
    try {
      const r=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json','X-Constraint-Clerk':'1'},body:JSON.stringify({plan,question})});
      const data=await r.json();
      if (!r.ok || data.mode!=='live') throw new Error(data.error??'No verified live answer was returned.');
      setReply(data);setRecorded(false);setChecked({...plan});
    }catch(e){setReply(null);setError(e instanceof Error?e.message:'The live check did not complete.');}
    finally{setBusy(false);setLiveAvailable(false);}
  }
  const statusTitle={feasible:'The plan meets the documented constraints.',blocked:'The plan is blocked by a documented constraint.',unknown:'The evidence is incomplete.'}[result.status];
  return <>
    <header><div><h1>Constraint Clerk</h1><p>A cited changeover planner for a fictional pocket theater.</p></div><div className="mode" aria-live="polite">{reply?(recorded?'Recorded live verification · October 3, 2026':'Live Sanity Context + agent'):'Local example · no live AI call'}</div></header>
    <main>
      <section className="planning" aria-labelledby="plan-title">
        <h2 id="plan-title">Bellcart move</h2><p className="note">North Pier Room. One cart, a fixed cue and three possible passages.</p>
        <div className="examples" aria-label="Example plans"><button onClick={()=>scenario({})}>Original plan</button><button onClick={()=>scenario({mode:'folded'})}>Folded alternative</button><button onClick={()=>scenario({routeId:'cc-route-west',mode:'folded'})}>Missing measurement</button></div>
        <form onSubmit={e=>{e.preventDefault();check();}}>
          <label>Plan date<input type="date" value={plan.date} required onChange={e=>update({date:e.target.value})}/></label>
          <label>Route<select value={plan.routeId} onChange={e=>update({routeId:e.target.value})}><option value="cc-route-north">North · 4 min</option><option value="cc-route-east">East · 5 min</option><option value="cc-route-west">West · 6 min</option></select></label>
          <label>Cart state<select value={plan.mode} onChange={e=>update({mode:e.target.value as Plan['mode']})}><option value="unfolded">Unfolded · handle attached</option><option value="folded">Folded · preparation required</option></select></label>
          <div className="paired"><label>Start<input type="time" value={plan.start} required onChange={e=>update({start:e.target.value})}/></label><label>Cue deadline<input type="time" value={plan.deadline} required onChange={e=>update({deadline:e.target.value})}/></label></div>
          <label>Assigned crew<select value={plan.crew} onChange={e=>update({crew:Number(e.target.value)})}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} crew {n===1?'member':'members'}</option>)}</select></label>
          <button className="primary" type="submit">Check local plan</button>
        </form>
        {changed&&<p className="note">Inputs changed. Check the plan to update the result.</p>}
        {error&&<p role="alert" className="error">{error}</p>}
        <section className="agent" aria-labelledby="agent-title"><h3 id="agent-title">Verified agent check</h3><p className="note">View the actual response to the original plan, with its KB retrieval and structured checks. Changing inputs clears the recording.</p><button onClick={showRecording}>View recorded AI verification</button>{import.meta.env.DEV&&<><label>Question<textarea value={question} maxLength={800} rows={4} onChange={e=>setQuestion(e.target.value)}/></label><button onClick={ask} disabled={!liveAvailable||busy}>{busy?'Reading live sources…':'Ask agent · live'}</button></>}{!liveAvailable&&<p className="note">This demo makes no live AI requests. The other examples run the local checker.</p>}</section>
      </section>
      <section className="results" aria-labelledby="result-title">
        <div className={`verdict ${result.status}`} aria-live="polite"><p className="status-label">{result.status==='feasible'?'Feasible':result.status==='blocked'?'Blocked':'Unknown'}</p><h2 id="result-title">{statusTitle}</h2><p>{result.finish?`Calculated finish ${result.finish} · cue ${checked.deadline}`:'No complete finish time is supported.'}</p></div>
        <h3>Constraint checks</h3><ul className="findings">{result.findings.map((f,i)=><li key={`${f.label}-${i}`}><div className="finding-head"><strong>{f.label}</strong><span>{f.status==='pass'?'Pass':f.status==='blocked'?'Blocked':'Unknown'}</span></div><p>{f.detail}</p><div className="source-links">{f.sourceIds.map(id=><button key={id} onClick={()=>setSelected(id)} aria-label={`Read source ${id}`}>{seed.find(s=>s._id===id)?.title??id}</button>)}</div></li>)}</ul>
        {reply&&<section className="reply"><h3>{recorded?'Recorded agent explanation':'Live agent explanation'}</h3>{recorded&&<p className="note">Actual Sanity Content Agent response from {verification.recordedAt.replace('T',' ').replace('Z',' UTC')}. No new conversation runs when you view it.</p>}<p className="answer">{reply.text.split('\n\n')[0].replace(/\*\*|`/g,'')}</p><details><summary>Full actual answer (Markdown)</summary><pre className="answer">{reply.text}</pre></details><details><summary>Actual retrieval trace</summary><ol>{reply.trace.map((t,i)=><li key={i}><strong>{t.tool}</strong> · {t.actor}<p>{t.detail}</p></li>)}</ol></details></section>}
      </section>
      <aside aria-labelledby="source-title"><h2 id="source-title">Source record</h2>{source?<><h3>{source.title}</h3><code>{source._id}</code><p>{source.body}</p>{source._type==='ccClaim'&&<dl><dt>Property</dt><dd>{source.property}</dd><dt>Value</dt><dd>{source.value===null?'Unknown':source.value}</dd><dt>Effective from</dt><dd>{source.effectiveFrom}</dd><dt>Applies to</dt><dd>{seed.find(d=>d._id===source.target._ref)?.title??source.target._ref}</dd>{source.supersedes&&<><dt>Supersedes</dt><dd><button onClick={()=>setSelected(source.supersedes!._ref)}>{seed.find(d=>d._id===source.supersedes!._ref)?.title}</button></dd></>}</dl>}</>:<p>The selected source is not present in the local copy.</p>}<p className="note">{reply?'The verified check retrieved structured records through Context. This pane shows the matching original source copy.':'These are original local fictional records. No cloud retrieval is claimed.'}</p></aside>
    </main><footer>Fictional demonstration, not a real venue inspection or safety approval. Unknown measurements stay unknown.</footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
