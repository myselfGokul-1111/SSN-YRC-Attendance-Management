import React, { useState, useEffect } from 'react';
import { PCDType, Student, StudentYear, getYearFromId } from '../types';
import { PCDStorageService } from '../services/storage';
import {
  Search,
  Plus,
  Filter,
  Users,
  Check,
  X,
  UploadCloud,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

export const DatabaseView: React.FC = () => {
  const [students, setStudents] = useState<Student[]>(() => PCDStorageService.getStudents());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedPcd, setSelectedPcd] = useState<string>('ALL');

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Live Sheet search state
  const [isSearchingSheet, setIsSearchingSheet] = useState(false);

  // Add Student Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  // Form states for manual student add
  const [newReg, setNewReg] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('CSE');
  const [newPcd, setNewPcd] = useState<PCDType>('YRC');

  const refreshStudents = () => {
    setStudents(PCDStorageService.getStudents());
  };

  // Sync from Google Sheet without annoying prompts
  const handleSyncFromGoogleSheet = async () => {
    setIsSyncing(true);
    setSyncStatus({
      type: 'info',
      message: 'Syncing with Google Spreadsheet...',
    });

    const res = await PCDStorageService.syncStudentsFromGoogleSheet();
    setIsSyncing(false);
    setLastSyncedTime(new Date().toLocaleTimeString());

    if (res.success) {
      refreshStudents();
      setSyncStatus({
        type: 'success',
        message: res.message,
      });
      setTimeout(() => setSyncStatus(null), 5000);
    } else {
      setSyncStatus({
        type: 'info',
        message: res.message,
      });
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Auto-sync on initial load
  useEffect(() => {
    handleSyncFromGoogleSheet();
  }, []);

  // Live search in Google Sheet
  const handleLiveSearchInSheet = async () => {
    if (!searchQuery.trim()) return;

    setIsSearchingSheet(true);
    const found = await PCDStorageService.searchStudentFromGoogleSheet(searchQuery.trim());
    setIsSearchingSheet(false);

    if (found) {
      refreshStudents();
      setSyncStatus({
        type: 'success',
        message: `Found student "${found.name}" (${found.registerNumber}) in your Google Sheet!`,
      });
      setTimeout(() => setSyncStatus(null), 5000);
    } else {
      setSyncStatus({
        type: 'info',
        message: `No record matching "${searchQuery}" found in Google Sheet.`,
      });
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReg.trim()) return;

    const studentYear = getYearFromId(newReg);
    const newStudent: Student = {
      digitalId: newReg.trim(),
      registerNumber: newReg.trim(),
      name: newName.trim() || `Student (${newReg.trim()})`,
      dept: newDept,
      year: studentYear,
      pcd: newPcd,
      email: `${newReg.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@ssn.edu.in`,
    };

    PCDStorageService.addOrUpdateStudent(newStudent);
    refreshStudents();
    setIsAddModalOpen(false);
    setNewReg('');
    setNewName('');
  };

  const handleBatchImport = () => {
    if (!importText.trim()) return;

    const lines = importText.split('\n');
    let addedCount = 0;

    lines.forEach((line) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      if (parts.length > 0 && parts[0]) {
        const reg = parts[0];
        const name = parts[1] || `Student (${reg})`;
        const dept = parts[2] || 'Engineering';
        const pcd = (parts[3] as PCDType) || 'NReg';
        const year = getYearFromId(reg);

        PCDStorageService.addOrUpdateStudent({
          digitalId: reg,
          registerNumber: reg,
          name,
          dept,
          year,
          pcd,
          email: `${reg.toLowerCase().replace(/[^a-z0-9]/g, '')}@ssn.edu.in`,
        });
        addedCount++;
      }
    });

    refreshStudents();
    setIsImportModalOpen(false);
    setImportText('');
    setSyncStatus({
      type: 'success',
      message: `Successfully imported ${addedCount} student records!`,
    });
    setTimeout(() => setSyncStatus(null), 4000);
  };

  // Filter logic
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      s.registerNumber.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.dept.toLowerCase().includes(q) ||
      s.pcd.toLowerCase().includes(q);

    const matchesYear = selectedYear === 'ALL' || s.year === selectedYear;
    const matchesPcd = selectedPcd === 'ALL' || s.pcd === selectedPcd;

    return matchesSearch && matchesYear && matchesPcd;
  });

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Top Banner with Permanent Auto-Sync Status */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
              Student Master Database
            </h1>
            <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
              {students.length} Enrolled
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Synced with Google Sheet</span>
            </span>
          </div>
          <p className="text-xs text-neutral-500 font-medium">
            Permanent two-way synchronization active. Last updated at {lastSyncedTime}.
          </p>
        </div>

        {/* Action Buttons - Touch friendly */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={handleSyncFromGoogleSheet}
            disabled={isSyncing}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-bold cursor-pointer transition-colors min-h-[38px]"
            title="Pull latest students from your Google Spreadsheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-neutral-900' : 'text-neutral-600'}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors min-h-[38px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold cursor-pointer transition-colors min-h-[38px]"
            title="Import from CSV / TSV"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
        </div>
      </div>

      {/* Sync Status Toast */}
      {syncStatus && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 shadow-xs transition-all ${
            syncStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : syncStatus.type === 'error'
              ? 'bg-red-50 text-red-900 border border-red-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : syncStatus.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            )}
            <span>{syncStatus.message}</span>
          </div>
          <button
            onClick={() => setSyncStatus(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Filter Controls - Optimized for mobile */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Register No, Name, Dept..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 min-h-[40px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Live Search in Google Sheet */}
          {searchQuery.trim().length > 0 && (
            <button
              onClick={handleLiveSearchInSheet}
              disabled={isSearchingSheet}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-semibold cursor-pointer shrink-0 min-h-[40px]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isSearchingSheet ? 'Searching Sheet...' : 'Deep Search Sheet'}</span>
            </button>
          )}
        </div>

        {/* Filter Pills with PCD Color Themes - Horizontal scrolling on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Year:</span>
          </span>
          {['ALL', '1st Year', '2nd Year', '3rd Year', '4th Year'].map((yr) => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-2.5 py-1 text-[11px] rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                selectedYear === yr
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {yr}
            </button>
          ))}

          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider shrink-0 ml-2 mr-1">
            Wing:
          </span>
          {['ALL', 'YRC', 'NSS', 'NSO', 'NReg'].map((pcd) => (
            <button
              key={pcd}
              onClick={() => setSelectedPcd(pcd)}
              className={`px-2.5 py-1 text-[11px] rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                selectedPcd === pcd
                  ? pcd === 'YRC'
                    ? 'bg-red-600 text-white shadow-xs'
                    : pcd === 'NSS'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : pcd === 'NSO'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {pcd === 'YRC' ? '🔴 YRC' : pcd === 'NSS' ? '🔵 NSS' : pcd === 'NSO' ? '🟢 NSO' : pcd}
            </button>
          ))}
        </div>
      </div>

      {/* Student List */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center space-y-2">
          <Users className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="text-xs font-bold text-neutral-600">No students match your filter criteria.</p>
          <p className="text-[11px] text-neutral-400">
            Click "Sync Now" to refresh from your Google Sheet or add manually.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View (Phone screens: clean, responsive cards) */}
          <div className="sm:hidden space-y-2">
            {filteredStudents.map((st) => (
              <div
                key={st.registerNumber}
                className="bg-white border border-neutral-200 rounded-xl p-3 shadow-2xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-neutral-900">
                    {st.registerNumber}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      st.pcd === 'YRC'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : st.pcd === 'NSS'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : st.pcd === 'NSO'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {st.pcd === 'YRC' ? '🔴 YRC' : st.pcd === 'NSS' ? '🔵 NSS' : st.pcd === 'NSO' ? '🟢 NSO' : 'Not Reg'}
                  </span>
                </div>

                <div className="text-xs font-bold text-neutral-800 truncate">
                  {st.name}
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-0.5 border-t border-neutral-100">
                  <span className="font-medium text-neutral-600">{st.dept}</span>
                  <span className="font-mono font-semibold bg-neutral-100 px-1.5 py-0.5 rounded text-[10px]">
                    {st.year}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (Tablets & Desktop) */}
          <div className="hidden sm:block bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200">
                  <tr>
                    <th className="px-3.5 py-2.5">Register / ID</th>
                    <th className="px-3.5 py-2.5">Student Name</th>
                    <th className="px-3.5 py-2.5">Department</th>
                    <th className="px-3.5 py-2.5">Year</th>
                    <th className="px-3.5 py-2.5">PCD Wing</th>
                    <th className="px-3.5 py-2.5">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium">
                  {filteredStudents.map((st) => (
                    <tr key={st.registerNumber} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="px-3.5 py-2 font-mono font-bold text-neutral-900">
                        {st.registerNumber}
                      </td>
                      <td className="px-3.5 py-2 font-semibold text-neutral-800">
                        {st.name}
                      </td>
                      <td className="px-3.5 py-2 text-neutral-600">{st.dept}</td>
                      <td className="px-3.5 py-2 font-mono text-neutral-500">{st.year}</td>
                      <td className="px-3.5 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            st.pcd === 'YRC'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : st.pcd === 'NSS'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : st.pcd === 'NSO'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {st.pcd === 'YRC' ? '🔴 YRC' : st.pcd === 'NSS' ? '🔵 NSS' : st.pcd === 'NSO' ? '🟢 NSO' : 'Not Reg'}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 font-mono text-[11px] text-neutral-500">
                        {st.email}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ADD STUDENT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <h2 className="text-sm font-black text-neutral-900">Add Student Record</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Registration Number:
                </label>
                <input
                  type="text"
                  required
                  value={newReg}
                  onChange={(e) => setNewReg(e.target.value)}
                  placeholder="e.g. 23101001"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono focus:ring-2 focus:ring-neutral-400"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Student Name:
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Department:
                  </label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg"
                  >
                    <option value="CSE">CSE</option>
                    <option value="IT">IT</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="Mech">Mech</option>
                    <option value="Civil">Civil</option>
                    <option value="BME">BME</option>
                    <option value="Chemical">Chemical</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    PCD Wing:
                  </label>
                  <select
                    value={newPcd}
                    onChange={(e) => setNewPcd(e.target.value as PCDType)}
                    className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg"
                  >
                    <option value="YRC">YRC (Red)</option>
                    <option value="NSS">NSS (Blue)</option>
                    <option value="NSO">NSO (Green)</option>
                    <option value="NReg">Not Registered</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-bold"
                >
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV / TSV IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <h2 className="text-sm font-black text-neutral-900">Import Students from Text</h2>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-neutral-500">
                Paste lines formatted as: <code className="font-mono text-neutral-800">RegNumber, Name, Dept, PCD</code>
              </p>
              <textarea
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="23101001, John Doe, CSE, YRC&#10;23101002, Jane Smith, ECE, NSS"
                className="w-full p-2.5 font-mono text-[11px] border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchImport}
                className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold"
              >
                Import Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
