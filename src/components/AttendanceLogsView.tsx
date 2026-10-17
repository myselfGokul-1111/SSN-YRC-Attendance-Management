import React, { useState } from 'react';
import { AttendanceRecord, PCDEvent, PCDType, UserProfile } from '../types';
import { PCDStorageService } from '../services/storage';
import { StudentEmailReceiptModal } from './StudentEmailReceiptModal';
import {
  Search,
  Download,
  Trash2,
  Edit2,
  Printer,
  QrCode,
  Keyboard,
  Sparkles,
  AlertOctagon,
  Check,
  X,
  FileSpreadsheet,
  Mail,
} from 'lucide-react';

interface AttendanceLogsViewProps {
  events: PCDEvent[];
  currentUser: UserProfile;
  onDataChanged: () => void;
}

export const AttendanceLogsView: React.FC<AttendanceLogsViewProps> = ({
  events,
  currentUser,
  onDataChanged,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>('ALL');
  const [selectedPcd, setSelectedPcd] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin Edit Modal State
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);

  // Student Email Receipt Modal State
  const [previewEmailRecord, setPreviewEmailRecord] = useState<AttendanceRecord | null>(null);

  // Admin Wipe Sheet Confirmation Modal State
  const [isWipeSheetModalOpen, setIsWipeSheetModalOpen] = useState(false);

  const isAdmin = currentUser.role === 'admin';
  const allRecords = PCDStorageService.getAttendance();

  const filteredRecords = allRecords.filter((r) => {
    const matchesEvent = selectedEventId === 'ALL' || r.eventId === selectedEventId;
    const matchesPcd = selectedPcd === 'ALL' || r.pcd === selectedPcd;
    const matchesDept = selectedDept === 'ALL' || r.dept === selectedDept;

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      r.name.toLowerCase().includes(q) ||
      r.digitalId.toLowerCase().includes(q) ||
      r.registerNumber.toLowerCase().includes(q) ||
      r.dept.toLowerCase().includes(q) ||
      r.markedByName.toLowerCase().includes(q);

    return matchesEvent && matchesPcd && matchesDept && matchesSearch;
  });

  const departments = ['ALL', 'BME', 'CSE', 'ECE', 'IT', 'MECH', 'CIVIL', 'EEE', 'AIDS', 'M.Tech CSE'];

  const handleExportCsv = () => {
    if (selectedEventId !== 'ALL') {
      const csvData = PCDStorageService.exportEventAttendanceCsv(selectedEventId);
      downloadCsv(csvData, `SSN_YRC_attendance_${selectedEventId}.csv`);
    } else {
      const headers = ['Event Name', 'Digital ID', 'Name', 'Dept', 'Register Number', 'PCD', 'Section', 'Batch', 'Marked By', 'Timestamp', 'Method'];
      const rows = filteredRecords.map((r) => [
        `"${r.eventName}"`,
        `"${r.digitalId}"`,
        `"${r.name}"`,
        `"${r.dept}"`,
        `"${r.registerNumber}"`,
        `"${r.pcd}"`,
        `"${r.section}"`,
        `"${r.batch}"`,
        `"${r.markedBy}"`,
        `"${r.timestamp}"`,
        `"${r.method}"`,
      ]);
      const csvData = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
      downloadCsv(csvData, 'SSN_YRC_All_Attendance_Records.csv');
    }
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteRecord = (recordId: string, name: string) => {
    if (confirm(`ADMIN ACTION: Permanently delete attendance record for ${name}?`)) {
      PCDStorageService.removeAttendance(recordId);
      onDataChanged();
    }
  };

  const handleWipeEventSheet = () => {
    if (selectedEventId === 'ALL') {
      alert('Please select a specific event from the dropdown to delete its attendance sheet.');
      return;
    }
    const targetEvent = events.find((e) => e.id === selectedEventId);
    const count = PCDStorageService.deleteAttendanceSheetForEvent(selectedEventId);
    setIsWipeSheetModalOpen(false);
    onDataChanged();
    alert(`ADMIN ACTION: Deleted attendance sheet for "${targetEvent?.name}". ${count} records purged.`);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    PCDStorageService.updateAttendanceRecord(editingRecord.id, {
      name: editingRecord.name.toUpperCase(),
      dept: editingRecord.dept,
      registerNumber: editingRecord.registerNumber,
      section: editingRecord.section,
      pcd: editingRecord.pcd,
      markedByName: editingRecord.markedByName,
    });

    onDataChanged();
    setEditingRecord(null);
  };

  const selectedEventObj = events.find((e) => e.id === selectedEventId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Title & Stats */}
      <div className="bg-white rounded-2xl border border-red-100 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900">
              Verified Attendance Logs & Management
            </h1>
            <p className="text-xs text-neutral-500">
              Audit trail of student attendance check-ins. {isAdmin ? 'Admin has full permissions to edit and delete records.' : 'Read-only log view.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Admin Wipe Attendance Sheet Button */}
            {isAdmin && selectedEventId !== 'ALL' && (
              <button
                onClick={() => setIsWipeSheetModalOpen(true)}
                className="px-3.5 py-2.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                Delete Event Sheet
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2.5 text-xs font-semibold text-neutral-700 bg-neutral-50 border border-neutral-300 rounded-xl hover:bg-neutral-100 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <Printer className="w-3.5 h-3.5 text-red-700" />
              Print Roll
            </button>

            <button
              onClick={handleExportCsv}
              className="px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, Digital ID, Reg No..."
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 text-neutral-900 min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Event Filter */}
          <select
            aria-label="Filter by Event"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2.5 font-medium text-neutral-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
          >
            <option value="ALL">All Events ({events.length})</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>

          {/* PCD Filter */}
          <select
            aria-label="Filter by PCD Activity"
            value={selectedPcd}
            onChange={(e) => setSelectedPcd(e.target.value)}
            className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2.5 font-medium text-neutral-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
          >
            <option value="ALL">All PCD Activities</option>
            <option value="YRC">YRC Only</option>
            <option value="NSS">NSS Only</option>
            <option value="NSO">NSO Only</option>
            <option value="NReg">NReg Only</option>
          </select>

          {/* Dept Filter */}
          <select
            aria-label="Filter by Department"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2.5 font-medium text-neutral-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'All Departments' : `Dept: ${d}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Attendance Table (Desktop & Tablet) + Cards for Mobile */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-700 font-bold">
                <th className="py-3 px-4 font-mono">Digital ID</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Dept</th>
                <th className="py-3 px-4 font-mono">Register No</th>
                <th className="py-3 px-4">PCD</th>
                <th className="py-3 px-4">Batch</th>
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Marked By</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Confirmation Mail</th>
                {isAdmin && <th className="py-3 px-4 text-right">Admin Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 12 : 11} className="py-12 text-center text-neutral-400">
                    No attendance records match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                      {r.digitalId}
                    </td>
                    <td className="py-3 px-4 font-bold text-neutral-900">
                      {r.name}
                    </td>
                    <td className="py-3 px-4 text-neutral-700 font-medium">
                      {r.dept} ({r.section})
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600 tabular-nums">
                      {r.registerNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          r.pcd === 'YRC'
                            ? 'bg-red-600 text-white'
                            : 'bg-neutral-100 border border-neutral-300 text-neutral-800'
                        }`}
                      >
                        {r.pcd}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-600 font-mono">
                      {r.batch}
                    </td>
                    <td className="py-3 px-4 text-neutral-800 max-w-[180px] truncate" title={r.eventName}>
                      {r.eventName}
                    </td>
                    <td className="py-3 px-4 text-neutral-600">
                      <div className="font-semibold text-neutral-800">{r.markedByName}</div>
                      <div className="text-[10px] font-mono text-neutral-400">{r.markedBy.split('@')[0]}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-500 whitespace-nowrap text-[11px]">
                      {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1 text-[11px] text-neutral-600">
                        {r.method === 'barcode_scan' && <QrCode className="w-3 h-3 text-red-600" />}
                        {r.method === 'manual_input' && <Keyboard className="w-3 h-3 text-neutral-500" />}
                        {r.method === 'quick_test' && <Sparkles className="w-3 h-3 text-amber-500" />}
                        {r.method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPreviewEmailRecord(r)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors cursor-pointer min-h-[36px]"
                        title="View / Resend Confirmation Email Receipt"
                      >
                        <Mail className="w-3.5 h-3.5 text-red-600" />
                        <span>{r.emailSent !== false ? 'Receipt Sent' : 'Send Mail'}</span>
                      </button>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingRecord({ ...r })}
                            className="text-neutral-500 hover:text-neutral-900 p-2 cursor-pointer rounded-lg hover:bg-neutral-100 min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Edit Record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(r.id, r.name)}
                            className="text-neutral-400 hover:text-red-600 p-2 cursor-pointer rounded-lg hover:bg-red-50 min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-600 flex items-center justify-between">
          <span>
            Displaying <span className="font-bold text-neutral-900 font-mono tabular-nums">{filteredRecords.length}</span> checked-in records
          </span>
          <span className="font-mono text-[11px] text-red-700 font-bold">SSN YRC Verified Audit Trail</span>
        </div>
      </div>

      {/* ================= ADMIN MODAL: EDIT ATTENDANCE RECORD ================= */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-red-600" />
                Edit Attendance Record
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-600 font-semibold mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={editingRecord.name}
                  onChange={(e) => setEditingRecord({ ...editingRecord, name: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl uppercase font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1">Department</label>
                  <select
                    value={editingRecord.dept}
                    onChange={(e) => setEditingRecord({ ...editingRecord, dept: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  >
                    {departments.filter((d) => d !== 'ALL').map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-600 font-semibold mb-1">PCD Activity</label>
                  <select
                    value={editingRecord.pcd}
                    onChange={(e) => setEditingRecord({ ...editingRecord, pcd: e.target.value as PCDType })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  >
                    <option value="YRC">YRC</option>
                    <option value="NSS">NSS</option>
                    <option value="NSO">NSO</option>
                    <option value="NReg">NReg</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1">Section</label>
                  <input
                    type="text"
                    value={editingRecord.section}
                    onChange={(e) => setEditingRecord({ ...editingRecord, section: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-neutral-600 font-semibold mb-1">Register Number</label>
                  <input
                    type="text"
                    value={editingRecord.registerNumber}
                    onChange={(e) => setEditingRecord({ ...editingRecord, registerNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-600 font-semibold mb-1">Marked By Coordinator Name</label>
                <input
                  type="text"
                  value={editingRecord.markedByName}
                  onChange={(e) => setEditingRecord({ ...editingRecord, markedByName: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[44px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2.5 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors text-neutral-700 cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors cursor-pointer min-h-[44px]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADMIN MODAL: WIPE / DELETE EVENT ATTENDANCE SHEET ================= */}
      {isWipeSheetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">
                Delete Event Attendance Sheet?
              </h3>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              You are about to permanently delete all attendance check-in records for event:{' '}
              <span className="font-bold text-neutral-900">{selectedEventObj?.name}</span>.
              This will clear the dedicated Google Sheet record tab.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsWipeSheetModalOpen(false)}
                className="px-4 py-2.5 border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors text-neutral-700 cursor-pointer text-xs min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWipeEventSheet}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors cursor-pointer text-xs min-h-[44px] flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete Sheet Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Email Confirmation Receipt Modal */}
      <StudentEmailReceiptModal
        record={previewEmailRecord}
        event={events.find((e) => e.id === previewEmailRecord?.eventId)}
        onClose={() => setPreviewEmailRecord(null)}
        onResend={(recordId) => {
          PCDStorageService.resendStudentConfirmationEmail(recordId);
          onDataChanged();
        }}
      />
    </div>
  );
};
