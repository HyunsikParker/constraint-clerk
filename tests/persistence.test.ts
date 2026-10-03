import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../src/seed.ts';
import {parseDocuments} from '../server/documents.ts';
import {prepareSeedDocuments,verifySeedReadback} from '../scripts/seed-documents.ts';

test('Studio array keys preserve the original typed sources without mutating the frozen seed',()=>{
  const before=JSON.stringify(seed);
  const stored=prepareSeedDocuments(seed);
  assert.deepEqual(parseDocuments(stored),parseDocuments(seed));
  assert.equal(JSON.stringify(seed),before);
  assert.deepEqual(stored,prepareSeedDocuments(seed));
  assert.equal(verifySeedReadback(seed,stored).documents,19);
});

test('matching source IDs cannot disguise a changed measurement or missing Studio keys',()=>{
  const changed=structuredClone(prepareSeedDocuments(seed));
  const claim=changed.find(document=>document._id==='cc-claim-north-current');
  assert.ok(claim?._type==='ccClaim');claim.value=720;
  assert.throws(()=>verifySeedReadback(seed,changed),/typed source content/);
  assert.throws(()=>verifySeedReadback(seed,seed),/Studio keys/);
});
