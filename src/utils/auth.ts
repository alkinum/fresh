import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { passkey } from "better-auth/plugins/passkey"
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from 'astro:env/server';

export const initAuth = (db: D1Database) => betterAuth({
    emailAndPassword: {
      enabled: false,
    },
    database: drizzleAdapter(db, {
      provider: 'sqlite',
    }),
    plugins: [passkey()],
    socialProviders: {
      github: {
        clientId: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
      },
    },
  });
