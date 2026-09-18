import { getDb } from '@/db';
import { getPreferences } from '$lib/server/account';
import { resolveLocale } from '$lib/preferences';
import { createKanbanBoard, KANBAN_BOARD_COLORS, listKanbanBoards } from '$lib/server/kanban';
import { apiError, readJsonBody, unauthorized } from '$lib/server/http';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.enum(KANBAN_BOARD_COLORS).optional(),
});

export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    return json(await listKanbanBoards(getDb(platform.env.DB), locals.user.id));
  } catch (error) {
    return apiError(error);
  }
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  if (!locals.user || !platform?.env.DB) return unauthorized();
  try {
    const input = createSchema.parse(await readJsonBody(request, 2048));
    const db = getDb(platform.env.DB);
    const preferences = await getPreferences(db, locals.user.id);
    const locale = resolveLocale(preferences.language, request.headers.get('accept-language') ?? '');
    const starterColumns = {
      en: ['To do', 'In progress', 'Done'],
      'zh-CN': ['待办', '进行中', '已完成'],
      ko: ['할 일', '진행 중', '완료'],
      ja: ['未着手', '進行中', '完了'],
    } as const;
    const board = await createKanbanBoard(db, locals.user.id, { ...input, columnNames: starterColumns[locale] });
    return json(board, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
};
