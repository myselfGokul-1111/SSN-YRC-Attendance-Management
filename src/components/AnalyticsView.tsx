import React from 'react';
import { AttendanceRecord, PCDEvent, SheetName, Student } from '../types';
import { PCDStorageService } from '../services/storage';
import { YrcEmblem } from './YrcEmblem';
import {
  Users,
  Award,
  Layers,
  GraduationCap,
} from 'lucide-react';

interface AnalyticsViewProps {
  events: PCDEvent[];
  rosters: Record<SheetName, Student[]>;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ events, rosters }) => {
  const attendance = PCDStorageService.getAttendance();

  // Compute total enrolled across all 12 student roster sheets
  let totalEnrolled = 0;
  for (const [key, list] of Object.entries(rosters)) {
    if (key !== 'UPDATE') {
      totalEnrolled += list.length;
    }
  }

  const uniqueStudentsMarked = new Set(attendance.map((a) => a.digitalId)).size;
  const totalScans = attendance.length;

  // Breakdown by PCD
  const pcdCounts: Record<string, number> = { YRC: 0, NSS: 0, NSO: 0, NReg: 0 };
  attendance.forEach((a) => {
    if (pcdCounts[a.pcd] !== undefined) {
      pcdCounts[a.pcd]++;
    }
  });

  // Breakdown by Batch
  const batchCounts: Record<string, number> = { '2025': 0, '2024': 0, '2023': 0 };
  attendance.forEach((a) => {
    if (batchCounts[a.batch] !== undefined) {
      batchCounts[a.batch]++;
    }
  });

  // Breakdown by Department
  const deptCounts: Record<string, number> = {};
  attendance.forEach((a) => {
    deptCounts[a.dept] = (deptCounts[a.dept] || 0) + 1;
  });
  const sortedDepts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);

  // Breakdown by Coordinator
  const coordinatorCounts: Record<string, { count: number; name: string }> = {};
  attendance.forEach((a) => {
    if (!coordinatorCounts[a.markedBy]) {
      coordinatorCounts[a.markedBy] = { count: 0, name: a.markedByName };
    }
    coordinatorCounts[a.markedBy].count++;
  });
  const sortedCoordinators = Object.entries(coordinatorCounts).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Title */}
      <div className="bg-white rounded-2xl border border-red-100 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2.5">
          <YrcEmblem size={24} />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900">
            Attendance Analytics & Turnout Distribution
          </h1>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Real-time metrics calculated from the 13 PCD roster sheets and verified attendance check-ins.
        </p>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Total Enrolled</span>
            <Users className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
            {totalEnrolled}
          </div>
          <div className="text-[11px] text-neutral-500">Across 12 student roster sheets</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Total Scans Stamped</span>
            <Layers className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
            {totalScans}
          </div>
          <div className="text-[11px] text-neutral-500">Across {events.length} campus events</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Unique Attendees</span>
            <GraduationCap className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
            {uniqueStudentsMarked}
          </div>
          <div className="text-[11px] text-neutral-500">Distinct Digital IDs verified</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Turnout Rate</span>
            <Award className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
            {totalEnrolled > 0 ? ((uniqueStudentsMarked / totalEnrolled) * 100).toFixed(1) : 0}%
          </div>
          <div className="text-[11px] text-neutral-500">Active participation ratio</div>
        </div>
      </div>

      {/* Breakdown Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Activity Distribution */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center justify-between">
            <span>PCD Activity Breakdown</span>
            <span className="text-xs font-mono font-normal text-neutral-400">YRC · NSS · NSO · NReg</span>
          </h3>

          <div className="space-y-3">
            {Object.entries(pcdCounts).map(([pcd, count]) => {
              const pct = totalScans > 0 ? Math.round((count / totalScans) * 100) : 0;
              return (
                <div key={pcd} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-800">{pcd}</span>
                    <span className="font-mono text-neutral-600 tabular-nums">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-900 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Batch Distribution */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center justify-between">
            <span>Academic Batch Breakdown</span>
            <span className="text-xs font-mono font-normal text-neutral-400">2025 · 2024 · 2023</span>
          </h3>

          <div className="space-y-3">
            {Object.entries(batchCounts).map(([batch, count]) => {
              const pct = totalScans > 0 ? Math.round((count / totalScans) * 100) : 0;
              return (
                <div key={batch} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-800">Batch {batch}</span>
                    <span className="font-mono text-neutral-600 tabular-nums">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-700 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Participation */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-neutral-900">
            Department Participation
          </h3>

          {sortedDepts.length === 0 ? (
            <p className="text-xs text-neutral-400">No attendance data yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedDepts.map(([dept, count]) => {
                const pct = totalScans > 0 ? Math.round((count / totalScans) * 100) : 0;
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-800">{dept}</span>
                      <span className="font-mono text-neutral-600 tabular-nums">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neutral-800 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coordinator Scan Activity */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-neutral-900">
            Coordinator Activity Log
          </h3>

          {sortedCoordinators.length === 0 ? (
            <p className="text-xs text-neutral-400">No coordinator scans recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedCoordinators.map(([email, data]) => {
                const pct = totalScans > 0 ? Math.round((data.count / totalScans) * 100) : 0;
                return (
                  <div key={email} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-neutral-800">{data.name}</span>
                        <span className="text-[10px] text-neutral-400 font-mono ml-2">
                          ({email.split('@')[0]})
                        </span>
                      </div>
                      <span className="font-mono text-neutral-600 tabular-nums">
                        {data.count} scans
                      </span>
                    </div>
                    <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-700 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
