# Development Standard

## Non-negotiable rules

- Preserve per-user isolation. Every note, tag, attachment, Kanban board, column, card, and backup operation must be authorized with the authenticated `userId` on the server.
- Keep credentials, private keys, local databases, backups, browser state, test captures, and generated deployment state out of Git.
- Validate untrusted request and backup data at the server boundary. Use Zod for structured payloads.
- Keep source comments and application UI copy in English.
- Use the existing SvelteKit, Svelte 5, Drizzle, Better Auth, D1, and R2 patterns before adding dependencies or abstractions.
- Do not push, deploy, mutate production data, or change remote infrastructure without explicit user authorization.
- Do not overwrite unrelated work in a dirty worktree.

## Toolchain

| Area | Standard |
| --- | --- |
| Package manager | npm with the committed `package-lock.json` |
| Language | Strict TypeScript and Svelte 5 |
| Application | SvelteKit 2 with `@sveltejs/adapter-cloudflare` |
| Runtime | Cloudflare Workers with `nodejs_compat` |
| Database | Cloudflare D1 through Drizzle ORM |
| Object storage | Cloudflare R2 |
| Authentication | Better Auth with GitHub OAuth and the passkey plugin |
| Validation | Zod |
| Unit tests | Vitest |
| Static checks | ESLint and `svelte-check` |
| Formatting | Prettier, 2 spaces, single quotes, semicolons, 120 column target |

Agent runtime note: when the active repository instructions require RTK, prefix every terminal command with `rtk`. RTK is an agent-side wrapper, not an application dependency. Use `apply_patch` for deliberate manual edits.

## Local setup

Requirements are Node.js, npm, a GitHub OAuth application, and local Cloudflare tooling installed through the project dependencies.

