import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import QRCode from 'qrcode';

/**
 * GET /api/qr?data=<text>
 * توليد QR Code كصورة PNG
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const data = searchParams.get('data');

    if (!data) {
      return NextResponse.json({ error: 'البيانات مطلوبة' }, { status: 400 });
    }

    const qrDataUrl = await QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
      color: { dark: '#1e3a5f', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });

    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/qr error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
