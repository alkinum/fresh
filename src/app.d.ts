/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../worker-configuration.d.ts" />

import type { Session, User } from 'better-auth';
import type { Locale, Preferences } from '$lib/preferences';

declare global {
  namespace App {
    interface Locals {
      session: Session | null;
      user: User | null;
      preferences: Preferences;
      locale: Locale;
      acceptedLanguages: string;
    }

    interface Platform {
      env: Cloudflare.Env;
      cf: CfProperties;
      ctx: ExecutionContext;
      caches: CacheStorage;
    }
  }
}

export {};
