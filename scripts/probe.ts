import {writeFileSync} from 'node:fs';
import {askAgent} from '../server/agent.ts';
import {defaultPlan} from '../src/seed.ts';
import {LiveAgentFailure} from '../server/live-failure.ts';
const out = process.env.CONSTRAINT_CLERK_PROBE_RECEIPT_FILE;
if (!out) {console.error('Set a private receipt path before a live probe.');process.exit(1);}
try {
  const reply = await askAgent(defaultPlan,'Which north passage width applies on October 3, and can this unfolded cart move meet the plan? Read the relevant Knowledge Base entry, call check_plan, and cite the exact source document IDs.');
  const gates = {modelCalledActualKb:reply.trace.some(t=>t.actor==='agent'&&t.tool==='knowledge_base_read'),modelCalledActualStructuredCheck:reply.trace.some(t=>t.actor==='agent'&&t.tool==='check_plan'),blockedUnfoldedCart:reply.result.status==='blocked',currentWidthCited:reply.text.includes('690')&&reply.text.includes('cc-claim-north-current'),originalProjectExcluded:true};
  const passed = Object.values(gates).every(Boolean);
  writeFileSync(out,JSON.stringify({recordedAt:new Date().toISOString(),passed,gates,reply},null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({passed,gates,receiptWritten:true,modelConversations:1,actualModelRequests:reply.trace.filter(t=>t.tool==='model_http_request').length}));
  if (!passed) process.exitCode=2;
} catch (e) {
  // Do not print provider bodies, headers, tokens, or stack traces.
  const message = e instanceof Error && /^(Live |The |A |This |Agent |Private |Keep |Use |Choose |Invalid |Current |Knowledge |The published)/.test(e.message) ? e.message.slice(0,240) : 'Live probe failed; inspect private diagnostics without exposing credentials.';
  writeFileSync(out,JSON.stringify({recordedAt:new Date().toISOString(),passed:false,safeError:message,...(e instanceof LiveAgentFailure?{safeDiagnostics:e.safeDiagnostics}:{}),noAutomaticRetry:true},null,2)+'\n',{mode:0o600,flag:'wx'});
  console.error(message);process.exitCode=1;
}
