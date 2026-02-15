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
import Sun from 'lucide-react/dist/esm/icons/sun';
import Moon from 'lucide-react/dist/esm/icons/moon';
import Download from 'lucide-react/dist/esm/icons/download';
import Search from 'lucide-react/dist/esm/icons/search';
import LogOut from 'lucide-react/dist/esm/icons/log-out';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

import { calculateSubjectStats } from './utils/attendanceLogic';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
    <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 w-full max-w-md shadow-2xl text-white">
      <h2 className="text-2xl font-black mb-6 text-center">Secure New Password</h2>
      <form onSubmit={handleUpdate} className="space-y-4">
        <input
          type="password"
          placeholder="••••••••"
          className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <button disabled={loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black transition-all">
          {loading ? 'Updating...' : 'Set Password'}
        </button>
      </form>
    </div>
  );
};

const App = () => {
  const [subjects, setSubjects] = useState([]);
  const [user, setUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
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

  // RESTORED: Undo last attendance entry
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
    return subjects.map(subject => {
      const entry = subject.history.find(log => new Date(log.date).toDateString() === selectedDate.toDateString());
      return { id: subject.id, name: subject.name, status: entry ? entry.status : 'not marked' };
    });
  }, [subjects, selectedDate]);

  if (isResetting) return <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6"><ResetPasswordView onComplete={() => setIsResetting(false)} /></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6 flex-col gap-8"><h1 className="text-4xl font-black text-indigo-500">Attendance Pro</h1><Auth /></div>;

  return (
    <div className={`min-h-screen transition-all ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} pb-24 md:pb-0 md:pl-20`}>
      <nav className={`fixed bottom-0 left-0 w-full md:w-20 md:h-full z-50 flex md:flex-col items-center justify-around md:justify-center gap-8 p-4 border-t md:border-r ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-xl transition-colors`}>
        <button onClick={() => setView('dashboard')} className={`p-3 rounded-2xl ${view === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400'}`}><CalendarIcon size={24} /></button>
        <button onClick={() => setView('calendar')} className={`p-3 rounded-2xl ${view === 'calendar' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400'}`}><TrendingUp size={24} /></button>
        <button onClick={() => setView('analytics')} className={`p-3 rounded-2xl ${view === 'analytics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400'}`}><PieChartIcon size={24} /></button>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 text-slate-400">{isDarkMode ? <Sun size={24} /> : <Moon size={24} />}</button>
        <button onClick={() => setView('settings')} className={`p-3 rounded-2xl ${view === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400'}`}><SettingsIcon size={24} /></button>
      </nav>

      <main className="max-w-6xl mx-auto p-6 pt-10">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div><h1 className="text-4xl font-black">Dashboard</h1><p className="text-slate-500 font-medium">Average: <span className="text-indigo-600 font-bold">{overallStats}%</span></p></div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`pl-10 pr-4 py-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} outline-none focus:ring-2 focus:ring-indigo-500 w-64`} />
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2"><Plus size={20} /> Add</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSubjects.map(s => (
                <div key={s.id} className={`${isDarkMode ? 'bg-slate-900/50' : 'bg-white shadow-sm'} border p-6 rounded-[2rem]`}>
                  <div className="flex justify-between mb-4"><h3 className="font-bold">{s.name}</h3><button onClick={() => deleteSubject(s.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18} /></button></div>
                  <div className={`text-3xl font-black mb-2 ${s.stats?.isCritical ? 'text-red-500' : 'text-indigo-500'}`}>{s.stats?.percentage || 0}%</div>
                  <p className="text-xs text-slate-500 font-bold mb-4 uppercase">{s.stats?.actionText || "Loading..."}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => markAttendance(s.id, 'p')} className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all"><Check size={20} /></button>
                    <button onClick={() => markAttendance(s.id, 'a')} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"><X size={20} /></button>
                    <button onClick={() => undoLast(s)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-600 hover:text-white transition-all"><RotateCcw size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'calendar' && (
          <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
            <div className={`p-6 rounded-[2rem] border h-fit ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}><Calendar onChange={setSelectedDate} value={selectedDate} className="rounded-xl border-none" /></div>
            <div className="flex-1 space-y-4">
              <h2 className="text-2xl font-black">Logs for {selectedDate.toDateString()}</h2>
              {logsForDate.map(log => (
                <div key={log.id} className="p-4 rounded-2xl border flex justify-between items-center bg-white/5 backdrop-blur-sm">
                  <span className="font-bold">{log.name}</span>
                  <div className="flex gap-2">
                    <button onClick={() => markAttendance(log.id, 'p')} className={`p-2 rounded-lg ${log.status === 'p' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><Check size={16} /></button>
                    <button onClick={() => markAttendance(log.id, 'a')} className={`p-2 rounded-lg ${log.status === 'a' ? 'bg-red-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><X size={16} /></button>
                    <button onClick={() => markAttendance(log.id, 'h')} className={`p-2 rounded-lg ${log.status === 'holiday' ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><Sun size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'analytics' && (
          <div className="space-y-8 animate-in zoom-in-95 duration-500">
            <h2 className="text-2xl font-black">Performance Analytics</h2>
            {subjects.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjects.map(s => ({ name: s.name, pct: s.stats?.percentage || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="pct" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-slate-500">Add subjects to view analytics.</p>
            )}
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-black">Account Settings</h2>
            <div className={`p-6 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="p-6 border-b border-slate-800/10 flex items-center justify-between">
                <div><h4 className="font-bold">Session</h4><p className="text-sm text-slate-500">{user?.email}</p></div>
                <button onClick={async () => await supabase.auth.signOut()} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><LogOut size={20} /></button>
              </div>
              <div className="p-6 flex items-center justify-between">
                <div><h4 className="font-bold">Export</h4><p className="text-sm text-slate-500">Professional Report (.csv)</p></div>
                <button onClick={downloadAttendanceCSV} className="p-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2"><Download size={20} /> CSV</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
          <div className={`${isDarkMode ? 'bg-slate-900' : 'bg-white'} w-full max-w-md border rounded-[2.5rem] p-8 shadow-2xl`}>
            <h3 className="text-2xl font-black mb-6">Create Subject</h3>
            <input type="text" placeholder="Algorithm Design..." value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} className="w-full p-4 rounded-xl bg-slate-800 border text-white mb-4 outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex gap-4"><button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700">Cancel</button><button onClick={addSubject} className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 shadow-lg shadow-indigo-500/50">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;