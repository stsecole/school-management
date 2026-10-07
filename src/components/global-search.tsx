'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, Users, GraduationCap, BookOpen, ClipboardList,
  Wallet, UserPlus, ListTodo, CornerDownLeft, X,
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'student' | 'teacher' | 'department' | 'course' | 'lead' | 'payment' | 'task';
  typeLabel: string;
  title: string;
  subtitle: string;
  badge?: string;
  section: string;
  extra?: any;
}

interface GlobalSearchProps {
  onNavigate?: (section: string) => void;
}

const TYPE_ICON: Record<string, any> = {
  student: Users,
  teacher: GraduationCap,
  department: BookOpen,
  course: BookOpen,
  lead: UserPlus,
  payment: Wallet,
  task: ListTodo,
};

const TYPE_COLOR: Record<string, string> = {
  student: 'text-blue-600 bg-blue-50',
  teacher: 'text-emerald-600 bg-emerald-50',
  department: 'text-purple-600 bg-purple-50',
  course: 'text-purple-600 bg-purple-50',
  lead: 'text-amber-600 bg-amber-50',
  payment: 'text-teal-600 bg-teal-50',
  task: 'text-orange-600 bg-orange-50',
};

const TYPE_ORDER: { type: string; label: string }[] = [
  { type: 'student', label: 'الطلاب' },
  { type: 'teacher', label: 'الأساتذة' },
  { type: 'department', label: 'الأقسام' },
  { type: 'course', label: 'المواد' },
  { type: 'lead', label: 'العملاء المحتملون' },
  { type: 'payment', label: 'الدفعات' },
  { type: 'task', label: 'المهام' },
];

export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debTimer = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('global_search_recent');
      if (saved) setRecentSearches(JSON.parse(saved).slice(0, 5));
    } catch {}
  }, []);

  // Save search to recent
  const saveRecentSearch = (q: string) => {
    try {
      const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('global_search_recent', JSON.stringify(updated));
    } catch {}
  };

  // ===== Keyboard shortcut: Ctrl+K / Cmd+K =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ===== Debounced search with AbortController (cancels previous requests) =====
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setCounts({});
      setLoading(false);
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      return;
    }
    setLoading(true);

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    if (debTimer.current) clearTimeout(debTimer.current);
    debTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=15`, {
          signal: abortControllerRef.current?.signal,
        });
        const data = await res.json();
        setResults(data.results || []);
        setCounts(data.counts || {});
      } catch (err: any) {
        // Ignore abort errors (they're expected)
        if (err.name !== 'AbortError') {
          setResults([]);
          setCounts({});
        }
      } finally {
        setLoading(false);
      }
    }, 350); // 350ms debounce (was 250ms — reduces unnecessary requests)
    return () => {
      if (debTimer.current) clearTimeout(debTimer.current);
    };
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    saveRecentSearch(query);
    setOpen(false);
    setQuery('');
    setResults([]);
    if (onNavigate) {
      onNavigate(result.section);
    }
  };

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full max-w-md justify-start text-muted-foreground gap-2"
        onClick={() => setOpen(true)}
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-right">بحث في كل الأقسام...</span>
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <CornerDownLeft className="w-3 h-3" /> Ctrl+K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="ابحث بالاسم، الرقم، الهاتف، رقم الوصل..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[60vh]">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2" />
              <p>جاري البحث...</p>
            </div>
          ) : query.trim().length < 2 ? (
            <div className="p-6 text-center text-sm text-muted-foreground space-y-3">
              <Search className="w-10 h-10 mx-auto opacity-30" />
              <p>ابحث في:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {TYPE_ORDER.map(t => (
                  <Badge key={t.type} variant="outline" className="text-xs">
                    {t.label}
                  </Badge>
                ))}
              </div>
              {recentSearches.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs font-medium mb-2">عمليات البحث الأخيرة:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {recentSearches.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setQuery(s)}
                        className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs mt-3 opacity-70">
                اضغط <kbd className="px-1 border rounded">Ctrl+K</kbd> في أي وقت لفتح البحث
              </p>
            </div>
          ) : results.length === 0 ? (
            <CommandEmpty>لا توجد نتائج لـ "{query}"</CommandEmpty>
          ) : (
            <>
              {/* Summary line */}
              <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-muted/30 flex items-center gap-2 flex-wrap">
                <span className="font-medium">{results.length} نتيجة</span>
                <span>•</span>
                {TYPE_ORDER.filter(t => counts[t.type]).map(t => (
                  <Badge key={t.type} variant="secondary" className="text-xs">
                    {t.label}: {counts[t.type]}
                  </Badge>
                ))}
              </div>

              {TYPE_ORDER.map(({ type, label }) => {
                const items = grouped[type];
                if (!items || items.length === 0) return null;
                const Icon = TYPE_ICON[type] || Search;
                return (
                  <CommandGroup key={type} heading={label}>
                    {items.map(r => {
                      const iconClass = TYPE_COLOR[r.type] || 'text-muted-foreground bg-muted';
                      return (
                        <CommandItem
                          key={`${r.type}-${r.id}`}
                          value={`${r.type}-${r.id}-${r.title}`}
                          onSelect={() => handleSelect(r)}
                          className="gap-3 py-2"
                        >
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconClass}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{r.title}</span>
                              <Badge variant="outline" className="text-[10px] flex-shrink-0">
                                {r.typeLabel}
                              </Badge>
                              {r.badge && (
                                <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                                  {r.badge}
                                </Badge>
                              )}
                            </div>
                            {r.subtitle && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{r.subtitle}</p>
                            )}
                          </div>
                          <CornerDownLeft className="w-3 h-3 text-muted-foreground opacity-50 flex-shrink-0" />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
