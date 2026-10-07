'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles, Send, Plus, Search, Pin, Trash2, Copy, RefreshCw, ThumbsUp,
  ThumbsDown, FileText, FileSpreadsheet, Paperclip, X, Loader2, MessageSquare,
  AlertTriangle, CheckCircle2, Bot, User as UserIcon, Download, MoreVertical,
  Zap, TrendingUp, Users, DollarSign, Calendar, BookOpen, Award, Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CHART_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#9333ea',
  '#0891b2', '#c2410c', '#4f46e5', '#be185d', '#15803d',
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  messageType?: string;
  metadata?: string;
  feedback?: 'up' | 'down' | null;
  provider?: string;
  createdAt: string;
  toolResult?: ToolResult;
  actionRequest?: ActionRequest;
  streaming?: boolean;
}

interface ToolResult {
  text: string;
  table?: { headers: string[]; rows: (string | number)[][] };
  chart?: {
    type: 'bar' | 'line' | 'pie';
    title: string;
    data: { label: string; value: number; color?: string }[];
  };
}

interface ActionRequest {
  type: string;
  payload: Record<string, unknown>;
}

interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: string;
  messageCount: number;
  lastMessage: string;
  lastMessageAt: string;
}

const QUICK_SUGGESTIONS = [
  { icon: Users, label: 'كم عدد الطلاب؟', color: 'text-blue-600' },
  { icon: DollarSign, label: 'إيرادات هذا الأسبوع', color: 'text-green-600' },
  { icon: AlertTriangle, label: 'من المتأخرون في الدفع؟', color: 'text-red-600' },
  { icon: TrendingUp, label: 'أعلى التخصصات', color: 'text-purple-600' },
  { icon: Calendar, label: 'تقرير الحضور', color: 'text-cyan-600' },
  { icon: Award, label: 'أعلى الأساتذة ساعات', color: 'text-orange-600' },
  { icon: BookOpen, label: 'الطلاب حسب القسم', color: 'text-indigo-600' },
  { icon: Zap, label: 'اقتراحات ذكية', color: 'text-yellow-600' },
  { icon: Users, label: 'الطلاب الجدد هذا الشهر', color: 'text-pink-600' },
  { icon: DollarSign, label: 'ربح الشهر', color: 'text-emerald-600' },
  { icon: Calendar, label: 'إحصائيات شهرية', color: 'text-teal-600' },
  { icon: TrendingUp, label: 'مقارنة الأشهر', color: 'text-violet-600' },
  { icon: AlertTriangle, label: 'تعارضات الأساتذة', color: 'text-rose-600' },
  { icon: Bell, label: 'رسالة تذكير لطالب متأخر', color: 'text-amber-600' },
  { icon: FileText, label: 'توليد شهادة مدرسية', color: 'text-sky-600' },
  { icon: Sparkles, label: 'منشور للشبكات الاجتماعية', color: 'text-fuchsia-600' },
];

interface AIAssistantSectionProps {
  user: { id: string; name: string; role: 'director' | 'employee' };
}

