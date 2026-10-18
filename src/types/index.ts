export type PCDType = 'YRC' | 'NSS' | 'NSO' | 'NReg';

export type StudentYear = '2nd Year' | '3rd Year' | '4th Year' | '1st Year' | 'Unknown';

export interface Student {
  slNo?: number;
  digitalId: string;
  registerNumber: string;
  name: string;
  dept: string;
  section?: string;
  pcd: PCDType;
  year: StudentYear;
  email?: string;
}

export interface PCDEvent {
  id: string;
  name: string;
  description: string;
  venue: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (24h)
  endTime: string; // HH:mm (24h)
  targetPcd: 'ALL' | PCDType;
  coordinators: string[]; // Email addresses
  sheetTabName?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  eventId: string;
  eventName: string;
  digitalId: string;
  registerNumber: string;
  name: string;
  dept: string;
  year: StudentYear;
  pcd: PCDType;
  remarks?: string;
  markedBy: string; // Coordinator email
  markedByName: string;
  timestamp: string; // ISO string
  method: 'camera_scan' | 'barcode_scanner' | 'manual_input';
  studentEmail?: string;
  confirmationCode?: string;
}

export type UserRole = 'admin' | 'coordinator';

export interface UserProfile {
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  password?: string;
}

/**
 * Maps SSN Register Number / Digital ID prefix to College Year:
 * - 231XXXX or 237XXXX -> 4th Year
 * - 241XXXX or 247XXXX -> 3rd Year
 * - 251XXXX or 257XXXX -> 2nd Year
 * - 261XXXX or 267XXXX -> 1st Year
 */
export function getYearFromId(idOrReg: string): StudentYear {
  if (!idOrReg) return 'Unknown';
  const clean = idOrReg.trim().replace(/\D/g, '');

  // Look for 231/237, 241/247, 251/257, 261/267
  if (clean.startsWith('231') || clean.startsWith('237') || clean.includes('231') || clean.includes('237')) {
    return '4th Year';
  }
  if (clean.startsWith('241') || clean.startsWith('247') || clean.includes('241') || clean.includes('247')) {
    return '3rd Year';
  }
  if (clean.startsWith('251') || clean.startsWith('257') || clean.includes('251') || clean.includes('257')) {
    return '2nd Year';
  }
  if (clean.startsWith('261') || clean.startsWith('267') || clean.includes('261') || clean.includes('267')) {
    return '1st Year';
  }

  // Check 2-digit prefix fallback
  if (clean.startsWith('23')) return '4th Year';
  if (clean.startsWith('24')) return '3rd Year';
  if (clean.startsWith('25')) return '2nd Year';
  if (clean.startsWith('26')) return '1st Year';

  return 'Unknown';
}
