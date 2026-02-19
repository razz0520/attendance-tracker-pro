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

// Reusable Glass Components
const GlassCard = ({ children, className = "" }) => (
  <div className={`glass-card rounded-[2rem] p-6 ${className}`}>
    {children}
  </div>
);

const GlassButton = ({ children, onClick, className = "", variant = "secondary" }) => (
  <button
    onClick={onClick}
    className={`
      px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
      ${variant === 'primary' ? 'glass-button-primary text-white' : 'glass-panel hover:bg-white/10 text-slate-200'}
      ${className}
    `}
  >
    {children}
  </button>
);

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
      <h2 className="text-2xl font-black mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Secure New Password</h2>
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

    // REALTIME SUBSCRIPTION
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => fetchSubjects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects' }, () => fetchSubjects())
      .subscribe();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchSubjects();
      else setSubjects([]);
    });

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
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
        // Stats logic automatically ignores holidays for the denominator
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
    if (!error) { setIsModalOpen(false); setNewSub({ name: '', target: 75, color: COLORS[0] }); }
  };

  const markAttendance = async (subjectId, status) => {
    const dbStatus = status === 'p' ? 'present' : status === 'a' ? 'absent' : 'holiday';
    await supabase.from('attendance_logs').insert([{
      subject_id: subjectId, status: dbStatus, date: selectedDate.toISOString()
    }]);
  };

  const undoLast = async (subject) => {
    if (!subject.history || subject.history.length === 0) return;
    const lastLogId = subject.history[subject.history.length - 1].id;
    await supabase.from('attendance_logs').delete().eq('id', lastLogId);
  };

  const deleteSubject = async (id) => {
    if (window.confirm('Remove subject?')) {
      await supabase.from('subjects').delete().eq('id', id);
    }
  };

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [subjects, searchQuery]);

  const overallStats = useMemo(() => {
    let totalP = 0, totalC = 0;
    subjects.forEach(s => {
      totalP += s.stats?.present || 0;
      totalC += s.stats?.total || 0;
    });
    return totalC === 0 ? 0 : Math.round((totalP / totalC) * 100);
  }, [subjects]);

  const logsForDate = useMemo(() => {
    return subjects.map(subject => {
      const entry = subject.history.find(log => new Date(log.date).toDateString() === selectedDate.toDateString());
      return { id: subject.id, name: subject.name, status: entry ? entry.status : 'not marked' };
    });
  }, [subjects, selectedDate]);

  if (isResetting) return <div className="min-h-screen flex items-center justify-center p-6"><ResetPasswordView onComplete={() => setIsResetting(false)} /></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center p-6 flex-col gap-8 bg-[#0b0e14]"><h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 drop-shadow-lg">Attendance Pro</h1><Auth /></div>;

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-24 transition-all duration-500 bg-[#0b0e14]">
      {/* Floating Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-6 md:top-1/2 md:-translate-y-1/2 md:w-20 z-50 flex md:flex-col items-center justify-between gap-2 p-3 glass-panel rounded-full md:rounded-3xl border border-white/10 shadow-2xl">
        <NavButton icon={CalendarIcon} active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <NavButton icon={TrendingUp} active={view === 'calendar'} onClick={() => setView('calendar')} />
        <NavButton icon={PieChartIcon} active={view === 'analytics'} onClick={() => setView('analytics')} />
        <div className="hidden md:block w-8 h-[1px] bg-white/10 my-2"></div>
        <NavButton icon={SettingsIcon} active={view === 'settings'} onClick={() => setView('settings')} />
      </nav>

      <main className="max-w-7xl mx-auto p-6 pt-12">
        {view === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">Dashboard</h1>
                <p className="text-slate-400 font-medium text-lg">Overall Attendance: <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 font-bold text-xl">{overallStats}%</span></p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search subjects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all w-64 backdrop-blur-md"
                  />
                </div>
                <GlassButton variant="primary" onClick={() => setIsModalOpen(true)}>
                  <Plus size={20} /> <span className="hidden sm:inline">Add</span>
                </GlassButton>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredSubjects.map(s => {
                const attended = s.stats?.present || 0;
                const totalHeld = s.stats?.total || 0;
                const percentage = s.stats?.percentage || 0;

                return (
                  <div key={s.id} className="glass-card-high-fidelity rounded-[2rem] p-0 flex flex-col h-[340px] group relative overflow-hidden transition-all duration-500 hover:-translate-y-2">
                    {/* Glowing Accent */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-cyan-500 to-purple-500 opacity-30 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="flex justify-between items-start p-6 pb-2 relative z-10">
                      <h3 className="font-bold text-2xl text-white tracking-wide">{s.name}</h3>
                      <button onClick={() => deleteSubject(s.id)} className="text-slate-500 hover:text-red-400 transition-colors p-2 hover:bg-white/5 rounded-full"><Trash2 size={18} /></button>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                      <div className={`text-6xl font-black ${s.stats?.isCritical ? 'text-red-400' : 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400'} tracking-tighter`}>
                        {percentage}%
                      </div>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mt-1 ${s.stats?.isCritical ? 'text-red-400 animate-pulse' : 'text-slate-500'}`}>
                        {s.stats?.actionText}
                      </p>
                    </div>

                    {/* Metric Row: Attended vs Total */}
                    <div className="grid grid-cols-2 border-t border-white/5 bg-black/20 backdrop-blur-sm relative z-10">
                      <div className="p-4 flex flex-col items-center border-r border-white/10">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Attended</span>
                        <span className="text-xl font-bold text-emerald-400">{attended}</span>
                      </div>
                      <div className="p-4 flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Held</span>
                        <span className="text-xl font-bold text-slate-200">{totalHeld}</span>
                      </div>
                    </div>

                    {/* Hover Actions */}
                    <div className="absolute inset-x-0 bottom-[100px] flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0 z-20 pointer-events-none group-hover:pointer-events-auto">
                      <ActionButton color="emerald" icon={Check} onClick={() => markAttendance(s.id, 'p')} />
                      <ActionButton color="rose" icon={X} onClick={() => markAttendance(s.id, 'a')} />
                      <ActionButton color="slate" icon={RotateCcw} onClick={() => undoLast(s)} />
                    </div>

                    {/* Anti-Gravity Progress Bar */}
                    <div className="h-1.5 w-full bg-white/5 relative">
                      <div
                        className={`h-full transition-all duration-1000 ease-out ${s.stats?.isCritical ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-gradient-to-r from-indigo-500 to-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.3)]'}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'calendar' && (
          <div className="flex flex-col xl:flex-row gap-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="glass-panel p-8 rounded-[2rem] h-fit xl:w-1/2 shadow-2xl relative overflow-hidden bg-white/5 border border-white/10">
              <Calendar onChange={setSelectedDate} value={selectedDate} className="mx-auto" />
            </div>

            <div className="flex-1 space-y-6">
              <h2 className="text-3xl font-black text-white">Logs for {selectedDate.toLocaleDateString()}</h2>
              <div className="grid gap-4">
                {logsForDate.map(log => (
                  <div key={log.id} className="glass-card p-5 rounded-2xl flex justify-between items-center group hover:bg-white/10 transition-colors">
                    <span className="font-bold text-lg text-slate-200">{log.name}</span>
                    <div className="flex gap-2">
                      <LogActionButton status={log.status} type="p" icon={Check} onClick={() => markAttendance(log.id, 'p')} />
                      <LogActionButton status={log.status} type="a" icon={X} onClick={() => markAttendance(log.id, 'a')} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'analytics' && (
          <div className="space-y-8 animate-in zoom-in-95 duration-700">
            <h2 className="text-3xl font-black text-white">Performance Analytics</h2>
            <GlassCard className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjects.map(s => ({ name: s.name, pct: s.stats?.percentage || 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" />
                  <YAxis fontSize={12} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                  <Bar dataKey="pct" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <h2 className="text-3xl font-black text-white">Account Settings</h2>
            <GlassCard>
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div><h4 className="font-bold text-lg text-white">Session</h4><p className="text-sm text-slate-400">{user?.email}</p></div>
                <button onClick={async () => await supabase.auth.signOut()} className="p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"><LogOut size={20} /></button>
              </div>
              <div className="p-6 flex items-center justify-between">
                <div><h4 className="font-bold text-lg text-white">Export Data</h4><p className="text-sm text-slate-400">Download .csv report</p></div>
                <GlassButton onClick={downloadAttendanceCSV} variant="primary"><Download size={20} /> CSV</GlassButton>
              </div>
            </GlassCard>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <GlassCard className="w-full max-w-md bg-[#0f172a] border-slate-800">
            <h3 className="text-2xl font-black mb-6 text-white">Create Subject</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Subject Name" value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} className="w-full p-4 rounded-xl bg-slate-800 text-white outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="number" placeholder="Target %" value={newSub.target} onChange={e => setNewSub({ ...newSub, target: e.target.value })} className="w-full p-4 rounded-xl bg-slate-800 text-white outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-xl bg-slate-800 text-white font-bold">Cancel</button>
                <button onClick={addSubject} className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/50">Save</button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

// Sub-components
const NavButton = ({ icon: Icon, active, onClick }) => (
  <button onClick={onClick} className={`p-3.5 rounded-2xl transition-all relative ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
    <Icon size={24} />
  </button>
);

const ActionButton = ({ color, icon: Icon, onClick }) => {
  const styles = {
    emerald: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
    rose: "bg-rose-500 text-white shadow-lg shadow-rose-500/30",
    slate: "bg-slate-700 text-slate-200"
  };
  return (
    <button onClick={onClick} className={`p-3 rounded-xl transition-all hover:scale-110 ${styles[color]}`}>
      <Icon size={20} strokeWidth={3} />
    </button>
  );
};

const LogActionButton = ({ status, type, icon: Icon, onClick }) => (
  <button onClick={onClick} className={`p-2 rounded-lg transition-all ${status === type ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500'}`}>
    <Icon size={16} />
  </button>
);

export default App;