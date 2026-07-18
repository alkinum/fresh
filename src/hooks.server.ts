import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { createAuth } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  event.locals.session = null;

  if (building || !event.platform?.env.DB) {
    return resolve(event);
  }

  const auth = createAuth(event.platform.env.DB);
  const current = await auth.api.getSession({ headers: event.request.headers });

  if (current) {
    event.locals.user = current.user;
    event.locals.session = current.session;
  }

  return svelteKitHandler({ event, resolve, auth, building });
};
