'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users, GraduationCap, BookOpen, ClipboardList, CalendarCheck,
  Calendar, ListTodo, Wallet, Clock, UserCog, BarChart3,
  Database, Mail, ShieldCheck, LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformManagementSectionProps {
  isDirector: boolean;
  onNavigate: (section: string) => void;
}

interface ManagementTile {
  id: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  bgColor: string;
  directorOnly?: boolean;
}

interface TileGroup {
  title: string;
  icon: any;
  tiles: ManagementTile[];
}

export function PlatformManagementSection({ isDirector, onNavigate }: PlatformManagementSectionProps) {
  // تجميع البلاطات في مجموعات منطقية
  const groups: TileGroup[] = [
    {
      title: 'الإدارة الأكاديمية',
      icon: GraduationCap,
      tiles: [
        {
          id: 'students',
          label: 'الطلاب',
          description: 'إدارة بيانات الطلاب والتسجيلات',
          icon: Users,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
        },
        {
          id: 'teachers',
          label: 'الأساتذة',
          description: 'إدارة الأساتذة ورواتبهم',
          icon: GraduationCap,
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
        },
        {
          id: 'departments',
          label: 'الأقسام',
          description: 'الأقسام والتخصصات والمستويات',
          icon: BookOpen,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
        },
        {
          id: 'registrations',
          label: 'التسجيلات',
          description: 'تسجيل الطلاب في الدورات',
          icon: ClipboardList,
          color: 'text-cyan-600',
          bgColor: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200',
        },
      ],
    },
    {
      title: 'المتابعة والتنظيم',
      icon: CalendarCheck,
      tiles: [
        {
          id: 'attendance',
          label: 'الحضور',
          description: 'سجلات حضور الطلاب والمدة',
          icon: CalendarCheck,
          color: 'text-pink-600',
          bgColor: 'bg-pink-50 hover:bg-pink-100 border-pink-200',
        },
        {
          id: 'timetable',
          label: 'الجدول الأسبوعي',
          description: 'تنظيم الحصص والقاعات والأفواج',
          icon: Calendar,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
        },
        {
          id: 'tasks',
          label: 'متابعة المهام',
          description: 'إدارة المهام وتوزيع المسؤوليات',
          icon: ListTodo,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
        },
        {
          id: 'timesheet',
          label: 'حضور الموظفين',
          description: 'متابعة دوام الموظفين والساعات',
          icon: Clock,
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
        },
      ],
    },
    {
      title: 'الإدارة المالية',
      icon: Wallet,
      tiles: [
        {
          id: 'finance',
          label: 'القسم المالي',
          description: 'الأقساط، الرواتب، المصاريف، الوصولات',
          icon: Wallet,
          color: 'text-emerald-700',
          bgColor: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
          directorOnly: false, // الموظف يرى القسم المالي بصلاحيات محدودة
        },
        {
          id: 'reports',
          label: 'التقارير',
          description: 'تقارير شاملة وتحليل بالذكاء الاصطناعي',
          icon: BarChart3,
          color: 'text-blue-700',
          bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
        },
      ],
    },
    {
      title: 'النظام والإدارة',
      icon: UserCog,
      tiles: [
        {
          id: 'users',
          label: 'إدارة الحسابات',
          description: 'إنشاء وإدارة حسابات الموظفين',
          icon: UserCog,
          color: 'text-red-600',
          bgColor: 'bg-red-50 hover:bg-red-100 border-red-200',
          directorOnly: true,
        },
        {
          id: 'messages',
          label: 'الرسائل',
          description: 'تبادل الرسائل الداخلية',
          icon: Mail,
          color: 'text-cyan-700',
          bgColor: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200',
        },
        {
          id: 'backup',
          label: 'النسخ الاحتياطية',
          description: 'إنشاء وإدارة نسخ قاعدة البيانات',
          icon: Database,
          color: 'text-slate-700',
          bgColor: 'bg-slate-50 hover:bg-slate-100 border-slate-200',
          directorOnly: true,
        },
        {
          id: 'dashboard',
          label: 'لوحة التحكم',
          description: 'الإحصائيات والمؤشرات الرئيسية',
          icon: LayoutDashboard,
          color: 'text-primary',
          bgColor: 'bg-primary/5 hover:bg-primary/10 border-primary/20',
        },
      ],
    },
  ];

  // تصفية البلاطات حسب صلاحيات المستخدم
  const visibleGroups = groups
    .map(g => ({
      ...g,
      tiles: g.tiles.filter(t => !t.directorOnly || isDirector),
    }))
    .filter(g => g.tiles.length > 0);

  const handleClick = (tile: ManagementTile) => {
    if (tile.directorOnly && !isDirector) return;
    onNavigate(tile.id);
  };

  // إحصائيات سريعة في الأعلى
  const totalTiles = visibleGroups.reduce((sum, g) => sum + g.tiles.length, 0);
  const directorOnlyCount = visibleGroups.reduce(
    (sum, g) => sum + g.tiles.filter(t => t.directorOnly).length,
    0
  );

  return (
    <div className="space-y-6">
      {/* رأس القسم */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-primary" /> إدارة المنصة
        </h2>
        <p className="text-muted-foreground text-sm">
          اختر قسماً للوصول السريع •{' '}
          <span className="num font-medium text-primary">{totalTiles}</span> قسم متاح
          {isDirector && directorOnlyCount > 0 && (
            <>
              {' • '}
              <span className="num font-medium text-amber-600">{directorOnlyCount}</span> قسم حصري للمدير
            </>
          )}
        </p>
      </div>

      {/* تنبيه الصلاحيات */}
      {!isDirector && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-3 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">صلاحياتك كموظف</p>
              <p className="text-xs text-blue-700 mt-0.5">
                يمكنك الوصول إلى معظم الأقسام. الأقسام المالية والإدارية الحساسة مخصصة للمدير فقط ومُعلَّمة بشارة "مدير".
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* مجموعات البلاطات */}
      {visibleGroups.map((group, gIdx) => {
        const GroupIcon = group.icon;
        return (
          <div key={gIdx} className="space-y-3">
            {/* عنوان المجموعة */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <GroupIcon className="w-4 h-4 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-muted-foreground">{group.title}</h3>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* شبكة البلاطات */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {group.tiles.map((tile) => {
                const Icon = tile.icon;
                const isLocked = tile.directorOnly && !isDirector;
                return (
                  <button
                    key={tile.id}
                    onClick={() => handleClick(tile)}
                    disabled={isLocked}
                    className={cn(
                      'text-right p-4 rounded-xl border-2 transition-all',
                      tile.bgColor,
                      'hover:shadow-md hover:-translate-y-0.5',
                      isLocked && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className={cn('p-2 rounded-lg bg-white/70', tile.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {tile.directorOnly && (
                        <Badge variant="secondary" className="text-[10px] h-5 gap-0.5 bg-amber-100 text-amber-700 border-amber-200">
                          <ShieldCheck className="w-3 h-3" />
                          مدير
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-bold text-sm mb-0.5">{tile.label}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {tile.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* تذييل معلومات */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>الوصول مُتحكم به حسب دور المستخدم</span>
            </div>
            <span>نظام إدارة مدرسة السلامة</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
