import {openSync, closeSync, readFileSync, writeFileSync} from 'node:fs';
import {z} from 'zod';
import {readPrivateJson} from './config.ts';

const permitSchema = z.object({
  purpose:z.literal('constraint-clerk-live-falsifier'),
  cashLimitUsd:z.literal(0),
  paidOveragesAllowed:z.literal(false),
  includedCreditsRemaining:z.number().int().min(100),
  observedAt:z.string().datetime({offset:true}),
  expiresAt:z.string().datetime({offset:true}),
  maxConversations:z.literal(1),
  maxAgentToolCalls:z.literal(4),
  maxSteps:z.literal(4),
  evidenceRef:z.string().min(10),
}).strict();
export function readPermit(path: string, now = Date.now()) {
  const permit = permitSchema.parse(readPrivateJson(path));
  const observed = Date.parse(permit.observedAt);
  if (observed > now || now - observed > 20 * 60_000 || Date.parse(permit.expiresAt) <= now) throw new Error('Live permit is stale. Read the actual free-credit and overage state first.');
  return permit;
}
export function reserveOneRequest(permitPath: string): void {
  readPermit(permitPath);
  const counter = `${permitPath}.used`;
  // Exclusive creation is durable across restarts and consumes the attempt even on failure.
  let fd: number;
  try {fd = openSync(counter, 'wx', 0o600);} catch {throw new Error('This one-request live permit is already consumed. No automatic retry.');}
  try {writeFileSync(fd, JSON.stringify({reservedAt:new Date().toISOString(),requests:1})+'\n');} finally {closeSync(fd);}
}
export function requestUsed(permitPath: string): boolean {
  try {readFileSync(`${permitPath}.used`); return true;} catch {return false;}
}
