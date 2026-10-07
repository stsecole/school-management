'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Settings as SettingsIcon,
  Key,
  Cpu,
  Thermometer,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Eye,
  EyeOff,
  Wifi,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AISettings, ProviderId } from '@/lib/ai/types';

const PROVIDER_INFO: Record<
  ProviderId,
  {
    name: string;
    description: string;
    icon: string;
    color: string;
    models: string[];
    docsUrl?: string;
  }
> = {
  zai: {
    name: 'Z.AI',
    description: 'مزود Z.AI الافتراضي (مجاني، لا يحتاج مفتاح API)',
    icon: '🤖',
    color: 'bg-emerald-500',
    models: ['glm-4.6', 'glm-4.5', 'glm-4-plus', 'glm-4'],
  },
  openai: {
    name: 'OpenAI',
    description: 'GPT-4o و GPT-4 من OpenAI',
    icon: '🟢',
    color: 'bg-green-600',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    name: 'Google Gemini',
    description: 'Gemini 1.5 Pro/Flash من Google',
    icon: '💎',
    color: 'bg-blue-500',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  claude: {
    name: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet من Anthropic',
    icon: '🅰️',
    color: 'bg-orange-500',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  deepseek: {
    name: 'DeepSeek',
    description: 'DeepSeek Chat / Reasoner (متوافق مع OpenAI)',
    icon: '🐋',
    color: 'bg-purple-500',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  local: {
    name: 'محلي',
    description: 'مزود احتياطي يعمل دون اتصال (استجابات محدودة)',
    icon: '💻',
    color: 'bg-slate-500',
    models: ['local-fallback'],
  },
};

const PROVIDER_IDS: ProviderId[] = ['zai', 'openai', 'gemini', 'claude', 'deepseek', 'local'];

export function AISettingsSection({ isDirector }: { isDirector: boolean }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<ProviderId | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string } | null>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/settings');
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل الإعدادات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const update = useCallback((patch: Partial<AISettings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    setDirty(true);
  }, []);

  const updateProvider = useCallback(
    (pid: ProviderId, patch: Partial<{ apiKey: string; model: string; baseUrl: string }>) => {
      setSettings((s) => {
        if (!s) return s;
        return {
          ...s,
          providers: {
            ...s.providers,
            [pid]: { ...s.providers[pid], ...patch },
          },
        };
      });
      setDirty(true);
    },
    []
  );

  const save = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الحفظ');
      toast({ title: 'تم الحفظ', description: 'تم حفظ إعدادات المساعد الذكي' });
      setDirty(false);
      if (data.settings) setSettings(data.settings);
    } catch (err: any) {
      toast({
        title: 'فشل الحفظ',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [settings, toast]);

  const testConnection = useCallback(
    async (pid: ProviderId) => {
      setTesting(pid);
      try {
        const res = await fetch('/api/ai/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: pid }),
        });
        const data = await res.json();
        setTestResults((r) => ({
          ...r,
          [pid]: { ok: data.ok, message: data.message },
        }));
        if (data.ok) {
          toast({ title: 'نجح الاتصال', description: data.message });
        } else {
          toast({
            title: 'فشل الاتصال',
            description: data.message,
            variant: 'destructive',
          });
        }
      } catch (err: any) {
        setTestResults((r) => ({
          ...r,
          [pid]: { ok: false, message: err?.message || 'خطأ' },
        }));
      } finally {
        setTesting(null);
      }
    },
    [toast]
  );

  if (!isDirector) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 text-center">
          <SettingsIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold mb-1">صلاحيات غير كافية</h3>
          <p className="text-sm text-muted-foreground">
            إعدادات المساعد الذكي متاحة للمدير فقط.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">إعدادات المساعد الذكي</CardTitle>
                <CardDescription>
                  إدارة المزودين والمفاتيح ومعاملات التوليد
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <Label className="text-xs">تفعيل المساعد</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(v) => update({ enabled: v })}
                  />
                  <Badge variant={settings.enabled ? 'default' : 'secondary'}>
                    {settings.enabled ? 'مفعّل' : 'معطّل'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Global Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="w-4 h-4" /> معاملات التوليد العامة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2">
                <Zap className="w-4 h-4" /> الحد الأقصى للرموز (maxTokens)
              </Label>
              <Badge variant="outline">{settings.maxTokens}</Badge>
            </div>
            <Slider
              min={256}
              max={8192}
              step={256}
              value={[settings.maxTokens]}
              onValueChange={(v) => update({ maxTokens: v[0] })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              الحد الأقصى لطول الإجابة. القيم الأعلى = استجابات أطول.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2">
                <Thermometer className="w-4 h-4" /> درجة الحرارة (temperature)
              </Label>
              <Badge variant="outline">{settings.temperature.toFixed(2)}</Badge>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[settings.temperature]}
              onValueChange={(v) => update({ temperature: v[0] })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              0 = دقيق ومنظم، 2 = إبداعي وعشوائي.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active Provider Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="w-4 h-4" /> المزود النشط
          </CardTitle>
          <CardDescription>اختر المزود الذي سيستخدمه المساعد افتراضياً</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={settings.activeProvider}
            onValueChange={(v) => update({ activeProvider: v as ProviderId })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_IDS.map((pid) => (
                <SelectItem key={pid} value={pid}>
                  {PROVIDER_INFO[pid].icon} {PROVIDER_INFO[pid].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {settings.activeProvider && (
            <p className="text-xs text-muted-foreground mt-2">
              {PROVIDER_INFO[settings.activeProvider].description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDER_IDS.map((pid) => {
          const info = PROVIDER_INFO[pid];
          const cfg = settings.providers[pid];
          const isActive = settings.activeProvider === pid;
          const testRes = testResults[pid];
          const showKey = showKeys[pid];
          return (
            <Card
              key={pid}
              className={`relative ${isActive ? 'border-primary border-2' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${info.color} text-white`}
                    >
                      {info.icon}
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {info.name}
                        {isActive && (
                          <Badge variant="default" className="text-[10px]">نشط</Badge>
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {info.description}
                      </p>
                    </div>
                  </div>
                  {testRes && (
                    <div className="flex-shrink-0">
                      {testRes.ok ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {info.models.length > 1 && (
                  <div>
                    <Label className="text-xs">النموذج</Label>
                    <Select
                      value={cfg.model}
                      onValueChange={(v) => updateProvider(pid, { model: v })}
                    >
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {info.models.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {pid !== 'zai' && pid !== 'local' && (
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <Key className="w-3 h-3" /> مفتاح API
                    </Label>
                    <div className="flex gap-1 mt-1">
                      <Input
                        type={showKey ? 'text' : 'password'}
                        value={cfg.apiKey}
                        onChange={(e) => updateProvider(pid, { apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="h-9 font-mono text-xs"
                        dir="ltr"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 flex-shrink-0"
                        onClick={() => setShowKeys((s) => ({ ...s, [pid]: !s[pid] }))}
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {info.docsUrl && (
                      <a
                        href={info.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline mt-1 inline-block"
                      >
                        احصل على مفتاح API ←
                      </a>
                    )}
                  </div>
                )}

                {cfg.baseUrl && pid !== 'zai' && pid !== 'local' && (
                  <div>
                    <Label className="text-xs">عنوان الخدمة (Base URL)</Label>
                    <Input
                      type="text"
                      value={cfg.baseUrl}
                      onChange={(e) => updateProvider(pid, { baseUrl: e.target.value })}
                      className="mt-1 h-9 font-mono text-xs"
                      dir="ltr"
                    />
                  </div>
                )}

                {testRes && (
                  <div
                    className={`text-xs p-2 rounded-lg flex items-center gap-1.5 ${
                      testRes.ok
                        ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                    }`}
                  >
                    {testRes.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                    <span className="truncate">{testRes.message}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1"
                    disabled={testing === pid}
                    onClick={() => testConnection(pid)}
                  >
                    {testing === pid ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wifi className="w-3.5 h-3.5" />
                    )}
                    اختبار الاتصال
                  </Button>
                  {!isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => update({ activeProvider: pid })}
                    >
                      تفعيل
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Save Bar */}
      <div className="sticky bottom-4 z-10">
        <Card className={`transition-opacity ${dirty ? 'opacity-100' : 'opacity-90'}`}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              {dirty ? (
                <Badge variant="destructive">تغييرات غير محفوظة</Badge>
              ) : (
                <Badge variant="secondary">
                  <CheckCircle2 className="w-3 h-3 ml-1" /> محفوظ
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchSettings} disabled={saving}>
                إعادة تعيين
              </Button>
              <Button size="sm" onClick={save} disabled={saving || !dirty} className="gap-2">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ الإعدادات
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
