# Epic: `EXT-EPIC-001` — Open-Inspect Chrome Extension (MVP + Enterprise Rollout Path)

## Summary

Build a first-party Chrome extension client for Open-Inspect with:

1. Side Panel chat and session controls.
2. DOM + React-internals context capture (React Grab pattern), with deterministic truncation and
   optional screenshot fallback.
3. Extension-specific auth and web proxy APIs.
4. Correct prompt source attribution (`source: "extension"`) in HTTP and WebSocket flows.
5. Internal managed-install rollout first, then update-server/CRX path for enterprise distribution.

This plan is structured as one epic with atomic child beads designed for dependency-aware execution
by AI agents.

## Current-State Facts Locked In (Repo-Verified)

1. No extension package exists yet under
   `/Users/ben/code/poolside/agentic/background-agents/packages/`.
2. `MessageSource` already includes `"extension"` in
   `/Users/ben/code/poolside/agentic/background-agents/packages/shared/src/types.ts` and
   `/Users/ben/code/poolside/agentic/background-agents/packages/control-plane/src/types.ts`.
3. HTTP prompt path already accepts caller `source` via `/sessions/:id/prompt` in
   `/Users/ben/code/poolside/agentic/background-agents/packages/control-plane/src/router.ts`.
4. WebSocket prompt path currently hardcodes `source: "web"` in
   `/Users/ben/code/poolside/agentic/background-agents/packages/control-plane/src/session/durable-object.ts`.
5. Web app prompt route hardcodes `source: "web"` in
   `/Users/ben/code/poolside/agentic/background-agents/packages/web/src/app/api/sessions/[id]/prompt/route.ts`.
6. Control plane requires internal auth; extension must go through web-owned `/api/extension/*`
   proxy routes.
7. `cass` now works with approved permissions; no relevant prior-session decisions found for this
   feature.

## Public API / Interface Changes

1. Add extension JWT env contract: `EXTENSION_JWT_SECRET` in web runtime and Terraform wiring.
2. Add extension API surface in web package:
   - `POST /api/extension/token`
   - `GET /api/extension/me`
   - `GET /api/extension/repos`
   - `POST /api/extension/sessions`
   - `POST /api/extension/sessions/:id/prompt`
   - `POST /api/extension/sessions/:id/ws-token`
3. Extend prompt attachment contract to support structured extension context safely (typed JSON
   context payload, strict size cap, deterministic truncation marker).
4. Extend WS `prompt` client message schema to allow optional `source?: MessageSource` (default
   remains `"web"` when absent).
5. Persist incoming WS source value in DO enqueue path and logs.

## Delivery DAG (Bead Order)

1. `EXT-001` and `EXT-002` start first.
2. `EXT-003` depends on `EXT-002`.
3. `EXT-004` depends on `EXT-001`.
4. `EXT-005` depends on `EXT-004`.
5. `EXT-006` depends on `EXT-004`.
6. `EXT-007` depends on `EXT-003` and `EXT-006`.
7. `EXT-008` depends on `EXT-005`.
8. `EXT-009` depends on `EXT-002`.
9. `EXT-010` depends on `EXT-009` and `EXT-007`.
10. `EXT-011` depends on `EXT-009`.
11. `EXT-012` depends on `EXT-009` and `EXT-011`.
12. `EXT-013` depends on `EXT-010` and `EXT-012`.
13. `EXT-014` depends on `EXT-003`, `EXT-007`, `EXT-010`, and `EXT-012`.
14. `EXT-015` depends on `EXT-010` and `EXT-014`.

---

## Child Beads (Atomic, Agent-Ready)

### `EXT-001` — Extension Contract Spec Freeze

