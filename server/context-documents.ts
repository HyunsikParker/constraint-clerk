import {z} from 'zod';
import {parseDocuments,unwrapMcpJson} from './documents.ts';

type ArrayReader = (documentId:string,field:'refs',count:number)=>Promise<unknown>;
const reference=z.object({_type:z.literal('reference'),_ref:z.string().regex(/^cc-[a-z0-9-]+$/)}).passthrough();
const arrayResponse=z.object({mode:z.literal('range'),documentId:z.string(),field:z.literal('refs'),totalBlocks:z.number().int().min(0).max(12),returnedBlockCount:z.number().int().min(0).max(12),truncated:z.literal(false),startIndex:z.literal(0),endIndex:z.number().int().min(0).max(12),returnedBlocks:z.array(z.object({index:z.number().int().min(0).max(11),block:reference,cropped:z.literal(false)})).max(12)});

// Context deliberately outlines arrays. Read canonical blocks; an outline is not evidence.
export async function readContextDocuments(raw:unknown,readArray:ArrayReader){
  const envelope=unwrapMcpJson(raw) as {result?:unknown;meta?:{warnings?:unknown;resultCount?:number;returnedCount?:number}};
  if(!Array.isArray(envelope.result)||envelope.result.length>32)throw new Error('The Context source list is missing or exceeds its bound.');
  const warnings=envelope.meta?.warnings??[];
  if(!Array.isArray(warnings)||warnings.some(w=>!w||w.type!=='outlined_field'||w.field!=='refs'||!Number.isInteger(w.totalItems)||w.totalItems<0||w.totalItems>12))throw new Error('The Context response has an unresolved cropping warning.');
  for(const count of [envelope.meta?.resultCount,envelope.meta?.returnedCount])if(count!==undefined&&count!==envelope.result.length)throw new Error('The Context source list is incomplete.');
  const rows=envelope.result.map(row=>({...row})) as Record<string,unknown>[];
  const outlined=rows.filter(row=>row.refs!==undefined&&!Array.isArray(row.refs));
  if(outlined.length>8||outlined.length!==warnings.length)throw new Error('The Context reference outlines do not match the bounded warning set.');
  const counts=outlined.map(row=>{
    const o=row.refs as {kind?:string;name?:string;representation?:{mode?:string;canonical?:boolean};stats?:{totalItems?:number}};
    const count=o?.stats?.totalItems;
    if(row._type!=='ccSource'||typeof row._id!=='string'||!/^cc-[a-z0-9-]+$/.test(row._id)||o?.kind!=='field'||o.name!=='refs'||o.representation?.mode!=='outline'||o.representation.canonical!==false||!Number.isInteger(count)||count!<0||count!>12)throw new Error('The Context reference outline is invalid.');
    return count!;
  });
  if(JSON.stringify([...counts].sort())!==JSON.stringify(warnings.map(w=>w.totalItems).sort()))throw new Error('The Context outline counts do not match their warnings.');
  for(let i=0;i<outlined.length;i++){
    const row=outlined[i],count=counts[i];
    const r=arrayResponse.parse(unwrapMcpJson(await readArray(row._id as string,'refs',count)));
    if(r.documentId!==row._id||r.totalBlocks!==count||r.returnedBlockCount!==count||r.endIndex!==count||r.returnedBlocks.length!==count||r.returnedBlocks.some((b,j)=>b.index!==j))throw new Error('The Context reference array was not returned completely.');
    row.refs=r.returnedBlocks.map(b=>b.block);
  }
  return {documents:parseDocuments(rows),rawDocuments:rows,hydratedRefArrays:outlined.length};
}
