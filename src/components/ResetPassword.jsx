import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    
    if (error) alert(error.message);
    else alert("Password updated successfully! You can now log in.");
  };

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h2 className="text-2xl font-bold mb-4">Set New Password</h2>
      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <input 
          type="password" 
          placeholder="New Password" 
          className="w-full p-3 border rounded-xl"
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold">
          Update Password
        </button>
      </form>
    </div>
  );
};