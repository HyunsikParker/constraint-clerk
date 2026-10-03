import {createHash} from 'node:crypto';
import type {Document} from '../src/domain.ts';
import {parseDocuments} from '../server/documents.ts';

export function prepareSeedDocuments(documents:Document[]) {
  return documents.map(document=>document._type==='ccSource'&&document.refs
    ? {...document,refs:document.refs.map((reference,index)=>({...reference,_key:`ref-${index}`}))}
    : {...document});
}

export function verifySeedReadback(expected:Document[],value:unknown) {
  const actual=parseDocuments(value);
  const canonical=(documents:Document[])=>JSON.stringify([...documents].sort((a,b)=>a._id.localeCompare(b._id)));
  const expectedText=canonical(parseDocuments(expected));
  if(canonical(actual)!==expectedText)throw new Error('Seed readback does not match the original typed source content.');
  const raw=value as {_id:string;refs?:{_key?:unknown}[]}[];
  for(const document of actual){
    if(document._type!=='ccSource'||!document.refs)continue;
    const references=raw.find(source=>source._id===document._id)?.refs??[];
    const keys=references.map(reference=>reference._key);
    if(keys.some(key=>typeof key!=='string'||key.length===0)||new Set(keys).size!==keys.length)throw new Error('Seed array references have missing or duplicate Studio keys.');
  }
  return {documents:actual.length,typedSourceSha256:createHash('sha256').update(expectedText).digest('hex')};
}
