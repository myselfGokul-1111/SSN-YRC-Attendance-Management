import React, { useState, useEffect } from 'react';
import { PCDEvent, UserProfile } from './types';
import { PCDStorageService } from './services/storage';
import { Navbar } from './components/Navbar';
import { EventsView } from './components/EventsView';
import { DatabaseView } from './components/DatabaseView';
import { AnalyticsView } from './components/AnalyticsView';
import { ScannerView } from './components/ScannerView';
import { LoginPage } from './components/LoginPage';
import { SettingsModal } from './components/SettingsModal';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'events' | 'database' | 'analytics'>('events');
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => PCDStorageService.getCurrentUser());
  const [events, setEvents] = useState<PCDEvent[]>(() => PCDStorageService.getEvents());
  const [targetEventId, setTargetEventId] = useState<string>('');

  // Authentication state
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);

  const isCoordinator = currentUser.role === 'coordinator';

  // Parse URL search parameters on initial load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const eventParam = params.get('event') || params.get('eventId');
    const coordinatorParam = params.get('coordinator') || params.get('email');

    if (coordinatorParam) {
      const trimmed = coordinatorParam.trim().toLowerCase();
      const coordUser: UserProfile = {
        email: trimmed,
        name: trimmed.split('@')[0].toUpperCase(),
        role: 'coordinator',
        department: 'Assigned Coordinator',
      };
      setCurrentUser(coordUser);
      PCDStorageService.setAuthSession(coordUser);
      setIsAuthenticated(true);
    }

    if (eventParam) {
      setTargetEventId(eventParam);

      // Hydrate event if opened on a coordinator's mobile or laptop where localStorage was empty
      const currentEvents = PCDStorageService.getEvents();
      const existing = currentEvents.find((e) => e.id === eventParam);
      const nameParam = params.get('name');
      if (!existing && nameParam) {
        const hydratedEvent: PCDEvent = {
          id: eventParam,
          name: nameParam,
          description: 'PCD Activity scheduled by admin.',
          venue: params.get('venue') || 'SSN Campus',
          date: params.get('date') || new Date().toISOString().split('T')[0],
          startTime: params.get('start') || '09:00',
          endTime: params.get('end') || '17:00',
          targetPcd: (params.get('pcd') as any) || 'ALL',
          coordinators: coordinatorParam ? [coordinatorParam.trim().toLowerCase()] : [],
          sheetTabName: `PCD - ${nameParam.substring(0, 30)}`,
          createdAt: new Date().toISOString(),
        };
        const updated = [hydratedEvent, ...currentEvents];
        PCDStorageService.saveEvents(updated);
        setEvents(updated);
      }
    }
  }, []);

  // Background Auto-Sync with Google Sheets
  useEffect(() => {
    // Initial silent sync on mount
    PCDStorageService.syncStudentsFromGoogleSheet().catch(() => {});

    // Periodic background sync every 60 seconds
    const interval = setInterval(() => {
      PCDStorageService.syncStudentsFromGoogleSheet().catch(() => {});
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    PCDStorageService.clearAuthSession();
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setIsAuthenticated(false);
  };

  const refreshEvents = () => {
    setEvents(PCDStorageService.getEvents());
  };

  // Find assigned event for coordinator
  let coordinatorEvent: PCDEvent | undefined;
  if (isCoordinator) {
    if (targetEventId) {
      coordinatorEvent = events.find((e) => e.id === targetEventId);
    }
    if (!coordinatorEvent) {
      coordinatorEvent = events.find((e) =>
        e.coordinators.some((c) => c.toLowerCase() === currentUser.email.toLowerCase())
      );
    }
    if (!coordinatorEvent && events.length > 0) {
      coordinatorEvent = events[0];
    }
  }

  // Render Login page if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginPage
        events={events}
        onAdminLoginSuccess={(adminUser) => {
          setCurrentUser(adminUser);
          setIsAuthenticated(true);
          setCurrentTab('events');
        }}
        onCoordinatorDirectAccess={(coordUser, eventId) => {
          setCurrentUser(coordUser);
          if (eventId) {
            setTargetEventId(eventId);
          }
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100/70 font-sans text-neutral-900 flex flex-col antialiased selection:bg-neutral-900 selection:text-white">
      {/* Navigation Header with Mobile Bottom Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUser={currentUser}
        activeEventName={coordinatorEvent?.name}
        onOpenNewEvent={() => setIsCreateEventModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area - padded at bottom for mobile sticky navigation */}
      <main className="flex-1 pb-20 sm:pb-10">
        {isCoordinator ? (
          /* ================= COORDINATOR VIEW ================= */
          coordinatorEvent ? (
            <ScannerView
              event={coordinatorEvent}
              currentUser={currentUser}
              onAttendanceUpdated={refreshEvents}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-6 bg-white border border-neutral-200 rounded-2xl shadow-xs text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-neutral-900">No Event Assigned Yet</h2>
              <p className="text-xs text-neutral-600">
                Logged in as <b>{currentUser.email}</b>, but no active PCD event has been assigned to this email address yet.
              </p>
              <p className="text-[11px] text-neutral-400">
                Please contact the SSN PCD Administrator to schedule an event and assign coordinator access.
              </p>
            </div>
          )
        ) : (
          /* ================= ADMIN VIEW (3 TABS) ================= */
          <>
            {currentTab === 'events' && (
              <EventsView
                events={events}
                currentUser={currentUser}
                onEventsChanged={refreshEvents}
                isCreateModalOpen={isCreateEventModalOpen}
                setIsCreateModalOpen={setIsCreateEventModalOpen}
              />
            )}

            {currentTab === 'database' && <DatabaseView />}

            {currentTab === 'analytics' && <AnalyticsView events={events} />}
          </>
        )}
      </main>

      {/* Google Sheet Webhook Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
