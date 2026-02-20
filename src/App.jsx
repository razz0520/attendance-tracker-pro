// 1. Core Component Imports
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

// 2. Focused React Hooks
import React, { useState, useEffect, useMemo } from 'react';
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

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

import { calculateSubjectStats } from './utils/attendanceLogic';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ═══════════════════════════════════════════════════════════════
// ANTI-GRAVITY REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════

const GlassCard = ({ children, className = "" }) => (
  <div className={`glass-card ${className}`}>
    {children}
  </div>
);

const GlassButton = ({ children, onClick, className = "", variant = "secondary" }) => (
  <button
    onClick={onClick}
    className={`
      px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2
      ${variant === 'primary' ? 'glass-button-primary text-white' : 'glass-panel hover:bg-white/10 text-slate-200'}
      ${className}
    `}
  >
    {children}
  </button>
);

// ─── Navigation Button ───
const NavButton = ({ icon: Icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`ag-nav-btn ${active ? 'ag-nav-btn--active' : ''}`}
  >
    <Icon size={24} strokeWidth={active ? 2.5 : 2} />
  </button>
);

// ─── Anti-Gravity Subject Card ───
const SubjectCard = ({ subject, onMarkAttendance, onUndo, onDelete }) => {
  const { stats } = subject;
  const pct = stats?.percentage || 0;

  return (
    <div className="glass-card-precise flex flex-col min-h-[360px] relative group overflow-hidden ag-animate-in">
      {/* Card Header */}
      <div className="relative z-10 p-6 pb-2 flex justify-between items-start">
        <h3 className="font-bold text-xl text-white tracking-wide break-words w-4/5 leading-tight">
          {subject.name}
        </h3>
        <button
          onClick={() => onDelete(subject.id)}
          className="action-btn-touch action-btn-touch--undo p-2"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* ── HERO: Attendance Percentage Centerpiece ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-7xl font-black text-gradient-cyan-purple tracking-tighter leading-none">
          {pct}%
        </div>
        <p className={`status-badge mt-4 ${stats?.isCritical ? 'status-badge--critical' : 'status-badge--safe'}`}>
          {pct < subject.target ? 'Below Target' : 'On Track'}
        </p>
        {stats?.actionText && (
          <p className="text-xs text-slate-500 mt-2 text-center max-w-[200px] leading-relaxed">
            {stats.actionText}
          </p>
        )}
      </div>

      {/* ── DATA SPLIT ROW ── */}
      <div className="data-split-row relative z-10">
        <div className="data-split-metric">
          <span className="data-split-label">Attended</span>
          <span className="data-split-value">{stats?.present || 0}</span>
        </div>
        <div className="data-split-divider"></div>
        <div className="data-split-metric">
          <span className="data-split-label">Total Held</span>
          <span className="data-split-value data-split-value--muted">{stats?.total || 0}</span>
        </div>
      </div>

      {/* ── ACTION SUB-PANEL: Always Visible, Touch-Optimized ── */}
      <div className="action-subpanel relative z-10">
        <button
          onClick={() => onMarkAttendance(subject.id, 'p')}
          className="action-btn-touch action-btn-touch--present"
          aria-label="Mark present"
        >
          <Check size={20} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => onMarkAttendance(subject.id, 'a')}
          className="action-btn-touch action-btn-touch--absent"
          aria-label="Mark absent"
        >
          <X size={20} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => onUndo(subject)}
          className="action-btn-touch action-btn-touch--undo"
          aria-label="Undo last"
        >
          <RotateCcw size={18} strokeWidth={2.5} />
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
};

// ─── Calendar Log Action Button ───
const LogActionButton = ({ status, type, icon: IconComponent, onClick }) => {
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
};

