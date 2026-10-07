/**
 * Migration script: convert Attendance.duration (hours) to startTime/endTime/durationMinutes
 * - Reads existing attendance records (with old `duration` field in hours)
 * - Generates startTime/endTime pairs based on duration
 * - Computes durationMinutes
 * - This is a one-time migration. Safe to run multiple times.
 */

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  console.log('🔄 Starting attendance migration...');

  // First, get all existing attendance records (raw, to access the old `duration` column)
  const records = await db.$queryRaw<Array<{
    id: string;
    timeSlot: string | null;
    duration: number | null;
  }>>`SELECT id, timeSlot, duration FROM Attendance`;

  console.log(`→ Found ${records.length} attendance records`);

  let migrated = 0;
  let skipped = 0;

  for (const r of records) {
    let startTime: string | null = null;
    let endTime: string | null = null;
    let durationMinutes = 0;

    // Try to parse existing timeSlot (formats like "08:00 - 10:00" or "8 - 10")
    if (r.timeSlot) {
      const match = r.timeSlot.match(/(\d{1,2})[:：]?(\d{0,2})\s*[-–]\s*(\d{1,2})[:：]?(\d{0,2})/);
      if (match) {
        const startH = parseInt(match[1]);
        const startM = match[2] ? parseInt(match[2]) : 0;
        const endH = parseInt(match[3]);
        const endM = match[4] ? parseInt(match[4]) : 0;
        startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
        endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (durationMinutes < 0) durationMinutes += 24 * 60; // overnight
      }
    }

    // If we couldn't parse from timeSlot, use the old duration field
    if (!startTime || !endTime) {
      const hours = r.duration || 2;
      const startH = 8; // Default start 08:00
      startTime = `${String(startH).padStart(2, '0')}:00`;
      const endTotalMin = startH * 60 + hours * 60;
      const endH = Math.floor(endTotalMin / 60);
      const endM = endTotalMin % 60;
      endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      durationMinutes = hours * 60;
    }

    if (durationMinutes < 0) durationMinutes = 0;

    // Update via raw SQL since Prisma client doesn't yet know the new fields
    await db.$executeRaw`UPDATE Attendance 
      SET startTime = ${startTime}, 
          endTime = ${endTime}, 
          durationMinutes = ${durationMinutes},
          timeSlot = ${startTime + ' - ' + endTime}
      WHERE id = ${r.id}`;

    migrated++;
  }

  console.log(`✅ Migrated ${migrated} records, skipped ${skipped}`);

  // Verify
  const sample = await db.$queryRaw<Array<{ id: string; startTime: string | null; endTime: string | null; durationMinutes: number | null; timeSlot: string | null }>>`SELECT id, startTime, endTime, durationMinutes, timeSlot FROM Attendance LIMIT 5`;
  console.log('\nSample of migrated records:');
  for (const s of sample) {
    console.log(`  - ${s.id}: ${s.startTime} → ${s.endTime} = ${s.durationMinutes} min (${s.timeSlot})`);
  }

  await db.$disconnect();
}

main().catch(e => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
