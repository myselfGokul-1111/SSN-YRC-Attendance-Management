import React, { useState, useEffect, useRef } from 'react';
import { AttendanceRecord, PCDEvent, RoutingLookupResult, SheetName, Student, UserProfile } from '../types';
import { PCDStorageService } from '../services/storage';
import { lookupStudentInRosters, routeDigitalId } from '../utils/routing';
import { playDuplicateWarningBeep, playErrorBeep, playSuccessBeep } from '../utils/audio';
import { BarcodeVisual } from './BarcodeVisual';
import { YrcEmblem } from './YrcEmblem';
import { StudentEmailReceiptModal } from './StudentEmailReceiptModal';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Search,
  ArrowRight,
  Clock,
  Sparkles,
  Download,
  Trash2,
  Calendar,
  MapPin,
  Tag,
  ShieldAlert,
  HeartHandshake,
  Check,
  Mail,
  Send,
} from 'lucide-react';

interface ScannerViewProps {
  events: PCDEvent[];
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
  currentUser: UserProfile;
  rosters: Record<SheetName, Student[]>;
  onAttendanceUpdated: () => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  events,
  selectedEventId,
  setSelectedEventId,
  currentUser,
  rosters,
  onAttendanceUpdated,
}) => {
  // Input & lookup states
  const [digitalIdInput, setDigitalIdInput] = useState('');
  const [currentLookup, setCurrentLookup] = useState<RoutingLookupResult | null>(null);
  const [duplicateRecord, setDuplicateRecord] = useState<AttendanceRecord | null>(null);
  const [autoMarkMode, setAutoMarkMode] = useState(true);
  const [sendStudentEmail, setSendStudentEmail] = useState(true);
  const [previewReceiptRecord, setPreviewReceiptRecord] = useState<AttendanceRecord | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Event & records access control
  const isCoordinator = currentUser.role === 'coordinator';
  const assignedEvents = events.filter((e) =>
    e.coordinators.some((c) => c.toLowerCase() === currentUser.email.toLowerCase())
  );
  const visibleEvents = isCoordinator ? assignedEvents : events;
  const currentEvent = events.find((e) => e.id === selectedEventId) || visibleEvents[0] || events[0];
  const isUserAssignedToCurrentEvent =
    !isCoordinator ||
    currentEvent?.coordinators.some(
      (c) => c.toLowerCase() === currentUser.email.toLowerCase()
    );

  const allAttendance = PCDStorageService.getAttendance();
  const eventAttendance = allAttendance.filter((a) => a.eventId === currentEvent?.id);

  // Camera control
  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setHasCameraPermission(true);

      // Start Barcode detection if BarcodeDetector is supported
      if ('BarcodeDetector' in window) {
        // @ts-expect-error BarcodeDetector browser experimental API
        const detector = new window.BarcodeDetector({
          formats: ['code_128', 'qr_code', 'ean_13', 'code_39', 'upc_a'],
        });

        scanIntervalRef.current = window.setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const rawVal = barcodes[0].rawValue;
                if (rawVal) {
                  handleDigitalIdScan(rawVal, 'barcode_scan');
                }
              }
            } catch {
              // frame detection pass
            }
          }
        }, 600);
      }
    } catch {
      setHasCameraPermission(false);
      setIsCameraActive(false);
      setStatusFeedback({
        type: 'info',
        message: 'Camera unavailable. You can use manual entry or a barcode scanner wedge.',
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Lookup and Process Student ID
  const handleDigitalIdScan = (
    scannedId: string,
    method: 'barcode_scan' | 'manual_input' | 'quick_test' = 'manual_input'
  ) => {
    const cleanId = scannedId.trim();
    if (!cleanId) return;

    setDigitalIdInput(cleanId);
    const result = lookupStudentInRosters(cleanId, rosters);
    setCurrentLookup(result);

    if (!result.student) {
      playErrorBeep();
      setDuplicateRecord(null);
      setStatusFeedback({
        type: 'error',
        message: `Digital ID "${cleanId}" not found in targeted sheets (${result.targetSheets.join(', ') || 'Unknown'}).`,
      });
      return;
    }

    if (!currentEvent) {
      setStatusFeedback({ type: 'warning', message: 'Please select an active event first.' });
      return;
    }

    // Check duplicate attendance
    const existing = PCDStorageService.checkDuplicateAttendance(currentEvent.id, result.student.digitalId);
    if (existing) {
      playDuplicateWarningBeep();
      setDuplicateRecord(existing);
      setStatusFeedback({
        type: 'warning',
        message: `DUPLICATE SCANNED: ${result.student.name} was already marked at ${new Date(existing.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by ${existing.markedByName}.`,
      });
      return;
    }

    setDuplicateRecord(null);

    // Auto mark attendance if enabled
    if (autoMarkMode) {
      submitAttendanceForStudent(result.student, method);
    } else {
      setStatusFeedback({
        type: 'info',
        message: `Student verified: ${result.student.name} (${result.student.dept}). Review and tap Confirm Attendance.`,
      });
    }
  };

  const submitAttendanceForStudent = (
    student: Student,
    method: 'barcode_scan' | 'manual_input' | 'quick_test' = 'manual_input'
  ) => {
    if (!currentEvent) return;

    const res = PCDStorageService.markAttendance({
      eventId: currentEvent.id,
      eventName: currentEvent.name,
      digitalId: student.digitalId,
      name: student.name,
      dept: student.dept,
      registerNumber: student.registerNumber,
      pcd: student.pcd,
      section: student.section,
      batch: student.batch,
      markedBy: currentUser.email,
      markedByName: currentUser.name,
      method,
      studentEmail: student.email,
      emailSent: sendStudentEmail,
    });

    if (res.success && res.record) {
      playSuccessBeep();
      setStatusFeedback({
        type: 'success',
        message: `✓ Attendance marked: ${student.name} (${student.pcd} · ${student.dept})${sendStudentEmail ? ` · Confirmation email dispatched to ${student.email}` : ''}`,
      });
      onAttendanceUpdated();

      // Forward to Google Apps Script Webhook asynchronously if connected
      PCDStorageService.postAttendanceToWebhook(res.record, currentEvent.name).catch(() => {});
    } else if (res.duplicate) {
      playDuplicateWarningBeep();
      setDuplicateRecord(res.duplicate);
      setStatusFeedback({
        type: 'warning',
        message: res.message,
      });
    }
  };

  const handleManualFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (digitalIdInput.trim()) {
      handleDigitalIdScan(digitalIdInput, 'manual_input');
    }
  };

  const handleRemoveAttendance = (id: string, name: string) => {
    if (confirm(`Remove attendance mark for ${name}?`)) {
      PCDStorageService.removeAttendance(id);
      onAttendanceUpdated();
      setStatusFeedback({
        type: 'info',
        message: `Removed attendance record for ${name}.`,
      });
    }
  };

  const handleDownloadEventCsv = () => {
    if (!currentEvent) return;
    const csvContent = PCDStorageService.exportEventAttendanceCsv(currentEvent.id);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SSN_YRC_Attendance_${currentEvent.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Routing preview computation
  const routingPreview = digitalIdInput.length >= 3 ? routeDigitalId(digitalIdInput) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Event Header Banner with SSN YRC Theme */}
      <div className="bg-white rounded-2xl border border-red-100 p-5 sm:p-6 shadow-xs relative overflow-hidden">
        {/* Background watermark badge */}
        <div className="absolute right-3 -bottom-6 opacity-5 pointer-events-none">
          <YrcEmblem size={140} />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 font-medium">
              <span className="flex items-center gap-1.5 text-red-700 font-bold uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded border border-red-200">
                <HeartHandshake className="w-3.5 h-3.5" />
                SSN YRC Event Session
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                {currentEvent ? currentEvent.date : 'No date'}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                {currentEvent ? `${currentEvent.startTime} - ${currentEvent.endTime}` : ''}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900">
                {currentEvent?.name}
              </h1>
              <span className="text-xs font-mono font-bold bg-red-600 text-white px-2.5 py-1 rounded">
                Target: {currentEvent?.targetPcd}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-600">
              <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span className="font-medium">{currentEvent?.venue}</span>
              <span className="text-neutral-300">|</span>
              <span className="font-mono text-neutral-500">Google Sheet: {currentEvent?.sheetId?.slice(0, 10)}...</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Event Switcher */}
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold text-neutral-500 mb-1">
                {isCoordinator ? `Assigned Events (${visibleEvents.length})` : 'Switch Event'}
              </label>
              <select
                aria-label="Select Active Event"
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  setDuplicateRecord(null);
                  setCurrentLookup(null);
                  setStatusFeedback(null);
                }}
                className="text-xs bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2.5 font-medium text-neutral-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
              >
                {visibleEvents.length === 0 ? (
                  <option value="">No events assigned to you</option>
                ) : (
                  visibleEvents.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.name} ({evt.date})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Attendance Count Stat */}
            <div className="bg-red-50/80 border border-red-200 rounded-lg px-4 py-2 text-center sm:text-right min-h-[44px] flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
              <div className="text-[11px] font-semibold text-red-800">Checked In</div>
              <div className="text-xl font-extrabold font-mono tabular-nums text-red-700">
                {eventAttendance.length}
              </div>
            </div>

            <button
              onClick={handleDownloadEventCsv}
              className="px-3.5 py-2.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5 text-red-700" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Access Restriction Guard for Coordinators */}
      {isCoordinator && !isUserAssignedToCurrentEvent ? (
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-neutral-900">
              Access Restricted: Not Assigned to this Event
            </h3>
            <p className="text-xs text-neutral-600 max-w-md mx-auto leading-relaxed">
              Your coordinator email (<span className="font-mono font-bold text-neutral-900">{currentUser.email}</span>) is not assigned to take attendance for &quot;{currentEvent?.name}&quot;.
            </p>
          </div>
          {assignedEvents.length > 0 ? (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-neutral-500 font-medium">Switch to your assigned event:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {assignedEvents.map((ae) => (
                  <button
                    key={ae.id}
                    onClick={() => setSelectedEventId(ae.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs min-h-[44px]"
                  >
                    Open: {ae.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-red-700 font-semibold bg-red-50 p-2.5 rounded-lg max-w-sm mx-auto">
              You do not have any active events assigned. Please reach out to Dr. R. Ramanathan (PCD Dean &amp; Admin).
            </p>
          )}
        </div>
      ) : (
        /* Main Scanner Section Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column: Camera Scanner & Input (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Scanner Viewport Box */}
          <div className="bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 text-white p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <YrcEmblem size={20} />
                <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-neutral-200">
                  Live Barcode & Camera Scanner
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {isCameraActive && (
                  <button
                    onClick={() => {
                      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
                      setTimeout(startCamera, 100);
                    }}
                    className="p-2 text-xs text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Flip Camera"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => {
                    if (isCameraActive) {
                      stopCamera();
                    } else {
                      startCamera();
                    }
                  }}
                  className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
                    isCameraActive
                      ? 'bg-rose-900/70 hover:bg-rose-800 text-rose-200 border border-rose-700'
                      : 'bg-red-600 hover:bg-red-500 text-white shadow-xs'
                  }`}
                >
                  {isCameraActive ? (
                    <>
                      <CameraOff className="w-4 h-4" /> Stop Camera
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" /> Start Camera
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Video Viewport with Red Laser HUD */}
            <div className="relative aspect-video sm:aspect-16/9 bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center">
              {isCameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Scanner HUD Overlay with Youth Red Cross Styling */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                    <div className="w-64 sm:w-80 h-36 sm:h-44 border-2 border-red-500/90 rounded-xl relative overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                      {/* Red Laser scanning line animation */}
                      <div className="w-full h-1 bg-red-500 absolute top-0 left-0 animate-pulse transition-all shadow-[0_0_12px_#ef4444]" />
                      <div className="absolute top-2 left-2 text-[10px] font-mono text-red-400 uppercase tracking-widest bg-black/70 px-2 py-0.5 rounded font-bold">
                        Align Student Barcode
                      </div>
                      {/* Reticle corner marks */}
                      <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-red-400" />
                      <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-red-400" />
                      <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-red-400" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-red-500">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-300">
                      Camera Standby
                    </p>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                      Tap &quot;Start Camera&quot; to scan printed student ID cards, or use manual Digital ID input below.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Options bar below camera */}
            <div className="mt-4 pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-300 min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={autoMarkMode}
                    onChange={(e) => setAutoMarkMode(e.target.checked)}
                    className="rounded text-red-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium">Auto-Submit Attendance</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-300 min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={sendStudentEmail}
                    onChange={(e) => setSendStudentEmail(e.target.checked)}
                    className="rounded text-red-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-red-400" />
                    <span>Email Confirmation to Student</span>
                  </span>
                </label>
              </div>

              <div className="text-[11px] text-neutral-400 font-mono">
                Coordinator: <span className="text-red-400 font-bold">{currentUser.name}</span>
              </div>
            </div>
          </div>

          {/* Manual Entry & Hardware Barcode Reader Input */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">
                  Manual Entry / Barcode Scanner Wedge
                </h2>
                <p className="text-xs text-neutral-500">
                  Scan barcode with USB hand scanner or enter Digital ID (e.g. 2511064, 2570070)
                </p>
              </div>
              <span className="text-xs font-mono bg-neutral-100 text-neutral-700 px-2 py-1 rounded font-semibold">
                ↵ Enter
              </span>
            </div>

            <form onSubmit={handleManualFormSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={digitalIdInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDigitalIdInput(val);
                    if (val.length >= 3) {
                      const res = lookupStudentInRosters(val, rosters);
                      setCurrentLookup(res);
                      if (res.student && currentEvent) {
                        const dup = PCDStorageService.checkDuplicateAttendance(currentEvent.id, res.student.digitalId);
                        setDuplicateRecord(dup || null);
                      }
                    }
                  }}
                  placeholder="Scan or type Digital ID (e.g. 2511064, 2470019)..."
                  className="w-full pl-10 pr-4 py-3 text-sm bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 font-mono tracking-wider text-neutral-900 min-h-[44px]"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="px-6 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap min-h-[44px] shadow-xs"
              >
                Scan ID
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Dynamic Routing Real-Time Explanation Card */}
            {routingPreview && (
              <div className="p-3.5 bg-red-50/60 rounded-xl border border-red-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold text-red-900">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-red-600" />
                    <span>Dynamic Dataset Routing:</span>
                  </div>
                  <span className="font-mono text-red-700 font-extrabold">
                    Target Batch: {routingPreview.targetBatch}
                  </span>
                </div>
                <p className="text-neutral-700 leading-relaxed text-[11px]">
                  {routingPreview.reasoning}
                </p>
                <div className="flex flex-wrap items-center gap-1 pt-1 text-[11px] text-neutral-600 font-mono">
                  <span>Targeted Sheets:</span>
                  {routingPreview.targetSheets.map((sh) => (
                    <span key={sh} className="bg-white border border-red-200 px-1.5 py-0.5 rounded text-red-800 font-bold">
                      {sh}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Student Profile Preview & Scan Activity Feed (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Status Message Notification */}
          {statusFeedback && (
            <div
              className={`p-4 rounded-xl border text-xs font-semibold flex items-start gap-3 transition-all ${
                statusFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : statusFeedback.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : statusFeedback.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-800'
              }`}
            >
              {statusFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
              {statusFeedback.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
              {statusFeedback.type === 'error' && <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
              <div className="leading-snug">{statusFeedback.message}</div>
            </div>
          )}

          {/* Student Profile Preview Card */}
          {currentLookup?.student ? (
            <div className="bg-white rounded-2xl border border-red-100 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Student Verification Profile
                </span>
                <span
                  className={`text-xs font-mono px-2.5 py-0.5 rounded font-extrabold ${
                    currentLookup.student.pcd === 'YRC'
                      ? 'bg-red-600 text-white'
                      : 'bg-neutral-900 text-white'
                  }`}
                >
                  {currentLookup.student.pcd}
                </span>
              </div>

              {/* Duplicate Warning Alert */}
              {duplicateRecord && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Duplicate Scan Blocked</div>
                    <div className="mt-0.5 text-amber-800">
                      Already registered at {new Date(duplicateRecord.timestamp).toLocaleTimeString()} by{' '}
                      <span className="font-semibold">{duplicateRecord.markedByName}</span>.
                    </div>
                  </div>
                </div>
              )}

              {/* Student details */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight">
                    {currentLookup.student.name}
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5">
                    {currentLookup.student.email}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs">
                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-100">
                    <span className="text-neutral-500 text-[11px] block">Digital ID</span>
                    <span className="font-mono font-bold text-neutral-900 text-sm">
                      {currentLookup.student.digitalId}
                    </span>
                  </div>

                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-100">
                    <span className="text-neutral-500 text-[11px] block">Register Number</span>
                    <span className="font-mono font-semibold text-neutral-900 text-sm">
                      {currentLookup.student.registerNumber}
                    </span>
                  </div>

                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-100">
                    <span className="text-neutral-500 text-[11px] block">Department & Section</span>
                    <span className="font-semibold text-neutral-900">
                      {currentLookup.student.dept} ({currentLookup.student.section})
                    </span>
                  </div>

                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-100">
                    <span className="text-neutral-500 text-[11px] block">Batch & Sheet</span>
                    <span className="font-semibold text-neutral-900">
                      Batch {currentLookup.student.batch} · [{currentLookup.student.sourceSheet}]
                    </span>
                  </div>
                </div>

                {/* SVG Barcode Visual of Student ID */}
                <div className="py-2.5 flex justify-center bg-neutral-50 rounded-xl border border-neutral-100">
                  <BarcodeVisual value={currentLookup.student.digitalId} height={40} />
                </div>

                {/* Confirm Action Button if not duplicate and not auto-marked */}
                {!duplicateRecord && (
                  <button
                    onClick={() => {
                      if (currentLookup.student) {
                        submitAttendanceForStudent(currentLookup.student, 'manual_input');
                      }
                    }}
                    className="w-full py-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm & Record Attendance
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-red-100 p-8 shadow-xs text-center text-neutral-500 space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-600">
                <YrcEmblem size={28} />
              </div>
              <h3 className="text-sm font-bold text-neutral-800">
                SSN YRC Attendance Terminal
              </h3>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                Aim scanner at student ID barcode or enter Digital ID. The dynamic routing algorithm resolves the student profile instantly across all 13 sheets.
              </p>
            </div>
          )}

          {/* Recent Event Attendance Feed */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Live Attendance Feed
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                {eventAttendance.length} Present
              </span>
            </div>

            {eventAttendance.length === 0 ? (
              <div className="text-center py-6 text-xs text-neutral-400">
                No attendance marked yet for this event. Start scanning!
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {eventAttendance.slice(0, 10).map((record) => (
                  <div
                    key={record.id}
                    className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900 truncate">
                          {record.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 rounded ${
                            record.pcd === 'YRC'
                              ? 'bg-red-600 text-white'
                              : 'bg-white border border-neutral-200 text-neutral-700'
                          }`}
                        >
                          {record.pcd}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                        <span className="font-mono font-semibold">{record.digitalId}</span>
                        <span>·</span>
                        <span>{record.dept}</span>
                        <span>·</span>
                        <span className="font-mono">
                          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewReceiptRecord(record)}
                        className="text-neutral-400 hover:text-red-600 transition-colors p-2 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-red-50"
                        title="View / Resend Confirmation Email to Student"
                      >
                        <Mail className="w-4 h-4 text-red-600" />
                      </button>

                      <button
                        onClick={() => handleRemoveAttendance(record.id, record.name)}
                        className="text-neutral-400 hover:text-red-600 transition-colors p-2 cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-red-50"
                        title="Undo / Remove attendance"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Student Email Confirmation Receipt Modal */}
      <StudentEmailReceiptModal
        record={previewReceiptRecord}
        event={currentEvent}
        onClose={() => setPreviewReceiptRecord(null)}
        onResend={(recordId) => {
          PCDStorageService.resendStudentConfirmationEmail(recordId);
          onAttendanceUpdated();
        }}
      />
    </div>
  );
};
