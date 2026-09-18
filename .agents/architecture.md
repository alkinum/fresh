# Architecture

## System shape

Fresh is a server-rendered SvelteKit application built into a Cloudflare Worker. It uses one application origin for pages, authentication, JSON APIs, and authenticated attachment delivery.

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Browser UI | Svelte 5 components | Editing, debounced search requests, previews, the local landing demo, attachment selection, backup encryption |
| SvelteKit server | Page loads and API handlers | Authentication gates, validation, orchestration, HTTP responses |
| Domain services | `src/lib/server/` | Notes, tags, Markdown, attachments, backups, upload enforcement |
| Authentication | Better Auth | GitHub OAuth, WebAuthn passkeys, sessions, account linking, SvelteKit cookies |
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

Better Auth owns `user`, `session`, `account`, `verification`, and `passkey` tables. Email/password sign-in is disabled; GitHub is the trusted social provider used to establish an account, and registered passkeys can create later sessions without GitHub.

Fresh owns:

| Table | Key fields | Notes |
| --- | --- | --- |
| `notes` | `id`, `userId`, `content`, derived `title`, derived `renderedContent`, favorite and color state | Cascades when its user is removed |
| `tags` | `id`, `userId`, `name`, deterministic color, last-note timestamp | Tags are extracted from note Markdown |
| `note_tags` | Composite `noteId`, `tagId` | Rebuilt when note content changes |
| `attachments` | `id`, `noteId`, `userId`, private `r2Key`, file metadata and kind | Indexed by note and user; bytes live in R2 |
| `backup_import_receipts` | `id`, `userId`, imported record counts, creation timestamp | Makes finalization retries idempotent while stale R2 sessions are cleaned |
| `kanban_boards` | `id`, `userId`, name, color, position | Private board summaries ordered per user |
| `kanban_columns` | `id`, `boardId`, `userId`, name, position | Ordered columns with cascade deletion from their board |
| `kanban_cards` | `id`, `boardId`, `columnId`, `userId`, title, description, position | Ordered cards; server re-indexes source and target columns on moves |
| `user_preferences` | `userId`, language, theme, accent | One preference record per account, cascading on user deletion |

The schema is in `src/db/schema.ts`. Seven migrations currently establish authentication, attachment storage, current Passkey metadata/index compatibility, Kanban storage, backup import receipts, per-user tag uniqueness, and account preferences. Schema changes must be represented by new migrations.

## Pages and APIs

| Route | Behavior |
| --- | --- |
| `/` | Public Fresh landing page and non-persistent interactive note demo for guests; authenticated users receive a server-side 303 redirect to `/app` |
| `/login` | Passkey and GitHub OAuth entry, disabled configuration states, animated Fresh brand scene |
| `/app` | Authenticated notes and Kanban workspace; first page loads 30 notes, tag summaries, and board summaries |
| `PATCH /api/account` | Validate and save the authenticated user's nickname and/or language, theme, and accent preferences |
| `PUT/DELETE /api/account/avatar` | Upload or remove the authenticated user's profile image |
| `GET /api/account/avatar/:id` | Privately serve an avatar from the authenticated user's R2 namespace |
| `GET /api/notes` | Paginated notes filtered by favorite, tag, and an optional search string (up to 200 characters) |
| `POST /api/notes` | Create a note from Markdown content |
| `POST /api/notes/batch` | Rehydrate up to 100 owned note IDs in request order; unavailable IDs are omitted |
| `GET /api/notes/:id` | Return one owned note |
| `PATCH /api/notes/:id` | Update content, color, favorite, or one rendered task state |
| `DELETE /api/notes/:id` | Delete the note and its R2 attachments |
| `POST /api/notes/:id/attachments` | Stream one owned-note attachment to R2 |
| `GET /api/tags` | Return the current user's tag list and counts |
| `POST /api/markdown` | Render authenticated editor preview HTML |
| `GET/HEAD /api/attachments/:id` | Serve an owned attachment, including byte-range delivery |
| `DELETE /api/attachments/:id` | Delete owned attachment bytes and metadata |
| `GET /api/kanban/boards` | List the authenticated user's board summaries |
| `POST /api/kanban/boards` | Create a board with starter columns |
| `GET/PATCH/DELETE /api/kanban/boards/:id` | Read, edit, or delete one owned board |
| `POST /api/kanban/boards/:id/columns` | Add a column to an owned board |
| `PATCH/DELETE /api/kanban/columns/:id` | Rename or delete an owned column and its cards |
| `POST /api/kanban/columns/:id/cards` | Add a card to an owned column |
| `PATCH/DELETE /api/kanban/cards/:id` | Edit, move, or delete an owned card |
| `GET /api/backup` | Return the current user's backup manifest |
| `POST /api/backup` | Validate and stage a merge or replace import |
| `PUT /api/backup/imports/:importId/attachments/:index` | Upload one staged attachment with exact size enforcement |
| `POST /api/backup/imports/:importId` | Atomically finalize a staged import |
| `DELETE /api/backup/imports/:importId` | Cancel and clean up a staged import |

