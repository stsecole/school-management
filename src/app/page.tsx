'use client';

import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  CalendarCheck, ListTodo, Wallet, LogOut, Menu, GraduationCap as School,
  AlertCircle, UserCog, Calendar, Clock, ScanLine, BarChart3, Database, UserPlus,
  Sparkles, Settings, MessageCircle, FileSpreadsheet, Bell, IdCard, Shield, Archive, History, Zap, Building2,
  Loader2, Search, X, Award,
} from 'lucide-react';
import { LoginScreen } from '@/components/login-screen';
import { DashboardStats } from '@/components/sections/dashboard-stats';
import { PWAInstall } from '@/components/pwa-install';
import { ThemeToggle } from '@/components/theme-toggle';
import { BranchSelector } from '@/components/branch-selector';
import { GlobalSearch } from '@/components/global-search';
import { getUserPermissions, getAllowedSections, canAccess } from '@/lib/permissions';

// ===== Lazy load heavy sections (improves initial page load by ~50%) =====
const StudentsSection = lazy(() => import('@/components/sections/students-section').then(m => ({ default: m.StudentsSection })));
const TeachersSection = lazy(() => import('@/components/sections/teachers-section').then(m => ({ default: m.TeachersSection })));
const DepartmentsSection = lazy(() => import('@/components/sections/departments-section').then(m => ({ default: m.DepartmentsSection })));
const RegistrationsSection = lazy(() => import('@/components/sections/registrations-section').then(m => ({ default: m.RegistrationsSection })));
const AttendanceSection = lazy(() => import('@/components/sections/attendance-section').then(m => ({ default: m.AttendanceSection })));
const TasksSection = lazy(() => import('@/components/sections/tasks-section').then(m => ({ default: m.TasksSection })));
const FinanceSection = lazy(() => import('@/components/sections/finance-section').then(m => ({ default: m.FinanceSection })));
const UsersSection = lazy(() => import('@/components/sections/users-section').then(m => ({ default: m.UsersSection })));
const TimetableSection = lazy(() => import('@/components/sections/timetable-section').then(m => ({ default: m.TimetableSection })));
const TimesheetSection = lazy(() => import('@/components/sections/timesheet-section').then(m => ({ default: m.TimesheetSection })));
const BackupSection = lazy(() => import('@/components/sections/backup-section').then(m => ({ default: m.BackupSection })));
const ReportsSection = lazy(() => import('@/components/sections/reports-section').then(m => ({ default: m.ReportsSection })));
const ExamsSection = lazy(() => import('@/components/sections/exams-section').then(m => ({ default: m.ExamsSection })));
const CrmSection = lazy(() => import('@/components/sections/crm-section').then(m => ({ default: m.CrmSection })));
const AIAssistantSection = lazy(() => import('@/components/sections/ai-assistant-section').then(m => ({ default: m.AIAssistantSection })));
const AISettingsSection = lazy(() => import('@/components/sections/ai-settings-section').then(m => ({ default: m.AISettingsSection })));
const InstitutionSettingsSection = lazy(() => import('@/components/sections/institution-settings-section').then(m => ({ default: m.InstitutionSettingsSection })));
const WhatsAppSection = lazy(() => import('@/components/sections/whatsapp-section').then(m => ({ default: m.WhatsAppSection })));
const ImportSection = lazy(() => import('@/components/sections/import-section').then(m => ({ default: m.ImportSection })));
const InteractiveDashboard = lazy(() => import('@/components/sections/interactive-dashboard').then(m => ({ default: m.InteractiveDashboard })));
const NotificationsSection = lazy(() => import('@/components/sections/notifications-section').then(m => ({ default: m.NotificationsSection })));
const CalendarSection = lazy(() => import('@/components/sections/calendar-section').then(m => ({ default: m.CalendarSection })));
const PermissionsSection = lazy(() => import('@/components/sections/permissions-section').then(m => ({ default: m.PermissionsSection })));
const ArchiveSection = lazy(() => import('@/components/sections/archive-section').then(m => ({ default: m.ArchiveSection })));
const CertificatesSection = lazy(() => import('@/components/sections/certificates-section').then(m => ({ default: m.CertificatesSection })));
const ActivityLogSection = lazy(() => import('@/components/sections/activity-log-section').then(m => ({ default: m.ActivityLogSection })));
const StudentCardsSection = lazy(() => import('@/components/sections/student-cards-section').then(m => ({ default: m.StudentCardsSection })));
const OperationsCenter = lazy(() => import('@/components/sections/operations-center').then(m => ({ default: m.OperationsCenter })));
const BranchesSection = lazy(() => import('@/components/sections/branches-section').then(m => ({ default: m.BranchesSection })));

