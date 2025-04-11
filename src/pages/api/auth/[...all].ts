import { initAuth } from "@/utils/auth";
import type { APIRoute } from "astro";

export const ALL: APIRoute = async ({ request, locals }) => {
  const auth = initAuth(locals.runtime.env.DB);
	return auth.handler(request);
};