// ===== GET /api/institution-settings/public =====
// عام (بدون مصادقة) — يستخدم في صفحة تسجيل الدخول
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEYS = [
  'institution_name',
  'institution_tagline',
  'institution_logo_url',
  'institution_address',
  'institution_phone',
  'institution_email',
  'institution_footer',
];

const DEFAULTS: Record<string, string> = {
  institution_name: 'نظام إدارة المؤسسة التعليمية',
  institution_tagline: 'منصة الإدارة المتكاملة',
  institution_logo_url: '',
  institution_address: '',
  institution_phone: '',
  institution_email: '',
  institution_footer: '',
};

export async function GET() {
  try {
    const rows = await db.setting.findMany({ where: { key: { in: KEYS } } });
    const result: Record<string, string> = { ...DEFAULTS };
    for (const r of rows) result[r.key] = r.value;
    return NextResponse.json({ settings: result });
  } catch (error: any) {
    console.error('GET /api/institution-settings/public error:', error);
    return NextResponse.json({ settings: DEFAULTS });
  }
}
