/**
 * ===== محرك حساب التقدم للأهداف (Progress Engine) =====
 *
 * يدعم ثلاث طرق لحساب التقدم:
 * 1. formula:   يحسب بالمعادلة (actual - baseline) / (target - baseline)
 * 2. milestones: مجموع أوزان المعالم المكتملة
 * 3. manual:    يُرجع النسبة المسجلة يدويًا في حقل `actual`
 *
 * يدعم الاتجاهين:
 * - higher-is-better: القيمة الأعلى أفضل
 * - lower-is-better: القيمة الأقل أفضل (مثل معدل الانقطاع)
 *
 * كما يوفّر:
 * - calculateWeightedScore: متوسط مرجّح للنتيجة عبر مجموعة أهداف
 * - validateWeightsSum:    التحقق من أن مجموع الأوزان = 100
 */

export interface ProgressGoalLike {
  progressMethod?: string | null; // formula | milestones | manual
  direction?: string | null;      // higher-is-better | lower-is-better
  baseline?: number | null;
  target?: number | null;
  actual?: number | null;
  weight?: number | null;
  milestones?: { weight?: number | null; completed?: boolean }[];
}

export interface ProgressResult {
  /** نسبة التقدّم 0-100 */
  progress: number;
  /** حالة الهدف: on-track | ahead | at-risk | behind | completed | not-started */
  status: ProgressStatus;
  /** شرح موجز */
  label: string;
}

export type ProgressStatus =
  | 'not-started'
  | 'behind'
  | 'at-risk'
  | 'on-track'
  | 'ahead'
  | 'completed';

/** منع القيم الشاذة (NaN / Infinity / سالب) */
function clamp(value: number, min = 0, max = 100): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** تحويل قيمة إلى رقم آمن */
function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * حساب التقدم لهدف فردي.
 *
 * @param goal  بيانات الهدف (مع المعالم إن وجدت)
 * @returns     كائن بنتيجة التقدم والحالة والوصف
 */
export function calculateProgress(goal: ProgressGoalLike): ProgressResult {
  const method = (goal.progressMethod || 'formula').toLowerCase();
  const direction = (goal.direction || 'higher-is-better').toLowerCase();

  let progress = 0;

  if (method === 'milestones') {
    progress = computeMilestoneProgress(goal.milestones || []);
  } else if (method === 'manual') {
    progress = clamp(toNum(goal.actual));
  } else {
    // formula (الافتراضي)
    progress = computeFormulaProgress(goal, direction);
  }

  progress = clamp(progress);

  // ===== تحديد الحالة =====
  let status: ProgressStatus = 'not-started';
  let label = 'لم يبدأ بعد';

  if (progress >= 100) {
    status = 'completed';
    label = 'مكتمل';
  } else if (progress === 0) {
    status = 'not-started';
    label = 'لم يبدأ بعد';
  } else if (progress >= 80) {
    status = 'ahead';
    label = 'متقدم';
  } else if (progress >= 50) {
    status = 'on-track';
    label = 'على المسار';
  } else if (progress >= 25) {
    status = 'at-risk';
    label = 'معرّض للخطر';
  } else {
    status = 'behind';
    label = 'متأخر';
  }

  return { progress, status, label };
}

/**
 * حساب التقدم بطريقة المعادلة (formula)
 * - higher-is-better: (actual - baseline) / (target - baseline) * 100
 * - lower-is-better:  (baseline - actual) / (baseline - target) * 100
 */
function computeFormulaProgress(goal: ProgressGoalLike, direction: string): number {
  const baseline = toNum(goal.baseline);
  const target = toNum(goal.target);
  const actual = toNum(goal.actual);

  if (direction === 'lower-is-better') {
    // يجب أن يكون baseline > target للاتجاه "lower-is-better"
    const denom = baseline - target;
    if (denom === 0) {
      // إذا تساوى baseline و target، اعتبر الهدف مكتملًا إذا actual <= target
      return actual <= target ? 100 : 0;
    }
    const numerator = baseline - actual;
    return (numerator / denom) * 100;
  }

  // higher-is-better
  const denom = target - baseline;
  if (denom === 0) {
    // baseline = target → اعتبر الهدف مكتملًا إذا actual >= target
    return actual >= target ? 100 : 0;
  }
  const numerator = actual - baseline;
  return (numerator / denom) * 100;
}

/**
 * حساب التقدم من خلال المعالم (milestones)
 * مجموع أوزان المعالم المكتملة (مفترض أن المجموع = 100)
 */
function computeMilestoneProgress(
  milestones: { weight?: number | null; completed?: boolean }[]
): number {
  if (!milestones.length) return 0;
  const totalWeight = milestones.reduce((sum, m) => sum + toNum(m.weight), 0);
  if (totalWeight === 0) {
    // إذا لم تُحدد أوزان، استخدم المتوسط البسيط (عدد المكتمل / العدد الكلي)
    const done = milestones.filter(m => m.completed).length;
    return (done / milestones.length) * 100;
  }
  const doneWeight = milestones
    .filter(m => m.completed)
    .reduce((sum, m) => sum + toNum(m.weight), 0);
  return (doneWeight / totalWeight) * 100;
}

