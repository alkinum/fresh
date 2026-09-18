# Product Status

Snapshot date: 2026-09-18. Package version: `0.2.0`. License: Apache-2.0.

This is a status snapshot, not a roadmap promise. Update it when capabilities or maturity materially change.

## Overall state

Fresh is a functioning notebook and personal Kanban workspace with a public landing page, a complete local development path, and Cloudflare deployment configuration. The current main workflow covers Passkey or GitHub sign-in, note creation and editing, Markdown rendering, task updates, filtering, attachments, Kanban boards, and encrypted notebook backup import/export.

The repository is prepared for open source: it has an Apache-2.0 license, public setup documentation, credential examples, ignored local secrets, ignored browser/test output, and exported logo assets.

## Implemented features

| Area | Status | Current behavior |
| --- | --- | --- |
| Public landing page | Implemented | Guests see the notebook desk and local editor demo; signed-in visits to `/` redirect directly to `/app` on the server |
| Account settings | Implemented | Clickable account row opens profile, language/appearance, Passkeys, and backups; nicknames and private uploaded avatars persist on the account |
| Interface languages | Implemented | Simplified Chinese, English, Korean, and Japanese; browser negotiation by default, account selection with SSR and refresh persistence |
| GitHub authentication | Implemented | Better Auth social sign-in, session cookies, login redirects, sign-out, unconfigured state |
| Passkey authentication | Implemented | Better Auth WebAuthn sign-in plus session-bound registration, listing, and deletion |
| Notes | Implemented | Create, edit, delete, favorite, copy Markdown, color accent, timestamps, responsive card grid, overflow and right-click actions |
| Automatic titles | Implemented | First valid H1 is title; title H1 is hidden from rendered body; safe fallback title |
| Markdown | Implemented | Breaks, links, emoji, GitHub alerts, tables, KaTeX, syntax highlighting, styled rendered content |
| Interactive tasks | Implemented | Rendered task checkboxes update the original saved Markdown through the server |
| Tags | Implemented | Extracted from Markdown, deterministic colors, counts, sidebar filtering, right-click filter/copy actions |
| Search | Implemented | Debounced server search across the entire owned notebook, including title, Markdown, tags, and attachment filenames; combines with favorites/tags and paginates results |
| Favorites | Implemented | Server filter, ordering, optimistic list updates |
| Pagination | Implemented | Automatic infinite loading with a manual Load more fallback; measured virtual rows and bounded body cache; 30-note default page, maximum 100 per request |
| Editor | Implemented | Formatting toolbar, Write/Preview modes with error recovery, auto-growing textarea, keyboard save, in-memory draft retention across workspace switches, and unsaved-change confirmation |
| Attachments | Implemented | Multiple pending files, 95 MiB limit, R2 storage, ownership checks, consistent open/download/delete menus |
| Kanban | Implemented | Owned boards, localized starter columns, editable cards, drag/drop and menu movement; compact inline card creation with keyboard/IME support, pending locks, and retained error drafts |
| Context menus | Implemented | Shared viewport-aware menus for notes, attachments, tags, boards, columns, and cards with keyboard navigation |
| Media previews | Implemented | Images, audio, video, expandable PDFs, styled document/archive/other rows |
| Media seeking | Implemented | Authenticated `HEAD` and single byte-range responses from R2 |
| Encrypted backup export | Implemented | Browser-side ZIP plus AES-256-GCM `.freshup` download |
| Encrypted backup import | Implemented | Password decryption, manifest validation, staged attachment uploads, and atomic idempotent finalization; Merge is the default, Replace requires acknowledgement, and unsaved editor drafts block restore |
| Responsive UI | Implemented | Compact 244px desktop shell with 13px navigation; off-canvas mobile sidebar, responsive settings dialog, sticky mobile header, one-column mobile notes |
| Light and dark themes | Implemented | System, light, and dark settings plus five action accents, saved to the account and applied on first render |
| Liquid Glass | Implemented selectively | Active sidebar states, login, attachment control, and backup file picker |
| Login motion | Implemented | Three distinct sine layers with different paths, phases, amplitudes, directions, and speeds |
| Brand assets | Implemented | Clean blue clay journal with a pencil and ribbon bookmark, generated with GPT Image 2.5 Flare through Replicate CLI; 1024px master, favicon sizes, PWA icons, maskable icons, web manifest |
| Accessibility preferences | Implemented | Reduced motion, reduced transparency, increased contrast, visible focus states |

