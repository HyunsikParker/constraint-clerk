import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../src/seed.ts';
import {prepareSeedDocuments,verifySeedReadback} from '../scripts/seed-documents.ts';
import {readContextDocuments} from '../server/context-documents.ts';
const mcp=(value:unknown)=>({content:[{type:'text',text:JSON.stringify(value)}]});
const originals=prepareSeedDocuments(seed);
const outlined=originals.filter(d=>'refs' in d);
function response(){return mcp({meta:{resultCount:19,returnedCount:19,warnings:outlined.map(()=>({type:'outlined_field',field:'refs',totalItems:1}))},result:originals.map(d=>'refs' in d?{...d,refs:{kind:'field',name:'refs',representation:{mode:'outline',canonical:false},stats:{totalItems:1}}}:d)});}
const read=async(id:string)=>{const row=originals.find(d=>d._id===id)!;const refs=('refs' in row?row.refs:[])!;return mcp({mode:'range',documentId:id,field:'refs',totalBlocks:refs.length,returnedBlockCount:refs.length,truncated:false,startIndex:0,endIndex:refs.length,returnedBlocks:refs.map((block,index)=>({index,block,cropped:false}))});};
test('real Context-style outlines are replaced with complete canonical references before checking',async()=>{
  const r=await readContextDocuments(response(),read);
  assert.equal(r.documents.length,19);assert.equal(r.hydratedRefArrays,4);
  assert.equal(verifySeedReadback(seed,r.rawDocuments).documents,19);
});
test('cropped arrays, wrong document identities and unrelated warnings fail closed',async()=>{
  await assert.rejects(()=>readContextDocuments(response(),async id=>{const r=JSON.parse((await read(id)).content[0].text);r.truncated=true;return mcp(r);}));
  await assert.rejects(()=>readContextDocuments(response(),async id=>{const r=JSON.parse((await read(id)).content[0].text);r.documentId='cc-other';return mcp(r);}),/not returned completely/);
  await assert.rejects(()=>readContextDocuments(mcp({meta:{warnings:[{type:'cropped_field',field:'body'}]},result:originals}),read),/unresolved cropping/);
});
