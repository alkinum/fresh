# Product Status

Snapshot date: 2026-09-10. Package version: `0.2.0`. License: Apache-2.0.

This is a status snapshot, not a roadmap promise. Update it when capabilities or maturity materially change.

## Overall state

Fresh is a functioning notebook and personal Kanban workspace with a public landing page, a complete local development path, and Cloudflare deployment configuration. The current main workflow covers Passkey or GitHub sign-in, note creation and editing, Markdown rendering, task updates, filtering, attachments, Kanban boards, and encrypted notebook backup import/export.

The repository is prepared for open source: it has an Apache-2.0 license, public setup documentation, credential examples, ignored local secrets, ignored browser/test output, and exported logo assets.

## Implemented features

| Area | Status | Current behavior |
| --- | --- | --- |
| Public landing page | Implemented | Cute paper-and-clay notebook desk at `/`, with authenticated-aware entry actions and a local interactive demo built from the production note composer, card, and Markdown renderer |
| GitHub authentication | Implemented | Better Auth social sign-in, session cookies, login redirects, sign-out, unconfigured state |
| Passkey authentication | Implemented | Better Auth WebAuthn sign-in plus session-bound registration, listing, and deletion |
| Notes | Implemented | Create, edit, delete, favorite, copy Markdown, color accent, timestamps, responsive card grid, overflow and right-click actions |
| Automatic titles | Implemented | First valid H1 is title; title H1 is hidden from rendered body; safe fallback title |
| Markdown | Implemented | Breaks, links, emoji, GitHub alerts, tables, KaTeX, syntax highlighting, styled rendered content |
| Interactive tasks | Implemented | Rendered task checkboxes update the original saved Markdown through the server |
| Tags | Implemented | Extracted from Markdown, deterministic colors, counts, sidebar filtering, right-click filter/copy actions |
| Search | Implemented | Debounced server search across the entire owned notebook, including title, Markdown, tags, and attachment filenames; combines with favorites/tags and paginates results |
| Favorites | Implemented | Server filter, ordering, optimistic list updates |
| Pagination | Implemented | 30-note default page with Load more; server maximum 100 per request |
| Editor | Implemented | Formatting toolbar, Write/Preview modes with error recovery, auto-growing textarea, keyboard save, in-memory draft retention across workspace switches, and unsaved-change confirmation |
| Attachments | Implemented | Multiple pending files, 95 MiB limit, R2 storage, ownership checks, consistent open/download/delete menus |
| Kanban | Implemented | Owned boards, default and custom columns, editable cards, drag/drop and menu movement, responsive horizontal workspace |
| Context menus | Implemented | Shared viewport-aware menus for notes, attachments, tags, boards, columns, and cards with keyboard navigation |
| Media previews | Implemented | Images, audio, video, expandable PDFs, styled document/archive/other rows |
| Media seeking | Implemented | Authenticated `HEAD` and single byte-range responses from R2 |
| Encrypted backup export | Implemented | Browser-side ZIP plus AES-256-GCM `.freshup` download |
| Encrypted backup import | Implemented | Password decryption, manifest validation, staged attachment uploads, and atomic idempotent finalization; Merge is the default, Replace requires acknowledgement, and unsaved editor drafts block restore |
| Responsive UI | Implemented | Desktop shell, off-canvas mobile sidebar, sticky mobile header, one-column mobile notes |
| Light and dark themes | Implemented | Automatic OS preference with semantic tokens across application and rendered Markdown |
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
- The current schema includes Better Auth and Passkey tables plus notes, tags, note/tag relations, attachments, backup import receipts, Kanban boards, columns, and cards across six migrations.
- Backup exports use schema version 2 and include Kanban data. Version 1 imports remain supported, and the compatibility header remains `FRESHUP1`.

Configuration in the repository does not prove that every external Cloudflare or GitHub resource exists in another environment. Deployment and OAuth verification still require valid environment-specific credentials and callback URLs.

## Validation and test baseline

