import type {Trace} from './agent.ts';
export class LiveAgentFailure extends Error {
  readonly safeDiagnostics:{errorType:string;status:number|null;code:string|null;trace:Trace[];modelRequests:number};
  constructor(error:unknown,trace:Trace[]){
    super('The live agent did not finish. No automatic retry.');
    const e=error as {constructor?:{name?:string};status?:unknown;code?:unknown};
    this.safeDiagnostics={errorType:e?.constructor?.name??'Unknown',status:typeof e?.status==='number'&&e.status>=100&&e.status<=599?e.status:null,code:typeof e?.code==='string'&&/^[A-Z_]{2,80}$/.test(e.code)?e.code:null,trace:trace.map(t=>({...t})),modelRequests:trace.filter(t=>t.tool==='model_http_request').length};
  }
}
