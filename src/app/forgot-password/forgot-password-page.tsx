'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { School, KeyRound, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('أدخل اسم المستخدم');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1, username: username.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setSecurityQuestion(data.question);
        setStep(2);
      } else {
        setError(data.error || 'حدث خطأ');
      }
    } catch {
      setError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!answer.trim()) {
      setError('أدخل إجابة السؤال السري');
      return;
    }

    if (newPassword.length < 4) {
      setError('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 2,
          username: username.trim(),
          answer: answer.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(data.message || 'تم تغيير كلمة المرور بنجاح');
        setStep(3);
      } else {
        setError(data.error || 'حدث خطأ');
      }
    } catch {
      setError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        {/* رأس */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground mb-4 shadow-lg">
            <School className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">نظام إدارة المؤسسة التعليمية</h1>
          <p className="text-sm text-muted-foreground mt-1">مدرسة السلامة</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {step === 1 && 'استرجاع كلمة المرور'}
              {step === 2 && 'الإجابة على السؤال السري'}
              {step === 3 && 'تم بنجاح'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* الخطوة 1: اسم المستخدم */}
            {step === 1 && (
              <form onSubmit={handleStep1} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">اسم المستخدم</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="أدخل اسم المستخدم"
                    autoFocus
                    dir="ltr"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'جاري التحقق...' : 'متابعة'}
                  {!loading && <ArrowRight className="w-4 h-4 mr-2" />}
                </Button>
              </form>
            )}

            {/* الخطوة 2: السؤال السري + كلمة المرور الجديدة */}
            {step === 2 && (
              <form onSubmit={handleStep2} className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">السؤال السري:</p>
                  <p className="text-sm font-medium">{securityQuestion}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="answer">الإجابة *</Label>
                  <Input
                    id="answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="أدخل إجابتك"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">كلمة المرور الجديدة *</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="4 أحرف على الأقل"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">تأكيد كلمة المرور *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    dir="ltr"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => { setStep(1); setError(''); setAnswer(''); setNewPassword(''); setConfirmPassword(''); }}
                >
                  رجوع
                </Button>
              </form>
            )}

            {/* الخطوة 3: نجاح */}
            {step === 3 && (
              <div className="text-center py-4">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-600" />
                <p className="text-lg font-semibold mb-2">تم تغيير كلمة المرور!</p>
                <p className="text-sm text-muted-foreground mb-6">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة</p>
                <Link href="/">
                  <Button className="w-full">
                    تسجيل الدخول
                  </Button>
                </Link>
              </div>
            )}

            {step !== 3 && (
              <div className="mt-4 text-center">
                <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                  العودة لتسجيل الدخول
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