## Current runtime and data state

- Cloudflare Worker compatibility date is `2026-07-17` with `nodejs_compat`.
- D1 binding is `DB`, database name is `fresh`, and migrations live in `migrations/`.
- R2 binding is `ATTACHMENTS`, bucket name is `fresh-attachments`.
- Static assets use the `ASSETS` binding.
- Smart placement, Worker logs, and sampled traces are enabled in configuration.
- The current schema includes Better Auth and Passkey tables plus notes, tags, note/tag relations, attachments, backup import receipts, Kanban boards, columns, cards, and account preferences across seven migrations. The September 18 settings migration has been applied locally; this change has not deployed it to production.
- Backup exports use schema version 2 and include Kanban data. Version 1 imports remain supported, and the compatibility header remains `FRESHUP1`.

The first production release is live at `https://fresh.pwp.workers.dev`, running application commit `3ff60d8` as Worker version `5f57214e-4929-45fd-888d-3ebc7cd8db67` at 100% traffic. The initial release verified that D1 had no business tables, applied all six committed migrations, created the private `fresh-attachments` R2 bucket, and uploaded the four authentication settings as secrets with a newly generated production signing secret. The temporary secrets file was removed after deployment.

The production GitHub OAuth callback is `https://fresh.pwp.workers.dev/api/auth/callback/github`. Login initiation returns that callback and reaches GitHub's sign-in page. The OAuth application's registered callback and the complete GitHub sign-in round trip were not verified through an authenticated GitHub browser session. Other environments still require their own Cloudflare resources, credentials, and callback configuration.

## Validation and test baseline

The 2026-09-16–17 dependency refresh checks all direct packages against current stable registry releases, with TypeScript intentionally constrained to `^6.0.3` (the latest stable 6.x). Key versions are Svelte 5.57.0, SvelteKit 2.70.3, Vite 8.3.0, Better Auth/Passkey 1.7.5, Markdown-it 15.0.2, Zod 4.6.5, Vitest/coverage 5.0.1, Wrangler 4.133.0, and TanStack Svelte Virtual 3.13.39. The separate Markdown-it types package is removed in favor of upstream public types. `development.md` explains the remaining narrow compatibility overrides, removed Vitest/Sharp overrides, and Node.js requirements.

At this snapshot, the following pass locally:

- `npm run check` with 0 Svelte/TypeScript errors and 0 warnings.
- `npm run lint`.
- `npm test -- --maxWorkers=1 --testTimeout=30000 --hookTimeout=30000` with 11 files and 75 tests, including disposable local D1/R2 and actual Workers streaming execution. Longer timeouts accommodate the shared development host; earlier attempts encountered local proxy connection failures and timeouts.
- `npm run build` for the Cloudflare production target.
- Clean `npm ci`, a valid `npm ls --all` dependency tree, and `npm audit` with zero vulnerabilities after the dependency refresh. `npm outdated` reports TypeScript 7 (intentionally excluded) and the anomalous Node types `latest` tag, which points to 22.20.3 while Fresh uses the newer 26.6.1 from `ts6.0`.

Unit coverage currently exercises:

