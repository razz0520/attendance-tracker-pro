import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

// ─── Memoized Liquid-Glass Subject Card ───
const SubjectCard = memo(({ subject, onDelete, onEdit, onUndo, onMark }) => {
  const { stats } = subject;
  const pct = stats?.percentage || 0;
  const isCritical = stats?.isCritical;
  const needMore = isCritical ? (stats?.missing || 0) : 0;
  const cardRef = useRef(null);
  const rippleTimeoutRef = useRef(null);

  // ── Cursor-Tracked Spotlight ──
  const handleMouseMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty('--mouse-x', `50%`);
    card.style.setProperty('--mouse-y', `50%`);
  }, []);

  // ── Pulse Glow Feedback (replaces janky snap) ──
  const triggerPulseGlow = useCallback((type) => {
    const card = cardRef.current;
    if (!card) return;
    const flashClass = type === 'p' ? 'card--flash-present' : 'card--flash-absent';
    // Remove any existing flash/ripple
    card.classList.remove('card--flash-present', 'card--flash-absent', 'card--ripple-present', 'card--ripple-absent');
    // Force reflow so re-adding the class restarts the animation
    void card.offsetWidth;
    // Apply border flash + ripple
    card.classList.add(flashClass);
    card.classList.add(type === 'p' ? 'card--ripple-present' : 'card--ripple-absent');
    clearTimeout(rippleTimeoutRef.current);
    rippleTimeoutRef.current = setTimeout(() => {
      card.classList.remove(flashClass, 'card--ripple-present', 'card--ripple-absent');
    }, 600);
  }, []);

  const handleMarkPresent = useCallback(() => {
    triggerPulseGlow('p');
    onMark(subject.id, 'p');
  }, [subject.id, onMark, triggerPulseGlow]);

  const handleMarkAbsent = useCallback(() => {
    triggerPulseGlow('a');
    onMark(subject.id, 'a');
  }, [subject.id, onMark, triggerPulseGlow]);

  return (
    <div
      ref={cardRef}
      className={`liquid-glass-card ag-animate-in${isCritical ? ' card--critical' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ '--mouse-x': '50%', '--mouse-y': '50%' }}
    >
      {/* ── Layer 1: Inner Reflection (top-left light band) ── */}
      <div className="lg-reflection" aria-hidden="true" />
      {/* ── Layer 2: Cursor Spotlight ── */}
      <div className="lg-spotlight" aria-hidden="true" />
      {/* ── Ripple overlay ── */}
      <div className="lg-ripple" aria-hidden="true" />

      {/* Card Header */}
      <div className="lg-header">
        <h3 className="lg-title">
          {subject.name}
        </h3>
        <div className="lg-header-actions">
          <button onClick={() => onEdit(subject)} className="lg-icon-btn" aria-label="Edit subject">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(subject.id)} className="lg-icon-btn lg-icon-btn--danger" aria-label="Delete subject">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* ── HERO: Big % with circular ring ── */}
      <div className="lg-hero">
        <div className="lg-ring-container">
          <svg className="lg-progress-ring" viewBox="0 0 120 120">
            <circle className="lg-ring-track" cx="60" cy="60" r="52" />
            <circle
              className={`lg-ring-fill ${isCritical ? 'lg-ring-fill--critical' : ''}`}
              cx="60" cy="60" r="52"
              style={{ strokeDashoffset: 326.73 - (326.73 * pct / 100) }}
            />
          </svg>
          <div className="lg-pct-value">
            {pct}<span className="lg-pct-symbol">%</span>
          </div>
        </div>
        <p className={`lg-status ${isCritical ? 'lg-status--critical' : 'lg-status--safe'}`}>
          {pct < subject.target ? `Need ${subject.target}%` : 'On Track'}
        </p>
      </div>

      {/* ── Stats Row ── */}
      <div className="lg-stats-row">
        <div className="lg-stat">
          <span className="lg-stat-value lg-stat-value--green">{stats?.present || 0}</span>
          <span className="lg-stat-label">Present</span>
        </div>
        <div className="lg-stat-divider" />
        <div className="lg-stat">
          <span className="lg-stat-value">{stats?.total || 0}</span>
          <span className="lg-stat-label">Total</span>
        </div>
      </div>

      {/* ── CRITICAL BANNER ── */}
      {isCritical && needMore > 0 && (
        <div className="lg-critical-banner">
          <AlertTriangle size={11} />
          <span>Attend <strong>{needMore}</strong> more to hit {subject.target}%</span>
        </div>
      )}

      {/* ── Orbital Action Controls ── */}
      <div className="lg-controls">
        <button
          onClick={handleMarkPresent}
          className="lg-action-btn lg-action-btn--present"
          aria-label="Mark present"
        >
          <Check size={18} strokeWidth={2.5} />
          <span className="lg-action-label">Present</span>
        </button>
        <button
          onClick={handleMarkAbsent}
          className="lg-action-btn lg-action-btn--absent"
          aria-label="Mark absent"
        >
          <X size={18} strokeWidth={2.5} />
          <span className="lg-action-label">Absent</span>
        </button>
        <button
          onClick={() => onUndo(subject)}
          className="lg-action-btn lg-action-btn--undo"
          aria-label="Undo last"
        >
          <RotateCcw size={14} strokeWidth={2} />
        </button>
      </div>

      {/* ── Bottom Edge Glow ── */}
      <div className="lg-edge-glow">
        <div
          className={`lg-edge-fill ${isCritical ? 'lg-edge-fill--critical' : ''}`}
          style={{ width: `${pct}%` }}
        />
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

  const [editSubject, setEditSubject] = useState(null); // null = new, object = edit mode
  const isFetching = useRef(false);

  // ─── Toast helpers ───
  const addToast = useCallback((message, type = 'success') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fetchSubjects = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }

      let { data, error } = await supabase
        .from('subjects')
        .select('*, attendance_logs(*)')
        .eq('user_id', currentUser.id);

      if (error) {
        console.warn('[App] Primary fetch (nested join) failed, trying fallback:', error);
        
        // Fallback: Query subjects by user_id first
        const { data: subData, error: subError } = await supabase
          .from('subjects')
          .select('*')
          .eq('user_id', currentUser.id);

        if (subError) {
          console.error('[App] fetchSubjects error:', subError);
          addToast(`Failed to load subjects: ${subError.message || subError}`, 'error');
          return;
        }

        if (subData) {
          const subjectIds = subData.map(s => s.id);
          let logs = [];
          if (subjectIds.length > 0) {
            const { data: logData, error: logError } = await supabase
              .from('attendance_logs')
              .select('*')
              .in('subject_id', subjectIds);
            if (!logError && logData) {
              logs = logData;
            }
          }
          data = subData.map(s => ({
            ...s,
            attendance_logs: logs.filter(l => l.subject_id === s.id)
          }));
          error = null;
        }
      }

      if (data) {
        const transformedData = data.map(s => {
          const sortedLogs = [...(s.attendance_logs || [])].sort(
            (a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date)
          );
          const history = sortedLogs.map(log => ({
            id: log.id,
            date: toDateStr(log.date),
            status: log.status === 'present' ? 'p' : log.status === 'absent' ? 'a' : 'holiday'
          }));
          const stats = calculateSubjectStats({ ...s, history, target: s.target_percentage });
          return { ...s, target: s.target_percentage, history, stats };
        });
        setSubjects(transformedData);
      }
    } catch (err) {
      console.error('[App] fetchSubjects err:', err);
      addToast(`Error loading subjects: ${err.message || err}`, 'error');
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    let mounted = true;
    if (window.location.hash.includes('type=recovery')) setIsResetting(true);

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        fetchSubjects();
      } else {
        setLoading(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetting(true);
      }
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        fetchSubjects();
      } else {
        setSubjects([]);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchSubjects]);

  const exportToPDF = useCallback(() => {
    const doc = new jsPDF();
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();

    // 1. Header & Title
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241); // Indigo
    doc.text("Attendance Tracker Pro", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${dateStr} at ${timeStr}`, 14, 28);
    doc.text(`User: ${user?.email || 'Anonymous'}`, 14, 33);

    // 2. Summary Table
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("Subject Summary", 14, 45);

    const summaryData = subjects.map(s => {
      const stats = s.stats || calculateSubjectStats(s);
      return [
        s.name,
        `${s.target}%`,
        stats.present,
        s.history.filter(h => h.status === 'a').length,
        s.history.filter(h => h.status === 'holiday').length,
        stats.total,
        `${stats.percentage}%`,
        stats.isCritical ? "DANGER" : "SAFE"
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [["Subject", "Target", "Present", "Absent", "Holidays", "Total", "Current", "Status"]],
      body: summaryData,
      headStyles: { fillColor: [99, 102, 241] },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      styles: { fontSize: 9 },
      columnStyles: { 7: { fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) {
          if (data.cell.raw === 'DANGER') data.cell.styles.textColor = [239, 68, 68];
          else data.cell.styles.textColor = [16, 185, 129];
        }
      }
    });

    // 3. Daily History Table
    let nextY = 150;
    if (doc.lastAutoTable) {
        nextY = doc.lastAutoTable.finalY + 15;
    }
    
    doc.setFontSize(16);
    doc.text("Daily Attendance History", 14, nextY);

    const dailyLogs = [];
    subjects.forEach(s => {
      s.history.forEach(log => {
        dailyLogs.push({
          date: log.date,
          subject: s.name,
          status: log.status === 'p' ? 'Present' : log.status === 'a' ? 'Absent' : 'Holiday',
          statusRaw: log.status
        });
      });
    });

    dailyLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    autoTable(doc, {
      startY: nextY + 5,
      head: [["Date", "Subject", "Status"]],
      body: dailyLogs.map(log => [log.date, log.subject, log.status]),
      headStyles: { fillColor: [100, 116, 139] },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      margin: { bottom: 20 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const status = dailyLogs[data.row.index].statusRaw;
          if (status === 'p') data.cell.styles.textColor = [16, 185, 129];
          else if (status === 'a') data.cell.styles.textColor = [239, 68, 68];
          else if (status === 'holiday') data.cell.styles.textColor = [245, 158, 11];
        }
      }
    });

    // Page Numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    doc.save(`Attendance_Report_${dateStr}.pdf`);
    addToast('PDF Report generated!', 'success');
  }, [subjects, user, addToast]);

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
  // markAttendance — delete-then-insert (works with or without unique constraint)
  // overrideDate: pass new Date() from dashboard to mark today; undefined = use selectedDate (calendar)
  // ─────────────────────────────────────────────────────────
  const markAttendance = useCallback(async (subjectId, status, overrideDate) => {
    const dbStatus = status === 'p' ? 'present' : status === 'a' ? 'absent' : 'holiday';
    const optimisticStatus = status === 'p' ? 'p' : status === 'a' ? 'a' : 'holiday';
    const dateStr = toDateStr(overrideDate ?? selectedDate);

    // Optimistic update — instantly reflect in UI
    let previousSubjects;
    setSubjects(prev => {
      previousSubjects = prev;
      return prev.map(s => {
        if (s.id !== subjectId) return s;
    if (!overrideDate) {
        // CALENDAR: remove the existing log for this date so we replace it
        const filteredHistory = s.history.filter(log => log.date !== dateStr);
        const newLog = { id: `optimistic-${Date.now()}`, date: dateStr, status: optimisticStatus };
        const updatedHistory = [...filteredHistory, newLog];
        const updatedStats = calculateSubjectStats({ ...s, history: updatedHistory, target: s.target });
        return { ...s, history: updatedHistory, stats: updatedStats };
      } else {
        // DASHBOARD: append a new session entry
        const newLog = { id: `optimistic-${Date.now()}`, date: dateStr, status: optimisticStatus };
        const updatedHistory = [...s.history, newLog];
        const updatedStats = calculateSubjectStats({ ...s, history: updatedHistory, target: s.target });
        return { ...s, history: updatedHistory, stats: updatedStats };
      }
      });
    });

    if (!overrideDate) {
      // CALENDAR MODE: delete existing log for this date, then insert (replace semantics)
      await supabase
        .from('attendance_logs')
        .delete()
        .eq('subject_id', subjectId)
        .eq('date', dateStr);
    }
    // DASHBOARD MODE: no delete — just append a new entry (multi-session per day)

    // Insert fresh status
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
      {/* Hidden SVG gradient defs for progress rings */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="lg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f2ea" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
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
                    onUndo={undoLast}
                    onMark={(subjectId, status) => markAttendance(subjectId, status, new Date())}
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
                  <p className="text-sm text-slate-400">Download your full attendance report (.pdf)</p>
                </div>
                <GlassButton onClick={exportToPDF} variant="primary">
                  <Download size={20} /> PDF
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