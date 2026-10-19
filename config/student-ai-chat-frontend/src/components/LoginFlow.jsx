import React, { useState } from 'react';
import { Mail, KeyRound, ArrowRight, AlertCircle, CheckCircle2, ShieldCheck, RefreshCw, Database } from 'lucide-react';

export default function LoginFlow({ apiClient, onLoginSuccess, initialNotice }) {
  const [step, setStep] = useState('EMAIL'); // 'EMAIL' | 'OTP'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialNotice || '');
  const [infoMessage, setInfoMessage] = useState('');

  // Client-side convenience validation; actual domain authorization is enforced by the Django backend
  const isValidEmailFormat = (value) => {
    const trimmed = value.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError('');
    setInfoMessage('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your university email address.');
      return;
    }
    if (!isValidEmailFormat(trimmedEmail)) {
      setError('Please enter a valid university email address (e.g., student@mituniversity.edu.in).');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.requestOtp(trimmedEmail);
      const backendMsg =
        (response && (response.message || response.detail)) ||
        `A one-time verification code has been sent to ${trimmedEmail}.`;
      setInfoMessage(backendMsg);
      setStep('OTP');
    } catch (err) {
      setError(err.message || 'Unable to send OTP. Please check your university email and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError('');
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length < 4) {
      setError('Please enter the verification code sent to your university email.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.verifyOtp(email.trim().toLowerCase(), trimmedOtp);
      await onLoginSuccess(data, email.trim().toLowerCase());
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP. Please verify the code or request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="w-full max-w-md">
        {/* University Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white shadow-sm mb-4">
            <Database className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Government Data Analysis AI
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            University Research Portal &bull; Powered by Gemma &amp; MCP
          </p>
        </div>

        {/* Authentication Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {step === 'EMAIL' ? 'Student Sign In' : 'Verify One-Time Passcode'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {step === 'EMAIL'
                  ? 'Use your official university email address to request an OTP'
                  : `Enter the code sent to ${email.trim()}`}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
              <ShieldCheck className="w-3.5 h-3.5" />
              Step {step === 'EMAIL' ? '1' : '2'} of 2
            </span>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {/* Success / Info Banner */}
          {infoMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div className="leading-relaxed">{infoMessage}</div>
            </div>
          )}

          {step === 'EMAIL' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="university-email"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  University Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="university-email"
                    type="email"
                    required
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@mituniversity.edu.in"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60 transition"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Access is restricted to verified university accounts enforced by the backend.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none transition shadow-sm"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Requesting OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="otp-code"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  One-Time Passcode (OTP)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    maxLength={8}
                    disabled={loading}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\s+/g, ''))}
                    placeholder="123456"
                    className="w-full pl-10 pr-4 py-2.5 text-sm font-mono tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !otp.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none transition shadow-sm"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Verify &amp; Open Chat</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep('EMAIL');
                    setOtp('');
                    setError('');
                    setInfoMessage('');
                  }}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                >
                  &larr; Change email address
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleRequestOtp}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
