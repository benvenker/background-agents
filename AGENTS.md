# AGENTS.md

Instructions for Codex agents working in this repository.

## Scope

- This file applies to the full repository rooted at
  `/Users/ben/code/poolside/agentic/background-agents`.
- Follow direct user instructions first, then this file.

## Session Startup

1. Run memory context first:
   - `cm context "<task/question>" --json`
2. If prior decisions may matter, search prior sessions:
   - `cass search "<query>" --limit 5`
   - Use `--json` when output will be parsed.
3. If `cm` or `cass` are unavailable, continue and note the limitation briefly.

## Tooling Priority

- Prefer MCP tools when available.
- CLI fallback order:
  - `rg` / `rg --files` for search and file discovery
  - repository scripts in `scripts/`
  - package manager scripts from `package.json`
- Avoid broad or slow scans when targeted `rg` queries are sufficient.

## Beads Rust (`br`) Workflow

`br` is the source of truth for issue lifecycle in this repo.

Policy:

- Use `br` for create/update/close/deps/sync operations.
- Use `bv` for graph-aware triage and planning.
- Do not use `bd` in this repository.

Essential commands:

```bash
br ready --json
br list --status open
br show <id>
br create --title "..." --type task --priority 2 --description "..."
br update <id> --status in_progress
br close <id> --reason "Completed"
br sync --flush-only
```

Workflow pattern:

1. Start: `br ready --json` (or `bv --robot-next --format toon`).
2. Claim: `br update <id> --status in_progress --assignee <agent-name>`.
3. Work: implement only scoped task changes.
4. Complete: `br close <id> --reason "Completed"`.
5. Sync: `br sync --flush-only` before final commit/push.

Committing `.beads/` changes:

- Commit: `.beads/config.yaml`, `.beads/metadata.json`, `.beads/issues.jsonl`,
  `.beads/interactions.jsonl`, `.beads/.gitignore`.
- Do not commit: SQLite runtime files (`*.db`, `*.db-wal`, `*.db-shm`), lock files, `last-touched`.

## Beads Viewer (`bv`) Sidecar

`bv` is for dependency-aware analysis, not lifecycle mutation.

Rules:

- Use only `--robot-*` commands in automation.
- Never run bare `bv` from agents because it opens an interactive TUI.
- Start triage with `bv --robot-triage --format toon` or `bv --robot-next --format toon`.

Common robot commands:

```bash
bv --robot-next --format toon
bv --robot-triage --format toon
bv --robot-plan --format toon
bv --robot-insights --format toon
```

Fallback if `bv` is unavailable:

- `br ready --json`
- `br show <id>`

## MCP Agent Mail Workflow

Use MCP Agent Mail for agent coordination (claim broadcasts, file reservations, completion notices).

Operational protocol:

1. Register fixed identity for this repo:
   - `ensure_project(project_key="/Users/ben/code/poolside/agentic/background-agents")`
   - `register_agent(..., name="<fixed agent name>")`
2. Claim bead in `br` before edits:
   - `br update <bead-id> --status in_progress --assignee <agent-name>`
3. Reserve files before editing:
   - `file_reservation_paths(project_key, agent_name, paths=[...], exclusive=true, ttl_seconds=3600, reason="<bead-id>: ...")`
4. Send start update with `send_message` once recipients are known.
5. On completion:
   - `release_file_reservations(...)`
   - `br close <bead-id> --reason "Completed"`
   - completion message to interested agents
   - `br sync --flush-only`

Guardrails:

- Do not use `create_agent_identity` unless explicitly requested.
- If reservation conflicts occur, narrow path scope or pick another ready bead.

## Swarm Launcher

Use the shared swarm launcher script:

- `/Users/ben/code/poolside/console-cli/scripts/beads-swarm`

Recommended invocation for this repo:

```bash
/Users/ben/code/poolside/console-cli/scripts/beads-swarm background-agents \
  --claude 0 --codex 4 --gemini 0 \
  --names "RedStone,GreenCastle,PurpleBear,BlueLake"
```

Useful options:

- `--stagger <seconds>`: delay first-claim attempts to reduce collisions.
- `--launch-delay <seconds>`: delay between pane launches.
- `--template <path>`: custom Agent Mail bootstrap template.
- `--attach` / `--detach`: attach behavior after launch.

Notes:

- Keep session name `background-agents` unless intentionally using a separate project/session.
- Generated per-agent prompts are written under `/tmp/beads-swarm-prompts/<session>/`.

## Repo-Aware Guardrails

- Read `README.md` and `CLAUDE.md` for architecture/deployment details before infra changes.
- For Terraform work, use environment-specific files under:
  - `terraform/environments/production/`
- Do not deploy Modal by targeting `src/app.py` directly; use the documented deploy entrypoints.
- Keep changes minimal and scoped to the user request.

## Editing Rules

- Preserve existing style and naming conventions.
- Do not refactor unrelated code.
- Do not revert user-authored or unrelated working tree changes.
- Add comments only when they clarify non-obvious logic.

## Validation

- Run the smallest relevant checks for touched code.
- If full validation is too expensive, run targeted checks and state what was not run.
- Prefer reproducible commands and include exact command strings in summaries.

## Response Expectations

- Be concise and action-oriented.
- Report:
  - what changed,
  - where it changed,
  - what validation was run,
  - any follow-up risk or next step.

## Memory Wrap-Up

Before final response, store a useful workflow memory:

- `cm add "<decision/result/user preference>" --category workflow --json`
