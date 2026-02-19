import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from "./lib/supabaseClient";
import Auth from './components/Auth';
import { Plus, Trash2, Check, X, RotateCcw, TrendingUp, Calendar as CalendarIcon, Settings as SettingsIcon, PieChart as PieChartIcon, Download, Search, LogOut, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Logic: Pure function to calculate stats correctly
const calculateStats = (history, target) => {
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

  // --- DATA ENGINE: Optimized Fetching ---
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
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        if (!document.hidden) fetchSubjects();
      })
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

  // --- OPTIMISTIC UI: Instant Feedback ---
  const markAttendance = useCallback(async (subjectId, status) => {
    const statusMap = { p: 'present', a: 'absent', h: 'holiday' };
    const dateStr = selectedDate.toDateString();

    // Instant local update
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, history: [...s.history.filter(h => h.date !== dateStr), { date: dateStr, status }] };
    }));

    // Background sync
    await supabase.from('attendance_logs').insert([{
      subject_id: subjectId, status: statusMap[status], date: selectedDate.toISOString()
    }]);
  }, [selectedDate]);

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-[#0b0e14]"><Auth /></div>;

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-24 bg-[#0b0e14] text-slate-200">
      {/* Navigation */}
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
              {/* RESTORED ADD SUBJECT BUTTON */}
              <button onClick={() => setIsModalOpen(true)} className="px-6 py-3 bg-indigo-600 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-500 transition-all">
                <Plus size={20} /> Add Subject
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {subjectData.map(s => (
                <div key={s.id} className="glass-card-perf flex flex-col justify-between min-h-[320px] group">
                  {/* Top: Header */}
                  <div className="p-6 flex justify-between items-start">
                    <h3 className="text-xl font-bold text-white tracking-wide">{s.name}</h3>
                    <button
                      onClick={async () => { if (window.confirm('Delete?')) await supabase.from('subjects').delete().eq('id', s.id); }}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Middle: Stats */}
                  <div className="flex-1 flex flex-col items-center justify-center -mt-4">
                    <span className="text-7xl font-black text-gradient-cyan-purple tracking-tighter">
                      {s.stats.percentage}%
                    </span>

                    {s.stats.total === 0 ? (
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">No Classes Recorded</p>
                    ) : (
                      <div className="flex items-center gap-4 mt-2">
                        <div className="text-center">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Attended</span>
                          <span className="text-lg font-bold text-emerald-400">{s.stats.present}</span>
                        </div>
                        <div className="h-6 w-[1px] bg-white/10"></div>
                        <div className="text-center">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Total</span>
                          <span className="text-lg font-bold text-white">{s.stats.total}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom: Sub-Panel Actions */}
                  <div className="sub-panel p-4 flex items-center justify-between gap-4 mt-auto">
                    <div className="flex gap-2 w-full justify-center">
                      <button
                        onClick={() => markAttendance(s.id, 'p')}
                        className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all active:scale-95"
                      >
                        <Check size={20} />
                      </button>
                      <button
                        onClick={() => markAttendance(s.id, 'a')}
                        className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white hover:shadow-[0_0_15px_rgba(244,63,94,0.5)] transition-all active:scale-95"
                      >
                        <X size={20} />
                      </button>
                      <button
                        onClick={() => undoLast(s)}
                        className="p-3 bg-slate-500/10 text-slate-400 rounded-xl hover:bg-slate-600 hover:text-white transition-all active:scale-95"
                      >
                        <RotateCcw size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar (Integrated into bottom or just above sub-panel? 
                      Design asks for 'pinned to the very bottom', but sub-panel is at bottom. 
                      I'll put it at the very bottom of the card container, effectively bordering the sub-panel or inside it.
                      Actually, a nice touch is putting it at the TOP of the sub-panel (border-top).
                   */}
                  <div
                    className={`h-[2px] w-full absolute bottom-0 left-0 transition-all duration-500 ${s.stats.isCritical ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-cyan-500 shadow-[0_0_10px_cyan]'}`}
                    style={{ width: `${s.stats.percentage}%` }}
                  />
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

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
          <div className="glass-panel p-10 rounded-[2.5rem] w-full max-w-md bg-[#161b22] border border-white/10 shadow-2xl">
            <h2 className="text-3xl font-black mb-8">New Subject</h2>
            <div className="space-y-6">
              <input type="text" className="w-full p-4 rounded-xl bg-white/5 border border-white/10 outline-none" placeholder="Subject Name" onChange={e => setNewSub({ ...newSub, name: e.target.value })} />
              <input type="number" className="w-full p-4 rounded-xl bg-white/5 border border-white/10 outline-none" placeholder="Target %" onChange={e => setNewSub({ ...newSub, target: e.target.value })} />
              <div className="flex gap-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 p-4 rounded-xl bg-white/5 font-bold">Cancel</button>
                <button onClick={async () => {
                  if (!newSub.name) return;
                  const { data: { user } } = await supabase.auth.getUser();
                  await supabase.from('subjects').insert([{ name: newSub.name, target_percentage: newSub.target, user_id: user.id }]);
                  setIsModalOpen(false);
                }} className="flex-1 p-4 rounded-xl bg-indigo-600 font-bold">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavBtn = ({ icon: Icon, active, onClick }) => (
  <button onClick={onClick} className={`p-4 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
    <Icon size={24} />
  </button>
);

const LogBtn = ({ active, color, icon: Icon, onClick }) => {
  const colors = {
    emerald: active ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-emerald-500/10 text-emerald-500',
    rose: active ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-rose-500/10 text-rose-500',
    amber: active ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-amber-500/10 text-amber-500'
  };
  return (
    <button onClick={onClick} className={`p-3 rounded-xl transition-all ${colors[color]}`}>
      <Icon size={20} />
    </button>
  );
};

export default App;