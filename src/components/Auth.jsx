import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) alert(error.message);
    else if (isSignUp) alert('Check your email for the confirmation link!');
    
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 w-full max-w-md shadow-2xl">
      <h2 className="text-2xl font-black mb-6 text-center">
        {isSignUp ? 'Create Account' : 'Welcome Back'}
      </h2>
      <form onSubmit={handleAuth} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          disabled={loading}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20"
        >
          {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>
      <button 
        onClick={() => setIsSignUp(!isSignUp)}
        className="w-full mt-4 text-sm text-slate-400 hover:text-white transition-colors"
      >
        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
      </button>
    </div>
  );
};

export default Auth;