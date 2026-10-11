'use client';

import { Wallet } from 'lucide-react';
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

      <FinanceDashboard isDirector={isDirector} />
    </div>
  );
}