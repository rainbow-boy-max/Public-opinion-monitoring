import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const OPINION_CHANNEL = 'pubsub:opinion:new';

interface JwtPayload {
  sub: number;
  role: string;
  jti: string;
}

interface ConnectionContext {
  userId: number;
  taskIds: Set<number>;
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  path: '/socket.io',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private connections = new Map<string, ConnectionContext>();
  private subscriberInit = false;

  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async afterInit(): Promise<void> {
    if (this.subscriberInit) return;
    this.subscriberInit = true;
    try {
      await this.redisService.subscribe(OPINION_CHANNEL, async (message: string) => {
        try {
          const event = JSON.parse(message) as {
            userId: number;
            taskId: number;
            eventData: Record<string, unknown>;
            publishedAt: string;
          };

          const sockets = await this.server.fetchSockets();
          for (const sock of sockets) {
            const ctx = this.connections.get(sock.id);
            if (!ctx) continue;
            if (ctx.userId !== event.userId) continue;
            if (ctx.taskIds.size > 0 && !ctx.taskIds.has(event.taskId)) continue;
            sock.emit('opinion:new', {
              ...event.eventData,
              taskId: event.taskId,
              publishedAt: event.publishedAt,
            });
          }
        } catch (err) {
          this.logger.error(
            'Failed to handle opinion pubsub message',
            err as Error,
          );
        }
      });
      this.logger.log(`RealtimeGateway subscribed to ${OPINION_CHANNEL}`);
    } catch (err) {
      this.logger.error('Realtime subscription failed', err as Error);
    }
  }

  async handleConnection(socket: Socket): Promise<void> {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.headers.authorization?.replace('Bearer ', '') ?? '');

    if (!token) {
      this.logger.warn('Rejecting WS connection without token');
      socket.disconnect();
      return;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(token);
    } catch (err) {
      this.logger.warn('Rejecting WS connection with invalid token');
      socket.disconnect();
      return;
    }

    const ctx: ConnectionContext = {
      userId: payload.sub,
      taskIds: new Set<number>(),
    };
    this.connections.set(socket.id, ctx);
    socket.data.userId = payload.sub;
    socket.emit('connected', { userId: payload.sub });
    this.logger.log(`WS connected: userId=${payload.sub} socketId=${socket.id}`);
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    this.connections.delete(socket.id);
    this.logger.log(`WS disconnected: socketId=${socket.id}`);
  }

  @SubscribeMessage('subscribe:tasks')
  async subscribeTasks(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { taskIds: number[] },
  ): Promise<{ event: string; data: any }> {
    const ctx = this.connections.get(socket.id);
    if (!ctx) return { event: 'subscribe:tasks', data: { success: false } };

    for (const id of data.taskIds || []) ctx.taskIds.add(id);
    return {
      event: 'subscribe:tasks',
      data: { subscribedTaskIds: Array.from(ctx.taskIds) },
    };
  }

  @SubscribeMessage('unsubscribe:tasks')
  async unsubscribeTasks(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { taskIds: number[] },
  ): Promise<{ event: string; data: any }> {
    const ctx = this.connections.get(socket.id);
    if (!ctx) return { event: 'unsubscribe:tasks', data: { success: false } };

    for (const id of data.taskIds || []) ctx.taskIds.delete(id);
    return {
      event: 'unsubscribe:tasks',
      data: { remainingTaskIds: Array.from(ctx.taskIds) },
    };
  }

  async broadcastStats(userId: number, stats: unknown): Promise<void> {
    const sockets = await this.server.fetchSockets();
    for (const sock of sockets) {
      if (sock.data.userId === userId) {
        sock.emit('opinion:stats', stats);
      }
    }
  }

  async broadcastToUser(userId: number, eventName: string, data: unknown): Promise<void> {
    const sockets = await this.server.fetchSockets();
    for (const sock of sockets) {
      if (sock.data.userId === userId) {
        sock.emit(eventName, data);
      }
    }
  }
}
