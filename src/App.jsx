import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 
import Auth from './components/Auth';
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from "./lib/supabaseClient"; 
import {
  Plus, Trash2, Check, X, RotateCcw,
  TrendingUp, Calendar as CalendarIcon, Settings, PieChart,
  Sun, Moon, Info, Download, Search, LogOut, AlertTriangle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart as RePie, 
  Pie, Cell 
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
      alert("Password updated! You can now log in.");
      window.location.hash = "";
      onComplete();
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 w-full max-w-md shadow-2xl">
      <h2 className="text-2xl font-black mb-6 text-center text-white">Set New Password</h2>
      <form onSubmit={handleUpdate} className="space-y-4">
        <input
          type="password"
          placeholder="Enter new password"
          className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <button disabled={loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all">
          {loading ? 'Updating...' : 'Update Password'}
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
  const [selectedDate, setSelectedDate] = useState(new Date()); // State for Calendar feature
  const [newSub, setNewSub] = useState({ name: '', target: 75, color: COLORS[0] });

  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) {
      setIsResetting(true);
    }

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
    const { data, error } = await supabase
      .from('subjects')
      .select('*, attendance_logs(*)');

    if (!error && data) {
      const transformedData = data.map(s => ({
        ...s,
        target: s.target_percentage,
        history: (s.attendance_logs || []).map(log => ({
          id: log.id,
          date: new Date(log.date).getTime(),
          status: log.status === 'present' ? 'p' : 'a'
        }))
      }));
      setSubjects(transformedData);
    } else if (error) {
      console.error("Cloud Fetch Error:", error.message);
    }
  };

  const addSubject = async () => {
    if (!newSub.name.trim()) return;
    const { error } = await supabase
      .from('subjects')
      .insert([{ name: newSub.name, target_percentage: newSub.target }]);

    if (!error) {
      fetchSubjects();
      setNewSub({ name: '', target: 75, color: COLORS[0] });
      setIsModalOpen(false);
    }
  };

  const deleteSubject = async (id) => {
    if (window.confirm('Delete this subject permanently from the cloud?')) {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (!error) fetchSubjects();
    }
  };

  const markAttendance = async (subjectId, status) => {
    const dbStatus = status === 'p' ? 'present' : 'absent';
    // Enhanced: Use selectedDate to allow retroactive marking from Calendar
    const { error } = await supabase
      .from('attendance_logs')
      .insert([{ 
        subject_id: subjectId, 
        status: dbStatus,
        date: selectedDate.toISOString() 
      }]);

    if (!error) fetchSubjects();
  };

  const undoLast = async (subject) => {
    if (!subject.history || subject.history.length === 0) return;
    const lastLogId = subject.history[subject.history.length - 1].id;
    const { error } = await supabase.from('attendance_logs').delete().eq('id', lastLogId);
    if (!error) fetchSubjects();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const overallStats = useMemo(() => {
    let totalP = 0;
    let totalC = 0;
    subjects.forEach(s => {
      totalP += s.history.filter(h => h.status === 'p').length;
      totalC += s.history.length;
    });
    return totalC === 0 ? 0 : Math.round((totalP / totalC) * 100);
  }, [subjects]);

  // Calendar Logic: Derive logs for the selected date
  const logsForDate = useMemo(() => {
    return subjects.map(subject => {
      const entry = subject.history.find(log => 
        new Date(log.date).toDateString() === selectedDate.toDateString()
      );
      return {
        id: subject.id,
        name: subject.name,
        status: entry ? entry.status : 'not marked'
      };
    });
  }, [subjects, selectedDate]);

  if (isResetting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <ResetPasswordView onComplete={() => setIsResetting(false)} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="flex flex-col items-center space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tighter text-indigo-500">Attendance Pro</h1>
            <p className="text-slate-500 mt-2 font-medium">Secure Cloud Synchronization</p>
          </div>
          <Auth />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} pb-24 md:pb-0 md:pl-20`}>
      
      <nav className={`fixed bottom-0 left-0 w-full md:w-20 md:h-full z-50 flex md:flex-col items-center justify-around md:justify-center gap-8 p-4 border-t md:border-r ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-xl transition-colors`}>
        <button onClick={() => setView('dashboard')} className={`p-3 rounded-2xl transition-all ${view === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
          <CalendarIcon size={24} />
        </button>
        <button onClick={() => setView('calendar')} className={`p-3 rounded-2xl transition-all ${view === 'calendar' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
          <TrendingUp size={24} /> {/* Icon for calendar view trigger */}
        </button>
        <button onClick={() => setView('analytics')} className={`p-3 rounded-2xl transition-all ${view === 'analytics' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
          <PieChart size={24} />
        </button>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all">
          {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>
        <button onClick={() => setView('settings')} className={`p-3 rounded-2xl transition-all ${view === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
          <Settings size={24} />
        </button>
      </nav>

      <main className="max-w-6xl mx-auto p-6 pt-10">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black tracking-tight">Dashboard</h1>
                <p className="text-slate-500 mt-2 font-medium">Overall Average: <span className="text-indigo-600 font-bold">{overallStats}%</span></p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-10 pr-4 py-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64`}
                  />
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-indigo-500/20">
                  <Plus size={20} /> Add
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSubjects.map(subject => {
                const { percentage, actionText, isCritical } = calculateSubjectStats(subject);
                return (
                  <div key={subject.id} className={`${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'} border p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group ${isCritical ? 'shadow-red-500/20 border-red-500/50' : ''}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold ${isCritical ? 'bg-red-500' : 'bg-indigo-500'}`}>
                          {isCritical ? <AlertTriangle size={20} /> : subject.name[0]}
                        </div>
                        <h3 className="font-bold text-lg">{subject.name}</h3>
                      </div>
                      <button onClick={() => deleteSubject(subject.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={18} /></button>
                    </div>
                    <div className="mb-6 text-3xl font-black">{percentage}%</div>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => markAttendance(subject.id, 'p')} className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"><Check size={20} /></button>
                      <button onClick={() => markAttendance(subject.id, 'a')} className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-all"><X size={20} /></button>
                      <button onClick={() => undoLast(subject)} className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-600 hover:text-white transition-all"><RotateCcw size={18} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'calendar' && (
          <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
            <div className={`p-6 rounded-[2rem] border h-fit ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <Calendar onChange={setSelectedDate} value={selectedDate} className="rounded-xl border-none shadow-sm" />
            </div>
            <div className="flex-1 space-y-4">
              <h2 className="text-2xl font-black">Attendance for {selectedDate.toDateString()}</h2>
              <div className="grid gap-3">
                {logsForDate.map(log => (
                  <div key={log.id} className={`p-4 rounded-2xl border flex justify-between items-center ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <span className="font-bold">{log.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => markAttendance(log.id, 'p')} className={`p-2 rounded-lg transition-all ${log.status === 'p' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}><Check size={16} /></button>
                      <button onClick={() => markAttendance(log.id, 'a')} className={`p-2 rounded-lg transition-all ${log.status === 'a' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400'}`}><X size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'analytics' && (
          <div className="space-y-8 animate-in zoom-in-95 duration-500">
            <h2 className="text-3xl font-black">Performance Insights</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjects.map(s => ({ name: s.name, pct: calculateSubjectStats(s).percentage }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="pct" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-black mb-6">Settings</h2>
            <div className={`p-6 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div><h4 className="font-bold">Account</h4><p className="text-sm text-slate-500">{user.email}</p></div>
                <button onClick={handleLogout} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><LogOut size={20} /></button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;