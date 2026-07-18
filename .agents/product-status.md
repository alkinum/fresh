# Product Status

Snapshot date: 2026-07-18. Package version: `0.2.0`. License: Apache-2.0.

This is a status snapshot, not a roadmap promise. Update it when capabilities or maturity materially change.

## Overall state

Fresh is a functioning notebook with a public landing page, a complete local development path, and Cloudflare deployment configuration. The current main workflow covers Passkey or GitHub sign-in, note creation and editing, Markdown rendering, task updates, filtering, attachments, and encrypted backup import/export.

The repository is prepared for open source: it has an Apache-2.0 license, public setup documentation, credential examples, ignored local secrets, ignored browser/test output, and exported logo assets.

## Implemented features

| Area | Status | Current behavior |
| --- | --- | --- |
| Public landing page | Implemented | Product-led Fresh overview at `/` with authenticated-aware entry actions |
| GitHub authentication | Implemented | Better Auth social sign-in, session cookies, login redirects, sign-out, unconfigured state |
| Passkey authentication | Implemented | Better Auth WebAuthn sign-in plus session-bound registration, listing, and deletion |
| Notes | Implemented | Create, edit, delete, favorite, color accent, update timestamps, responsive card grid |
| Automatic titles | Implemented | First valid H1 is title; title H1 is hidden from rendered body; safe fallback title |
| Markdown | Implemented | Breaks, links, emoji, GitHub alerts, tables, KaTeX, syntax highlighting, styled rendered content |
| Interactive tasks | Implemented | Rendered task checkboxes update the original saved Markdown through the server |
| Tags | Implemented | Extracted from Markdown, deterministic colors, counts, sidebar filtering |
| Search | Implemented with scope limit | Client search across notes already loaded into page state |
| Favorites | Implemented | Server filter, ordering, optimistic list updates |
| Pagination | Implemented | 30-note default page with Load more; server maximum 100 per request |
| Editor | Implemented | Formatting toolbar, Write/Preview modes, auto-growing textarea, keyboard save |
| Attachments | Implemented | Multiple pending files, 95 MiB limit, R2 storage, ownership checks, delete and download |
| Media previews | Implemented | Images, audio, video, expandable PDFs, styled document/archive/other rows |
| Media seeking | Implemented | Authenticated `HEAD` and single byte-range responses from R2 |
| Encrypted backup export | Implemented | Browser-side ZIP plus AES-256-GCM `.freshup` download |
| Encrypted backup import | Implemented | Password decryption, manifest validation, merge and replace modes, attachment restore |
| Responsive UI | Implemented | Desktop shell, off-canvas mobile sidebar, sticky mobile header, one-column mobile notes |
| Light and dark themes | Implemented | Automatic OS preference with semantic tokens across application and rendered Markdown |
| Liquid Glass | Implemented selectively | Active sidebar states, login, attachment control, and backup file picker |
| Login motion | Implemented | Three distinct sine layers with different paths, phases, amplitudes, directions, and speeds |
| Brand assets | Implemented | Fresh logo, favicon sizes, PWA icons, maskable icons, web manifest |
| Accessibility preferences | Implemented | Reduced motion, reduced transparency, increased contrast, visible focus states |

## Current runtime and data state

- Cloudflare Worker compatibility date is `2026-07-17` with `nodejs_compat`.
- D1 binding is `DB`, database name is `fresh`, and migrations live in `migrations/`.
- R2 binding is `ATTACHMENTS`, bucket name is `fresh-attachments`.
- Static assets use the `ASSETS` binding.
- Smart placement, Worker logs, and sampled traces are enabled in configuration.
- The current schema includes Better Auth and Passkey tables plus notes, tags, note/tag relations, and attachments.
- The current backup schema version is 1 and the compatibility header remains `FRESHUP1`.

Configuration in the repository does not prove that every external Cloudflare or GitHub resource exists in another environment. Deployment and OAuth verification still require valid environment-specific credentials and callback URLs.

## Validation and test baseline

At this snapshot, the following pass locally:

- `npm run check` with 0 Svelte/TypeScript errors and 0 warnings.
- `npm run lint`.
- `npm test` with 3 files and 20 tests.
- `npm run build` for the Cloudflare production target.

Unit coverage currently exercises:

- Markdown rendering, raw HTML blocking, tag extraction, title derivation, title removal, task indexing, and task mutation.
- Attachment classification and filename sanitization.
- Encrypted backup round-trip and wrong-password rejection.

Manual browser verification has covered desktop light, desktop dark, and `390x844` mobile layouts, including the public landing page, login waves, logo depth, sidebar selection, editor auto-growth, Passkey management, and overflow behavior. A virtual WebAuthn authenticator has also verified registration, sign-out, discoverable Passkey sign-in, `/app` return, and test-credential cleanup.

## Known scope and limitations

- Theme follows the operating system. There is no in-app theme selector.
- GitHub remains the account-bootstrap provider. Email/password and other OAuth providers are disabled or not configured.
- Search is local to loaded notes; it is not a server-wide full-text search.
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
- Renamed and rebranded the product from freshWrite to Fresh with a complete icon set.
- Added responsive light/dark design tokens, restrained Liquid Glass, layered logo treatment, and distinct login sine motion.
- Added a product-led public landing page, moved the private notebook to `/app`, and added Passkey login and device management.
- Added Apache-2.0 licensing and refreshed the public README.

## Status update checklist

When updating this document, confirm the package version, license, bindings, migration count, feature matrix, limits, automated test count, visual QA matrix, known limitations, and external-resource assumptions against the current repository.
