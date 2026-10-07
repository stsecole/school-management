// ===== POST /api/ai/chat - محادثة المساعد الذكي =====
// يستدعي المزود المفعّل مباشرة (Groq/Gemini/OpenAI/DeepSeek) مع fallback محلي ذكي
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ctxFromUser } from '@/lib/ai/context';
import { buildSystemPrompt, detectIntent, extractActionBlock } from '@/lib/ai/router';
import type { ChatMessage } from '@/lib/ai/types';
import type { ToolResult } from '@/lib/ai/tools/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ChatBody {
  conversationId?: string;
  message: string;
  regenerate?: boolean;
}

/**
 * استدعاء المزود المفعّل مباشرة (Groq/Gemini/OpenAI/DeepSeek)
 */
async function callAI(messages: ChatMessage[]): Promise<{ content: string; tokensUsed: number }> {
  // Read AI config from database
  const [providerRow, keyRow, modelRow] = await Promise.all([
    db.setting.findUnique({ where: { key: 'ai_provider' } }),
    db.setting.findUnique({ where: { key: 'ai_api_key' } }),
    db.setting.findUnique({ where: { key: 'ai_model' } }),
  ]);
  const apiKey = keyRow?.value || '';
  const provider = providerRow?.value || 'groq';
  const model = modelRow?.value || 'llama-3.1-8b-instant';

  if (!apiKey || apiKey.length < 10) {
    throw new Error('No API key configured');
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const systemContent = messages.find(m => m.role === 'system')?.content || '';
    const userContent = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemContent,
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
    return { content, tokensUsed: data.usageMetadata?.totalTokenCount || 0 };
  }

  // OpenAI-compatible: Groq, OpenAI, DeepSeek
  const baseUrl = provider === 'groq' ? 'https://api.groq.com/openai/v1'
    : provider === 'openai' ? 'https://api.openai.com/v1'
    : provider === 'deepseek' ? 'https://api.deepseek.com/v1'
    : 'https://api.groq.com/openai/v1';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}`);
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

/**
 * Fallback محلي ذكي — يُنشئ إجابة من البيانات الفعلية
 * يعمل بدون اتصال إنترنت
 */
function generateLocalResponse(message: string, ctx: any, toolResult: any): string {
  const m = message.toLowerCase();

  // إن كان هناك نتيجة أداة، استخدمها
  if (toolResult?.text && typeof toolResult.text === 'string') {
    return toolResult.text;
  }

  // ردود ذكية حسب نوع السؤال
  if (/كم.*عدد.*طلاب|عدد الطلاب|how many students/i.test(m)) {
    return "## 📊 عدد الطلاب\n\n" +
      "يمكنني إعطاؤك العدد الدقيق! اكتب أحد هذه الأوامر:\n\n" +
      "- **«كم عدد الطلاب؟»** — لإظهار العدد الكلي\n" +
      "- **«عدد الطلاب في كل قسم»** — لتوزيع الطلاب على الأقسام\n\n" +
      "💡 *ملاحظة: المزود المحلي لا يدعم التحليل الذكي. للحصول على إجابات أفضل، تأكد من اتصال الإنترنت.*";
  }

  if (/مرحبا|السلام|اهلا|أهلا|hello|hi|bonjour/i.test(m)) {
    return "## 👋 مرحباً بك!\n\n" +
      "أنا المساعد الذكي الإداري لمركز التكوين المهني — مدرسة السلامة.\n\n" +
      "### يمكنني مساعدتك في:\n" +
      "- 📊 **الإحصائيات**: «كم عدد الطلاب؟»، «الحضور اليوم»\n" +
      "- 💰 **المالية**: «المداخيل هذا الأسبوع»، «الأقساط المتأخرة»\n" +
      "- 📝 **التقارير**: «تقرير الحضور»، «مقارنة بين الشهور»\n" +
      "- 🎯 **الإجراءات**: «أنشئ تخصصاً»، «أرسل إشعاراً»\n\n" +
      "💡 *ملاحظة: أعمل حالياً في الوضع المحلي. للحصول على ذكاء اصطناعي كامل، تحقق من اتصال الإنترنت وإعدادات ZAI.*";
  }

  return "## 💡 المساعد الذكي\n\n" +
    "لم أفهم سؤالك تماماً. يمكنني مساعدتك في:\n\n" +
    "### 📊 الإحصائيات\n" +
    "- «كم عدد الطلاب؟»\n" +
    "- «عدد الأساتذة»\n" +
    "- «الحضور اليوم»\n\n" +
    "### 💰 المالية\n" +
    "- «المداخيل هذا الأسبوع»\n" +
    "- «الأقساط المتأخرة»\n\n" +
    "### 📝 التقارير\n" +
    "- «تقرير الحضور»\n" +
    "- «مقارنة بين الشهور»\n\n" +
    "### 🎯 الإجراءات\n" +
    "- «أنشئ تخصصاً»\n" +
    "- «أرسل إشعاراً»\n\n" +
    "---\n" +
    "💡 *ملاحظة: أعمل حالياً في الوضع المحلي (بدون اتصال ZAI). للحصول على إجابات أكثر ذكاءً، تحقق من اتصال الإنترنت.*";
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const body = (await req.json()) as ChatBody;
  if (!body.message || typeof body.message !== 'string') {
    return new Response(JSON.stringify({ error: 'الرسالة مطلوبة' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // التحقق من تفعيل الذكاء الاصطناعي
  const enabledSetting = await db.setting.findUnique({ where: { key: 'ai_enabled' } });
  if (enabledSetting?.value === 'false') {
    return new Response(JSON.stringify({ error: 'المساعد الذكي معطّل' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // إنشاء/جلب المحادثة
  let conversation = body.conversationId
    ? await db.aIConversation.findFirst({
        where: { id: body.conversationId, userId: user.id },
      })
    : null;
  if (!conversation) {
    conversation = await db.aIConversation.create({
      data: {
        userId: user.id,
        title: body.message.slice(0, 50),
      },
    });
  }

  const ctx = await ctxFromUser(user);
  const intent = detectIntent(body.message);

  const encoder = new TextEncoder();
  const conversationId = conversation.id;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        // حفظ رسالة المستخدم
        if (!body.regenerate) {
          await db.aIMessage.create({
            data: {
              conversationId,
              role: 'user',
              content: body.message,
            },
          });
        }

        send({ type: 'conversation', conversationId, title: conversation?.title });

        let fullText = '';
        let tokensUsed = 0;
        let provider = 'zai';
        let toolResultMeta: any = null;
        let actionMeta: any = null;

        // === 1) تنفيذ الأداة إن وُجدت ===
        let toolResult: ToolResult | null = null;
        if (intent.tool) {
          send({ type: 'tool_start', tool: intent.tool.name });
          try {
            toolResult = await intent.tool.execute(ctx);
            send({ type: 'tool_result', result: toolResult });
            toolResultMeta = toolResult;
          } catch (e: any) {
            console.error('[AI] Tool execution failed:', e?.message);
            toolResult = {
              text: `⚠️ تعذر تنفيذ الأداة "${intent.tool.name}": ${e?.message || 'خطأ'}`,
            };
          }
        }

        // === 2) إجراء - أرسل بطاقة تأكيد ===
        if (intent.action) {
          actionMeta = intent.action;
          send({ type: 'action_confirm', action: intent.action });
        }

        // === 3) استدعاء ZAI للحصول على رد ذكي ===
        const systemPrompt = await buildSystemPrompt(ctx);
        const history: ChatMessage[] = [
          { role: 'user', content: body.message },
        ];

        // إن كان هناك نتيجة أداة، أضفها للسياق
        let userContent = body.message;
        if (toolResult?.text) {
          userContent = `${body.message}\n\n[نتيجة الاستعلام من قاعدة البيانات]:\n${toolResult.text}\n\nقدّم تحليلاً مختصراً بالعربية لهذه النتيجة.`;
        }

        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ];

        // محاولة استدعاء AI مع fallback محلي
        let responseText = '';
        try {
          console.log('[AI] Calling AI provider...');
          const aiResponse = await callAI(messages);
          responseText = aiResponse.content || '';

          // Clean up: remove action blocks and JSON tool artifacts from response
          if (responseText) {
            // Remove ```action ... ``` blocks
            responseText = responseText.replace(/```action[\s\S]*?```/g, '').trim();
            // Remove bare JSON tool patterns like {"tool": "...", "params": {}}
            responseText = responseText.replace(/\{"tool"\s*:\s*"[^"]*"[\s\S]*?\}/g, '').trim();
            // Remove multiple consecutive newlines
            responseText = responseText.replace(/\n{3,}/g, '\n\n').trim();
          }

          if (!responseText || !responseText.trim() || responseText.startsWith('⚠️')) {
            console.log('[AI] Provider returned empty/error, using local fallback');
            responseText = generateLocalResponse(body.message, ctx, toolResult);
            provider = 'local';
          } else {
            provider = 'groq';
          }
        } catch (err: any) {
          console.error('[AI] Provider failed, using local fallback:', err?.message);
          responseText = generateLocalResponse(body.message, ctx, toolResult);
          provider = 'local';
        }

        fullText = typeof responseText === 'string' ? responseText : '';

        // === 4) استخرج أي action block من الرد ===
        const actionBlock = extractActionBlock(fullText);
        if (actionBlock) {
          actionMeta = actionBlock;
          send({ type: 'action_confirm', action: actionBlock });
        }

        // === 5) أرسل النص بشكل streaming (مقسّم إلى كلمات) ===
        let textToSend = fullText || 'عذراً، تعذر الحصول على رد.';
        // CRITICAL: Ensure textToSend is a real string, not undefined/null
        if (typeof textToSend !== 'string' || !textToSend) {
          textToSend = 'عذراً، تعذر الحصول على رد.';
        }
        const tokens = textToSend.match(/\S+\s*/g) || [textToSend];
        for (let i = 0; i < tokens.length; i += 2) {
          const slice = tokens.slice(i, i + 2).join('');
          // CRITICAL: Only send if slice is a non-empty string and not "undefined"
          if (slice && typeof slice === 'string' && slice !== 'undefined' && slice.trim()) {
            send({ type: 'delta', content: slice });
          }
          await new Promise((r) => setTimeout(r, 15));
        }

        // === 6) احفظ رد المساعد ===
        if (fullText && fullText.trim() || toolResultMeta) {
          await db.aIMessage.create({
            data: {
              conversationId,
              role: 'assistant',
              content: fullText || '[نتيجة أداة]',
              provider,
              tokensUsed,
              metadata:
                toolResultMeta || actionMeta
                  ? JSON.stringify({ toolResult: toolResultMeta, actionRequest: actionMeta })
                  : null,
            },
          });
        }

        send({
          type: 'done',
          tokensUsed,
          provider,
          conversationId,
        });
      } catch (err: any) {
        console.error('[AI] Chat error:', err);
        send({ type: 'error', message: err?.message || 'خطأ غير معروف' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Conversation-Id': conversationId,
    },
  });
}
