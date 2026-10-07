'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  MessageCircle, Send, Settings, FileText, History, Users, AlertCircle,
  CheckCircle2, XCircle, ExternalLink, Plus, Edit, Trash2, Loader2,
  Smartphone, Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppSettings {
  provider: 'wame' | 'callmebot' | 'greenapi';
  callmebotApiKey: string;
  greenapiIdInstance: string;
  greenapiApiTokenInstance: string;
  senderName: string;
  defaultCountryCode: string;
}

interface Template {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string;
  variables: string | null;
  isActive: boolean;
}

interface LogEntry {
  id: string;
  recipientName: string;
  recipientPhone: string;
  message: string;
  templateName: string | null;
  status: string;
  provider: string;
  errorMessage: string | null;
  createdAt: string;
}

interface LatePayer {
  id: string;
  name: string;
  phone: string;
  department: string;
  paidThisMonth: number;
  expectedAmount: number;
  dueAmount: number;
}

export function WhatsAppSection({ isDirector }: { isDirector: boolean }) {
  const [activeTab, setActiveTab] = useState('send');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white">
          <MessageCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">الرسائل والتنبيهات</h2>
          <p className="text-sm text-muted-foreground">إرسال تنبيهات الواتساب للطلاب وأولياء الأمور</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="send" className="gap-1"><Send className="w-4 h-4" /> إرسال</TabsTrigger>
          <TabsTrigger value="late-payers" className="gap-1"><Users className="w-4 h-4" /> المتأخرون</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1"><FileText className="w-4 h-4" /> القوالب</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1"><History className="w-4 h-4" /> السجل</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1"><Settings className="w-4 h-4" /> الإعدادات</TabsTrigger>
        </TabsList>

        <TabsContent value="send"><SendTab /></TabsContent>
        <TabsContent value="late-payers"><LatePayersTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ===== تبويب الإرسال =====
function SendTab() {
  const [phone, setPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sending, setSending] = useState(false);
  const [resultLink, setResultLink] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/whatsapp/templates').then(r => r.json()).then(d => setTemplates(d.templates || []));
  }, []);

  const handleTemplateChange = (name: string) => {
    setTemplateName(name);
    const t = templates.find(t => t.name === name);
    if (t) {
      setMessage(t.body);
    }
  };

  const handleSend = async () => {
    if (!phone || !message) {
      toast({ title: 'تنبيه', description: 'الرقم والرسالة مطلوبان', variant: 'destructive' });
      return;
    }
    setSending(true);
    setResultLink(null);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message, recipientName, templateName }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.link) {
          setResultLink(data.link);
          toast({ title: 'تم', description: 'تم توليد رابط الواتساب. اضغط للإرسال.' });
        } else {
          toast({ title: 'تم', description: 'تم إرسال الرسالة بنجاح' });
        }
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الإرسال', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>إرسال رسالة واتساب</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>اسم المستلم</Label>
            <Input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="مثال: أحمد بن محمد" />
          </div>
          <div className="space-y-2">
            <Label>رقم الهاتف *</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0551234567" dir="ltr" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>القالب (اختياري)</Label>
          <Select value={templateName} onValueChange={handleTemplateChange}>
            <SelectTrigger><SelectValue placeholder="اختر قالباً" /></SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>الرسالة *</Label>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={6}
            placeholder="اكتب الرسالة هنا... يمكنك استخدام {name} و {amount} و {date}"
          />
          <p className="text-xs text-muted-foreground">
            المتغيرات: {'{name}'} {'{amount}'} {'{date}'} {'{department}'} {'{senderName}'}
          </p>
        </div>

        {resultLink && (
          <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">تم توليد رابط الواتساب</p>
              <p className="text-xs text-green-600">اضغط الزر لفتح واتساب وإرسال الرسالة</p>
            </div>
            <Button asChild size="sm">
              <a href={resultLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 ml-1" /> فتح واتساب
              </a>
            </Button>
          </div>
        )}

        <Button onClick={handleSend} disabled={sending} className="w-full">
          {sending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Send className="w-4 h-4 ml-2" />}
          {sending ? 'جاري الإرسال...' : 'إرسال'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ===== تبويب المتأخرين =====
function LatePayersTab() {
  const [latePayers, setLatePayers] = useState<LatePayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/late-payers');
      const data = await res.json();
      setLatePayers(data.latePayers || []);
    } catch {
      toast({ title: 'خطأ', description: 'فشل التحميل', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === latePayers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(latePayers.map(p => p.id)));
    }
  };

  const handleBulkSend = async () => {
    const recipients = latePayers
      .filter(p => selected.has(p.id))
      .map(p => ({
        name: p.name,
        phone: p.phone,
        variables: {
          name: p.name,
          amount: p.dueAmount.toString(),
          department: p.department,
        },
      }));

    if (recipients.length === 0) {
      toast({ title: 'تنبيه', description: 'اختر طالباً واحداً على الأقل', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          templateName: 'تذكير قسط متأخر',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({
          title: 'تم',
          description: `تم إرسال ${data.sent} رسالة بنجاح${data.failed > 0 ? `، فشل ${data.failed}` : ''}`,
        });
        // إن كانت روابط wa.me، افتحها
        if (data.results?.some((r: any) => r.link)) {
          data.results.filter((r: any) => r.link).forEach((r: any) => {
            window.open(r.link, '_blank');
          });
        }
      } else {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>المتأخرون في الدفع ({latePayers.length})</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selected.size === latePayers.length ? 'إلغاء التحديد' : 'تحديد الكل'}
            </Button>
            <Button
              size="sm"
              onClick={handleBulkSend}
              disabled={sending || selected.size === 0}
            >
              {sending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Send className="w-4 h-4 ml-2" />}
              إرسال تذكير ({selected.size})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
        ) : latePayers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
            لا يوجد طلاب متأخرون في الدفع
          </div>
        ) : (
          <div className="space-y-2">
            {latePayers.map(p => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selected.has(p.id) ? 'bg-green-50 border-green-300' : 'hover:bg-muted/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  className="w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.department} • {p.phone}</p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-red-600">{p.dueAmount.toLocaleString('ar-DZ')} دج</p>
                  <p className="text-xs text-muted-foreground">مدفوع: {p.paidThisMonth.toLocaleString('ar-DZ')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== تبويب القوالب =====
function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      toast({ title: 'خطأ', description: 'فشل التحميل', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (t: Template) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا القالب؟')) return;
    try {
      await fetch(`/api/whatsapp/templates?id=${id}`, { method: 'DELETE' });
      toast({ title: 'تم', description: 'تم الحذف' });
      load();
    } catch {
      toast({ title: 'خطأ', description: 'فشل الحذف', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>قوالب الرسائل ({templates.length})</CardTitle>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 ml-2" /> قالب جديد
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="p-4 rounded-lg border hover:bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{t.name}</h4>
                      <Badge variant="secondary">{t.type}</Badge>
                      {!t.isActive && <Badge variant="outline">معطّل</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{t.body}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(t)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editing}
        onSaved={load}
      />
    </Card>
  );
}

function TemplateDialog({ open, onOpenChange, template, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: Template | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('custom');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (template) {
      setName(template.name);
      setType(template.type);
      setBody(template.body);
    } else {
      setName('');
      setType('custom');
      setBody('');
    }
  }, [template, open]);

  const handleSave = async () => {
    if (!name || !body) {
      toast({ title: 'تنبيه', description: 'الاسم والمحتوى مطلوبان', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const method = template ? 'PUT' : 'POST';
      const res = await fetch('/api/whatsapp/templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: template?.id, name, type, body }),
      });
      if (res.ok) {
        toast({ title: 'تم', description: template ? 'تم التعديل' : 'تم الإنشاء' });
        onOpenChange(false);
        onSaved();
      } else {
        toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? 'تعديل قالب' : 'قالب جديد'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>اسم القالب</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>النوع</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="installment_reminder">تذكير قسط</SelectItem>
                <SelectItem value="attendance_alert">تنبيه غياب</SelectItem>
                <SelectItem value="announcement">إعلان عام</SelectItem>
                <SelectItem value="registration">تسجيل جديد</SelectItem>
                <SelectItem value="crm">متابعة CRM</SelectItem>
                <SelectItem value="custom">مخصص</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>محتوى الرسالة</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={6}
              placeholder="اكتب القالب هنا... استخدم {name} و {amount} و {date}"
            />
            <p className="text-xs text-muted-foreground">
              المتغيرات: {'{name}'} {'{amount}'} {'{date}'} {'{department}'} {'{month}'} {'{senderName}'}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== تبويب السجل =====
function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/logs?limit=100');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader><CardTitle>سجل الرسائل ({logs.length})</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">لا توجد رسائل في السجل</div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="p-3 rounded-lg border hover:bg-muted/30">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {log.status === 'sent' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    {log.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
                    {log.status === 'link_generated' && <ExternalLink className="w-4 h-4 text-blue-600" />}
                    <span className="font-medium text-sm">{log.recipientName || log.recipientPhone}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-2 mb-1">{log.message}</p>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">{log.provider}</Badge>
                  {log.templateName && <Badge variant="secondary">{log.templateName}</Badge>}
                  {log.errorMessage && <span className="text-red-600">{log.errorMessage}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== تبويب الإعدادات =====
function SettingsTab() {
  const [settings, setSettings] = useState<WhatsAppSettings>({
    provider: 'wame',
    callmebotApiKey: '',
    greenapiIdInstance: '',
    greenapiApiTokenInstance: '',
    senderName: 'مدرسة السلامة',
    defaultCountryCode: '213',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    try {
      const res = await fetch('/api/whatsapp/settings');
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast({ title: 'تم', description: 'تم حفظ الإعدادات' });
      } else {
        toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* اختيار المزود */}
      <Card>
        <CardHeader><CardTitle>طريقة الإرسال</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { id: 'wame', name: 'روابط wa.me', desc: 'مجاني — يفتح واتساب بالرسالة جاهزة (يدوي)', icon: <Smartphone className="w-5 h-5" /> },
            { id: 'callmebot', name: 'CallMeBot API', desc: 'مجاني — إرسال تلقائي (يتطلب تسجيل الرقم)', icon: <Zap className="w-5 h-5" /> },
            { id: 'greenapi', name: 'Green API', desc: 'مجاني 200/يوم — إرسال تلقائي موثوق', icon: <Zap className="w-5 h-5" /> },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setSettings({ ...settings, provider: p.id as any })}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-right transition-all ${
                settings.provider === p.id ? 'border-green-500 bg-green-50' : 'border-border hover:border-green-300'
              }`}
            >
              <div className={`p-2 rounded-lg ${settings.provider === p.id ? 'bg-green-100 text-green-700' : 'bg-muted'}`}>
                {p.icon}
              </div>
              <div className="flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </div>
              {settings.provider === p.id && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* إعدادات CallMeBot */}
      {settings.provider === 'callmebot' && (
        <Card>
          <CardHeader><CardTitle>إعدادات CallMeBot</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
              <p className="font-medium text-blue-800 mb-1">📋 خطوات الإعداد:</p>
              <ol className="list-decimal list-inside text-blue-700 space-y-1 text-xs">
                <li>أضف الرقم <code dir="ltr">+34 644 79 31 45</code> لجهات الاتصال</li>
                <li>أرسل له رسالة: <code dir="ltr">I allow callmebot to send me messages</code></li>
                <li>ستصلك رسالة بالـ API Key</li>
                <li>الصق الـ API Key أدناه</li>
              </ol>
              <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs mt-2 inline-block">
                دليل مفصّل ←
              </a>
            </div>
            <div className="space-y-2">
              <Label>CallMeBot API Key</Label>
              <Input
                value={settings.callmebotApiKey}
                onChange={e => setSettings({ ...settings, callmebotApiKey: e.target.value })}
                placeholder="1234567"
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* إعدادات Green API */}
      {settings.provider === 'greenapi' && (
        <Card>
          <CardHeader><CardTitle>إعدادات Green API</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
              <p className="font-medium text-blue-800 mb-1">📋 خطوات الإعداد:</p>
              <ol className="list-decimal list-inside text-blue-700 space-y-1 text-xs">
                <li>اذهب إلى <a href="https://green-api.com" target="_blank" rel="noopener noreferrer" className="underline">green-api.com</a></li>
                <li>أنشئ حساباً مجاناً</li>
                <li>امسح QR code بربط واتساب</li>
                <li>انسخ IdInstance و ApiTokenInstance</li>
              </ol>
            </div>
            <div className="space-y-2">
              <Label>Id Instance</Label>
              <Input
                value={settings.greenapiIdInstance}
                onChange={e => setSettings({ ...settings, greenapiIdInstance: e.target.value })}
                placeholder="7102345678"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>Api Token Instance</Label>
              <Input
                value={settings.greenapiApiTokenInstance}
                onChange={e => setSettings({ ...settings, greenapiApiTokenInstance: e.target.value })}
                placeholder="a6b3c4d5e6f7..."
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* إعدادات عامة */}
      <Card>
        <CardHeader><CardTitle>إعدادات عامة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>اسم المُرسِل</Label>
            <Input
              value={settings.senderName}
              onChange={e => setSettings({ ...settings, senderName: e.target.value })}
              placeholder="مدرسة السلامة"
            />
          </div>
          <div className="space-y-2">
            <Label>رمز الدولة الافتراضي</Label>
            <Input
              value={settings.defaultCountryCode}
              onChange={e => setSettings({ ...settings, defaultCountryCode: e.target.value })}
              placeholder="213"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">213 للجزائر، 1 لأمريكا، 33 لفرنسا...</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
        {saving ? <Loader2 className="w-5 h-5 ml-2 animate-spin" /> : <Settings className="w-5 h-5 ml-2" />}
        حفظ الإعدادات
      </Button>
    </div>
  );
}
