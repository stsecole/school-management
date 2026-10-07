const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function logAction(userId, userName, action, module, description) {
  try {
    await db.activityLog.create({
      data: { userId, userName, action, module, description }
    });
    console.log('[LOG OK]', action, '-', description);
  } catch (e) {
    console.error('[LOG ERROR]', e.message);
  }
}

module.exports = { logAction };