## Notes and Markdown flow

The shared pure pipeline lives in `src/lib/markdown.ts`. The server compatibility entry point in `src/lib/server/markdown.ts` re-exports it so authenticated note, backup, and API flows keep server-only import boundaries while the public landing demo can render the same output locally.

The client sends Markdown content, not a separate title. `createNote` and `updateNote` derive the title, render the body, synchronize tags, and persist all three representations. The landing demo uses the same derivation, rendering, and task-mutation functions but only updates browser memory and object URLs.

Title behavior:

1. Parse Markdown with the same configured Markdown-It instance used for rendering.
2. Use the first non-empty H1, including setext H1 syntax.
3. Remove only that title heading from the rendered card body.
4. Fall back to the first meaningful text block or `Untitled note`.

Rendering supports line breaks, linkification, typographic substitutions, emoji, GitHub alerts, tables, KaTeX, task lists, and syntax highlighting for Bash, CSS, Go, JavaScript, JSON, Markdown, Python, Rust, TypeScript, XML, and YAML. Raw HTML is escaped.

Saved-note task inputs receive stable parsed indexes. A checkbox request sends an index and target state; the server locates the source line through parsed token mapping, changes only its `[ ]` or `[x]` marker, and runs the normal note update pipeline again.

The task update compares its source content inside the atomic D1 batch. Concurrent content changes produce `409` instead of being overwritten; the failed mutation does not replace the newer note's tag relations.

## Query and state behavior

- Notes are ordered by favorite state, most recent update, and ID for deterministic pagination ties.
- The initial and API default page size is 30; server limits cannot exceed 100.
- The notebook uses `@tanstack/svelte-virtual` to render measured grid rows around the window viewport, with three rows of overscan. The responsive grid retains its 360px desktop target and single mobile column. ResizeObserver updates row heights after content, media, composer, and width changes.
- A visit retains loaded note IDs and row geometry, but full DTOs use a 180-record / estimated 16 MiB LRU cache. Visible rows, the edited note, focus, open menus/PDFs, and playing media are protected while in use. These active records can exceed the soft cache budget; ID/geometry metadata grows with visited notes.
- Scrolling back rehydrates missing DTOs through the owned batch endpoint. Only one restoration request runs at a time; subsequent range changes coalesce. Resetting the feed cancels stale reads, and an old read cannot replace a newer cached mutation. Missing/deleted records are removed and failed reads offer an explicit retry.
- A sentinel preloads the next page within 800px of the end. Load more remains available for keyboard/manual use; an append error preserves existing cards and retries the same page. Filter changes reset the feed and scroll to the notes header when necessary.
- Note hydration uses one JSON-bound ID set per related-data query, so a full 100-note page stays below D1's 100-parameter limit.
- Favorite and tag filters are server queries.
- Search runs on the server across the user's entire notebook: title, content, owned tag names, and owned attachment filenames. It uses a literal substring query, combines with favorite/tag filters, and paginates results. SQLite `lower` provides ASCII case folding; non-ASCII text matches literally. This is not an indexed full-text search.
- The search input debounces requests by 250ms and cancels superseded requests. Loading and failed requests are distinct from an empty result; a failed request has an inline retry. Appended pages deduplicate IDs.
- Tags are created and related automatically from Markdown. There is no separate tag-management UI.
- Editing reuses the top composer; saving refreshes the filtered list and tag summaries. The composer stays mounted when switching to Kanban so in-memory edits and pending files survive that switch. Changing the edited note and signing out require a discard confirmation when dirty; page navigation has an unsaved-change guard. Drafts are not persisted across reloads.
- The composer disables editing during save/upload and formatting during Preview. A failed preview replaces stale HTML with an inline retry state.
- Kanban is a separate workspace view. The page loads board summaries, the active board is fetched on selection, and the tab rail and sidebar both switch boards without a full navigation.
- New boards start with three columns. Cards can be dragged between columns; move actions in the card menu provide a non-drag path for keyboard and touch users.
- Kanban boards are ordered by position and start with three columns named in the account's current interface language (`To do`, `In progress`, and `Done` in English). Saved column names remain user content and do not change when the language changes. Current limits are 30 boards per user, 12 columns per board, and 500 cards per board.
- Card titles allow 200 characters and descriptions allow 10,000. Shared API byte budgets account for Unicode and JSON escapes rather than assuming one byte per character.
- Card moves are optimistic in the browser and are rolled back if the owned, same-board server update fails.
- Notes, attachments, tags, boards, columns, and cards expose the same viewport-aware context-menu pattern. Native menus remain available for selected text, links, and embedded media.

