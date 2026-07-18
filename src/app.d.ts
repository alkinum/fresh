/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../worker-configuration.d.ts" />

import type { Session, User } from 'better-auth';

declare global {
  namespace App {
    interface Locals {
      session: Session | null;
      user: User | null;
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
