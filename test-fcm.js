/**
 * Script để test gửi FCM notification mà không cần React Native app
 * 
 * Cách sử dụng:
 * 1. Cài đặt dependencies: npm install firebase-admin
 * 2. Đảm bảo file .env có đầy đủ Firebase credentials
 * 3. Chạy: node test-fcm.js <FCM_TOKEN>
 * 
 * Ví dụ:
 * node test-fcm.js "eXaMpLe_FcM_ToKeN_123..."
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Khởi tạo Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
}

// Lấy FCM token từ command line argument
const fcmToken = process.argv[2];

if (!fcmToken) {
  console.error('❌ Lỗi: Vui lòng cung cấp FCM token');
  console.log('Cách sử dụng: node test-fcm.js <FCM_TOKEN>');
  process.exit(1);
}

// Các test messages mẫu
const testNotifications = [
  {
    title: '📚 Tài liệu mới',
    body: '[Công nghệ phần mềm] Tài liệu mới: "Bài giảng OOP - Lập trình hướng đối tượng" - Đăng bởi Nguyễn Văn A',
    data: {
      type: 'document',
      targetId: 'test-doc-123',
      notificationId: 'test-notif-123',
      isTest: 'true',
    },
  },
  {
    title: '💬 Bình luận mới',
    body: 'Nguyễn Văn A đã bình luận về tài liệu "Lập trình C++ nâng cao" của bạn',
    data: {
      type: 'comment',
      targetId: 'test-comment-456',
      notificationId: 'test-notif-456',
      isTest: 'true',
    },
  },
  {
    title: '👤 Thông báo cá nhân',
    body: 'Nguyễn Văn A đã bắt đầu theo dõi bạn',
    data: {
      type: 'profile',
      targetId: 'test-profile-789',
      notificationId: 'test-notif-789',
      isTest: 'true',
    },
  },
];

// Hàm gửi một notification
async function sendNotification(notification, index) {
  console.log(`\n📤 Đang gửi notification ${index + 1}/${testNotifications.length}...`);
  console.log(`   Title: ${notification.title}`);
  console.log(`   Body: ${notification.body.substring(0, 50)}...`);

  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data,
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

  try {
    const response = await admin.messaging().send(message);
    console.log(`   ✅ Gửi thành công! Message ID: ${response}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Gửi thất bại: ${error.message}`);
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.error('   ⚠️  FCM token không hợp lệ hoặc đã hết hạn');
    }
    return false;
  }
}

// Hàm main để gửi tất cả test notifications
async function main() {
  console.log('🔔 Bắt đầu test FCM notifications...');
  console.log(`📱 FCM Token: ${fcmToken.substring(0, 20)}...`);
  console.log(`📊 Tổng số notifications sẽ gửi: ${testNotifications.length}`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < testNotifications.length; i++) {
    const success = await sendNotification(testNotifications[i], i);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Delay 1 giây giữa các lần gửi
    if (i < testNotifications.length - 1) {
      console.log('   ⏳ Chờ 1 giây...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 KẾT QUẢ TEST:');
  console.log(`   ✅ Thành công: ${successCount}`);
  console.log(`   ❌ Thất bại: ${failCount}`);
  console.log(`   📈 Tỷ lệ thành công: ${((successCount / testNotifications.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  process.exit(0);
}

// Chạy script
main().catch((error) => {
  console.error('❌ Lỗi không mong muốn:', error);
  process.exit(1);
});