/**
 * المتوسط المرجّح لنتيجة الأهداف.
 * مجموع (progress * weight) / مجموع (weight)
 */
export function calculateWeightedScore(goals: ProgressGoalLike[]): {
  weightedScore: number;
  totalWeight: number;
  averageProgress: number;
  goalCount: number;
} {
  if (!goals.length) {
    return { weightedScore: 0, totalWeight: 0, averageProgress: 0, goalCount: 0 };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  let progressSum = 0;

  for (const goal of goals) {
    const { progress } = calculateProgress(goal);
    const weight = toNum(goal.weight);
    weightedSum += progress * weight;
    totalWeight += weight;
    progressSum += progress;
  }

  const weightedScore = totalWeight > 0 ? weightedSum / totalWeight : progressSum / goals.length;
  const averageProgress = progressSum / goals.length;

  return {
    weightedScore: clamp(weightedScore),
    totalWeight,
    averageProgress: clamp(averageProgress),
    goalCount: goals.length,
  };
}

/**
 * التحقق من أن مجموع الأوزان = 100%.
 * يُرجع قائمة بالأخطاء والتحذيرات.
 */
export function validateWeightsSum(
  goals: { weight?: number | null; title?: string | null }[]
): {
  valid: boolean;
  total: number;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let total = 0;

  for (const g of goals) {
    const w = toNum(g.weight);
    if (w < 0) {
      errors.push(`وزن سالب في الهدف: ${g.title || '?'}`);
    }
    if (w > 100) {
      warnings.push(`وزن أكبر من 100 في الهدف: ${g.title || '?'}`);
    }
    total += w;
  }

  // نسمح بفارق صغير بسبب أرقام عشرية
  const tolerance = 0.5;
  if (goals.length > 0 && Math.abs(total - 100) > tolerance) {
    if (total < 100) {
      warnings.push(`مجموع الأوزان (${total.toFixed(2)}) أقل من 100`);
    } else {
      warnings.push(`مجموع الأوزان (${total.toFixed(2)}) أكبر من 100`);
    }
  }

  return {
    valid: errors.length === 0,
    total,
    errors,
    warnings,
  };
}

/**
 * تصنيف الهدف حسب القرب من تاريخ الاستحقاق وحالته الحالية.
 */
export function classifyGoalHealth(
  goal: ProgressGoalLike & { dueDate?: string | Date | null; status?: string | null }
): {
  health: 'healthy' | 'warning' | 'critical';
  daysToDue: number | null;
  message: string;
} {
  const { progress, status } = calculateProgress(goal);

  if (goal.status === 'completed' || progress >= 100) {
    return { health: 'healthy', daysToDue: null, message: 'الهدف مكتمل' };
  }

  let daysToDue: number | null = null;
  if (goal.dueDate) {
    const due = new Date(goal.dueDate);
    const now = new Date();
    daysToDue = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (daysToDue !== null && daysToDue < 0) {
    return {
      health: 'critical',
      daysToDue,
      message: `متأخر بـ ${Math.abs(daysToDue)} يوم`,
    };
  }

  // قاعدة بسيطة: يجب أن يكون التقدم على الأقل proportionnel مع الوقت المنقضي
  if (daysToDue !== null && daysToDue <= 14 && progress < 75) {
    return {
      health: 'critical',
      daysToDue,
      message: `اقترب الموعد النهائي والتقدّم ${progress.toFixed(0)}%`,
    };
  }

  if (status === 'behind' || status === 'at-risk') {
    return { health: 'warning', daysToDue, message: `التقدّم ${progress.toFixed(0)}% — ${status}` };
  }

  return { health: 'healthy', daysToDue, message: `التقدّم ${progress.toFixed(0)}%` };
}

/** ترجمة عربية للحالات */
export const progressStatusLabels: Record<ProgressStatus, string> = {
  'not-started': 'لم يبدأ',
  behind: 'متأخر',
  'at-risk': 'معرّض للخطر',
  'on-track': 'على المسار',
  ahead: 'متقدم',
  completed: 'مكتمل',
};

/** ألوان tailwind لكل حالة */
export const progressStatusColors: Record<ProgressStatus, string> = {
  'not-started': 'bg-gray-100 text-gray-700 border-gray-200',
  behind: 'bg-red-100 text-red-700 border-red-200',
  'at-risk': 'bg-amber-100 text-amber-700 border-amber-200',
  'on-track': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ahead: 'bg-teal-100 text-teal-700 border-teal-200',
  completed: 'bg-emerald-600 text-white border-emerald-700',
};
