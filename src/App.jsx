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
    <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 w-full max-w-md shadow-2xl text-white">
      <h2 className="text-2xl font-black mb-6 text-center">Set New Password</h2>
      <form onSubmit={handleUpdate} className="space-y-4">
        <input
          type="password"
          placeholder="Enter new password"
          className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <button disabled={loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black transition-all">
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

const App = () => {
  // --- State Declarations ---
  const [subjects, setSubjects] = useState([]);
  const [user, setUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [view, setView] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newSub, setNewSub] = useState({ name: '', target: 75, color: COLORS[0] });

  // --- Auth & Data Sync Hook ---
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

  // --- Data Fetching ---
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
          status: log.status === 'present' ? 'p' : log.status === 'absent' ? 'a' : 'holiday'
        }))
      }));
      setSubjects(transformedData);
    } else if (error) {
      console.error("Cloud Fetch Error:", error.message);
    }
  };

  // --- CSV Conversion Logic (Step 1) ---
  const downloadAttendanceCSV = () => {
    let csvContent = "Subject,Target %,Present,Absent,Holidays,Total Conducted,Current %,Status\n";

    subjects.forEach(s => {
      const stats = calculateSubjectStats(s);
      const row = [
        s.name,
        `${s.target}%`,
        stats.present,
        s.history.filter(h => h.status === 'a').length,
        s.history.filter(h => h.status === 'holiday').length,
        stats.total,
        `${stats.percentage}%`,
        stats.isCritical ? "DANGER" : "SAFE"
      ].join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_Report_${new Date().toLocaleDateString()}.csv`);
    link.click();
  };

  // --- Logic Functions ---
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
    if (window.confirm('Delete this subject permanently?')) {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (!error) fetchSubjects();
    }
  };

  const markAttendance = async (subjectId, status) => {
    const dbStatus = status === 'p' ? 'present' : status === 'a' ? 'absent' : 'holiday';
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
      const validLogs = s.history.filter(h => h.status !== 'holiday');
      totalP += validLogs.filter(h => h.status === 'p').length;
      totalC += validLogs.length;
    });
    return totalC === 0 ? 0 : Math.round((totalP / totalC) * 100);
  }, [subjects]);

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

  // --- Rendering ---
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
            <Auth />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} pb-24 md:pb-0 md:pl-20`}>
      
      <nav className={`fixed bottom-0 left-0 w-full md:w-20 md:h-full z-50 flex md:flex-col items-center justify-around md:justify-center gap-8 p-4 border-t md:border-r ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-xl transition-colors`}>
        <button onClick={() => setView('dashboard')} className={`p-3 rounded-2xl ${view === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><CalendarIcon size={24} /></button>
        <button onClick={() => setView('calendar')} className={`p-3 rounded-2xl ${view === 'calendar' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><TrendingUp size={24} /></button>
        <button onClick={() => setView('analytics')} className={`p-3 rounded-2xl ${view === 'analytics' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><PieChart size={24} /></button>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 text-slate-400 transition-all">{isDarkMode ? <Sun size={24} /> : <Moon size={24} />}</button>
        <button onClick={() => setView('settings')} className={`p-3 rounded-2xl ${view === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Settings size={24} /></button>
      </nav>

      <main className="max-w-6xl mx-auto p-6 pt-10">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-end justify-between">
              <div><h1 className="text-4xl font-black">Dashboard</h1><p className="text-slate-500 font-medium">Average: {overallStats}%</p></div>
              <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold"><Plus size={20} /> Add</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSubjects.map(subject => {
                const { percentage, isCritical } = calculateSubjectStats(subject);
                return (
                  <div key={subject.id} className={`${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'} border p-6 rounded-[2rem] shadow-sm`}>
                    <div className="flex justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${isCritical ? 'bg-red-500' : 'bg-indigo-500'}`}>{subject.name[0]}</div>
                        <h3 className="font-bold text-lg">{subject.name}</h3>
                      </div>
                      <button onClick={() => deleteSubject(subject.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
                    </div>
                    <div className="mb-6 text-3xl font-black">{percentage}%</div>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => markAttendance(subject.id, 'p')} className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white"><Check size={20} /></button>
                      <button onClick={() => markAttendance(subject.id, 'a')} className="p-3 rounded-2xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white"><X size={20} /></button>
                      <button onClick={() => undoLast(subject)} className="p-3 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-600 hover:text-white"><RotateCcw size={18} /></button>
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
                      <button onClick={() => markAttendance(log.id, 'p')} className={`p-2 rounded-lg ${log.status === 'present' || log.status === 'p' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}><Check size={16} /></button>
                      <button onClick={() => markAttendance(log.id, 'a')} className={`p-2 rounded-lg ${log.status === 'absent' || log.status === 'a' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400'}`}><X size={16} /></button>
                      <button onClick={() => markAttendance(log.id, 'h')} className={`p-2 rounded-lg ${log.status === 'holiday' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}><Sun size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-xl mx-auto space-y-6">
            <h2 className="text-3xl font-black">Settings</h2>
            <div className={`${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'} border rounded-[2rem] overflow-hidden`}>
              {/* Profile Section */}
              <div className="p-6 border-b border-slate-800/10 flex items-center justify-between">
                <div><h4 className="font-bold">Account</h4><p className="text-sm text-slate-500">{user?.email}</p></div>
                <button onClick={handleLogout} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><LogOut size={20} /></button>
              </div>
              
              {/* CSV Export Section (Step 2) */}
              <div className="p-6 flex items-center justify-between">
                <div><h4 className="font-bold">Export Report</h4><p className="text-sm text-slate-500">Download Excel-ready CSV file</p></div>
                <button
                  onClick={downloadAttendanceCSV}
                  className="p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 font-bold"
                >
                  <Download size={20} />
                  <span>Download CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;