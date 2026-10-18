import React from 'react';
import { PCDEvent } from '../types';
import { PCDStorageService } from '../services/storage';
import {
  Users,
  Award,
  Layers,
  Calendar,
  CheckCircle2,
  PieChart,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

interface AnalyticsViewProps {
  events: PCDEvent[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ events }) => {
  const attendance = PCDStorageService.getAttendance();
  const students = PCDStorageService.getStudents();

  const totalScans = attendance.length;
  const uniqueStudents = new Set(attendance.map((a) => a.digitalId || a.registerNumber)).size;

  // Year Breakdown
  const yearCounts: Record<string, number> = {
    '4th Year': 0,
    '3rd Year': 0,
    '2nd Year': 0,
    '1st Year': 0,
    'Other': 0,
  };

  attendance.forEach((a) => {
    if (yearCounts[a.year] !== undefined) {
      yearCounts[a.year]++;
    } else {
      yearCounts['Other']++;
    }
  });

  // PCD Breakdown
  const pcdCounts: Record<string, number> = {
    YRC: 0,
    NSS: 0,
    NSO: 0,
    NReg: 0,
  };

  attendance.forEach((a) => {
    if (pcdCounts[a.pcd] !== undefined) {
      pcdCounts[a.pcd]++;
    } else {
      pcdCounts.NReg++;
    }
  });

  // Department Breakdown
  const deptCounts: Record<string, number> = {};
  attendance.forEach((a) => {
    deptCounts[a.dept] = (deptCounts[a.dept] || 0) + 1;
  });
  const sortedDepts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-xs">
        <h1 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
          Attendance Analytics & Insights
        </h1>
        <p className="text-xs text-neutral-500 font-medium">
          Real-time participation statistics across College Years and PCD Wings.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Total Scans
          </div>
          <div className="text-xl sm:text-2xl font-black text-neutral-900 mt-1">
            {totalScans}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Across all events</div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Unique Students
          </div>
          <div className="text-xl sm:text-2xl font-black text-red-600 mt-1">
            {uniqueStudents}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Active participants</div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Total Events
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-600 mt-1">
            {events.length}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Scheduled activities</div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Enrolled In DB
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
            {students.length}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Cataloged records</div>
        </div>
      </div>

      {/* Grid: Year Breakdown & PCD Wing Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Year Participation */}
        <div className="bg-white border border-neutral-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-neutral-500" />
            <span>Participation by College Year</span>
          </h2>

          <div className="space-y-2.5">
            {[
              { label: '4th Year (231 / 237)', key: '4th Year', color: 'bg-indigo-600' },
              { label: '3rd Year (241 / 247)', key: '3rd Year', color: 'bg-purple-600' },
              { label: '2nd Year (251 / 257)', key: '2nd Year', color: 'bg-teal-600' },
              { label: '1st Year (261 / 267)', key: '1st Year', color: 'bg-amber-600' },
            ].map(({ label, key, color }) => {
              const count = yearCounts[key] || 0;
              const percent = totalScans > 0 ? Math.round((count / totalScans) * 100) : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-neutral-700">
                    <span>{label}</span>
                    <span className="font-mono">
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${color}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PCD Wing Breakdown */}
        <div className="bg-white border border-neutral-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-neutral-500" />
            <span>Participation by PCD Wing</span>
          </h2>

          <div className="space-y-2.5">
            {[
              { name: 'YRC (Youth Red Cross)', key: 'YRC', color: 'bg-red-600', textColor: 'text-red-700' },
              { name: 'NSS (National Service Scheme)', key: 'NSS', color: 'bg-blue-600', textColor: 'text-blue-700' },
              { name: 'NSO (National Sports Org)', key: 'NSO', color: 'bg-emerald-600', textColor: 'text-emerald-700' },
              { name: 'Not Registered', key: 'NReg', color: 'bg-neutral-400', textColor: 'text-neutral-600' },
            ].map(({ name, key, color, textColor }) => {
              const count = pcdCounts[key] || 0;
              const percent = totalScans > 0 ? Math.round((count / totalScans) * 100) : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className={textColor}>{name}</span>
                    <span className="font-mono text-neutral-700">
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${color}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Events Summary Table */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
          Attendance by Event
        </h2>

        {events.length === 0 ? (
          <div className="text-center py-6 text-neutral-400 text-xs">
            No events have been created yet.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {events.map((evt) => {
              const evtAttendance = PCDStorageService.getAttendanceForEvent(evt.id);
              return (
                <div key={evt.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-neutral-900">{evt.name}</div>
                    <div className="text-[11px] text-neutral-500">
                      {evt.date} · {evt.venue}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-neutral-800">
                      {evtAttendance.length}
                    </span>
                    <span className="text-[11px] text-neutral-400">scans</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Department Breakdown */}
      {sortedDepts.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
            Department Distribution
          </h2>
          <div className="flex flex-wrap gap-2 pt-1">
            {sortedDepts.map(([dept, count]) => (
              <span
                key={dept}
                className="bg-neutral-50 border border-neutral-200 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-700"
              >
                <b>{dept}</b>: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
