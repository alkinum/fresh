import type { APIRoute } from 'astro';
import type { D1Database } from '@cloudflare/workers-types';
import { StreamService } from '@/services/StreamService';

/**
 * Server-Sent Events (SSE) endpoint for real-time updates
 */
export const GET: APIRoute = async ({ request, locals, cookies }) => {
  // Get userId from query param for testing
  // In production, proper authentication should be implemented
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return new Response('Unauthorized - User ID required', { status: 401 });
  }

  // Stream setup for SSE
  const streamService = StreamService.getInstance();

  // Create a new text stream
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue('event: connected\ndata: true\n\n');

      // Add this connection to the stream service
      streamService.addConnection(userId, controller);

      // Set up a heartbeat every 30 seconds to keep the connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          streamService.sendHeartbeat(userId);
        } catch (error) {
          clearInterval(heartbeatInterval);
          try {
            controller.close();
          } catch (e) {
            // Ignore if already closed
          }
          streamService.removeConnection(userId, controller);
        }
      }, 30000);
    },
    cancel(controller) {
      // Connection was closed by the client
      streamService.removeConnection(userId, controller);
    }
  });

  // Return the stream with the appropriate headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
};
