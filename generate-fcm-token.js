/**
 * Script đơn giản để tạo FCM token giả cho testing
 * Vì không có browser, ta sẽ tạo một token test để lưu vào DB
 */

const crypto = require('crypto');

// Tạo một FCM token giả có format giống thật
function generateFakeFCMToken() {
    // FCM token thật có format: [random_string]:[long_random_string]
    const part1 = crypto.randomBytes(11).toString('base64').replace(/[+/=]/g, '');
    const part2 = crypto.randomBytes(100).toString('base64').replace(/[+/=]/g, '');
    
    return `${part1}:APA91b${part2}`;
}

console.log('🔔 Tạo FCM Token giả để test...\n');
console.log('⚠️  LƯU Ý: Token này CHỈ để test lưu vào database.');
console.log('    Bạn KHÔNG thể nhận notification thật với token này.\n');

const fakeToken = generateFakeFCMToken();

console.log('📋 FCM Token (giả):');
console.log('─'.repeat(80));
console.log(fakeToken);
console.log('─'.repeat(80));

console.log('\n✅ Bạn có thể dùng token này để:');
console.log('   1. Lưu vào database qua API: POST /notifications/fcm-token');
console.log('   2. Test endpoint: POST /notifications/test');
console.log('   3. Kiểm tra logic backend (nhưng sẽ không nhận được notification thật)\n');

console.log('💡 Để nhận notification thật, bạn cần:');
console.log('   - Mở file get-fcm-token.html trong browser');
console.log('   - Hoặc lấy token từ React Native app khi có\n');

// Export để có thể import
module.exports = { generateFakeFCMToken, fakeToken };
