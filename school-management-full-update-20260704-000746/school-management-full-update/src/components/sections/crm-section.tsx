'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Users,
  UserPlus,
  Phone,
  PhoneCall,
  Mail,
  MessageCircle,
  MapPin,
  Calendar,
  Plus,
  Search,
  Edit,
  Trash2,
  TrendingUp,
  Clock,
  AlertCircle,
  GraduationCap,
  Eye,
  Filter,
  Target,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Bell,
  User,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ===== الأنواع =====
interface Lead {
  id: string;
  fullName: string;
  phone: string;
  phone2: string | null;
  email: string | null;
  gender: string | null;
  birthDate: string | null;
  wilaya: string | null;
  baladia: string | null;
  address: string | null;
  source: string;
  desiredCourse: string | null;
  desiredBranch: string | null;
  assignedTo: string | null;
  firstContactDate: string;
  lastFollowUpDate: string | null;
  nextFollowUpDate: string | null;
  status: string;
  interestLevel: string;
  notes: string | null;
  convertedToStudentId: string | null;
  convertedAt: string | null;
  lastModifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { followUps: number };
}

interface FollowUp {
  id: string;
  leadId: string;
  date: string;
  userName: string;
  contactType: string;
  notes: string | null;
  result: string | null;
  nextFollowUpDate: string | null;
  createdAt: string;
}

interface Stats {
  totalLeads: number;
  newToday: number;
  converted: number;
  conversionRate: number;
  needsFollowUpToday: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  followUpTodayList: Array<{
    id: string;
    fullName: string;
    phone: string;
    nextFollowUpDate: string;
    status: string;
    interestLevel: string;
    desiredCourse: string | null;
    source: string;
  }>;
}

interface Staff {
  id: string;
  name: string;
  role: string;
  label: string;
}

// ===== الثوابت =====
const SOURCES = [
  'Facebook', 'WhatsApp', 'Instagram', 'TikTok', 'Google',
  'الموقع الإلكتروني', 'زيارة للمركز', 'اتصال هاتفي', 'صديق',
  'طالب سابق', 'إعلان ورقي', 'أخرى',
];

const STATUSES: { value: string; label: string }[] = [
  { value: 'new', label: 'جديد' },
  { value: 'contacted', label: 'تم التواصل' },
  { value: 'interested', label: 'مهتم' },
  { value: 'waiting', label: 'بانتظار الرد' },
  { value: 'appointment', label: 'موعد' },
  { value: 'registered', label: 'مسجّل' },
  { value: 'rejected', label: 'مرفوض' },
  { value: 'no_answer', label: 'لا يرد' },
  { value: 'postponed', label: 'مؤجّل' },
];

const INTEREST_LEVELS: { value: string; label: string }[] = [
  { value: 'low', label: 'منخفض' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'عالي' },
];

const CONTACT_TYPES: { value: string; label: string }[] = [
  { value: 'call', label: 'مكالمة هاتفية' },
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'visit', label: 'زيارة' },
  { value: 'email', label: 'بريد إلكتروني' },
];

// ===== خريطة ألوان شارات الحالة =====
const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  contacted: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  interested: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  waiting: 'bg-amber-100 text-amber-700 border-amber-200',
  appointment: 'bg-purple-100 text-purple-700 border-purple-200',
  registered: 'bg-emerald-600 text-white border-emerald-700',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  no_answer: 'bg-gray-200 text-gray-700 border-gray-300',
  postponed: 'bg-orange-100 text-orange-700 border-orange-200',
};

// ألوان الرسوم البيانية
const STATUS_BAR_COLORS: Record<string, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-cyan-500',
  interested: 'bg-emerald-500',
  waiting: 'bg-amber-500',
  appointment: 'bg-purple-500',
  registered: 'bg-emerald-600',
  rejected: 'bg-red-500',
  no_answer: 'bg-gray-400',
  postponed: 'bg-orange-500',
};

const SOURCE_BAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-teal-500', 'bg-rose-500',
  'bg-indigo-500', 'bg-lime-500', 'bg-orange-500', 'bg-slate-500',
];

// ===== دوال مساعدة =====
const getStatusLabel = (s: string) =>
  STATUSES.find((x) => x.value === s)?.label || s;

const getInterestLabel = (i: string) =>
  INTEREST_LEVELS.find((x) => x.value === i)?.label || i;

const getContactTypeLabel = (c: string) =>
  CONTACT_TYPES.find((x) => x.value === c)?.label || c;

