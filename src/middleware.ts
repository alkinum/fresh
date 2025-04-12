import { initAuth } from "@/utils/auth";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const auth = initAuth(context.locals.runtime.env.DB);
  const isAuthed = await auth.api
    .getSession({
      headers: context.request.headers,
    })

  if (isAuthed) {
    context.locals.user = isAuthed.user;
    context.locals.session = isAuthed.session;
  } else {
    context.locals.user = null;
    context.locals.session = null;

    // Check if the user is trying to access the note path without authentication
    const url = new URL(context.request.url);
    if (url.pathname.startsWith('/api') && !url.pathname.startsWith('/api/auth')) {
      return new Response('Unauthorized', { status: 403 });
    }
  }

  return next();
});
