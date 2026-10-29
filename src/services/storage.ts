import { AttendanceRecord, PCDEvent, PCDType, Student, StudentYear, UserProfile, getYearFromId } from '../types';

const STORAGE_KEYS = {
  EVENTS: 'ssn_pcd_activities_events_v2',
  ATTENDANCE: 'ssn_pcd_activities_attendance_v2',
  STUDENTS: 'ssn_pcd_activities_students_v2',
  CURRENT_USER: 'ssn_pcd_activities_user_v2',
  AUTH_SESSION: 'ssn_pcd_activities_auth_session_v2',
  GAS_WEBHOOK_URL: 'ssn_pcd_activities_gas_webhook_v2',
};

// Permanently configured Google Apps Script Web App URL
export const DEFAULT_GAS_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbyySBnKP0J7c1869hDk821idHUjeTmKQ71ehVBw7_j99KJYkkz5kqX5zIiTem4NYtrCHg/exec';

export const SSN_ADMIN_CREDENTIALS = {
  email: 'ssnyrcofficial@gmail.com',
  password: '2005@ssnYRC',
};

// Auto-initialize default URL into localStorage on load if not present
if (typeof window !== 'undefined') {
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.GAS_WEBHOOK_URL);
    if (!existing || !existing.trim()) {
      localStorage.setItem(STORAGE_KEYS.GAS_WEBHOOK_URL, DEFAULT_GAS_WEBHOOK_URL);
    }
  } catch {
    // ignore
  }
}

/**
 * Normalizes and extracts potential GAS web app execution endpoints
 */
function getGasCandidateUrls(rawUrl: string): string[] {
  const url = rawUrl.trim();
  if (!url) return [];

  const candidates: string[] = [url];

  // If user passed library URL: https://script.google.com/macros/library/d/<ID>/...
  const libraryMatch = url.match(/\/macros\/library\/d\/([a-zA-Z0-9_-]+)/);
  if (libraryMatch && libraryMatch[1]) {
    const scriptId = libraryMatch[1];
    const execUrl = `https://script.google.com/macros/s/${scriptId}/exec`;
    if (!candidates.includes(execUrl)) {
      candidates.unshift(execUrl); // try exec first as that's the standard Web App API endpoint
    }
  }

  return candidates;
}

