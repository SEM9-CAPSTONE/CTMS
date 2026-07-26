import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    client.emit('connected', {
      message: 'Connected to CTMS real-time gateway',
    });
  }

  @SubscribeMessage('emergency.broadcast')
  broadcastEmergency(@MessageBody() payload: unknown, @ConnectedSocket() client: Socket) {
    client.broadcast.emit('emergency.alert', payload);
    return {
      delivered: true,
    };
  }
}
