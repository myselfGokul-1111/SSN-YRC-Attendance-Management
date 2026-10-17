import React, { useState } from 'react';
import { UserProfile, PCDEvent } from '../types';
import { PCDStorageService, SSN_ADMIN_CREDENTIALS } from '../services/storage';
import { YrcEmblem } from './YrcEmblem';
import {
  Shield,
  QrCode,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Calendar,
  Users,
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Coordinator credentials form state (for other devices)
  const [coordEmail, setCoordEmail] = useState('gokul2470019@ssn.edu.in');
  const [coordPassword, setCoordPassword] = useState('');
  const [showCoordPassword, setShowCoordPassword] = useState(false);
  const [coordEventId, setCoordEventId] = useState<string>(events[0]?.id || '');
  const [coordError, setCoordError] = useState<string | null>(null);
  const [isCoordSubmitting, setIsCoordSubmitting] = useState(false);

  const allKnownUsers = PCDStorageService.getAllUsers();
  const knownCoordinators = allKnownUsers.filter((u) => u.role === 'coordinator');

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const isValid = PCDStorageService.validateAdminLogin(adminEmail, adminPassword);
      if (isValid) {
        const adminProfile: UserProfile = {
          email: adminEmail.trim().toLowerCase(),
          name: 'SSN YRC Administrator',
          role: 'admin',
          department: 'SSN Youth Red Cross & PCD Wing',
          password: SSN_ADMIN_CREDENTIALS.password,
        };
        PCDStorageService.setAuthSession(adminProfile);
        onAdminLoginSuccess(adminProfile);
      } else {
        setAdminError('Invalid email or password. Please verify credentials.');
      }
      setIsSubmitting(false);
    }, 300);
  };

  const handleCoordinatorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCoordError(null);
    setIsCoordSubmitting(true);

    setTimeout(() => {
      const res = PCDStorageService.validateCoordinatorLogin(coordEmail, coordPassword);
      if (res.success && res.user) {
        PCDStorageService.setAuthSession(res.user);
        onCoordinatorDirectAccess(res.user, coordEventId);
      } else {
        setCoordError(
          res.error || 'Incorrect coordinator password or email. Please check your allocation email.'
        );
      }
      setIsCoordSubmitting(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-950 via-neutral-900 to-black text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-red-600/15 blur-[120px] rounded-full" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 max-w-5xl mx-auto w-full flex items-center justify-between pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <YrcEmblem size={40} />
          <div>
            <div className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              SSN Youth Red Cross
              <span className="text-[10px] font-mono font-bold bg-red-600/30 text-red-300 border border-red-500/40 px-2 py-0.5 rounded">
                YRC · PCD
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 font-medium">
              SSN College of Engineering · Extra-Curricular & Extension Activities
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-red-300 bg-red-950/60 border border-red-800/60 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Attendance Portal
        </div>
      </header>

      {/* Main Login Card Section */}
      <main className="relative z-10 max-w-md mx-auto w-full my-auto py-8">
        <div className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-700 to-rose-600 shadow-lg shadow-red-600/30 mb-1">
              <YrcEmblem size={32} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              PCD Attendance System
            </h1>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
              Youth Red Cross (YRC), NSS, NSO, and NReg attendance recording with dynamic digital ID mapping.
            </p>
          </div>

          {/* Role Segmented Switcher */}
          <div className="grid grid-cols-2 p-1 bg-neutral-950 rounded-2xl border border-neutral-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setAdminError(null);
              }}
              className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
                activeTab === 'admin'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Admin Login</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('coordinator');
                setAdminError(null);
              }}
              className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px] ${
                activeTab === 'coordinator'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Coordinator Access</span>
            </button>
          </div>

          {/* TAB 1: Admin Login */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              {adminError && (
                <div className="p-3.5 bg-red-950/80 border border-red-700/60 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-snug">{adminError}</div>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-red-400" />
                  <span>Admin Email</span>
                </label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="ssnyrcofficial@gmail.com"
                  className="w-full px-4 py-3 text-sm bg-neutral-950 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono min-h-[44px]"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-red-400" />
                    <span>Admin Password</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdminPassword('2005@ssnYRC')}
                    className="text-[11px] text-red-400 hover:text-red-300 underline cursor-pointer"
                  >
                    Fill configured password
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password..."
                    className="w-full pl-4 pr-12 py-3 text-sm bg-neutral-950 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Admin Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer min-h-[48px] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Sign In to Admin Console</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>

              <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                <div className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-red-400" />
                  <span>Admin Credentials:</span>
                </div>
                <div>Email: <span className="font-mono text-white">ssnyrcofficial@gmail.com</span></div>
                <div>Password: <span className="font-mono text-white">2005@ssnYRC</span></div>
              </div>
            </form>
          )}

          {/* TAB 2: Coordinator Direct Attendance Access via Password or Email */}
          {activeTab === 'coordinator' && (
            <form onSubmit={handleCoordinatorSubmit} className="space-y-4">
              <div className="p-3.5 bg-neutral-950/80 rounded-xl border border-neutral-800 text-xs text-neutral-300 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-red-500" />
                  <span>Coordinator Device Login</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Your Coordinator <strong>Email ID</strong> and <strong>Password</strong> were sent to your mailbox upon event allocation.
                  Use them here to sign in on mobile or other devices.
                </p>
                <div className="text-[10px] text-red-300 bg-red-950/50 border border-red-900/50 p-2 rounded-lg">
                  💡 <strong>Tip:</strong> If you open the <em>1-Click Direct Link</em> from your allocation email, you enter instantly without entering any password!
                </div>
              </div>

              {coordError && (
                <div className="p-3.5 bg-red-950/80 border border-red-700/60 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-snug">{coordError}</div>
                </div>
              )}

              {/* Coordinator Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-red-400" />
                  <span>Coordinator Email ID</span>
                </label>
                <input
                  type="email"
                  required
                  value={coordEmail}
                  onChange={(e) => setCoordEmail(e.target.value)}
                  placeholder="e.g. gokul2470019@ssn.edu.in"
                  className="w-full px-4 py-3 text-sm bg-neutral-950 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono min-h-[44px]"
                />
              </div>

              {/* Coordinator Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-red-400" />
                    <span>Coordinator Password</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCoordEmail('gokul2470019@ssn.edu.in');
                      setCoordPassword('SSN@Coord24');
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 underline cursor-pointer"
                  >
                    Fill sample Gokul S credentials
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showCoordPassword ? 'text' : 'password'}
                    required
                    value={coordPassword}
                    onChange={(e) => setCoordPassword(e.target.value)}
                    placeholder="Enter password sent to your email..."
                    className="w-full pl-4 pr-12 py-3 text-sm bg-neutral-950 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCoordPassword(!showCoordPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 cursor-pointer"
                    aria-label={showCoordPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCoordPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Event to Scan */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-red-400" />
                  <span>Target Event</span>
                </label>
                <select
                  value={coordEventId}
                  onChange={(e) => setCoordEventId(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[44px]"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.date})
                    </option>
                  ))}
                </select>
              </div>

              {/* Enter Live Scanner Button */}
              <button
                type="submit"
                disabled={isCoordSubmitting}
                className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer min-h-[48px] disabled:opacity-50"
              >
                {isCoordSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    <span>Sign In & Open Live Scanner</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>

              <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                <div className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-red-400" />
                  <span>Demo Coordinator Credentials (from email):</span>
                </div>
                <div>Gokul S: <span className="font-mono text-white">gokul2470019@ssn.edu.in</span> | Pass: <span className="font-mono text-white">SSN@Coord24</span></div>
                <div>Other Assigned Coordinators: Pass <span className="font-mono text-white">SSN@Coord2026</span></div>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-5xl mx-auto w-full text-center pt-6 border-t border-white/10 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          SSN Youth Red Cross · Dynamic PCD Attendance System
        </div>
        <div className="font-mono text-[11px] text-neutral-400">
          Batches 2023 · 2024 · 2025 · 13 Roster Sheets
        </div>
      </footer>
    </div>
  );
};
