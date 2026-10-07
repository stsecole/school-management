// ===== GET /api/ai/debug - تشخيص نظام الذكاء الاصطناعي =====
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAISettings, createProvider } from '@/lib/ai/provider';
import { PROVIDER_DEFAULTS } from '@/lib/ai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Diagnostics endpoint — tests the PROVIDER SYSTEM (not ZAI directly).
 * Shows which provider is configured and whether it works.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== 'director') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // ===== Read AI Settings from database =====
    const settings = await getAISettings();

    // ===== Test the configured provider =====
    let providerTest: any = {
      provider: settings.provider,
      model: settings.model,
      hasApiKey: !!settings.apiKey,
      apiKeyLength: settings.apiKey?.length || 0,
      baseUrl: settings.baseUrl || PROVIDER_DEFAULTS[settings.provider]?.baseUrl || 'default',
      enabled: settings.enabled,
    };

    if (!settings.enabled) {
      providerTest.status = 'AI is DISABLED in settings';
      providerTest.recommendation = 'Go to "إعدادات AI" and enable AI, then configure a provider';
    } else if (settings.provider === 'zai') {
      providerTest.status = 'ZAI provider is selected but it only works on Z.ai servers';
      providerTest.recommendation = 'Switch to OpenAI, Gemini, or DeepSeek in "إعدادات AI"';
    } else if (settings.provider === 'local') {
      providerTest.status = 'Local provider (no external AI)';
      providerTest.recommendation = 'Works offline but limited. Configure OpenAI/Gemini for better results';
    } else if (!settings.apiKey) {
      providerTest.status = `No API key configured for ${settings.provider}`;
      providerTest.recommendation = `Go to "إعدادات AI" and enter your ${settings.provider} API key`;
    } else {
      // Actually test the provider
      try {
        const provider = createProvider(settings);
        const result = await provider.chat({
          messages: [{ role: 'user', content: 'قل مرحبا' }],
          maxTokens: 30,
          temperature: 0.5,
        });

        if (result.content && !result.content.startsWith('⚠️')) {
          providerTest.status = '✅ Provider works!';
          providerTest.response = result.content.substring(0, 100);
          providerTest.tokensUsed = result.tokensUsed;
          providerTest.latencyMs = result.durationMs;
        } else {
          providerTest.status = '❌ Provider returned error';
          providerTest.error = result.content;
        }
      } catch (err: any) {
        providerTest.status = '❌ Provider test failed';
        providerTest.error = err.message;
      }
    }

    // ===== Recommendations =====
    const recommendations: string[] = [];

    if (!settings.enabled) {
      recommendations.push('1. اذهب إلى "إعدادات AI" → فعّل الذكاء الاصطناعي');
    } else if (settings.provider === 'zai') {
      recommendations.push('1. ZAI لا يعمل على جهازك المحلي');
      recommendations.push('2. اذهب إلى "إعدادات AI" → اختر مزوداً آخر (Gemini مُوصى به - مجاني)');
      recommendations.push('3. احصل على مفتاح API من https://aistudio.google.com/apikey (مجاني)');
      recommendations.push('4. أدخل المفتاح في صفحة الإعدادات → احفظ');
    } else if (!settings.apiKey) {
      const links: Record<string, string> = {
        openai: 'https://platform.openai.com/api-keys',
        gemini: 'https://aistudio.google.com/apikey',
        claude: 'https://console.anthropic.com/settings/keys',
        deepseek: 'https://platform.deepseek.com/api_keys',
      };
      const link = links[settings.provider] || '';
      recommendations.push(`1. احصل على مفتاح API من: ${link}`);
      recommendations.push(`2. اذهب إلى "إعدادات AI" → أدخل المفتاح → احفظ`);
    } else if (providerTest.status?.includes('✅')) {
      recommendations.push('✅ كل شيء يعمل! جرّب التحليل الذكي في التقارير');
    } else {
      recommendations.push(`المزود: ${settings.provider} لا يعمل`);
      recommendations.push(`الخطأ: ${providerTest.error || 'غير معروف'}`);
      recommendations.push('تحقق من مفتاح API أو جرب مزوداً آخر');
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      currentSettings: {
        enabled: settings.enabled,
        provider: settings.provider,
        model: settings.model,
        hasApiKey: !!settings.apiKey,
        baseUrl: settings.baseUrl || 'default',
      },
      providerTest,
      recommendations,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/ai/debug error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'Unknown') },
      { status: 500 }
    );
  }
}
