'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Info } from 'lucide-react';
import { FinanceDashboard } from '@/components/sections/finance-dashboard';

interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: 'director' | 'employee';
}

export function FinanceSection({ user }: { user: SessionUser }) {
  const isDirector = user.role === 'director';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> القسم المالي
          </h2>
          <p className="text-muted-foreground text-sm">
            {isDirector
              ? 'إدارة شاملة: أقساط الطلاب، رواتب الأساتذة، المصاريف الثانوية، التقارير، الوصولات'
              : 'إدخال أقساط الطلاب وطباعة الوصولات'}
          </p>
        </div>
      </div>

      {/* Role-based access banner */}
      {!isDirector && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">صلاحياتك كموظف:</p>
              <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
                <li>إدخال أقساط الطلاب وتسجيل دفعاتهم</li>
                <li>طباعة وصولات الطلاب فقط</li>
                <li>الاطلاع على قائمة دفعات الطلاب</li>
              </ul>
              <p className="mt-2 text-xs text-blue-600">رواتب الأساتذة، المصاريف الثانوية، التقارير، والتصدير متاحة للمدير فقط.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <FinanceDashboard isDirector={isDirector} />
    </div>
  );
}
