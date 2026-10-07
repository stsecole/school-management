'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sparkles,
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Send,
  Paperclip,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  FileText,
  FileSpreadsheet,
  Bot,
  User as UserIcon,
  Check,
  AlertTriangle,
  X,
  MessageSquare,
  Lightbulb,
  Loader2,
  Menu,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  name: string;
  role: 'director' | 'employee';
}

interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  messageCount: number;
  updatedAt: string;
}

interface DisplayData {
  type: 'table' | 'chart' | 'text' | 'card';
  title?: string;
  columns?: string[];
  rows?: any[][];
  chart?: {
    type: 'bar' | 'line' | 'pie' | 'area';
    data: any[];
    xKey?: string;
    yKeys?: string[];
  };
  cards?: { label: string; value: string | number; icon?: string }[];
}

interface ActionProposed {
  action: string;
  params: Record<string, any>;
  label?: string;
  description?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageType: string;
  metadata: {
    intent?: string;
    tool?: string;
    toolResult?: {
      success: boolean;
      message?: string;
      display?: DisplayData;
      data?: any;
    };
    action?: ActionProposed;
    execution?: {
      success: boolean;
      message: string;
      executedAt: string;
    };
  } | null;
  feedback?: 'positive' | 'negative' | null;
  createdAt: string;
  streaming?: boolean;
}

const QUICK_SUGGESTIONS = [
  { icon: '👥', title: 'كم عدد الطلاب؟', text: 'كم عدد الطلاب المسجلين؟' },
  { icon: '⚠️', title: 'المتأخرون في الدفع', text: 'من هم الطلاب المتأخرون في الدفع؟' },
  { icon: '🏆', title: 'أكثر التخصصات', text: 'ما هي أكثر التخصصات من حيث عدد الطلاب؟' },
  { icon: '💰', title: 'مداخيل الأسبوع', text: 'كم هي مداخيل هذا الأسبوع؟' },
  { icon: '⏰', title: 'أكثر الأساتذة ساعات', text: 'من هم أكثر الأساتذة من حيث ساعات التدريس؟' },
  { icon: '📊', title: 'الحضور اليوم', text: 'كم عدد سجلات الحضور بعدد صفر اليوم؟' },
  { icon: '🆕', title: 'الطلاب الجدد', text: 'كم عدد الطلاب الجدد هذا الشهر؟' },
  { icon: '📅', title: 'الأقساط المتأخرة', text: 'اعرض الأقساط المتأخرة' },
  { icon: '📈', title: 'ربح الشهر', text: 'كم هو ربح هذا الشهر؟' },
  { icon: '🏫', title: 'توزيع الطلاب', text: 'كيف يتوزع الطلاب على الأقسام؟' },
  { icon: '🏠', title: 'استخدام القاعات', text: 'ما هو معدل استخدام القاعات؟' },
  { icon: '🔍', title: 'تعارضات الأساتذة', text: 'هل توجد تعارضات في جدول الأساتذة؟' },
  { icon: '📝', title: 'تقرير الحضور', text: 'أعطني تقرير الحضور لآخر 3 أشهر' },
  { icon: '💡', title: 'اقتراحات ذكية', text: 'أعطني اقتراحات ذكية لتحسين المؤسسة' },
  { icon: '📱', title: 'منشور للسوشال', text: 'اكتب منشوراً للشبكات الاجتماعية حول التسجيلات' },
  { icon: '🔔', title: 'تذكير بالدفع', text: 'اكتب رسالة تذكير بالدفع للطلاب المتأخرين' },
];

const CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function AIAssistantSection({ user }: { user: User }) {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: ActionProposed; messageId: string } | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ===== جلب المحادثات =====
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      /* تجاهل */
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ===== جلب رسائل محادثة =====
  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveConvId(id);
      setMessages(
        (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          messageType: m.messageType,
          metadata: m.metadata,
          feedback: m.feedback,
          createdAt: m.createdAt,
        }))
      );
      setSidebarOpen(false);
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل المحادثة', variant: 'destructive' });
    }
  }, [toast]);

  // ===== محادثة جديدة =====
  const newConversation = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

  // ===== تثبيت محادثة =====
  const togglePin = useCallback(
    async (id: string, pinned: boolean) => {
      await fetch(`/api/ai/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !pinned }),
      });
      fetchConversations();
    },
    [fetchConversations]
  );

  // ===== حذف محادثة =====
  const deleteConversation = useCallback(
    async (id: string) => {
      await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' });
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
      fetchConversations();
      toast({ title: 'تم الحذف', description: 'تم حذف المحادثة' });
    },
    [activeConvId, fetchConversations, toast]
  );

  // ===== إرسال رسالة (مع SSE streaming) =====
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;
      setInput('');

      // أضف رسالة المستخدم محلياً
      const userMsg: Message = {
        id: 'temp-' + Date.now(),
        role: 'user',
        content: text,
        messageType: 'text',
        metadata: null,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: Message = {
        id: 'temp-ai-' + Date.now(),
        role: 'assistant',
        content: '',
        messageType: 'text',
        metadata: null,
        createdAt: new Date().toISOString(),
        streaming: true,
      };
      setMessages((m) => [...m, userMsg, assistantMsg]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: activeConvId, message: text }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error('فشل الاتصال بالمساعد');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let newConvId = activeConvId;
        let assistantId = assistantMsg.id;
        let toolResult: any = null;
        let actionProposed: ActionProposed | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';
          for (const evt of events) {
            const line = evt.trim();
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;
            let data: any;
            try {
              data = JSON.parse(jsonStr);
            } catch {
              continue;
            }
            switch (data.type) {
              case 'conversation':
                newConvId = data.conversationId;
                if (!activeConvId) setActiveConvId(newConvId);
                break;
              case 'delta':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + data.delta }
                      : m
                  )
                );
                break;
              case 'tool_result':
                toolResult = data.result;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          messageType: 'rich',
                          metadata: {
                            ...(m.metadata || {}),
                            tool: data.result.tool,
                            toolResult: data.result,
                          },
                        }
                      : m
                  )
                );
                break;
              case 'action_proposed':
                actionProposed = data.action;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          metadata: {
                            ...(m.metadata || {}),
                            action: data.action,
                          },
                        }
                      : m
                  )
                );
                break;
              case 'saved':
                assistantId = data.messageId;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === 'temp-ai-' + (assistantMsg.id.split('-').pop() || '')
                      ? { ...m, id: data.messageId, streaming: false }
                      : m
                  )
                );
                break;
              case 'error':
                toast({
                  title: 'خطأ',
                  description: data.message || 'حدث خطأ',
                  variant: 'destructive',
                });
                break;
            }
          }
        }

        // أوقف حالة streaming
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId || m.streaming
              ? { ...m, streaming: false, id: assistantId }
              : m
          )
        );
        fetchConversations();
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // أوقف المستخدم
        } else {
          toast({
            title: 'خطأ',
            description: err?.message || 'فشل الاتصال',
            variant: 'destructive',
          });
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.streaming
              ? {
                  ...m,
                  streaming: false,
                  content:
                    m.content ||
                    '⚠️ تعذّر الحصول على استجابة. تحقق من إعدادات المساعد.',
                }
              : m
          )
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [activeConvId, streaming, toast, fetchConversations]
  );

  // ===== إيقاف streaming =====
  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setStreaming(false);
    }
  }, []);

  // ===== رفع ملف =====
  const handleUpload = useCallback(async () => {
    if (!attachedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', attachedFile);
      fd.append('question', input || 'لخّص محتوى هذا الملف.');
      const res = await fetch('/api/ai/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الرفع');

      // أضف رسالة المساعد بالإجابة
      const userMsg: Message = {
        id: 'temp-u-' + Date.now(),
        role: 'user',
        content: `📎 ${attachedFile.name}\n\n${input || 'لخّص محتوى هذا الملف.'}`,
        messageType: 'text',
        metadata: null,
        createdAt: new Date().toISOString(),
      };
      const aiMsg: Message = {
        id: 'temp-ai-' + Date.now(),
        role: 'assistant',
        content: data.answer || 'لا توجد إجابة',
        messageType: 'text',
        metadata: { tool: 'upload', toolResult: { success: true, data: { fileName: attachedFile.name } } },
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, userMsg, aiMsg]);
      setInput('');
      setAttachedFile(null);
      toast({ title: 'تم التحليل', description: `${attachedFile.name} (${data.extractedLength} حرف)` });
    } catch (err: any) {
      toast({
        title: 'فشل الرفع',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }, [attachedFile, input, toast]);

  // ===== تنفيذ إجراء مؤكد =====
  const confirmAction = useCallback(async () => {
    if (!pendingAction) return;
    try {
      const res = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: pendingAction.action.action,
          params: pendingAction.action.params,
          messageId: pendingAction.messageId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'تم التنفيذ', description: data.message });
        // حدّث الرسالة بحالة التنفيذ
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingAction.messageId
              ? {
                  ...m,
                  metadata: {
                    ...(m.metadata || {}),
                    execution: {
                      success: true,
                      message: data.message,
                      executedAt: new Date().toISOString(),
                    },
                  },
                }
              : m
          )
        );
      } else {
        toast({
          title: 'فشل التنفيذ',
          description: data.message,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setPendingAction(null);
    }
  }, [pendingAction, toast]);

  // ===== ملاحظات (feedback) =====
  const giveFeedback = useCallback(
    async (messageId: string, feedback: 'positive' | 'negative') => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback } : m))
      );
      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, feedback }),
      });
    },
    []
  );

  // ===== نسخ المحتوى =====
  const copyContent = useCallback(
    (content: string) => {
      navigator.clipboard.writeText(content);
      toast({ title: 'تم النسخ', description: 'تم نسخ النص إلى الحافظة' });
    },
    [toast]
  );

  // ===== إعادة التوليد =====
  const regenerate = useCallback(
    (msg: Message) => {
      // ابحث عن رسالة المستخدم السابقة
      const idx = messages.findIndex((m) => m.id === msg.id);
      if (idx <= 0) return;
      const prevUser = messages[idx - 1];
      if (prevUser.role !== 'user') return;
      // احذف رسالة المساعد الحالية وأعد الإرسال
      setMessages((prev) => prev.slice(0, idx));
      sendMessage(prevUser.content);
    },
    [messages, sendMessage]
  );

  // ===== تصدير =====
  const exportMessage = useCallback(
    async (format: 'pdf' | 'excel', msg: Message) => {
      try {
        const meta = msg.metadata;
        const res = await fetch('/api/ai/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format,
            content: msg.content,
            title: 'تقرير المساعد الذكي',
            table: meta?.toolResult?.display?.type === 'table'
              ? {
                  columns: meta.toolResult.display.columns || [],
                  rows: meta.toolResult.display.rows || [],
                }
              : undefined,
          }),
        });
        if (format === 'excel') {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'تقرير.xlsx';
          a.click();
          URL.revokeObjectURL(url);
        } else {
          // PDF: افتح HTML في نافذة جديدة
          const html = await res.text();
          const w = window.open('', '_blank');
          if (w) {
            w.document.write(html);
            w.document.close();
          }
        }
        toast({ title: 'تم التصدير', description: `تم إنشاء ${format === 'pdf' ? 'PDF' : 'Excel'}` });
      } catch (err: any) {
        toast({
          title: 'فشل التصدير',
          description: err?.message,
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  // ===== التمرير التلقائي =====
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ===== المحادثات المصفاة =====
  const filteredConvs = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const pinnedConvs = filteredConvs.filter((c) => c.pinned);
  const otherConvs = filteredConvs.filter((c) => !c.pinned);

  return (
    <div className="flex h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] gap-0 -m-4 lg:-m-6 lg:-m-8">
      {/* ===== Sidebar Desktop ===== */}
      <aside className="hidden lg:flex w-72 flex-col border-l bg-card">
        <SidebarContent
          conversations={filteredConvs}
          pinnedConvs={pinnedConvs}
          otherConvs={otherConvs}
          activeConvId={activeConvId}
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
          onNew={newConversation}
          onSelect={loadConversation}
          onPin={togglePin}
          onDelete={deleteConversation}
        />
      </aside>

      {/* ===== Main Chat Area ===== */}
      <div className="flex-1 flex flex-col bg-background min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-card">
          <div className="flex items-center gap-2">
            {/* Sidebar Mobile Trigger */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0">
                <SidebarContent
                  conversations={filteredConvs}
                  pinnedConvs={pinnedConvs}
                  otherConvs={otherConvs}
                  activeConvId={activeConvId}
                  searchTerm={searchTerm}
                  onSearch={setSearchTerm}
                  onNew={newConversation}
                  onSelect={loadConversation}
                  onPin={togglePin}
                  onDelete={deleteConversation}
                />
              </SheetContent>
            </Sheet>
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">المساعد الذكي</h2>
              <p className="text-xs text-muted-foreground">
                {streaming ? 'يكتب...' : 'جاهز للمساعدة'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={newConversation} className="gap-2">
            <Plus className="w-4 h-4" /> محادثة جديدة
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto p-4 md:p-6">
            {messages.length === 0 ? (
              <WelcomeScreen onSuggestion={sendMessage} />
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    userName={user.name}
                    onCopy={() => copyContent(msg.content)}
                    onRegenerate={() => regenerate(msg)}
                    onFeedback={(f) => giveFeedback(msg.id, f)}
                    onExportPdf={() => exportMessage('pdf', msg)}
                    onExportExcel={() => exportMessage('excel', msg)}
                    onExecuteAction={() =>
                      msg.metadata?.action &&
                      setPendingAction({
                        action: msg.metadata.action,
                        messageId: msg.id,
                      })
                    }
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t bg-card p-3">
          <div className="max-w-4xl mx-auto">
            {attachedFile && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
                <Paperclip className="w-4 h-4" />
                <span className="flex-1 truncate">{attachedFile.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttachedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.txt,.md,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setAttachedFile(f);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={streaming || uploading}
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>إرفاق ملف (Excel, PDF, نص)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (attachedFile) handleUpload();
                    else sendMessage(input);
                  }
                }}
                placeholder="اكتب رسالتك هنا... (Enter للإرسال، Shift+Enter لسطر جديد)"
                className="flex-1 min-h-[44px] max-h-32 resize-none"
                disabled={streaming}
              />
              {streaming ? (
                <Button variant="destructive" size="icon" onClick={stopStreaming}>
                  <X className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={() => (attachedFile ? handleUpload() : sendMessage(input))}
                  disabled={!input.trim() && !attachedFile}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              المساعد يستخدم بيانات المؤسسة. قد يخطئ — تحقق من المعلومات الحساسة.
            </p>
          </div>
        </div>
      </div>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              تأكيد الإجراء
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action.description || 'هل أنت متأكد من تنفيذ هذا الإجراء؟'}
              <br />
              <Badge variant="outline" className="mt-2">
                {pendingAction?.action.label || pendingAction?.action.action}
              </Badge>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              تأكيد التنفيذ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===== Sidebar Content =====
function SidebarContent({
  conversations,
  pinnedConvs,
  otherConvs,
  activeConvId,
  searchTerm,
  onSearch,
  onNew,
  onSelect,
  onPin,
  onDelete,
}: {
  conversations: Conversation[];
  pinnedConvs: Conversation[];
  otherConvs: Conversation[];
  activeConvId: string | null;
  searchTerm: string;
  onSearch: (v: string) => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const renderConv = (c: Conversation) => (
    <div
      key={c.id}
      className={`group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${
        activeConvId === c.id
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-muted'
      }`}
      onClick={() => onSelect(c.id)}
    >
      <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{c.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {c.messageCount} رسالة · {new Date(c.updatedAt).toLocaleDateString('ar-DZ')}
        </p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onPin(c.id, c.pinned);
          }}
        >
          {c.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('حذف هذه المحادثة؟')) onDelete(c.id);
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <Button onClick={onNew} className="w-full gap-2">
          <Plus className="w-4 h-4" /> محادثة جديدة
        </Button>
        <div className="relative mt-2">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="بحث..."
            className="pr-8 text-sm"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {conversations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
              لا توجد محادثات بعد
            </div>
          )}
          {pinnedConvs.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground px-2 mb-1 flex items-center gap-1">
                <Pin className="w-3 h-3" /> مثبّتة
              </p>
              <div className="space-y-0.5">{pinnedConvs.map(renderConv)}</div>
            </div>
          )}
          {otherConvs.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground px-2 mb-1">
                المحادثات
              </p>
              <div className="space-y-0.5">{otherConvs.map(renderConv)}</div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ===== Welcome Screen =====
function WelcomeScreen({ onSuggestion }: { onSuggestion: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-4 rounded-3xl bg-primary/10 mb-4">
        <Sparkles className="w-12 h-12 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-2">مرحباً بك في المساعد الذكي</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        أنا هنا لمساعدتك في إدارة المؤسسة. ابدأ باختيار اقتراح أو اكتب سؤالك.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-3xl">
        {QUICK_SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestion(s.text)}
            className="group flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted hover:border-primary/30 transition-all text-right"
          >
            <span className="text-2xl">{s.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium group-hover:text-primary transition-colors">
                {s.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">{s.text}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== Message Bubble =====
function MessageBubble({
  message,
  userName,
  onCopy,
  onRegenerate,
  onFeedback,
  onExportPdf,
  onExportExcel,
  onExecuteAction,
}: {
  message: Message;
  userName: string;
  onCopy: () => void;
  onRegenerate: () => void;
  onFeedback: (f: 'positive' | 'negative') => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onExecuteAction: () => void;
}) {
  const isUser = message.role === 'user';
  const display = message.metadata?.toolResult?.display;
  const action = message.metadata?.action;
  const execution = message.metadata?.execution;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        {isUser ? (
          <UserIcon className="w-5 h-5" />
        ) : (
          <Bot className="w-5 h-5" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold">
            {isUser ? userName : 'المساعد الذكي'}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(message.createdAt).toLocaleTimeString('ar-DZ', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {message.streaming && (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Message Content */}
        {!isUser && message.content ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-right" dir="rtl">
            <ReactMarkdown
              components={{
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="w-full text-sm border-collapse">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border bg-muted p-2 text-right font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border p-2 text-right">{children}</td>
                ),
                code: ({ className, children }) => {
                  const isBlock = className?.includes('language-');
                  if (isBlock) {
                    return (
                      <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs" dir="ltr">
                        <code>{children}</code>
                      </pre>
                    );
                  }
                  return (
                    <code className="bg-muted px-1 py-0.5 rounded text-xs" dir="ltr">
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : !isUser && !message.content && message.streaming ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">يفكّر...</span>
          </div>
        ) : (
          <div className="bg-primary/10 rounded-2xl px-4 py-2 inline-block text-sm">
            {message.content}
          </div>
        )}

        {/* Tool Result Display */}
        {display && <DisplayComponent display={display} />}

        {/* Action Proposal */}
        {action && !execution && (
          <div className="mt-3 p-3 rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold mb-1">إجراء مقترح: {action.label}</p>
                <p className="text-xs text-muted-foreground mb-2">
                  {action.description}
                </p>
                <Button size="sm" onClick={onExecuteAction} className="gap-1">
                  <Check className="w-3.5 h-3.5" /> تأكيد وتنفيذ
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Execution Result */}
        {execution && (
          <div
            className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-2 ${
              execution.success
                ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
            }`}
          >
            {execution.success ? (
              <Check className="w-4 h-4" />
            ) : (
              <X className="w-4 h-4" />
            )}
            {execution.message}
          </div>
        )}

        {/* Footer Actions */}
        {!isUser && !message.streaming && message.content && (
          <div className="flex items-center gap-1 mt-2 opacity-60 hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onCopy}>
              <Copy className="w-3 h-3" /> نسخ
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onRegenerate}>
              <RefreshCw className="w-3 h-3" /> إعادة
            </Button>
            {display?.type === 'table' && (
              <>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onExportPdf}>
                  <FileText className="w-3 h-3" /> PDF
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onExportExcel}>
                  <FileSpreadsheet className="w-3 h-3" /> Excel
                </Button>
              </>
            )}
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 w-7 p-0 ${message.feedback === 'positive' ? 'text-green-600' : ''}`}
              onClick={() => onFeedback('positive')}
            >
              <ThumbsUp className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 w-7 p-0 ${message.feedback === 'negative' ? 'text-red-600' : ''}`}
              onClick={() => onFeedback('negative')}
            >
              <ThumbsDown className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Display Component (Tables/Charts/Cards) =====
