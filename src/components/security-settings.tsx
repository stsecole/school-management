'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { KeyRound, Check, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const presetQuestions = [
  'ما هو اسم والدتك؟',
  'ما هو اسم أول معلّم لك؟',
  'ما هو اسم مدينتك الأم؟',
  'ما هو اسم حيوانك الأليف الأول؟',
  'ما هو اسم مدرستك الابتدائية؟',
  'ما هو لونك المفضّل؟',
  'ما هو اسم أفضل صديق لك في الطفولة؟',
];

export function SecurityQuestionSettings() {
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/auth/set-security-question')
      .then(r => r.json())
      .then(data => {
        setCurrentQuestion(data.securityQuestion || null);
        if (data.securityQuestion) setQuestion(data.securityQuestion);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast({ title: 'تنبيه', description: 'السؤال والإجابة مطلوبان', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/set-security-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          securityQuestion: question.trim(),
          securityAnswer: answer.trim(),
        }),
      });

      if (res.ok) {
        toast({ title: 'تم', description: 'تم حفظ السؤال السري بنجاح' });
        setCurrentQuestion(question.trim());
        setAnswer('');
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'خطأ', description: err.error || 'فشل الحفظ', variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="w-5 h-5 text-primary" />
          السؤال السري
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentQuestion ? (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">السؤال السري مُفعّل</p>
              <p className="text-xs text-emerald-600 mt-1">{currentQuestion}</p>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">لم يتم إعداد سؤال سري</p>
              <p className="text-xs text-amber-600 mt-1">عليك إعداده لاسترجاع كلمة المرور عند نسيانها</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>السؤال السري</Label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="اكتب سؤالاً سرّياً"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {presetQuestions.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQuestion(q)}
                  className="text-xs px-2 py-1 rounded-full border hover:bg-muted transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>الإجابة</Label>
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="أدخل إجابتك السرّية"
            />
            <p className="text-xs text-muted-foreground">
              💡 نصيحة: اختر إجابة سهلة التذكّر ولا تُنسى. الإجابة غير حسّاسة لحالة الأحرف.
            </p>
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <KeyRound className="w-4 h-4 ml-2" />}
            {currentQuestion ? 'تحديث السؤال السري' : 'حفظ السؤال السري'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
