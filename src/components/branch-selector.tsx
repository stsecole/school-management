'use client';

import { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Check, Loader2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Branch {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

interface Props {
  /** When the branch changes, this is called so the parent can refresh data */
  onBranchChange?: () => void;
}

/**
 * BranchSelector — a dropdown shown only to directors in the top bar.
 *
 * - "كل الفروع"  → no filter, see everything
 * - "<branch>"  → filter all data to that branch
 *
 * Calls POST /api/active-branch to set a cookie, then triggers a full page
 * reload so all data refreshes from the new perspective.
 */
export function BranchSelector({ onBranchChange }: Props) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch('/api/branches').then(r => r.json()).catch(() => ({ branches: [] })),
      fetch('/api/active-branch').then(r => r.json()).catch(() => ({ activeBranch: 'all' })),
    ]).then(([bData, aData]) => {
      setBranches((bData.branches || []).filter((b: Branch) => b.isActive));
      setActiveBranch(aData.activeBranch || 'all');
      setLoading(false);
    });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectBranch = async (branchId: string) => {
    if (branchId === activeBranch) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/active-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId }),
      });
      if (!res.ok) {
        toast({ title: 'Error', description: 'Failed to switch branch', variant: 'destructive' });
        return;
      }
      setActiveBranch(branchId);
      setOpen(false);
      toast({
        title: 'تم تبديل الفرع',
        description: branchId === 'all'
          ? 'تعرض الآن كل الفروع'
          : `تعرض الآن: ${branches.find(b => b.id === branchId)?.name || 'فرع'}`,
      });
      // Full page reload to refresh ALL data (dashboard, stats, lists, charts)
      // after 800ms so the user can see the toast
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="hidden sm:inline">Loading...</span>
      </Button>
    );
  }

  // If no branches exist, don't show the selector
  if (branches.length === 0) {
    return null;
  }

  const activeName = activeBranch === 'all'
    ? 'كل الفروع'
    : branches.find(b => b.id === activeBranch)?.name || 'كل الفروع';

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="gap-2 min-w-[140px] justify-between"
        title="تبديل الفرع النشط"
      >
        {activeBranch === 'all' ? (
          <Globe className="w-4 h-4 text-blue-600" />
        ) : (
          <Building2 className="w-4 h-4 text-indigo-600" />
        )}
        <span className="truncate flex-1 text-right">{activeName}</span>
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </Button>

      {open && (
        <div className="absolute top-full mt-1 right-0 left-0 min-w-[200px] bg-white border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          <button
            onClick={() => selectBranch('all')}
            className={`w-full px-3 py-2 text-right text-sm hover:bg-muted transition-colors flex items-center justify-between ${
              activeBranch === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : ''
            }`}
          >
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              كل الفروع
            </span>
            {activeBranch === 'all' && <Check className="w-4 h-4" />}
          </button>
          <div className="border-t border-border" />
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => selectBranch(b.id)}
              className={`w-full px-3 py-2 text-right text-sm hover:bg-muted transition-colors flex items-center justify-between ${
                activeBranch === b.id ? 'bg-indigo-50 text-indigo-700 font-medium' : ''
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{b.name}</span>
                {b.code && (
                  <span className="text-xs text-muted-foreground num flex-shrink-0">({b.code})</span>
                )}
              </span>
              {activeBranch === b.id && <Check className="w-4 h-4 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
