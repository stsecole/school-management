'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  CalendarCheck, ListTodo, Wallet, LogOut, Menu, GraduationCap as School,
  AlertCircle, UserCog, Calendar, Clock, ScanLine, BarChart3, Database, UserPlus,
} from 'lucide-react';
import { LoginScreen } from '@/components/login-screen';
import { DashboardStats } from '@/components/sections/dashboard-stats';
import { StudentsSection } from '@/components/sections/students-section';
import { TeachersSection } from '@/components/sections/teachers-section';
import { DepartmentsSection } from '@/components/sections/departments-section';
import { RegistrationsSection } from '@/components/sections/registrations-section';
import { AttendanceSection } from '@/components/sections/attendance-section';
import { TasksSection } from '@/components/sections/tasks-section';
import { FinanceSection } from '@/components/sections/finance-section';
import { UsersSection } from '@/components/sections/users-section';
import { TimetableSection } from '@/components/sections/timetable-section';
import { TimesheetSection } from '@/components/sections/timesheet-section';
import { BackupSection } from '@/components/sections/backup-section';
import { ReportsSection } from '@/components/sections/reports-section';
import { PWAInstall } from '@/components/pwa-install';
import { ExamsSection } from '@/components/sections/exams-section';
import { CrmSection } from '@/components/sections/crm-section';

interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: 'director' | 'employee';
  canManageTimetable?: boolean;
}

type Section = 'dashboard' | 'students' | 'teachers' | 'departments' | 'registrations' | 'attendance' | 'tasks' | 'finance' | 'users' | 'timetable' | 'timesheet' | 'reports' | 'backup' | 'exams' | 'crm';

const sections: { id: Section; label: string; icon: any; roles: ('director' | 'employee')[] }[] = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['director', 'employee'] },
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
  { id: 'users', label: 'إدارة الحسابات', icon: UserCog, roles: ['director'] },
  { id: 'backup', label: 'النسخ الاحتياطي', icon: Database, roles: ['director'] },
];

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => setUser(data.user || null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setActiveSection('dashboard');
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
  const activeSectionData = visibleSections.find(s => s.id === activeSection) || visibleSections[0];

  const handleSelectSection = (id: Section) => {
    setActiveSection(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-primary text-primary-foreground fixed inset-y-0 right-0">
        <div className="p-5 border-b border-primary-foreground/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary-foreground/10">
              <School className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base">نظام الإدارة</h1>
              <p className="text-xs opacity-80">مدرسة السلامة</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleSections.map(s => {
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
        <div className="flex items-center gap-2">
          <School className="w-6 h-6" />
          <span className="font-bold">نظام الإدارة</span>
        </div>
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0 bg-primary text-primary-foreground border-l-0">
            <div className="p-5 border-b border-primary-foreground/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-foreground/10">
                  <School className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-bold text-base">نظام الإدارة</h1>
                  <p className="text-xs opacity-80">مدرسة السلامة</p>
                </div>
              </div>
            </div>
            <nav className="p-3 space-y-1">
              {visibleSections.map(s => {
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

      {/* Main content */}
      <main className="flex-1 lg:mr-64 pt-16 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
          {/* Section title for desktop */}
          <div className="hidden lg:flex items-center gap-2 mb-6 text-sm text-muted-foreground">
            <activeSectionData.icon className="w-4 h-4" />
            <span>{activeSectionData.label}</span>
          </div>

          {activeSection === 'dashboard' && <DashboardStats />}
          {activeSection === 'students' && <StudentsSection isDirector={user.role === 'director'} />}
          {activeSection === 'teachers' && <TeachersSection isDirector={user.role === 'director'} />}
          {activeSection === 'departments' && <DepartmentsSection isDirector={user.role === 'director'} />}
          {activeSection === 'registrations' && <RegistrationsSection />}
          {activeSection === 'attendance' && <AttendanceSection />}
          {activeSection === 'tasks' && <TasksSection />}
          {activeSection === 'finance' && <FinanceSection user={user} />}
          {activeSection === 'timetable' && <TimetableSection isDirector={user.role === 'director'} canManageTimetable={user.role === 'director' || user.canManageTimetable} />}
          {activeSection === 'timesheet' && <TimesheetSection isDirector={user.role === 'director'} />}
          {activeSection === 'users' && <UsersSection />}
          {activeSection === 'reports' && <ReportsSection isDirector={user.role === 'director'} />}
          {activeSection === 'backup' && <BackupSection />}
          {activeSection === 'exams' && <ExamsSection isDirector={user.role === 'director'} />}
          {activeSection === 'crm' && <CrmSection />}
        </div>
      </main>
    </div>
  );
}