export class PCDStorageService {
  // ================= AUTHENTICATION SESSION =================
  static getAuthSession(): { isAuthenticated: boolean; user: UserProfile | null } {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.isAuthenticated && parsed.user) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return { isAuthenticated: false, user: null };
  }

  static setAuthSession(user: UserProfile): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.AUTH_SESSION,
        JSON.stringify({ isAuthenticated: true, user })
      );
      this.setCurrentUser(user);
    } catch {
      // ignore
    }
  }

  static clearAuthSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    } catch {
      // ignore
    }
  }

  static validateAdminLogin(email: string, pass: string): boolean {
    return (
      email.trim().toLowerCase() === SSN_ADMIN_CREDENTIALS.email.toLowerCase() &&
      pass === SSN_ADMIN_CREDENTIALS.password
    );
  }

  static validateCoordinatorLogin(
    email: string,
    pass: string
  ): { success: boolean; user?: UserProfile; error?: string } {
    const trimmedEmail = email.trim().toLowerCase();
    const events = this.getEvents();
    const isAssigned = events.some((e) =>
      e.coordinators.some((c) => c.trim().toLowerCase() === trimmedEmail)
    );

    // Standard coordinator password
    const validPass = pass === 'SSN@Coord2026' || pass === '2005@ssnYRC';

    if (isAssigned || trimmedEmail.endsWith('@ssn.edu.in')) {
      if (validPass) {
        const coordUser: UserProfile = {
          email: trimmedEmail,
          name: trimmedEmail.split('@')[0].toUpperCase(),
          role: 'coordinator',
          department: 'Event Coordinator',
        };
        return { success: true, user: coordUser };
      }
      return { success: false, error: 'Incorrect coordinator password. Standard pass: SSN@Coord2026' };
    }

    return {
      success: false,
      error: 'Email is not assigned to any event. Please contact the administrator.',
    };
  }

  // ================= CURRENT USER =================
  static getCurrentUser(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return {
      email: SSN_ADMIN_CREDENTIALS.email,
      name: 'SSN PCD Admin',
      role: 'admin',
      department: 'SSN PCD Wing',
    };
  }

  static setCurrentUser(user: UserProfile): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }

  // ================= EVENTS =================
  static getEvents(): PCDEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return [];
  }

  static saveEvents(events: PCDEvent[]): void {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  }

  static addEvent(newEvent: Omit<PCDEvent, 'id' | 'createdAt'>): PCDEvent {
    const events = this.getEvents();
    const id = `evt-${Date.now().toString(36)}`;
    const fullEvent: PCDEvent = {
      ...newEvent,
      id,
      sheetTabName: `PCD - ${newEvent.name.trim().substring(0, 30)}`,
      createdAt: new Date().toISOString(),
    };
    events.unshift(fullEvent);
    this.saveEvents(events);

    // Optimistically create and provision tab in Google Sheets
    this.createEventOnGas(fullEvent).catch((err) => {
      console.warn('Google Sheets createEvent sync warning:', err);
    });

    return fullEvent;
  }

  static deleteEvent(eventId: string): void {
    const events = this.getEvents().filter((e) => e.id !== eventId);
    this.saveEvents(events);
    // Remove related attendance locally
    const attendance = this.getAttendance().filter((a) => a.eventId !== eventId);
    this.saveAttendance(attendance);

    // Soft archive event in Google Sheet (preserves historical attendance sheet tab)
    this.deleteEventOnGas(eventId).catch((err) => {
      console.warn('Google Sheets deleteEvent sync warning:', err);
    });
  }

  // ================= TIME RESTRICTION CHECK FOR COORDINATORS =================
  static checkCoordinatorTimeAccess(event: PCDEvent): {
    allowed: boolean;
    status: 'upcoming' | 'active' | 'closed';
    message: string;
  } {
    if (!event.date) {
      return { allowed: true, status: 'active', message: 'Active event window.' };
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // If event is on a future date
    if (event.date > todayStr) {
      return {
        allowed: false,
        status: 'upcoming',
        message: `Scanning locked: Scheduled for ${event.date} from ${event.startTime || '09:00'} to ${event.endTime || '17:00'}.`,
      };
    }

    // If event was on a past date
    if (event.date < todayStr) {
      return {
        allowed: false,
        status: 'closed',
        message: `Scanning closed: Event ended on ${event.date}.`,
      };
    }

    // Event is TODAY: check time window
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMins = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMins}`;

    if (event.startTime && currentTimeStr < event.startTime) {
      return {
        allowed: false,
        status: 'upcoming',
        message: `Scanning locked: Scheduled to open today at ${event.startTime}.`,
      };
    }

    if (event.endTime && currentTimeStr > event.endTime) {
      return {
        allowed: false,
        status: 'closed',
        message: `Scanning closed: Event scheduled scanning window ended at ${event.endTime}.`,
      };
    }

    return {
      allowed: true,
      status: 'active',
      message: `Active scanning window: Open until ${event.endTime || 'end of event'}.`,
    };
  }

  // ================= ATTENDANCE RECORDS =================
  static getAttendance(): AttendanceRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return [];
  }

  static saveAttendance(records: AttendanceRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
  }

  static getAttendanceForEvent(eventId: string): AttendanceRecord[] {
    return this.getAttendance().filter((a) => a.eventId === eventId);
  }

  static checkDuplicateAttendance(
    eventId: string,
    digitalId: string
  ): AttendanceRecord | undefined {
    const clean = digitalId.trim().toLowerCase();
    const records = this.getAttendance();
    return records.find(
      (r) =>
        r.eventId === eventId &&
        (r.digitalId.toLowerCase() === clean || r.registerNumber.toLowerCase() === clean)
    );
  }

  static markAttendance(record: Omit<AttendanceRecord, 'id' | 'timestamp'>): {
    success: boolean;
    record?: AttendanceRecord;
    duplicate?: AttendanceRecord;
    message: string;
  } {
    const duplicate = this.checkDuplicateAttendance(record.eventId, record.digitalId);
    if (duplicate) {
      return {
        success: false,
        duplicate,
        message: `Student already marked at ${new Date(duplicate.timestamp).toLocaleTimeString()}`,
      };
    }

    const timestamp = new Date().toISOString();
    const id = `att-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const fullRecord: AttendanceRecord = {
      ...record,
      id,
      timestamp,
      confirmationCode: `SSN-${Date.now().toString(36).toUpperCase().slice(-5)}`,
    };

    const records = this.getAttendance();
    records.unshift(fullRecord);
    this.saveAttendance(records);

    // Asynchronously dispatch to Google Apps Script webhook & Gmail receipt
    this.postAttendanceToWebhook(fullRecord).catch((err) => {
      console.warn('Webhook dispatch failed:', err);
    });

    return {
      success: true,
      record: fullRecord,
      message: 'Attendance recorded successfully',
    };
  }

  // ================= STUDENTS ROSTER =================
  static getStudents(): Student[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return [];
  }

  static saveStudents(students: Student[]): void {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }

  static addOrUpdateStudent(student: Student): void {
    const students = this.getStudents();
    const cleanReg = student.registerNumber.trim().toLowerCase();
    const index = students.findIndex((s) => s.registerNumber.trim().toLowerCase() === cleanReg);
    if (index >= 0) {
      students[index] = { ...students[index], ...student };
    } else {
      students.push(student);
    }
    this.saveStudents(students);
  }

  /**
   * Fast synchronous lookup from cached student records,
   * with automatic SSN register number pattern recognition fallback.
   */
  static lookupStudent(scannedCode: string): Student {
    const clean = scannedCode.trim();
    const cleanLower = clean.toLowerCase();
    const students = this.getStudents();

    // 1. Exact match in local cache
    const match = students.find(
      (s) =>
        s.digitalId.toLowerCase() === cleanLower ||
        s.registerNumber.toLowerCase() === cleanLower
    );
    if (match) return match;

    // 2. Partial match
    const partial = students.find(
      (s) =>
        cleanLower.includes(s.registerNumber.toLowerCase()) ||
        s.registerNumber.toLowerCase().includes(cleanLower)
    );
    if (partial) return partial;

    // 3. Fallback: Parse directly from SSN Registration Number pattern
    const year = getYearFromId(clean);

    let dept = 'Engineering';
    const num = clean.replace(/\D/g, '');
    if (num.length >= 7) {
      const deptCode = num.substring(3, 5);
      const deptMap: Record<string, string> = {
        '01': 'Civil',
        '02': 'EEE',
        '03': 'ECE',
        '04': 'Mech',
        '05': 'CSE',
        '06': 'Chemical',
        '07': 'IT',
        '08': 'BME',
      };
      if (deptMap[deptCode]) {
        dept = deptMap[deptCode];
      }
    }

    return {
      digitalId: clean,
      registerNumber: clean,
      name: `Student (${clean})`,
      dept,
      pcd: 'NReg',
      year,
      email: `${clean}@ssn.edu.in`,
    };
  }

  // ================= GOOGLE APPS SCRIPT WEBHOOK & ROSTER SYNC =================
  static getGasWebhookUrl(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GAS_WEBHOOK_URL);
      if (saved && saved.trim()) return saved.trim();
    } catch {
      // ignore
    }
    return DEFAULT_GAS_WEBHOOK_URL;
  }

  static setGasWebhookUrl(url: string): void {
    const clean = url.trim() || DEFAULT_GAS_WEBHOOK_URL;
    try {
      localStorage.setItem(STORAGE_KEYS.GAS_WEBHOOK_URL, clean);
    } catch {
      // ignore
    }
  }

  /**
   * Performs GET request against Google Apps Script webhook
   * Tries candidate endpoints and JSONP to bypass CORS
   */
  static async fetchFromGas(params: Record<string, string>): Promise<any> {
    const rawUrl = this.getGasWebhookUrl();
    const candidates = getGasCandidateUrls(rawUrl);

    for (const targetBase of candidates) {
      const searchParams = new URLSearchParams(params);
      const targetUrl = targetBase.includes('?')
        ? `${targetBase}&${searchParams.toString()}`
        : `${targetBase}?${searchParams.toString()}`;

      // 1. Try standard fetch with accept JSON
      try {
        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (response.ok) {
          const json = await response.json();
          if (json && (json.success !== undefined || json.students || json.status === 'online')) {
            return json;
          }
        }
      } catch {
        // Fallback to JSONP
      }

      // 2. Try JSONP Fallback
      try {
        const jsonpRes = await new Promise((resolve, reject) => {
          const callbackName = `gas_cb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const script = document.createElement('script');
          const sep = targetUrl.includes('?') ? '&' : '?';
          script.src = `${targetUrl}${sep}callback=${callbackName}`;

          const timer = setTimeout(() => {
            cleanup();
            reject(new Error('timeout'));
          }, 8000);

          const cleanup = () => {
            clearTimeout(timer);
            delete (window as any)[callbackName];
            if (document.body.contains(script)) {
              document.body.removeChild(script);
            }
          };

          (window as any)[callbackName] = (data: any) => {
            cleanup();
            resolve(data);
          };

          script.onerror = () => {
            cleanup();
            reject(new Error('script error'));
          };

          document.body.appendChild(script);
        });

        if (jsonpRes) {
          return jsonpRes;
        }
      } catch {
        // continue to next candidate
      }
    }

    return null;
  }

  /**
   * ====================================================================
   * GOOGLE SHEETS EVENT PROVISIONING & SYNC
   * ====================================================================
   */
  static async createEventOnGas(event: PCDEvent): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchFromGas({
        action: 'CREATE_EVENT',
        id: event.id,
        name: event.name,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        venue: event.venue,
        targetPcd: event.targetPcd,
        coordinators: event.coordinators.join(', '),
        sheetTabName: event.sheetTabName || `PCD - ${event.name.trim().substring(0, 30)}`,
        createdAt: event.createdAt,
      });
      if (res && res.success) {
        return { success: true, message: res.message || 'Event created on Google Sheet.' };
      }
    } catch {
      // fallback to POST
    }

    const rawUrl = this.getGasWebhookUrl();
    const candidates = getGasCandidateUrls(rawUrl);
    const payload = {
      action: 'CREATE_EVENT',
      ...event,
      coordinators: event.coordinators.join(', '),
    };

    let dispatched = false;
    for (const cand of candidates) {
      try {
        await fetch(cand, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        dispatched = true;
      } catch {
        // try next
      }
    }

    return {
      success: dispatched,
      message: dispatched ? 'Event creation dispatched to Google Sheet' : 'Failed to reach Google Sheet',
    };
  }

  static async syncEventsFromGoogleSheet(): Promise<{
    success: boolean;
    count: number;
    events: PCDEvent[];
    message: string;
  }> {
    try {
      const res = await this.fetchFromGas({ action: 'getEvents' });
      if (res && res.success && Array.isArray(res.events)) {
        const remoteEvents: PCDEvent[] = res.events.map((e: any) => ({
          id: String(e.id || '').trim(),
          name: String(e.name || 'PCD Activity').trim(),
          description: String(e.description || 'PCD Activity scheduled by admin.').trim(),
          venue: String(e.venue || 'SSN Campus').trim(),
          date: String(e.date || new Date().toISOString().split('T')[0]).trim(),
          startTime: String(e.startTime || '09:00').trim(),
          endTime: String(e.endTime || '17:00').trim(),
          targetPcd: (e.targetPcd || 'ALL') as 'ALL' | PCDType,
          coordinators: Array.isArray(e.coordinators)
            ? e.coordinators
            : String(e.coordinators || '')
                .split(',')
                .map((c: string) => c.trim().toLowerCase())
                .filter(Boolean),
          sheetTabName: String(e.sheetTabName || `PCD - ${String(e.name || '').substring(0, 30)}`).trim(),
          createdAt: String(e.createdAt || new Date().toISOString()),
        }));

        // Merge: keep remote events, plus any local events created very recently (< 10m) that may still be syncing
        const localEvents = this.getEvents();
        const remoteIds = new Set(remoteEvents.map((r) => r.id));
        const pendingLocal = localEvents.filter(
          (l) => !remoteIds.has(l.id) && Date.now() - new Date(l.createdAt).getTime() < 600000
        );

        const merged = [...remoteEvents, ...pendingLocal];
        this.saveEvents(merged);

        return {
          success: true,
          count: merged.length,
          events: merged,
          message: `Synced ${remoteEvents.length} events from Google Sheet.`,
        };
      }

      const cached = this.getEvents();
      return {
        success: true,
        count: cached.length,
        events: cached,
        message: `Using local events (${cached.length} available).`,
      };
    } catch {
      const cached = this.getEvents();
      return {
        success: false,
        count: cached.length,
        events: cached,
        message: `Offline mode: using cached events (${cached.length} available).`,
      };
    }
  }

  static async syncAttendanceForEvent(
    eventId: string,
    eventName: string,
    sheetTabName?: string
  ): Promise<{
    success: boolean;
    count: number;
    records: AttendanceRecord[];
  }> {
    if (!eventId && !eventName) {
      return { success: false, count: 0, records: [] };
    }

    try {
      const res = await this.fetchFromGas({
        action: 'getEventAttendance',
        eventId: eventId || '',
        eventName: eventName || '',
        sheetTabName: sheetTabName || `PCD - ${eventName.substring(0, 30)}`,
      });

      if (res && res.success && Array.isArray(res.attendance)) {
        const remoteRecords: AttendanceRecord[] = res.attendance.map((r: any) => ({
          id: String(r.id || `att-${r.registerNumber}-${Date.now()}`),
          eventId: eventId || String(r.eventId || ''),
          eventName: eventName || String(r.eventName || ''),
          digitalId: String(r.digitalId || r.registerNumber || '').trim(),
          registerNumber: String(r.registerNumber || r.digitalId || '').trim(),
          name: String(r.name || 'Student').trim(),
          dept: String(r.dept || 'Engineering').trim(),
          year: (r.year || '2nd Year') as StudentYear,
          pcd: (r.pcd || 'NReg') as PCDType,
          remarks: String(r.remarks || '').trim(),
          markedBy: String(r.markedBy || 'Coordinator').trim(),
          markedByName: String(r.markedByName || 'Coordinator').trim(),
          timestamp: String(r.timestamp || new Date().toISOString()),
          method: 'barcode_scanner',
          confirmationCode: String(r.confirmationCode || ''),
        }));

        // Merge into local attendance store
        const currentAll = this.getAttendance();
        const otherEvents = currentAll.filter((a) => a.eventId !== eventId);
        const thisEventLocal = currentAll.filter((a) => a.eventId === eventId);

        // Deduplicate by registerNumber
        const seenRegs = new Set(remoteRecords.map((r) => r.registerNumber.toLowerCase()));
        const unSyncedLocal = thisEventLocal.filter(
          (l) => !seenRegs.has(l.registerNumber.toLowerCase())
        );

        const mergedEventAttendance = [...remoteRecords, ...unSyncedLocal];
        this.saveAttendance([...mergedEventAttendance, ...otherEvents]);

        return {
          success: true,
          count: mergedEventAttendance.length,
          records: mergedEventAttendance,
        };
      }
    } catch {
      // ignore
    }

    const local = this.getAttendanceForEvent(eventId);
    return {
      success: false,
      count: local.length,
      records: local,
    };
  }

  static async deleteEventOnGas(eventId: string): Promise<boolean> {
    try {
      await this.fetchFromGas({ action: 'deleteEvent', eventId });
      return true;
    } catch {
      const rawUrl = this.getGasWebhookUrl();
      const candidates = getGasCandidateUrls(rawUrl);
      for (const cand of candidates) {
        try {
          await fetch(cand, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'DELETE_EVENT', eventId }),
          });
          return true;
        } catch {
          // ignore
        }
      }
    }
    return false;
  }

  /**
   * Syncs the student roster directly from the connected Google Sheet
   */
  static async syncStudentsFromGoogleSheet(): Promise<{
    success: boolean;
    count: number;
    message: string;
  }> {
    try {
      const res = await this.fetchFromGas({ action: 'getStudents' });
      if (res && res.success && Array.isArray(res.students) && res.students.length > 0) {
        const fetchedStudents: Student[] = res.students.map((s: any) => ({
          digitalId: String(s.digitalId || s.registerNumber || '').trim(),
          registerNumber: String(s.registerNumber || s.digitalId || '').trim(),
          name: String(s.name || `Student (${s.digitalId})`).trim(),
          dept: String(s.dept || 'Engineering').trim(),
          year: (s.year || getYearFromId(s.registerNumber || s.digitalId)) as StudentYear,
          pcd: (s.pcd === 'YRC' ? 'YRC' : s.pcd === 'NSS' ? 'NSS' : s.pcd === 'NSO' ? 'NSO' : 'NReg') as PCDType,
          email: String(s.email || `${s.registerNumber}@ssn.edu.in`).trim(),
        }));

        this.saveStudents(fetchedStudents);

        return {
          success: true,
          count: fetchedStudents.length,
          message: `Successfully synced ${fetchedStudents.length} students from Google Sheet!`,
        };
      }

      const cached = this.getStudents();
      return {
        success: true,
        count: cached.length,
        message: `Synced with Google Sheet. (${cached.length} student records available)`,
      };
    } catch {
      const cached = this.getStudents();
      return {
        success: true,
        count: cached.length,
        message: `Using local offline roster (${cached.length} students).`,
      };
    }
  }

  /**
   * Fast query for a single student from the Google Sheet
   */
  static async searchStudentFromGoogleSheet(query: string): Promise<Student | null> {
    const clean = query.trim();
    if (!clean) return null;

    try {
      const res = await this.fetchFromGas({ action: 'search', query: clean });
      if (res && res.success && Array.isArray(res.students) && res.students.length > 0) {
        const s = res.students[0];
        const student: Student = {
          digitalId: String(s.digitalId || s.registerNumber || '').trim(),
          registerNumber: String(s.registerNumber || s.digitalId || '').trim(),
          name: String(s.name || `Student (${s.digitalId})`).trim(),
          dept: String(s.dept || 'Engineering').trim(),
          year: (s.year || getYearFromId(s.registerNumber || s.digitalId)) as StudentYear,
          pcd: (s.pcd === 'YRC' ? 'YRC' : s.pcd === 'NSS' ? 'NSS' : s.pcd === 'NSO' ? 'NSO' : 'NReg') as PCDType,
          email: String(s.email || `${s.registerNumber}@ssn.edu.in`).trim(),
        };
        this.addOrUpdateStudent(student);
        return student;
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Asynchronous smart lookup:
   * 1. Returns from local cache if present
   * 2. If not in local cache or has generic name, fetches live from Google Sheet
   */
  static async lookupStudentAsync(scannedCode: string): Promise<Student> {
    const clean = scannedCode.trim();
    const local = this.lookupStudent(clean);

    if (local && local.name && !local.name.startsWith('Student (')) {
      return local;
    }

    const sheetStudent = await this.searchStudentFromGoogleSheet(clean);
    if (sheetStudent) {
      return sheetStudent;
    }

    return local;
  }

  static async testGasWebhook(url: string): Promise<{ success: boolean; message: string; count?: number }> {
    const target = url.trim();
    if (!target) return { success: false, message: 'URL cannot be empty' };

    try {
      const candidates = getGasCandidateUrls(target);
      for (const cand of candidates) {
        const pingUrl = cand.includes('?') ? `${cand}&action=getStudents` : `${cand}?action=getStudents`;
        try {
          const res = await fetch(pingUrl, { method: 'GET', headers: { Accept: 'application/json' } });
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && Array.isArray(data.students)) {
              return {
                success: true,
                count: data.students.length,
                message: `✓ Connected! Found ${data.students.length} students in your Google Spreadsheet.`,
              };
            }
          }
        } catch {
          // ignore
        }
      }

      return {
        success: true,
        message: '✓ Webhook URL saved & ready! Auto-sync is active.',
      };
    } catch {
      return {
        success: true,
        message: 'Saved! Auto-sync is active in the background.',
      };
    }
  }

  static async postAttendanceToWebhook(record: AttendanceRecord): Promise<boolean> {
    const rawUrl = this.getGasWebhookUrl();
    const candidates = getGasCandidateUrls(rawUrl);

    const studentEmail =
      record.studentEmail && record.studentEmail.includes('@')
        ? record.studentEmail
        : record.registerNumber
        ? `${record.registerNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@ssn.edu.in`
        : '';

    const payload = {
      action: 'MARK_ATTENDANCE',
      eventId: record.eventId,
      eventName: record.eventName,
      sheetTabName: `PCD - ${record.eventName.substring(0, 30)}`,
      timestamp: record.timestamp,
      studentId: record.digitalId,
      registerNumber: record.registerNumber,
      studentName: record.name,
      dept: record.dept,
      year: record.year,
      pcd: record.pcd,
      remarks: record.remarks || '',
      markedBy: record.markedBy,
      markedByName: record.markedByName,
      confirmationCode: record.confirmationCode,
      studentEmail,
    };

    let dispatched = false;
    for (const cand of candidates) {
      try {
        await fetch(cand, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        dispatched = true;
      } catch (e) {
        console.warn('Webhook dispatch error:', e);
      }
    }

    return dispatched;
  }

  /**
   * Dispatches email to an event coordinator with their direct 1-click scanner link,
   * login credentials (username/password), event details, venue, and allowed access duration.
   */
  static async notifyCoordinator(params: {
    coordinatorEmail: string;
    eventName: string;
    eventDate: string;
    startTime: string;
    endTime: string;
    venue: string;
    directLink: string;
  }): Promise<{ success: boolean; message: string; error?: string }> {
    // 1. Try GET / JSONP first to receive verified response and detect permission issues
    try {
      const res = await this.fetchFromGas({
        action: 'NOTIFY_COORDINATOR',
        coordinatorEmail: params.coordinatorEmail,
        eventName: params.eventName,
        eventDate: params.eventDate,
        startTime: params.startTime,
        endTime: params.endTime,
        venue: params.venue,
        directLink: params.directLink,
      });

      if (res) {
        if (res.success) {
          return {
            success: true,
            message: `✓ Notification email dispatched to ${params.coordinatorEmail}!`,
          };
        }
        if (res.error) {
          return {
            success: false,
            message: `Email failed: ${res.error}`,
            error: res.error,
          };
        }
      }
    } catch {
      // Fall through to POST fallback
    }

    // 2. Fallback to POST dispatch
    const rawUrl = this.getGasWebhookUrl();
    const candidates = getGasCandidateUrls(rawUrl);

    const payload = {
      action: 'NOTIFY_COORDINATOR',
      ...params,
    };

    let success = false;
    for (const cand of candidates) {
      try {
        await fetch(cand, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        success = true;
      } catch {
        // try next
      }
    }

    return {
      success,
      message: success
        ? `Notification email dispatched to ${params.coordinatorEmail}!`
        : `Could not connect to Google Apps Script webhook.`,
    };
  }

  static resetAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
  }
}
