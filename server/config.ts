import {readFileSync, statSync, realpathSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {z} from 'zod';

const credentialsSchema = z.object({
  organizationId:z.string().regex(/^[a-z0-9]+$/),
  projectId:z.string().regex(/^[a-z0-9]+$/),
  dataset:z.literal('production'),
  applicationKey:z.string().min(3).max(256),
  knowledgeBaseId:z.string().regex(/^kb[a-zA-Z0-9-]+$/),
  kbEndpoint:z.string().url(),
  dataEndpoint:z.string().url(),
  contextToken:z.string().min(16),
  contentAgentToken:z.string().min(16),
}).strict();
export type Credentials = z.infer<typeof credentialsSchema>;
const projectCredentialsSchema = credentialsSchema.pick({projectId:true,dataset:true,contentAgentToken:true}).strip();
export type ProjectCredentials = z.infer<typeof projectCredentialsSchema>;

export function readPrivateJson(path: string): unknown {
  const real = realpathSync(path);
  const local = relative(resolve(import.meta.dirname, '..'), real);
  if (local === '' || (!local.startsWith('..') && !local.startsWith('/'))) throw new Error('Keep private files outside the source repository.');
  const s = statSync(real);
  if (!s.isFile() || (s.mode & 0o077) !== 0 || s.size > 32_768) throw new Error('Private files must be small mode-0600 regular files.');
  return JSON.parse(readFileSync(real, 'utf8'));
}
function readCredentialFile(): unknown {
  const path = process.env.CONSTRAINT_CLERK_CREDENTIAL_FILE;
  if (!path) throw new Error('Live credentials have not been configured.');
  return readPrivateJson(path);
}
function excludePublishedProject(projectId: string): void {
  if (projectId === '0k0a3q37') throw new Error('The published Alibi Atlas project is explicitly excluded.');
}
// Seeding precedes Studio registration and MCP setup; it needs only project access.
export function loadProjectCredentials(): ProjectCredentials {
  const c = projectCredentialsSchema.parse(readCredentialFile());
  excludePublishedProject(c.projectId);
  return c;
}
export function loadCredentials(): Credentials {
  const c = credentialsSchema.parse(readCredentialFile());
  excludePublishedProject(c.projectId);
  for (const [key, value] of [['kbEndpoint',c.kbEndpoint],['dataEndpoint',c.dataEndpoint]]) {
    const u = new URL(value);
    if (u.origin !== 'https://api.sanity.io' || !u.pathname.startsWith(`/v1/context/organizations/${c.organizationId}/mcp/`) || u.search || u.hash || u.username || u.password) throw new Error(`Invalid ${key}: use an explicitly scoped Sanity endpoint without credentials in its URL.`);
  }
  if (c.kbEndpoint === c.dataEndpoint) throw new Error('Use separate Knowledge Base and dataset endpoints.');
  return c;
}
