// Firebase Cloud Messaging Service Worker
// File này cần để nhận FCM notifications khi browser đang chạy background

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration - PHẢI GIỐNG VỚI FILE HTML
firebase.initializeApp({
  apiKey: "AIzaSyC4kxv49IVcPgArS2ubJZ8cox-lwMRfLKM",
  authDomain: "mobile-app-fc7ab.firebaseapp.com",
  projectId: "mobile-app-fc7ab",
  storageBucket: "mobile-app-fc7ab.firebasestorage.app",
  messagingSenderId: "297368073604",
  appId: "1:297368073604:web:32cb806c525d120cfb99d1"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Received background message:', payload);
    
    const notificationTitle = payload.notification?.title || 'New Notification';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/firebase-logo.png',
        badge: '/firebase-logo.png',
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
