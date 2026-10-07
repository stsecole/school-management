import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * تشفير كلمة المرور باستخدام bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * التحقق من كلمة المرور مقابل النص المشفّر
 * يدعم أيضاً كلمات المرور غير المشفّرة (للتوافق مع البيانات القديمة)
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  // إذا كانت كلمة المرور مشفّرة بـ bcrypt (تبدأ بـ $2)
  if (hashedPassword.startsWith('$2')) {
    return bcrypt.compare(password, hashedPassword);
  }
  // توافق مع البيانات القديمة (نص عادي)
  return password === hashedPassword;
}

/**
 * التحقق مما إذا كانت كلمة المرور مشفّرة بـ bcrypt
 */
export function isHashed(password: string): boolean {
  return password.startsWith('$2');
}

/**
 * سياسة كلمات المرور القوية
 * - 8 أحرف على الأقل
 * - تحتوي على حرف كبير وحرف صغير
 * - تحتوي على رقم
 * - تحتوي على رمز خاص (اختياري لكن موصى به)
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على حرف صغير (a-z)');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على حرف كبير (A-Z)');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على رقم (0-9)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * قوة كلمة المرور (0-4)
 */
export function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const levels = [
    { label: 'ضعيفة جداً', color: 'bg-red-500' },
    { label: 'ضعيفة', color: 'bg-red-400' },
    { label: 'متوسطة', color: 'bg-amber-400' },
    { label: 'جيدة', color: 'bg-blue-400' },
    { label: 'قوية', color: 'bg-emerald-500' },
  ];

  return {
    score: Math.min(score, 4),
    label: levels[Math.min(score, 4)].label,
    color: levels[Math.min(score, 4)].color,
  };
}
