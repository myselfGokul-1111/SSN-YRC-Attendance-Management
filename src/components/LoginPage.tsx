import React, { useState } from 'react';
import { UserProfile, PCDEvent } from '../types';
import { PCDStorageService, SSN_ADMIN_CREDENTIALS } from '../services/storage';
import { PcdEmblem } from './PcdEmblem';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  QrCode,
} from 'lucide-react';

interface LoginPageProps {
  onAdminLoginSuccess: (adminUser: UserProfile) => void;
  onCoordinatorDirectAccess: (coordinatorUser: UserProfile, targetEventId?: string) => void;
  events: PCDEvent[];
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onAdminLoginSuccess,
  onCoordinatorDirectAccess,
  events,
}) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'coordinator'>('admin');

  // Admin form state
  const [adminEmail, setAdminEmail] = useState(SSN_ADMIN_CREDENTIALS.email);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Coordinator form state
  const [coordEmail, setCoordEmail] = useState('');
  const [coordPassword, setCoordPassword] = useState('');
  const [showCoordPassword, setShowCoordPassword] = useState(false);
  const [coordError, setCoordError] = useState<string | null>(null);

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);

    const isValid = PCDStorageService.validateAdminLogin(adminEmail, adminPassword);
    if (isValid) {
      const adminProfile: UserProfile = {
        email: adminEmail.trim().toLowerCase(),
        name: 'SSN PCD Admin',
        role: 'admin',
        department: 'SSN PCD Wing',
      };
      PCDStorageService.setAuthSession(adminProfile);
      onAdminLoginSuccess(adminProfile);
    } else {
      setAdminError('Invalid email or password. Please verify credentials.');
    }
  };

  const handleCoordinatorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCoordError(null);

    const res = PCDStorageService.validateCoordinatorLogin(coordEmail, coordPassword);
    if (res.success && res.user) {
      PCDStorageService.setAuthSession(res.user);
      onCoordinatorDirectAccess(res.user);
    } else {
      setCoordError(res.error || 'Coordinator login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between p-3 sm:p-6 font-sans antialiased">
      {/* Background ambient lighting with signature SSN Red theme */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-40">
        <div className="w-[500px] h-[500px] bg-red-600/20 blur-[140px] rounded-full" />
      </div>

      {/* Top signature PCD colour theme bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-blue-600 to-emerald-600 z-50" />

      {/* Header - Pure colour theme (No logo design) */}
      <header className="relative z-10 max-w-md mx-auto w-full flex items-center justify-between pb-3 sm:pb-4 border-b border-neutral-800/80">
        <div className="flex items-center gap-2.5">
          {/* Pure color theme indicator */}
          <PcdEmblem size={30} />
          <div className="flex flex-col">
            <div className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              <span>SSN PCD</span>
              <span className="text-red-500">Attendance</span>
              <span className="text-[10px] font-mono font-bold bg-red-950/60 text-red-300 border border-red-800/60 px-1.5 py-0.5 rounded-sm">
                Portal
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 font-medium">
              SSN College of Engineering · Activity Management
            </div>
          </div>
        </div>

        <div className="text-[10px] font-mono text-neutral-500">
          2026-27
        </div>
      </header>

      {/* Main Login Card - Fully responsive with SSN Red Color Theme */}
      <main className="relative z-10 max-w-md w-full mx-auto my-4 sm:my-8">
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 backdrop-blur-md">
          {/* Tabs with Color Theme Active Pill */}
          <div className="grid grid-cols-2 gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs font-bold">
            <button
              onClick={() => {
                setActiveTab('admin');
                setAdminError(null);
              }}
              className={`py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px] ${
                activeTab === 'admin'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/50 font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Login</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('coordinator');
                setCoordError(null);
              }}
              className={`py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px] ${
                activeTab === 'coordinator'
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/50 font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Coordinator</span>
            </button>
          </div>

          {/* ADMIN FORM */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-red-400" />
                  <span>Admin SSN Email</span>
                </label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="ssnyrcofficial@gmail.com"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono min-h-[44px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-red-400" />
                  <span>Master Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all pr-10 font-mono min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {adminError && (
                <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{adminError}</span>
                </div>
              )}

              {/* Red Color Theme Submit Button */}
              <button
                type="submit"
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-red-950/50 transition-all cursor-pointer min-h-[46px]"
              >
                <span>Access Admin Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* COORDINATOR FORM */}
          {activeTab === 'coordinator' && (
            <form onSubmit={handleCoordinatorSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-red-400" />
                  <span>Coordinator Email</span>
                </label>
                <input
                  type="email"
                  required
                  value={coordEmail}
                  onChange={(e) => setCoordEmail(e.target.value)}
                  placeholder="e.g. gokul2470019@ssn.edu.in"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono min-h-[44px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-red-400" />
                  <span>Assigned Access Key</span>
                </label>
                <div className="relative">
                  <input
                    type={showCoordPassword ? 'text' : 'password'}
                    required
                    value={coordPassword}
                    onChange={(e) => setCoordPassword(e.target.value)}
                    placeholder="Enter coordinator access key"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all pr-10 font-mono min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCoordPassword(!showCoordPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 cursor-pointer"
                  >
                    {showCoordPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {coordError && (
                <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{coordError}</span>
                </div>
              )}

              {/* Red Color Theme Submit Button */}
              <button
                type="submit"
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-red-950/50 transition-all cursor-pointer min-h-[46px]"
              >
                <span>Launch Live Attendance Scanner</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-md mx-auto w-full text-center text-[10px] text-neutral-500 py-3">
        SSN College of Engineering · Automated Google Sheets & Gmail Sync
      </footer>
    </div>
  );
};
