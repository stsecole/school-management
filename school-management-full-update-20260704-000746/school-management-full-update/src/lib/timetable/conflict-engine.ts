/**
 * Timetable Conflict Engine
 * محرك اكتشاف التعارضات في الجدول الأسبوعي
 *
 * يكتشف الأنواع التالية من التعارضات:
 * 1. تعارض الأستاذ (Teacher Conflict)
 * 2. تعارض القاعة (Room Conflict)
 * 3. تعارض الفوج (Group Conflict)
 * 4. تجاوز ساعات الأستاذ (Teacher Hours Exceeded)
 * 5. تجاوز ساعات المادة (Subject Hours Exceeded)
 * 6. الحصص خارج أوقات العمل (Out of Work Hours)
 * 7. العطل الرسمية (Holiday Conflict)
 * 8. القاعات غير المناسبة للمادة (Unsuitable Room)
 */

export interface SessionInput {
  id?: string;
  dayOfWeek: number; // 0=الأحد, 6=السبت
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  teacherId?: string;
  teacherName?: string;
  roomId?: string;
  roomName?: string;
  groupId?: string;
  groupName?: string;
  subjectId?: string;
  subjectName?: string;
  notes?: string;
}

export interface RoomInfo {
  id: string;
  name: string;
  type: string; // "classroom" | "lab" | "computer_lab" | "amphitheater"
  capacity: number;
}

export interface SubjectInfo {
  id: string;
  name: string;
  weeklyHours: number;
  requiredRoomType?: string | null;
}