```sh
npm install
cp .env.example .env
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

The local OAuth callback is:

```text
http://localhost:5173/api/auth/callback/github
```

Required private variables:

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth application identifier |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth application secret |
| `BETTER_AUTH_SECRET` | Long secret used to sign authentication state |
| `BETTER_AUTH_URL` | Canonical application origin |

Vite reads `.env`; Wrangler reads `.dev.vars`. Real values belong only in ignored local files or Cloudflare secrets. Never put real values in examples, documentation, source, commits, screenshots, logs, or issue text.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run check` | Sync SvelteKit and run Svelte/TypeScript diagnostics |
| `npm run lint` | Run ESLint |
| `npm test` | Run all Vitest tests once |
| `npm run build` | Build the production Worker bundle |
| `npm run preview` | Preview the production build |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run db:migrate:prod` | Apply D1 migrations remotely; requires explicit authorization |
| `npm run cf:typegen` | Refresh Cloudflare binding types |
| `npm run deploy` | Build and deploy; requires explicit authorization |

## Repository boundaries

- `src/routes/` owns pages and HTTP route handlers.
- `src/lib/components/` owns reusable Svelte UI.
- `src/lib/markdown.ts` owns the pure Markdown parser, title/tag derivation, rendering, and task mutation shared by server workflows and local browser demos.
- `src/lib/server/` owns server-only domain logic and must not be imported into browser code.
- `src/lib/backup.ts` owns browser-side backup encryption and decryption.
- `src/db/schema.ts` is the database schema source of truth.
- `src/lib/types.ts` owns DTOs shared across the server and UI.
- `src/styles/global.css` is the current visual token and component-style source of truth.
- `migrations/` contains committed D1 migrations and Drizzle metadata.
- `public/` contains the exported Fresh logo, favicon, maskable icon set, and web manifest.
- `tests/` contains unit coverage for pure domain logic.

Keep route handlers thin. Parse requests, verify authentication and bindings, delegate to `src/lib/server/`, and convert expected failures into explicit HTTP responses.

## TypeScript and Svelte

- Keep `strict` TypeScript compatibility and avoid `any` unless a framework boundary genuinely requires it.
- Use Svelte 5 runes and the patterns already present: `$props`, `$state`, `$derived`, and `$effect`.
- Keep effects narrowly scoped and clean up timers, animation frames, and listeners.
- Prefer typed callback props for component communication. Do not introduce a global store for local page state.
- Use keyed `{#each}` blocks for persistent records.
- Keep browser-only APIs inside browser-executed functions or effects.
- Use semantic HTML, accessible names, `aria-*` states, and visible focus styling.
- Use Lucide Svelte icons for familiar actions. Do not add hand-drawn inline SVG icons when Lucide has an equivalent. Product artwork and the sine-wave scene are exceptions.
- Preserve stable element dimensions so icons, loading labels, counts, and hover states do not shift layout.

## API and data rules

- Authentication is established in `src/hooks.server.ts`; `/app` redirects anonymous users to `/login` and protected APIs return `401`.
- Keep passkey registration session-bound. GitHub OAuth establishes the account before a user can register a passkey.
- Passkey changes must preserve WebAuthn relying-party derivation from the canonical `BETTER_AUTH_URL` and require HTTPS outside localhost.
- Never trust an ID by itself. Query owned records with both record ID and `locals.user.id`.
- Never expose raw R2 keys to clients. DTOs expose authenticated application URLs.
- Parse JSON bodies and imported manifests with Zod. Maintain current maximum lengths unless a product decision explicitly changes them.
- Keep note creation and updates responsible for deriving titles, rendering Markdown, and synchronizing tags.
- Keep Kanban board, column, and card reads and writes scoped by both the record ID and the authenticated `userId`.
- Validate Kanban names and card descriptions at the API boundary. Board creation seeds `To do`, `In progress`, and `Done`; card moves are re-indexed by the server.
- Keep Kanban board, column, and card reads and writes scoped to the authenticated user; moving a card must also verify that the target column belongs to the same owned board.
- When deleting a note, remove its R2 objects as well as its D1 data.
- When a D1 write fails after an R2 upload, delete the uploaded object to avoid orphaned files.
- Use migrations for schema changes. Do not edit deployed D1 schema manually.
- Update `src/lib/types.ts`, schema, domain logic, route validation, migrations, backup behavior, and tests together when a persisted contract changes.

## Markdown invariants

- Raw HTML remains disabled.
- The first valid parsed H1 is the note title and is omitted from the rendered note body.
- If no H1 exists, derive a title from the first text block; otherwise use `Untitled note`.
- Keep title length at 120 characters and note content at 1,000,000 characters unless the entire contract is intentionally migrated.
- Tags come from `#name` syntax. Ignore fenced code and blockquotes during tag extraction.
- Rendered saved-note tasks are interactive. A checkbox update must modify the corresponding Markdown marker on the server, re-render the note, and preserve nested or ordered-list indexing.
- Preview task inputs are disabled because preview is not saved-note state.
- KaTeX runs with `trust: false` and non-throwing parse behavior.

## Attachment invariants

- Maximum attachment size is 95 MiB.
- Require a known positive content length and enforce the size while streaming to R2.
- Sanitize path separators and control characters from filenames; keep normalized names at or below 180 characters.
- Preserve the current kinds: image, audio, video, PDF, text, document, archive, and other.
- Authenticated attachment delivery supports `GET`, `HEAD`, private caching, ETags, and single byte ranges for media seeking.
- Import uploads must exactly match the byte size declared in the validated backup manifest.

## Backup invariants

- The file extension is `.freshup` and the compatibility magic is `FRESHUP1`.
- Encryption happens in the browser with AES-256-GCM.
- Keys are derived with PBKDF2-SHA-256, a random 16-byte salt, a random 12-byte IV, and currently 310,000 iterations.
- Export requires a password of at least 8 characters. Passwords are not sent to the server or stored in the archive.
- Browser import is capped at 512 MiB. Backup manifest requests are capped at 10 MiB.
- Validate all manifest relationships and file sizes before restoring.
- Preserve both merge and replace modes. Imported IDs are remapped to new IDs owned by the current user.
- A backup format change requires a schema version decision, compatibility tests, and documentation updates.
- Kanban backup data is exported in schema version 2. Imports must continue accepting version 1 manifests and remap board, column, and card IDs for the current user.

## Security and open-source hygiene

The following are intentionally ignored: `.env*` except examples, `.dev.vars*` except examples, local database files, `.freshup`, keys and certificates, `.wrangler/`, `.playwright-cli/`, `output/`, `coverage/`, caches, logs, and build output.

Before committing:

1. Review `git status --short`, including unexpected untracked files.
2. Run a tracked-file secret scan for known credentials and common private-key markers.
3. Confirm generated screenshots, browser state, OAuth credentials, and local backups remain ignored.
4. Use `git diff --check` and inspect the staged diff.

If a secret is ever tracked, do not merely add it to `.gitignore`; remove it from the index and rotate it.

## Verification standard

For every code change, run the smallest relevant test during development. Before handoff or commit, the normal full gate is:

```sh
npm run check
npm run lint
npm test
npm run build
```

For UI changes, also verify with a real browser:

- Desktop light theme.
- Desktop dark theme.
- Mobile at approximately `390x844`.
- No horizontal overflow, clipping, overlap, or unexpected layout shift.
- Keyboard focus, disabled, loading, empty, error, and reduced-motion behavior where relevant.
- For animation, inspect computed movement or screenshots rather than relying only on source review.

Add or update tests when changing Markdown parsing, title derivation, task mutation, attachments, backup cryptography, manifest validation, or other pure domain logic. Broaden coverage when changing shared contracts.

## Git standard

- Commit messages use `type(scope): description`, for example `feat(notes): persist rendered tasks`.
- Common types are `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, and `build`.
- Agent-created commits for this repository use `BackRunner <dev@backrunner.top>` when the user requests repository commits.
- Split commits by coherent concern. Do not mix generated output, credentials, or unrelated cleanup.
- Do not rewrite existing history, force-push, or bypass hooks without explicit authorization.

## Definition of done

A change is done when behavior is implemented end to end, server ownership and validation remain correct, light/dark and responsive UI are coherent when touched, relevant tests exist, the full verification gate passes, secrets and outputs remain untracked, and affected `.agents/` documentation is current.
