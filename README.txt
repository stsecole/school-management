============================================================
 SCHOOL MANAGEMENT - v8 (LLM Provider System Fix)
============================================================

THE REAL FIX: Reports now use the Provider System instead of
calling ZAI SDK directly.

------------------------------------------------------------
 ROOT CAUSE (finally identified!)
------------------------------------------------------------

ZAI SDK uses `internal-api.z.ai` which is an INTERNAL endpoint
only accessible from Z.ai's servers. Your local Windows machine
cannot reach it → "fetch failed" → fallback.

The ZAI SDK was designed for the Z.ai platform, NOT for external
local development.

------------------------------------------------------------
 THE FIX (v8)
------------------------------------------------------------

All AI routes now use `chat()` from `@/lib/ai/provider`:

  import { chat } from '@/lib/ai/provider';
  const result = await chat({ messages, maxTokens, temperature });

This uses the Provider System which:
  1. Checks AI Settings (from the Settings page)
  2. Uses the configured provider (ZAI, OpenAI, Gemini, Claude, etc.)
  3. If ZAI fails → falls back to local analysis
  4. If OpenAI/Gemini/Claude configured → uses YOUR API key

Routes updated:
  - /api/reports/ai-analysis (التقارير)
  - /api/reports/branch-ai-analysis (مقارنة الفروع)
  - /api/ai/chat (المساعد الذكي)

------------------------------------------------------------
 HOW TO GET REAL AI ANALYSIS (not local fallback)
------------------------------------------------------------

Option A: Use OpenAI (recommended)
  1. Get API key from https://platform.openai.com/api-keys
  2. Go to: إعدادات AI (AI Settings)
  3. Select provider: OpenAI
  4. Enter your API key
  5. Save
  6. Now all AI features use OpenAI!

Option B: Use Gemini (free tier available)
  1. Get API key from https://aistudio.google.com/apikey
  2. Go to: إعدادات AI
  3. Select provider: Gemini
  4. Enter your API key
  5. Save

Option C: Use DeepSeek (cheapest)
  1. Get API key from https://platform.deepseek.com
  2. Go to: إعدادات AI
  3. Select provider: DeepSeek
  4. Enter your API key
  5. Save

Option D: Use local fallback (no setup needed)
  - The local fallback analysis works well
  - Generates structured reports with tables and recommendations
  - No internet or API key needed

------------------------------------------------------------
 INSTALLATION
------------------------------------------------------------

1. Extract ZIP to c:\school-management\
2. cd c:\school-management
3. npx prisma db push
4. npx prisma generate
5. rmdir /s /q .next
6. npm run dev

------------------------------------------------------------
 AFTER INSTALLATION
------------------------------------------------------------

1. Login as admin
2. Go to "إعدادات AI" (AI Settings) in sidebar
3. Choose a provider (OpenAI/Gemini/Claude/DeepSeek)
4. Enter your API key
5. Save
6. Go to Reports → "التحليل الذكي" → Generate
7. Real AI analysis will appear!

If you don't configure any provider:
- ZAI will be tried (fails on local machines)
- Local fallback analysis is generated automatically
- The local analysis is still good — includes tables, rankings, recommendations

============================================================
