import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { createAuth } from '$lib/server/auth';
import { getDb } from '@/db';
import { getPreferences } from '$lib/server/account';
import { parsePreferences, preferenceCookie, resolveLocale } from '$lib/preferences';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  event.locals.session = null;
  let cookiePreferences: unknown;
  try {
    cookiePreferences = JSON.parse(event.cookies.get(preferenceCookie) ?? '{}');
  } catch {
    cookiePreferences = {};
  }
  event.locals.preferences = parsePreferences(cookiePreferences);
  event.locals.acceptedLanguages = event.request.headers.get('accept-language') ?? '';
  const resolvePage: typeof resolve = (current) => {
    current.locals.locale = resolveLocale(current.locals.preferences.language, current.locals.acceptedLanguages);
    return resolve(current, {
      transformPageChunk: ({ html }) =>
        html
          .replace('%fresh.lang%', current.locals.locale)
          .replace('%fresh.theme%', current.locals.preferences.theme)
          .replace('%fresh.accent%', current.locals.preferences.accent),
    });
  };

  if (building || !event.platform?.env.DB) {
    return resolvePage(event);
  }

  const auth = createAuth(event.platform.env.DB);
  const current = await auth.api.getSession({ headers: event.request.headers });

  if (current) {
    event.locals.user = current.user;
    event.locals.session = current.session;
    if (!event.url.pathname.startsWith('/api/')) {
      event.locals.preferences = await getPreferences(getDb(event.platform.env.DB), current.user.id);
    }
  }

  return svelteKitHandler({ event, resolve: resolvePage, auth, building });
};
