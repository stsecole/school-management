/**
 * Step 3: Restore attendance data from backup
 * - Parses old `duration` (hours) and `timeSlot` ("08:00 - 10:00")
 * - Computes startTime, endTime, durationMinutes for the new schema
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const db = new PrismaClient();

interface OldAttendance {
  id: string;
  date: string;
  courseId: string | null;
  courseName: string;
  level: string | null;
  timeSlot: string | null;
  teacherId: string | null;
  teacherName: string | null;
  totalCount: number;
  maleCount: number;
  femaleCount: number;
  duration: number; // hours
  unpaidCount: number;
  notes: string | null;
  studentId: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseTime(timeStr: string): { h: number; m: number } | null {
  const m = timeStr.match(/^(\d{1,2}):(\d{0,2})$/);
  if (!m) return null;
  return { h: parseInt(m[1]), m: m[2] ? parseInt(m[2]) : 0 };
}

function computeDuration(start: string, end: string): number {
  const s = parseTime(start);
  const e = parseTime(end);
  if (!s || !e) return 0;
  let mins = (e.h * 60 + e.m) - (s.h * 60 + s.m);
  if (mins < 0) mins += 24 * 60; // overnight
  return mins;
}

function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function main() {
  console.log('🔄 Restoring attendance data from backup...');

  const backupPath = '/home/z/my-project/scripts/attendance-backup.json';
  const records: OldAttendance[] = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  console.log(`→ Found ${records.length} records to restore`);

  let restored = 0;
  for (const r of records) {
    let startTime: string | null = null;
    let endTime: string | null = null;
    let durationMinutes = 0;

    // Try to parse from timeSlot first
    if (r.timeSlot) {
      const match = r.timeSlot.match(/(\d{1,2})[:：]?(\d{0,2})\s*[-–]\s*(\d{1,2})[:：]?(\d{0,2})/);
      if (match) {
        const sH = parseInt(match[1]);
        const sM = match[2] ? parseInt(match[2]) : 0;
        const eH = parseInt(match[3]);
        const eM = match[4] ? parseInt(match[4]) : 0;
        startTime = formatTime(sH, sM);
        endTime = formatTime(eH, eM);
        durationMinutes = computeDuration(startTime, endTime);
      }
    }

    // Fallback: use old `duration` (in hours), default start 08:00
    if (!startTime || !endTime) {
      const hours = r.duration || 2;
      startTime = '08:00';
      const endMin = 8 * 60 + hours * 60;
      endTime = formatTime(Math.floor(endMin / 60), endMin % 60);
      durationMinutes = hours * 60;
    }

    const timeSlotDisplay = `${startTime} - ${endTime}`;

    await db.attendance.update({
      where: { id: r.id },
      data: {
        startTime,
        endTime,
        timeSlot: timeSlotDisplay,
        durationMinutes,
      },
    });
    restored++;
  }

  console.log(`✅ Restored ${restored} records`);

  // Verify a few
  const sample = await db.attendance.findMany({ take: 3 });
  console.log('\nSample of restored records:');
  for (const s of sample) {
    console.log(`  - ${s.courseName}: ${s.startTime} → ${s.endTime} = ${s.durationMinutes} min (${Math.floor(s.durationMinutes / 60)}h ${s.durationMinutes % 60}m)`);
  }

  await db.$disconnect();
}

main().catch(e => {
  console.error('❌ Restore failed:', e);
  process.exit(1);
});
