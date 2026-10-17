import React, { useState, useEffect } from 'react';
import { SheetName, UserProfile } from './types';
import { PCDStorageService } from './services/storage';
import { Navbar } from './components/Navbar';
import { ScannerView } from './components/ScannerView';
import { EventsView } from './components/EventsView';
import { RosterSheetsView } from './components/RosterSheetsView';
import { AttendanceLogsView } from './components/AttendanceLogsView';
import { AnalyticsView } from './components/AnalyticsView';
import { ArchitectureModal } from './components/ArchitectureModal';
import { YrcEmblem } from './components/YrcEmblem';
import { LoginPage } from './components/LoginPage';
import {
  QrCode,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'scanner' | 'events' | 'rosters' | 'attendance' | 'analytics'>('scanner');
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => PCDStorageService.getCurrentUser());
  const [events, setEvents] = useState(() => PCDStorageService.getEvents());
  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    const list = PCDStorageService.getEvents();
    return list[0]?.id || '';
  });
  const [rosters, setRosters] = useState(() => PCDStorageService.getRosters());
  const [updateLogs, setUpdateLogs] = useState(() => PCDStorageService.getUpdateLogs());

  // Authentication state - coordinators with direct links bypass, otherwise default to login screen
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      // Coordinators with direct link parameters immediately bypass login
      if (params.get('coordinator') || params.get('email') || params.get('event') || params.get('eventId')) {
        return true;
      }
    }
    const session = PCDStorageService.getAuthSession();
    return session.isAuthenticated;
  });

  // Modals
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);

  const isCoordinator = currentUser.role === 'coordinator';

  // Read URL search parameters on initial load (e.g. ?event=evt-123&coordinator=gokul2470019@ssn.edu.in)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const eventParam = params.get('event') || params.get('eventId');
    const coordinatorParam = params.get('coordinator') || params.get('email');

    if (coordinatorParam) {
      const allUsers = PCDStorageService.getAllUsers();
      const existing = allUsers.find(
        (u) => u.email.toLowerCase() === coordinatorParam.toLowerCase()
      );
      const coordUser: UserProfile = existing || {
        email: coordinatorParam,
        name: coordinatorParam.split('@')[0],
        role: 'coordinator',
        department: 'Assigned Coordinator',
      };
      setCurrentUser(coordUser);
      PCDStorageService.setAuthSession(coordUser);
      setIsAuthenticated(true);
      setCurrentTab('scanner');
    }

    if (eventParam) {
      const allEvts = PCDStorageService.getEvents();
      const found = allEvts.find((e) => e.id === eventParam);
      if (found) {
        setSelectedEventId(eventParam);
        setCurrentTab('scanner');
      }
    }
  }, []);

  // Strict role guard: if user is coordinator, keep them locked to the live scanner
  useEffect(() => {
    if (isCoordinator && currentTab !== 'scanner') {
      setCurrentTab('scanner');
    }
  }, [currentUser, isCoordinator, currentTab]);

  // Sync current user change to local storage
  const handleUserChange = (newUser: UserProfile) => {
    setCurrentUser(newUser);
    PCDStorageService.setAuthSession(newUser);
    if (newUser.role === 'coordinator') {
      setCurrentTab('scanner');
    }
  };

  // Logout handler
  const handleLogout = () => {
    PCDStorageService.clearAuthSession();
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setIsAuthenticated(false);
  };

  // Refresh all state from storage
  const refreshData = () => {
    setEvents(PCDStorageService.getEvents());
    setRosters(PCDStorageService.getRosters());
    setUpdateLogs(PCDStorageService.getUpdateLogs());
  };

  // When user clicks "Scan Attendance" from an event card
  const handleSelectEventForScanning = (eventId: string) => {
    setSelectedEventId(eventId);
    setCurrentTab('scanner');
  };

  // Render Login page if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginPage
        events={events}
        onAdminLoginSuccess={(adminUser) => {
          setCurrentUser(adminUser);
          setIsAuthenticated(true);
          setCurrentTab('scanner');
        }}
        onCoordinatorDirectAccess={(coordUser, targetEventId) => {
          setCurrentUser(coordUser);
          if (targetEventId) {
            setSelectedEventId(targetEventId);
          }
          setIsAuthenticated(true);
          setCurrentTab('scanner');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col font-sans antialiased text-neutral-900">
      {/* 3-Zone Top Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUser={currentUser}
        setCurrentUser={handleUserChange}
        onOpenNewEvent={() => {
          setIsCreateEventModalOpen(true);
          setCurrentTab('events');
        }}
        onOpenArchitecture={() => setIsArchitectureOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <main className={`flex-1 ${!isCoordinator ? 'pb-20 md:pb-16' : 'pb-12'}`}>
        {/* If coordinator, ONLY show the live scanner */}
        {isCoordinator ? (
          <ScannerView
            events={events}
            selectedEventId={selectedEventId}
            setSelectedEventId={setSelectedEventId}
            currentUser={currentUser}
            rosters={rosters}
            onAttendanceUpdated={refreshData}
          />
        ) : (
          /* If admin, allow full view switching */
          <>
            {currentTab === 'scanner' && (
              <ScannerView
                events={events}
                selectedEventId={selectedEventId}
                setSelectedEventId={setSelectedEventId}
                currentUser={currentUser}
                rosters={rosters}
                onAttendanceUpdated={refreshData}
              />
            )}

            {currentTab === 'events' && (
              <EventsView
                events={events}
                currentUser={currentUser}
                onEventCreated={refreshData}
                onSelectEventForScanning={handleSelectEventForScanning}
                isCreateModalOpen={isCreateEventModalOpen}
                setIsCreateModalOpen={setIsCreateEventModalOpen}
              />
            )}

            {currentTab === 'rosters' && (
              <RosterSheetsView
                rosters={rosters}
                updateLogs={updateLogs}
                currentUser={currentUser}
                onDataChanged={refreshData}
              />
            )}

            {currentTab === 'attendance' && (
              <AttendanceLogsView
                events={events}
                currentUser={currentUser}
                onDataChanged={refreshData}
              />
            )}

            {currentTab === 'analytics' && (
              <AnalyticsView
                events={events}
                rosters={rosters}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (ONLY FOR ADMIN - Coordinators have distraction-free screen) */}
      {!isCoordinator && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 grid grid-cols-5 items-center h-16 px-1 shadow-lg">
          <button
            onClick={() => setCurrentTab('scanner')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] cursor-pointer ${
              currentTab === 'scanner' ? 'text-red-600 font-bold' : 'text-neutral-500'
            }`}
          >
            <QrCode className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Scanner</span>
          </button>
          <button
            onClick={() => setCurrentTab('events')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] cursor-pointer ${
              currentTab === 'events' ? 'text-red-600 font-bold' : 'text-neutral-500'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Events</span>
          </button>
          <button
            onClick={() => setCurrentTab('rosters')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] cursor-pointer ${
              currentTab === 'rosters' ? 'text-red-600 font-bold' : 'text-neutral-500'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">13 Sheets</span>
          </button>
          <button
            onClick={() => setCurrentTab('attendance')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] cursor-pointer ${
              currentTab === 'attendance' ? 'text-red-600 font-bold' : 'text-neutral-500'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Logs</span>
          </button>
          <button
            onClick={() => setCurrentTab('analytics')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] cursor-pointer ${
              currentTab === 'analytics' ? 'text-red-600 font-bold' : 'text-neutral-500'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Stats</span>
          </button>
        </nav>
      )}

      {/* Footer */}
      <footer className="border-t border-red-100 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <YrcEmblem size={18} />
            <span className="font-bold text-neutral-800">SSN Youth Red Cross (YRC)</span>
            <span aria-hidden="true">·</span>
            <span>13 PCD Sheets · Dynamic Digital ID Routing</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsArchitectureOpen(true)}
              className="hover:text-red-700 transition-colors cursor-pointer font-medium"
            >
              Routing Architecture
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => {
                if (confirm('Reset application data to initial seed state?')) {
                  PCDStorageService.resetToDefaults();
                  refreshData();
                }
              }}
              className="hover:text-red-700 transition-colors cursor-pointer"
            >
              Reset Seed Data
            </button>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px]">SSN College of Engineering</span>
          </div>
        </div>
      </footer>

      {/* Architecture & Routing Documentation Modal */}
      <ArchitectureModal
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
      />
    </div>
  );
}