- Markdown rendering, raw HTML blocking, tag extraction, title derivation, title removal, task indexing, and task mutation.
- Attachment classification, filename sanitization, range handling, and Unicode truncation.
- Encrypted backup round-trip, size boundaries, schema relationships, staged atomic import, retries, cleanup, and wrong-password rejection.
- Context-menu viewport alignment, edge flipping, and small-viewport clamping.
- D1 note/tag and Kanban concurrency, limits, compaction, and per-user hydration boundaries.
- Server search beyond the first page, literal wildcard characters, attachment filenames, combined filters, and per-user search isolation.
- Bounded JSON parsing for large Unicode note requests.
- The maximum 100-note page within D1's parameter limit, task/content edit races without stale tag updates, and full-length Unicode Kanban card requests.
- Concurrent attachment upload retries, delayed backup uploads after finalization, exact-length enforcement in Node and Workers, and long supplementary-Unicode backup filenames.
- Long-feed cache count/byte eviction, protected active records, replacement accounting, and batched rehydration order, size limits, and per-user isolation.

Manual browser verification has covered desktop light, desktop dark, and `390x844` mobile layouts, including the public landing page, login waves, logo depth, sidebar selection, editor auto-growth, Passkey management, and overflow behavior. Context-menu verification covers menu-button and native right-click entry points for notes, attachments, tags, board tabs and headers, columns, and cards; per-item command sets and disabled edge movement; Arrow Up/Down, Home/End, Escape, and focus restoration; preserved native menus for links and selected text; and viewport flipping and clamping without document overflow in the production container. A virtual WebAuthn authenticator has also verified registration, sign-out, discoverable Passkey sign-in, `/app` return, and test-credential cleanup.

The 2026-09-10 review additionally exercised the rebuilt landing, login, branded error page, and app in both themes at 1440px and 390px; responsive app widths from 320px to 1440px; full-notebook search and retry; draft retention and discard confirmation; preview failure recovery; locked saving with attachment upload; saved tasks; confirmed note deletion; Kanban creation, card movement, and deletion; encrypted export and actual merge/replace restores with attachment byte verification; mobile navigation and sign-out cancellation while a draft is hidden in Kanban; and reduced motion. No browser runtime errors were observed. This pass used a disposable local D1 session and local R2 data. Real GitHub OAuth and physical passkey devices were not re-tested in this review; earlier virtual WebAuthn coverage above is historical.

The subsequent dependency refresh was verified in the production preview on Node 26.5.0: the public demo renders Markdown, KaTeX, and highlighted code; existing signed sessions remain valid; authenticated notes save, search, and persist tasks; and a virtual WebAuthn authenticator completes passkey registration, sign-out, discoverable sign-in, and deletion using Better Auth 1.7.3. Desktop and mobile theme checks reported no runtime errors. Better Auth's current core/passkey fields match the existing Drizzle schema, so no database migration was required. This verification also used disposable local data; real GitHub OAuth and physical authenticator hardware remain outside this pass.

The first production release reran check, lint, all 58 tests, and the production build successfully. Live HTTP checks verified `/` and `/login` return 200, anonymous `/app` redirects to `/login`, protected notes/Kanban/backup APIs return 401, and an unknown route returns 404. Live Chrome checks covered landing and login at 1440px and 390px in both themes with no overflow, broken images, failed application assets, or runtime errors. The local landing demo previews and saves Markdown without production API writes. Favicon, navigation, PWA, and maskable assets were compared byte-for-byte with the committed files. Production authenticated notebook writes and complete OAuth/passkey sign-in remain outside this public smoke test.

The 2026-09-16 code/dependency review fixes six correctness issues involving concurrent attachment and backup uploads, stale task writes, full-page D1 hydration, Unicode Kanban requests, and truncated uploads. See `review-2026-09-16.md` for triggers and regression coverage. The updated production preview on Node 26.5.0 passes public Markdown/math/highlighting preview and save, signed-session access, authenticated note save/search/task persistence, and virtual Passkey registration, sign-out, discoverable sign-in, and deletion with Better Auth 1.7.5. Desktop light/dark and 390x844 mobile screenshots were inspected; the completed browser pass reported no runtime errors or mobile overflow. An initial Passkey attempt hit a transient local Miniflare proxy `EADDRNOTAVAIL`; the complete rerun passed without code or configuration changes. The disposable local review account was removed afterwards. Real GitHub OAuth, physical passkeys, and production load were not exercised.

