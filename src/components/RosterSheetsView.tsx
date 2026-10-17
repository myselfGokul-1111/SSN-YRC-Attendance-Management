import React, { useState } from 'react';
import { PCDType, SheetName, Student, UpdateRecord, UserProfile } from '../types';
import { PCDStorageService } from '../services/storage';
import { YrcEmblem } from './YrcEmblem';
import {
  Search,
  Download,
  Plus,
  ArrowRightLeft,
  RefreshCw,
  FileSpreadsheet,
  Check,
  Filter,
} from 'lucide-react';

interface RosterSheetsViewProps {
  rosters: Record<SheetName, Student[]>;
  updateLogs: UpdateRecord[];
  currentUser: UserProfile;
  onDataChanged: () => void;
}

export const RosterSheetsView: React.FC<RosterSheetsViewProps> = ({
  rosters,
  updateLogs,
  currentUser,
  onDataChanged,
}) => {
  const [activeSheet, setActiveSheet] = useState<SheetName>('YRC 25');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Add Student Form State
  const [newStudent, setNewStudent] = useState({
    name: '',
    dept: 'CSE',
    digitalId: '',
    section: 'S1',
    pcd: 'YRC' as PCDType,
    registerNumber: '',
    email: '',
  });

  // Transfer Student Form State
  const [transferState, setTransferState] = useState({
    digitalId: '',
    toPcd: 'NSS' as PCDType,
    reason: '',
  });

  const sheetTabs: { name: SheetName; category: string }[] = [
    { name: 'YRC 25', category: '2025' },
    { name: 'NSS 25', category: '2025' },
    { name: 'NSO 25', category: '2025' },
    { name: 'NReg 25', category: '2025' },

    { name: 'YRC 24', category: '2024' },
    { name: 'NSS 24', category: '2024' },
    { name: 'NSO 24', category: '2024' },
    { name: 'NReg 24', category: '2024' },

    { name: 'YRC 23', category: '2023' },
    { name: 'NSS 23', category: '2023' },
    { name: 'NSO 23', category: '2023' },
    { name: 'NReg 23', category: '2023' },

    { name: 'UPDATE', category: 'Changelog' },
  ];

  const currentSheetData = rosters[activeSheet] || [];

  // Filter students
  const filteredStudents = currentSheetData.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      s.digitalId.toLowerCase().includes(q) ||
      s.registerNumber.toLowerCase().includes(q) ||
      s.dept.toLowerCase().includes(q) ||
      s.section.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q);

    const matchesDept = selectedDept === 'ALL' || s.dept === selectedDept;

    return matchesSearch && matchesDept;
  });

  // Filter logs for UPDATE sheet
  const filteredLogs = updateLogs.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      l.studentName.toLowerCase().includes(q) ||
      l.digitalId.toLowerCase().includes(q) ||
      l.remarks.toLowerCase().includes(q) ||
      l.dept.toLowerCase().includes(q)
    );
  });

  // Unique departments for filter
  const departments = ['ALL', 'BME', 'CSE', 'ECE', 'IT', 'MECH', 'CIVIL', 'EEE', 'AIDS', 'M.Tech CSE'];

  const handleExportCsv = () => {
    const csvData = PCDStorageService.exportSheetAsCsv(activeSheet);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Copy_of_All_PCD_list_${activeSheet.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulateSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      PCDStorageService.touchSyncTime();
      setSyncFeedback('Successfully synced with Google Sheets API ("Copy of All PCD list").');
      setTimeout(() => setSyncFeedback(null), 3500);
    }, 800);
  };

  const handleAddStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.digitalId || !newStudent.name) return;

    const batch = (activeSheet.split(' ')[1] || '2025') as '2025' | '2024' | '2023';
    const pcd = (activeSheet.split(' ')[0] || 'YRC') as PCDType;

    PCDStorageService.addStudentToSheet(activeSheet, {
      name: newStudent.name.toUpperCase(),
      dept: newStudent.dept,
      digitalId: newStudent.digitalId,
      section: newStudent.section,
      pcd: pcd === ('UPDATE' as unknown as PCDType) ? 'YRC' : pcd,
      registerNumber: newStudent.registerNumber || `3122${batch.slice(2)}0000000`,
      email: newStudent.email || `${newStudent.name.toLowerCase().replace(/\s+/g, '')}${newStudent.digitalId}@ssn.edu.in`,
      batch,
    });

    onDataChanged();
    setIsAddModalOpen(false);
    setNewStudent({
      name: '',
      dept: 'CSE',
      digitalId: '',
      section: 'S1',
      pcd: 'YRC',
      registerNumber: '',
      email: '',
    });
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferState.digitalId) return;

    const res = PCDStorageService.transferStudent(
      transferState.digitalId,
      transferState.toPcd,
      transferState.reason,
      currentUser.email
    );

    if (res.success) {
      alert(res.message);
      onDataChanged();
      setIsTransferModalOpen(false);
      setTransferState({ digitalId: '', toPcd: 'NSS', reason: '' });
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Title & Google Sheets Sync Bar */}
      <div className="bg-white rounded-2xl border border-red-100 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <YrcEmblem size={24} />
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900">
                Copy of All PCD list (13 Sheets)
              </h1>
            </div>
            <p className="text-xs text-neutral-500">
              Official student enrolment registry across YRC, NSS, NSO, and NReg for Batches 2025, 2024, and 2023.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSimulateSync}
              disabled={isSyncing}
              className="px-3.5 py-2.5 text-xs font-semibold text-neutral-700 bg-neutral-50 border border-neutral-300 rounded-xl hover:bg-neutral-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-red-600 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync with Sheets'}
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2.5 text-xs font-semibold text-neutral-700 bg-neutral-50 border border-neutral-300 rounded-xl hover:bg-neutral-100 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5 text-red-600" />
              Export [{activeSheet}] CSV
            </button>

            {currentUser.role === 'admin' && activeSheet !== 'UPDATE' && (
              <>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[44px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Student
                </button>

                <button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="px-3.5 py-2.5 text-xs font-bold text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-red-600" />
                  Transfer PCD
                </button>
              </>
            )}
          </div>
        </div>

        {syncFeedback && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-red-600" />
            <span>{syncFeedback}</span>
          </div>
        )}
      </div>

      {/* 13 Sheets Tabs Navigator */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-3.5 shadow-xs">
        <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2 px-1">
          Select Sheet Tab ({sheetTabs.length} Total):
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {sheetTabs.map((tab) => {
            const count = tab.name === 'UPDATE' ? updateLogs.length : (rosters[tab.name]?.length || 0);
            const isActive = activeSheet === tab.name;

            return (
              <button
                key={tab.name}
                onClick={() => {
                  setActiveSheet(tab.name);
                  setSearchQuery('');
                }}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer min-h-[44px] ${
                  isActive
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
                }`}
              >
                <span>{tab.name}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                    isActive ? 'bg-red-800 text-red-100' : 'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sheet Content & Filter Bar */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeSheet} by Name, Digital ID, Reg No...`}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 text-neutral-900"
            />
          </div>

          {/* Department Filter (only for student roster sheets) */}
          {activeSheet !== 'UPDATE' && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-neutral-400" />
              <select
                aria-label="Filter by Department"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 font-medium text-neutral-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-neutral-400"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    Dept: {d}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {activeSheet === 'UPDATE' ? (
            /* ================= UPDATE SHEET TABLE ================= */
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100/70 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <th className="py-2.5 px-4 font-mono">Log ID</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4 font-mono">Digital ID</th>
                  <th className="py-2.5 px-4">Student Name</th>
                  <th className="py-2.5 px-4">Dept</th>
                  <th className="py-2.5 px-4">From PCD</th>
                  <th className="py-2.5 px-4">To PCD</th>
                  <th className="py-2.5 px-4">Remarks</th>
                  <th className="py-2.5 px-4">Updated By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-neutral-400">
                      No update log entries found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-neutral-600 font-medium">
                        {log.id}
                      </td>
                      <td className="py-2.5 px-4 text-neutral-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-[10px] bg-neutral-200 px-1.5 py-0.5 rounded text-neutral-800 font-semibold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-neutral-900">
                        {log.digitalId}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-neutral-900">
                        {log.studentName}
                      </td>
                      <td className="py-2.5 px-4 text-neutral-700">{log.dept}</td>
                      <td className="py-2.5 px-4 text-neutral-500">{log.fromPcd || '—'}</td>
                      <td className="py-2.5 px-4 font-bold text-emerald-700">{log.toPcd || '—'}</td>
                      <td className="py-2.5 px-4 text-neutral-600 max-w-xs truncate" title={log.remarks}>
                        {log.remarks}
                      </td>
                      <td className="py-2.5 px-4 text-neutral-500 font-mono text-[11px]">
                        {log.updatedBy}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* ================= STUDENT ROSTER SHEET TABLE ================= */
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100/70 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <th className="py-2.5 px-4 font-mono w-16">Sl No</th>
                  <th className="py-2.5 px-4">Dept</th>
                  <th className="py-2.5 px-4 font-mono">Digital ID</th>
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Section</th>
                  <th className="py-2.5 px-4">PCD</th>
                  <th className="py-2.5 px-4 font-mono">Registernumber</th>
                  <th className="py-2.5 px-4">Email-ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-neutral-400">
                      No student records match your query in [{activeSheet}].
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.digitalId} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-neutral-500 tabular-nums">
                        {s.slNo}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-neutral-800">
                        {s.dept}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-neutral-900">
                        {s.digitalId}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-neutral-900">
                        {s.name}
                      </td>
                      <td className="py-2.5 px-4 text-neutral-600">
                        {s.section}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-[10px] font-bold bg-neutral-100 border border-neutral-300 text-neutral-800 px-1.5 py-0.5 rounded">
                          {s.pcd}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-neutral-600 tabular-nums">
                        {s.registerNumber}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-neutral-500 text-[11px]">
                        {s.email}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer row with record count */}
        <div className="p-3 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500 flex items-center justify-between">
          <span>
            Showing{' '}
            <span className="font-semibold text-neutral-900 font-mono">
              {activeSheet === 'UPDATE' ? filteredLogs.length : filteredStudents.length}
            </span>{' '}
            records in <span className="font-semibold text-neutral-900 font-mono">[{activeSheet}]</span>
          </span>
          <span className="font-mono text-[11px]">Dynamic Routing Source Target</span>
        </div>
      </div>

      {/* ================= MODAL: ADD STUDENT ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900">
                Add Student to [{activeSheet}]
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStudentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-600 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  placeholder="e.g. SATHISH KUMAR M"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-600 font-medium mb-1">Digital ID</label>
                  <input
                    type="text"
                    required
                    value={newStudent.digitalId}
                    onChange={(e) => setNewStudent({ ...newStudent, digitalId: e.target.value })}
                    placeholder="e.g. 2570099"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-neutral-600 font-medium mb-1">Department</label>
                  <select
                    value={newStudent.dept}
                    onChange={(e) => setNewStudent({ ...newStudent, dept: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  >
                    {departments.filter((d) => d !== 'ALL').map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-600 font-medium mb-1">Section</label>
                  <input
                    type="text"
                    value={newStudent.section}
                    onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value })}
                    placeholder="e.g. S14 or Lateral Entry"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-neutral-600 font-medium mb-1">Register Number</label>
                  <input
                    type="text"
                    value={newStudent.registerNumber}
                    onChange={(e) => setNewStudent({ ...newStudent, registerNumber: e.target.value })}
                    placeholder="e.g. 3122255001099"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors text-neutral-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 text-white font-semibold rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Save to {activeSheet}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: TRANSFER PCD ================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900">
                Transfer Student to Another PCD
              </h3>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
              <p className="text-neutral-500">
                Moving a student will transfer their record into the corresponding batch sheet and record an official audit log in the{' '}
                <span className="font-mono font-semibold text-neutral-900">[UPDATE]</span> sheet.
              </p>

              <div>
                <label className="block text-neutral-600 font-medium mb-1">Student Digital ID</label>
                <input
                  type="text"
                  required
                  value={transferState.digitalId}
                  onChange={(e) => setTransferState({ ...transferState, digitalId: e.target.value })}
                  placeholder="e.g. 2511064, 2570070"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-neutral-600 font-medium mb-1">Destination PCD Activity</label>
                <select
                  value={transferState.toPcd}
                  onChange={(e) => setTransferState({ ...transferState, toPcd: e.target.value as PCDType })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="YRC">YRC (Youth Red Cross)</option>
                  <option value="NSS">NSS (National Service Scheme)</option>
                  <option value="NSO">NSO (National Sports Organization)</option>
                  <option value="NReg">NReg (Non-Registered/Regular)</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-600 font-medium mb-1">Transfer Justification / Reason</label>
                <textarea
                  rows={2}
                  required
                  value={transferState.reason}
                  onChange={(e) => setTransferState({ ...transferState, reason: e.target.value })}
                  placeholder="e.g. Official selection committee approval for NSS volunteer allocation."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors text-neutral-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-500 transition-colors cursor-pointer"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