// ─── Reset Password View ───
const ResetPasswordView = ({ onComplete }) => {
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
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
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

  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) setIsResetting(true);
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) fetchSubjects();
    };
    getSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchSubjects();
      else setSubjects([]);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('*, attendance_logs(*)');
    if (!error && data) {
      const transformedData = data.map(s => {
        const history = (s.attendance_logs || []).map(log => ({
          id: log.id,
          date: new Date(log.date).getTime(),
          status: log.status === 'present' ? 'p' : log.status === 'absent' ? 'a' : 'holiday'
        }));
        const stats = calculateSubjectStats({ ...s, history, target: s.target_percentage });
        return { ...s, target: s.target_percentage, history, stats };
      });
      setSubjects(transformedData);
    }
  };

  const downloadAttendanceCSV = () => {
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
  };

  const addSubject = async () => {
    if (!newSub.name.trim()) return;
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const { error } = await supabase.from('subjects').insert([{
      name: newSub.name, target_percentage: newSub.target, user_id: currentUser.id
    }]);
    if (!error) { fetchSubjects(); setIsModalOpen(false); setNewSub({ name: '', target: 75, color: COLORS[0] }); }
  };

  const markAttendance = async (subjectId, status) => {
    const dbStatus = status === 'p' ? 'present' : status === 'a' ? 'absent' : 'holiday';
    await supabase.from('attendance_logs').insert([{
      subject_id: subjectId, status: dbStatus, date: selectedDate.toISOString()
    }]);
    fetchSubjects();
  };

  const undoLast = async (subject) => {
    if (!subject.history || subject.history.length === 0) return;
    const lastLogId = subject.history[subject.history.length - 1].id;
    const { error } = await supabase.from('attendance_logs').delete().eq('id', lastLogId);
    if (!error) fetchSubjects();
  };

  const deleteSubject = async (id) => {
    if (window.confirm('Remove subject?')) {
      await supabase.from('subjects').delete().eq('id', id);
      fetchSubjects();
    }
  };

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

  const logsForDate = useMemo(() => {
    const isSunday = selectedDate.getDay() === 0;
    return subjects.map(subject => {
      const entry = subject.history.find(log => new Date(log.date).toDateString() === selectedDate.toDateString());
      const effectiveStatus = entry ? entry.status : (isSunday ? 'holiday' : 'not marked');
      return { id: subject.id, name: subject.name, status: effectiveStatus };
    });
  }, [subjects, selectedDate]);

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
      {/* ═══ FLOATING NAVIGATION — z-index: 100 ═══ */}
      <nav className="ag-nav">
        <NavButton icon={CalendarIcon} active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <NavButton icon={TrendingUp} active={view === 'calendar'} onClick={() => setView('calendar')} />
        <NavButton icon={PieChartIcon} active={view === 'analytics'} onClick={() => setView('analytics')} />
        <div className="ag-nav-divider"></div>
        <NavButton icon={SettingsIcon} active={view === 'settings'} onClick={() => setView('settings')} />
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
                <GlassButton variant="primary" onClick={() => setIsModalOpen(true)}>
                  <Plus size={20} /> <span className="hidden sm:inline">Add</span>
                </GlassButton>
              </div>
            </div>

            {/* ═══ ANTI-GRAVITY CARD GRID ═══ */}
            <div className="ag-grid">
              {filteredSubjects.map(s => (
                <SubjectCard
                  key={s.id}
                  subject={s}
                  onMarkAttendance={markAttendance}
                  onUndo={undoLast}
                  onDelete={deleteSubject}
                />
              ))}
            </div>
          </div>
        )}

        {/* ═══ CALENDAR VIEW ═══ */}
        {view === 'calendar' && (
          <div className="flex flex-col xl:flex-row gap-10 ag-animate-in">
            <div className="glass-panel p-8 rounded-[2rem] h-fit xl:w-1/2 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="relative z-10">
                <Calendar onChange={setSelectedDate} value={selectedDate} />
              </div>
            </div>

            <div className="flex-1 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black text-white">
                  Logs for {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </h2>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest border border-white/10 px-3 py-1 rounded-full">
                  {logsForDate.length} Subjects
                </div>
              </div>
              <div className="grid gap-4">
                {logsForDate.map(log => (
                  <div key={log.id} className="glass-card p-5 rounded-2xl flex justify-between items-center group hover:bg-white/10 transition-colors">
                    <span className="font-bold text-lg text-slate-200">{log.name}</span>
                    <div className="flex gap-2">
                      <LogActionButton status={log.status} type="p" icon={Check} onClick={() => markAttendance(log.id, 'p')} />
                      <LogActionButton status={log.status} type="a" icon={X} onClick={() => markAttendance(log.id, 'a')} />
                      <LogActionButton status={log.status} type="holiday" icon={SettingsIcon} onClick={() => markAttendance(log.id, 'h')} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ANALYTICS VIEW ═══ */}
        {view === 'analytics' && (
          <div className="space-y-8 ag-animate-in">
            <h2 className="text-3xl font-black text-white">
              Performance Analytics
            </h2>
            {subjects.length > 0 ? (
              <GlassCard className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjects.map(s => ({ name: s.name, pct: s.stats?.percentage || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc' }}
                    />
                    <Bar dataKey="pct" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00f2ea" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </GlassCard>
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

      {/* ═══ CREATE SUBJECT MODAL ═══ */}
      {isModalOpen && (
        <div className="ag-modal-overlay">
          <GlassCard className="w-full max-w-md !bg-[#0f172a]/90 !border-slate-800">
            <h3 className="text-2xl font-black mb-6 text-white">Create Subject</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Subject Name</label>
                <input
                  type="text"
                  placeholder="e.g. Data Structures"
                  value={newSub.name}
                  onChange={e => setNewSub({ ...newSub, name: e.target.value })}
                  className="w-full p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Target Percentage (%)</label>
                <input
                  type="number"
                  placeholder="75"
                  value={newSub.target}
                  onChange={e => setNewSub({ ...newSub, target: e.target.value })}
                  className="w-full p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 rounded-xl bg-slate-800 text-white font-bold active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={addSubject}
                  className="flex-1 py-4 rounded-xl glass-button-primary text-white font-bold active:scale-95 transition-transform"
                >
                  Save Subject
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