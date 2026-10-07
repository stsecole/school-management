'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleStep1 = async (e: any) => {
    e.preventDefault();
    if (!username.trim()) { setError('Username required'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1, username: username.trim() }),
      });
      const data = await res.json();
      if (res.ok) { setQuestion(data.question); setStep(2); }
      else { setError(data.error || 'Error'); }
    } catch { setError('Connection failed'); }
    finally { setLoading(false); }
  };

  const handleStep2 = async (e: any) => {
    e.preventDefault();
    if (!answer.trim() || !newPassword.trim()) { setError('Answer and password required'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2, username: username.trim(), answer: answer.trim(), newPassword: newPassword.trim() }),
      });
      const data = await res.json();
      if (res.ok) { setSuccess(true); setStep(3); }
      else { setError(data.error || 'Error'); }
    } catch { setError('Connection failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#f0f9f8' }}>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f766e' }}>Password Recovery</h1>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>School Management System</p>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {error && (
            <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '14px', marginBottom: '16px' }}>{error}</div>
          )}
          {success && (
            <div style={{ padding: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', fontSize: '14px', marginBottom: '16px' }}>Password changed!</div>
          )}
          {step === 1 && (
            <form onSubmit={handleStep1}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Step 1: Username</h2>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }} />
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: '#0f766e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>{loading ? 'Loading...' : 'Continue'}</button>
            </form>
          )}
          {step === 2 && (
            <form onSubmit={handleStep2}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Step 2: Answer</h2>
              <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', color: '#666' }}>Security Question:</p>
                <p style={{ fontSize: '14px', fontWeight: '500' }}>{question}</p>
              </div>
              <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' }} />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }} />
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: '#0f766e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>{loading ? 'Loading...' : 'Change Password'}</button>
              <button type="button" onClick={() => { setStep(1); setError(''); }} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#666', border: 'none', fontSize: '14px', cursor: 'pointer', marginTop: '8px' }}>Back</button>
            </form>
          )}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ fontSize: '48px', marginBottom: '12px' }}>OK</p>
              <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>Password Changed!</p>
              <a href="/" style={{ display: 'block', padding: '12px', background: '#0f766e', color: 'white', borderRadius: '8px', textDecoration: 'none', textAlign: 'center', fontSize: '14px' }}>Login</a>
            </div>
          )}
          {step !== 3 && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <a href="/" style={{ fontSize: '14px', color: '#666', textDecoration: 'none' }}>Back to Login</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}