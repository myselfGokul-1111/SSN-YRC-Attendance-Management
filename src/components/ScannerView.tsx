import React, { useState, useEffect, useRef } from 'react';
import { AttendanceRecord, PCDEvent, Student, UserProfile } from '../types';
import { PCDStorageService } from '../services/storage';
import { playDuplicateWarningBeep, playErrorBeep, playSuccessBeep } from '../utils/audio';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  Clock,
  ArrowLeft,
  Tag,
  Lock,
  Calendar,
  MapPin,
  Check,
  Mail,
  FlipHorizontal,
  RefreshCw,
} from 'lucide-react';

interface ScannerViewProps {
  event: PCDEvent;
  currentUser: UserProfile;
  onBack?: () => void;
  onAttendanceUpdated?: () => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  event,
  currentUser,
  onBack,
  onAttendanceUpdated,
}) => {
  const isCoordinator = currentUser.role === 'coordinator';

  // Input & student state
  const [inputCode, setInputCode] = useState('');
  const [identifiedStudent, setIdentifiedStudent] = useState<Student | null>(null);
  const [duplicateRecord, setDuplicateRecord] = useState<AttendanceRecord | null>(null);
  const [remarks, setRemarks] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);

  // Time window status for coordinators
  const timeStatus = PCDStorageService.checkCoordinatorTimeAccess(event);
  const isLocked = isCoordinator && !timeStatus.allowed;

  // Attendance for this event
  const [records, setRecords] = useState<AttendanceRecord[]>(() =>
    PCDStorageService.getAttendanceForEvent(event.id)
  );

  const refreshRecords = () => {
    const list = PCDStorageService.getAttendanceForEvent(event.id);
    setRecords(list);
    if (onAttendanceUpdated) onAttendanceUpdated();
  };

  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);

  // Periodic multi-device live attendance sync from Google Sheet tab
  useEffect(() => {
    let isSubscribed = true;
    const syncAttendance = async () => {
      try {
        await PCDStorageService.syncAttendanceForEvent(
          event.id,
          event.name,
          event.sheetTabName
        );
        if (isSubscribed) {
          const list = PCDStorageService.getAttendanceForEvent(event.id);
          setRecords(list);
          if (onAttendanceUpdated) onAttendanceUpdated();
        }
      } catch {
        // ignore
      }
    };

    syncAttendance();
    const interval = setInterval(syncAttendance, 20000); // 20s interval
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [event.id]);

  const handleManualAttendanceSync = async () => {
    setIsSyncingAttendance(true);
    try {
      await PCDStorageService.syncAttendanceForEvent(
        event.id,
        event.name,
        event.sheetTabName
      );
      refreshRecords();
      setFeedback({
        type: 'success',
        message: '✓ Attendance synced with Google Sheet tab in real-time.',
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({
        type: 'warning',
        message: 'Could not sync attendance. Using local data.',
      });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setIsSyncingAttendance(false);
    }
  };

  const triggerHaptic = (pattern: number[] = [80]) => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // ignore
    }
  };

  // Quick remarks options
  const quickRemarks = ['Volunteer Lead', 'Late Entry', 'Organizing Team', 'Special Duty', 'Medical Help'];

  // Barcode detector initialization
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      try {
        // @ts-ignore
        detectorRef.current = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'upc_a'],
        });
      } catch {
        // fallback
      }
    }
  }, []);

  // Camera stream handler
  const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
    if (isLocked) return;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setCameraPermission(true);
    } catch (err) {
      setCameraPermission(false);
      setFeedback({ type: 'error', message: 'Camera permission denied or camera unavailable.' });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (isCameraActive) {
      startCamera(nextMode);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Frame detection loop
  useEffect(() => {
    let animId: number;
    const scanFrame = async () => {
      if (isCameraActive && videoRef.current && detectorRef.current && videoRef.current.readyState >= 2) {
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0) {
            const rawVal = barcodes[0].rawValue;
            if (rawVal && rawVal !== inputCode) {
              handleCodeInput(rawVal);
            }
          }
        } catch {
          // ignore
        }
      }
      if (isCameraActive) {
        animId = requestAnimationFrame(scanFrame);
      }
    };

    if (isCameraActive) {
      animId = requestAnimationFrame(scanFrame);
    }
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isCameraActive, inputCode]);

  // Handle scanned or typed code
  const handleCodeInput = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    setInputCode(clean);
    setFeedback(null);

    // Check duplicate first
    const dup = PCDStorageService.checkDuplicateAttendance(event.id, clean);
    if (dup) {
      playDuplicateWarningBeep();
      triggerHaptic([100, 50, 100]);
      setDuplicateRecord(dup);
      setIdentifiedStudent(null);
      setFeedback({
        type: 'warning',
        message: `⚠ Duplicate scan! Already recorded at ${new Date(dup.timestamp).toLocaleTimeString()}.`,
      });
      return;
    }

    setDuplicateRecord(null);
    triggerHaptic([60]);

    // Fast local lookup
    const initialStudent = PCDStorageService.lookupStudent(clean);
    setIdentifiedStudent(initialStudent);

    // If local student has generic name and webhook exists, fetch live real name from Google Sheet
    if (initialStudent && initialStudent.name.startsWith('Student (')) {
      try {
        const enrichedStudent = await PCDStorageService.lookupStudentAsync(clean);
        if (enrichedStudent && !enrichedStudent.name.startsWith('Student (')) {
          setIdentifiedStudent(enrichedStudent);
        }
      } catch {
        // keep initialStudent
      }
    }
  };

  // Mark attendance
  const handleMarkAttendance = () => {
    if (isLocked) {
      setFeedback({ type: 'error', message: timeStatus.message });
      return;
    }

    if (!identifiedStudent) {
      handleCodeInput(inputCode);
      return;
    }

    const targetEmail =
      identifiedStudent.email && identifiedStudent.email.includes('@')
        ? identifiedStudent.email
        : identifiedStudent.registerNumber
        ? `${identifiedStudent.registerNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@ssn.edu.in`
        : '';

    const res = PCDStorageService.markAttendance({
      eventId: event.id,
      eventName: event.name,
      digitalId: identifiedStudent.digitalId,
      registerNumber: identifiedStudent.registerNumber,
      name: identifiedStudent.name,
      dept: identifiedStudent.dept,
      year: identifiedStudent.year,
      pcd: identifiedStudent.pcd,
      remarks: remarks.trim(),
      markedBy: currentUser.email,
      markedByName: currentUser.name,
      method: isCameraActive ? 'camera_scan' : 'manual_input',
      studentEmail: targetEmail,
    });

    if (res.success && res.record) {
      playSuccessBeep();
      triggerHaptic([120]);
      setFeedback({
        type: 'success',
        message: `✓ Attendance marked: ${identifiedStudent.name} (${identifiedStudent.year} · ${identifiedStudent.pcd})${targetEmail ? ` — Digital receipt sent to ${targetEmail}` : ''}`,
      });
      setInputCode('');
      setIdentifiedStudent(null);
      setRemarks('');
      refreshRecords();
    } else {
      playErrorBeep();
      triggerHaptic([100, 50, 100]);
      setFeedback({ type: 'warning', message: res.message });
    }
  };

  // PCD Badge styling without logo
  const getPcdBadge = (pcd: string) => {
    if (pcd === 'YRC') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-red-600 text-white shadow-2xs">
          🔴 YRC
        </span>
      );
    }
    if (pcd === 'NSS') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-blue-600 text-white shadow-2xs">
          🔵 NSS
        </span>
      );
    }
    if (pcd === 'NSO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-2xs">
          🟢 NSO
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-200 text-neutral-700">
        ⚪ Not Registered
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3.5">
      {/* Top Bar with Event Info */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            {onBack && !isCoordinator && (
              <button
                onClick={onBack}
                className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg cursor-pointer transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                title="Back to Events"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-neutral-900 tracking-tight">
                  {event.name}
                </h1>
                <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 border border-neutral-200 px-2 py-0.5 rounded">
                  {records.length} Scanned
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-[11px] text-neutral-500 font-medium mt-0.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-neutral-400" />
                  {event.date || 'Today'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-neutral-400" />
                  {event.startTime || '09:00'} - {event.endTime || '17:00'}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-neutral-400" />
                  {event.venue || 'Campus'}
                </span>
              </div>
            </div>
          </div>

          {/* Time access status indicator */}
          <div className="shrink-0 self-start sm:self-center">
            {timeStatus.allowed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Scanning Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Lock className="w-3 h-3 text-amber-600" />
                {timeStatus.status === 'upcoming' ? 'Locked (Upcoming)' : 'Closed'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lock Banner if Coordinator is outside time window */}
      {isLocked && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-amber-900">Attendance Scanner Locked</h2>
          <p className="text-xs text-amber-800 max-w-md mx-auto">{timeStatus.message}</p>
          <p className="text-[11px] text-amber-700">
            Coordinators can only scan during the active time window ({event.startTime || '09:00'} to {event.endTime || '17:00'}).
          </p>
        </div>
      )}

      {/* Active Scanner Layout */}
      <div className={`space-y-3.5 ${isLocked ? 'opacity-40 pointer-events-none' : ''}`}>
        {/* Camera and Input Card */}
        <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Live Attendance Scanner
            </h2>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleManualAttendanceSync}
                disabled={isSyncingAttendance}
                className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold cursor-pointer transition-colors min-h-[38px] flex items-center gap-1.5 disabled:opacity-50"
                title="Sync attendance with Google Sheet tab"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAttendance ? 'animate-spin' : ''}`} />
                <span className="text-[11px] hidden sm:inline">{isSyncingAttendance ? 'Syncing...' : 'Sync Sheet'}</span>
              </button>

              {isCameraActive && (
                <button
                  onClick={toggleCameraFacing}
                  className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold cursor-pointer transition-colors min-h-[38px] flex items-center gap-1"
                  title="Flip camera"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span className="text-[10px] hidden xs:inline">Flip</span>
                </button>
              )}

              <button
                onClick={() => (isCameraActive ? stopCamera() : startCamera())}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors min-h-[38px] ${
                  isCameraActive
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-neutral-900 text-white hover:bg-neutral-800'
                }`}
              >
                {isCameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Stop Camera</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan with Camera</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Camera Viewport - Perfectly scaled for mobile vertical screens */}
          {isCameraActive && (
            <div className="relative w-full max-w-sm sm:max-w-md mx-auto aspect-4/3 bg-black rounded-xl overflow-hidden border-2 border-neutral-800 shadow-md">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Target Aim Box */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-36 border-2 border-emerald-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  <div className="w-full h-0.5 bg-emerald-400 animate-pulse mt-16" />
                </div>
              </div>
              <div className="absolute bottom-2 inset-x-0 text-center">
                <span className="text-[10px] font-mono text-white/95 bg-black/70 px-3 py-1 rounded-full">
                  Align Barcode / QR Code inside box
                </span>
              </div>
            </div>
          )}

          {/* Manual Barcode / Registration Number Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-600 block">
              Scan Barcode or Enter Register Number / Digital ID:
            </label>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCodeInput(inputCode);
                    }
                  }}
                  placeholder="e.g. 2410019 or 3122245001019"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 min-h-[42px]"
                />
              </div>
              <button
                onClick={() => handleCodeInput(inputCode)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors min-h-[42px]"
              >
                Lookup
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : feedback.type === 'warning'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Identified Student Card */}
          {identifiedStudent && (
            <div className="border border-neutral-300 bg-neutral-50/60 rounded-xl p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-neutral-900">
                    {identifiedStudent.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs mt-0.5">
                    <span className="font-mono bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 rounded text-[11px] font-bold">
                      AU Reg: {identifiedStudent.registerNumber || identifiedStudent.digitalId}
                    </span>
                    {identifiedStudent.digitalId && identifiedStudent.digitalId !== identifiedStudent.registerNumber && (
                      <span className="font-mono text-neutral-600">
                        Roll: {identifiedStudent.digitalId}
                      </span>
                    )}
                    <span className="text-neutral-500">· {identifiedStudent.dept}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-900 text-white shadow-2xs">
                    {identifiedStudent.year}
                  </span>
                  {getPcdBadge(identifiedStudent.pcd)}
                </div>
              </div>

              {/* Editable AU Register Number (3122...) Confirmation */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="text-red-700">★</span>
                    <span>Anna University Register No (3122...):</span>
                  </span>
                  {identifiedStudent.registerNumber && identifiedStudent.registerNumber.startsWith('3122') && (
                    <span className="text-[10px] text-emerald-600 font-bold lowercase">✓ verified AU format</span>
                  )}
                </label>
                <input
                  type="text"
                  value={identifiedStudent.registerNumber || ''}
                  onChange={(e) =>
                    setIdentifiedStudent({
                      ...identifiedStudent,
                      registerNumber: e.target.value.trim(),
                    })
                  }
                  placeholder="e.g. 3122245001001"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 min-h-[38px]"
                />
              </div>

              {/* Optional Remarks Section */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-neutral-600" />
                  <span>Optional Remark (Logged to Sheet):</span>
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Volunteer Lead, Late Entry, Organizing Team..."
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 min-h-[38px]"
                />
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
                  {quickRemarks.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setRemarks(q)}
                      className={`text-[10px] font-medium px-2 py-1 rounded-full border transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                        remarks === q
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      + {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confirm Mark Attendance Button - Full mobile width */}
              <button
                onClick={handleMarkAttendance}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/20 cursor-pointer flex items-center justify-center gap-2 transition-colors min-h-[46px]"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Mark Attendance</span>
              </button>

              <p className="text-[10px] text-neutral-500 text-center flex items-center justify-center gap-1 pt-0.5">
                <Mail className="w-3 h-3 text-neutral-400 shrink-0" />
                <span>
                  Digital attendance receipt with confirmation code dispatched to{' '}
                  <code className="font-mono text-neutral-700">
                    {identifiedStudent.email || `${identifiedStudent.registerNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@ssn.edu.in`}
                  </code>
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Recent Attendance Scans for this Event */}
        <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Recent Event Attendance ({records.length})
            </h2>
            <button
              onClick={refreshRecords}
              className="text-xs text-neutral-500 hover:text-neutral-800 cursor-pointer flex items-center gap-1 min-h-[32px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-6 text-neutral-400 text-xs">
              No attendance records yet for this event. Scan or enter a student ID above to begin!
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 max-h-[350px] overflow-y-auto">
              {records.slice(0, 50).map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-bold text-neutral-900">{r.name}</div>
                    <div className="text-[11px] text-neutral-500 font-mono flex flex-wrap items-center gap-x-1.5">
                      <span className="text-red-700 font-semibold">{r.registerNumber || r.digitalId}</span>
                      {r.digitalId && r.digitalId !== r.registerNumber && (
                        <span className="text-neutral-500">({r.digitalId})</span>
                      )}
                      <span>· {r.dept}</span>
                      {r.remarks && (
                        <span className="text-neutral-700 font-sans italic">
                          • {r.remarks}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded">
                      {r.year}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded text-white ${
                        r.pcd === 'YRC'
                          ? 'bg-red-600'
                          : r.pcd === 'NSS'
                          ? 'bg-blue-600'
                          : r.pcd === 'NSO'
                          ? 'bg-emerald-600'
                          : 'bg-neutral-500'
                      }`}
                    >
                      {r.pcd === 'NReg' ? 'Not Reg' : r.pcd}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400 hidden xs:inline">
                      {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
