'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mail, Send, Inbox, Search, Trash2, Plus, AlertCircle, CheckCircle2,
  MailOpen, User, Users, X, Reply,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string | null;
  recipientName: string | null;
  subject: string;
  content: string;
  priority: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  label: string;
}

interface MessagesSectionProps {
  isDirector: boolean;
  currentUserId?: string;
}

// خريطة الأولويات إلى تسمية عربية وألوان
const PRIORITY_CONFIG: Record<string, { label: string; variant: 'destructive' | 'default' | 'secondary'; className?: string }> = {
  urgent: { label: 'عاجل', variant: 'destructive' },
  high: { label: 'مرتفع', variant: 'default', className: 'bg-orange-500 hover:bg-orange-600' },
  normal: { label: 'عادي', variant: 'secondary' },
  low: { label: 'منخفض', variant: 'secondary' },
};

// تنسيق الوقت بطريقة نسبية بالعربية
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  if (hours < 24) return `قبل ${hours} ساعة`;
  if (days < 7) return `قبل ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function MessagesSection({ isDirector, currentUserId }: MessagesSectionProps) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [viewMessage, setViewMessage] = useState<Message | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [formData, setFormData] = useState({
    recipientId: '',
    subject: '',
    content: '',
    priority: 'normal',
  });
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  // جلب الرسائل
  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', activeTab);
      if (search) params.set('search', search);
      const res = await fetch(`/api/messages?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('فشل التحميل');
      const data = await res.json();
      setMessages(data.messages || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (e) {
      console.error(e);
      toast({ title: 'خطأ', description: 'تعذر تحميل الرسائل', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // جلب قائمة الموظفين
  useEffect(() => {
    fetch('/api/users/staff-names')
      .then(r => r.json())
      .then(d => setStaff(d.staff || []))
      .catch(e => console.error(e));
  }, []);

  useEffect(() => { load(); }, [activeTab]);

  // بحث مؤجل
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // قائمة المستلمين المتاحين - يستثنى المستخدم الحالي
  const availableRecipients = useMemo(() => {
    return staff.filter(s => s.id !== currentUserId);
  }, [staff, currentUserId]);

  const handleOpenCompose = () => {
    setFormData({
      recipientId: isDirector ? '' : (availableRecipients[0]?.id || ''),
      subject: '',
      content: '',
      priority: 'normal',
    });
    setComposeOpen(true);
  };

  const handleSend = async () => {
    if (!formData.subject.trim() || !formData.content.trim()) {
      toast({ title: 'تنبيه', description: 'الموضوع والمحتوى مطلوبان', variant: 'destructive' });
      return;
    }
    if (isDirector && !formData.recipientId && !formData.recipientId !== '') {
      // المدير يمكنه الإرسال للجميع (recipientId فارغ = للجميع)
    }
    setSending(true);
    try {
      const payload: any = {
        subject: formData.subject.trim(),
        content: formData.content.trim(),
        priority: formData.priority,
      };
      if (isDirector) {
        payload.recipientId = formData.recipientId || null;
      } else {
        payload.recipientId = formData.recipientId || null;
      }
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error || 'فشل الإرسال', variant: 'destructive' });
        return;
      }
      toast({ title: 'تم', description: 'تم إرسال الرسالة بنجاح' });
      setComposeOpen(false);
      setFormData({ recipientId: '', subject: '', content: '', priority: 'normal' });
      if (activeTab === 'sent') load();
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  // فتح رسالة للقراءة + تعليمها كمقروءة
  const handleMessageClick = async (msg: Message) => {
    setViewMessage(msg);
    if (!msg.isRead && activeTab === 'inbox') {
      // تحديث متفائل
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
      setUnreadCount(prev => Math.max(0, prev - 1));
      try {
        await fetch('/api/messages/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: msg.id }),
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDelete = async (msg: Message, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('حذف هذه الرسالة؟')) return;
    try {
      const res = await fetch(`/api/messages/read?id=${msg.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: 'خطأ', description: data.error || 'فشل الحذف', variant: 'destructive' });
        return;
      }
      toast({ title: 'تم', description: 'تم حذف الرسالة' });
      if (viewMessage?.id === msg.id) setViewMessage(null);
      load();
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    }
  };

  const handleReply = (msg: Message) => {
    setFormData({
      recipientId: msg.senderId,
      subject: `رد: ${msg.subject}`,
      content: '',
      priority: 'normal',
    });
    setViewMessage(null);
    setComposeOpen(true);
  };

  const priorityConfig = (p: string) => PRIORITY_CONFIG[p] || PRIORITY_CONFIG.normal;

  return (
    <div className="space-y-4">
      {/* رأس القسم */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" /> الرسائل
          </h2>
          <p className="text-muted-foreground text-sm">
            تبادل الرسائل الداخلية •{' '}
            {unreadCount > 0 ? (
              <span className="text-primary font-medium">{unreadCount} غير مقروءة</span>
            ) : (
              <span className="text-emerald-600">الكل مقروء</span>
            )}
          </p>
        </div>
        <Button onClick={handleOpenCompose}>
          <Plus className="w-4 h-4 ml-2" /> رسالة جديدة
        </Button>
      </div>

      {/* تبويبات الوارد/المرسلة */}
      <div className="flex gap-1 border-b">
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'inbox'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('inbox')}
        >
          <Inbox className="w-4 h-4" />
          صندوق الوارد
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs h-5 px-1.5">
              {unreadCount}
            </Badge>
          )}
        </button>
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'sent'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('sent')}
        >
          <Send className="w-4 h-4" />
          المرسلة
        </button>
      </div>

      {/* بحث */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث في الموضوع أو المحتوى..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* قائمة الرسائل */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 bg-muted rounded" />
                      <div className="h-2.5 w-full bg-muted rounded" />
                      <div className="h-2 w-1/4 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {activeTab === 'inbox' ? 'لا توجد رسائل في الوارد' : 'لم ترسل أي رسالة بعد'}
                </p>
                <p className="text-xs mt-1 opacity-70">
                  {activeTab === 'inbox'
                    ? 'ستظهر الرسائل الموجهة لك هنا'
                    : 'استخدم زر "رسالة جديدة" لإرسال رسالة'}
                </p>
              </div>
            ) : (
              <div className="divide-y" dir="rtl">
                {messages.map((msg) => {
                  const pc = priorityConfig(msg.priority);
                  const PriorityIcon = msg.priority === 'urgent' || msg.priority === 'high' ? AlertCircle : Mail;
                  return (
                    <button
                      key={msg.id}
                      onClick={() => handleMessageClick(msg)}
                      className={cn(
                        'w-full text-right p-4 flex gap-3 hover:bg-accent/50 transition-colors relative border-r-2',
                        !msg.isRead && activeTab === 'inbox' ? 'border-r-primary bg-primary/5' : 'border-r-transparent',
                        !msg.isRead && activeTab === 'inbox' ? 'font-medium' : ''
                      )}
                    >
                      <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                        msg.isRead ? 'bg-muted' : 'bg-primary/10'
                      )}>
                        {activeTab === 'inbox' ? (
                          msg.isRead ? <MailOpen className="w-5 h-5 text-muted-foreground" /> : <Mail className="w-5 h-5 text-primary" />
                        ) : (
                          <Send className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={cn('text-sm truncate', !msg.isRead && activeTab === 'inbox' ? 'font-semibold' : 'font-medium')}>
                            {activeTab === 'inbox' ? msg.senderName : (msg.recipientName || 'جميع الموظفين')}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {msg.priority !== 'normal' && msg.priority !== 'low' && (
                              <Badge variant={pc.variant} className={cn('text-[10px] h-5 gap-0.5', pc.className)}>
                                <PriorityIcon className="w-3 h-3" />
                                {pc.label}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground/70 num">
                              {formatRelativeTime(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className={cn('text-sm truncate', !msg.isRead && activeTab === 'inbox' ? 'font-medium' : 'text-muted-foreground')}>
                          {msg.subject}
                        </p>
                        <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
                          {msg.content}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {activeTab === 'inbox' ? (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {msg.senderRole === 'director' ? 'مدير' : 'موظف'}
                              {msg.recipientId === null && msg.senderRole === 'director' && (
                                <span className="flex items-center gap-0.5">
                                  • <Users className="w-3 h-3" /> للجميع
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <span>إلى:</span>
                              {msg.recipientName || 'جميع الموظفين'}
                            </span>
                          )}
                          {!msg.isRead && activeTab === 'inbox' && (
                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mr-auto" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* نافذة إنشاء رسالة */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              رسالة جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>المستلم</Label>
              {isDirector ? (
                <Select
                  value={formData.recipientId || 'all'}
                  onValueChange={(v) => setFormData({ ...formData, recipientId: v === 'all' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المستلم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        جميع الموظفين
                      </span>
                    </SelectItem>
                    {availableRecipients.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={formData.recipientId}
                  onValueChange={(v) => setFormData({ ...formData, recipientId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المستلم" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRecipients.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!isDirector && availableRecipients.length === 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  لا يوجد مدير متاح حالياً. يمكنك فقط الإرسال للمدير.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select
                value={formData.priority}
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفض</SelectItem>
                  <SelectItem value="normal">عادي</SelectItem>
                  <SelectItem value="high">مرتفع</SelectItem>
                  <SelectItem value="urgent">عاجل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الموضوع *</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="موضوع الرسالة"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>المحتوى *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="اكتب محتوى الرسالة هنا..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>إلغاء</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground ml-2" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 ml-2" /> إرسال
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة قراءة الرسالة */}
      <Dialog open={!!viewMessage} onOpenChange={(v) => !v && setViewMessage(null)}>
        <DialogContent className="max-w-2xl">
          {viewMessage && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-8">
                  {viewMessage.priority !== 'normal' && viewMessage.priority !== 'low' && (
                    <Badge
                      variant={priorityConfig(viewMessage.priority).variant}
                      className={priorityConfig(viewMessage.priority).className}
                    >
                      {priorityConfig(viewMessage.priority).label}
                    </Badge>
                  )}
                  {viewMessage.subject}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">من</span>
                    <div className="flex items-center gap-1.5 font-medium">
                      <User className="w-4 h-4" />
                      {viewMessage.senderName}
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {viewMessage.senderRole === 'director' ? 'مدير' : 'موظف'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">إلى</span>
                    <div className="flex items-center gap-1.5 font-medium">
                      {viewMessage.recipientId === null ? (
                        <>
                          <Users className="w-4 h-4" />
                          {viewMessage.recipientName || 'جميع الموظفين'}
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4" />
                          {viewMessage.recipientName || '-'}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-xs mb-0.5">التاريخ</span>
                    <span className="num text-xs">
                      {new Date(viewMessage.createdAt).toLocaleString('ar-EG')}
                    </span>
                    {viewMessage.readAt && activeTab === 'sent' && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-3 h-3" />
                        قُرئت في {new Date(viewMessage.readAt).toLocaleString('ar-EG')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed p-4 bg-background border rounded-lg">
                  {viewMessage.content}
                </div>
              </div>
              <DialogFooter className="gap-2">
                {activeTab === 'inbox' && (
                  <Button
                    variant="outline"
                    onClick={() => handleReply(viewMessage)}
                    className="mr-auto"
                  >
                    <Reply className="w-4 h-4 ml-2" /> رد
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={(e) => handleDelete(viewMessage, e)}
                >
                  <Trash2 className="w-4 h-4 ml-2" /> حذف
                </Button>
                <Button variant="outline" onClick={() => setViewMessage(null)}>إغلاق</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