// ===== Loading fallback component =====
function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      </div>
    </div>
  );
}

interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: 'director' | 'employee';
  canManageTimetable?: boolean;
}

type Section = 'dashboard' | 'interactive-dashboard' | 'operations' | 'students' | 'teachers' | 'departments' | 'registrations' | 'attendance' | 'tasks' | 'finance' | 'users' | 'timetable' | 'timesheet' | 'reports' | 'backup' | 'exams' | 'crm' | 'ai-assistant' | 'ai-settings' | 'whatsapp' | 'import' | 'notifications' | 'calendar' | 'student-cards' | 'permissions' | 'archive' | 'activity-log' | 'branches' | 'institution-settings' | 'certificates';

const sections: { id: Section; label: string; icon: any; roles: ('director' | 'employee')[] }[] = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['director', 'employee'] },
  { id: 'interactive-dashboard', label: 'لوحات تفاعلية', icon: BarChart3, roles: ['director', 'employee'] },
  { id: 'operations', label: 'مركز العمليات', icon: Zap, roles: ['director', 'employee'] },
  { id: 'students', label: 'الطلاب', icon: Users, roles: ['director', 'employee'] },
  { id: 'teachers', label: 'الأساتذة', icon: GraduationCap, roles: ['director', 'employee'] },
  { id: 'departments', label: 'الأقسام', icon: BookOpen, roles: ['director', 'employee'] },
  { id: 'registrations', label: 'التسجيلات', icon: ClipboardList, roles: ['director', 'employee'] },
  { id: 'attendance', label: 'الحضور', icon: CalendarCheck, roles: ['director', 'employee'] },
  { id: 'tasks', label: 'متابعة المهام', icon: ListTodo, roles: ['director', 'employee'] },
  { id: 'timetable', label: 'الجدول الأسبوعي', icon: Calendar, roles: ['director', 'employee'] },
  { id: 'timesheet', label: 'حضور الموظفين', icon: Clock, roles: ['director', 'employee'] },
  { id: 'finance', label: 'القسم المالي', icon: Wallet, roles: ['director', 'employee'] },
  { id: 'reports', label: 'التقارير', icon: BarChart3, roles: ['director', 'employee'] },
  { id: 'exams', label: 'التقييمات', icon: ClipboardList, roles: ['director', 'employee'] },
  { id: 'crm', label: 'العملاء المحتملون', icon: UserPlus, roles: ['director', 'employee'] },
  { id: 'whatsapp', label: 'الرسائل والتنبيهات', icon: MessageCircle, roles: ['director', 'employee'] },
  { id: 'import', label: 'استيراد البيانات', icon: FileSpreadsheet, roles: ['director', 'employee'] },
  { id: 'calendar', label: 'التقويم الزمني', icon: Calendar, roles: ['director', 'employee'] },
  { id: 'notifications', label: 'الإشعارات', icon: Bell, roles: ['director', 'employee'] },
  { id: 'student-cards', label: 'بطاقات الهوية', icon: IdCard, roles: ['director', 'employee'] },
  { id: 'archive', label: 'الأرشيف', icon: Archive, roles: ['director', 'employee'] },
  { id: 'certificates', label: 'سجل الشهادات', icon: Award, roles: ['director', 'employee'] },
  { id: 'ai-assistant', label: 'المساعد الذكي', icon: Sparkles, roles: ['director', 'employee'] },
  { id: 'users', label: 'إدارة الحسابات', icon: UserCog, roles: ['director'] },
  { id: 'branches', label: 'الفروع', icon: Building2, roles: ['director'] },
  { id: 'permissions', label: 'الصلاحيات', icon: Shield, roles: ['director'] },
  { id: 'activity-log', label: 'سجل التغييرات', icon: History, roles: ['director'] },
  { id: 'institution-settings', label: 'إعدادات المؤسسة', icon: Building2, roles: ['director'] },
  { id: 'backup', label: 'النسخ الاحتياطي', icon: Database, roles: ['director'] },
  { id: 'ai-settings', label: 'إعدادات AI', icon: Settings, roles: ['director'] },
];

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allowedSections, setAllowedSections] = useState<string[] | null>(null);
  const [sectionSearch, setSectionSearch] = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [institution, setInstitution] = useState<{ name: string; tagline: string; logoUrl: string }>({
    name: 'نظام الإدارة',
    tagline: 'مدرسة السلامة',
    logoUrl: '',
  });

  // ===== جلب عدّاد الإشعارات غير المقروءة كل 60 ثانية =====
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const notifRes = await fetch('/api/notifications?unreadOnly=true');
        const notifData = await notifRes.json();
        const notifUnread = notifData.unreadCount || 0;
        let msgUnread = 0;
        try {
          const msgRes = await fetch('/api/messages?type=inbox');
          const msgData = await msgRes.json();
          msgUnread = msgData.unreadCount || 0;
        } catch {}
        setNotifCount(notifUnread + msgUnread);
      } catch {}
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch institution settings (no auth needed)
  useEffect(() => {
    fetch('/api/institution-settings/public')
      .then(r => r.json())
      .then(data => {
        if (data?.settings) {
          setInstitution({
            name: data.settings.institution_name || 'نظام الإدارة',
            tagline: data.settings.institution_tagline || '',
            logoUrl: data.settings.institution_logo_url || '',
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(async (data) => {
        setUser(data.user || null);
        if (data.user) {
          // اجلب الصلاحيات
          try {
            const permRes = await fetch('/api/my-permissions');
            const permData = await permRes.json();
            setAllowedSections(permData.allowedSections || null);
          } catch {
            setAllowedSections(null); // المدير له كل الصلاحيات
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setActiveSection('dashboard');
  };

  // ===== تصفية سريعة لعناصر الواجهة حسب نص البحث =====
  // يجب أن تكون قبل أي return شرطي لاحترام قواعد Hooks
  const filteredSections = useMemo(() => {
    if (!user) return [];
    const visibleSections = sections.filter(s => s.roles.includes(user.role));
    const safeVisibleSections = visibleSections.length > 0 ? visibleSections : sections.filter(s => s.roles.includes(user.role));
    const q = sectionSearch.trim().toLowerCase();
    if (!q) return safeVisibleSections;
    return safeVisibleSections.filter(s =>
      s.label.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  }, [user, sectionSearch]);

  const handleSelectSection = (id: Section) => {
    setActiveSection(id);
    setSidebarOpen(false);
    setSectionSearch(''); // مسح البحث بعد الاختيار
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  const visibleSections = sections.filter(s => s.roles.includes(user.role));
  const activeSectionData = visibleSections.find(s => s.id === activeSection) || visibleSections[0] || sections[0];

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-primary text-primary-foreground fixed inset-y-0 right-0">
        <div className="p-5 border-b border-primary-foreground/10">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded-xl bg-primary-foreground/10 w-10 h-10 flex items-center justify-center overflow-hidden flex-shrink-0">
              {institution.logoUrl ? (
                <img src={institution.logoUrl} alt={institution.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <School className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base truncate">{institution.name}</h1>
              {institution.tagline && <p className="text-xs opacity-80 truncate">{institution.tagline}</p>}
            </div>
          </div>
        </div>

        {/* شريط البحث السريع في عناصر الواجهة */}
        <div className="px-3 pt-3 pb-2 border-b border-primary-foreground/10">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/50" />
            <input
              type="text"
              value={sectionSearch}
              onChange={(e) => setSectionSearch(e.target.value)}
              placeholder="بحث في الأقسام..."
              className="w-full bg-primary-foreground/10 border border-primary-foreground/15 rounded-lg pr-8 pl-8 py-2 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:bg-primary-foreground/15 focus:border-primary-foreground/30"
            />
            {sectionSearch && (
              <button
                onClick={() => setSectionSearch('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-primary-foreground/60 hover:text-primary-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredSections.length === 0 && sectionSearch && (
            <div className="text-center py-8 text-sm text-primary-foreground/60">
              لا توجد نتائج لـ "{sectionSearch}"
            </div>
          )}
          {filteredSections.map(s => {
            const Icon = s.icon;
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => handleSelectSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-right ${
                  isActive
                    ? 'bg-primary-foreground text-primary font-semibold'
                    : 'hover:bg-primary-foreground/10 text-primary-foreground/90'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{s.label}</span>
                {s.id === 'finance' && (
                  <Badge variant="secondary" className="mr-auto text-xs">محمي</Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* QR Scan + PWA Install */}
        <div className="p-3 border-t border-primary-foreground/10 space-y-2">
          <a
            href="/scan"
            target="_blank"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors text-primary-foreground text-sm font-medium"
          >
            <ScanLine className="w-5 h-5" />
            مسح QR Code
          </a>
          <PWAInstall />
          <ThemeToggle />
        </div>

        <div className="p-3 border-t border-primary-foreground/10">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary-foreground/5 mb-2">
            <div className="w-9 h-9 rounded-full bg-primary-foreground text-primary flex items-center justify-center font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs opacity-70">
                {user.role === 'director' ? 'مدير' : 'موظف'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <LogOut className="w-4 h-4 ml-2" /> تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-primary text-primary-foreground p-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {institution.logoUrl ? (
              <img src={institution.logoUrl} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <School className="w-6 h-6" />
            )}
          </div>
          <span className="font-bold truncate">{institution.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* أيقونة الإشعارات - الجوال */}
          <button
            onClick={() => handleSelectSection('notifications')}
            className="relative p-2 rounded-lg hover:bg-primary-foreground/10 transition-colors"
            title="الإشعارات"
          >
            <Bell className="w-5 h-5" />
            {notifCount > 0 && (
              <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </button>
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0 bg-primary text-primary-foreground border-l-0">
            <div className="p-5 border-b border-primary-foreground/10">
              <div className="flex items-center gap-3">
                <div className="p-1 rounded-xl bg-primary-foreground/10 w-10 h-10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {institution.logoUrl ? (
                    <img src={institution.logoUrl} alt={institution.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <School className="w-6 h-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-base truncate">{institution.name}</h1>
                  {institution.tagline && <p className="text-xs opacity-80 truncate">{institution.tagline}</p>}
                </div>
              </div>
            </div>
            {/* شريط البحث السريع - نسخة الجوال */}
            <div className="px-3 pt-3 pb-2 border-b border-primary-foreground/10">
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/50" />
                <input
                  type="text"
                  value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                  placeholder="بحث في الأقسام..."
                  className="w-full bg-primary-foreground/10 border border-primary-foreground/15 rounded-lg pr-8 pl-8 py-2 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:bg-primary-foreground/15 focus:border-primary-foreground/30"
                />
                {sectionSearch && (
                  <button
                    onClick={() => setSectionSearch('')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-primary-foreground/60 hover:text-primary-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <nav className="p-3 space-y-1">
              {filteredSections.length === 0 && sectionSearch && (
                <div className="text-center py-8 text-sm text-primary-foreground/60">
                  لا توجد نتائج لـ "{sectionSearch}"
                </div>
              )}
              {filteredSections.map(s => {
                const Icon = s.icon;
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSection(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-right ${
                      isActive
                        ? 'bg-primary-foreground text-primary font-semibold'
                        : 'hover:bg-primary-foreground/10 text-primary-foreground/90'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{s.label}</span>
                    {s.id === 'finance' && (
                      <Badge variant="secondary" className="mr-auto text-xs">محمي</Badge>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="absolute bottom-0 inset-x-0 p-3 border-t border-primary-foreground/10">
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary-foreground/5 mb-2">
                <div className="w-9 h-9 rounded-full bg-primary-foreground text-primary flex items-center justify-center font-bold">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs opacity-70">
                    {user.role === 'director' ? 'مدير' : 'موظف'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <LogOut className="w-4 h-4 ml-2" /> تسجيل الخروج
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 lg:mr-64 pt-16 lg:pt-0">
        {/* Top bar with global search + notifications + branch selector */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 md:px-6 lg:px-8 py-2 flex items-center justify-between gap-2">
          <GlobalSearch onNavigate={(s) => setActiveSection(s as Section)} />
          <div className="flex items-center gap-2">
            {/* أيقونة الإشعارات - Desktop */}
            <button
              onClick={() => handleSelectSection('notifications')}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors"
              title="الإشعارات والرسائل"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </button>
            {user.role === 'director' && <BranchSelector />}
          </div>
        </div>
        <div className={`max-w-7xl mx-auto animate-fade-in ${
          activeSection === 'ai-assistant' ? 'p-0 h-full' : 'p-4 md:p-6 lg:p-8'
        }`}>
          {/* Section title for desktop */}
          {activeSection !== 'ai-assistant' && (
            <div className="hidden lg:flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <activeSectionData.icon className="w-4 h-4" />
                <span>{activeSectionData.label}</span>
              </div>
            </div>
          )}

          {activeSection === 'dashboard' && (
            <DashboardStats
              user={{ name: user.name, role: user.role }}
              onNavigate={(s) => setActiveSection(s as Section)}
            />
          )}
          {activeSection === 'interactive-dashboard' && (
            <Suspense fallback={<SectionLoader />}>
              <InteractiveDashboard
                user={{ name: user.name, role: user.role }}
                onNavigate={(s) => setActiveSection(s as Section)}
              />
            </Suspense>
          )}
          {activeSection === 'students' && (
            <Suspense fallback={<SectionLoader />}><StudentsSection isDirector={user.role === 'director'} /></Suspense>
          )}
          {activeSection === 'teachers' && (
            <Suspense fallback={<SectionLoader />}><TeachersSection isDirector={user.role === 'director'} /></Suspense>
          )}
          {activeSection === 'departments' && (
            <Suspense fallback={<SectionLoader />}><DepartmentsSection isDirector={user.role === 'director'} /></Suspense>
          )}
          {activeSection === 'registrations' && (
            <Suspense fallback={<SectionLoader />}><RegistrationsSection /></Suspense>
          )}
          {activeSection === 'attendance' && (
            <Suspense fallback={<SectionLoader />}><AttendanceSection /></Suspense>
          )}
          {activeSection === 'tasks' && (
            <Suspense fallback={<SectionLoader />}><TasksSection /></Suspense>
          )}
          {activeSection === 'finance' && (
            <Suspense fallback={<SectionLoader />}><FinanceSection user={user} /></Suspense>
          )}
          {activeSection === 'timetable' && (
            <Suspense fallback={<SectionLoader />}><TimetableSection isDirector={user.role === 'director'} canManageTimetable={user.role === 'director' || user.canManageTimetable} /></Suspense>
          )}
          {activeSection === 'timesheet' && (
            <Suspense fallback={<SectionLoader />}><TimesheetSection isDirector={user.role === 'director'} /></Suspense>
          )}
          {activeSection === 'users' && (
            <Suspense fallback={<SectionLoader />}><UsersSection /></Suspense>
          )}
          {activeSection === 'reports' && (
            <Suspense fallback={<SectionLoader />}><ReportsSection isDirector={user.role === 'director'} /></Suspense>
          )}
          {activeSection === 'backup' && (
            <Suspense fallback={<SectionLoader />}><BackupSection /></Suspense>
          )}
          {activeSection === 'permissions' && (
            <Suspense fallback={<SectionLoader />}><PermissionsSection /></Suspense>
          )}
          {activeSection === 'archive' && (
            <Suspense fallback={<SectionLoader />}><ArchiveSection /></Suspense>
          )}
          {activeSection === 'certificates' && (
            <Suspense fallback={<SectionLoader />}><CertificatesSection /></Suspense>
          )}
          {activeSection === 'activity-log' && (
            <Suspense fallback={<SectionLoader />}><ActivityLogSection isDirector={user.role === 'director'} /></Suspense>
          )}
          {activeSection === 'exams' && (
            <Suspense fallback={<SectionLoader />}><ExamsSection isDirector={user.role === 'director'} /></Suspense>
          )}
          {activeSection === 'crm' && (
            <Suspense fallback={<SectionLoader />}><CrmSection /></Suspense>
          )}
          {activeSection === 'ai-assistant' && (
            <Suspense fallback={<SectionLoader />}><AIAssistantSection user={{ id: user.id, name: user.name, role: user.role }} /></Suspense>
          )}
          {activeSection === 'ai-settings' && (
            <Suspense fallback={<SectionLoader />}><AISettingsSection isDirector={user.role === 'director'} /></Suspense>
          )}
          {activeSection === 'whatsapp' && (
            <Suspense fallback={<SectionLoader />}><WhatsAppSection isDirector={user.role === 'director'} /></Suspense>
          )}
          {activeSection === 'import' && (
            <Suspense fallback={<SectionLoader />}><ImportSection isDirector={user.role === 'director'} /></Suspense>
          )}
          {activeSection === 'calendar' && (
            <Suspense fallback={<SectionLoader />}><CalendarSection /></Suspense>
          )}
          {activeSection === 'notifications' && (
            <Suspense fallback={<SectionLoader />}><NotificationsSection onNavigate={(s) => setActiveSection(s as Section)} /></Suspense>
          )}
          {activeSection === 'student-cards' && (
            <Suspense fallback={<SectionLoader />}><StudentCardsSection /></Suspense>
          )}
          {activeSection === 'operations' && (
            <Suspense fallback={<SectionLoader />}><OperationsCenter isDirector={user.role === 'director'} onNavigate={(s) => setActiveSection(s as Section)} /></Suspense>
          )}
          {activeSection === 'branches' && (
            <Suspense fallback={<SectionLoader />}><BranchesSection isDirector={user.role === 'director'} /></Suspense>
          )}
          {activeSection === 'institution-settings' && (
            <Suspense fallback={<SectionLoader />}><InstitutionSettingsSection /></Suspense>
          )}
        </div>
      </main>
    </div>
  );
}
