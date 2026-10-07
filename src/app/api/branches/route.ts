import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireDirector } from '@/lib/auth';

/**
 * GET /api/branches            → list all branches
 * GET /api/branches?id=xxx     → get one branch with stats
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    // Safety check: if Branch model is not in the Prisma client yet
    if (!db.branch) {
      return NextResponse.json(
        { error: 'Branch model not found. Run: npx prisma generate && npx prisma db push' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const branch = await db.branch.findUnique({
        where: { id },
        include: {
          users: { select: { id: true, name: true, username: true, role: true } },
          _count: { select: { students: true, teachers: true, payments: true, expenses: true } },
        },
      });
      if (!branch) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
      }
      return NextResponse.json({ branch });
    }

    const branches = await db.branch.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { students: true, teachers: true, users: true, payments: true, expenses: true } },
      },
    });
    return NextResponse.json({ branches });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/branches error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/branches  → create a new branch (director only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireDirector();

    if (!db.branch) {
      return NextResponse.json(
        { error: 'Branch model not found. Run: npx prisma generate && npx prisma db push' },
        { status: 500 }
      );
    }

    const body = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
    }

    // Check for unique name
    const existing = await db.branch.findUnique({ where: { name: body.name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'Branch name already exists' }, { status: 400 });
    }

    // Check for unique code (if provided)
    if (body.code && body.code.trim()) {
      const existingCode = await db.branch.findUnique({ where: { code: body.code.trim() } });
      if (existingCode) {
        return NextResponse.json({ error: 'Branch code already exists' }, { status: 400 });
      }
    }

    const branch = await db.branch.create({
      data: {
        name: body.name.trim(),
        code: body.code ? body.code.trim() : null,
        receiptPrefix: body.receiptPrefix ? body.receiptPrefix.trim().toUpperCase() : null,
        address: body.address ? body.address.trim() : null,
        phone: body.phone ? body.phone.trim() : null,
        email: body.email ? body.email.trim() : null,
        managerName: body.managerName ? body.managerName.trim() : null,
        isActive: body.isActive !== undefined ? !!body.isActive : true,
        notes: body.notes ? body.notes.trim() : null,
      },
    });
    return NextResponse.json({ branch }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Director access required' }, { status: 403 });
    }
    console.error('POST /api/branches error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/branches?id=xxx  → update a branch (director only)
 */
export async function PUT(request: NextRequest) {
  try {
    await requireDirector();

    if (!db.branch) {
      return NextResponse.json(
        { error: 'Branch model not found. Run: npx prisma generate && npx prisma db push' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required (?id=xxx)' }, { status: 400 });
    }

    const body = await request.json();
    const existing = await db.branch.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // Check unique name if changing
    if (body.name && body.name !== existing.name) {
      const conflict = await db.branch.findUnique({ where: { name: body.name } });
      if (conflict) {
        return NextResponse.json({ error: 'Branch name already exists' }, { status: 400 });
      }
    }

    // Check unique code if changing (and not empty)
    if (body.code !== undefined && body.code && body.code !== existing.code) {
      const conflict = await db.branch.findUnique({ where: { code: body.code } });
      if (conflict) {
        return NextResponse.json({ error: 'Branch code already exists' }, { status: 400 });
      }
    }

    const branch = await db.branch.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name.trim() : undefined,
        code: body.code !== undefined ? (body.code ? body.code.trim() : null) : undefined,
        receiptPrefix: body.receiptPrefix !== undefined ? (body.receiptPrefix ? body.receiptPrefix.trim().toUpperCase() : null) : undefined,
        address: body.address !== undefined ? (body.address ? body.address.trim() : null) : undefined,
        phone: body.phone !== undefined ? (body.phone ? body.phone.trim() : null) : undefined,
        email: body.email !== undefined ? (body.email ? body.email.trim() : null) : undefined,
        managerName: body.managerName !== undefined ? (body.managerName ? body.managerName.trim() : null) : undefined,
        isActive: body.isActive !== undefined ? !!body.isActive : undefined,
        notes: body.notes !== undefined ? (body.notes ? body.notes.trim() : null) : undefined,
      },
    });
    return NextResponse.json({ branch });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Director access required' }, { status: 403 });
    }
    console.error('PUT /api/branches error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/branches?id=xxx  → delete a branch (director only)
 * Refuses to delete if branch has linked students/teachers/payments.
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireDirector();

    if (!db.branch) {
      return NextResponse.json(
        { error: 'Branch model not found. Run: npx prisma generate && npx prisma db push' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required (?id=xxx)' }, { status: 400 });
    }

    const branch = await db.branch.findUnique({ where: { id } });
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // Check linked data
    const studentsCount = await db.student.count({ where: { branchId: id } });
    if (studentsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete: ' + studentsCount + ' students linked to this branch' },
        { status: 400 }
      );
    }

    const teachersCount = await db.teacher.count({ where: { branchId: id } });
    if (teachersCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete: ' + teachersCount + ' teachers linked to this branch' },
        { status: 400 }
      );
    }

    const usersCount = await db.user.count({ where: { branchId: id } });
    if (usersCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete: ' + usersCount + ' users linked to this branch. Reassign them first.' },
        { status: 400 }
      );
    }

    await db.branch.delete({ where: { id } });
    return NextResponse.json({ message: 'Branch deleted' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Director access required' }, { status: 403 });
    }
    console.error('DELETE /api/branches error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
