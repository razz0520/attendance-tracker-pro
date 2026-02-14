import Auth from './components/Auth';
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from "./lib/supabaseClient"; // Ensure this path is correct
import { 
  Plus, Trash2, Check, X, RotateCcw, 
  TrendingUp, Calendar, Settings, PieChart, 
  Sun, Moon, Info, Download, Search, LogOut
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart as RePie, 
  Pie, Cell 
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const App = () => {
  // --- State Declarations ---
  const [subjects, setSubjects] = useState([]);
  const [user, setUser] = useState(null); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [view, setView] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newSub, setNewSub] = useState({ name: '', target: 75, color: COLORS[0] });

  // --- Auth & Data Sync Hook ---
  useEffect(() => {
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

  // --- Data Transformation Layer ---
  // This maps Supabase 'attendance_logs' to your UI's 'history' format
  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('*, attendance_logs(*)'); 
    
    if (!error && data) {
      const transformedData = data.map(s => ({
        ...s,
        target: s.target_percentage, // Mapping DB column to UI state
        history: (s.attendance_logs || []).map(log => ({
          id: log.id,
          date: new Date(log.date).getTime(),
          status: log.status === 'present' ? 'p' : 'a' // Mapping 'present' to 'p'
        }))
      }));
      setSubjects(transformedData);
    } else if (error) {
      console.error("Cloud Fetch Error:", error.message);
    }
  };

  // --- Cloud Logic Functions ---
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
    const { error } = await supabase
      .from('attendance_logs')
      .insert([{ subject_id: subjectId, status: dbStatus }]);

    if (!error) fetchSubjects();
  };

  const undoLast = async (subject) => {
    if (!subject.history || subject.history.length === 0) return;
    const lastLogId = subject.history[subject.history.length - 1].id;
    
    const { error } = await supabase
      .from('attendance_logs')
      .delete()
      .eq('id', lastLogId);

    if (!error) fetchSubjects();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- Calculation Logic (Derived State) ---
  const calculateStats = (subject) => {
    const present = subject.history.filter(h => h.status === 'p').length;
    const total = subject.history.length;
    const percentage = total === 0 ? 0 : Math.round((present / total) * 100);
    
    let actionText = "";
    if (total === 0) {
      actionText = "No classes recorded.";
    } else if (percentage >= subject.target) {
      const missable = Math.floor((present - (subject.target / 100) * total) / (subject.target / 100));
      actionText = missable > 0 ? `Can miss ${missable} more classes.` : "On track. Don't miss next.";
    } else {
      const needed = Math.ceil(((subject.target / 100) * total - present) / (1 - subject.target / 100));
      actionText = `Attend next ${needed} classes to reach ${subject.target}%.`;
    }

    return { present, total, percentage, actionText };
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

  // --- Auth Guard ---
// --- Auth Guard ---
if (!user) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
      <div className="flex flex-col items-center space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter">Attendance Pro</h1>
          <p className="text-slate-500 mt-2">Secure Cloud Synchronization</p>
        </div>
        <Auth /> {/* This replaces the placeholder */}
      </div>
    </div>
  );
}

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} pb-24 md:pb-0 md:pl-20`}>
      
      {/* Navigation Sidebar */}
      <nav className={`fixed bottom-0 left-0 w-full md:w-20 md:h-full z-50 flex md:flex-col items-center justify-around md:justify-center gap-8 p-4 border-t md:border-r ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-xl transition-colors`}>
        <button onClick={() => setView('dashboard')} className={`p-3 rounded-2xl transition-all ${view === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400'}`}>
          <Calendar size={24} />
        </button>
        <button onClick={() => setView('analytics')} className={`p-3 rounded-2xl transition-all ${view === 'analytics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400'}`}>
          <PieChart size={24} />
        </button>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all">
          {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>
        <button onClick={() => setView('settings')} className={`p-3 rounded-2xl transition-all ${view === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400'}`}>
          <Settings size={24} />
        </button>
      </nav>

      <main className="max-w-6xl mx-auto p-6 pt-10">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black tracking-tight">Attendance Pro</h1>
                <p className="text-slate-500 mt-2 font-medium">Overall Average: <span className="text-indigo-600">{overallStats}%</span></p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-10 pr-4 py-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64`}
                  />
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-indigo-500/20 transition-all">
                  <Plus size={20} /> Add
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSubjects.map(subject => {
                const { percentage, actionText } = calculateStats(subject);
                const isCritical = percentage < subject.target;

                return (
                  <div key={subject.id} className={`${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'} border p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold bg-indigo-500">
                          {subject.name[0]}
                        </div>
                        <h3 className="font-bold text-lg">{subject.name}</h3>
                      </div>
                      <button onClick={() => deleteSubject(subject.id)} className="text-slate-400 hover:text-red-500 p-1">
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="mb-6">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-3xl font-black">{percentage}%</span>
                        <span className="text-xs font-bold uppercase opacity-50">Target: {subject.target}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${isCritical ? 'bg-red-500' : 'bg-emerald-500'}`} 
                          style={{ width: `${Math.min(percentage, 100)}%` }} 
                        />
                      </div>
                      <p className={`text-xs mt-3 flex items-center gap-1.5 font-bold ${isCritical ? 'text-amber-500' : 'text-emerald-600'}`}>
                        <Info size={14} /> {actionText}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => markAttendance(subject.id, 'p')} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all">
                        <Check size={20} />
                        <span className="text-[10px] font-bold uppercase">Present</span>
                      </button>
                      <button onClick={() => markAttendance(subject.id, 'a')} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                        <X size={20} />
                        <span className="text-[10px] font-bold uppercase">Absent</span>
                      </button>
                      <button onClick={() => undoLast(subject)} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-600 hover:text-white transition-all">
                        <RotateCcw size={18} />
                        <span className="text-[10px] font-bold uppercase">Undo</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'analytics' && (
          <div className="space-y-8 animate-in zoom-in-95 duration-500">
             <h2 className="text-3xl font-black">Performance Insights</h2>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'} border p-6 rounded-[2rem] h-80`}>
                  <h3 className="font-bold mb-6 flex items-center gap-2 text-indigo-500"><TrendingUp size={20} /> Subject Comparison</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjects.map(s => ({ name: s.name, pct: calculateStats(s).percentage }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none' }}
                      />
                      <Bar dataKey="pct" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={`${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'} border p-6 rounded-[2rem] h-80`}>
                   <h3 className="font-bold mb-6 flex items-center gap-2 text-emerald-500"><PieChart size={20} /> Data Distribution</h3>
                   <ResponsiveContainer width="100%" height="80%">
                      <RePie>
                         <Pie
                           data={[
                             { name: 'Present', value: subjects.reduce((acc, s) => acc + s.history.filter(h => h.status === 'p').length, 0) },
                             { name: 'Absent', value: subjects.reduce((acc, s) => acc + s.history.filter(h => h.status === 'a').length, 0) }
                           ]}
                           innerRadius={60}
                           outerRadius={80}
                           paddingAngle={5}
                           dataKey="value"
                         >
                            <Cell fill="#10b981" />
                            <Cell fill="#ef4444" />
                         </Pie>
                         <Tooltip />
                      </RePie>
                   </ResponsiveContainer>
                </div>
             </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-xl mx-auto space-y-6">
            <h2 className="text-3xl font-black">Preferences</h2>
            <div className={`${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'} border rounded-[2rem] overflow-hidden`}>
              <div className="p-6 border-b border-slate-800/10 flex items-center justify-between">
                <div>
                  <h4 className="font-bold">Account</h4>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
                <button onClick={handleLogout} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <LogOut size={20} />
                </button>
              </div>
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h4 className="font-bold">Export Data</h4>
                  <p className="text-sm text-slate-500">Save history to JSON file</p>
                </div>
                <button 
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(subjects)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'attendance_backup.json';
                    a.click();
                  }}
                  className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                >
                  <Download size={20} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} w-full max-w-md border rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95`}>
            <h3 className="text-2xl font-black mb-6">New Subject</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2 opacity-50">Subject Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Algorithms"
                  value={newSub.name}
                  onChange={e => setNewSub({...newSub, name: e.target.value})}
                  className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2 opacity-50">Target: {newSub.target}%</label>
                <input 
                  type="range" min="50" max="100" step="5"
                  value={newSub.target}
                  onChange={e => setNewSub({...newSub, target: parseInt(e.target.value)})}
                  className="w-full accent-indigo-600"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800">Cancel</button>
                <button onClick={addSubject} className="flex-1 py-4 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
