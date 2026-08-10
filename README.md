<p align="center">
  <img src="./public/favicon-256x256.png" width="112" alt="Fresh logo">
</p>

<h1 align="center">Fresh</h1>

<p align="center">
  A clear, cheerful notebook for Markdown, media, and encrypted backups.
</p>

<p align="center">
  <img alt="SvelteKit" src="https://img.shields.io/badge/SvelteKit-FF3E00?style=flat-square&logo=svelte&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-F38020?style=flat-square&logo=cloudflare&logoColor=white">
  <img alt="Apache License 2.0" src="https://img.shields.io/badge/License-Apache--2.0-4f8cff?style=flat-square">
</p>

Fresh is a personal notebook built with SvelteKit and deployed as a Cloudflare Worker. It keeps note metadata in D1, file attachments in R2, and account access behind GitHub OAuth or a registered passkey.

## Highlights

- Markdown notes with KaTeX math, syntax highlighting, GitHub alerts, emoji, links, tables, and tags
- Interactive task lists that update the saved Markdown directly from the rendered note
- Titles derived automatically from the first level-one heading
- Search, favorites, tag filters, responsive navigation, and rich attachment previews
- Personal Kanban boards with custom columns, editable cards, drag and menu movement
- Consistent overflow and right-click actions for notes, attachments, tags, boards, columns, and cards
- Images, audio, video, PDFs, documents, archives, and other files stored in R2
- Passkey sign-in with in-app device registration and management
- Password-encrypted `.freshup` backups with merge and replace import modes
- A public Fresh landing page and responsive notebook at `/app`

## Stack

| Layer | Technology |
| --- | --- |
| Application | SvelteKit, Svelte 5, TypeScript |
| Runtime | Cloudflare Workers with Static Assets |
| Data | Cloudflare D1, Drizzle ORM |
| Files | Cloudflare R2 |
| Authentication | Better Auth, GitHub OAuth, WebAuthn passkeys |
| Markdown | Markdown-It, KaTeX, Highlight.js |
| Validation | Zod, Vitest, ESLint, svelte-check |

## Local development

Requirements: Node.js with npm and a GitHub OAuth app for sign-in.

```sh
npm install
cp .env.example .env
npm run db:migrate:local
npm run dev
```

Configure the OAuth app with this local callback URL:

```text
http://localhost:5173/api/auth/callback/github
```

Then fill the local environment file:

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth application ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth application secret |
| `BETTER_AUTH_SECRET` | Long random secret used to sign authentication state |
| `BETTER_AUTH_URL` | Application origin, normally `http://localhost:5173` |

Vite reads `.env`. Wrangler reads `.dev.vars`, so copy the same local values there when running Wrangler commands directly. Both files are ignored by Git. Keep real credentials out of source control and commit only the provided example files.

## Useful commands

```sh
npm run check             # Svelte and TypeScript diagnostics
npm run lint              # ESLint
npm test                  # Unit tests
npm run build             # Production build
npm run db:migrate:local  # Apply migrations to local D1
npm run db:migrate:prod   # Apply migrations to remote D1
npm run deploy            # Build and deploy with Wrangler
```

## Cloudflare deployment

The Worker expects these bindings from `wrangler.jsonc`:

- `DB`: a D1 database named `fresh`
- `ATTACHMENTS`: an R2 bucket named `fresh-attachments`
- `ASSETS`: the generated SvelteKit static assets

Create the D1 database and R2 bucket in your Cloudflare account, update the D1 database ID, apply the migrations, and store production credentials with Wrangler secrets before the first deployment.

```sh
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_SECRET
npm run db:migrate:prod
npm run deploy
```

Set `BETTER_AUTH_URL` to the production origin in the Worker environment and add the matching production callback URL to the GitHub OAuth app.

## Encrypted backups

Fresh exports notes, tags, and attachments into a `.freshup` archive. Encryption happens in the browser with AES-256-GCM using a PBKDF2-SHA-256 key derived from the backup password. The password is never stored in the archive or sent to the server during export.

The current `FRESHUP1` format remains import-compatible with backups created before the project was renamed to Fresh.

## License

Fresh is available under the [Apache License 2.0](./LICENSE).