- Parent: `EXT-EPIC-001`
- Depends on: none
- Goal: lock canonical request/response shapes, auth claims, and size limits before implementation.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/docs/extension-contract.md` (new)
- Implementation:
  1. Define extension JWT claims (`sub`, `login`, `name`, `email`, `iat`, `exp`, `aud`).
  2. Define context attachment JSON schema and max serialized size `64KB`.
  3. Define failure/error code mapping for `/api/extension/*`.
- Acceptance:
  1. All downstream beads reference this spec as source of truth.
  2. Explicit examples for prompt payloads, ws-token requests, and truncation marker.
- Validation:
  1. Human review checklist in doc includes auth, payload, and failure-mode sections.

### `EXT-002` — Shared Types: WS Source + Structured Context Attachments

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-001`
- Goal: make types enforce extension source and structured context payloads.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/shared/src/types.ts`
  - `/Users/ben/code/poolside/agentic/background-agents/packages/control-plane/src/types.ts`
- Implementation:
  1. Add optional `source?: MessageSource` to WS `prompt` message type.
  2. Expand `Attachment` typing to include structured context payload shape with `mimeType` and
     `content`.
  3. Keep backward compatibility for existing `file|image|url`.
- Acceptance:
  1. Typecheck passes for shared, control-plane, and web packages.
  2. No runtime behavior changes yet.
- Validation:
  1. `npm run typecheck -w @open-inspect/shared`
  2. `npm run typecheck -w @open-inspect/control-plane`
  3. `npm run typecheck -w @open-inspect/web`

### `EXT-003` — Control-Plane WS Prompt Source Persistence

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-002`
- Goal: persist WS prompt `source` correctly (extension vs web).
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/control-plane/src/session/durable-object.ts`
  - `/Users/ben/code/poolside/agentic/background-agents/packages/control-plane/test/integration/websocket-client.test.ts`
- Implementation:
  1. Update WS prompt handler to read `data.source ?? "web"`.
  2. Persist source in `createMessage`.
  3. Log actual source in `prompt.enqueue` events.
  4. Add integration tests for WS prompt with `source: "extension"` and default fallback behavior.
- Acceptance:
  1. DB message row source is `"extension"` when sent by extension client.
  2. Existing web WS behavior remains unchanged.
- Validation:
  1. `npm run test:integration -w @open-inspect/control-plane -- websocket-client.test.ts`

### `EXT-004` — Web Extension Auth Primitives (JWT Issue/Verify)

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-001`
- Goal: create secure, reusable auth utility for `/api/extension/*`.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/web/src/lib/extension-auth.ts`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/web/.env.example`
- Implementation:
  1. Implement token issuer with `EXTENSION_JWT_SECRET`.
  2. Implement bearer verifier with strict claim checks and expiration handling.
  3. Add typed helper for extracting extension user identity from request headers.
- Acceptance:
  1. Invalid/missing/expired token paths are deterministic and return 401.
  2. Utility is consumed by all extension API routes.
- Validation:
  1. Add unit tests in
     `/Users/ben/code/poolside/agentic/background-agents/packages/web/src/lib/extension-auth.test.ts`
     (new).
  2. Run `npm run test -w @open-inspect/web`.

### `EXT-005` — `/api/extension/token` and `/api/extension/me`

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-004`
- Goal: complete pairing bootstrap and identity introspection.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/web/src/app/api/extension/token/route.ts`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/web/src/app/api/extension/me/route.ts`
    (new)
- Implementation:
  1. `POST /token`: require NextAuth session and mint extension JWT.
  2. `GET /me`: require extension bearer token and return normalized user identity.
  3. Return `expiresAt` and API base metadata with token response.
- Acceptance:
  1. Unauthenticated web user cannot mint extension token.
  2. Extension token holder can call `/me`.
- Validation:
  1. Route tests for 200/401 cases.
  2. Manual curl smoke against local web app.

### `EXT-006` — Extension Proxy Routes for Repos and Session Creation

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-004`
- Goal: enable extension to list repos and create sessions through authenticated web proxy.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/web/src/app/api/extension/repos/route.ts`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/web/src/app/api/extension/sessions/route.ts`
    (new)
- Implementation:
  1. Verify extension bearer on each request.
  2. Proxy to control plane with `controlPlaneFetch`.
  3. Derive `userId/githubLogin/githubName/githubEmail` from extension token claims.
- Acceptance:
  1. Session created through extension route appears in existing web session list.
  2. Repo list matches `/api/repos` semantics.
- Validation:
  1. Route tests and manual API smoke.

### `EXT-007` — Extension Proxy Routes for Prompt + WS Token

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-003`, `EXT-006`
- Goal: wire full prompting lifecycle from extension to control plane.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/web/src/app/api/extension/sessions/[id]/prompt/route.ts`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/web/src/app/api/extension/sessions/[id]/ws-token/route.ts`
    (new)
- Implementation:
  1. Verify extension bearer.
  2. Prompt route proxies `source: "extension"` and typed attachments.
  3. WS-token route proxies user identity fields to control plane.
  4. Add strict payload validation and body size checks.
- Acceptance:
  1. Prompt rows are stored with source `extension`.
  2. Extension WS token can subscribe to existing session websocket.
- Validation:
  1. Control-plane integration smoke via web route path.
  2. Add regression tests for missing/invalid payloads.

### `EXT-008` — `/extension/connect` Pairing UX

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-005`
- Goal: give logged-in users a deterministic token handoff flow.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/web/src/app/extension/connect/page.tsx`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/web/src/app/layout.tsx` (if nav
    link added)
- Implementation:
  1. Render “Generate Extension Token” action.
  2. Call `/api/extension/token` and display token + expiry.
  3. Add copy UX and short operational instructions.
- Acceptance:
  1. Page works for authenticated users and blocks anonymous users.
  2. Generated token can be pasted into extension and used immediately.
- Validation:
  1. Manual browser test in local dev.

### `EXT-009` — Chrome Extension Package Scaffold

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-002`
- Goal: establish extension build/runtime skeleton in monorepo.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/package.json`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/manifest.config.ts`
    or `manifest.json` (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/vite.config.ts`
    (new)
- Implementation:
  1. Initialize Vite + React + `vite-plugin-web-extension`.
  2. Add MV3 side panel, background service worker, content scripts.
  3. Add scripts: `dev`, `build`, `package:zip`, `package:crx`.
- Acceptance:
  1. Extension builds and loads unpacked in Chrome.
  2. Side panel opens from extension action.
- Validation:
  1. `npm run build -w @open-inspect/chrome-extension` (new workspace package name).

### `EXT-010` — Extension Runtime Auth + API Client

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-009`, `EXT-007`
- Goal: implement persistent auth state and typed API client in extension runtime.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/src/background/index.ts`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/src/lib/api.ts`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/src/lib/storage.ts`
    (new)
- Implementation:
  1. Store token in `chrome.storage.local`.
  2. Implement API wrappers for `/api/extension/*`.
  3. Add token validation handshake via `/api/extension/me`.
- Acceptance:
  1. Token persistence survives browser restart.
  2. Invalid token state prompts reconnect UX.
- Validation:
  1. Manual side panel smoke and unit tests for storage/client helpers.

### `EXT-011` — Side Panel Chat MVP (Session and Prompt Flow)

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-009`
- Goal: deliver core side panel product flow.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/src/sidepanel/App.tsx`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/src/sidepanel/components/*`
    (new)
- Implementation:
  1. Add connection state, repo selector, session selector.
  2. Add model/reasoning selector.
  3. Add prompt composer and send action.
  4. Add WS stream display via ws-token route.
- Acceptance:
  1. User can create/reuse session and send prompt from side panel.
  2. Live events stream in panel.
- Validation:
  1. Manual E2E with local control plane + web app.

### `EXT-012` — DOM + React Internals Capture Pipeline

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-009`, `EXT-011`
- Goal: capture rich selected-context payload without default screenshot usage.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/src/content/bridge.ts`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/src/content/main-world.ts`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/src/lib/capture.ts`
    (new)
- Implementation:
  1. Integrate `react-grab` in main-world context.
  2. Build selection capture pipeline: bounds, DOM snippet, React metadata when available.
  3. Serialize to typed context attachment and enforce `64KB` cap with deterministic truncation
     metadata.
  4. Fallback to DOM-only payload on non-React pages.
- Acceptance:
  1. React page capture includes React metadata.
  2. Non-React capture still returns useful DOM payload.
  3. Oversized payload is deterministically truncated and marked.
- Validation:
  1. Unit tests for truncation logic.
  2. Manual capture tests on React and non-React sites.

### `EXT-013` — Screenshot Fallback (Optional, Non-Default)

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-010`, `EXT-012`
- Goal: provide optional visual backup context via `tabs.captureVisibleTab`.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/src/background/screenshot.ts`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/src/sidepanel/components/context-tray.tsx`
    (new/updated)
- Implementation:
  1. Add explicit “Include screenshot” toggle.
  2. Capture and attach compressed image only when user opts in.
  3. Preserve DOM/React payload as primary context path.
- Acceptance:
  1. Screenshot is off by default.
  2. Prompt still succeeds when capture permission denied.
- Validation:
  1. Manual permissions and fallback behavior checks.

### `EXT-014` — Infra and Env Wiring (`EXTENSION_JWT_SECRET`) + Docs

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-003`, `EXT-007`, `EXT-010`, `EXT-012`
- Goal: productionize secrets/config and operational docs.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/terraform/environments/production/variables.tf`
  - `/Users/ben/code/poolside/agentic/background-agents/terraform/environments/production/main.tf`
  - `/Users/ben/code/poolside/agentic/background-agents/terraform/environments/production/terraform.tfvars.example`
  - `/Users/ben/code/poolside/agentic/background-agents/packages/web/.env.example`
  - `/Users/ben/code/poolside/agentic/background-agents/docs/chrome-extension.md` (new)
- Implementation:
  1. Add `extension_jwt_secret` terraform variable.
  2. Inject `EXTENSION_JWT_SECRET` into web app environment variables.
  3. Document local dev, build, and internal rollout flow.
- Acceptance:
  1. Terraform plan shows new variable wired only where needed.
  2. Docs include pairing, permissions, and troubleshooting.
- Validation:
  1. `terraform validate` in production env.
  2. Docs reviewed for exact command reproducibility.

### `EXT-015` — Enterprise Packaging + Managed Install Rollout

- Parent: `EXT-EPIC-001`
- Depends on: `EXT-010`, `EXT-014`
- Goal: deliver managed internal distribution and update-server path.
- Primary files:
  - `/Users/ben/code/poolside/agentic/background-agents/packages/chrome-extension/scripts/package-crx.*`
    (new)
  - `/Users/ben/code/poolside/agentic/background-agents/docs/chrome-extension-enterprise-rollout.md`
    (new)
- Implementation:
  1. Add deterministic ZIP/CRX packaging workflow.
  2. Document update server manifest format and hosting requirements.
  3. Document Chrome enterprise policy (`ExtensionInstallForcelist`) rollout and rollback.
- Acceptance:
  1. Internal admin can force-install extension from managed policy.
  2. Update server artifact format is documented and tested in staging.
- Validation:
  1. Packaging command smoke.
  2. Enterprise test checklist signed off.

---

## Test Cases and Scenarios (Cross-Bead)

1. Unit: extension JWT issue/verify, claim validation, and expiry behavior.
2. Unit: capture payload truncation and deterministic truncation marker.
3. Unit: attachment schema validation rejects malformed context payloads.
4. Integration: WS prompt with `source: "extension"` persists source in message row.
5. Integration: HTTP prompt via `/api/extension/sessions/:id/prompt` persists source and
   attachments.
6. Integration: `/api/extension/*` rejects missing/invalid bearer tokens.
7. Extension E2E: connect token flow, repo/session load, prompt send, stream receive.
8. Extension E2E: React target capture and non-React fallback capture.
9. Extension E2E: optional screenshot capture path.
10. Regression: existing web and slack prompt flows unchanged.

## Explicit Assumptions and Defaults

1. Deployment remains single-tenant trusted internal org, consistent with current architecture.
2. MVP extension auth uses explicit token handoff through `/extension/connect`.
3. Default extension token TTL is short-lived (recommended: 8 hours).
4. MVP does not require Chrome Web Store publication.
5. Managed install is first rollout channel; update-server path is phase-2 within same epic.
6. MVP host access is broad enough for internal target apps; domain allowlisting can be tightened
   later.
7. PR creation from extension-created sessions is not guaranteed parity in v1 unless OAuth token
   forwarding is explicitly added later; prompting/capture/session workflows are prioritized.

## External References Used

1. Ramp extension guidance:
   [Why We Built Our Own Background Agent](https://builders.ramp.com/post/why-we-built-our-background-agent#:%7E:text=last%205%20minutes.-,Chrome%20extension,-To%20inspire%20usage)
2. React Grab repository: [github.com/aidenybai/react-grab](https://github.com/aidenybai/react-grab)
3. Chrome Side Panel API:
   [developer.chrome.com sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
4. Chrome captureVisibleTab:
   [tabs.captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab)
5. Beads hierarchy/dependencies model: [beads README](https://github.com/stevenyegge/beads)
