import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // 👈 hoặc domain frontend của bạn
  },
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private onlineUsers = new Map<string, string>(); // userId → socketId

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) this.onlineUsers.set(userId, client.id);
    console.log(`User ${userId} connected`);
  }

  handleDisconnect(client: Socket) {
    const userId = [...this.onlineUsers.entries()].find(
      ([, socketId]) => socketId === client.id
    )?.[0];
    if (userId) this.onlineUsers.delete(userId);
    console.log(`User ${userId} disconnected`);
  }

  /** Gửi thông báo tới user cụ thể */
  sendNotification(userId: string, notification: any) {
    const socketId = this.onlineUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('new-notification', notification);
    }
  }
}
