'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles, Key, Save, Wifi, CheckCircle2, XCircle, Loader2, Zap,
  Bot, Globe, Cpu, CloudOff, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AISettings, ProviderId } from '@/lib/ai/types';

interface ProviderInfo {
  id: string;
  name: string;
  defaultModel: string;
  requiresKey: boolean;
  supportsStreaming: boolean;
}

const PROVIDER_ICONS: Record<string, any> = {
  zai: Zap,
  openai: Bot,
  gemini: Globe,
  claude: Cpu,
  deepseek: Bot,
  groq: Zap,
  local: CloudOff,
};

// HARDcoded fallback providers list — used if the API doesn't return them
// This ensures the UI ALWAYS shows all providers, even if types.ts is broken
const FALLBACK_PROVIDERS: ProviderInfo[] = [
  { id: 'zai', name: 'Z.AI (مدمج)', defaultModel: 'glm-4.6', requiresKey: false, supportsStreaming: true },
  { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o-mini', requiresKey: true, supportsStreaming: true },
  { id: 'gemini', name: 'Google Gemini', defaultModel: 'gemini-1.5-flash', requiresKey: true, supportsStreaming: true },
  { id: 'claude', name: 'Anthropic Claude', defaultModel: 'claude-3-5-sonnet-20241022', requiresKey: true, supportsStreaming: true },
  { id: 'deepseek', name: 'DeepSeek', defaultModel: 'deepseek-chat', requiresKey: true, supportsStreaming: true },
  { id: 'groq', name: 'Groq (مجاني وسريع)', defaultModel: 'llama-3.1-8b-instant', requiresKey: true, supportsStreaming: true },
  { id: 'local', name: 'محلي (دون اتصال)', defaultModel: 'local-fallback', requiresKey: false, supportsStreaming: false },
];

interface AISettingsSectionProps {
  isDirector: boolean;
}

export function AISettingsSection({ isDirector }: AISettingsSectionProps) {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [providerKeys, setProviderKeys] = useState({ groq: '', gemini: '', openai: '', deepseek: '' });
  const [providerSaving, setProviderSaving] = useState<string | null>(null);
  const [providerResult, setProviderResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/settings');
      const data = await res.json();
      setSettings(data.settings);
      // Use API providers if 7+ returned, otherwise use hardcoded fallback
      const apiProviders = data.providers || [];
      if (apiProviders.length >= 7) {
        setProviders(apiProviders);
      } else {
        setProviders(FALLBACK_PROVIDERS);
      }
    } catch {
      // Even if API fails, show providers with default settings
      setSettings({ enabled: true, provider: 'groq', apiKey: '', model: 'llama-3.1-8b-instant', maxTokens: 2048, temperature: 0.7 });
      setProviders(FALLBACK_PROVIDERS);
      toast.error('فشل تحميل الإعدادات - استخدام القيم الافتراضية');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل الحفظ');
      }
      toast.success('تم حفظ الإعدادات');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // احفظ الإعدادات أولاً ثم اختبر
      if (isDirector && settings) {
        await fetch('/api/ai/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        });
      }
      const res = await fetch('/api/ai/test-connection', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
      if (data.ok) toast.success(data.message);
      else toast.error(data.message);
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message || 'فشل الاختبار' });
      toast.error('فشل الاختبار');
    } finally {
      setTesting(false);
    }
  };

  // ===== تفعيل أي مزود مباشرة (يكتب الإعدادات مباشرة في قاعدة البيانات) =====
  const handleActivateProvider = async (provider: string) => {
    const key = providerKeys[provider as keyof typeof providerKeys];
    if (!key || key.length < 10) {
      setProviderResult({ ok: false, message: 'أدخل مفتاح API صحيح' });
      return;
    }
    setProviderSaving(provider);
    setProviderResult(null);
    try {
      const res = await fetch('/api/ai/setup-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setProviderResult({ ok: true, message: data.message + '. اذهب إلى التقارير → التحليل الذكي لتجربته.' });
        toast.success(data.message);
        load();
      } else {
        setProviderResult({ ok: false, message: data.error || 'فشل التفعيل' });
      }
    } catch (err: any) {
      setProviderResult({ ok: false, message: 'تعذر الاتصال: ' + (err.message || '') });
    } finally {
      setProviderSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          تعذر تحميل الإعدادات
        </CardContent>
      </Card>
    );
  }

  const currentProvider = providers.find((p) => p.id === settings.provider);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">إعدادات المساعد الذكي</h2>
            <p className="text-sm text-muted-foreground">
              تكوين مزود الذكاء الاصطناعي
            </p>
          </div>
        </div>
        <Badge variant={settings.enabled ? 'default' : 'secondary'}>
          {settings.enabled ? 'مفعّل' : 'معطّل'}
        </Badge>
      </div>

      {/* تفعيل/تعطيل */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">تفعيل المساعد الذكي</p>
            <p className="text-sm text-muted-foreground">
              عند التعطيل، يستخدم النظام المزود المحلي (ردود بسيطة)
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
            disabled={!isDirector}
          />
        </CardContent>
      </Card>

      {/* اختيار المزود */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">المزود</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {providers.map((p) => {
              const Icon = PROVIDER_ICONS[p.id] || Bot;
              const active = settings.provider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    isDirector &&
                    setSettings({
                      ...settings,
                      provider: p.id,
                      model: p.defaultModel,
                      apiKey: p.requiresKey ? settings.apiKey : '',
                    })
                  }
                  disabled={!isDirector}
                  className={`p-3 rounded-xl border text-right transition-all ${
                    active
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/30'
                  } ${!isDirector ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Icon
                      className={`w-5 h-5 ${active ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    {active && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {p.requiresKey ? 'يحتاج مفتاح API' : 'بدون مفتاح'}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* مفتاح API */}
      {currentProvider?.requiresKey && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4" /> مفتاح API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="apiKey">مفتاح {currentProvider.name}</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="sk-..."
                disabled={!isDirector}
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              يتم تخزين المفتاح بأمان في قاعدة البيانات المحلية. لا يُشارك مع الموظفين.
            </p>
          </CardContent>
        </Card>
      )}

      {/* إعدادات النموذج */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">إعدادات النموذج</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="model">النموذج (Model)</Label>
            <Input
              id="model"
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              disabled={!isDirector}
              placeholder={currentProvider?.defaultModel}
            />
            {currentProvider && (
              <p className="text-xs text-muted-foreground mt-1">
                الافتراضي: {currentProvider.defaultModel}
              </p>
            )}
          </div>

          <div>
            <Label>درجة الحرارة (Temperature): {settings.temperature.toFixed(2)}</Label>
            <Slider
              value={[settings.temperature]}
              onValueChange={(v) => setSettings({ ...settings, temperature: v[0] })}
              min={0}
              max={2}
              step={0.1}
              disabled={!isDirector}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>دقيق (0)</span>
              <span>متوازن (0.7)</span>
              <span>إبداعي (2)</span>
            </div>
          </div>

          <div>
            <Label>أقصى عدد للرموز (Max Tokens): {settings.maxTokens}</Label>
            <Slider
              value={[settings.maxTokens]}
              onValueChange={(v) => setSettings({ ...settings, maxTokens: v[0] })}
              min={256}
              max={8192}
              step={256}
              disabled={!isDirector}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>256</span>
              <span>2048 (افتراضي)</span>
              <span>8192</span>
            </div>
          </div>

          {(settings.provider === 'openai' ||
            settings.provider === 'deepseek' ||
            settings.provider === 'groq' ||
            settings.provider === 'gemini' ||
            settings.provider === 'claude') && (
            <div>
              <Label htmlFor="baseUrl">رابط API مخصص (اختياري)</Label>
              <Input
                id="baseUrl"
                value={settings.baseUrl || ''}
                onChange={(e) =>
                  setSettings({ ...settings, baseUrl: e.target.value || undefined })
                }
                placeholder={currentProvider?.defaultModel}
                disabled={!isDirector}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ===== تفعيل المزودات مباشرة (بدون نظام المزودات) ===== */}
      {isDirector && (
        <Card className="border-2 border-blue-300 bg-blue-50/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-blue-700">
              <Zap className="w-5 h-5" /> تفعيل سريع للمزودات
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              اختر مزوداً، الصق مفتاح API، واضغط "تفعيل". سيعمل التحليل الذكي فوراً.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Groq */}
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" /> Groq (مجاني وسريع)
                </span>
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener" className="text-xs text-blue-600 underline">احصل على مفتاح</a>
              </div>
              <div className="flex gap-2">
                <Input type="password" placeholder="gsk_..." value={providerKeys.groq} onChange={(e) => setProviderKeys({ ...providerKeys, groq: e.target.value })} className="flex-1" />
                <Button size="sm" onClick={() => handleActivateProvider('groq')} disabled={!providerKeys.groq || providerSaving === 'groq'}>
                  {providerSaving === 'groq' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تفعيل'}
                </Button>
              </div>
            </div>

            {/* Gemini */}
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-600" /> Google Gemini (مجاني)
                </span>
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-xs text-blue-600 underline">احصل على مفتاح</a>
              </div>
              <div className="flex gap-2">
                <Input type="password" placeholder="AIzaSy..." value={providerKeys.gemini} onChange={(e) => setProviderKeys({ ...providerKeys, gemini: e.target.value })} className="flex-1" />
                <Button size="sm" onClick={() => handleActivateProvider('gemini')} disabled={!providerKeys.gemini || providerSaving === 'gemini'}>
                  {providerSaving === 'gemini' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تفعيل'}
                </Button>
              </div>
            </div>

            {/* OpenAI */}
            <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-600" /> OpenAI (مدفوع)
                </span>
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-xs text-blue-600 underline">احصل على مفتاح</a>
              </div>
              <div className="flex gap-2">
                <Input type="password" placeholder="sk-..." value={providerKeys.openai} onChange={(e) => setProviderKeys({ ...providerKeys, openai: e.target.value })} className="flex-1" />
                <Button size="sm" onClick={() => handleActivateProvider('openai')} disabled={!providerKeys.openai || providerSaving === 'openai'}>
                  {providerSaving === 'openai' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تفعيل'}
                </Button>
              </div>
            </div>

            {/* DeepSeek */}
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4 text-amber-600" /> DeepSeek (رخيص)
                </span>
                <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener" className="text-xs text-blue-600 underline">احصل على مفتاح</a>
              </div>
              <div className="flex gap-2">
                <Input type="password" placeholder="sk-..." value={providerKeys.deepseek} onChange={(e) => setProviderKeys({ ...providerKeys, deepseek: e.target.value })} className="flex-1" />
                <Button size="sm" onClick={() => handleActivateProvider('deepseek')} disabled={!providerKeys.deepseek || providerSaving === 'deepseek'}>
                  {providerSaving === 'deepseek' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تفعيل'}
                </Button>
              </div>
            </div>

            {/* Result */}
            {providerResult && (
              <div className={`p-3 rounded-lg text-sm ${providerResult.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {providerResult.message}
              </div>
            )}

            {/* Current active provider */}
            <div className="text-xs text-muted-foreground text-center pt-2">
              المزود الحالي: <strong>{settings.provider}</strong> • النموذج: <strong>{settings.model}</strong>
            </div>
          </CardContent>
        </Card>
      )}

      {/* أزرار الإجراءات */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Button variant="outline" onClick={handleTest} disabled={testing || !settings.enabled}>
          {testing ? (
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
          ) : (
            <Wifi className="w-4 h-4 ml-2" />
          )}
          اختبار الاتصال
        </Button>
        {isDirector && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 ml-2" />
            )}
            حفظ الإعدادات
          </Button>
        )}
      </div>

      {/* نتيجة الاختبار */}
      {testResult && (
        <Card
          className={`border-2 ${
            testResult.ok ? 'border-green-300 bg-green-50/50' : 'border-red-300 bg-red-50/50'
          }`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            {testResult.ok ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <div>
              <p className="font-medium text-sm">{testResult.message}</p>
              {testResult.latencyMs !== undefined && (
                <p className="text-xs text-muted-foreground">
                  زمن الاستجابة: {testResult.latencyMs}ms
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!isDirector && (
        <Card className="bg-amber-50/50 border-amber-200">
          <CardContent className="p-4 text-sm text-amber-800">
            📋 لديك صلاحية عرض فقط. الاتصال بالمدير لتعديل الإعدادات.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
