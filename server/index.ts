import {createServer, type IncomingMessage} from 'node:http';
import {askAgent} from './agent.ts';
import {loadCredentials} from './config.ts';
import {readPermit, requestUsed} from './budget.ts';
import type {Plan} from '../src/domain.ts';
const origins = new Set(['http://127.0.0.1:5289','http://localhost:5289']);
export function allowLivePost(request: Pick<IncomingMessage,'headers'>): boolean {
  return origins.has(request.headers.origin??'') && request.headers['x-constraint-clerk']==='1' && (request.headers['content-type']??'').startsWith('application/json');
}
async function body(request:IncomingMessage): Promise<string> {
  let text = '';
  for await (const chunk of request) {
    text += chunk.toString();
    if (text.length > 4096) throw new Error('Request is too large.');
  }
  return text;
}
const server = createServer(async (request,response) => {
  const send = (status:number,value:unknown) => {response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(value));};
  if (request.url==='/api/status' && request.method==='GET') {
    try {
      loadCredentials();
      const file = process.env.CONSTRAINT_CLERK_LIVE_PERMIT_FILE;
      if (!file) throw new Error('No permit');
      readPermit(file);
      send(200,{available:!requestUsed(file),message:requestUsed(file)?'The bounded live attempt has been used.':'A bounded live attempt is configured.'});
    } catch {send(200,{available:false,message:'Live Context and model connection has not been verified.'});}
    return;
  }
  if (request.url!=='/api/ask' || request.method!=='POST') return send(404,{error:'Not found.'});
  if (!allowLivePost(request)) return send(403,{error:'Use this app from its local origin.'});
  try {
    const data = JSON.parse(await body(request)) as {plan:Plan;question:string};
    if (typeof data.question!=='string') return send(400,{error:'A question is required.'});
    send(200,await askAgent(data.plan,data.question));
  } catch {send(422,{error:'The live check did not complete. No live answer is shown and no automatic retry was made.'});}
});
if (process.argv[1] && import.meta.filename===process.argv[1]) {
  server.listen(5290,'127.0.0.1',()=>console.log('Constraint Clerk local agent service: http://127.0.0.1:5290'));
  const stop = () => server.close(()=>process.exit(0));
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
