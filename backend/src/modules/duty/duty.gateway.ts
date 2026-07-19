import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DutyService } from './duty.service';

@WebSocketGateway({
  namespace: '/duty',
  cors: { origin: '*' },
})
export class DutyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DutyGateway.name);

  constructor(private dutyService: DutyService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.emitOverviewToClient(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  async handleJoin(client: Socket) {
    client.join('duty-room');
    await this.emitOverviewToClient(client);
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async broadcastOverview() {
    try {
      const overview = await this.dutyService.getOverview();
      this.server.to('duty-room').emit('overview', overview);
    } catch (err) {
      this.logger.error(`Failed to broadcast overview: ${err}`);
    }
  }

  private async emitOverviewToClient(client: Socket) {
    try {
      const overview = await this.dutyService.getOverview();
      client.emit('overview', overview);
    } catch (err) {
      this.logger.error(`Failed to emit overview to ${client.id}: ${err}`);
    }
  }
}
