import {z} from 'zod';
import type {Document} from '../src/domain.ts';
const ref = z.object({_type:z.literal('reference'),_ref:z.string().regex(/^cc-[a-z0-9-]+$/)});
const base = {_id:z.string().regex(/^cc-[a-z0-9-]+$/),title:z.string().min(1),body:z.string().min(1)};
const source = z.object({...base,_type:z.literal('ccSource'),kind:z.enum(['brief','equipment','passage','route','roster','closure']),refs:z.array(ref).max(12).optional(),crew:z.number().int().min(0).max(4).optional(),start:z.string().regex(/^\d\d:\d\d$/).optional(),end:z.string().regex(/^\d\d:\d\d$/).optional(),durationMinutes:z.number().int().min(1).max(120).optional()});
const claim = z.object({...base,_type:z.literal('ccClaim'),target:ref,property:z.enum(['clearWidthMm','widthMm','foldedWidthMm','foldCrew','foldMinutes']),value:z.number().finite().nonnegative().nullable(),effectiveFrom:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),supersedes:ref.optional()}).refine(d => !['foldCrew','foldMinutes'].includes(d.property) || d.value === null || (Number.isInteger(d.value) && d.value >= 1), 'Crew and duration requirements must be positive integers.');
export const documentsSchema = z.array(z.discriminatedUnion('_type',[source,claim])).min(1).max(32);
export function parseDocuments(value: unknown): Document[] {
  const documents = documentsSchema.parse(value);
  if (new Set(documents.map(d => d._id)).size !== documents.length) throw new Error('Duplicate source IDs are not a usable evidence set.');
  const ids = new Set(documents.map(d=>d._id));
  for (const d of documents) {
    const refs = d._type==='ccClaim' ? [d.target,...(d.supersedes?[d.supersedes]:[])] : d.refs??[];
    if (refs.some(r=>!ids.has(r._ref))) throw new Error('The evidence set has a missing structured reference.');
    if (d._type==='ccClaim' && d.supersedes) {
      const earlier = documents.find(e=>e._id===d.supersedes!._ref);
      if (earlier?._type!=='ccClaim' || earlier.target._ref!==d.target._ref || earlier.property!==d.property) throw new Error('A source cannot supersede an unrelated claim.');
    }
  }
  return documents;
}
export function unwrapMcpJson(value: unknown): unknown {
  if (!value || typeof value !== 'object') throw new Error('Context returned no structured result.');
  const v = value as {isError?:boolean;structuredContent?:unknown;content?:{type:string;text?:string}[]};
  if (v.isError) throw new Error('The Context query failed.');
  if (v.structuredContent) return v.structuredContent;
  const content = v.content?.filter(x => x.type === 'text').map(x => x.text ?? '').join('\n');
  if (!content || content.length > 100_000) throw new Error('Context returned no bounded JSON payload.');
  return JSON.parse(content);
}
export const documentQuery = '*[_type in ["ccSource","ccClaim"] && _id match "cc-*"][0...33]';
