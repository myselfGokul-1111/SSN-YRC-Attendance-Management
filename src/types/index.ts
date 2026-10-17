export type PCDType = 'YRC' | 'NSS' | 'NSO' | 'NReg';

export type BatchYear = '2025' | '2024' | '2023';

export type SheetName =
  | 'YRC 25'
  | 'NSS 25'
  | 'NSO 25'
  | 'NReg 25'
  | 'YRC 24'
  | 'NSS 24'
  | 'NSO 24'
  | 'NReg 24'
  | 'YRC 23'
  | 'NSS 23'
  | 'NSO 23'
  | 'NReg 23'
  | 'UPDATE';

export interface Student {
  slNo: number;
  dept: string;
  digitalId: string;
  name: string;
  section: string;
  pcd: PCDType;
  registerNumber: string;
  email: string;
  batch: BatchYear;
  sourceSheet: SheetName;
}

export interface UpdateRecord {
  id: string;
  timestamp: string;
  action: 'ENROLLED' | 'TRANSFERRED' | 'MODIFIED' | 'REMOVED';
  digitalId: string;
  studentName: string;
  dept: string;
  fromPcd?: string;
  toPcd?: string;
  remarks: string;
  updatedBy: string;
}

export interface PCDEvent {
  id: string;
  name: string;
  description: string;
  venue: string;
  date: string;
  startTime: string;
  endTime: string;
  targetPcd: 'ALL' | PCDType;
  targetBatches: BatchYear[];
  coordinators: string[]; // Email addresses
  sheetId: string;
  sheetUrl: string;
  createdAt: string;
  status: 'upcoming' | 'active' | 'completed';
}

export interface AttendanceRecord {
  id: string;
  eventId: string;
  eventName: string;
  digitalId: string;
  name: string;
  dept: string;
  registerNumber: string;
  pcd: PCDType;
  section: string;
  batch: BatchYear;
  markedBy: string; // Coordinator email
  markedByName: string;
  timestamp: string; // ISO string
  method: 'barcode_scan' | 'qr_scan' | 'manual_input' | 'quick_test';
  studentEmail?: string;
  emailSent?: boolean;
  confirmationCode?: string;
}

export type UserRole = 'admin' | 'coordinator';

export interface UserProfile {
  email: string;
  name: string;
  role: UserRole;
  department: string;
  password?: string;
}

export interface RoutingLookupResult {
  student: Student | null;
  batchCode: string;
  targetBatch: BatchYear | 'Unknown';
  targetSheets: SheetName[];
  sourceSheet?: SheetName;
  reasoning: string;
}
