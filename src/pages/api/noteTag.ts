import type { APIContext, APIRoute } from 'astro';
import { z } from 'zod';
import { NoteTagService } from '@/services/NoteTagService';
import { handleError } from '@/utils/api';

// Validation schemas
const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().min(1, 'Color is required'),
});

const updateTagSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  color: z.string().min(1, 'Color is required').optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid tag ID')
});

const queryParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(20),
});

export const GET: APIRoute = async ({ request, locals }: APIContext) => {
  try {
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    // Service initialization
    const noteTagService = new NoteTagService(locals.runtime.env.DB);

    // Get a single tag by ID
    if (id) {
      const { id: validatedId } = idParamSchema.parse({ id });
      const tag = await noteTagService.getById(validatedId);

      if (!tag) {
        return new Response(JSON.stringify({
          error: 'Tag not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if the tag belongs to the current user
      if (tag.userId !== locals.user.id) {
        return new Response(JSON.stringify({
          error: 'Unauthorized'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(tag), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get a list of tags with pagination
    const params = Object.fromEntries(url.searchParams.entries());
    const { page, limit } = queryParamsSchema.parse(params);

    const tags = await noteTagService.list({
      page,
      limit,
      userId: locals.user.id,
    });

    return new Response(JSON.stringify(tags), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return handleError(error);
  }
};

export const PUT: APIRoute = async ({ request, locals }: APIContext) => {
  try {
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await request.json();
    const validatedData = createTagSchema.parse(data);

    const noteTagService = new NoteTagService(locals.runtime.env.DB);

    // Create the tag
    const tag = await noteTagService.create({
      ...validatedData,
      userId: locals.user.id,
    });

    return new Response(JSON.stringify(tag), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return handleError(error);
  }
};

export const PATCH: APIRoute = async ({ request, locals }: APIContext) => {
  try {
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const { id: validatedId } = idParamSchema.parse({ id });

    // Service initialization
    const noteTagService = new NoteTagService(locals.runtime.env.DB);

    // Check if tag exists and belongs to the user
    const existingTag = await noteTagService.getById(validatedId);
    if (!existingTag) {
      return new Response(JSON.stringify({
        error: 'Tag not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (existingTag.userId !== locals.user.id) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await request.json();
    const validatedData = updateTagSchema.parse(data);

    // Update the tag
    const updatedTag = await noteTagService.update(validatedId, validatedData);

    return new Response(JSON.stringify(updatedTag), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return handleError(error);
  }
};

export const DELETE: APIRoute = async ({ request, locals }: APIContext) => {
  try {
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const { id: validatedId } = idParamSchema.parse({ id });

    // Service initialization
    const noteTagService = new NoteTagService(locals.runtime.env.DB);

    // Check if tag exists and belongs to the user
    const existingTag = await noteTagService.getById(validatedId);
    if (!existingTag) {
      return new Response(JSON.stringify({
        error: 'Tag not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (existingTag.userId !== locals.user.id) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete the tag
    const success = await noteTagService.delete(validatedId);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
};
