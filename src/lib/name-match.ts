/**
 * Helper utilities for duplicate and similar name detection.
 *
 * يستخدم في استيراد البيانات لاكتشاف:
 * - التطابق التام (case-insensitive, trimmed)
 * - التطابق التقريبي (Levenshtein distance)
 * - التطابق بعد تطبيع الحروف العربية (إزالة التشكيل، توحيد الهمزات، إلخ.)
 */

/**
 * طبّع النص العربي للمقارنة:
 * - يُزيل التشكيل
 * - يوحّد الهمزات (أ، إ، آ → ا)
 * - يوحّد الهاء/التاء المربوطة
 * - يُزيل المسافات الزائدة
 * - يُزيل الـ diacritics
 * - lowercase للإنجليزية
 */
export function normalizeArabicName(name: string): string {
  if (!name) return '';
  let s = name.toString().trim().toLowerCase();

  // أزِل التشكيل والـ diacritics
  s = s.replace(/[\u064B-\u065F\u0670]/g, ''); // تنوين، شدّة، سكون، فتحة، ضمة، كسرة

  // وحّد الهمزات
  s = s
    .replace(/[\u0622\u0623\u0625\u0627]/g, '\u0627') // آ أ إ ا → ا
    .replace(/\u0629/g, '\u0647')                    // ة → ه (تاء مربوطة → هاء)
    .replace(/\u0649/g, '\u064A')                    // ى → ي (ألف مقصورة → ياء)
    .replace(/\u0624/g, '\u0648')                    // ؤ → و
    .replace(/\u0626/g, '\u064A')                    // ئ → ي
    .replace(/\u0621/g, '');                          // همزة قطع منفصلة → احذفها

  // أزِل الـ diacritics اللاتينية (é, ç, إلخ.)
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // أزِل المسافات الزائدة
  s = s.replace(/\s+/g, ' ').trim();

  // أزِل البادئات الشائعة (ال، أبو، ابن، بنت، إلخ)
  s = s.replace(/^ال\s+/, '');

  // أزِل علامات الترقيم
  s = s.replace(/[.,;:!?'"\-_/\\()]/g, ' ').replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * حساب مسافة Levenshtein بين سلسلتين.
 * تُقاس عدد العمليات (insert/delete/replace) المطلوبة لتحويل سلسلة إلى أخرى.
 *
 * مثال:
 *   levenshtein('ahmed', 'ahmad') = 1
 *   levenshtein('محمد', 'محمود') = 1
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * نسبة التشابه بين سلسلتين (0 → 1).
 * 1 = متطابقتان
 * 0 = لا تشابه
 *
 * يحسب النسبة بناءً على:
 * 1 - (levenshtein / maxLength)
 */
export function similarity(a: string, b: string): number {
  const na = normalizeArabicName(a);
  const nb = normalizeArabicName(b);
  if (na === nb) return 1;
  if (!na.length && !nb.length) return 1;
  if (!na.length || !nb.length) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

/**
 * تحقق إن كان اسمان مكررين (متطابقين تقريباً).
 *
 * الإعداد الافتراضي:
 * - similarity threshold = 0.85 (85% أو أكثر يُعتبر مكرر)
 */
export function areNamesDuplicate(a: string, b: string, threshold = 0.85): boolean {
  return similarity(a, b) >= threshold;
}

/**
 * فئة لتتبع الأسماء الموجودة لاكتشاف التكرار.
 * تستخدم في حلقة الاستيراد:
 *
 *   const tracker = new DuplicateNameTracker(0.85);
 *   // أضِف الأسماء الموجودة من قاعدة البيانات
 *   for (const s of existingStudents) tracker.add(s.name, s.id);
 *
 *   for (const row of newRows) {
 *     const match = tracker.findMatch(row.name);
 *     if (match) {
 *       // مكرر — استخدم match.id
 *     } else {
 *       // جديد — أضفه
 *       tracker.add(row.name, newId);
 *     }
 *   }
 */
export class DuplicateNameTracker {
  private threshold: number;
  private entries: { name: string; normalized: string; id: string }[] = [];

  constructor(threshold = 0.85) {
    this.threshold = threshold;
  }

  /** أضِف اسماً للمتابعة (عادة من قاعدة البيانات) */
  add(name: string, id: string): void {
    this.entries.push({
      name,
      normalized: normalizeArabicName(name),
      id,
    });
  }

  /**
   * ابحث عن تطابق.
   * يرجع { id, matchedName, similarity } عند التطابق، أو null.
   */
  findMatch(name: string): { id: string; matchedName: string; similarity: number } | null {
    const target = normalizeArabicName(name);
    if (!target) return null;

    // 1) تطابق تام سريع
    for (const e of this.entries) {
      if (e.normalized === target) {
        return { id: e.id, matchedName: e.name, similarity: 1 };
      }
    }

    // 2) تطابق تقريبي
    let best: { id: string; matchedName: string; similarity: number } | null = null;
    for (const e of this.entries) {
      if (!e.normalized) continue;
      const sim = similarity(name, e.name);
      if (sim >= this.threshold && (!best || sim > best.similarity)) {
        best = { id: e.id, matchedName: e.name, similarity: sim };
      }
    }
    return best;
  }

  get size(): number {
    return this.entries.length;
  }
}
