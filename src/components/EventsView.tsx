import React, { useState } from 'react';
import { PCDEvent, PCDType, UserProfile, BatchYear } from '../types';
import { PCDStorageService } from '../services/storage';
import { YrcEmblem } from './YrcEmblem';
import {
  Calendar,
  Clock,
  MapPin,
  Mail,
  Plus,
  ExternalLink,
  QrCode,
  CheckCircle2,
  Users,
  Send,
  Eye,
  Trash2,
  Edit,
  AlertTriangle,
} from 'lucide-react';

interface EventsViewProps {
  events: PCDEvent[];
  currentUser: UserProfile;
  onEventCreated: () => void;
  onSelectEventForScanning: (eventId: string) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  currentUser,
  onEventCreated,
  onSelectEventForScanning,
  isCreateModalOpen,
  setIsCreateModalOpen,
}) => {
  // Modal & form states
  const [previewEmailModal, setPreviewEmailModal] = useState<{
    event: PCDEvent;
    recipient: string;
  } | null>(null);

  // Edit Event Modal
  const [editingEvent, setEditingEvent] = useState<PCDEvent | null>(null);

  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    venue: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '13:00',
    targetPcd: 'YRC' as 'ALL' | PCDType,
    targetBatches: ['2025', '2024', '2023'] as BatchYear[],
    coordinatorsText: 'gokul2470019@ssn.edu.in, yrc.officer@ssn.edu.in',
  });

  const [notificationDispatched, setNotificationDispatched] = useState(false);
  const isAdmin = currentUser.role === 'admin';

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.name || !newEvent.venue) return;

    const coordinatorEmails = newEvent.coordinatorsText
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    const createdEvent = PCDStorageService.addEvent({
      name: newEvent.name,
      description: newEvent.description || 'PCD event scheduled by college administration.',
      venue: newEvent.venue,
      date: newEvent.date,
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      targetPcd: newEvent.targetPcd,
      targetBatches: newEvent.targetBatches,
      coordinators: coordinatorEmails.length > 0 ? coordinatorEmails : [currentUser.email],
      status: 'active',
    });

    // Asynchronously notify coordinators via Google Apps Script Webhook if connected
    coordinatorEmails.forEach((coordEmail) => {
      PCDStorageService.notifyCoordinatorViaWebhook(coordEmail, createdEvent).catch(() => {});
    });

    setNotificationDispatched(true);
    onEventCreated();

    setTimeout(() => {
      setNotificationDispatched(false);
      setIsCreateModalOpen(false);
      setNewEvent({
        name: '',
        description: '',
        venue: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '13:00',
        targetPcd: 'YRC',
        targetBatches: ['2025', '2024', '2023'],
        coordinatorsText: 'gokul2470019@ssn.edu.in, yrc.officer@ssn.edu.in',
      });
    }, 1200);
  };

  const handleUpdateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    PCDStorageService.updateEvent(editingEvent.id, {
      name: editingEvent.name,
      venue: editingEvent.venue,
      date: editingEvent.date,
      startTime: editingEvent.startTime,
      endTime: editingEvent.endTime,
      targetPcd: editingEvent.targetPcd,
      description: editingEvent.description,
      status: editingEvent.status,
    });

    onEventCreated();
    setEditingEvent(null);
  };

  const handleDeleteEvent = (event: PCDEvent) => {
    if (confirm(`ADMIN ACTION: Permanently delete event "${event.name}" and purge all its attendance records?`)) {
      PCDStorageService.deleteEvent(event.id);
      onEventCreated();
    }
  };

  const attendanceRecords = PCDStorageService.getAttendance();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header section */}
      <div className="bg-white rounded-2xl border border-red-100 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <YrcEmblem size={24} />
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900">
                PCD Events & Coordinator Allocations
              </h1>
            </div>
            <p className="text-xs text-neutral-500">
              Manage Youth Red Cross & Extension activity schedules, coordinator Gmail assignments, and dedicated attendance sheets.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              Create PCD Event
            </button>
          )}
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => {
          const presentCount = attendanceRecords.filter((a) => a.eventId === event.id).length;

          return (
            <div
              key={event.id}
              className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs flex flex-col justify-between hover:border-red-200 transition-all"
            >
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded ${
                      event.targetPcd === 'YRC'
                        ? 'bg-red-600 text-white'
                        : 'bg-neutral-100 text-neutral-800'
                    }`}
                  >
                    {event.targetPcd === 'ALL' ? 'ALL PCDs' : event.targetPcd}
                  </span>

                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      event.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : event.status === 'upcoming'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {event.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-neutral-900 leading-snug">
                    {event.name}
                  </h3>
                  <p className="text-xs text-neutral-600 mt-1 line-clamp-2 leading-relaxed">
                    {event.description}
                  </p>
                </div>

                <div className="space-y-1.5 text-xs text-neutral-600 pt-2 border-t border-neutral-100">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>{event.date}</span>
                    <span className="text-neutral-300">·</span>
                    <Clock className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>{event.startTime} - {event.endTime}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="truncate">{event.venue}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="truncate">
                      {event.coordinators.length} Coordinator(s) Assigned
                    </span>
                  </div>
                </div>

                {/* Coordinator Emails */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-neutral-400">Assigned Gmail IDs & Direct Access Links:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {event.coordinators.map((email) => {
                      const accessUrl = typeof window !== 'undefined'
                        ? `${window.location.origin}/?event=${event.id}&coordinator=${encodeURIComponent(email)}`
                        : '';
                      return (
                        <div
                          key={email}
                          className={`text-[11px] font-mono px-2 py-1 rounded-lg flex items-center gap-1.5 ${
                            email === currentUser.email
                              ? 'bg-red-600 text-white font-bold'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          <Mail className="w-3 h-3" />
                          <span>{email.split('@')[0]}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(accessUrl);
                              alert(`Copied direct event access link for ${email}!\n\n${accessUrl}`);
                            }}
                            className="p-0.5 hover:opacity-75 transition-opacity cursor-pointer text-[10px]"
                            title={`Copy direct access link for ${email}`}
                          >
                            📋
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Google Sheet Sync badge */}
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <span className="text-[10px] text-neutral-400 block font-semibold">Attendance Google Sheet:</span>
                    <span className="font-mono text-[11px] text-neutral-800 truncate block font-bold">
                      sheet_{event.sheetId.slice(0, 10)}...
                    </span>
                  </div>
                  <a
                    href={event.sheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-red-600 hover:text-red-700 p-2 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Open Google Sheet in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-4 bg-neutral-50/80 border-t border-neutral-100 flex items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="text-neutral-500 font-medium">Checked In: </span>
                  <span className="font-extrabold font-mono text-red-700 text-sm tabular-nums">
                    {presentCount}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Admin Edit / Delete Actions */}
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => setEditingEvent({ ...event })}
                        className="p-2 text-xs text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Edit Event"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event)}
                        className="p-2 text-xs text-neutral-600 hover:text-red-600 bg-white border border-neutral-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Delete Event & Attendance Sheet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() =>
                      setPreviewEmailModal({
                        event,
                        recipient: event.coordinators[0] || currentUser.email,
                      })
                    }
                    className="p-2 text-xs text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="View Automated Notification Email"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onSelectEventForScanning(event.id)}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors flex items-center gap-1 cursor-pointer min-h-[36px]"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Scan
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= MODAL: CREATE EVENT ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Create PCD Attendance Event
                </h3>
                <p className="text-xs text-neutral-500">
                  Provisions dedicated Google Sheet and emails assigned coordinator Gmail IDs.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {notificationDispatched ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-neutral-900">
                  Event Created & Google Sheet Provisioned!
                </h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Automated notification emails dispatched to assigned coordinators.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Event Name</label>
                  <input
                    type="text"
                    required
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                    placeholder="e.g. Mega Blood Donation Camp 2026"
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Venue / Location</label>
                  <input
                    type="text"
                    required
                    value={newEvent.venue}
                    onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                    placeholder="e.g. Central Auditorium & Sports Foyer"
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="w-full px-2.5 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                      className="w-full px-2.5 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">End Time</label>
                    <input
                      type="time"
                      required
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                      className="w-full px-2.5 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Target PCD Activity</label>
                    <select
                      value={newEvent.targetPcd}
                      onChange={(e) => setNewEvent({ ...newEvent, targetPcd: e.target.value as 'ALL' | PCDType })}
                      className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                    >
                      <option value="YRC">YRC (Youth Red Cross)</option>
                      <option value="ALL">ALL (YRC, NSS, NSO, NReg)</option>
                      <option value="NSS">NSS Only</option>
                      <option value="NSO">NSO Only</option>
                      <option value="NReg">NReg Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Target Batches</label>
                    <div className="flex items-center gap-3 pt-2">
                      {(['2025', '2024', '2023'] as BatchYear[]).map((b) => (
                        <label key={b} className="flex items-center gap-1 cursor-pointer min-h-[36px]">
                          <input
                            type="checkbox"
                            checked={newEvent.targetBatches.includes(b)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewEvent({ ...newEvent, targetBatches: [...newEvent.targetBatches, b] });
                              } else {
                                setNewEvent({
                                  ...newEvent,
                                  targetBatches: newEvent.targetBatches.filter((x) => x !== b),
                                });
                              }
                            }}
                            className="rounded text-red-600 focus:ring-red-600 w-4 h-4"
                          />
                          <span className="font-medium">{b}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">
                    Coordinator Gmail IDs (comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    value={newEvent.coordinatorsText}
                    onChange={(e) => setNewEvent({ ...newEvent, coordinatorsText: e.target.value })}
                    placeholder="gokul2470019@ssn.edu.in, yrc.officer@ssn.edu.in"
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Brief Description</label>
                  <textarea
                    rows={2}
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Provide details about attendance criteria..."
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2.5 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors text-neutral-700 cursor-pointer min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Create Event
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT EVENT ================= */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Edit className="w-4 h-4 text-red-600" />
                Edit PCD Event
              </h3>
              <button
                onClick={() => setEditingEvent(null)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateEvent} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-700 font-semibold mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  value={editingEvent.name}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-neutral-700 font-semibold mb-1">Venue</label>
                <input
                  type="text"
                  required
                  value={editingEvent.venue}
                  onChange={(e) => setEditingEvent({ ...editingEvent, venue: e.target.value })}
                  className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editingEvent.date}
                    onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                    className="w-full px-2.5 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={editingEvent.startTime}
                    onChange={(e) => setEditingEvent({ ...editingEvent, startTime: e.target.value })}
                    className="w-full px-2.5 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={editingEvent.endTime}
                    onChange={(e) => setEditingEvent({ ...editingEvent, endTime: e.target.value })}
                    className="w-full px-2.5 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Status</label>
                  <select
                    value={editingEvent.status}
                    onChange={(e) => setEditingEvent({ ...editingEvent, status: e.target.value as 'upcoming' | 'active' | 'completed' })}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Target PCD Activity</label>
                  <select
                    value={editingEvent.targetPcd}
                    onChange={(e) => setEditingEvent({ ...editingEvent, targetPcd: e.target.value as 'ALL' | PCDType })}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  >
                    <option value="YRC">YRC Only</option>
                    <option value="ALL">ALL PCDs</option>
                    <option value="NSS">NSS Only</option>
                    <option value="NSO">NSO Only</option>
                    <option value="NReg">NReg Only</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="px-4 py-2.5 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors text-neutral-700 cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors cursor-pointer min-h-[44px]"
                >
                  Update Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: PREVIEW AUTOMATED EMAIL ================= */}
      {previewEmailModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <YrcEmblem size={20} />
                <h3 className="text-sm font-bold text-neutral-900">
                  Automated YRC Coordinator Assignment Email
                </h3>
              </div>
              <button
                onClick={() => setPreviewEmailModal(null)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="bg-red-50/50 rounded-xl border border-red-100 p-4 space-y-3 text-xs">
              <div className="space-y-1 border-b border-red-100 pb-2">
                <div>
                  <span className="font-bold text-neutral-600">From: </span>
                  <span className="font-mono text-red-800">yrc-officer@ssn.edu.in</span>
                </div>
                <div>
                  <span className="font-bold text-neutral-600">To: </span>
                  <span className="font-mono text-neutral-800">{previewEmailModal.recipient}</span>
                </div>
                <div>
                  <span className="font-bold text-neutral-600">Subject: </span>
                  <span className="font-bold text-neutral-900">
                    SSN YRC Event Attendance Coordinator: {previewEmailModal.event.name}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-neutral-700 leading-relaxed text-[11px]">
                <p>Dear Volunteer / Coordinator,</p>
                <p>
                  You are allocated to record student attendance for the SSN Youth Red Cross session:
                </p>
                <div className="bg-white p-3 rounded-xl border border-red-100 space-y-1 font-mono text-[11px]">
                  <div>• Event: {previewEmailModal.event.name}</div>
                  <div>• Date: {previewEmailModal.event.date} ({previewEmailModal.event.startTime} - {previewEmailModal.event.endTime})</div>
                  <div>• Venue: {previewEmailModal.event.venue}</div>
                  <div>• Dedicated Google Sheet ID: {previewEmailModal.event.sheetId}</div>
                </div>

                {/* Method 1: Direct link */}
                <div className="bg-white p-3.5 rounded-xl border border-red-200 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-red-950 font-sans text-xs">
                    <span className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]">1</span>
                    <span>Method 1: 1-Click Direct Link (No Login Required)</span>
                  </div>
                  <p className="text-neutral-600 font-sans text-[11px]">
                    Click to open your event scanner directly on this browser without entering any password:
                  </p>
                  <div className="p-2 bg-neutral-50 border border-neutral-200 rounded text-[10px] break-all font-mono text-red-700">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/?event=${previewEmailModal.event.id}&coordinator=${encodeURIComponent(previewEmailModal.recipient)}`
                      : ''}
                  </div>
                </div>

                {/* Method 2: Credentials for other devices */}
                <div className="bg-white p-3.5 rounded-xl border border-neutral-200 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-neutral-900 font-sans text-xs">
                    <span className="w-4 h-4 rounded-full bg-neutral-800 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>Method 2: Multi-Device Login (Phone, Tablet, or PC)</span>
                  </div>
                  <p className="text-neutral-600 font-sans text-[11px]">
                    If you open the portal URL on another phone or device, sign in under the <strong>Coordinator Access</strong> tab:
                  </p>
                  <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded font-mono text-[11px] space-y-1 text-neutral-800">
                    <div>Portal: <span className="text-neutral-600">{typeof window !== 'undefined' ? window.location.origin : ''}</span></div>
                    <div>Email ID: <span className="text-red-700 font-bold">{previewEmailModal.recipient}</span></div>
                    <div>Password: <span className="text-red-700 font-bold">{PCDStorageService.getCoordinatorPassword(previewEmailModal.recipient)}</span></div>
                  </div>
                </div>

                <div className="pt-1">
                  <a
                    href={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/?event=${previewEmailModal.event.id}&coordinator=${encodeURIComponent(previewEmailModal.recipient)}`
                        : '#'
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-xs"
                  >
                    <QrCode className="w-4 h-4" />
                    Open My Assigned Event Scanner (Direct)
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/?event=${previewEmailModal.event.id}&coordinator=${encodeURIComponent(previewEmailModal.recipient)}`;
                    navigator.clipboard.writeText(url);
                    alert(`Copied direct access link to clipboard!\n\n${url}`);
                  }}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold rounded-xl text-xs cursor-pointer min-h-[44px]"
                >
                  📋 Copy Direct Link
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const pass = PCDStorageService.getCoordinatorPassword(previewEmailModal.recipient);
                    const text = `Portal: ${window.location.origin}\nEmail: ${previewEmailModal.recipient}\nPassword: ${pass}`;
                    navigator.clipboard.writeText(text);
                    alert(`Copied coordinator login credentials!\n\n${text}`);
                  }}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold rounded-xl text-xs cursor-pointer min-h-[44px]"
                >
                  🔑 Copy Credentials
                </button>
              </div>

              <button
                onClick={() => setPreviewEmailModal(null)}
                className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl text-xs cursor-pointer min-h-[44px]"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
