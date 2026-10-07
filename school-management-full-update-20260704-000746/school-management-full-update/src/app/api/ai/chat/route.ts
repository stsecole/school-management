// ===== POST /api/ai/chat =====
// SSE streaming: detects intent, runs tool, streams LLM response, saves to AIConversation/AIMessage

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ctxFromUser } from '@/lib/ai/context';
import { buildSystemPrompt, detectIntent, extractToolBlock, extractActionBlock, stripToolBlocks } from '@/lib/ai/router';
import { chatStream } from '@/lib/ai/provider';
import { runQuery } from '@/lib/ai/tools/queries';
import { actionToBlock, getAction } from '@/lib/ai/tools/actions';
import type { ChatMessage } from '@/lib/ai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sse(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const ctx = ctxFromUser(user);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { conversationId, message } = body as {
    conversationId?: string;
    message?: string;
  };
  if (!message || typeof message !== 'string') {
    return new Response('message is required', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) =>
        controller.enqueue(encoder.encode(sse(obj)));

      try {
        // 1) تأكد من وجود محادثة
        let conv = conversationId
          ? await db.aIConversation.findUnique({ where: { id: conversationId } })
          : null;
        if (!conv) {
          conv = await db.aIConversation.create({
            data: {
              userId: user.id,
              title: message.slice(0, 50),
            },
          });
        }
        send({ type: 'conversation', conversationId: conv.id, title: conv.title });

        // 2) احفظ رسالة المستخدم
        await db.aIMessage.create({
          data: {
            conversationId: conv.id,
            role: 'user',
            content: message,
            messageType: 'text',
          },
        });

        // 3) حدّث عنوان المحادثة إن كانت جديدة
        const existingMsgs = await db.aIMessage.count({
          where: { conversationId: conv.id },
        });
        if (existingMsgs <= 1) {
          await db.aIConversation.update({
            where: { id: conv.id },
            data: { title: message.slice(0, 50) },
          });
        }

        // 4) كشف النية
        const intent = detectIntent(message);
        send({ type: 'intent', intent });

        // 5) اجلب سجل الرسائل
        const history: ChatMessage[] = (
          await db.aIMessage.findMany({
            where: { conversationId: conv.id },
            orderBy: { createdAt: 'asc' },
            take: 20,
          })
        ).map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }));

        // 6) ابني system prompt
        const systemPrompt = await buildSystemPrompt(ctx);
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...history,
        ];

        // 7) استدعِ المزود بشكل streaming
        const startTime = Date.now();
        let fullContent = '';

        try {
          for await (const chunk of chatStream({ messages, stream: true })) {
            if (chunk.delta) {
              fullContent += chunk.delta;
              send({ type: 'delta', delta: chunk.delta });
            }
            if (chunk.done) {
              send({
                type: 'done',
                finishReason: chunk.finishReason,
                provider: chunk.provider?.id,
              });
            }
          }
        } catch (err: any) {
          send({
            type: 'error',
            message: `فشل استدعاء المزود: ${err?.message || String(err)}`,
          });
          fullContent =
            '⚠️ تعذّر الحصول على استجابة من المساعد. حاول مجدداً أو تحقق من الإعدادات.';
        }

        const durationMs = Date.now() - startTime;

        // 8) استخرج tool block و action block من الإجابة
        const toolBlock = extractToolBlock(fullContent);
        const actionBlock = extractActionBlock(fullContent);
        const cleanContent = stripToolBlocks(fullContent);

        let toolResultData: any = null;
        let finalContent = cleanContent;

        // 9) نفّذ الأداة إن وجدت
        if (toolBlock?.tool) {
          send({ type: 'tool_start', tool: toolBlock.tool, params: toolBlock.params });
          const toolResult = await runQuery(toolBlock.tool, ctx, toolBlock.params || {});
          toolResultData = toolResult;
          send({ type: 'tool_result', result: toolResult });

          // إذا كانت الإجابة فارغة بدون نص، أضف ملخصاً
          if (!cleanContent.trim()) {
            finalContent = toolResult.message || 'تم تنفيذ الاستعلام.';
          }

          // إذا كانت الأداة تُرجع رسالة تذكير/منشور، أضفها للنص
          if (
            toolResult.data &&
            (toolResult.data.message || toolResult.data.post) &&
            !cleanContent.trim()
          ) {
            finalContent = toolResult.data.message || toolResult.data.post;
          }
        }

        // 10) أرسل الإجراء المُقترح
        if (actionBlock) {
          const def = getAction(actionBlock.action);
          send({
            type: 'action_proposed',
            action: {
              ...actionBlock,
              label: def?.label || actionBlock.action,
              description: actionBlock.description || def?.describe(actionBlock.params),
            },
          });
        }

        // 11) احفظ رسالة المساعد
        const saved = await db.aIMessage.create({
          data: {
            conversationId: conv.id,
            role: 'assistant',
            content: finalContent,
            messageType: toolResultData?.display ? 'rich' : 'text',
            metadata: JSON.stringify({
              intent,
              tool: toolBlock?.tool || null,
              toolParams: toolBlock?.params || null,
              toolResult: toolResultData,
              action: actionBlock,
              rawContent: fullContent !== finalContent ? fullContent : undefined,
            }),
            provider: 'unknown',
            durationMs,
          },
        });
        send({ type: 'saved', messageId: saved.id });

        controller.close();
      } catch (err: any) {
        console.error('AI chat error:', err);
        try {
          send({
            type: 'error',
            message: `خطأ داخلي: ${err?.message || String(err)}`,
          });
        } catch {}
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