export interface HolidayInfo {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface WorkSettingsInfo {
  workDays: string; // "0,1,2,3,4"
  workStartTime: string; // "08:00"
  workEndTime: string; // "18:00"
  maxTeacherHoursPerWeek: number;
  maxSessionsPerDay: number;
}

export interface ConflictResult {
  hasConflicts: boolean;
  errors: ConflictError[];
  warnings: ConflictWarning[];
}

export interface ConflictError {
  type: string;
  message: string;
  severity: 'error' | 'warning';
  details?: any;
}

export type ConflictWarning = ConflictError;

/**
 * Parse "HH:MM" → minutes since midnight.
 */
function parseTimeToMinutes(time: string): number | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Check if two time ranges overlap on the same day.
 */
function timesOverlap(
  start1: string, end1: string,
  start2: string, end2: string
): boolean {
  const s1 = parseTimeToMinutes(start1);
  const e1 = parseTimeToMinutes(end1);
  const s2 = parseTimeToMinutes(start2);
  const e2 = parseTimeToMinutes(end2);
  if (s1 === null || e1 === null || s2 === null || e2 === null) return false;
  return s1 < e2 && s2 < e1;
}

/**
 * Calculate session duration in minutes.
 */
function sessionDurationMinutes(startTime: string, endTime: string): number {
  const s = parseTimeToMinutes(startTime);
  const e = parseTimeToMinutes(endTime);
  if (s === null || e === null) return 0;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/**
 * Get the name of a day from its number.
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return days[dayOfWeek] || 'غير معروف';
}

/**
 * Main entry point: check a session against all existing sessions and rules.
 *
 * @param session The session to validate (new or edited)
 * @param existingSessions All sessions currently in the database (excluding the one being edited)
 * @param context Additional context: rooms, subjects, holidays, work settings
 */
export function checkSessionConflicts(
  session: SessionInput,
  existingSessions: SessionInput[],
  context: {
    rooms: RoomInfo[];
    subjects: SubjectInfo[];
    holidays: HolidayInfo[];
    workSettings: WorkSettingsInfo;
  }
): ConflictResult {
  const errors: ConflictError[] = [];
  const warnings: ConflictWarning[] = [];

  // ===== 1. التحقق من أوقات العمل =====
  const workDays = context.workSettings.workDays.split(',').map(d => parseInt(d.trim()));
  if (!workDays.includes(session.dayOfWeek)) {
    errors.push({
      type: 'OUT_OF_WORK_HOURS',
      message: `⚠ يوم ${getDayName(session.dayOfWeek)} ليس ضمن أيام العمل الرسمية`,
      severity: 'error',
      details: { dayOfWeek: session.dayOfWeek, workDays },
    });
  }

  // Check if session is within work hours
  const workStart = parseTimeToMinutes(context.workSettings.workStartTime);
  const workEnd = parseTimeToMinutes(context.workSettings.workEndTime);
  const sessStart = parseTimeToMinutes(session.startTime);
  const sessEnd = parseTimeToMinutes(session.endTime);
  if (workStart !== null && workEnd !== null && sessStart !== null && sessEnd !== null) {
    if (sessStart < workStart || sessEnd > workEnd) {
      errors.push({
        type: 'OUT_OF_WORK_HOURS',
        message: `⚠ الحصة خارج أوقات العمل (${context.workSettings.workStartTime} - ${context.workSettings.workEndTime})`,
        severity: 'error',
        details: { startTime: session.startTime, endTime: session.endTime },
      });
    }
  }

  // Check max sessions per day for the group
  const groupSessionsToday = existingSessions.filter(
    s => s.groupId && s.groupId === session.groupId && s.dayOfWeek === session.dayOfWeek
  );
  if (groupSessionsToday.length >= context.workSettings.maxSessionsPerDay) {
    warnings.push({
      type: 'MAX_SESSIONS_PER_DAY',
      message: `⚠ تجاوز عدد الحصص اليومي المسموح (${context.workSettings.maxSessionsPerDay}) للفوج ${session.groupName || ''}`,
      severity: 'warning',
    });
  }

  // ===== 2. تعارض الأستاذ =====
  if (session.teacherId) {
    const teacherConflicts = existingSessions.filter(s => {
      if (s.id === session.id) return false;
      if (s.teacherId !== session.teacherId) return false;
      if (s.dayOfWeek !== session.dayOfWeek) return false;
      return timesOverlap(session.startTime, session.endTime, s.startTime, s.endTime);
    });

    if (teacherConflicts.length > 0) {
      const conflict = teacherConflicts[0];
      errors.push({
        type: 'TEACHER_CONFLICT',
        message: `❌ الأستاذ ${session.teacherName || ''} مشغول في هذا التوقيت (${conflict.startTime}-${conflict.endTime})`,
        severity: 'error',
        details: { teacherId: session.teacherId, conflictWith: conflict },
      });
    }

    // ===== 4. تجاوز ساعات الأستاذ =====
    const teacherWeeklyMinutes = existingSessions
      .filter(s => s.teacherId === session.teacherId)
      .reduce((sum, s) => sum + sessionDurationMinutes(s.startTime, s.endTime), 0);
    const newSessionMinutes = sessionDurationMinutes(session.startTime, session.endTime);
    const totalMinutes = teacherWeeklyMinutes + newSessionMinutes;
    const maxMinutes = context.workSettings.maxTeacherHoursPerWeek * 60;

    if (totalMinutes > maxMinutes) {
      errors.push({
        type: 'TEACHER_HOURS_EXCEEDED',
        message: `⚠ تجاوز الأستاذ ${session.teacherName || ''} الحد الأسبوعي (${context.workSettings.maxTeacherHoursPerWeek} ساعة)`,
        severity: 'error',
        details: {
          currentHours: teacherWeeklyMinutes / 60,
          newSessionHours: newSessionMinutes / 60,
          totalHours: totalMinutes / 60,
          maxHours: context.workSettings.maxTeacherHoursPerWeek,
        },
      });
    }
  }

  // ===== 3. تعارض القاعة =====
  if (session.roomId) {
    const roomConflicts = existingSessions.filter(s => {
      if (s.id === session.id) return false;
      if (s.roomId !== session.roomId) return false;
      if (s.dayOfWeek !== session.dayOfWeek) return false;
      return timesOverlap(session.startTime, session.endTime, s.startTime, s.endTime);
    });

    if (roomConflicts.length > 0) {
      const conflict = roomConflicts[0];
      errors.push({
        type: 'ROOM_CONFLICT',
        message: `❌ القاعة ${session.roomName || ''} محجوزة في هذا التوقيت (${conflict.startTime}-${conflict.endTime})`,
        severity: 'error',
        details: { roomId: session.roomId, conflictWith: conflict },
      });
    }

    // ===== 8. القاعات غير المناسبة للمادة =====
    if (session.subjectId) {
      const subject = context.subjects.find(s => s.id === session.subjectId);
      const room = context.rooms.find(r => r.id === session.roomId);
      if (subject && room && subject.requiredRoomType && room.type !== subject.requiredRoomType) {
        const roomTypeNames: Record<string, string> = {
          classroom: 'قاعة عادية',
          lab: 'مخبر',
          computer_lab: 'مخبر إعلام آلي',
          amphitheater: 'مدرج',
        };
        errors.push({
          type: 'UNSUITABLE_ROOM',
          message: `❌ القاعة ${session.roomName} (${roomTypeNames[room.type] || room.type}) غير مناسبة للمادة ${session.subjectName} (تتطلب ${roomTypeNames[subject.requiredRoomType] || subject.requiredRoomType})`,
          severity: 'error',
          details: { roomId: session.roomId, requiredType: subject.requiredRoomType, actualType: room.type },
        });
      }
    }
  }

  // ===== 5. تعارض الفوج =====
  if (session.groupId) {
    const groupConflicts = existingSessions.filter(s => {
      if (s.id === session.id) return false;
      if (s.groupId !== session.groupId) return false;
      if (s.dayOfWeek !== session.dayOfWeek) return false;
      return timesOverlap(session.startTime, session.endTime, s.startTime, s.endTime);
    });

    if (groupConflicts.length > 0) {
      const conflict = groupConflicts[0];
      errors.push({
        type: 'GROUP_CONFLICT',
        message: `❌ الفوج ${session.groupName || ''} لديه حصة أخرى في هذا التوقيت (${conflict.startTime}-${conflict.endTime})`,
        severity: 'error',
        details: { groupId: session.groupId, conflictWith: conflict },
      });
    }
  }

  // ===== 6. تجاوز ساعات المادة =====
  if (session.subjectId) {
    const subject = context.subjects.find(s => s.id === session.subjectId);
    if (subject) {
      const subjectWeeklyMinutes = existingSessions
        .filter(s => s.subjectId === session.subjectId && s.groupId === session.groupId)
        .reduce((sum, s) => sum + sessionDurationMinutes(s.startTime, s.endTime), 0);
      const newSessionMinutes = sessionDurationMinutes(session.startTime, session.endTime);
      const totalMinutes = subjectWeeklyMinutes + newSessionMinutes;
      const maxMinutes = subject.weeklyHours * 60;

      if (totalMinutes > maxMinutes) {
        warnings.push({
          type: 'SUBJECT_HOURS_EXCEEDED',
          message: `⚠ تجاوز عدد ساعات المادة ${session.subjectName} (${subject.weeklyHours} ساعات أسبوعية)`,
          severity: 'warning',
          details: {
            currentHours: subjectWeeklyMinutes / 60,
            newSessionHours: newSessionMinutes / 60,
            totalHours: totalMinutes / 60,
            maxHours: subject.weeklyHours,
          },
        });
      } else if (totalMinutes < maxMinutes) {
        warnings.push({
          type: 'SUBJECT_HOURS_INCOMPLETE',
          message: `⚠ عدد ساعات المادة ${session.subjectName} غير مكتمل (${totalMinutes / 60}/${subject.weeklyHours} ساعة)`,
          severity: 'warning',
        });
      }
    }
  }

  // ===== 7. العطل الرسمية =====
  // For weekly timetable, we check if the day name matches a holiday name
  // (since holidays are date-based but timetable is weekly)
  // We'll warn if there's a holiday that falls on this day of the week during the current period
  const today = new Date();
  const sessionDayName = getDayName(session.dayOfWeek);
  for (const holiday of context.holidays) {
    // Check if holiday is currently active or upcoming
    if (holiday.endDate >= today) {
      // Check if any day in the holiday range matches our session's day of week
      const start = new Date(holiday.startDate);
      const end = new Date(holiday.endDate);
      const tempDate = new Date(start);
      while (tempDate <= end) {
        if (tempDate.getDay() === session.dayOfWeek) {
          warnings.push({
            type: 'HOLIDAY_CONFLICT',
            message: `⚠ يوم ${sessionDayName} يصادف عطلة "${holiday.name}" (${tempDate.toISOString().split('T')[0]})`,
            severity: 'warning',
            details: { holidayId: holiday.id, holidayName: holiday.name, date: tempDate.toISOString() },
          });
          break;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
    }
  }

  // ===== تكرار المادة في نفس اليوم =====
  if (session.subjectId && session.groupId) {
    const sameSubjectSameDay = existingSessions.filter(
      s => s.subjectId === session.subjectId && s.groupId === session.groupId && s.dayOfWeek === session.dayOfWeek
    );
    if (sameSubjectSameDay.length >= 2) {
      warnings.push({
        type: 'SUBJECT_REPEATED_SAME_DAY',
        message: `⚠ المادة ${session.subjectName} مكررة أكثر من مرتين في نفس اليوم للفوج ${session.groupName}`,
        severity: 'warning',
      });
    }
  }

  const hasConflicts = errors.length > 0;
  return { hasConflicts, errors, warnings };
}

/**
 * Get all conflicts for a batch of sessions (e.g., for statistics or validation).
 */
export function validateAllSessions(
  sessions: SessionInput[],
  context: {
    rooms: RoomInfo[];
    subjects: SubjectInfo[];
    holidays: HolidayInfo[];
    workSettings: WorkSettingsInfo;
  }
): ConflictResult {
  const allErrors: ConflictError[] = [];
  const allWarnings: ConflictWarning[] = [];

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const others = sessions.filter((_, j) => j !== i);
    const result = checkSessionConflicts(session, others, context);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    hasConflicts: allErrors.length > 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