export function AIAssistantSection({ user }: AIAssistantSectionProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // تحميل المحادثات
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/conversations');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // تحميل رسائل محادثة
  const loadMessages = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const msgs: Message[] = (data.conversation?.messages || []).map((m: any) => {
        let toolResult: ToolResult | undefined;
        let actionRequest: ActionRequest | undefined;
        if (m.metadata) {
          try {
            const meta = JSON.parse(m.metadata);
            if (meta.toolResult) toolResult = meta.toolResult;
            if (meta.actionRequest) actionRequest = meta.actionRequest;
          } catch {
            // ignore
          }
        }
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          messageType: m.messageType,
          feedback: m.feedback,
          provider: m.provider,
          createdAt: m.createdAt,
          toolResult,
          actionRequest,
        };
      });
      setMessages(msgs);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId, loadMessages]);

  // التمرير لأسفل عند وصول رسالة جديدة
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // محادثة جديدة
  const handleNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  // إرسال رسالة
  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');

    // إنشاء محادثة جديدة محلياً (سيتم ربطها بعد الرد)
    const tempId = activeId;
    const userMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    const assistantMsg: Message = {
      id: `tmp-a-${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    abortRef.current = new AbortController();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: tempId,
          message: content,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const convId = res.headers.get('X-Conversation-Id');
      if (convId && !tempId) setActiveId(convId);

      // قراءة SSE
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      const toolResults: ToolResult[] = [];
      const actionRequests: ActionRequest[] = [];

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const block of lines) {
          const line = block.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === 'delta') {
              const deltaContent = (typeof evt.content === 'string' && evt.content && evt.content !== 'undefined') ? evt.content : '';
              if (deltaContent) {
                fullText += deltaContent;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: fullText } : m
                  )
                );
              }
            } else if (evt.type === 'tool_start') {
              toast.info(`🔧 تشغيل أداة: ${evt.tool}`);
            } else if (evt.type === 'tool_result') {
              toolResults.push(evt.result);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, toolResult: evt.result } : m
                )
              );
            } else if (evt.type === 'action_confirm') {
              actionRequests.push(evt.action);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, actionRequest: evt.action }
                    : m
                )
              );
            } else if (evt.type === 'error') {
              toast.error(evt.message);
            } else if (evt.type === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? {
                        ...m,
                        streaming: false,
                        provider: evt.provider,
                      }
                    : m
                )
              );
            }
          } catch {
            // ignore parse errors
          }
        }
      }
      // لا نعيد تحميل الرسائل — نحتفظ بما ظهر في البث المباشر
      // فقط نحدّث قائمة المحادثات في الشريط الجانبي
      await loadConversations();
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error(err?.message || 'فشل إرسال الرسالة');
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                streaming: false,
                content:
                  m.content ||
                  '⚠️ تعذر الحصول على رد. تحقق من الإعدادات أو حاول مجدداً.',
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  // إيقاف التوليد
  const handleStop = () => {
    abortRef.current?.abort();
    setLoading(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
  };

  // إعادة توليد آخر رد
  const handleRegenerate = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === lastUser.id);
      return prev.slice(0, idx + 1);
    });
    setTimeout(() => handleSend(lastUser.content), 50);
  };

  // نسخ رسالة
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('تم النسخ');
  };

  // ملاحظة
  const handleFeedback = async (msgId: string, feedback: 'up' | 'down') => {
    try {
      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId, feedback }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedback } : m))
      );
    } catch {
      toast.error('فشل إرسال الملاحظة');
    }
  };

  // تثبيت/إلغاء تثبيت
  const handleTogglePin = async (id: string, pinned: boolean) => {
    await fetch(`/api/ai/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !pinned }),
    });
    loadConversations();
  };

  // حذف محادثة
  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المحادثة؟')) return;
    await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' });
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    loadConversations();
  };

  // تنفيذ إجراء
  const handleExecuteAction = async (msgId: string, action: ActionRequest) => {
    if (!confirm('هل أنت متأكد من تنفيذ هذا الإجراء؟')) return;
    try {
      const res = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType: action.type, payload: action.payload }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, actionRequest: undefined } : m))
        );
      } else {
        toast.error(data.message || data.error);
      }
    } catch (err: any) {
      toast.error(err?.message || 'فشل التنفيذ');
    }
  };

  // تصدير
  const handleExport = async (format: 'pdf' | 'excel', msg: Message) => {
    try {
      const res = await fetch('/api/ai/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          content: msg.content,
          title: 'تقرير المساعد الذكي',
          table: msg.toolResult?.table,
        }),
      });
      if (format === 'excel') {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai-report.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('تم تصدير Excel');
      } else {
        // PDF: نفتح HTML في نافذة جديدة
        const html = await res.text();
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'فشل التصدير');
    }
  };

  // رفع ملف
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('question', `حلل الملف "${file.name}" وقدّم ملخصاً شاملاً.`);
      const res = await fetch('/api/ai/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const userMsg: Message = {
        id: `up-${Date.now()}`,
        role: 'user',
        content: `📎 ${file.name}`,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: Message = {
        id: `up-a-${Date.now()}`,
        role: 'assistant',
        content: data.content,
        provider: data.provider,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      toast.success('تم تحليل الملف');
      loadConversations();
    } catch (err: any) {
      toast.error(err?.message || 'فشل رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const activeConversation = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex h-[calc(100vh-9rem)] lg:h-[calc(100vh-3rem)] -m-4 md:-m-6 lg:-m-8 overflow-hidden bg-background rounded-none lg:rounded-xl border shadow-sm">
      {/* Sidebar - conversations */}
      <aside
        className={`${
          sidebarOpen ? 'absolute inset-y-0 right-0 z-30 w-80' : 'hidden'
        } md:relative md:flex md:w-72 lg:w-80 flex-col border-l bg-muted/30`}
      >
        <div className="p-3 border-b">
          <Button onClick={handleNewChat} className="w-full" variant="default">
            <Plus className="w-4 h-4 ml-2" /> محادثة جديدة
          </Button>
        </div>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث في المحادثات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
        </div>
        <ScrollArea className="flex-1 max-h-[calc(100%-9rem)]">
          <div className="p-2 space-y-1">
            {filteredConversations.length === 0 && (
              <p className="text-center text-sm text-muted-foreground p-8">
                لا توجد محادثات بعد
              </p>
            )}
            {filteredConversations.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setActiveId(c.id);
                  setSidebarOpen(false);
                }}
                className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                  activeId === c.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {c.pinned && (
                      <Pin className="inline w-3 h-3 ml-1 text-primary" />
                    )}
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.lastMessage || 'لا توجد رسائل'}
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(c.id, c.pinned);
                      }}
                      className="p-1 hover:bg-background rounded"
                      title={c.pinned ? 'إلغاء التثبيت' : 'تثبيت'}
                    >
                      <Pin
                        className={`w-3 h-3 ${
                          c.pinned ? 'text-primary fill-primary' : 'text-muted-foreground'
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(c.id);
                      }}
                      className="p-1 hover:bg-background rounded text-destructive"
                      title="حذف"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(c.lastMessageAt).toLocaleString('ar-DZ')}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b p-3 flex items-center gap-2 bg-background">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <MessageSquare className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate">
                {activeConversation?.title || 'المساعد الذكي'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {loading ? 'يكتب...' : 'جاهز للمساعدة'}
              </p>
            </div>
          </div>
          {activeId && (
            <Button variant="ghost" size="icon" onClick={handleDelete.bind(null, activeId)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <WelcomeScreen onPick={handleSend} user={user} />
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                user={user}
                onCopy={handleCopy}
                onRegenerate={handleRegenerate}
                onFeedback={handleFeedback}
                onExecuteAction={handleExecuteAction}
                onExport={handleExport}
              />
            ))
          )}
        </div>

        {/* Input area */}
        <div className="border-t p-3 bg-background">
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="إرفاق ملف"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </Button>
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="اكتب رسالتك هنا... (Enter للإرسال، Shift+Enter لسطر جديد)"
                className="min-h-[44px] max-h-32 resize-none pr-3 pl-12"
                rows={1}
              />
            </div>
            {loading ? (
              <Button onClick={handleStop} variant="destructive" size="icon">
                <X className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            قد يقدم المساعد معلومات غير دقيقة - تحقق من الأهمية
          </p>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="md:hidden absolute inset-0 bg-black/30 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

// ===== شاشة الترحيب =====
function WelcomeScreen({
  onPick,
  user,
}: {
  onPick: (text: string) => void;
  user: { id: string; name: string; role: string };
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-6">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-2">مرحباً {user.name}!</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        أنا مساعدك الذكي. اسألني أي سؤال عن مؤسستك، أو اختر من الاقتراحات السريعة:
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl w-full">
        {QUICK_SUGGESTIONS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => onPick(s.label)}
              className="group p-3 rounded-xl border bg-card hover:bg-accent hover:border-primary/30 transition-all text-right"
            >
              <Icon className={`w-5 h-5 mb-2 ${s.color}`} />
              <p className="text-xs font-medium leading-snug">{s.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ===== فقاعة رسالة =====
function MessageBubble({
  message,
  user,
  onCopy,
  onRegenerate,
  onFeedback,
  onExecuteAction,
  onExport,
}: {
  message: Message;
  user: { id: string; name: string; role: string };
  onCopy: (c: string) => void;
  onRegenerate: () => void;
  onFeedback: (id: string, f: 'up' | 'down') => void;
  onExecuteAction: (id: string, a: ActionRequest) => void;
  onExport: (format: 'pdf' | 'excel', msg: Message) => void;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-primary/10 text-primary'
        }`}
      >
        {isUser ? (
          <UserIcon className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : ''} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-primary text-primary-foreground ml-auto'
              : 'bg-muted/50'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          ) : (
            <>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown
                  components={{
                    table: ({ children }) => (
                      <div className="my-2 overflow-x-auto">
                        <table className="min-w-full border-collapse text-xs">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-border bg-muted px-2 py-1 text-right font-semibold">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-2 py-1 text-right">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {message.content || (message.streaming ? '...' : '')}
                </ReactMarkdown>
              </div>
              {message.streaming && (
                <div className="flex gap-1 mt-2">
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </>
          )}
        </div>

        {/* نتيجة أداة */}
        {message.toolResult && <ToolResultCard result={message.toolResult} />}

        {/* إجراء يتطلب تأكيداً */}
        {message.actionRequest && (
          <ActionConfirmCard
            action={message.actionRequest}
            onConfirm={() => onExecuteAction(message.id, message.actionRequest!)}
          />
        )}

        {/* أزرار التحكم (للمساعد فقط) */}
        {!isUser && !message.streaming && message.content && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <button
              onClick={() => onCopy(message.content)}
              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title="نسخ"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRegenerate}
              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title="إعادة التوليد"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onFeedback(message.id, 'up')}
              className={`p-1.5 hover:bg-muted rounded ${
                message.feedback === 'up'
                  ? 'text-green-600 bg-green-50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="مفيد"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onFeedback(message.id, 'down')}
              className={`p-1.5 hover:bg-muted rounded ${
                message.feedback === 'down'
                  ? 'text-red-600 bg-red-50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="غير مفيد"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onExport('pdf', message)}
              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title="تصدير PDF"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onExport('excel', message)}
              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title="تصدير Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </button>
            {message.provider && (
              <Badge variant="outline" className="text-[10px]">
                {message.provider}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== بطاقة نتيجة أداة =====
function ToolResultCard({ result }: { result: ToolResult }) {
  return (
    <Card className="mt-2 bg-muted/30">
      <CardContent className="p-3">
        {result.text && <p className="text-sm mb-2">{result.text}</p>}
        {result.table && (
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {result.table.headers.map((h, i) => (
                    <th
                      key={i}
                      className="border border-border bg-muted px-2 py-1 text-right font-semibold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((c, j) => (
                      <td key={j} className="border border-border px-2 py-1 text-right">
                        {String(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result.chart && <ChartView chart={result.chart} />}
      </CardContent>
    </Card>
  );
}

// ===== عرض الرسم البياني =====
function ChartView({
  chart,
}: {
  chart: {
    type: 'bar' | 'line' | 'pie';
    title: string;
    data: { label: string; value: number; color?: string }[];
  };
}) {
  const data = chart.data.map((d, i) => ({
    name: d.label,
    value: d.value,
    color: d.color || CHART_COLORS[i % CHART_COLORS.length],
  }));
  return (
    <div className="mt-2">
      <p className="text-xs font-medium mb-2">{chart.title}</p>
      <ResponsiveContainer width="100%" height={220}>
        {chart.type === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        ) : chart.type === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ fill: '#2563eb' }}
            />
          </LineChart>
        ) : (
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={70}
              label={({ name, percent }) =>
                `${name}: ${((percent || 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ===== بطاقة تأكيد إجراء =====
function ActionConfirmCard({
  action,
  onConfirm,
}: {
  action: ActionRequest;
  onConfirm: () => void;
}) {
  const actionLabels: Record<string, { label: string; color: string }> = {
    create_specialization: { label: 'إنشاء تخصص', color: 'text-blue-600' },
    create_user: { label: 'إنشاء مستخدم', color: 'text-green-600' },
    create_room: { label: 'إنشاء قاعة', color: 'text-purple-600' },
    create_notification: { label: 'إرسال إشعار', color: 'text-amber-600' },
    delete_student: { label: '⚠️ حذف طالب', color: 'text-red-600' },
  };
  const info = actionLabels[action.type] || { label: action.type, color: '' };
  return (
    <Card className="mt-2 border-amber-300 bg-amber-50/50">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className={`w-4 h-4 ${info.color}`} />
          <p className="text-sm font-medium">إجراء يتطلب تأكيد: {info.label}</p>
        </div>
        <pre className="text-xs bg-background p-2 rounded overflow-x-auto mb-2 max-h-32">
{JSON.stringify(action.payload, null, 2)}
        </pre>
        <Button size="sm" onClick={onConfirm} variant="default">
          <CheckCircle2 className="w-3.5 h-3.5 ml-1" /> تأكيد التنفيذ
        </Button>
      </CardContent>
    </Card>
  );
}
