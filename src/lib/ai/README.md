# وحدة المساعد الذكي (AI Assistant Module)

نظام مساعد ذكي متكامل لنظام إدارة المؤسسة التعليمية، يدعم عدة مزودين وأدوات استعلام وإجراءات.

## البنية

```
src/lib/ai/
├── types.ts          # الأنواع المشتركة
├── provider.ts       # مصنع المزودين + إدارة الإعدادات
├── context.ts        # سياق البيانات (احترام الصلاحيات)
├── router.ts         # بناء البرومبت + كشف النية
├── index.ts          # Barrel file
├── providers/
│   ├── zai.ts        # Z.AI (افتراضي - لا يحتاج مفتاح)
│   ├── openai.ts     # OpenAI (REST + SSE)
│   ├── gemini.ts     # Google Gemini
│   ├── claude.ts     # Anthropic Claude
│   ├── deepseek.ts   # DeepSeek (متوافق مع OpenAI)
│   └── local.ts      # محلي (Fallback)
└── tools/
    ├── queries.ts    # 23 أداة استعلام
    └── actions.ts    # 5 إجراءات (تتطلب تأكيداً)
```

## المزودون المدعومون

| المزود | ي Streaming | يحتاج مفتاح |
|--------|------------|------------|
| Z.AI | ✓ | ✗ |
| OpenAI | ✓ | ✓ |
| Gemini | ✓ | ✓ |
| Claude | ✓ | ✓ |
| DeepSeek | ✓ | ✓ |
| محلي | محاكاة | ✗ |

## الإعدادات

تُخزن في جدول `Setting` بالمفاتيح:
- `ai_enabled` - تفعيل/تعطيل
- `ai_provider` - المزود النشط
- `ai_api_key` - مفتاح API
- `ai_model` - النموذج
- `ai_max_tokens` - الحد الأقصى للرموز
- `ai_temperature` - درجة الحرارة
- `ai_base_url` - رابط API مخصص

## الأدوات (23 أداة)

1. عدد الطلاب
2. المتأخرون في الدفع
3. أعلى التخصصات
4. إيرادات هذا الأسبوع
5. أعلى الأساتذة ساعات
6. الغائبون اليوم
7. الطلاب الجدد هذا الشهر
8. الأقساط المتأخرة
9. ربح الشهر
10. الطلاب حسب القسم
11. استغلال القاعات
12. تعارض الأساتذة
13. تقرير الإيرادات
14. تقرير الحضور
15. تقرير الأساتذة
16. تقرير التسجيلات
17. اقتراحات ذكية
18. توليد رسالة تذكير
19. توليد منشور اجتماعي
20. إحصائيات شهرية
21. مقارنة الأشهر
22. الطلاب حسب الحالة
23. أعلى الأقسام من حيث الساعات

## الإجراءات (5)

1. `create_specialization` - إنشاء تخصص (مدير)
2. `create_user` - إنشاء حساب (مدير)
3. `create_room` - إنشاء قاعة (مدير)
4. `create_notification` - إرسال إشعار (الجميع)
5. `delete_student` - حذف طالب (مدير)

كل الإجراءات:
- تتطلب تأكيداً صريحاً من المستخدم
- تُسجّل في `AuditLog` مع `source="ai_assistant"`
- تحترم الصلاحيات (المدير/الموظف)

## نقاط API

- `POST /api/ai/chat` - محادثة مع SSE streaming
- `GET/POST /api/ai/conversations` - قائمة/إنشاء محادثات
- `GET/PATCH/DELETE /api/ai/conversations/[id]` - محادثة واحدة
- `POST /api/ai/execute` - تنفيذ إجراء مؤكد
- `POST /api/ai/feedback` - إرسال ملاحظة (up/down)
- `GET/PUT /api/ai/settings` - إعدادات (PUT للمدير فقط)
- `POST /api/ai/test-connection` - اختبار الاتصال
- `POST /api/ai/export` - تصدير PDF/Excel
- `POST /api/ai/upload` - رفع ملف وتحليله
- `POST /api/ai/document` - توليد مستند رسمي
