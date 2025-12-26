import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: admin.app.App;

  onModuleInit() {
    try {
      // Khởi tạo Firebase Admin SDK
      // Bạn có thể dùng service account file hoặc environment variables
      if (!admin.apps.length) {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      } else {
        this.firebaseApp = admin.app();
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error);
    }
  }

  /**
   * Gửi push notification tới một device
   */
  async sendToDevice(
    fcmToken: string,
    title: string,
    body: string,
    data?: { [key: string]: string }
  ): Promise<boolean> {
    if (!fcmToken) {
      this.logger.warn('FCM token is empty, cannot send notification');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        token: fcmToken,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Push notification sent successfully: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      // Nếu token không hợp lệ, có thể xóa token khỏi database
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        this.logger.warn(`Invalid FCM token: ${fcmToken}`);
      }
      return false;
    }
  }

  /**
   * Gửi push notification tới nhiều devices
   */
  async sendToMultipleDevices(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: { [key: string]: string }
  ): Promise<void> {
    const validTokens = fcmTokens.filter((token) => token && token.trim() !== '');

    if (validTokens.length === 0) {
      this.logger.warn('No valid FCM tokens to send notification');
      return;
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title,
          body,
        },
        data: data || {},
        tokens: validTokens,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(
        `Push notifications sent: ${response.successCount} successful, ${response.failureCount} failed`
      );

      // Log các token bị lỗi
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.logger.warn(`Failed to send to token ${validTokens[idx]}: ${resp.error?.message}`);
          }
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send multicast notification: ${error.message}`);
    }
  }
}
