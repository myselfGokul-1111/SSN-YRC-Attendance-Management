import React from 'react';
import { UserProfile } from '../types';
import { INITIAL_USER_PROFILES } from '../data/seedData';
import { YrcEmblem } from './YrcEmblem';
import { Shield, Sparkles, QrCode, LogOut } from 'lucide-react';

interface NavbarProps {
  currentTab: 'scanner' | 'events' | 'rosters' | 'attendance' | 'analytics';
  setCurrentTab: (tab: 'scanner' | 'events' | 'rosters' | 'attendance' | 'analytics') => void;
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  onOpenNewEvent: () => void;
  onOpenArchitecture: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  setCurrentUser,
  onOpenNewEvent,
  onOpenArchitecture,
  onLogout,
}) => {
  const isCoordinator = currentUser.role === 'coordinator';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-red-100 shadow-xs">
      {/* Top subtle crimson accent stripe */}
      <div className="h-1 bg-gradient-to-r from-red-700 via-red-600 to-rose-600 w-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          {/* Zone 1: SSN Youth Red Cross Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setCurrentTab('scanner')}
              className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none min-h-[44px]"
            >
              <YrcEmblem size={34} />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-extrabold tracking-tight text-neutral-900 group-hover:text-red-700 transition-colors whitespace-nowrap">
                    SSN Youth Red Cross
                  </span>
                  <span className="hidden sm:inline-block text-[10px] font-mono font-bold bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                    YRC
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-neutral-500 font-medium">
                  Health · Service · Friendship · Attendance
                </div>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Links (HIDDEN FOR COORDINATORS - ONLY SHOW FOR ADMINS) */}
          {!isCoordinator ? (
            <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-neutral-600">
              <button
                onClick={() => setCurrentTab('scanner')}
                className={`whitespace-nowrap shrink-0 transition-colors py-2 cursor-pointer min-h-[44px] flex items-center ${
                  currentTab === 'scanner'
                    ? 'text-red-700 font-bold border-b-2 border-red-600'
                    : 'hover:text-neutral-900'
                }`}
              >
                Live Scanner
              </button>
              <button
                onClick={() => setCurrentTab('events')}
                className={`whitespace-nowrap shrink-0 transition-colors py-2 cursor-pointer min-h-[44px] flex items-center ${
                  currentTab === 'events'
                    ? 'text-red-700 font-bold border-b-2 border-red-600'
                    : 'hover:text-neutral-900'
                }`}
              >
                Events & Allocation
              </button>
              <button
                onClick={() => setCurrentTab('rosters')}
                className={`whitespace-nowrap shrink-0 transition-colors py-2 cursor-pointer min-h-[44px] flex items-center ${
                  currentTab === 'rosters'
                    ? 'text-red-700 font-bold border-b-2 border-red-600'
                    : 'hover:text-neutral-900'
                }`}
              >
                13 Roster Sheets
              </button>
              <button
                onClick={() => setCurrentTab('attendance')}
                className={`whitespace-nowrap shrink-0 transition-colors py-2 cursor-pointer min-h-[44px] flex items-center ${
                  currentTab === 'attendance'
                    ? 'text-red-700 font-bold border-b-2 border-red-600'
                    : 'hover:text-neutral-900'
                }`}
              >
                Attendance Logs
              </button>
              <button
                onClick={() => setCurrentTab('analytics')}
                className={`whitespace-nowrap shrink-0 transition-colors py-2 cursor-pointer min-h-[44px] flex items-center ${
                  currentTab === 'analytics'
                    ? 'text-red-700 font-bold border-b-2 border-red-600'
                    : 'hover:text-neutral-900'
                }`}
              >
                Analytics
              </button>
            </nav>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-xs text-red-700 font-medium bg-red-50/80 border border-red-100 px-3 py-1.5 rounded-full">
              <QrCode className="w-3.5 h-3.5 text-red-600" />
              <span>Dedicated Live Attendance Scanner Active</span>
            </div>
          )}

          {/* Zone 3: User role switcher + primary action */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* User Switcher Dropdown */}
            <div className="relative">
              <select
                aria-label="Switch User Profile"
                value={currentUser.email}
                onChange={(e) => {
                  const found = INITIAL_USER_PROFILES.find((u) => u.email === e.target.value);
                  if (found) {
                    setCurrentUser(found);
                    if (found.role === 'coordinator') {
                      setCurrentTab('scanner');
                    }
                  }
                }}
                className="text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 rounded-lg px-2.5 py-2 font-medium text-neutral-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
              >
                {INITIAL_USER_PROFILES.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.role === 'admin' ? '🛡️ Admin' : '👤 Coord'}: {u.name.split(' ')[0]} ({u.email.split('@')[0]})
                  </option>
                ))}
              </select>
            </div>

            {/* Apps Script Webhook & Architecture Info Button */}
            <button
              onClick={onOpenArchitecture}
              title="Google Apps Script Webhook & Architecture"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Apps Script Webhook</span>
            </button>

            {/* Primary Action Button */}
            {!isCoordinator ? (
              <button
                onClick={onOpenNewEvent}
                className="px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs min-h-[44px] flex items-center"
              >
                + New Event
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg min-h-[44px]">
                <span className="w-2 h-2 rounded-full bg-red-600" />
                <span className="whitespace-nowrap">Scanner Ready</span>
              </div>
            )}

            {/* Log Out Button */}
            <button
              onClick={onLogout}
              title="Log out and return to Login Screen"
              className="p-2 sm:px-2.5 sm:py-2 text-xs font-semibold text-neutral-700 hover:text-red-700 bg-neutral-100 hover:bg-red-50 border border-neutral-200 hover:border-red-200 rounded-lg transition-colors cursor-pointer min-h-[44px] flex items-center gap-1.5 shadow-2xs"
            >
              <LogOut className="w-4 h-4 text-neutral-600 group-hover:text-red-600" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar (ONLY FOR ADMIN - HIDE FOR COORDINATORS) */}
        {!isCoordinator && (
          <div className="flex md:hidden items-center justify-between py-2 border-t border-neutral-100 text-xs overflow-x-auto gap-2">
            <button
              onClick={() => setCurrentTab('scanner')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md min-h-[36px] ${
                currentTab === 'scanner' ? 'font-bold bg-red-50 text-red-700' : 'text-neutral-600'
              }`}
            >
              Scanner
            </button>
            <button
              onClick={() => setCurrentTab('events')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md min-h-[36px] ${
                currentTab === 'events' ? 'font-bold bg-red-50 text-red-700' : 'text-neutral-600'
              }`}
            >
              Events
            </button>
            <button
              onClick={() => setCurrentTab('rosters')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md min-h-[36px] ${
                currentTab === 'rosters' ? 'font-bold bg-red-50 text-red-700' : 'text-neutral-600'
              }`}
            >
              13 Sheets
            </button>
            <button
              onClick={() => setCurrentTab('attendance')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md min-h-[36px] ${
                currentTab === 'attendance' ? 'font-bold bg-red-50 text-red-700' : 'text-neutral-600'
              }`}
            >
              Attendance
            </button>
            <button
              onClick={() => setCurrentTab('analytics')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md min-h-[36px] ${
                currentTab === 'analytics' ? 'font-bold bg-red-50 text-red-700' : 'text-neutral-600'
              }`}
            >
              Analytics
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
