'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, Receipt, Palette, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReceiptSettings {
  receipt_school_name: string;
  receipt_address: string;
  receipt_phone: string;
  receipt_logo_url: string;
  receipt_primary_color: string;
  receipt_secondary_color: string;
  receipt_accent_color: string;
  receipt_footer_text: string;
  receipt_show_logo: string;
}

const empty: ReceiptSettings = {
  receipt_school_name: 'مدرسة السلامة',
  receipt_address: '',
  receipt_phone: '',
  receipt_logo_url: '',
  receipt_primary_color: '#1e3a5f',
  receipt_secondary_color: '#2c5282',
  receipt_accent_color: '#16a34a',
  receipt_footer_text: 'مدرسة السلامة - جميع الحقوق محفوظة',
  receipt_show_logo: 'true',
};

export function ReceiptSettingsSection() {
  const [settings, setSettings] = useState<ReceiptSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receipt-settings');
      if (res.ok) {
        const json = await res.json();
        if (json.settings) {
          setSettings({ ...empty, ...json.settings });
        }
      } else {
        toast({ title: 'خطأ', description: 'تعذر تحميل الإعدادات', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/receipt-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (res.ok) {
        toast({ title: 'تم', description: 'تم حفظ إعدادات الوصل بنجاح' });
        if (json.settings) {
          setSettings({ ...empty, ...json.settings });
        }
      } else {
        toast({ title: 'خطأ', description: json.error || 'فشل الحفظ', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof ReceiptSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="mr-3 text-muted-foreground">جاري تحميل الإعدادات...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" /> إعدادات الوصل
          </h2>
          <p className="text-muted-foreground text-sm">تخصيص مظهر وصولات الدفع</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...</>
          ) : (
            <><Save className="w-4 h-4 ml-2" /> حفظ الإعدادات</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* المعلومات العامة */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" /> معلومات المؤسسة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المؤسسة</Label>
              <Input
                value={settings.receipt_school_name}
                onChange={e => update('receipt_school_name', e.target.value)}
                placeholder="مدرسة السلامة"
              />
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input
                value={settings.receipt_address}
                onChange={e => update('receipt_address', e.target.value)}
                placeholder="مثال: حي السلامة، الجزائر"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input
                  value={settings.receipt_phone}
                  onChange={e => update('receipt_phone', e.target.value)}
                  placeholder="0555 00 00 00"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>رابط الشعار (Logo URL)</Label>
                <Input
                  value={settings.receipt_logo_url}
                  onChange={e => update('receipt_logo_url', e.target.value)}
                  placeholder="/logo.svg"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>نص التذييل (Footer)</Label>
              <Textarea
                value={settings.receipt_footer_text}
                onChange={e => update('receipt_footer_text', e.target.value)}
                placeholder="مدرسة السلامة - جميع الحقوق محفوظة"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <Label htmlFor="show-logo" className="cursor-pointer">إظهار الشعار في الوصل</Label>
                <p className="text-xs text-muted-foreground mt-0.5">عند التفعيل سيظهر شعار المؤسسة في ترويسة الوصل</p>
              </div>
              <Switch
                id="show-logo"
                checked={settings.receipt_show_logo === 'true'}
                onCheckedChange={(v) => update('receipt_show_logo', v ? 'true' : 'false')}
              />
            </div>
          </CardContent>
        </Card>

        {/* الألوان */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" /> ألوان الوصل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorField
              label="اللون الأساسي"
              value={settings.receipt_primary_color}
              onChange={v => update('receipt_primary_color', v)}
            />
            <ColorField
              label="اللون الثانوي"
              value={settings.receipt_secondary_color}
              onChange={v => update('receipt_secondary_color', v)}
            />
            <ColorField
              label="لون التمييز (Accent)"
              value={settings.receipt_accent_color}
              onChange={v => update('receipt_accent_color', v)}
            />
          </CardContent>
        </Card>
      </div>

      {/* معاينة مباشرة */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" /> معاينة مباشرة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-2xl mx-auto rounded-xl overflow-hidden shadow-lg border">
            {/* الترويسة */}
            <div
              className="p-6 flex justify-between items-center text-white"
              style={{ background: `linear-gradient(135deg, ${settings.receipt_primary_color}, ${settings.receipt_secondary_color})` }}
            >
              <div>
                <h3 className="text-xl font-bold">{settings.receipt_school_name || 'مدرسة السلامة'}</h3>
                <p className="text-sm opacity-90">وصل دفع - معاينة</p>
              </div>
              {settings.receipt_show_logo === 'true' && settings.receipt_logo_url && (
                <img
                  src={settings.receipt_logo_url}
                  alt="logo"
                  className="w-12 h-12 rounded bg-white/20 p-1"
                />
              )}
            </div>
            {/* الجسم */}
            <div className="p-6 bg-white space-y-3">
              {settings.receipt_address && (
                <div className="text-sm text-gray-600">{settings.receipt_address}</div>
              )}
              {settings.receipt_phone && (
                <div className="text-sm text-gray-600 num" dir="ltr">{settings.receipt_phone}</div>
              )}
              <div
                className="rounded-lg p-4 text-center mt-4"
                style={{
                  background: `${settings.receipt_accent_color}15`,
                  border: `2px solid ${settings.receipt_accent_color}`,
                }}
              >
                <div className="text-xs mb-1" style={{ color: settings.receipt_accent_color }}>المبلغ المدفوع</div>
                <div className="text-2xl font-bold" style={{ color: settings.receipt_accent_color }}>
                  10,000 دج
                </div>
              </div>
            </div>
            {/* التذييل */}
            <div
              className="p-4 text-center text-xs text-white"
              style={{ background: settings.receipt_primary_color }}
            >
              {settings.receipt_footer_text || 'مدرسة السلامة - جميع الحقوق محفوظة'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// مكوّن مساعد لحقل اللون مع منتقي الألوان
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-12 h-10 rounded-md border border-input cursor-pointer bg-transparent"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 font-mono"
          dir="ltr"
        />
      </div>
    </div>
  );
}
