import {loadProjectCredentials} from '../server/config.ts';
import {seed} from '../src/seed.ts';
import {prepareSeedDocuments,verifySeedReadback} from './seed-documents.ts';
const c = loadProjectCredentials();
try {
  const res = await fetch(`https://${c.projectId}.api.sanity.io/v2026-10-01/data/mutate/${c.dataset}`,{method:'POST',headers:{Authorization:`Bearer ${c.contentAgentToken}`,'Content-Type':'application/json'},body:JSON.stringify({mutations:prepareSeedDocuments(seed).map(document=>({createIfNotExists:document}))}),signal:AbortSignal.timeout(30_000)});
  if (!res.ok) throw new Error('Seed mutation was not accepted.');
  const query = '*[_type in ["ccSource","ccClaim"] && _id match "cc-*"][0...33]';
  const read = await fetch(`https://${c.projectId}.api.sanity.io/v2026-10-01/data/query/${c.dataset}?query=${encodeURIComponent(query)}`,{headers:{Authorization:`Bearer ${c.contentAgentToken}`},signal:AbortSignal.timeout(30_000)});
  if (!read.ok) throw new Error('Seed readback failed.');
  const data = await read.json() as {result?:unknown};
  const verified=verifySeedReadback(seed,data.result);
  console.log(JSON.stringify({projectId:c.projectId,dataset:c.dataset,...verified,readbackVerified:true,overwroteExistingDocuments:false}));
} catch {console.error('Seeding did not verify. No provider response or token is printed.');process.exitCode=1;}
