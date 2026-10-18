import React from 'react';
import { UserProfile } from '../types';
import { PcdEmblem } from './PcdEmblem';
import {
  Calendar,
  Database,
  BarChart3,
  LogOut,
  Settings2,
  Plus,
  Clock,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'events' | 'database' | 'analytics';
  setCurrentTab: (tab: 'events' | 'database' | 'analytics') => void;
  currentUser: UserProfile;
  activeEventName?: string;
  onOpenNewEvent: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  activeEventName,
  onOpenNewEvent,
  onOpenSettings,
  onLogout,
}) => {
  const isCoordinator = currentUser.role === 'coordinator';

  return (
    <>
      {/* Top Header with Signature PCD Color Theme */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200/90 shadow-2xs">
        {/* Top signature PCD colour theme bar: Red (YRC) · Blue (NSS) · Emerald (NSO) */}
        <div className="h-1 bg-gradient-to-r from-red-600 via-blue-600 to-emerald-600 w-full" />

        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-13 sm:h-16 gap-2">
            {/* Brand with Pure Colour Theme Swatch (No Logo Design) */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <PcdEmblem size={28} />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-black tracking-tight text-neutral-900">
                    SSN PCD
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-red-700">
                    Attendance
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-sm">
                    {isCoordinator ? 'Coordinator' : 'Admin'}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-500 font-medium truncate max-w-[170px] sm:max-w-none">
                  {isCoordinator ? (activeEventName || 'Assigned Event Scanner') : 'YRC · NSS · NSO · NReg'}
                </div>
              </div>
            </div>

            {/* Desktop Center Navigation Pills with PCD Color Themes */}
            {!isCoordinator && (
              <nav className="hidden sm:flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentTab('events')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[38px] ${
                    currentTab === 'events'
                      ? 'bg-red-50 text-red-700 font-bold border border-red-200 shadow-2xs'
                      : 'text-neutral-600 hover:text-red-700 hover:bg-red-50/50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-red-600" />
                  <span>Events</span>
                </button>

                <button
                  onClick={() => setCurrentTab('database')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[38px] ${
                    currentTab === 'database'
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs'
                      : 'text-neutral-600 hover:text-blue-700 hover:bg-blue-50/50'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  <span>Database</span>
                </button>

                <button
                  onClick={() => setCurrentTab('analytics')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[38px] ${
                    currentTab === 'analytics'
                      ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-2xs'
                      : 'text-neutral-600 hover:text-emerald-700 hover:bg-emerald-50/50'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Analytics</span>
                </button>
              </nav>
            )}

            {isCoordinator && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 px-2.5 py-1 rounded-md">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="font-mono text-[11px] truncate max-w-[130px] sm:max-w-none">
                  {currentUser.email}
                </span>
              </div>
            )}

            {/* Right actions: SSN Red Theme for Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {!isCoordinator && (
                <>
                  <button
                    onClick={onOpenNewEvent}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer min-h-[36px] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Event</span>
                  </button>

                  <button
                    onClick={onOpenSettings}
                    title="Google Sheet & Webhook Settings"
                    className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center transition-colors"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-2 text-neutral-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Sticky Bottom Navigation Bar with PCD Color Theme Accents */}
      {!isCoordinator && (
        <nav
          aria-label="Mobile Navigation"
          className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-neutral-200 shadow-lg px-2 py-1 safe-area-pb"
        >
          <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
            <button
              onClick={() => setCurrentTab('events')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer min-h-[46px] ${
                currentTab === 'events'
                  ? 'text-red-600 font-black bg-red-50'
                  : 'text-neutral-500 hover:text-red-600'
              }`}
            >
              <Calendar className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] leading-tight">Events</span>
            </button>

            <button
              onClick={() => setCurrentTab('database')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer min-h-[46px] ${
                currentTab === 'database'
                  ? 'text-blue-600 font-black bg-blue-50'
                  : 'text-neutral-500 hover:text-blue-600'
              }`}
            >
              <Database className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] leading-tight">Database</span>
            </button>

            <button
              onClick={() => setCurrentTab('analytics')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer min-h-[46px] ${
                currentTab === 'analytics'
                  ? 'text-emerald-600 font-black bg-emerald-50'
                  : 'text-neutral-500 hover:text-emerald-600'
              }`}
            >
              <BarChart3 className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] leading-tight">Analytics</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-neutral-500 hover:text-neutral-900 transition-all cursor-pointer min-h-[46px]"
            >
              <Settings2 className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] leading-tight">Settings</span>
            </button>
          </div>
        </nav>
      )}
    </>
  );
};
