# Constraint Clerk

A source-cited changeover planner for an original fictional pocket theater. The September survey says a cart fits. An October sound screen narrows the same passage. Folding the cart changes its width, but also adds preparation time and a crew requirement. A wider passage has a timed closure; an unmeasured passage stays unknown.

[Open the demo](https://hyunsikparker.github.io/constraint-clerk/). No login is needed.

## What has been verified

On October 3, 2026, one real Sanity Content Agent conversation read the project's Context Knowledge Base and called `check_plan`. That tool retrieved the structured records through a separate Context MCP endpoint before calculating the result. The response cited the current **690 mm** north-passage clearance and its explicit supersession of the September **940 mm** claim. The **880 mm** unfolded cart was correctly blocked.

The conversation made four model requests and four agent tool calls: two KB reads and two plan checks. It stayed within the one-conversation permit. The actual answer, result and retrieval trace are preserved in [`src/recorded-verification.json`](src/recorded-verification.json). They are not a simulated answer or a newly executed request.

The public static demo offers that recorded verification and interactive local examples. **It does not run live inference.** Changing a plan clears the recording. The folded and missing-measurement examples are local deterministic checks, not additional model evaluations. The source pane shows the matching original records.

Local tests cover 21 cases. Type checking and the production build pass. This is a small integration demonstration, not an accuracy benchmark across arbitrary plans.

## Run the local checker

Use Node.js 22.12 or later:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev
```

Open `http://127.0.0.1:5289`. The original plan is blocked. The folded alternative finishes at 18:10 with two crew members. The west route cannot be approved without a width measurement.

## How the agent uses Sanity

Sanity project **`r7tbo2j3`**, dataset **`production`**, contains 19 original fictional documents: 11 source records and eight dated constraints. The separate `studio/` package defines two document types. References connect routes to passages, measurements to their targets, and current claims to the claims they explicitly supersede.

The Knowledge Base was built from those records. One read-only Context endpoint exposes only that KB; another exposes only this dataset's `ccSource` and `ccClaim` records. The agent gets KB orientation with `knowledge_base_read`. Its custom `check_plan` tool calls Context's `groq_query`, restores any outlined reference arrays with `array_field_reader`, validates the typed records and runs the deterministic checker. Built-in model read, write and web-search capabilities are disabled.

Array outlines are not treated as complete facts. The adapter checks document IDs, field names, array counts, returned indices and cropping flags before accepting a canonical reference array. Missing or truncated values fail closed. Saved records were read back and matched the full typed-content hash of the original seed.

The result depends on relationships and conditions: explicit supersession, cart state, route membership, preparation time, crew availability and half-open closure intervals. A newer date alone does not erase a conflicting claim. An absent width is not zero, and unknown is not feasible.

## Reproduce the cloud integration

Use a separate Sanity project and your own account. The recorded demo needs no credentials; a new live run does.

1. Create a `production` dataset. Keep an Editor token scoped to that new project. Bootstrap seeding needs only `projectId`, `dataset` and `contentAgentToken` in a private JSON file outside this repository. Set `CONSTRAINT_CLERK_CREDENTIAL_FILE` to that file and run `npm run seed`. Seeding uses `createIfNotExists` and verifies full typed-content readback.
2. In `studio/`, run `npm ci --ignore-scripts`. Set `SANITY_STUDIO_PROJECT_ID` to your new project ID. Sign in through the official Sanity CLI with an account allowed to deploy schemas, then run `npm run deploy:schema`. The runtime Editor token is not expanded to gain schema-deployment permissions.
3. Register the Studio through the CLI's external-URL option for `http://localhost:3333`, start it with `npm run dev -- --port 3333`, and open it once. This registers the application and live manifest without uploading a hosted Studio. Read the actual application key from the Content Agent application list; do not guess it from the project ID.
4. Enable Context, build a KB from this dataset, and create two separately scoped MCP endpoints: KB-only and dataset-only. The dataset source filter is `_type in ["ccSource", "ccClaim"] && _id match "cc-*"`. Use a Context Viewer token for the MCP connection.
5. Complete the private credential file with the shape below. Keep the parent directory mode 0700 and the file mode 0600. Never commit tokens or put them in a public URL.

```json
{
  "organizationId": "YOUR_ORGANIZATION_ID",
  "projectId": "YOUR_PROJECT_ID",
  "dataset": "production",
  "applicationKey": "YOUR_ACTUAL_APPLICATION_KEY",
  "knowledgeBaseId": "YOUR_KB_ID",
  "kbEndpoint": "https://api.sanity.io/v1/context/organizations/YOUR_ORGANIZATION_ID/mcp/YOUR_KB_ENDPOINT",
  "dataEndpoint": "https://api.sanity.io/v1/context/organizations/YOUR_ORGANIZATION_ID/mcp/YOUR_DATA_ENDPOINT",
  "contextToken": "YOUR_CONTEXT_VIEWER_TOKEN",
  "contentAgentToken": "YOUR_PROJECT_EDITOR_TOKEN"
}
```

Before inference, read the account's actual included-credit and paid-overage state. A fresh mode-0600 permit outside the repository must contain:

```json
{
  "purpose": "constraint-clerk-live-falsifier",
  "cashLimitUsd": 0,
  "paidOveragesAllowed": false,
  "includedCreditsRemaining": 1000,
  "observedAt": "FRESH_UTC_TIMESTAMP",
  "expiresAt": "FUTURE_UTC_TIMESTAMP",
  "maxConversations": 1,
  "maxAgentToolCalls": 4,
  "maxSteps": 4,
  "evidenceRef": "YOUR_ACTUAL_USAGE_READBACK_REFERENCE"
}
```

Replace the example credit count and timestamps with observed values. Set `CONSTRAINT_CLERK_LIVE_PERMIT_FILE` to that file and `CONSTRAINT_CLERK_PROBE_RECEIPT_FILE` to a new private receipt path outside the repository. `npm run agent:probe` consumes the permit before inference and writes the verification receipt. To use the local interface instead, run `npm run agent:serve` alongside `npm run dev`.

A conversation allows at most four model requests and four agent tool calls, with a 90-second deadline, no SDK retries and a 512 KiB limit per model response. The provider has no token-output cap, so none is claimed. The durable `.used` file consumes the attempt even if it fails; deleting it to retry defeats the budget guard. The server binds only to `127.0.0.1:5290`, checks the local origin and does not return credentials. There is no public model endpoint.

## Limits, cost and security

These records are invented. This is not a real venue inspection or safety approval. The checker can still be incomplete if the original sources omit a constraint.

The KB has one reviewed, unresolved issue: its derived east-passage entry omits a closure interval present in the original structured source. That issue has not been dismissed as resolved. Exact measurements, dates, references and closure intervals come from the validated dataset, not generated KB prose or citation labels.

The new project was automatically placed on a **USD0 Growth Trial**, with automatic downgrade to Free after 30 days. Only Free-included features were used. No paid upgrade, hosting, dependency or overage was purchased. Immediately after the verified conversation, the usage screen still displayed 0/1,000 credits and USD0; the consumed credit count had not been reflected and is **not verified as zero**. The account's paid overages remained disallowed. No further model attempts were made.

The production dependency audit reports two low-severity notices through `content-agent`'s older `@ai-sdk/provider-utils` dependency ([GHSA-866g-f22w-33x8](https://github.com/advisories/GHSA-866g-f22w-33x8)). The transport bounds response bodies and reassembles fragmented UTF-8 SSE lines before the provider reads them. Those safeguards are tested; they do not patch the dependency.

The separate Studio/CLI tree reports 12 advisories: seven high and five moderate. Four compatible patches reduced the initial total of 20. Remaining chains include [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and an older UUID dependency. The authoring workflow uses this project's trusted schema and patterns, not untrusted imports. No all-clean audit is claimed.

## Authorship and sources

**Fully Autonomous AI build.** Codex generated and revised the implementation, fictional records and documentation. No human coding or venue experience is claimed. The public verification is an actual Content Agent response, not an editorial reconstruction.

The integration uses the official [Context MCP](https://www.sanity.io/docs/ai/sanity-context-mcp), [Knowledge Base](https://www.sanity.io/docs/ai/sanity-context-create-knowledge-base) and [Content Agent](https://reference.sanity.io/content-agent/) interfaces. Original code and fictional content are MIT licensed.
