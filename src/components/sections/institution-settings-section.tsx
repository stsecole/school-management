'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Save, Loader2, Building2, ImagePlus, Trash2, Eye, X, Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Settings {
  institution_name: string;
  institution_tagline: string;
  institution_logo_url: string;
  institution_address: string;
  institution_phone: string;
  institution_email: string;
  institution_footer: string;
}

const empty: Settings = {
  institution_name: '',
  institution_tagline: '',
  institution_logo_url: '',
  institution_address: '',
  institution_phone: '',
  institution_email: '',
  institution_footer: '',
};

export function InstitutionSettingsSection() {
  const [settings, setSettings] = useState<Settings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/institution-settings');
      const data = await res.json();
      setSettings({ ...empty, ...(data.settings || {}) });
    } catch {
      toast({ title: 'خطأ', description: 'تعذر تحميل الإعدادات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = (key: keyof Settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/institution-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({ title: 'تم', description: 'تم حفظ إعدادات المؤسسة' });
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'خطأ', description: 'نوع الملف غير مدعوم (JPG, PNG, WebP, SVG)', variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'خطأ', description: 'حجم الملف كبير جداً (حد أقصى 5 ميجا)', variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error || 'فشل الرفع', variant: 'destructive' });
        return;
      }
      update('institution_logo_url', data.url);
      toast({ title: 'تم', description: 'تم رفع الشعار' });
    } catch {
      toast({ title: 'خطأ', description: 'تعذر رفع الشعار', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    update('institution_logo_url', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> إعدادات المؤسسة
          </h2>
          <p className="text-muted-foreground text-sm">
            الشعار والمعلومات الأساسية للمؤسسة — تظهر في صفحة تسجيل الدخول
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...</> : <><Save className="w-4 h-4 ml-2" /> حفظ الإعدادات</>}
        </Button>
      </div>

      {/* Info banner */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">أين تظهر هذه الإعدادات؟</p>
            <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
              <li>صفحة تسجيل الدخول (الشعار + الاسم + الشعار النصي)</li>
              <li>القائمة الجانبية الرئيسية (الشعار + الاسم)</li>
              <li>الوصولات المطبوعة (الاسم + الشعار)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Logo upload card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImagePlus className="w-4 h-4 text-primary" /> شعار المؤسسة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Logo preview */}
            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30 overflow-hidden">
              {settings.institution_logo_url ? (
                <img
                  src={settings.institution_logo_url}
                  alt="شعار المؤسسة"
                  className="w-full h-full object-contain p-2"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <Building2 className="w-12 h-12 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-muted-foreground">
                يُفضّل صورة مربعة بدقة 256×256 بكسل أو أعلى. الأنواع المدعومة: JPG, PNG, WebP, SVG. الحد الأقصى: 5 ميجا.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الرفع...</> : <><ImagePlus className="w-4 h-4 ml-2" /> رفع شعار</>}
                </Button>
                {settings.institution_logo_url && (
                  <Button variant="outline" onClick={handleRemoveLogo} className="text-red-600 border-red-300 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 ml-2" /> إزالة الشعار
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Input
                placeholder="أو الصق رابط الشعار يدوياً..."
                value={settings.institution_logo_url}
                onChange={(e) => update('institution_logo_url', e.target.value)}
                dir="ltr"
                className="text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Institution info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> معلومات المؤسسة
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>اسم المؤسسة <span className="text-destructive">*</span></Label>
            <Input
              value={settings.institution_name}
              onChange={(e) => update('institution_name', e.target.value)}
              placeholder="مثال: مدرسة السلامة"
            />
          </div>
          <div className="space-y-2">
            <Label>الشعار النصي / الوصف المختصر</Label>
            <Input
              value={settings.institution_tagline}
              onChange={(e) => update('institution_tagline', e.target.value)}
              placeholder="مثال: منصة الإدارة المتكاملة"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>العنوان</Label>
            <Input
              value={settings.institution_address}
              onChange={(e) => update('institution_address', e.target.value)}
              placeholder="مثال: الجزائر العاصمة، الجزائر"
            />
          </div>
          <div className="space-y-2">
            <Label>الهاتف</Label>
            <Input
              value={settings.institution_phone}
              onChange={(e) => update('institution_phone', e.target.value)}
              placeholder="مثال: +213 555 123 456"
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input
              type="email"
              value={settings.institution_email}
              onChange={(e) => update('institution_email', e.target.value)}
              placeholder="مثال: contact@school.dz"
              dir="ltr"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>نص التذييل (اختياري)</Label>
            <Textarea
              value={settings.institution_footer}
              onChange={(e) => update('institution_footer', e.target.value)}
              placeholder="مثال: © 2026 مدرسة السلامة - جميع الحقوق محفوظة"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Live preview card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" /> معاينة صفحة الدخول
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 rounded-xl p-6 bg-gradient-to-br from-primary/5 via-background to-accent/5 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg overflow-hidden">
              {settings.institution_logo_url ? (
                <img
                  src={settings.institution_logo_url}
                  alt="logo"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Building2 className="w-10 h-10" />
              )}
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {settings.institution_name || 'اسم المؤسسة'}
            </h1>
            {settings.institution_tagline && (
              <p className="text-muted-foreground mt-2 text-sm">{settings.institution_tagline}</p>
            )}
            {(settings.institution_phone || settings.institution_email || settings.institution_address) && (
              <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
                {settings.institution_address && <p>{settings.institution_address}</p>}
                {settings.institution_phone && <p className="num" dir="ltr">{settings.institution_phone}</p>}
                {settings.institution_email && <p className="num" dir="ltr">{settings.institution_email}</p>}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            هذه معاينة فقط. سجل الخروج لرؤية الصفحة الفعلية.
          </p>
        </CardContent>
      </Card>

      {/* Save button at bottom */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={load} disabled={loading || saving}>
          إعادة تحميل
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...</> : <><Save className="w-4 h-4 ml-2" /> حفظ الإعدادات</>}
        </Button>
      </div>
    </div>
  );
}
