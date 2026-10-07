// ملف مساعد لتسجيل النشاطات - يعمل بدون مشاكل
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function logSimple(userId, userName, action, module, description) {
  try {
    await db.activityLog.create({
      data: {
        userId: userId || null,
        userName: userName || null,
        action: action,
        module: module,
        description: description,
      },
    });
    console.log('[LOG]', action, module, description);
  } catch (e) {
    console.error('[LOG ERROR]', e.message);
  }
}

module.exports = { logSimple };