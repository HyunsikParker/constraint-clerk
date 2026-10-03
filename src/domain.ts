export type Ref = {_type: 'reference'; _ref: string};
export type Source = {
  _id: string;
  _type: 'ccSource';
  title: string;
  kind: 'brief' | 'equipment' | 'passage' | 'route' | 'roster' | 'closure';
  body: string;
  refs?: Ref[];
  crew?: number;
  start?: string;
  end?: string;
  durationMinutes?: number;
};
export type Claim = {
  _id: string;
  _type: 'ccClaim';
  title: string;
  body: string;
  target: Ref;
  property: 'clearWidthMm' | 'widthMm' | 'foldedWidthMm' | 'foldCrew' | 'foldMinutes';
  value: number | null;
  effectiveFrom: string;
  supersedes?: Ref;
};
export type Document = Source | Claim;
export type Plan = {
  date: string;
  routeId: string;
  equipmentId: string;
  mode: 'folded' | 'unfolded';
  start: string;
  deadline: string;
  crew: number;
};
export type Finding = {status: 'pass' | 'blocked' | 'unknown'; label: string; detail: string; sourceIds: string[]};
export type PlanResult = {
  status: 'feasible' | 'blocked' | 'unknown';
  finish: string | null;
  findings: Finding[];
  sourceIds: string[];
};

export function minutes(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Use a time between 00:00 and 23:59.');
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}
export function clock(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function validatePlan(plan: Plan): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.date) || new Date(`${plan.date}T00:00:00Z`).toISOString().slice(0, 10) !== plan.date) throw new Error('Use a valid date.');
  if (!/^cc-route-[a-z]+$/.test(plan.routeId) || plan.equipmentId !== 'cc-equipment-bellcart') throw new Error('Choose an available route and cart.');
  if (!['folded', 'unfolded'].includes(plan.mode)) throw new Error('Choose folded or unfolded.');
  if (!Number.isInteger(plan.crew) || plan.crew < 1 || plan.crew > 4) throw new Error('Choose one to four crew members.');
  if (minutes(plan.deadline) <= minutes(plan.start)) throw new Error('The deadline must be later on the same day.');
}

export function checkPlan(documents: Document[], plan: Plan): PlanResult {
  validatePlan(plan);
  const findings: Finding[] = [];
  const byId = new Map(documents.map(d => [d._id, d]));
  const add = (status: Finding['status'], label: string, detail: string, sourceIds: string[]) => findings.push({status, label, detail, sourceIds});
  function claim(target: string, property: Claim['property']): Claim | null {
    const claims = documents.filter((d): d is Claim => d._type === 'ccClaim' && d.target._ref === target && d.property === property && d.effectiveFrom <= plan.date);
    const retired = new Set(claims.map(c => c.supersedes?._ref).filter(Boolean));
    const current = claims.filter(c => !retired.has(c._id));
    if (current.length !== 1 || current[0].value === null || !Number.isFinite(current[0].value) || current[0].value < 0) {
      add('unknown', property, current.length > 1 ? 'Applicable sources conflict without an explicit supersession.' : 'No current, measured value is available.', current.map(c => c._id));
      return null;
    }
    const selected = current[0];
    if (selected.supersedes) add('pass', 'Source revision', `${selected.title} explicitly replaces ${byId.get(selected.supersedes._ref)?.title ?? selected.supersedes._ref} for this date.`, [selected._id, selected.supersedes._ref]);
    return selected;
  }
  const route = byId.get(plan.routeId);
  if (!route || route._type !== 'ccSource' || route.kind !== 'route' || !route.refs?.length || !Number.isFinite(route.durationMinutes) || route.durationMinutes! < 1) {
    add('unknown', 'Route', 'The route or its travel time has not been documented.', route ? [route._id] : []);
    return finishResult(null);
  }
  const width = claim(plan.equipmentId, plan.mode === 'folded' ? 'foldedWidthMm' : 'widthMm');
  let folding = 0;
  let foldingKnown = true;
  if (plan.mode === 'folded') {
    const needed = claim(plan.equipmentId, 'foldCrew');
    const duration = claim(plan.equipmentId, 'foldMinutes');
    if (!needed || !duration) foldingKnown = false;
    else {
      folding = duration.value!;
      add(plan.crew >= needed.value! ? 'pass' : 'blocked', 'Folding crew', `Folding needs ${needed.value} crew; the plan assigns ${plan.crew}.`, [needed._id, duration._id]);
    }
  }
  for (const ref of route.refs) {
    const passage = byId.get(ref._ref);
    if (!passage || passage._type !== 'ccSource' || passage.kind !== 'passage') {
      add('unknown', 'Passage', 'A referenced passage is missing.', [route._id]);
      continue;
    }
    const clear = claim(passage._id, 'clearWidthMm');
    if (width && clear) add(width.value! <= clear.value! ? 'pass' : 'blocked', passage.title, `${plan.mode === 'folded' ? 'Folded' : 'Unfolded'} cart ${width.value} mm; clear passage ${clear.value} mm.`, [width._id, clear._id, route._id]);
  }
  const start = minutes(plan.start);
  const end = start + folding + route.durationMinutes!;
  if (!foldingKnown || !Number.isInteger(end) || end >= 24 * 60) {
    add('unknown', 'Timing', 'A complete same-day duration could not be established.', [route._id]);
    return finishResult(null);
  }
  const rosters = documents.filter((d): d is Source => d._type === 'ccSource' && d.kind === 'roster');
  const covering = rosters.filter(r => r.start && r.end && minutes(r.start) <= start && minutes(r.end) >= end && Number.isInteger(r.crew));
  if (!covering.length) add('unknown', 'Roster', 'No single roster covers the complete fold-and-move interval.', rosters.map(r => r._id));
  else {
    const counts = new Set(covering.map(r => r.crew!));
    if (counts.size !== 1) add('unknown', 'Roster', 'The applicable rosters disagree on crew availability.', covering.map(r => r._id));
    else {
      const available = covering[0].crew!;
      add(plan.crew <= available ? 'pass' : 'blocked', 'Roster', `${available} crew available for ${plan.start}–${clock(end)}; ${plan.crew} assigned.`, covering.map(r => r._id));
    }
  }
  const closures = documents.filter((d): d is Source => d._type === 'ccSource' && d.kind === 'closure' && d.refs?.some(r => route.refs!.some(p => p._ref === r._ref)) === true);
  for (const c of closures) {
    if (!c.start || !c.end) add('unknown', 'Passage closure', 'A closure has no complete time range.', [c._id]);
    else {
      const overlaps = start + folding < minutes(c.end) && end > minutes(c.start);
      add(overlaps ? 'blocked' : 'pass', 'Passage closure', `${c.title}: ${c.start}–${c.end}; planned move ${clock(start + folding)}–${clock(end)}.`, [c._id, route._id]);
    }
  }
  add(end <= minutes(plan.deadline) ? 'pass' : 'blocked', 'Deadline', `Finish ${clock(end)}; deadline ${plan.deadline}.`, [route._id, ...(plan.mode === 'folded' ? ['cc-claim-fold-minutes'] : [])]);
  return finishResult(clock(end));
  function finishResult(finish: string | null): PlanResult {
    const status = findings.some(f => f.status === 'blocked') ? 'blocked' : findings.some(f => f.status === 'unknown') ? 'unknown' : 'feasible';
    return {status, finish, findings, sourceIds: [...new Set(findings.flatMap(f => f.sourceIds))]};
  }
}
