import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getDb } from '@/db';
import * as schema from '@/db/schema';

export const createAuth = (d1: D1Database) => betterAuth({
  appName: 'Fresh',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(d1), {
    provider: 'sqlite',
    schema
  }),
  emailAndPassword: {
    enabled: false
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['github']
    }
  },
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID ?? '',
      clientSecret: env.GITHUB_CLIENT_SECRET ?? ''
    }
  },
  plugins: [
    passkey({ rpName: 'Fresh' }),
    sveltekitCookies(getRequestEvent)
  ]
});

export const isGitHubAuthConfigured = () => Boolean(
  env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
);
