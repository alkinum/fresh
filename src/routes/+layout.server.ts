import type { LayoutServerLoad } from './$types';
import { isGitHubAuthConfigured } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals }) => ({
  user: locals.user,
  githubAuthConfigured: isGitHubAuthConfigured()
});
