import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { DEFAULT_TEMPLATES } from '@/lib/whatsapp';

/**
 * GET /api/whatsapp/templates
 * إن لم توجد قوالب، أدخل القوالب الافتراضية
 */
export async function GET() {
  try {
    await requireAuth();
    let templates = await db.whatsAppTemplate.findMany({ orderBy: { name: 'asc' } });

    // إن لم توجد قوالب، أدخل القوالب الافتراضية
    if (templates.length === 0) {
      for (const t of DEFAULT_TEMPLATES) {
        await db.whatsAppTemplate.create({ data: t });
      }
      templates = await db.whatsAppTemplate.findMany({ orderBy: { name: 'asc' } });
    }

    return NextResponse.json({ templates });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * POST /api/whatsapp/templates
 * إنشاء قالب جديد
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { name, type, subject, body: templateBody, variables } = body;

    if (!name || !templateBody) {
      return NextResponse.json({ error: 'الاسم والمحتوى مطلوبان' }, { status: 400 });
    }

    const template = await db.whatsAppTemplate.create({
      data: {
        name,
        type: type || 'custom',
        subject: subject || null,
        body: templateBody,
        variables: variables || null,
      },
    });

    return NextResponse.json({ template });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * PUT /api/whatsapp/templates
 * تعديل قالب
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { id, name, type, subject, body: templateBody, variables, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });
    }

    const template = await db.whatsAppTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(subject !== undefined && { subject }),
        ...(templateBody !== undefined && { body: templateBody }),
        ...(variables !== undefined && { variables }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ template });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * DELETE /api/whatsapp/templates?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });
    }
    await db.whatsAppTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
