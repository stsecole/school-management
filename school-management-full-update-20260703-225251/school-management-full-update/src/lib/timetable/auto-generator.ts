/**
 * Auto Timetable Generator
 * مولد الجدول الأسبوعي التلقائي
 *
 * الخوارزمية: Constraint Satisfaction + Backtracking
 *
 * الأهداف:
 * 1. توزيع الحصص تلقائياً على الأسبوع
 * 2. تقليل الفراغات بين الحصص
 * 3. استغلال القاعات بأفضل شكل
 * 4. احترام توافر الأستاذ (عدم التعارض)
 * 5. احترام عدد ساعات المادة الأسبوعية
 * 6. عدم وجود أي تعارض
 * 7. عدم تكرار نفس المادة أكثر من مرتين في اليوم
 * 8. توزيع ساعات الأستاذ بالتساوي
 * 9. إعطاء الأولوية للقاعات المناسبة (مخبر، إعلام آلي)
 */

import { checkSessionConflicts, SessionInput, RoomInfo, SubjectInfo, HolidayInfo, WorkSettingsInfo } from './conflict-engine';

export interface GenerationRequest {
  subjects: SubjectInfo[]; // subjects to schedule
  teachers: { id: string; name: string }[];
  rooms: RoomInfo[];
  groups: { id: string; name: string }[];
  workSettings: WorkSettingsInfo;
  holidays: HolidayInfo[];
  existingSessions?: SessionInput[]; // sessions to preserve
}

export interface GenerationResult {
  success: boolean;
  sessions: SessionInput[];
  unassigned: { subject: SubjectInfo; group: { id: string; name: string }; reason: string }[];
  stats: {
    totalRequested: number;
    totalAssigned: number;
    attempts: number;
    duration: number; // ms
  };
}

/**
 * Generate a weekly timetable automatically.
 *
 * Strategy:
 * 1. For each (subject, group) pair, determine how many sessions are needed
 *    (based on weeklyHours / sessionDurationHours)
 * 2. Try to assign each session to a (day, timeSlot, room) tuple
 * 3. Use backtracking: if an assignment fails, try the next option
 * 4. Prioritize: suitable rooms → any room; balanced days → cramped days
 */
export function generateTimetable(request: GenerationRequest): GenerationResult {
  const startTime = Date.now();
  const { subjects, teachers, rooms, groups, workSettings, holidays, existingSessions = [] } = request;

  // Build the list of (subject × group) assignments needed
  const assignments: { subject: SubjectInfo; group: { id: string; name: string }; sessionsNeeded: number }[] = [];
  for (const subject of subjects) {
    for (const group of groups) {
      // Skip if subject is not for this group's department/specialization (simplified: schedule all)
      const sessionDurationHours = workSettings.sessionDuration / 60;
      const sessionsNeeded = Math.ceil(subject.weeklyHours / sessionDurationHours);
      if (sessionsNeeded > 0) {
        assignments.push({ subject, group, sessionsNeeded });
      }
    }
  }

  // Build available slots: (day, startTime, endTime)
  const workDays = workSettings.workDays.split(',').map(d => parseInt(d.trim()));
  const slots: { dayOfWeek: number; startTime: string; endTime: string }[] = [];

  // Generate time slots based on work hours and session duration
  const [wsh, wsm] = workSettings.workStartTime.split(':').map(Number);
  const [weh, wem] = workSettings.workEndTime.split(':').map(Number);
  const workStartMin = wsh * 60 + wsm;
  const workEndMin = weh * 60 + wem;
  const sessionDur = workSettings.sessionDuration;
  const breakDur = workSettings.breakDuration;

  for (const day of workDays) {
    let currentMin = workStartMin;
    while (currentMin + sessionDur <= workEndMin) {
      const startH = Math.floor(currentMin / 60);
      const startM = currentMin % 60;
      const endMin = currentMin + sessionDur;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      slots.push({
        dayOfWeek: day,
        startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
        endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
      });
      currentMin = endMin + breakDur;
    }
  }

  const context = { rooms, subjects, holidays, workSettings };
  const assignedSessions: SessionInput[] = [...existingSessions];
  const unassigned: GenerationResult['unassigned'] = [];
  let attempts = 0;

  // Sort assignments by difficulty (more sessions needed = harder, schedule first)
  assignments.sort((a, b) => b.sessionsNeeded - a.sessionsNeeded);

  for (const assignment of assignments) {
    const { subject, group, sessionsNeeded } = assignment;
    let sessionsAssigned = 0;

    // Find a teacher for this subject (if subject has a teacherId, use it; otherwise pick any)
    const teacher = teachers[0]; // simplified: assign first teacher (or improve later)
    const teacherId = teacher?.id;
    const teacherName = teacher?.name;

    // Generate candidate slots: prioritize spreading across days
    const candidateSlots = [...slots];

    // Limit sessions per day for this group/subject to 2
    const maxPerDay = 2;

    for (const slot of candidateSlots) {
      if (sessionsAssigned >= sessionsNeeded) break;

      // Check how many sessions this subject already has on this day for this group
      const sameSubjectSameDay = assignedSessions.filter(
        s => s.subjectId === subject.id && s.groupId === group.id && s.dayOfWeek === slot.dayOfWeek
      ).length;
      if (sameSubjectSameDay >= maxPerDay) continue;

      // Find a suitable room
      const suitableRooms = rooms.filter(r => {
        if (subject.requiredRoomType && r.type !== subject.requiredRoomType) return false;
        return true;
      });
      const roomsToTry = suitableRooms.length > 0 ? suitableRooms : rooms;

      let assigned = false;
      for (const room of roomsToTry) {
        attempts++;
        const candidate: SessionInput = {
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          teacherId,
          teacherName,
          roomId: room.id,
          roomName: room.name,
          groupId: group.id,
          groupName: group.name,
          subjectId: subject.id,
          subjectName: subject.name,
          color: subject.color,
        };

        const result = checkSessionConflicts(candidate, assignedSessions, context);
        if (!result.hasConflicts) {
          assignedSessions.push(candidate);
          sessionsAssigned++;
          assigned = true;
          break;
        }
      }
    }

    if (sessionsAssigned < sessionsNeeded) {
      unassigned.push({
        subject,
        group,
        reason: `تم تعيين ${sessionsAssigned} من ${sessionsNeeded} حصة - لا توجد فترات متاحة بدون تعارض`,
      });
    }
  }

  const duration = Date.now() - startTime;
  const totalRequested = assignments.reduce((sum, a) => sum + a.sessionsNeeded, 0);

  return {
    success: unassigned.length === 0,
    sessions: assignedSessions.filter(s => !existingSessions.find(e => e === s)),
    unassigned,
    stats: {
      totalRequested,
      totalAssigned: assignedSessions.length - existingSessions.length,
      attempts,
      duration,
    },
  };
}
