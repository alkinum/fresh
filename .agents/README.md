# Fresh Agent Handbook

This directory is the maintained context for anyone developing Fresh. Read it before planning or editing the repository.

## Reading order

1. [development.md](./development.md) for non-negotiable engineering, security, testing, and Git rules.
2. [architecture.md](./architecture.md) for runtime boundaries, data ownership, routes, and core flows.
3. [design-system.md](./design-system.md) before any UI, copy, interaction, icon, or motion change.
4. [product-status.md](./product-status.md) to understand what is implemented and what must not be assumed.

## Project identity

- Product name: Fresh.
- Product category: private personal notebook for Markdown, media, and encrypted backups.
- Current package version: `0.2.0`.
- License: Apache-2.0.
- Primary runtime: Cloudflare Workers.
- Application stack: SvelteKit 2, Svelte 5, TypeScript, D1, R2, Drizzle ORM, Better Auth.
- Authentication: GitHub OAuth only.
- Product tone: clear, cheerful, fresh, lively, cute, tidy, and work-focused.

Do not reintroduce the former `freshWrite` product name in visible copy, package metadata, assets, or new identifiers. The `FRESHUP1` backup magic is intentionally retained for backup compatibility.

## Source of truth

Use this priority when facts conflict:

1. Security and data-ownership invariants in the current server code.
2. Runtime configuration and database schema.
3. This handbook.
4. The public README and historical comments.

The correct response to a mismatch is to inspect, fix the mismatch if appropriate, and update the handbook. Do not silently preserve stale documentation.

## Documentation ownership

Update these documents in the same change when any of the following moves:

- Runtime, dependency, route, database, storage, authentication, or deployment architecture.
- User-visible feature behavior, validation limits, backup format, or compatibility guarantees.
- Design tokens, component patterns, responsive breakpoints, theme behavior, assets, or motion.
- Required setup, commands, testing matrix, commit policy, ignored outputs, or credential handling.
- Project maturity, known limitations, or implemented feature status.

Keep durable rules in `development.md` and `design-system.md`. Keep dated observations and feature maturity in `product-status.md`.
