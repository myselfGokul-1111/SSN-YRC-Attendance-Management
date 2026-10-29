import React, { useState } from 'react';
import { PCDEvent, PCDType, UserProfile } from '../types';
import { PCDStorageService } from '../services/storage';
import { ScannerView } from './ScannerView';
import {
  Calendar,
  Clock,
  MapPin,
  Mail,
  Plus,
  Trash2,
  Users,
  Copy,
  Check,
  ChevronRight,
  Send,
  X,
  AlertCircle,
  QrCode,
} from 'lucide-react';

interface EventsViewProps {
  events: PCDEvent[];
  currentUser: UserProfile;
  onEventsChanged: () => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  currentUser,
  onEventsChanged,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) => {
  const [activeScanningEvent, setActiveScanningEvent] = useState<PCDEvent | null>(null);
  const [copiedLinkEventId, setCopiedLinkEventId] = useState<string | null>(null);

  // New Event form state
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [targetPcd, setTargetPcd] = useState<'ALL' | PCDType>('ALL');
  const [coordinatorsText, setCoordinatorsText] = useState('');
  const [autoNotifyCoords, setAutoNotifyCoords] = useState(true);

  // Email status feedback
  const [notifyingEventId, setNotifyingEventId] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  /**
   * Constructs direct coordinator 1-click scanner link, preserving base subpath (GitHub Pages)
   * and packing event metadata into query params so any device can load and scan immediately.
   */
  const buildCoordinatorDirectLink = (evt: PCDEvent, coordEmail?: string): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://myselfgokul-1111.github.io';
    const pathname = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') : '/SSN-YRC-Attendance-Management';
    const base = `${origin}${pathname}/`;

    const query = new URLSearchParams({
      event: evt.id,
      name: evt.name,
      date: evt.date,
      start: evt.startTime,
      end: evt.endTime,
      venue: evt.venue,
      pcd: evt.targetPcd,
    });

    if (coordEmail) {
      query.set('coordinator', coordEmail.trim().toLowerCase());
    }

    return `${base}?${query.toString()}`;
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const coords = coordinatorsText
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c.length > 0 && c.includes('@'));

    const createdEvent = PCDStorageService.addEvent({
      name: name.trim(),
      description: 'PCD Activity scheduled by admin.',
      venue: venue.trim() || 'SSN Campus',
      date,
      startTime,
      endTime,
      targetPcd,
      coordinators: coords,
    });

    // Auto-dispatch coordinator emails if requested
    if (autoNotifyCoords && coords.length > 0) {
      setEmailNotice({
        type: 'info',
        message: `Dispatching coordinator invitation emails via Google Apps Script...`,
      });

      Promise.all(
        coords.map((coordEmail) => {
          const directLink = buildCoordinatorDirectLink(createdEvent, coordEmail);
          return PCDStorageService.notifyCoordinator({
            coordinatorEmail: coordEmail,
            eventName: createdEvent.name,
            eventDate: createdEvent.date,
            startTime: createdEvent.startTime,
            endTime: createdEvent.endTime,
            venue: createdEvent.venue,
            directLink,
          });
        })
      ).then((results) => {
        const hasAuthError = results.some(
          (r) => !r.success && r.error && (r.error.includes('MailApp.sendEmail') || r.error.includes('permission'))
        );

        if (hasAuthError) {
          setEmailNotice({
            type: 'error',
            message: `⚠️ Action Required in Google Apps Script: Email permissions (MailApp) need authorization. In Apps Script Editor, run 'authorizeEmailPermissions' and click 'Allow'.`,
          });
          setTimeout(() => setEmailNotice(null), 12000);
        } else {
          setEmailNotice({
            type: 'success',
            message: `✓ Event created! Assignment emails sent to ${coords.join(', ')} with 1-click scanner links, credentials & ${startTime}-${endTime} access window.`,
          });
          setTimeout(() => setEmailNotice(null), 8000);
        }
      });
    }

    onEventsChanged();
    setIsCreateModalOpen(false);
    // Reset form
    setName('');
    setVenue('');
    setCoordinatorsText('');
  };

  const handleNotifyCoordinatorsForEvent = async (e: React.MouseEvent, evt: PCDEvent) => {
    e.stopPropagation();
    if (!evt.coordinators || evt.coordinators.length === 0) {
      setEmailNotice({
        type: 'info',
        message: 'No coordinator emails are assigned to this event.',
      });
      setTimeout(() => setEmailNotice(null), 4000);
      return;
    }

    setNotifyingEventId(evt.id);
    const results = await Promise.all(
      evt.coordinators.map((coordEmail) => {
        const directLink = buildCoordinatorDirectLink(evt, coordEmail);
        return PCDStorageService.notifyCoordinator({
          coordinatorEmail: coordEmail,
          eventName: evt.name,
          eventDate: evt.date,
          startTime: evt.startTime,
          endTime: evt.endTime,
          venue: evt.venue,
          directLink,
        });
      })
    );
    setNotifyingEventId(null);

    const hasAuthError = results.some(
      (r) => !r.success && r.error && (r.error.includes('MailApp.sendEmail') || r.error.includes('permission'))
    );

    if (hasAuthError) {
      setEmailNotice({
        type: 'error',
        message: `⚠️ Google Apps Script Email Authorization Required: Run 'authorizeEmailPermissions' once in your Google Apps Script editor.`,
      });
      setTimeout(() => setEmailNotice(null), 12000);
    } else {
      setEmailNotice({
        type: 'success',
        message: `✓ Assignment emails sent to ${evt.coordinators.join(', ')} with login credentials, 1-click link, and ${evt.startTime}-${evt.endTime} time limits!`,
      });
      setTimeout(() => setEmailNotice(null), 7000);
    }
  };

  const copyDirectLink = (e: React.MouseEvent, evt: PCDEvent, coordEmail?: string) => {
    e.stopPropagation();
    const link = buildCoordinatorDirectLink(evt, coordEmail);
    navigator.clipboard.writeText(link);
    setCopiedLinkEventId(evt.id);
    setTimeout(() => setCopiedLinkEventId(null), 2000);
  };

  const handleDeleteEvent = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this event and its attendance?')) {
      PCDStorageService.deleteEvent(eventId);
      if (activeScanningEvent?.id === eventId) {
        setActiveScanningEvent(null);
      }
      onEventsChanged();
    }
  };

  // If an event is selected for scanning, render the live scanner directly inside this tab
  if (activeScanningEvent) {
    return (
      <ScannerView
        event={activeScanningEvent}
        currentUser={currentUser}
        onBack={() => setActiveScanningEvent(null)}
        onAttendanceUpdated={onEventsChanged}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3.5">
      {/* Top Banner - Mobile Friendly */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
            SSN PCD Activities
          </h1>
          <p className="text-xs text-neutral-500 font-medium">
            Schedule activities, set coordinator scanning windows, and launch the live scanner.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors shrink-0 min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>Create Event</span>
        </button>
      </div>

      {/* Gmail notification feedback toast */}
      {emailNotice && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 shadow-xs transition-all ${
            emailNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : emailNotice.type === 'error'
              ? 'bg-red-50 text-red-900 border border-red-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{emailNotice.message}</span>
          </div>
          <button
            onClick={() => setEmailNotice(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <div className="bg-white border border-dashed border-neutral-300 rounded-xl p-8 sm:p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-neutral-800">
            No Events Scheduled Yet
          </h2>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Click "Create Event" above to schedule an activity and assign coordinator access.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors min-h-[40px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Event</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => {
            const attCount = PCDStorageService.getAttendanceForEvent(evt.id).length;
            const timeCheck = PCDStorageService.checkCoordinatorTimeAccess(evt);

            return (
              <div
                key={evt.id}
                onClick={() => setActiveScanningEvent(evt)}
                className="bg-white border border-neutral-200 hover:border-neutral-400 rounded-xl p-3.5 sm:p-4 shadow-xs transition-all cursor-pointer group space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-neutral-900 group-hover:text-neutral-700 transition-colors">
                        {evt.name}
                      </h3>
                      <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                        {attCount} Scanned
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          timeCheck.allowed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {timeCheck.allowed ? 'Open for Scanning' : 'Time Locked'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                        {evt.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        {evt.startTime} - {evt.endTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        {evt.venue}
                      </span>
                    </div>
                  </div>

                  {/* Actions - Mobile friendly buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap pt-1 sm:pt-0">
                    <button
                      onClick={(e) => copyDirectLink(e, evt, evt.coordinators[0])}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors min-h-[36px]"
                      title="Copy Coordinator Direct Link"
                    >
                      {copiedLinkEventId === evt.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    {evt.coordinators && evt.coordinators.length > 0 && (
                      <button
                        onClick={(e) => handleNotifyCoordinatorsForEvent(e, evt)}
                        disabled={notifyingEventId === evt.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors min-h-[36px]"
                        title="Send assignment email with credentials & duration limit"
                      >
                        {notifyingEventId === evt.id ? (
                          <span className="text-neutral-500 animate-pulse">Sending...</span>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5 text-neutral-700" />
                            <span>Email Coords</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDeleteEvent(e, evt.id)}
                      className="p-2 text-neutral-400 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Delete Event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Prominent Scanner Launch Button */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                  <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-neutral-400" />
                    <span>
                      {evt.coordinators.length > 0
                        ? `${evt.coordinators.length} Coordinator(s) Assigned`
                        : 'Admin Only'}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-black text-red-600 group-hover:text-red-700 group-hover:translate-x-0.5 transition-all">
                    <span>Open Scanner</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE EVENT MODAL - Mobile Friendly */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-neutral-900" />
                <h2 className="text-sm sm:text-base font-black text-neutral-900">
                  Create PCD Activity
                </h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Activity Name:
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Blood Donation Camp 2026 or Campus Marathon"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 min-h-[40px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Event Date:
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 min-h-[40px]"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Venue:
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. Main Auditorium / Ground"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 min-h-[40px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Scanning Start Time:
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 min-h-[40px]"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Scanning End Time:
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 min-h-[40px]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Target PCD Wing:
                </label>
                <select
                  value={targetPcd}
                  onChange={(e) => setTargetPcd(e.target.value as any)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 min-h-[40px]"
                >
                  <option value="ALL">All Wings (YRC · NSS · NSO · NReg)</option>
                  <option value="YRC">YRC (Youth Red Cross) Only</option>
                  <option value="NSS">NSS (National Service Scheme) Only</option>
                  <option value="NSO">NSO (National Sports Org) Only</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Assign Coordinator SSN Emails (Comma separated):
                </label>
                <input
                  type="text"
                  value={coordinatorsText}
                  onChange={(e) => setCoordinatorsText(e.target.value)}
                  placeholder="gokul2470019@ssn.edu.in, coord2@ssn.edu.in"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono focus:ring-2 focus:ring-neutral-400 min-h-[40px]"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Coordinators get immediate scanner access within the {startTime} - {endTime} window.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoNotify"
                  checked={autoNotifyCoords}
                  onChange={(e) => setAutoNotifyCoords(e.target.checked)}
                  className="rounded text-neutral-900 focus:ring-neutral-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="autoNotify" className="font-semibold text-neutral-700 cursor-pointer">
                  Automatically email credentials & 1-click scanner link to coordinators via Gmail
                </label>
              </div>

              <div className="flex gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-bold min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-xs transition-colors min-h-[42px]"
                >
                  Create & Schedule Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