The September 17 long-list pass loads 3,000 real local D1 notes through the final Worker build. Chrome mounts at most 22 cards during traversal (5 in the sampled mobile view); the JS heap after GC is 12.14 MiB at the end versus 4.53 MiB initially. Desktop light/dark and mobile dark show no overflow or runtime errors. Error/retry, serialized body rehydration, task persistence, menu keyboard behavior, full-library search/edit, and uninterrupted audio across recycling and workspace switches pass. Detailed measurements and local-environment caveats are in `review-2026-09-16.md`; this is not a production-load or low-end-device guarantee.

## Known scope and limitations

- Interface preferences and profile avatars are separate from the notebook backup format. Backups continue to contain notes, boards, and their attachments only.
- GitHub remains the account-bootstrap provider. Email/password and other OAuth providers are disabled or not configured.
- Search uses SQLite substring matching, with ASCII case folding and literal non-ASCII matching. It is not an indexed full-text search; very large libraries may need a dedicated index.
- The virtual notebook mounts nearby rows and active interactions. Browser Find only sees mounted content; use notebook search for the full library. Cache limits are soft for visible/edited/playing records, and lightweight IDs/geometry still grow with the visited feed. Server pagination remains offset-based and is not a snapshot across concurrent writes.
- Editor drafts survive switching between Notes and Kanban during a visit, but are not persisted across reloads or browser restarts.
- Tags are generated from note content; there is no standalone tag editor or rename/delete workflow.
- Notes are private to an account. Sharing, collaboration, public links, and multi-user note editing are not implemented.
- There is no offline-first synchronization or conflict resolution.
- The editor is Markdown with a formatting toolbar and preview, not a contenteditable WYSIWYG editor.
- Raw HTML in Markdown is intentionally disabled.
- Backup import is browser-memory bound and capped at 512 MiB.
- Attachments are capped at 95 MiB each.
- The repository currently has unit tests but no committed browser end-to-end suite or GitHub Actions workflow.
- There are no release tags in the repository at this snapshot.

Do not describe any item in this section as implemented until code, tests, and this status document are updated together.

## Recent completed milestones

- Migrated the workspace to SvelteKit and Cloudflare Worker deployment.
- Added D1 attachment metadata and R2 file storage.
- Rebuilt the notebook experience around an H1-derived title and a single Markdown composer.
- Added styled attachment selection and rich media presentation.
- Added interactive rendered task updates.
- Added encrypted `.freshup` backup merge and replace flows.
- Hardened backup restore with staged uploads, atomic D1 finalization, retry receipts, phase leases, and stale-session cleanup.
- Renamed and rebranded the product from freshWrite to Fresh with a complete icon set.
- Added responsive light/dark design tokens, restrained Liquid Glass, layered logo treatment, and distinct login sine motion.
- Added a product-led public landing page, moved the private notebook to `/app`, and added Passkey login and device management.
- Added Apache-2.0 licensing and refreshed the public README.
- Added owned Kanban boards, columns, cards, and unified keyboard-accessible context menus across workspace items.
- Replaced the landing Markdown mock with a non-persistent interactive demo that reuses the production note composer, note card, attachment presentation, and rendering pipeline.
- Rebuilt the landing as a cute notebook desk, unified tactile surfaces across all pages, introduced the blue clay journal mark, and addressed search, draft loss, preview recovery, and destructive-action clarity in the September product/design review.

## Status update checklist

When updating this document, confirm the package version, license, bindings, migration count, feature matrix, limits, automated test count, visual QA matrix, known limitations, and external-resource assumptions against the current repository.
