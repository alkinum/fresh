export type StreamMessage = {
  type: 'note' | 'tag' | 'heartbeat';
  action?: 'create' | 'update' | 'delete';
  id?: string;
  data?: Record<string, any>;
};

/**
 * Service for handling Server-Sent Events (SSE) streams to clients
 */
export class StreamService {
  private static instance: StreamService;
  private connections: Map<string, Set<ReadableStreamDefaultController>>;

  private constructor() {
    this.connections = new Map();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): StreamService {
    if (!this.instance) {
      this.instance = new StreamService();
    }
    return this.instance;
  }

  /**
   * Add a client connection for a specific user
   */
  addConnection(userId: string, controller: ReadableStreamDefaultController): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    this.connections.get(userId)?.add(controller);
  }

  /**
   * Remove a client connection
   */
  removeConnection(userId: string, controller: ReadableStreamDefaultController): void {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(controller);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
  }

  /**
   * Send a message to all connected clients for a specific user
   */
  sendMessage(userId: string, message: StreamMessage): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) {
      return;
    }

    const messageStr = `data: ${JSON.stringify(message)}\n\n`;

    for (const controller of userConnections) {
      try {
        controller.enqueue(messageStr);
      } catch (error) {
        console.error('Error sending message:', error);
        // Remove the connection if we can't write to it
        this.removeConnection(userId, controller);
      }
    }
  }

  /**
   * Send a heartbeat to all connected clients for a specific user
   * This helps keep the connection alive
   */
  sendHeartbeat(userId: string): void {
    this.sendMessage(userId, { type: 'heartbeat' });
  }

  /**
   * Send a note change notification
   */
  sendNoteChange(userId: string, action: 'create' | 'update' | 'delete', id: string, data?: Record<string, any>): void {
    this.sendMessage(userId, {
      type: 'note',
      action,
      id,
      data
    });
  }

  /**
   * Send a tag change notification
   */
  sendTagChange(userId: string, action: 'create' | 'update' | 'delete', id: string, data?: Record<string, any>): void {
    this.sendMessage(userId, {
      type: 'tag',
      action,
      id,
      data
    });
  }
}
