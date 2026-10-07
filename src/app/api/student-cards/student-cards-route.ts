import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import * as QRCode from 'qrcode';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Convert a photoUrl (relative path like "/uploads/students/x.jpg") to a base64
 * data URI that can be embedded directly in <img src="...">. This avoids any
 * HTTP request when the page loads, so:
 *  - No 404 if the file is missing
 *  - No timing issues with print (image is already in the HTML)
 *  - Works in all PDF generators
 *
 * Returns null if the photo doesn't exist or can't be read.
 */
async function photoToDataUrl(photoUrl: string | null | undefined): Promise<string | null> {
  if (!photoUrl) return null;

  // Already a data URI or absolute URL — return as-is
  if (photoUrl.startsWith('data:')) return photoUrl;
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) return photoUrl;

  // Relative path like "/uploads/students/x.jpg" → read from public/
  if (photoUrl.startsWith('/')) {
    try {
      const filePath = path.join(process.cwd(), 'public', photoUrl);
      if (!existsSync(filePath)) {
        console.warn('Photo file not found:', filePath);
        return null;
      }
      const buffer = await readFile(filePath);
      // Determine MIME type from extension
      const ext = path.extname(photoUrl).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
      };
      const mime = mimeMap[ext] || 'image/jpeg';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (err) {
      console.error('Error reading photo:', photoUrl, err);
      return null;
    }
  }

  return null;
}