const getContactTypeIcon = (c: string) => {
  switch (c) {
    case 'call': return PhoneCall;
    case 'whatsapp': return MessageCircle;
    case 'visit': return MapPin;
    case 'email': return Mail;
    default: return Phone;
  }
};

const formatDate = (d: string | null) => {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('ar-DZ', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return '-';
  }
};

const formatDateTime = (d: string | null) => {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('ar-DZ', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '-';
  }
};

const toInputDate = (d: string | null) => {
  if (!d) return '';
  try {
    return new Date(d).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const toInputDateTimeLocal = (d: string | null) => {
  if (!d) return '';
  try {
    const date = new Date(d);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return '';
  }
};

// ===== نموذج فارغ للعميل =====
const emptyLead = {
  fullName: '',
  phone: '',
  phone2: '',
  email: '',
  gender: '',
  birthDate: '',
  wilaya: '',
  baladia: '',
  address: '',
  source: 'أخرى',
  desiredCourse: '',
  desiredBranch: '',
  assignedTo: '',
  status: 'new',
  interestLevel: 'medium',
  nextFollowUpDate: '',
  notes: '',
};

const emptyFollowUp = {
  date: '',
  contactType: 'call',
  notes: '',
  result: '',
  nextFollowUpDate: '',
};

// ===== المكوّن الرئيسي =====
export function CrmSection() {
  const [tab, setTab] = useState<'dashboard' | 'leads'>('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');

  // نافذة التفاصيل
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [followUpForm, setFollowUpForm] = useState<any>(emptyFollowUp);
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [converting, setConverting] = useState(false);

  // نافذة الإضافة/التعديل
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [formData, setFormData] = useState<any>(emptyLead);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  // جلب قائمة الموظفين
  useEffect(() => {
    fetch('/api/users/staff-names')
      .then((r) => r.json())
      .then((d) => setStaff(d.staff || []))
      .catch(() => {});
  }, []);

  // جلب العملاء المحتملين
  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterSource !== 'all') params.set('source', filterSource);
      if (filterAssigned !== 'all') params.set('assignedTo', filterAssigned);
      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      setLeads(data.leads || []);
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر تحميل قائمة العملاء', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterSource, filterAssigned, toast]);

  useEffect(() => {
    if (tab === 'leads') loadLeads();
  }, [tab, loadLeads]);

  // فتح تفاصيل عميل
  const openDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
    setDetailLoading(true);
    setFollowUpForm({
      ...emptyFollowUp,
      date: toInputDateTimeLocal(new Date().toISOString()),
    });
    try {
      const res = await fetch(`/api/leads/${lead.id}`);
      const data = await res.json();
      if (data.lead) {
        setSelectedLead(data.lead);
        setFollowUps(data.lead.followUps || []);
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر تحميل التفاصيل', variant: 'destructive' });
    } finally {
      setDetailLoading(false);
    }
  };

  // فتح نافذة الإضافة
  const openAdd = () => {
    setEditing(null);
    setFormData({
      ...emptyLead,
      firstContactDate: toInputDate(new Date().toISOString()),
    });
    setFormOpen(true);
  };

  // فتح نافذة التعديل
  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setFormData({
      fullName: lead.fullName,
      phone: lead.phone,
      phone2: lead.phone2 || '',
      email: lead.email || '',
      gender: lead.gender || '',
      birthDate: toInputDate(lead.birthDate),
      wilaya: lead.wilaya || '',
      baladia: lead.baladia || '',
      address: lead.address || '',
      source: lead.source || 'أخرى',
      desiredCourse: lead.desiredCourse || '',
      desiredBranch: lead.desiredBranch || '',
      assignedTo: lead.assignedTo || '',
      status: lead.status,
      interestLevel: lead.interestLevel,
      nextFollowUpDate: toInputDate(lead.nextFollowUpDate),
      notes: lead.notes || '',
    });
    setFormOpen(true);
  };

  // حفظ العميل (إضافة/تعديل)
  const handleSave = async () => {
    if (!formData.fullName.trim() || !formData.phone.trim()) {
      toast({ title: 'تنبيه', description: 'الاسم ورقم الهاتف مطلوبان', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/leads/${editing.id}` : '/api/leads';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'تم',
          description: editing ? 'تم تحديث بيانات العميل' : 'تمت إضافة العميل المحتمل',
        });
        setFormOpen(false);
        if (editing && selectedLead?.id === editing.id) {
          setSelectedLead(data.lead);
        }
        loadLeads();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'خطأ', description: err.error || 'فشل الحفظ', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'فشل الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // حذف عميل
  const handleDelete = async (lead: Lead) => {
    if (!confirm(`حذف العميل "${lead.fullName}"؟`)) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'تم', description: 'تم حذف العميل' });
        setDetailOpen(false);
        loadLeads();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'خطأ', description: err.error || 'فشل الحذف', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'فشل الاتصال', variant: 'destructive' });
    }
  };

  // إضافة متابعة
  const handleAddFollowUp = async () => {
    if (!selectedLead) return;
    if (!followUpForm.date) {
      toast({ title: 'تنبيه', description: 'تاريخ المتابعة مطلوب', variant: 'destructive' });
      return;
    }
    setSubmittingFollowUp(true);
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followUpForm),
      });
      if (res.ok) {
        const data = await res.json();
        setFollowUps([data.followUp, ...followUps]);
        setFollowUpForm({
          ...emptyFollowUp,
          date: toInputDateTimeLocal(new Date().toISOString()),
        });
        // تحديث العميل في الحالة
        if (selectedLead) {
          setSelectedLead({
            ...selectedLead,
            lastFollowUpDate: followUpForm.date,
            nextFollowUpDate: followUpForm.nextFollowUpDate || null,
          });
        }
        toast({ title: 'تم', description: 'تمت إضافة المتابعة' });
        loadLeads();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'خطأ', description: err.error || 'فشل إضافة المتابعة', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'فشل الاتصال', variant: 'destructive' });
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  // تحويل العميل إلى طالب
  const handleConvert = async () => {
    if (!selectedLead) return;
    if (!confirm(`تحويل "${selectedLead.fullName}" إلى طالب مسجّل؟`)) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'تم التحويل',
          description: `تم إنشاء الطالب بنجاح (رقم: ${data.student?.studentNumber || '-'})`,
        });
        // تحديث العميل محلياً
        if (selectedLead) {
          setSelectedLead({
            ...selectedLead,
            convertedToStudentId: data.studentId,
            convertedAt: new Date().toISOString(),
            status: 'registered',
          });
        }
        loadLeads();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'خطأ', description: err.error || 'فشل التحويل', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'فشل الاتصال', variant: 'destructive' });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* رأس القسم */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">إدارة العملاء المحتملين</h2>
          <p className="text-muted-foreground text-sm">
            تتبّع العملاء المحتملين، المتابعات، والتحويل إلى طلاب
          </p>
        </div>
        <Button onClick={openAdd}>
          <UserPlus className="w-4 h-4 ml-2" /> عميل جديد
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'dashboard' | 'leads')}>
        <TabsList>
          <TabsTrigger value="dashboard">
            <TrendingUp className="w-4 h-4 ml-2" /> لوحة التحكم
          </TabsTrigger>
          <TabsTrigger value="leads">
            <Users className="w-4 h-4 ml-2" /> قائمة العملاء
          </TabsTrigger>
        </TabsList>

        {/* ===== لوحة التحكم ===== */}
        <TabsContent value="dashboard">
          <DashboardView onLeadClick={openDetail} />
        </TabsContent>

        {/* ===== قائمة العملاء ===== */}
        <TabsContent value="leads">
          {/* الفلاتر */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم، الهاتف، البريد..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger><SelectValue placeholder="كل الحالات" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger><SelectValue placeholder="كل المصادر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المصادر</SelectItem>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterAssigned} onValueChange={setFilterAssigned}>
                  <SelectTrigger><SelectValue placeholder="كل المسؤولين" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المسؤولين</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* جدول العملاء */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>المصدر</TableHead>
                      <TableHead>التخصص المطلوب</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>مستوى الاهتمام</TableHead>
                      <TableHead>المتابعة القادمة</TableHead>
                      <TableHead className="text-center">متابعات</TableHead>
                      <TableHead className="text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    ) : leads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          لا يوجد عملاء مطابقون
                        </TableCell>
                      </TableRow>
                    ) : (
                      leads.map((lead) => (
                        <TableRow
                          key={lead.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => openDetail(lead)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                {lead.fullName.charAt(0)}
                              </div>
                              <div>
                                <div>{lead.fullName}</div>
                                {lead.assignedTo && (
                                  <div className="text-xs text-muted-foreground">
                                    <User className="w-3 h-3 inline ml-1" />
                                    {lead.assignedTo}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="num text-sm" dir="ltr">{lead.phone}</TableCell>
                          <TableCell className="text-sm">{lead.source}</TableCell>
                          <TableCell className="text-sm">{lead.desiredCourse || '-'}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_STYLES[lead.status] || 'bg-gray-100 text-gray-700 border-gray-200'}>
                              {getStatusLabel(lead.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              lead.interestLevel === 'high' ? 'border-emerald-300 text-emerald-700' :
                              lead.interestLevel === 'medium' ? 'border-amber-300 text-amber-700' :
                              'border-gray-300 text-gray-600'
                            }>
                              {getInterestLabel(lead.interestLevel)}
                            </Badge>
                          </TableCell>
                          <TableCell className="num text-xs">
                            {lead.nextFollowUpDate ? (
                              <span className={
                                new Date(lead.nextFollowUpDate) <= new Date()
                                  ? 'text-red-600 font-medium'
                                  : ''
                              }>
                                {formatDate(lead.nextFollowUpDate)}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{lead._count?.followUps || 0}</Badge>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openDetail(lead)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => openEdit(lead)}>
                                <Edit className="w-4 h-4 text-amber-600" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(lead)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== نافذة تفاصيل العميل ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span>{selectedLead.fullName}</span>
                  <Badge className={STATUS_STYLES[selectedLead.status] || ''}>
                    {getStatusLabel(selectedLead.status)}
                  </Badge>
                  {selectedLead.convertedToStudentId && (
                    <Badge className="bg-emerald-600 text-white">
                      <CheckCircle2 className="w-3 h-3 ml-1" /> تم التحويل لطالب
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>

              {detailLoading ? (
                <div className="py-8 text-center text-muted-foreground">جاري التحميل...</div>
              ) : (
                <div className="space-y-4">
                  {/* بطاقة المعلومات */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InfoRow icon={Phone} label="الهاتف" value={selectedLead.phone} dir="ltr" />
                    <InfoRow icon={Phone} label="هاتف ثانوي" value={selectedLead.phone2 || '-'} dir="ltr" />
                    <InfoRow icon={Mail} label="البريد الإلكتروني" value={selectedLead.email || '-'} dir="ltr" />
                    <InfoRow icon={User} label="الجنس" value={selectedLead.gender || '-'} />
                    <InfoRow icon={Calendar} label="تاريخ الميلاد" value={formatDate(selectedLead.birthDate)} />
                    <InfoRow icon={MapPin} label="الولاية" value={selectedLead.wilaya || '-'} />
                    <InfoRow icon={MapPin} label="البلدية" value={selectedLead.baladia || '-'} />
                    <InfoRow icon={MapPin} label="العنوان" value={selectedLead.address || '-'} />
                    <InfoRow icon={Target} label="المصدر" value={selectedLead.source} />
                    <InfoRow icon={GraduationCap} label="التخصص المطلوب" value={selectedLead.desiredCourse || '-'} />
                    <InfoRow icon={GraduationCap} label="الفرع" value={selectedLead.desiredBranch || '-'} />
                    <InfoRow icon={User} label="المسؤول" value={selectedLead.assignedTo || '-'} />
                    <InfoRow icon={Calendar} label="أول تواصل" value={formatDate(selectedLead.firstContactDate)} />
                    <InfoRow icon={CalendarClock} label="آخر متابعة" value={formatDate(selectedLead.lastFollowUpDate)} />
                    <InfoRow icon={Bell} label="المتابعة القادمة" value={formatDate(selectedLead.nextFollowUpDate)} />
                    <InfoRow icon={Target} label="مستوى الاهتمام" value={getInterestLabel(selectedLead.interestLevel)} />
                  </div>

                  {selectedLead.notes && (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      <span className="font-medium">ملاحظات: </span>
                      {selectedLead.notes}
                    </div>
                  )}

                  {/* أزرار الإجراءات */}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(selectedLead)}>
                      <Edit className="w-4 h-4 ml-2" /> تعديل
                    </Button>
                    {!selectedLead.convertedToStudentId ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleConvert}
                        disabled={converting}
                      >
                        <GraduationCap className="w-4 h-4 ml-2" />
                        {converting ? 'جاري التحويل...' : 'تحويل إلى طالب'}
                      </Button>
                    ) : null}
                    {!selectedLead.convertedToStudentId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(selectedLead)}
                      >
                        <Trash2 className="w-4 h-4 ml-2" /> حذف
                      </Button>
                    )}
                  </div>

                  {/* نموذج إضافة متابعة */}
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> إضافة متابعة جديدة
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">التاريخ والوقت *</Label>
                        <Input
                          type="datetime-local"
                          value={followUpForm.date}
                          onChange={(e) => setFollowUpForm({ ...followUpForm, date: e.target.value })}
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">نوع التواصل</Label>
                        <Select
                          value={followUpForm.contactType}
                          onValueChange={(v) => setFollowUpForm({ ...followUpForm, contactType: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CONTACT_TYPES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">نتيجة المتابعة</Label>
                        <Input
                          value={followUpForm.result}
                          onChange={(e) => setFollowUpForm({ ...followUpForm, result: e.target.value })}
                          placeholder="مثال: مهتم، يحتاج تفكير..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">المتابعة القادمة</Label>
                        <Input
                          type="date"
                          value={followUpForm.nextFollowUpDate}
                          onChange={(e) => setFollowUpForm({ ...followUpForm, nextFollowUpDate: e.target.value })}
                          dir="ltr"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <Label className="text-xs">ملاحظات</Label>
                        <Textarea
                          value={followUpForm.notes}
                          onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                          rows={2}
                          placeholder="تفاصيل المتابعة..."
                        />
                      </div>
                    </div>
                    <Button
                      className="mt-3"
                      size="sm"
                      onClick={handleAddFollowUp}
                      disabled={submittingFollowUp}
                    >
                      {submittingFollowUp ? 'جاري الحفظ...' : 'حفظ المتابعة'}
                    </Button>
                  </div>

                  {/* الخط الزمني للمتابعات */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> سجل المتابعات ({followUps.length})
                    </h4>
                    {followUps.length === 0 ? (
                      <p className="text-center text-muted-foreground py-6 text-sm">
                        لا توجد متابعات مسجّلة
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pl-1">
                        {followUps.map((fu, idx) => {
                          const Icon = getContactTypeIcon(fu.contactType);
                          return (
                            <div
                              key={fu.id}
                              className="relative flex gap-3 p-3 border rounded-lg hover:bg-muted/30"
                            >
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                  <Icon className="w-4 h-4" />
                                </div>
                                {idx < followUps.length - 1 && (
                                  <div className="absolute right-[22px] top-12 bottom-0 w-px bg-border" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {getContactTypeLabel(fu.contactType)}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {fu.userName}
                                    </span>
                                  </div>
                                  <span className="text-xs num text-muted-foreground">
                                    {formatDateTime(fu.date)}
                                  </span>
                                </div>
                                {fu.result && (
                                  <div className="text-sm font-medium mt-1">{fu.result}</div>
                                )}
                                {fu.notes && (
                                  <div className="text-sm text-muted-foreground mt-1">{fu.notes}</div>
                                )}
                                {fu.nextFollowUpDate && (
                                  <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                    <Bell className="w-3 h-3" />
                                    المتابعة القادمة: {formatDate(fu.nextFollowUpDate)}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== نافذة إضافة/تعديل عميل ===== */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'تعديل بيانات العميل' : 'إضافة عميل محتمل'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label>الاسم الكامل *</Label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="مثال: محمد أمين بن علي"
                />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="06xx xx xx xx"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>هاتف ثانوي</Label>
                <Input
                  value={formData.phone2}
                  onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الجنس</Label>
                <Select
                  value={formData.gender || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, gender: v === 'none' ? '' : v })}
                >
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    <SelectItem value="ذكر">ذكر</SelectItem>
                    <SelectItem value="أنثى">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ الميلاد</Label>
                <Input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الولاية</Label>
                <Input
                  value={formData.wilaya}
                  onChange={(e) => setFormData({ ...formData, wilaya: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>البلدية</Label>
                <Input
                  value={formData.baladia}
                  onChange={(e) => setFormData({ ...formData, baladia: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>العنوان</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>المصدر</Label>
                <Select
                  value={formData.source}
                  onValueChange={(v) => setFormData({ ...formData, source: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>التخصص المطلوب</Label>
                <Input
                  value={formData.desiredCourse}
                  onChange={(e) => setFormData({ ...formData, desiredCourse: e.target.value })}
                  placeholder="مثال: تقني سامي، لغات..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>الفرع</Label>
                <Input
                  value={formData.desiredBranch}
                  onChange={(e) => setFormData({ ...formData, desiredBranch: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>المسؤول</Label>
                <Select
                  value={formData.assignedTo || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, assignedTo: v === 'none' ? '' : v })}
                >
                  <SelectTrigger><SelectValue placeholder="اختر المسؤول" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون مسؤول</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>مستوى الاهتمام</Label>
                <Select
                  value={formData.interestLevel}
                  onValueChange={(v) => setFormData({ ...formData, interestLevel: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTEREST_LEVELS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>المتابعة القادمة</Label>
                <Input
                  type="date"
                  value={formData.nextFollowUpDate}
                  onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>ملاحظات</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة العميل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== بطاقة معلومة =====
function InfoRow({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: any;
  label: string;
  value: string;
  dir?: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate" dir={dir}>{value}</div>
      </div>
    </div>
  );
}

// ===== مكوّن لوحة التحكم =====
function DashboardView({ onLeadClick }: { onLeadClick: (lead: any) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leads/stats')
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-32" />
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center text-muted-foreground py-8">تعذّر تحميل الإحصائيات</div>;
  }

  const kpiCards = [
    {
      label: 'إجمالي العملاء',
      value: stats.totalLeads,
      icon: Users,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
    },
    {
      label: 'عملاء جدد اليوم',
      value: stats.newToday,
      icon: UserPlus,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
    },
    {
      label: 'يحتاجون متابعة اليوم',
      value: stats.needsFollowUpToday,
      icon: Bell,
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
      alert: stats.needsFollowUpToday > 0,
    },
    {
      label: 'نسبة التحويل',
      value: `${stats.conversionRate}%`,
      icon: TrendingUp,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
    },
  ];

  // تحويل بيانات الحالة لعرضها في الرسم
  const statusEntries = STATUSES
    .map((s) => ({ label: s.label, value: stats.byStatus[s.value] || 0, color: STATUS_BAR_COLORS[s.value] || 'bg-gray-400' }))
    .filter((s) => s.value > 0);
  const maxStatus = Math.max(...statusEntries.map((s) => s.value), 1);

  // تحويل بيانات المصدر لعرضها في الرسم
  const sourceEntries = SOURCES
    .map((s, i) => ({ label: s, value: stats.bySource[s] || 0, color: SOURCE_BAR_COLORS[i % SOURCE_BAR_COLORS.length] }))
    .filter((s) => s.value > 0);
  const maxSource = Math.max(...sourceEntries.map((s) => s.value), 1);

  return (
    <div className="space-y-4">
      {/* بطاقات KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((k, i) => {
          const Icon = k.icon;
          return (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{k.label}</p>
                    <p className={`text-3xl font-bold num ${k.textColor}`}>{k.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${k.color} bg-opacity-10`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                {k.alert && (
                  <Badge variant="destructive" className="mt-2 text-xs">يتطلب انتباه</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* رسم توزيع الحالات */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">توزيع العملاء حسب الحالة</CardTitle>
          </CardHeader>
          <CardContent>
            {statusEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
            ) : (
              <div className="space-y-3">
                {statusEntries.map((s, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-medium num">{s.value}</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${s.color} rounded-full transition-all`}
                        style={{ width: `${(s.value / maxStatus) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* رسم توزيع المصادر */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">توزيع العملاء حسب المصدر</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
            ) : (
              <div className="space-y-3">
                {sourceEntries.map((s, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-medium num">{s.value}</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${s.color} rounded-full transition-all`}
                        style={{ width: `${(s.value / maxSource) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* قائمة متابعة اليوم */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600" />
            عملاء يحتاجون متابعة اليوم
            <Badge variant="secondary" className="num">{stats.followUpTodayList.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.followUpTodayList.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <p className="text-muted-foreground">لا يوجد عملاء يحتاجون متابعة اليوم</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto pl-1">
              <div className="space-y-2">
                {stats.followUpTodayList.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => onLeadClick({
                      ...lead,
                      phone2: null, email: null, gender: null, birthDate: null,
                      wilaya: null, baladia: null, address: null,
                      desiredBranch: null, assignedTo: null,
                      firstContactDate: lead.nextFollowUpDate,
                      lastFollowUpDate: null,
                      notes: null, convertedToStudentId: null, convertedAt: null,
                      lastModifiedBy: null, updatedAt: lead.nextFollowUpDate,
                      _count: { followUps: 0 },
                    })}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0">
                      {lead.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{lead.fullName}</span>
                        <Badge className={STATUS_STYLES[lead.status] || ''}>
                          {getStatusLabel(lead.status)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
                        <span dir="ltr" className="num">{lead.phone}</span>
                        {lead.desiredCourse && <span>• {lead.desiredCourse}</span>}
                        <span>• {lead.source}</span>
                      </div>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <div className="text-xs text-muted-foreground">المتابعة القادمة</div>
                      <div className="text-sm font-medium num text-amber-600">
                        {formatDate(lead.nextFollowUpDate)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