function DisplayComponent({ display }: { display: DisplayData }) {
  if (display.type === 'card' && display.cards) {
    return (
      <div className="mt-3">
        {display.title && (
          <p className="text-sm font-semibold mb-2 flex items-center gap-1">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            {display.title}
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {display.cards.map((c, i) => (
            <Card key={i} className="p-3">
              <p className="text-[10px] text-muted-foreground">{c.label}</p>
              <p className="text-lg font-bold mt-1">{c.value}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (display.type === 'table' && display.columns) {
    return (
      <div className="mt-3 rounded-lg border overflow-hidden">
        {display.title && (
          <div className="bg-muted px-3 py-2 text-sm font-semibold">{display.title}</div>
        )}
        <ScrollArea className="max-h-96">
          <Table>
            <TableHeader>
              <TableRow>
                {display.columns.map((c, i) => (
                  <TableHead key={i} className="text-right font-semibold">{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(display.rows || []).map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j} className="text-right text-sm">{String(cell ?? '-')}</TableCell>
                  ))}
                </TableRow>
              ))}
              {(!display.rows || display.rows.length === 0) && (
                <TableRow>
                  <TableCell colSpan={display.columns.length} className="text-center text-muted-foreground py-6">
                    لا توجد بيانات
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    );
  }

  if (display.type === 'chart' && display.chart) {
    const { chart } = display;
    return (
      <div className="mt-3 p-3 rounded-lg border bg-card">
        {display.title && (
          <p className="text-sm font-semibold mb-2">{display.title}</p>
        )}
        <div className="h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            {chart.type === 'bar' ? (
              <BarChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={chart.xKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RTooltip />
                {chart.yKeys?.map((k, i) => (
                  <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </BarChart>
            ) : chart.type === 'line' ? (
              <LineChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={chart.xKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RTooltip />
                <Legend />
                {chart.yKeys?.map((k, i) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            ) : chart.type === 'pie' ? (
              <PieChart>
                <Pie
                  data={chart.data}
                  dataKey={chart.yKeys?.[0] || 'value'}
                  nameKey={chart.xKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(e: any) => e.name}
                >
                  {chart.data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip />
              </PieChart>
            ) : (
              <AreaChart data={chart.data}>
                <defs>
                  {chart.yKeys?.map((k, i) => (
                    <linearGradient key={k} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.1} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={chart.xKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RTooltip />
                <Legend />
                {chart.yKeys?.map((k, i) => (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={`url(#grad-${i})`}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return null;
}