## Account settings and localization

The entire sidebar account row opens one settings dialog with Profile, Appearance & language, Passkeys, and Backups sections. The existing Passkey and backup components render inside its focus scope. Busy uploads, saves, registration/deletion, and backup operations lock section switching and dismissal. Unsaved nickname edits require discard confirmation. Sign-out remains protected by the notebook draft guard.

Nicknames are trimmed and limited to 80 characters. Avatar selection accepts PNG/JPEG/WebP up to 10 MiB in the browser, crops centrally to a 256px square, and re-encodes as WebP before upload. The server independently caps actual bytes at 2 MiB and validates the raster signature. It uploads to a unique user-owned R2 object, conditionally changes the profile image, and cleans up replaced or losing objects. DTOs contain authenticated application URLs; storage keys are never exposed. Removing an avatar restores the initial-letter fallback.

Preferences support `auto`, `en`, `zh-CN`, `ko`, and `ja` for language; `auto`, `light`, and `dark` for appearance; and blue, green, violet, rose, and orange accents. A new account follows the browser language and OS appearance. `auto` language negotiates supported languages using weighted `Accept-Language` values, with English fallback. Preferences persist in D1 and successful preference writes also set an HttpOnly, same-origin preference cookie for public pages after sign-out. Authenticated pages use the account record as the authority. User content and notebook backups do not contain interface preferences or avatars.

The hook sets validated language/theme/accent attributes in the initial HTML. Layout data initializes a separate reactive translation context for each render; client changes apply immediately and roll back if saving fails. The catalog covers navigation, editor controls, item commands, settings, public pages, and interpolated messages; dates follow the selected interface locale. Provider-specific errors and user-authored/sample Markdown can retain their original language.

## Attachment flow

The composer keeps selected files locally until the note exists. On save, it creates or updates the note and uploads each pending file to `/api/notes/:id/attachments`.

The server validates ownership, filename, content length, and 95 MiB maximum. It streams bytes to a user/note-scoped R2 key unique to each attempt, then records metadata in D1. Client-generated upload IDs make retries idempotent; concurrent attempts retain the D1 winner's object and remove losing attempt objects. A retry repairs a missing or wrongly sized R2 object for matching owned metadata with a conditional write. Both streaming and Node proxy paths reject truncated bodies before committing bytes. If metadata insertion fails, the new R2 object is removed.

Presentation depends on classified kind:

- Images render inline and link to the original.
- Audio and video use native media controls.
- PDFs expand into an iframe with open, download, and delete actions.
- Text, office documents, archives, and other files use styled download rows.