/**
 * GET /api/student-cards?id=xxx — بطاقة طالب واحد
 * GET /api/student-cards?departmentId=xxx — كل بطاقات قسم
 * GET /api/student-cards?all=true — كل البطاقات
 *
 * يُرجع صفحة HTML قابلة للطباعة ببطاقات هوية احترافية
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const departmentId = searchParams.get('departmentId');
    const all = searchParams.get('all') === 'true';

    let where: any = { status: { in: ['registered', 'continuing'] } };
    if (id) {
      // Accept: internal CUID, studentNumber (e.g. "STU-2026-001"), or name
      // CUIDs start with a letter and are 20+ chars; anything shorter is treated
      // as a student number. We also fall back to a name match.
      const isCuid = /^[a-z0-9]{20,}$/i.test(id);
      if (isCuid) {
        where = { id };
      } else {
        where = {
          OR: [
            { studentNumber: id },
            { studentNumber: { equals: id, mode: 'insensitive' } },
            { name: { equals: id, mode: 'insensitive' } },
            { name: { contains: id, mode: 'insensitive' } },
          ],
        };
      }
    } else if (departmentId) {
      // departmentId can be either a CUID or a department name (legacy)
      const isDeptCuid = /^[a-z0-9]{20,}$/i.test(departmentId);
      where.departmentId = isDeptCuid ? departmentId : undefined;
      if (!isDeptCuid) {
        where.department = { name: { equals: departmentId, mode: 'insensitive' } };
      }
    }

    const students = await db.student.findMany({
      where,
      include: { department: true, level: true, specialization: true },
      take: id ? 1 : 100,
      orderBy: { name: 'asc' },
    });

    if (students.length === 0) {
      return new Response(
        `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>لا يوجد طالب</title>
        <style>body{font-family:'Segoe UI',Tahoma,sans-serif;text-align:center;padding:60px;background:#f5f5f5;color:#666}
        h1{color:#dc2626;font-size:24px;margin-bottom:8px}p{font-size:14px;color:#999}
        .icon{font-size:64px;margin-bottom:16px}</style></head>
        <body><div class="icon">🔍</div><h1>لا يوجد طالب مطابق</h1>
        <p>تأكد من إدخال الاسم أو رقم الطالب بشكل صحيح</p>
        <p style="margin-top:8px;font-size:12px">يمكنك البحث بالاسم الكامل أو رقم التسجيل</p>
        </body></html>`,
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // ولّد QR Code لكل طالب
    const cardsHtml = await Promise.all(students.map(async (s) => {
      const qrData = JSON.stringify({
        id: s.id,
        name: s.name,
        studentNumber: s.studentNumber,
        department: s.department?.name,
      });
      const qrBase64 = await QRCode.toDataURL(qrData, { width: 120, margin: 1 });

      // Convert photoUrl to base64 data URI (embedded directly in HTML — no HTTP request needed)
      const photoDataUrl = await photoToDataUrl(s.photoUrl);

      // Escape name for safe HTML attribute
      const safeName = (s.name || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      const initial = safeName.charAt(0) || '?';

      // Build photo HTML: large photo if photoDataUrl exists, otherwise placeholder
      const photoHtml = photoDataUrl
        ? `<img src="${photoDataUrl}" alt="${safeName}" class="student-photo" />`
        : `<div class="photo-placeholder">${initial}</div>`;

      return `
      <div class="card">
        <div class="card-header">
          <div class="school-logo">🏫</div>
          <div class="school-info">
            <div class="school-name">مدرسة السلامة</div>
            <div class="school-subtitle">مركز التكوين المهني</div>
          </div>
        </div>
        <div class="card-body">
          <div class="photo-area">
            ${photoHtml}
          </div>
          <div class="info-area">
            <div class="student-name">${safeName}</div>
            <div class="student-number">${s.studentNumber || '—'}</div>
            <div class="detail-row"><span class="label">القسم:</span> <span class="value">${s.department?.name || '—'}</span></div>
            <div class="detail-row"><span class="label">المستوى:</span> <span class="value">${s.level?.name || '—'}</span></div>
            <div class="detail-row"><span class="label">التخصص:</span> <span class="value">${s.specialization?.name || '—'}</span></div>
            <div class="detail-row"><span class="label">الهاتف:</span> <span class="value">${s.phone || '—'}</span></div>
          </div>
        </div>
        <div class="card-footer">
          <img src="${qrBase64}" alt="QR" class="qr-code" />
          <div class="validity">
            <div>صالحة للدراسة</div>
            <div>2026/2027</div>
          </div>
        </div>
      </div>`;
    }));

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>بطاقات هوية الطلاب</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    background: #f0f0f0;
    padding: 20px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @page { size: A4; margin: 1cm; }
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    max-width: 210mm;
    margin: 0 auto;
  }
  .card {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    border: 2px solid #0f766e;
    width: 85mm;
    height: 54mm;
    display: flex;
    flex-direction: column;
    page-break-inside: avoid;
  }
  .card-header {
    background: linear-gradient(135deg, #0f766e, #115e59);
    color: white;
    padding: 4px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .school-logo { font-size: 16px; }
  .school-name { font-size: 11px; font-weight: bold; }
  .school-subtitle { font-size: 8px; opacity: 0.9; }
  .card-body {
    display: flex;
    flex: 1;
    gap: 8px;
    padding: 6px 10px;
  }
  /* Large photo area on the right (RTL) */
  .photo-area {
    width: 25mm;
    height: 32mm;
    flex-shrink: 0;
    border: 2px solid #0f766e;
    border-radius: 6px;
    overflow: hidden;
    background: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .student-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .photo-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #0f766e, #0891b2);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 28px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .info-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    justify-content: center;
  }
  .student-name { font-size: 12px; font-weight: bold; color: #1f2937; margin-bottom: 2px; }
  .student-number { font-size: 10px; color: #6b7280; font-family: monospace; margin-bottom: 4px; }
  .detail-row { font-size: 8.5px; display: flex; justify-content: space-between; line-height: 1.4; }
  .label { color: #6b7280; }
  .value { font-weight: 500; color: #1f2937; }
  .card-footer {
    background: #f9fafb;
    padding: 3px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid #e5e7eb;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .qr-code { width: 28px; height: 28px; }
  .validity { text-align: center; font-size: 7px; color: #6b7280; }
  @media print {
    body { background: white; padding: 0; }
    .no-print { display: none; }
    .card { box-shadow: none; }
  }
  .print-btn {
    position: fixed; top: 20px; left: 20px; z-index: 100;
    background: #0f766e; color: white; border: none;
    padding: 10px 20px; border-radius: 8px; cursor: pointer;
    font-size: 14px;
  }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ طباعة</button>
  <div class="cards-grid">
    ${cardsHtml.join('')}
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/student-cards error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
