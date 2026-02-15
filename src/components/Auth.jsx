import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // --- Password Reset Logic ---
  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email first so we know where to send the link!");
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Ensure this URL is added to your Supabase Redirect URLs
      redirectTo: 'https://attendance-tracker-pro-delta.vercel.app/reset-password',
    });

    if (error) {
      alert(error.message);
    } else {
      alert("A secure password reset link has been sent to your email!");
    }
    setLoading(false);
  };

  // --- Main Auth Logic (Sign In / Sign Up) ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert(error.message);
    } else if (isSignUp) {
      alert('Account created! Please check your email for the confirmation link.');
    }
    
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-500">
      <h2 className="text-2xl font-black mb-6 text-center text-white">
        {isSignUp ? 'Create Account' : 'Welcome Back'}
      </h2>
      
      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-slate-500">Email Address</label>
          <input
            type="email"
            placeholder="name@university.edu"
            value={email}
            className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-slate-500">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            onChange={(e) => setPassword(e.target.value)}
            required={!loading}
          />
          
          {/* Password Reset Trigger: Only show during Sign In */}
          {!isSignUp && (
            <div className="flex justify-end mt-2">
              <button 
                type="button" 
                onClick={handleForgotPassword}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          )}
        </div>

        <button
          disabled={loading}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? 'Processing...' : isSignUp ? 'Create My Account' : 'Sign Into Cloud'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-800 text-center">
        <button 
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-slate-400 hover:text-white font-medium transition-colors"
        >
          {isSignUp ? 'Already have an account? Sign In' : "New here? Create a secure account"}
        </button>
      </div>
    </div>
  );
};

export default Auth;