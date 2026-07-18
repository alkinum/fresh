# Architecture

## System shape

Fresh is a server-rendered SvelteKit application built into a Cloudflare Worker. It uses one application origin for pages, authentication, JSON APIs, and authenticated attachment delivery.

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Browser UI | Svelte 5 components | Editing, filtering loaded notes, previews, attachment selection, backup encryption |
| SvelteKit server | Page loads and API handlers | Authentication gates, validation, orchestration, HTTP responses |
| Domain services | `src/lib/server/` | Notes, tags, Markdown, attachments, backups, upload enforcement |
| Authentication | Better Auth | GitHub OAuth, sessions, account linking, SvelteKit cookies |
| Relational data | Cloudflare D1 and Drizzle | Users, sessions, notes, tags, relations, attachment metadata |
| Object data | Cloudflare R2 | User attachment bytes |
| Static assets | Worker static asset binding | Logo, icons, manifest, generated client assets |

Cloudflare bindings are `DB`, `ATTACHMENTS`, and `ASSETS`. The Worker uses smart placement, logs, and sampled traces as configured in `wrangler.jsonc`.

## Request flow

1. `src/hooks.server.ts` creates Better Auth from the request's D1 binding and loads the current session.
2. The hook stores the user and session in `event.locals`.
3. Protected page loads redirect anonymous users to `/login`.
4. Protected APIs reject missing authentication or required bindings.
5. Route handlers validate inputs and call server domain functions.
6. Domain functions always scope reads and writes to the authenticated user.
7. DTOs return ISO date strings, rendered Markdown, tag summaries, attachment metadata, and authenticated attachment URLs.

## Data model

Better Auth owns `user`, `session`, `account`, `verification`, and `passkey` tables. Email/password sign-in is disabled; GitHub is the trusted social provider.

Fresh owns:

| Table | Key fields | Notes |
| --- | --- | --- |
| `notes` | `id`, `userId`, `content`, derived `title`, derived `renderedContent`, favorite and color state | Cascades when its user is removed |
| `tags` | `id`, `userId`, `name`, deterministic color, last-note timestamp | Tags are extracted from note Markdown |
| `note_tags` | Composite `noteId`, `tagId` | Rebuilt when note content changes |
| `attachments` | `id`, `noteId`, `userId`, private `r2Key`, file metadata and kind | Indexed by note and user; bytes live in R2 |

The schema is in `src/db/schema.ts`. Two migrations currently establish authentication and attachment storage. Schema changes must be represented by new migrations.

## Pages and APIs

| Route | Behavior |
| --- | --- |
| `/login` | GitHub OAuth entry, disabled configuration state, animated Fresh brand scene |
| `/` | Authenticated notebook workspace; first page loads 30 notes and all tag summaries |
| `GET /api/notes` | Paginated notes filtered by favorite or tag |
| `POST /api/notes` | Create a note from Markdown content |
| `GET /api/notes/:id` | Return one owned note |
| `PATCH /api/notes/:id` | Update content, color, favorite, or one rendered task state |
| `DELETE /api/notes/:id` | Delete the note and its R2 attachments |
| `POST /api/notes/:id/attachments` | Stream one owned-note attachment to R2 |
| `GET /api/tags` | Return the current user's tag list and counts |
| `POST /api/markdown` | Render authenticated editor preview HTML |
| `GET/HEAD /api/attachments/:id` | Serve an owned attachment, including byte-range delivery |
| `DELETE /api/attachments/:id` | Delete owned attachment bytes and metadata |
| `GET /api/backup` | Return the current user's backup manifest |
| `POST /api/backup` | Validate and stage a merge or replace import |
| `PUT /api/backup/attachments/:id` | Upload one imported attachment with exact size enforcement |

## Notes and Markdown flow

The client sends Markdown content, not a separate title. `createNote` and `updateNote` derive the title, render the body, synchronize tags, and persist all three representations.

Title behavior:

1. Parse Markdown with the same configured Markdown-It instance used for rendering.
2. Use the first non-empty H1, including setext H1 syntax.
3. Remove only that title heading from the rendered card body.
4. Fall back to the first meaningful text block or `Untitled note`.

Rendering supports line breaks, linkification, typographic substitutions, emoji, GitHub alerts, tables, KaTeX, task lists, and syntax highlighting for Bash, CSS, Go, JavaScript, JSON, Markdown, Python, Rust, TypeScript, XML, and YAML. Raw HTML is escaped.

Saved-note task inputs receive stable parsed indexes. A checkbox request sends an index and target state; the server locates the source line through parsed token mapping, changes only its `[ ]` or `[x]` marker, and runs the normal note update pipeline again.

## Query and state behavior

- Notes are ordered by favorite state and then most recent update.
- The initial and API default page size is 30; server limits cannot exceed 100.
- Favorite and tag filters are server queries.
- The search field is client-side and searches only notes currently loaded into the page state, including title, content, tag names, and attachment filenames.
- Tags are created and related automatically from Markdown. There is no separate tag-management UI.
- Editing reuses the top composer; saving updates the local list and refreshes tag summaries.

## Attachment flow

The composer keeps selected files locally until the note exists. On save, it creates or updates the note and uploads each pending file to `/api/notes/:id/attachments`.

The server validates ownership, filename, content length, and 95 MiB maximum. It streams bytes to a user/note-scoped R2 key, then records metadata in D1. If metadata insertion fails, the R2 object is removed.

Presentation depends on classified kind:

- Images render inline and link to the original.
- Audio and video use native media controls.
- PDFs expand into an iframe with open, download, and delete actions.
- Text, office documents, archives, and other files use styled download rows.

Authenticated attachment responses support byte ranges so audio and video seeking works without public R2 access.

## Backup flow

Export is split between server and browser:

1. The server returns a manifest containing only the authenticated user's notes, tags, relations, and attachment URLs.
2. The browser downloads each authenticated attachment.
3. The browser creates a ZIP containing `manifest.json` and attachment files.
4. The browser encrypts the ZIP and downloads a `.freshup` file.

Import reverses the flow:

1. The browser validates the `FRESHUP1` header, derives the key, decrypts, unzips, and checks attachment sizes.
2. The server validates the manifest and creates remapped records for the current user.
3. The server returns private import upload targets.
4. The browser uploads each attachment with exact size enforcement.
5. Replace mode removes the user's former notes, tags, and R2 attachment objects after new records are staged; merge mode keeps them.

## Deployment

`svelte.config.js` maps public assets from `public/` and uses the Cloudflare adapter. `wrangler.jsonc` points the Worker entry to `.svelte-kit/cloudflare/_worker.js`, a D1 database named `fresh`, and an R2 bucket named `fresh-attachments`.

Production setup requires OAuth credentials, a Better Auth secret, the canonical production `BETTER_AUTH_URL`, the correct GitHub callback, migrated D1 schema, and the R2 bucket. Secrets are configured outside Git.
