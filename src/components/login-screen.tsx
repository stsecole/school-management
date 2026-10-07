'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Lock, User, Loader2, Building2, Phone, Mail, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: 'director' | 'employee';
}

interface InstitutionSettings {
  institution_name: string;
  institution_tagline: string;
  institution_logo_url: string;
  institution_address: string;
  institution_phone: string;
  institution_email: string;
  institution_footer: string;
}

const defaultSettings: InstitutionSettings = {
  institution_name: 'نظام إدارة المؤسسة التعليمية',
  institution_tagline: 'منصة الإدارة المتكاملة',
  institution_logo_url: '',
  institution_address: '',
  institution_phone: '',
  institution_email: '',
  institution_footer: '',
};

export function LoginScreen({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<InstitutionSettings>(defaultSettings);
  const { toast } = useToast();

  // Fetch institution settings (public endpoint — no auth)
  useEffect(() => {
    fetch('/api/institution-settings/public')
      .then(r => r.json())
      .then(data => {
        if (data?.settings) {
          setSettings({ ...defaultSettings, ...data.settings });
        }
      })
      .catch(() => { /* ignore — keep defaults */ });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال اسم المستخدم وكلمة المرور', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error || 'فشل تسجيل الدخول', variant: 'destructive' });
        return;
      }
      toast({ title: 'مرحباً', description: `أهلاً ${data.user.name}`, variant: 'default' });
      onLogin(data.user);
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [username, password, onLogin, toast]);

  const hasContactInfo = settings.institution_address || settings.institution_phone || settings.institution_email;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg overflow-hidden">
            {settings.institution_logo_url ? (
              <img
                src={settings.institution_logo_url}
                alt={settings.institution_name}
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  // Fallback to default icon if logo fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <GraduationCap className="w-10 h-10" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{settings.institution_name}</h1>
          {settings.institution_tagline && (
            <p className="text-muted-foreground mt-2">{settings.institution_tagline}</p>
          )}
        </div>

        <Card className="shadow-xl border-border/60">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">تسجيل الدخول</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="أدخل اسم المستخدم"
                    className="pr-10"
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="pr-10"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري التحقق...
                  </>
                ) : (
                  'دخول'
                )}
              </Button>
            </form>

            {/* رابط استرجاع كلمة المرور */}
            <div className="mt-4 text-center">
              <a href="/forgot-password" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                نسيت كلمة المرور؟
              </a>
            </div>

            {/* Institution contact info (replaces demo credentials) */}
            {hasContactInfo && (
              <div className="mt-6 p-3 bg-muted/50 rounded-lg text-sm space-y-1.5">
                <p className="font-medium text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> معلومات المؤسسة
                </p>
                {settings.institution_address && (
                  <p className="text-muted-foreground flex items-center gap-2 text-xs">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span>{settings.institution_address}</span>
                  </p>
                )}
                {settings.institution_phone && (
                  <p className="text-muted-foreground flex items-center gap-2 text-xs num" dir="ltr">
                    <Phone className="w-3 h-3 flex-shrink-0" />
                    <span>{settings.institution_phone}</span>
                  </p>
                )}
                {settings.institution_email && (
                  <p className="text-muted-foreground flex items-center gap-2 text-xs num" dir="ltr">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span>{settings.institution_email}</span>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {settings.institution_footer || `© ${new Date().getFullYear()} ${settings.institution_name}`}
        </p>
      </div>
    </div>
  );
}
