import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPlan, minutes, type Claim} from '../src/domain.ts';
import {seed, defaultPlan} from '../src/seed.ts';

test('a superseded wide survey cannot make the October plan feasible', () => {
  const r = checkPlan(seed, defaultPlan);
  assert.equal(r.status, 'blocked');
  assert.ok(r.findings.some(f => f.status === 'blocked' && f.detail.includes('690')));
  assert.ok(r.sourceIds.includes('cc-claim-north-current'));
  assert.ok(r.sourceIds.includes('cc-claim-north-old'));
});
test('conditional folding, crew and duration produce a feasible alternative', () => {
  const r = checkPlan(seed, {...defaultPlan, mode:'folded'});
  assert.equal(r.status, 'feasible');
  assert.equal(r.finish, '18:10');
  assert.ok(r.sourceIds.includes('cc-roster-early'));
});
test('one assigned crew cannot use the folded width', () => assert.equal(checkPlan(seed, {...defaultPlan, mode:'folded',crew:1}).status,'blocked'));
test('an undocumented west clearance remains unknown', () => {
  const r = checkPlan(seed, {...defaultPlan,routeId:'cc-route-west',mode:'folded'});
  assert.equal(r.status,'unknown');
  assert.ok(r.findings.some(f => f.status === 'unknown' && f.sourceIds.includes('cc-claim-west')));
});
test('a wider route is blocked by a closure even when clearance passes', () => {
  const r = checkPlan(seed, {...defaultPlan,routeId:'cc-route-east',start:'18:08',deadline:'18:20'});
  assert.equal(r.status,'blocked');
  assert.ok(r.findings.some(f => f.status === 'blocked' && f.sourceIds.includes('cc-closure-east')));
});
test('closure endpoints are half-open, not falsely overlapping', () => {
  const r = checkPlan(seed, {...defaultPlan,routeId:'cc-route-east',start:'18:04'});
  assert.equal(r.finish,'18:09');
  assert.equal(r.status,'feasible');
});
test('no complete roster interval cannot be called feasible', () => assert.equal(checkPlan(seed,{...defaultPlan,mode:'folded',start:'18:08',deadline:'18:20'}).status,'unknown'));
test('two current source values without supersession remain a conflict', () => {
  const extra: Claim = {_id:'cc-conflicting-width',_type:'ccClaim',title:'Unresolved extra survey',body:'Test-only conflicting value.',target:{_type:'reference',_ref:'cc-passage-north'},property:'clearWidthMm',value:900,effectiveFrom:'2026-10-03'};
  const r = checkPlan([...seed,extra],{...defaultPlan,mode:'folded'});
  assert.equal(r.status,'unknown');
});
test('future revisions do not retroactively retire the earlier survey', () => assert.equal(checkPlan(seed,{...defaultPlan,date:'2026-10-02'}).status,'feasible'));
test('invalid time, reversed interval and nonexistent calendar day fail closed', () => {
  assert.throws(() => minutes('25:10'));
  assert.throws(() => checkPlan(seed,{...defaultPlan,deadline:'18:00'}));
  assert.throws(() => checkPlan(seed,{...defaultPlan,date:'2026-02-30'}));
});
