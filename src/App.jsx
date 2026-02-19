import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from "./lib/supabaseClient";
import Auth from './components/Auth';
import { 
  Plus, Trash2, Check, X, RotateCcw, TrendingUp, AlertTriangle,
  Calendar as CalendarIcon, Settings as SettingsIcon, 
  PieChart as PieChartIcon, Download, Search, LogOut 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

// --- Professional Logic Layer: Centralized Calculation ---
const calculateStats = (history, target) => {
  const validLogs = history.filter(h => h.status !== 'holiday'); 
  const present = validLogs.filter(h => h.status === 'p').length;
  const total = validLogs.length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
  const isCritical = percentage < target;
  const margin = percentage - target; 
  return { present, total, percentage, isCritical, margin };
};

const App = () => {
  const [subjects, setSubjects] = useState([]);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newSub, setNewSub] = useState({ name: '', target: 75 });

  // --- Data Engine: Fetch & Realtime ---
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

    const channel = supabase.channel('realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchSubjects())
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
  }, [fetchSubjects]);

  // --- Analytics & Insights ---
  const subjectData = useMemo(() => {
    return subjects.map(s => ({
      ...s,
      stats: calculateStats(s.history, s.target)
    })).filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [subjects, searchQuery]);

  const criticalSubject = useMemo(() => {
    if (subjectData.length === 0) return null;
    return [...subjectData].sort((a, b) => a.stats.margin - b.stats.margin)[0];
  }, [subjectData]);

  const overallStats = useMemo(() => {
    const totalP = subjectData.reduce((acc, s) => acc + s.stats.present, 0);
    const totalC = subjectData.reduce((acc, s) => acc + s.stats.total, 0);
    return totalC === 0 ? 0 : Math.round((totalP / totalC) * 100);
  }, [subjectData]);

  // --- Handlers ---
  const markAttendance = async (subjectId, status) => {
    const dbStatus = status === 'p' ? 'present' : status === 'a' ? 'absent' : 'holiday';
    await supabase.from('attendance_logs').insert([{
      subject_id: subjectId, status: dbStatus, date: selectedDate.toISOString()
    }]);
  };

  const deleteSubject = async (id) => {
    if (window.confirm('Remove subject?')) await supabase.from('subjects').delete().eq('id', id);
  };

  const downloadCSV = () => {
    const header = "Subject,Present,Total Held,Percentage,Status\n";
    const rows = subjectData.map(s => 
      `${s.name},${s.stats.present},${s.stats.total},${s.stats.percentage}%,${s.stats.isCritical ? 'DANGER' : 'SAFE'}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Attendance_Report.csv'; a.click();
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-[#0b0e14]"><Auth /></div>;

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-24 bg-[#0b0e14] text-slate-200">
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-6 md:top-1/2 md:-translate-y-1/2 md:w-20 z-50 flex md:flex-col items-center gap-4 p-4 glass-panel rounded-3xl border border-white/10 backdrop-blur-xl">
        <NavBtn icon={CalendarIcon} active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <NavBtn icon={TrendingUp} active={view === 'calendar'} onClick={() => setView('calendar')} />
        <NavBtn icon={PieChartIcon} active={view === 'analytics'} onClick={() => setView('analytics')} />
        <NavBtn icon={SettingsIcon} active={view === 'settings'} onClick={() => setView('settings')} />
      </nav>

      <main className="max-w-7xl mx-auto p-6 pt-12">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              <div className="flex-1">
                <h1 className="text-5xl font-black">Dashboard</h1>
                {criticalSubject?.stats.isCritical && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="text-red-400" size={20} />
                    <p className="text-sm font-bold text-red-200">Attention: {criticalSubject.name} is {Math.abs(criticalSubject.stats.margin)}% below target!</p>
                  </div>
                )}
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl outline-none" onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <button onClick={() => setIsModalOpen(true)} className="px-6 py-3 bg-indigo-600 rounded-xl font-bold flex items-center gap-2"><Plus size={20} /> Add</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {subjectData.map(s => (
                <div key={s.id} className="glass-card rounded-[2rem] p-6 relative overflow-hidden flex flex-col min-h-[320px] group border border-white/5 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-2">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-30"></div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-2xl font-bold">{s.name}</h3>
                    <button onClick={() => deleteSubject(s.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={20} /></button>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <span className={`text-6xl font-black ${s.stats.isCritical ? 'text-red-400' : 'text-indigo-400'}`}>{s.stats.percentage}%</span>
                    <p className="text-[10px] uppercase font-bold tracking-widest mt-2 text-slate-500">Target: {s.target}%</p>
                  </div>
                  <div className="grid grid-cols-2 border-t border-white/5 bg-black/20 mt-4 rounded-xl">
                    <div className="p-3 text-center border-r border-white/5">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Attended</p>
                      <p className="text-xl font-bold text-emerald-400">{s.stats.present}</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Total Held</p>
                      <p className="text-xl font-bold">{s.stats.total}</p>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/5">
                    <div className={`h-full transition-all duration-1000 ${s.stats.isCritical ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${s.stats.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'calendar' && (
          <div className="flex flex-col lg:flex-row gap-10">
            <div className="glass-panel p-8 rounded-[2.5rem] bg-white/5 border border-white/10 h-fit lg:w-1/2">
              <Calendar onChange={setSelectedDate} value={selectedDate} className="bg-transparent border-none text-white w-full" />
            </div>
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl font-black">Logs for {selectedDate.toDateString()}</h2>
              <div className="space-y-4">
                {subjects.map(s => {
                  const log = s.history.find(h => h.date === selectedDate.toDateString());
                  return (
                    <div key={s.id} className="p-5 glass-panel rounded-2xl flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors">
                      <span className="font-bold text-lg">{s.name}</span>
                      <div className="flex gap-3">
                        <LogBtn active={log?.status === 'p'} color="emerald" icon={Check} onClick={() => markAttendance(s.id, 'p')} />
                        <LogBtn active={log?.status === 'a'} color="rose" icon={X} onClick={() => markAttendance(s.id, 'a')} />
                        <LogBtn active={log?.status === 'holiday'} color="amber" icon={SettingsIcon} onClick={() => markAttendance(s.id, 'h')} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'analytics' && (
          <div className="space-y-10 animate-in zoom-in duration-500">
            <h2 className="text-4xl font-black">Analytics</h2>
            <div className="glass-panel p-8 rounded-[2.5rem] bg-white/5 border border-white/10 h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectData.map(s => ({ name: s.name, pct: s.stats.percentage }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748b" /> <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                  <Bar dataKey="pct" fill="#6366f1" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-2xl space-y-8">
            <h2 className="text-4xl font-black">Settings</h2>
            <div className="glass-panel p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-6">
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                <div><p className="font-bold">User</p><p className="text-slate-500 text-sm">{user?.email}</p></div>
                <button onClick={() => supabase.auth.signOut()} className="p-3 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><LogOut size={20} /></button>
              </div>
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                <div><p className="font-bold">History</p><p className="text-slate-500 text-sm">Export all logs</p></div>
                <button onClick={downloadCSV} className="px-6 py-3 bg-white/10 rounded-xl font-bold flex items-center gap-2"><Download size={20} /> CSV</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
          <div className="glass-panel p-10 rounded-[2.5rem] w-full max-w-md bg-[#161b22] border border-white/10 shadow-2xl">
            <h2 className="text-3xl font-black mb-8">New Subject</h2>
            <div className="space-y-6">
              <input type="text" className="w-full p-4 rounded-xl bg-white/5 border border-white/10 outline-none" placeholder="Name" onChange={e => setNewSub({...newSub, name: e.target.value})} />
              <input type="number" className="w-full p-4 rounded-xl bg-white/5 border border-white/10 outline-none" placeholder="Target %" onChange={e => setNewSub({...newSub, target: e.target.value})} />
              <div className="flex gap-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 p-4 rounded-xl bg-white/5 font-bold">Cancel</button>
                <button onClick={async () => {
                  if (newSub.name) {
                    await supabase.from('subjects').insert([{ name: newSub.name, target_percentage: newSub.target, user_id: user.id }]);
                    setIsModalOpen(false);
                  }
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
  const colors = { emerald: 'bg-emerald-500', rose: 'bg-rose-500', amber: 'bg-amber-500' };
  return (
    <button onClick={onClick} className={`p-3 rounded-xl transition-all ${active ? colors[color] + ' text-white shadow-lg' : 'bg-white/5 text-slate-500'}`}>
      <Icon size={20} />
    </button>
  );
};

export default App;