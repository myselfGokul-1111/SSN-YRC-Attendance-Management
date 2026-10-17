import React, { useState } from 'react';
import { AttendanceRecord, PCDEvent } from '../types';
import { YrcEmblem } from './YrcEmblem';
import {
  Mail,
  CheckCircle2,
  Printer,
  Copy,
  Check,
  Send,
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

interface StudentEmailReceiptModalProps {
  record: AttendanceRecord | null;
  event?: PCDEvent;
  onClose: () => void;
  onResend?: (recordId: string) => void;
}

export const StudentEmailReceiptModal: React.FC<StudentEmailReceiptModalProps> = ({
  record,
  event,
  onClose,
  onResend,
}) => {
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  if (!record) return null;

  const studentEmail = record.studentEmail || `${record.name.toLowerCase().replace(/\s+/g, '')}${record.digitalId}@ssn.edu.in`;
  const confirmationCode = record.confirmationCode || `YRC-ATT-${record.digitalId}-${record.id.slice(-4).toUpperCase()}`;

  const emailSubject = `✓ Attendance Confirmed: ${record.eventName} - ${record.name} (${record.digitalId})`;

  const handleCopyText = () => {
    const text = `
SSN YOUTH RED CROSS - ATTENDANCE CONFIRMATION RECEIPT
Confirmation Code: ${confirmationCode}

Student Name: ${record.name}
Digital ID: ${record.digitalId}
Register Number: ${record.registerNumber}
Department: ${record.dept} (${record.section})
PCD Activity: ${record.pcd}
Event: ${record.eventName}
Venue: ${event?.venue || 'Campus Venue'}
Check-in Time: ${new Date(record.timestamp).toLocaleString()}
Verified By Coordinator: ${record.markedByName} (${record.markedBy})

Status: Confirmed and Recorded in Official SSN PCD Roster.
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResend = () => {
    setResending(true);
    setTimeout(() => {
      setResending(false);
      if (onResend) onResend(record.id);
      setResendStatus(`Email successfully sent to ${studentEmail}`);
      setTimeout(() => setResendStatus(null), 3000);
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-red-600" />
            <h3 className="text-base font-bold text-neutral-900">
              Student Attendance Email Confirmation
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Email Container Mockup */}
        <div className="bg-neutral-50 rounded-2xl border border-neutral-200 overflow-hidden text-xs">
          {/* Email Header Fields */}
          <div className="p-4 bg-white border-b border-neutral-200 space-y-1.5 font-mono text-[11px]">
            <div className="flex">
              <span className="text-neutral-400 w-16 shrink-0">From:</span>
              <span className="text-neutral-900 font-semibold">
                SSN Youth Red Cross &lt;yrc.attendance@ssn.edu.in&gt;
              </span>
            </div>
            <div className="flex">
              <span className="text-neutral-400 w-16 shrink-0">To:</span>
              <span className="text-red-700 font-bold">{studentEmail}</span>
            </div>
            <div className="flex">
              <span className="text-neutral-400 w-16 shrink-0">Subject:</span>
              <span className="text-neutral-900 font-sans font-bold">{emailSubject}</span>
            </div>
          </div>

          {/* Email Body Content */}
          <div className="p-5 space-y-4 font-sans bg-white">
            {/* Header Brand */}
            <div className="flex items-center justify-between border-b border-red-100 pb-3">
              <div className="flex items-center gap-2">
                <YrcEmblem size={28} />
                <div>
                  <div className="font-extrabold text-neutral-900 text-sm">
                    SSN Youth Red Cross (YRC)
                  </div>
                  <div className="text-[10px] text-neutral-500 font-medium">
                    SSN College of Engineering · Extra-Curricular Division
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded border border-red-200">
                PCD Verified
              </span>
            </div>

            {/* Success Notification Banner */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold text-xs">Your Attendance Has Been Verified!</div>
                <div className="text-[11px] text-emerald-700">
                  Ref Code: <span className="font-mono font-bold">{confirmationCode}</span>
                </div>
              </div>
            </div>

            {/* Student & Event Summary */}
            <div className="space-y-2 text-neutral-700 leading-relaxed text-xs">
              <p>
                Dear <strong className="text-neutral-900">{record.name}</strong>,
              </p>
              <p>
                Your attendance has been officially marked for the Extra-Curricular activity listed below:
              </p>

              <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 space-y-1.5 text-xs">
                <div className="flex justify-between py-0.5 border-b border-neutral-100">
                  <span className="text-neutral-500">Event Session:</span>
                  <span className="font-bold text-neutral-900">{record.eventName}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-neutral-100">
                  <span className="text-neutral-500">Digital ID:</span>
                  <span className="font-mono font-bold text-neutral-900">{record.digitalId}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-neutral-100">
                  <span className="text-neutral-500">Register Number:</span>
                  <span className="font-mono text-neutral-800">{record.registerNumber}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-neutral-100">
                  <span className="text-neutral-500">Department & Section:</span>
                  <span className="font-medium text-neutral-900">{record.dept} ({record.section})</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-neutral-100">
                  <span className="text-neutral-500">PCD Activity:</span>
                  <span className="font-bold text-red-700">{record.pcd}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-neutral-100">
                  <span className="text-neutral-500">Check-in Timestamp:</span>
                  <span className="font-mono text-neutral-800">
                    {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({new Date(record.timestamp).toLocaleDateString()})
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-neutral-500">Verified By Coordinator:</span>
                  <span className="font-medium text-neutral-900">{record.markedByName}</span>
                </div>
              </div>

              <p className="text-[11px] text-neutral-500 pt-1">
                This confirmation has been logged to the institutional PCD attendance ledger for your academic credit evaluation.
              </p>
            </div>
          </div>
        </div>

        {/* Resend Status feedback */}
        {resendStatus && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{resendStatus}</span>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Text'}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px] shadow-xs disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${resending ? 'animate-pulse' : ''}`} />
              {resending ? 'Sending...' : 'Resend Email to Student'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer min-h-[44px]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