Authenticated attachment responses support byte ranges so audio and video seeking works without public R2 access.

## Backup flow

Export is split between server and browser:

1. The server returns a version 2 manifest containing only the authenticated user's notes, tags, relations, boards, columns, cards, and attachment URLs.
2. The browser downloads each authenticated attachment.
3. The browser creates a ZIP containing `manifest.json` and attachment files.
4. The browser encrypts the ZIP and downloads a `.freshup` file.

Import reverses the flow:

The import UI defaults to merge. Replace requires a visible acknowledgement that all current notes, boards, and files will be replaced. Restore is disabled while the composer has unsaved content, pending attachments, or an active save, because successful restore refreshes the page. Export remains available. Inputs remain locked during restore and while a previous finalization needs confirmation.

1. The browser validates the `FRESHUP1` header, derives the key, decrypts, unzips, and checks attachment sizes. Version 1 manifests remain import-compatible.
2. The server validates the manifest, remaps every ID for the current user, and stores an expiring prepared session in R2 without changing live D1 data.
3. The server returns private, session-scoped attachment upload targets.
4. The browser uploads each attachment with exact size enforcement.
5. The browser requests finalization. The server validates every staged object and applies the receipt, notes, tags, relations, attachments, boards, columns, and cards in one D1 batch.
6. Replace mode deletes the user's former D1 records inside that atomic batch and removes their old R2 objects only after the batch succeeds; merge mode preserves existing data.

Finalization claims a short R2 phase lease so cancellation and finalization cannot clean the same staged files concurrently. A per-user receipt makes retries return the original counts without applying an import twice. Expired sessions are cleaned before old receipts are pruned, which prevents a stale session from deleting attachment objects already referenced by D1.

Staged attachment uploads use conditional R2 writes. An exact-size staged object is retained on retries, so a delayed upload cannot overwrite bytes that were already finalized into the live notebook.

The version 2 backup contract includes notes, tags, note relations, attachments, Kanban boards, columns, and cards. Version 1 archives remain valid imports.

## Deployment

`svelte.config.js` maps public assets from `public/` and uses the Cloudflare adapter. `wrangler.jsonc` points the Worker entry to `.svelte-kit/cloudflare/_worker.js`, a D1 database named `fresh`, and an R2 bucket named `fresh-attachments`.

Production setup requires OAuth credentials, a Better Auth secret, the canonical production `BETTER_AUTH_URL`, the correct GitHub callback, migrated D1 schema, and the R2 bucket. Secrets are configured outside Git.

Production is served at `https://fresh.pwp.sh` (a custom domain on the `fresh` Worker; `https://fresh.pwp.workers.dev` remains attached). Its canonical `BETTER_AUTH_URL` is `https://fresh.pwp.sh`, and the production GitHub OAuth application must register `https://fresh.pwp.sh/api/auth/callback/github`. Production and local development use separate GitHub OAuth applications because OAuth apps allow only one callback URL: the production app is client ID `Ov23li0nhmFnACr8ntJ3`, while the local `.env`/`.dev.vars` app keeps the `http://localhost:5173` callback. The production Worker has the four authentication settings stored as secrets, including a separately generated production signing secret. Do not replace that secret with the local development value on later deployments. All six migrations and the `fresh-attachments` bucket were provisioned during the first release; subsequent releases should inspect pending migrations and retain existing resources and secrets.

Passkeys are bound to the WebAuthn relying-party host derived from `BETTER_AUTH_URL`. Passkeys registered while the canonical origin was `fresh.pwp.workers.dev` do not authenticate on `fresh.pwp.sh`; affected users must sign in with GitHub and register a new passkey.

The Better Auth Passkey plugin derives its WebAuthn relying-party host from `BETTER_AUTH_URL`, uses `Fresh` as the relying-party name, and stores credential metadata in the existing `passkey` table. Registration requires an authenticated session. The app exposes registration, listing, and deletion from the sidebar Passkeys dialog; the login page uses discoverable passkey authentication.
