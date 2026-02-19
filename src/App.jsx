import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from "./lib/supabaseClient";
import Auth from './components/Auth';
import { Plus, Trash2, Check, X, RotateCcw, TrendingUp, Calendar as CalendarIcon, Settings as SettingsIcon, PieChart as PieChartIcon, Download, Search, LogOut, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- UTILS: Professional Logic ---
const calculateStats = (history, target) => {
  // Sundays are handled as holidays automatically
  const validLogs = history.filter(h => h.status !== 'holiday');
  const present = validLogs.filter(h => h.status === 'p').length;
  const total = validLogs.length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
  return { present, total, percentage, isCritical: percentage < target };
};

const App = () => {
  const [subjects, setSubjects] = useState([]);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newSub, setNewSub] = useState({ name: '', target: 75 });

  // --- DATA ENGINE: Realtime & Sync ---
  const fetchSubjects = useCallback(async () => {
    const { data, error } = await supabase.from('subjects').select('*, attendance_logs(*)');
    if (!error && data) {
      const processed = data.map(s => ({
        ...s,
        history: (s.attendance_logs || []).map(log => ({
          id: log.id,
          date: new Date(log.date).toDateString(),
          status: log.status === 'present' ? 'p' : log.status === 'absent' ? 'a' : 'holiday'
        })),
        target: s.target_percentage
      }));
      setSubjects(processed);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchSubjects();
    });
    const channel = supabase.channel('realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchSubjects())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSubjects]);

  // --- ANTI-LAG: Memoized Stats ---
  const subjectData = useMemo(() => {
    return subjects.map(s => ({
      ...s,
      stats: calculateStats(s.history, s.target)
    })).filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [subjects, searchQuery]);

  // --- ACTIONS: Optimized Callbacks ---
  const markAttendance = useCallback(async (subjectId, status) => {
    const dbStatus = status === 'p' ? 'present' : status === 'a' ? 'absent' : 'holiday';
    await supabase.from('attendance_logs').insert([{
      subject_id: subjectId, status: dbStatus, date: selectedDate.toISOString()
    }]);
  }, [selectedDate]);

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-[#0b0e14]"><Auth /></div>;

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-24 bg-[#0b0e14] text-slate-200">
      {/* Sidebar Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-6 md:top-1/2 md:-translate-y-1/2 md:w-20 z-50 flex md:flex-col items-center gap-4 p-4 glass-panel rounded-3xl border border-white/10 backdrop-blur-xl">
        <NavBtn icon={CalendarIcon} active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <NavBtn icon={TrendingUp} active={view === 'calendar'} onClick={() => setView('calendar')} />
        <NavBtn icon={PieChartIcon} active={view === 'analytics'} onClick={() => setView('analytics')} />
        <NavBtn icon={SettingsIcon} active={view === 'settings'} onClick={() => setView('settings')} />
      </nav>

      <main className="max-w-7xl mx-auto p-6 pt-12">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
              <h1 className="text-5xl font-black">Dashboard</h1>
              <button onClick={() => setIsModalOpen(true)} className="px-6 py-3 bg-indigo-600 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-500 transition-all"><Plus size={20} /> Add Subject</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {subjectData.map(s => (
                <div key={s.id} className="glass-card rounded-[2rem] p-6 relative overflow-hidden flex flex-col min-h-[350px] group border border-white/5 hover:border-indigo-500/40 transition-all duration-500">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-2xl font-bold">{s.name}</h3>
                    <button onClick={async () => { if(window.confirm('Delete?')) await supabase.from('subjects').delete().eq('id', s.id); }} className="text-slate-600 hover:text-red-400"><Trash2 size={20} /></button>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center">
                    <span className={`text-6xl font-black ${s.stats.isCritical ? 'text-red-400' : 'text-indigo-400'}`}>{s.stats.percentage}%</span>
                    <p className="text-[10px] uppercase font-bold tracking-widest mt-2 text-slate-500">Attendance</p>
                  </div>

                  {/* Metrics Split */}
                  <div className="grid grid-cols-2 border-t border-white/5 bg-black/20 mt-4 rounded-xl mb-4">
                    <div className="p-3 text-center border-r border-white/5">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Attended</p>
                      <p className="text-xl font-bold text-emerald-400">{s.stats.present}</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Total Held</p>
                      <p className="text-xl font-bold text-slate-200">{s.stats.total}</p>
                    </div>
                  </div>

                  {/* DASHBOARD ACTION BUTTONS */}
                  <div className="flex justify-center gap-3 py-2">
                    <button onClick={() => markAttendance(s.id, 'p')} className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"><Check size={20} /></button>
                    <button onClick={() => markAttendance(s.id, 'a')} className="p-3 bg-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><X size={20} /></button>
                    <button onClick={async () => { if(s.history.length > 0) await supabase.from('attendance_logs').delete().eq('id', s.history[s.history.length-1].id); }} className="p-3 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 hover:text-white transition-all"><RotateCcw size={20} /></button>
                  </div>

                  {/* Anti-Gravity Progress Bar */}
                  <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/5">
                    <div className={`h-full transition-all duration-1000 ${s.stats.isCritical ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-indigo-500 shadow-[0_0_10px_#6366f1]'}`} style={{ width: `${s.stats.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'calendar' && (
          <div className="flex flex-col lg:flex-row gap-10 animate-in slide-in-from-right duration-500">
            <div className="glass-panel p-8 rounded-[2.5rem] bg-white/5 border border-white/10 h-fit lg:w-1/2">
              <Calendar 
                onChange={setSelectedDate} 
                value={selectedDate} 
                className="bg-transparent border-none text-white w-full"
                tileClassName={({ date }) => date.getDay() === 0 ? 'text-amber-400 font-bold' : null} 
              />
            </div>
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl font-black">Logs for {selectedDate.toDateString()}</h2>
              <div className="space-y-4">
                {subjects.map(s => {
                  const log = s.history.find(h => h.date === selectedDate.toDateString());
                  const isSunday = selectedDate.getDay() === 0;
                  return (
                    <div key={s.id} className="p-5 glass-panel rounded-2xl flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors">
                      <span className="font-bold text-lg">{s.name}</span>
                      <div className="flex gap-3">
                        {/* COLOR CODED CALENDAR BUTTONS */}
                        <LogBtn active={log?.status === 'p'} color="emerald" icon={Check} onClick={() => markAttendance(s.id, 'p')} />
                        <LogBtn active={log?.status === 'a'} color="rose" icon={X} onClick={() => markAttendance(s.id, 'a')} />
                        <LogBtn active={log?.status === 'holiday' || (isSunday && !log)} color="amber" icon={SettingsIcon} onClick={() => markAttendance(s.id, 'h')} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// Sub-components
const NavBtn = ({ icon: Icon, active, onClick }) => (
  <button onClick={onClick} className={`p-4 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
    <Icon size={24} />
  </button>
);

const LogBtn = ({ active, color, icon: Icon, onClick }) => {
  const colors = { 
    emerald: active ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20',
    rose: active ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20',
    amber: active ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
  };
  return (
    <button onClick={onClick} className={`p-3 rounded-xl transition-all ${colors[color]}`}>
      <Icon size={20} />
    </button>
  );
};

export default App;