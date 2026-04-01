// 1. Core Component Imports
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

// 2. Focused React Hooks
import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { supabase } from "./lib/supabaseClient";
import Auth from './components/Auth';

// 3. Tree-Shaken Lucide Icons
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Check from 'lucide-react/dist/esm/icons/check';
import X from 'lucide-react/dist/esm/icons/x';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import CalendarIcon from 'lucide-react/dist/esm/icons/calendar';
import SettingsIcon from 'lucide-react/dist/esm/icons/settings';
import PieChartIcon from 'lucide-react/dist/esm/icons/pie-chart';
import Download from 'lucide-react/dist/esm/icons/download';
import Search from 'lucide-react/dist/esm/icons/search';
import LogOut from 'lucide-react/dist/esm/icons/log-out';
import Sun from 'lucide-react/dist/esm/icons/sun';
import Pencil from 'lucide-react/dist/esm/icons/pencil';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import Info from 'lucide-react/dist/esm/icons/info';

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import { calculateSubjectStats } from './utils/attendanceLogic';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ─── FIX #2: Normalize date to YYYY-MM-DD string (timezone-safe) ───
const toDateStr = (date) => {
  if (typeof date === 'string' && date.length === 10) return date; // already YYYY-MM-DD
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ─── Toast System ───
let toastIdCounter = 0;

// ═══════════════════════════════════════════════════════════════
// TOAST NOTIFICATION COMPONENT
// ═══════════════════════════════════════════════════════════════
const Toast = memo(({ toasts, onDismiss }) => (
  <div className="toast-container" aria-live="polite">
    {toasts.map(t => (
      <div key={t.id} className={`toast toast--${t.type}`}>
        <span className="toast-icon">
          {t.type === 'success' && <CheckCircle2 size={16} />}
          {t.type === 'error' && <AlertTriangle size={16} />}
          {t.type === 'info' && <Info size={16} />}
        </span>
        <span className="toast-message">{t.message}</span>
        <button className="toast-dismiss" onClick={() => onDismiss(t.id)}>
          <X size={14} />
        </button>
      </div>
    ))}
  </div>
));
Toast.displayName = 'Toast';

// ─── Skeleton Card ───
const SkeletonCard = memo(() => (
  <div className="glass-card-precise flex flex-col min-h-[360px] relative overflow-hidden">
    <div className="skeleton-bar w-2/3 h-6 m-6 mb-2 rounded-xl" />
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="skeleton-bar w-28 h-20 rounded-2xl" />
      <div className="skeleton-bar w-20 h-4 rounded-full" />
    </div>
    <div className="data-split-row">
      <div className="data-split-metric"><div className="skeleton-bar w-12 h-4 rounded" /></div>
      <div className="data-split-divider" />
      <div className="data-split-metric"><div className="skeleton-bar w-12 h-4 rounded" /></div>
    </div>
    <div className="action-subpanel gap-3">
      <div className="skeleton-bar w-11 h-11 rounded-2xl" />
      <div className="skeleton-bar w-11 h-11 rounded-2xl" />
      <div className="skeleton-bar w-11 h-11 rounded-2xl" />
    </div>
    <div className="progress-bar-track"><div className="skeleton-bar w-full h-full" /></div>
  </div>
));
SkeletonCard.displayName = 'SkeletonCard';

// ═══════════════════════════════════════════════════════════════
// MEMOIZED ANTI-GRAVITY COMPONENTS — O(1) Render Performance
// ═══════════════════════════════════════════════════════════════

const GlassCard = memo(({ children, className = "" }) => (
  <div className={`glass-card ${className}`}>
    {children}
  </div>
));
GlassCard.displayName = 'GlassCard';

const GlassButton = memo(({ children, onClick, className = "", variant = "secondary", disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2
      ${variant === 'primary' ? 'glass-button-primary text-white' : 'glass-panel hover:bg-white/10 text-slate-200'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      ${className}
    `}
  >
    {children}
  </button>
));
GlassButton.displayName = 'GlassButton';

// ─── Memoized Navigation Button ───
const NavButton = memo(({ icon: Icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`ag-nav-btn ${active ? 'ag-nav-btn--active' : ''}`}
  >
    <Icon size={24} strokeWidth={active ? 2.5 : 2} />
  </button>
));
NavButton.displayName = 'NavButton';

// ─── Memoized Anti-Gravity Subject Card ───
const SubjectCard = memo(({ subject, onDelete, onEdit, onReset }) => {
  const { stats } = subject;
  const pct = stats?.percentage || 0;
  const needMore = stats?.isCritical ? (stats?.missing || 0) : 0;

  return (
    <div className="glass-card-precise flex flex-col min-h-[320px] relative overflow-hidden ag-animate-in">

      {/* Card Header */}
      <div className="relative z-10 p-6 pb-3 flex justify-between items-start">
        <h3 className="font-bold text-xl text-white tracking-wide break-words leading-tight pr-2" style={{maxWidth:'calc(100% - 5rem)'}}>
          {subject.name}
        </h3>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(subject)} className="action-btn-touch action-btn-touch--undo p-2" aria-label="Edit subject">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(subject.id)} className="action-btn-touch action-btn-touch--absent p-2" aria-label="Delete subject">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── HERO: Big % ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-2">
        <div className="text-7xl font-black text-gradient-cyan-purple tracking-tighter leading-none">
          {pct}%
        </div>
        <p className={`status-badge mt-3 ${stats?.isCritical ? 'status-badge--critical' : 'status-badge--safe'}`}>
          {pct < subject.target ? `${subject.target}% Target` : 'On Track ✓'}
        </p>
      </div>

      {/* ── 3-COLUMN STATS ── */}
      <div className="relative z-10 grid grid-cols-3 border-t border-white/5 bg-black/20">
        <div className="flex flex-col items-center py-4 px-2 gap-1">
          <span className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-500">Present</span>
          <span className="text-xl font-bold text-emerald-400">{stats?.present || 0}</span>
        </div>
        <div className="flex flex-col items-center py-4 px-2 gap-1 border-x border-white/5">
          <span className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-500">Total Held</span>
          <span className="text-xl font-bold text-slate-300">{stats?.total || 0}</span>
        </div>
        <div className="flex flex-col items-center py-4 px-2 gap-1">
          <span className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-500">Need More</span>
          <span className={`text-xl font-bold ${needMore > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {needMore > 0 ? needMore : '—'}
          </span>
        </div>
      </div>

      {/* ── RESET BUTTON ── */}
      <div className="relative z-10 p-3">
        <button
          onClick={() => onReset(subject)}
          className="reset-btn w-full flex items-center justify-center gap-2"
          aria-label="Reset attendance"
        >
          <RotateCcw size={14} />
          Reset Attendance
        </button>
      </div>

      {/* ── NEON PROGRESS BAR ── */}
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${stats?.isCritical ? 'progress-bar-fill--critical' : 'progress-bar-fill--healthy'}`}
          style={{ width: `${pct}%` }}
        ></div>
      </div>
    </div>
  );
});
SubjectCard.displayName = 'SubjectCard';

// ─── Memoized Calendar Log Action Button ───
const LogActionButton = memo(({ status, type, icon: IconComponent, onClick }) => {
  const isActive = status === type || (status === 'holiday' && type === 'holiday');
  const activeClass = isActive
    ? type === 'p' ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]'
      : type === 'a' ? 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]'
        : 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.5)]'
    : 'bg-white/5 text-slate-500 hover:bg-white/10';

  return (
    <button onClick={onClick} className={`p-2 rounded-lg transition-all active:scale-90 ${activeClass}`}>
      <IconComponent size={16} strokeWidth={isActive ? 2.5 : 2} />
    </button>
  );
});
LogActionButton.displayName = 'LogActionButton';

// ─── Memoized Calendar Log Row with Optimistic Color State ───
const LogRow = memo(({ log, onMarkAttendance }) => {
  const statusStyles = {
    p: 'log-row--present',
    a: 'log-row--absent',
    holiday: 'log-row--holiday',
    'not marked': ''
  };
  const statusLabels = {
    p: 'Present',
    a: 'Absent',
    holiday: 'Holiday',
    'not marked': null
  };
  const statusLabel = statusLabels[log.status];

  return (
    <div className={`glass-card log-row p-5 rounded-2xl flex justify-between items-center ${statusStyles[log.status] || ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-bold text-lg text-slate-200 truncate">{log.name}</span>
        {statusLabel && (
          <span className={`log-status-pill log-status-pill--${log.status === 'p' ? 'present' : log.status === 'a' ? 'absent' : 'holiday'}`}>
            {log.isSundayAuto && log.status === 'holiday' && <Sun size={10} className="inline mr-1" />}
            {statusLabel}
          </span>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <LogActionButton status={log.status} type="p" icon={Check} onClick={() => onMarkAttendance(log.id, 'p')} />
        <LogActionButton status={log.status} type="a" icon={X} onClick={() => onMarkAttendance(log.id, 'a')} />
        <LogActionButton status={log.status} type="holiday" icon={SettingsIcon} onClick={() => onMarkAttendance(log.id, 'h')} />
      </div>
    </div>
  );
});
LogRow.displayName = 'LogRow';

// ─── Reset Password View ───
const ResetPasswordView = memo(({ onComplete }) => {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert(error.message);
    else {
      alert("Success! Password updated.");
      window.location.hash = "";
      onComplete();
    }
    setLoading(false);
  };

  return (
    <GlassCard className="w-full max-w-md text-white">
      <h2 className="text-2xl font-black mb-6 text-center text-gradient-cyan-purple">Secure New Password</h2>
      <form onSubmit={handleUpdate} className="space-y-4">
        <input
          type="password"
          placeholder="••••••••"
          className="w-full p-4 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-500"
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <GlassButton variant="primary" className="w-full py-4 text-lg">
          {loading ? 'Updating...' : 'Set Password'}
        </GlassButton>
      </form>
    </GlassCard>
  );
});
ResetPasswordView.displayName = 'ResetPasswordView';

// ═══════════════════════════════════════════════════════════════
// MAIN APP — Optimistic State Mirroring Architecture
// ═══════════════════════════════════════════════════════════════

const App = () => {
  const [subjects, setSubjects] = useState([]);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newSub, setNewSub] = useState({ name: '', target: 75, color: COLORS[0] });
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  // ─── FIX #5: Use ref for subjects to avoid stale closure in callbacks ───
  const subjectsRef = useRef(subjects);
  useEffect(() => { subjectsRef.current = subjects; }, [subjects]);

  // ─── Edit state ───
  const [editSubject, setEditSubject] = useState(null); // null = new, object = edit mode

  // ─── Toast helpers ───
  const addToast = useCallback((message, type = 'success') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── FIX #2 + #3: Normalize dates to YYYY-MM-DD on fetch ───
  // IMPORTANT: fetchSubjects MUST be declared BEFORE the useEffect that calls it
  const fetchSubjects = useCallback(async () => {
    const { data, error } = await supabase.from('subjects').select('*, attendance_logs(*)');
    if (error) {
      addToast('Failed to load subjects. Please refresh.', 'error');
    } else if (data) {
      const transformedData = data.map(s => {
        // FIX #3: sort by created_at desc so .find() hits the latest log
        const sortedLogs = [...(s.attendance_logs || [])].sort(
          (a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date)
        );
        const history = sortedLogs.map(log => ({
          id: log.id,
          // FIX #2: store as normalized YYYY-MM-DD string, no timezone drift
          date: toDateStr(log.date),
          status: log.status === 'present' ? 'p' : log.status === 'absent' ? 'a' : 'holiday'
        }));
        const stats = calculateSubjectStats({ ...s, history, target: s.target_percentage });
        return { ...s, target: s.target_percentage, history, stats };
      });
      setSubjects(transformedData);
    }
    setLoading(false); // only turns off — initial loading=true set by auth effect
  }, [addToast]);

  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) setIsResetting(true);
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        fetchSubjects();
      } else {
        setLoading(false);
      }
    };
    getSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        fetchSubjects();
      } else {
        setSubjects([]);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchSubjects]);

  const downloadAttendanceCSV = useCallback(() => {
    let csvContent = "Subject,Target %,Present,Absent,Holidays,Total Conducted,Current %,Status\n";
    subjects.forEach(s => {
      const stats = s.stats || calculateSubjectStats(s);
      const row = [
        s.name, `${s.target}%`, stats.present,
        s.history.filter(h => h.status === 'a').length,
        s.history.filter(h => h.status === 'holiday').length,
        stats.total, `${stats.percentage}%`,
        stats.isCritical ? "DANGER" : "SAFE"
      ].join(",");
      csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Attendance_Report_${new Date().toLocaleDateString()}.csv`;
    link.click();
    addToast('Report downloaded!', 'success');
  }, [subjects, addToast]);

  const addSubject = useCallback(async () => {
    const name = (editSubject?.name ?? newSub.name).trim();
    const target = editSubject?.target ?? newSub.target;
    if (!name) return;

    if (editSubject?.id) {
      // ─── Edit mode ───
      const { error } = await supabase.from('subjects').update({
        name, target_percentage: Number(target)
      }).eq('id', editSubject.id);
      if (error) {
        addToast('Failed to update subject.', 'error');
      } else {
        addToast(`"${name}" updated!`, 'success');
        setIsModalOpen(false);
        setEditSubject(null);
        fetchSubjects();
      }
    } else {
      // ─── Create mode ───
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { error } = await supabase.from('subjects').insert([{
        name, target_percentage: Number(target), user_id: currentUser.id
      }]);
      if (!error) {
        addToast(`"${name}" added!`, 'success');
        fetchSubjects();
        setIsModalOpen(false);
        setNewSub({ name: '', target: 75, color: COLORS[0] });
      } else {
        addToast('Failed to add subject.', 'error');
      }
    }
  }, [newSub, editSubject, fetchSubjects, addToast]);

  // ─────────────────────────────────────────────────────────
  // markAttendance — Native Supabase UPSERT (requires unique constraint on subject_id+date)
  // ─────────────────────────────────────────────────────────
  const markAttendance = useCallback(async (subjectId, status) => {
    const dbStatus = status === 'p' ? 'present' : status === 'a' ? 'absent' : 'holiday';
    const optimisticStatus = status === 'p' ? 'p' : status === 'a' ? 'a' : 'holiday';
    const dateStr = toDateStr(selectedDate);

    // Optimistic update — instantly reflect in UI
    let previousSubjects;
    setSubjects(prev => {
      previousSubjects = prev;
      return prev.map(s => {
        if (s.id !== subjectId) return s;
        const filteredHistory = s.history.filter(log => log.date !== dateStr);
        const newLog = { id: `optimistic-${Date.now()}`, date: dateStr, status: optimisticStatus };
        const updatedHistory = [...filteredHistory, newLog];
        const updatedStats = calculateSubjectStats({ ...s, history: updatedHistory, target: s.target });
        return { ...s, history: updatedHistory, stats: updatedStats };
      });
    });

    // Step 1: Delete any existing log for this (subject_id, date) — no-op if none exists
    await supabase
      .from('attendance_logs')
      .delete()
      .eq('subject_id', subjectId)
      .eq('date', dateStr);

    // Step 2: Insert the fresh status
    const { error } = await supabase
      .from('attendance_logs')
      .insert([{ subject_id: subjectId, status: dbStatus, date: dateStr }]);

    if (error) {
      console.error('[markAttendance] insert error:', error);
      setSubjects(previousSubjects);
      addToast('Failed to save attendance. Please try again.', 'error');
    } else {
      fetchSubjects();
    }
  }, [selectedDate, fetchSubjects, addToast]);

  // ─── Reset all attendance for a subject ───
  const resetAttendance = useCallback(async (subject) => {
    if (!window.confirm(`Reset all attendance for "${subject.name}"? This cannot be undone.`)) return;

    setSubjects(prev => prev.map(s => {
      if (s.id !== subject.id) return s;
      const stats = calculateSubjectStats({ ...s, history: [], target: s.target });
      return { ...s, history: [], stats };
    }));

    const { error } = await supabase
      .from('attendance_logs')
      .delete()
      .eq('subject_id', subject.id);

    if (error) {
      addToast('Failed to reset attendance.', 'error');
      fetchSubjects();
    } else {
      addToast(`"${subject.name}" reset to 0.`, 'info');
    }
  }, [fetchSubjects, addToast]);

  // ─────────────────────────────────────────────────────────
  // OPTIMISTIC STATE MIRRORING — undoLast
  // ─────────────────────────────────────────────────────────
  const undoLast = useCallback(async (subject) => {
    if (!subject.history || subject.history.length === 0) return;
    // last item in history is index 0 (most recent) due to sort on fetch
    const lastLog = subject.history[0];
    if (!lastLog || lastLog.id.startsWith('optimistic-')) return;

    let previousSubjects;
    setSubjects(prev => {
      previousSubjects = prev;
      return prev.map(s => {
        if (s.id !== subject.id) return s;
        const updatedHistory = s.history.filter(l => l.id !== lastLog.id);
        const updatedStats = calculateSubjectStats({ ...s, history: updatedHistory, target: s.target });
        return { ...s, history: updatedHistory, stats: updatedStats };
      });
    });

    const { error } = await supabase.from('attendance_logs').delete().eq('id', lastLog.id);
    if (error) {
      setSubjects(previousSubjects);
      addToast('Failed to undo. Please try again.', 'error');
    } else {
      addToast('Last entry removed.', 'info');
      fetchSubjects();
    }
  }, [fetchSubjects, addToast]);

  const deleteSubject = useCallback(async (id) => {
    if (!window.confirm('Remove subject and ALL its attendance history?')) return;

    let previousSubjects;
    setSubjects(prev => {
      previousSubjects = prev;
      return prev.filter(s => s.id !== id);
    });

    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) {
      setSubjects(previousSubjects);
      addToast('Failed to delete subject.', 'error');
    } else {
      addToast('Subject deleted.', 'info');
      fetchSubjects();
    }
  }, [fetchSubjects, addToast]);

  // ─── Area 4: Bulk Mark All ───
  const markAll = useCallback(async (status) => {
    const dateStr = toDateStr(selectedDate);
    const dbStatus = status === 'p' ? 'present' : status === 'a' ? 'absent' : 'holiday';

    // Optimistic update
    setSubjects(prev => prev.map(s => {
      const filteredHistory = s.history.filter(log => log.date !== dateStr);
      const newLog = { id: `optimistic-${Date.now()}-${s.id}`, date: dateStr, status };
      const updatedHistory = [...filteredHistory, newLog];
      const updatedStats = calculateSubjectStats({ ...s, history: updatedHistory, target: s.target });
      return { ...s, history: updatedHistory, stats: updatedStats };
    }));

    // Delete-then-insert for each subject in parallel (no constraint dependency)
    const ops = subjects.map(async s => {
      await supabase.from('attendance_logs').delete()
        .eq('subject_id', s.id).eq('date', dateStr);
      return supabase.from('attendance_logs')
        .insert([{ subject_id: s.id, status: dbStatus, date: dateStr }]);
    });

    const results = await Promise.all(ops);
    const anyError = results.some(r => r.error);
    if (anyError) {
      addToast('Some updates failed. Please refresh.', 'error');
    } else {
      addToast(`All marked ${dbStatus}!`, 'success');
    }
    fetchSubjects();
  }, [subjects, selectedDate, fetchSubjects, addToast]);

  // ─── Memoized derived state ───
  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [subjects, searchQuery]);

  const overallStats = useMemo(() => {
    let totalP = 0, totalC = 0;
    subjects.forEach(s => {
      const validLogs = s.history.filter(h => h.status !== 'holiday');
      totalP += validLogs.filter(h => h.status === 'p').length;
      totalC += validLogs.length;
    });
    return totalC === 0 ? 0 : Math.round((totalP / totalC) * 100);
  }, [subjects]);

  // ─── FIX #2 + #3: Calendar logs — use normalized date strings ───
  const logsForDate = useMemo(() => {
    const dateStr = toDateStr(selectedDate);
    const isSunday = selectedDate.getDay() === 0;
    return subjects.map(subject => {
      // FIX #3: history is sorted desc; .find returns the LATEST log for this date
      const entry = subject.history.find(log => log.date === dateStr);
      const hasManualLog = !!entry;
      const effectiveStatus = entry ? entry.status : (isSunday ? 'holiday' : 'not marked');
      return {
        id: subject.id,
        name: subject.name,
        status: effectiveStatus,
        isSundayAuto: isSunday && !hasManualLog
      };
    });
  }, [subjects, selectedDate]);

  // ─── FIX #4: Calendar tile class based on attendance ───
  const getTileClassName = useCallback(({ date, view: calView }) => {
    if (calView !== 'month') return null;
    const dateStr = toDateStr(date);
    const classes = [];
    let hasMixed = false, allPresent = true, allAbsent = true, hasHoliday = false;

    subjects.forEach(s => {
      const entry = s.history.find(log => log.date === dateStr);
      if (!entry) { allPresent = false; allAbsent = false; hasMixed = true; return; }
      if (entry.status === 'p') { allAbsent = false; }
      if (entry.status === 'a') { allPresent = false; }
      if (entry.status === 'holiday') { hasHoliday = true; allPresent = false; allAbsent = false; }
    });

    if (subjects.length === 0) return null;
    if (hasHoliday && !hasMixed && allAbsent === false && allPresent === false) return 'tile--holiday';
    if (allPresent && !hasMixed) return 'tile--all-present';
    if (allAbsent && !hasMixed) return 'tile--all-absent';
    const hasAny = subjects.some(s => s.history.some(log => log.date === dateStr));
    if (hasAny) return 'tile--mixed';
    return null;
  }, [subjects]);

  // ─── Area 7: Analytics data ───
  const analyticsData = useMemo(() => {
    const barData = subjects.map((s, i) => ({
      name: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
      pct: s.stats?.percentage || 0,
      target: s.target,
      fill: COLORS[i % COLORS.length]
    }));

    // Weekly trend — last 7 days
    const today = new Date();
    const weekData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dateStr = toDateStr(d);
      let present = 0, absent = 0;
      subjects.forEach(s => {
        const log = s.history.find(l => l.date === dateStr);
        if (log?.status === 'p') present++;
        if (log?.status === 'a') absent++;
      });
      return {
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        Present: present,
        Absent: absent
      };
    });

    const dangerZone = subjects.filter(s => s.stats?.isCritical).sort((a, b) => a.stats.percentage - b.stats.percentage);

    return { barData, weekData, dangerZone };
  }, [subjects]);

  // ─── Stable callback refs for navigation ───
  const setViewDashboard = useCallback(() => setView('dashboard'), []);
  const setViewCalendar = useCallback(() => setView('calendar'), []);
  const setViewAnalytics = useCallback(() => setView('analytics'), []);
  const setViewSettings = useCallback(() => setView('settings'), []);
  const openModal = useCallback(() => { setEditSubject(null); setNewSub({ name: '', target: 75, color: COLORS[0] }); setIsModalOpen(true); }, []);
  const closeModal = useCallback(() => { setIsModalOpen(false); setEditSubject(null); }, []);

  const openEditModal = useCallback((subject) => {
    setEditSubject({ id: subject.id, name: subject.name, target: subject.target });
    setIsModalOpen(true);
  }, []);

  // ─── Pre-auth screens ───
  if (isResetting) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <ResetPasswordView onComplete={() => setIsResetting(false)} />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-6 flex-col gap-8">
      <h1 className="text-5xl font-black text-gradient-cyan-purple drop-shadow-lg">
        Attendance Pro
      </h1>
      <Auth />
    </div>
  );

  // ─── Main Dashboard ───
  return (
    <div className="ag-layout">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* ═══ FLOATING NAVIGATION — z-index: 100 ═══ */}
      <nav className="ag-nav">
        <NavButton icon={CalendarIcon} active={view === 'dashboard'} onClick={setViewDashboard} />
        <NavButton icon={TrendingUp} active={view === 'calendar'} onClick={setViewCalendar} />
        <NavButton icon={PieChartIcon} active={view === 'analytics'} onClick={setViewAnalytics} />
        <div className="ag-nav-divider"></div>
        <NavButton icon={SettingsIcon} active={view === 'settings'} onClick={setViewSettings} />
      </nav>

      <main className="max-w-7xl mx-auto p-6 pt-10">

        {/* ═══ DASHBOARD VIEW ═══ */}
        {view === 'dashboard' && (
          <div className="space-y-10 ag-animate-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">
                  Dashboard
                </h1>
                <p className="text-slate-400 font-medium text-lg">
                  Overall Attendance:{' '}
                  <span className="text-gradient-cyan-purple font-bold text-xl">
                    {overallStats}%
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-400 transition-colors" size={20} />
                  <input
                    type="text"
                    placeholder="Search subjects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all w-64 backdrop-blur-md"
                  />
                </div>
                <GlassButton variant="primary" onClick={openModal}>
                  <Plus size={20} /> <span className="hidden sm:inline">Add</span>
                </GlassButton>
              </div>
            </div>

            {/* ═══ ANTI-GRAVITY CARD GRID ═══ */}
            {loading ? (
              <div className="ag-grid">
                {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div className="ag-grid">
                {filteredSubjects.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
                    <PieChartIcon size={48} strokeWidth={1} />
                    <p className="font-medium text-lg">No subjects yet. Add one to get started!</p>
                  </div>
                )}
                {filteredSubjects.map(s => (
                  <SubjectCard
                    key={s.id}
                    subject={s}
                    onDelete={deleteSubject}
                    onEdit={openEditModal}
                    onReset={resetAttendance}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ CALENDAR VIEW — Optimistic State Mirroring ═══ */}
        {view === 'calendar' && (
          <div className="flex flex-col xl:flex-row gap-10 ag-animate-in">
            <div className="glass-panel p-8 rounded-[2rem] h-fit xl:w-1/2 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="relative z-10">
                {/* FIX #4: tileClassName for color-coded calendar tiles */}
                <Calendar
                  onChange={setSelectedDate}
                  value={selectedDate}
                  tileClassName={getTileClassName}
                />
                {/* Calendar legend */}
                <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-white/5">
                  <span className="calendar-legend calendar-legend--present">All Present</span>
                  <span className="calendar-legend calendar-legend--absent">All Absent</span>
                  <span className="calendar-legend calendar-legend--holiday">Holiday</span>
                  <span className="calendar-legend calendar-legend--mixed">Mixed</span>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-3xl font-black text-white">
                  Logs for {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </h2>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest border border-white/10 px-3 py-1 rounded-full">
                  {logsForDate.length} Subjects
                </div>
              </div>

              {/* ─── Area 4: Bulk Mark All buttons ─── */}
              {subjects.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => markAll('p')} className="bulk-btn bulk-btn--present">
                    <Check size={14} /> Mark All Present
                  </button>
                  <button onClick={() => markAll('a')} className="bulk-btn bulk-btn--absent">
                    <X size={14} /> Mark All Absent
                  </button>
                  <button onClick={() => markAll('holiday')} className="bulk-btn bulk-btn--holiday">
                    <Sun size={14} /> Mark All Holiday
                  </button>
                </div>
              )}

              {/* Sunday auto-detection banner */}
              {selectedDate.getDay() === 0 && (
                <div className="log-sunday-banner">
                  <Sun size={14} />
                  <span>Sunday — unmarked subjects default to <strong>Holiday</strong></span>
                </div>
              )}

              <div className="grid gap-4">
                  {logsForDate.map(log => (
                    <LogRow
                      key={log.id}
                      log={log}
                      onMarkAttendance={markAttendance}
                    />
                  ))}
                </div>
            </div>
          </div>
        )}

        {/* ═══ ANALYTICS VIEW — Area 7: Enhanced ═══ */}
        {view === 'analytics' && (
          <div className="space-y-8 ag-animate-in">
            <h2 className="text-3xl font-black text-white">
              Performance Analytics
            </h2>

            {subjects.length > 0 ? (
              <>
                {/* Bar chart — Subject % vs Target */}
                <GlassCard>
                  <h3 className="text-lg font-bold text-white mb-4">Attendance vs Target</h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.barData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.07)" />
                        <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} unit="%" />
                        <Tooltip
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc' }}
                          formatter={(value, name) => [`${value}%`, name === 'pct' ? 'Attendance' : 'Target']}
                        />
                        <Bar dataKey="pct" fill="url(#barGradient)" radius={[8, 8, 0, 0]} name="pct" />
                        <Bar dataKey="target" fill="rgba(255,255,255,0.08)" radius={[8, 8, 0, 0]} name="target" />
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00f2ea" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity={0.9} />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                {/* Weekly trend line chart */}
                <GlassCard>
                  <h3 className="text-lg font-bold text-white mb-4">Weekly Attendance Trend (Last 7 Days)</h3>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData.weekData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                        <XAxis dataKey="day" fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc' }}
                        />
                        <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', paddingTop: '12px' }} />
                        <Line type="monotone" dataKey="Present" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
                        <Line type="monotone" dataKey="Absent" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                {/* Subject summary table */}
                <GlassCard>
                  <h3 className="text-lg font-bold text-white mb-4">Subject-wise Summary</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-white/5">
                          <th className="pb-3 text-left font-semibold">Subject</th>
                          <th className="pb-3 text-center font-semibold">Present</th>
                          <th className="pb-3 text-center font-semibold">Absent</th>
                          <th className="pb-3 text-center font-semibold">Total</th>
                          <th className="pb-3 text-center font-semibold">%</th>
                          <th className="pb-3 text-center font-semibold">Target</th>
                          <th className="pb-3 text-center font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {subjects.map(s => (
                          <tr key={s.id} className="hover:bg-white/3 transition-colors">
                            <td className="py-3 font-medium text-white">{s.name}</td>
                            <td className="py-3 text-center text-emerald-400">{s.stats?.present || 0}</td>
                            <td className="py-3 text-center text-rose-400">{s.history.filter(h => h.status === 'a').length}</td>
                            <td className="py-3 text-center text-slate-400">{s.stats?.total || 0}</td>
                            <td className="py-3 text-center font-bold text-white">{s.stats?.percentage || 0}%</td>
                            <td className="py-3 text-center text-slate-400">{s.target}%</td>
                            <td className="py-3 text-center">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.stats?.isCritical ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                                {s.stats?.isCritical ? 'DANGER' : 'SAFE'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>

                {/* Danger zone */}
                {analyticsData.dangerZone.length > 0 && (
                  <GlassCard className="border border-rose-500/20">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertTriangle size={20} className="text-rose-400" />
                      <h3 className="text-lg font-bold text-rose-400">Danger Zone ({analyticsData.dangerZone.length})</h3>
                    </div>
                    <div className="space-y-3">
                      {analyticsData.dangerZone.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                          <span className="font-medium text-white">{s.name}</span>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-rose-400 font-bold">{s.stats?.percentage}%</span>
                            <span className="text-slate-500">/ {s.target}% target</span>
                            <span className="text-rose-300 text-xs">{s.stats?.actionText}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}
              </>
            ) : (
              <GlassCard className="flex items-center justify-center h-48">
                <p className="text-slate-500 font-medium">Add subjects to view analytics.</p>
              </GlassCard>
            )}
          </div>
        )}

        {/* ═══ SETTINGS VIEW ═══ */}
        {view === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8 ag-animate-in">
            <h2 className="text-3xl font-black text-white">
              Account Settings
            </h2>
            <GlassCard>
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-lg text-white">Session</h4>
                  <p className="text-sm text-slate-400">{user?.email}</p>
                </div>
                <button
                  onClick={async () => await supabase.auth.signOut()}
                  className="action-btn-touch action-btn-touch--absent p-3"
                  aria-label="Sign out"
                >
                  <LogOut size={20} />
                </button>
              </div>
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-lg text-white">Export Data</h4>
                  <p className="text-sm text-slate-400">Download your attendance report (.csv)</p>
                </div>
                <GlassButton onClick={downloadAttendanceCSV} variant="primary">
                  <Download size={20} /> CSV
                </GlassButton>
              </div>
            </GlassCard>
          </div>
        )}

      </main>

      {/* ═══ CREATE / EDIT SUBJECT MODAL ═══ */}
      {isModalOpen && (
        <div className="ag-modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <GlassCard className="w-full max-w-md !bg-[#0f172a]/90 !border-slate-800">
            <h3 className="text-2xl font-black mb-6 text-white">
              {editSubject ? 'Edit Subject' : 'Create Subject'}
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Subject Name</label>
                <input
                  type="text"
                  placeholder="e.g. Data Structures"
                  value={editSubject ? editSubject.name : newSub.name}
                  onChange={e => editSubject
                    ? setEditSubject({ ...editSubject, name: e.target.value })
                    : setNewSub({ ...newSub, name: e.target.value })
                  }
                  className="w-full p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Target Percentage (%)</label>
                <input
                  type="number"
                  placeholder="75"
                  value={editSubject ? editSubject.target : newSub.target}
                  onChange={e => editSubject
                    ? setEditSubject({ ...editSubject, target: e.target.value })
                    : setNewSub({ ...newSub, target: e.target.value })
                  }
                  className="w-full p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={closeModal}
                  className="flex-1 py-4 rounded-xl bg-slate-800 text-white font-bold active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={addSubject}
                  className="flex-1 py-4 rounded-xl glass-button-primary text-white font-bold active:scale-95 transition-transform"
                >
                  {editSubject ? 'Save Changes' : 'Save Subject'}
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default App;