The dependency refresh uses the current stable releases of all direct packages, with TypeScript intentionally constrained to `^6.0.3` (the latest stable 6.x). Key versions are Svelte 5.57.0, SvelteKit 2.70.3, Vite 8.2.2, Better Auth/Passkey 1.7.3, Markdown-it 15.0.1, Vitest/coverage 5.0.0, and Wrangler 4.130.0. The separate Markdown-it types package is removed in favor of upstream public types. `development.md` explains the narrow compatibility overrides and Node.js requirements.

At this snapshot, the following pass locally:

- `npm run check` with 0 Svelte/TypeScript errors and 0 warnings.
- `npm run lint`.
- `npm test -- --maxWorkers=1` with 8 files and 58 tests.
- `npm run build` for the Cloudflare production target.
- Clean `npm ci`, a valid `npm ls --all` dependency tree, and `npm audit` with zero vulnerabilities after the dependency refresh. `npm outdated` reports only TypeScript 7, which is intentionally outside the requested 6.x range.

Unit coverage currently exercises:

- Markdown rendering, raw HTML blocking, tag extraction, title derivation, title removal, task indexing, and task mutation.
- Attachment classification, filename sanitization, range handling, and Unicode truncation.
- Encrypted backup round-trip, size boundaries, schema relationships, staged atomic import, retries, cleanup, and wrong-password rejection.
- Context-menu viewport alignment, edge flipping, and small-viewport clamping.
- D1 note/tag and Kanban concurrency, limits, compaction, and per-user hydration boundaries.
- Server search beyond the first page, literal wildcard characters, attachment filenames, combined filters, and per-user search isolation.
- Bounded JSON parsing for large Unicode note requests.

Manual browser verification has covered desktop light, desktop dark, and `390x844` mobile layouts, including the public landing page, login waves, logo depth, sidebar selection, editor auto-growth, Passkey management, and overflow behavior. Context-menu verification covers menu-button and native right-click entry points for notes, attachments, tags, board tabs and headers, columns, and cards; per-item command sets and disabled edge movement; Arrow Up/Down, Home/End, Escape, and focus restoration; preserved native menus for links and selected text; and viewport flipping and clamping without document overflow in the production container. A virtual WebAuthn authenticator has also verified registration, sign-out, discoverable Passkey sign-in, `/app` return, and test-credential cleanup.

The 2026-09-10 review additionally exercised the rebuilt landing, login, branded error page, and app in both themes at 1440px and 390px; responsive app widths from 320px to 1440px; full-notebook search and retry; draft retention and discard confirmation; preview failure recovery; locked saving with attachment upload; saved tasks; confirmed note deletion; Kanban creation, card movement, and deletion; encrypted export and actual merge/replace restores with attachment byte verification; mobile navigation and sign-out cancellation while a draft is hidden in Kanban; and reduced motion. No browser runtime errors were observed. This pass used a disposable local D1 session and local R2 data. Real GitHub OAuth and physical passkey devices were not re-tested in this review; earlier virtual WebAuthn coverage above is historical.

The subsequent dependency refresh was verified in the production preview on Node 26.5.0: the public demo renders Markdown, KaTeX, and highlighted code; existing signed sessions remain valid; authenticated notes save, search, and persist tasks; and a virtual WebAuthn authenticator completes passkey registration, sign-out, discoverable sign-in, and deletion using Better Auth 1.7.3. Desktop and mobile theme checks reported no runtime errors. Better Auth's current core/passkey fields match the existing Drizzle schema, so no database migration was required. This verification also used disposable local data; real GitHub OAuth and physical authenticator hardware remain outside this pass.

## Known scope and limitations

- Theme follows the operating system. There is no in-app theme selector.
- GitHub remains the account-bootstrap provider. Email/password and other OAuth providers are disabled or not configured.
- Search uses SQLite substring matching, with ASCII case folding and literal non-ASCII matching. It is not an indexed full-text search; very large libraries may need a dedicated index.
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
