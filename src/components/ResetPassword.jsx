import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const ResetPassword = ({ onComplete }) => {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    
    if (error) alert(error.message);
    else {
      alert("Password updated! Redirecting to login...");
      window.location.hash = ''; // Clear the access token from URL
      onComplete(); // Go back to login view
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 w-full max-w-md shadow-2xl">
      <h2 className="text-2xl font-black mb-6 text-center text-white">New Password</h2>
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

export default ResetPassword;