import { INITIAL_USER_PROFILES, SEED_ATTENDANCE, SEED_EVENTS, SEED_ROSTERS, SEED_UPDATE_LOGS } from '../data/seedData';
import { AttendanceRecord, PCDEvent, PCDType, SheetName, Student, UpdateRecord, UserProfile } from '../types';

const STORAGE_KEYS = {
  ROSTERS: 'ssn_pcd_rosters_v1',
  EVENTS: 'ssn_pcd_events_v1',
  ATTENDANCE: 'ssn_pcd_attendance_v1',
  UPDATE_LOGS: 'ssn_pcd_update_logs_v1',
  CURRENT_USER: 'ssn_pcd_current_user_v1',
  AUTH_SESSION: 'ssn_pcd_auth_session_v1',
  LAST_SHEETS_SYNC: 'ssn_pcd_sheets_sync_time_v1',
  GAS_WEBHOOK_URL: 'ssn_pcd_gas_webhook_url_v1',
};

export const SSN_ADMIN_CREDENTIALS = {
  email: 'ssnyrcofficial@gmail.com',
  password: '2005@ssnYRC',
};

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

  static getCoordinatorPassword(email: string): string {
    const all = this.getAllUsers();
    const found = all.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    return found?.password || 'SSN@Coord2026';
  }

  static validateCoordinatorLogin(
    email: string,
    pass: string
  ): { success: boolean; user?: UserProfile; error?: string } {
    const trimmedEmail = email.trim().toLowerCase();
    const all = this.getAllUsers();
    const found = all.find((u) => u.email.toLowerCase() === trimmedEmail);

    // If predefined coordinator
    if (found && found.role === 'coordinator') {
      const expectedPass = found.password || 'SSN@Coord2026';
      if (pass === expectedPass) {
        return { success: true, user: found };
      }
      return { success: false, error: 'Incorrect coordinator password. Please check your allocation email.' };
    }

    // Check if email is assigned to any event
    const events = this.getEvents();
    const isAssigned = events.some((e) =>
      e.coordinators.some((c) => c.toLowerCase() === trimmedEmail)
    );

    if (isAssigned) {
      if (pass === 'SSN@Coord2026') {
        const coordUser: UserProfile = {
          email: trimmedEmail,
          name: trimmedEmail.split('@')[0],
          role: 'coordinator',
          department: 'Event Coordinator',
          password: 'SSN@Coord2026',
        };
        return { success: true, user: coordUser };
      }
      return { success: false, error: 'Incorrect coordinator password. Please check your allocation email.' };
    }

    // If email is an SSN email and password matches standard event pass
    if (trimmedEmail.endsWith('@ssn.edu.in') && pass === 'SSN@Coord2026') {
      const coordUser: UserProfile = {
        email: trimmedEmail,
        name: trimmedEmail.split('@')[0],
        role: 'coordinator',
        department: 'Assigned Coordinator',
        password: 'SSN@Coord2026',
      };
      return { success: true, user: coordUser };
    }

    return {
      success: false,
      error: 'Coordinator email not registered or password invalid. Please verify your allocation email.',
    };
  }

  // ================= USER PROFILE =================
  static getCurrentUser(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return INITIAL_USER_PROFILES[0]; // SSN YRC Administrator by default
  }

  static setCurrentUser(user: UserProfile): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }

  static getAllUsers(): UserProfile[] {
    return INITIAL_USER_PROFILES;
  }

  // ================= ROSTER SHEETS =================
  static getRosters(): Record<SheetName, Student[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ROSTERS);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    // Initialize with seed
    localStorage.setItem(STORAGE_KEYS.ROSTERS, JSON.stringify(SEED_ROSTERS));
    return SEED_ROSTERS;
  }

  static saveRosters(rosters: Record<SheetName, Student[]>): void {
    localStorage.setItem(STORAGE_KEYS.ROSTERS, JSON.stringify(rosters));
  }

  // ================= EVENTS =================
  static getEvents(): PCDEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(SEED_EVENTS));
    return SEED_EVENTS;
  }

  static saveEvents(events: PCDEvent[]): void {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  }

  static addEvent(newEvent: Omit<PCDEvent, 'id' | 'sheetId' | 'sheetUrl' | 'createdAt'>): PCDEvent {
    const events = this.getEvents();
    const id = `evt-${Date.now().toString(36)}`;
    const randomSheetHash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const sheetId = `1${randomSheetHash}`;
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

    const fullEvent: PCDEvent = {
      ...newEvent,
      id,
      sheetId,
      sheetUrl,
      createdAt: new Date().toISOString(),
    };

    events.unshift(fullEvent);
    this.saveEvents(events);
    return fullEvent;
  }

  static updateEvent(eventId: string, updatedFields: Partial<PCDEvent>): PCDEvent | null {
    const events = this.getEvents();
    const index = events.findIndex((e) => e.id === eventId);
    if (index === -1) return null;

    events[index] = { ...events[index], ...updatedFields };
    this.saveEvents(events);
    return events[index];
  }

  static deleteEvent(eventId: string): void {
    const events = this.getEvents().filter((e) => e.id !== eventId);
    this.saveEvents(events);
    // Also delete associated attendance records
    this.deleteAttendanceSheetForEvent(eventId);
  }

  // ================= ATTENDANCE =================
  static getAttendance(): AttendanceRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(SEED_ATTENDANCE));
    return SEED_ATTENDANCE;
  }

  static saveAttendance(records: AttendanceRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
  }

  static checkDuplicateAttendance(
    eventId: string,
    digitalId: string
  ): AttendanceRecord | undefined {
    const records = this.getAttendance();
    const cleanId = digitalId.trim().toLowerCase();
    return records.find(
      (r) =>
        r.eventId === eventId &&
        (r.digitalId.toLowerCase() === cleanId || r.registerNumber.toLowerCase() === cleanId)
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
        message: `Student was already marked by ${duplicate.markedByName} at ${new Date(duplicate.timestamp).toLocaleTimeString()}`,
      };
    }

    const confirmationCode = record.confirmationCode || `YRC-ATT-${record.digitalId}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const newRecord: AttendanceRecord = {
      ...record,
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      confirmationCode,
      emailSent: record.emailSent !== undefined ? record.emailSent : true,
    };

    const records = this.getAttendance();
    records.unshift(newRecord);
    this.saveAttendance(records);

    return {
      success: true,
      record: newRecord,
      message: `Attendance marked successfully for ${record.name} (${record.digitalId})${newRecord.emailSent ? ' · Confirmation mail sent' : ''}`,
    };
  }

  static resendStudentConfirmationEmail(recordId: string): boolean {
    const records = this.getAttendance();
    const idx = records.findIndex((r) => r.id === recordId);
    if (idx === -1) return false;
    records[idx].emailSent = true;
    this.saveAttendance(records);
    return true;
  }

  static updateAttendanceRecord(
    recordId: string,
    updatedFields: Partial<AttendanceRecord>
  ): AttendanceRecord | null {
    const records = this.getAttendance();
    const idx = records.findIndex((r) => r.id === recordId);
    if (idx === -1) return null;

    records[idx] = { ...records[idx], ...updatedFields };
    this.saveAttendance(records);
    return records[idx];
  }

  static removeAttendance(recordId: string): void {
    const records = this.getAttendance().filter((r) => r.id !== recordId);
    this.saveAttendance(records);
  }

  static deleteAttendanceSheetForEvent(eventId: string): number {
    const records = this.getAttendance();
    const remaining = records.filter((r) => r.eventId !== eventId);
    const deletedCount = records.length - remaining.length;
    this.saveAttendance(remaining);
    return deletedCount;
  }

  // ================= UPDATE LOGS =================
  static getUpdateLogs(): UpdateRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.UPDATE_LOGS);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    localStorage.setItem(STORAGE_KEYS.UPDATE_LOGS, JSON.stringify(SEED_UPDATE_LOGS));
    return SEED_UPDATE_LOGS;
  }

  static saveUpdateLogs(logs: UpdateRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.UPDATE_LOGS, JSON.stringify(logs));
  }

  static addUpdateLog(log: Omit<UpdateRecord, 'id' | 'timestamp'>): UpdateRecord {
    const logs = this.getUpdateLogs();
    const newLog: UpdateRecord = {
      ...log,
      id: `upd-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    this.saveUpdateLogs(logs);
    return newLog;
  }

  // ================= ROSTER MUTATIONS =================
  static transferStudent(
    digitalId: string,
    toPcd: PCDType,
    reason: string,
    operatorEmail: string
  ): { success: boolean; message: string } {
    const rosters = this.getRosters();
    let foundStudent: Student | null = null;
    let originalSheet: SheetName | null = null;

    // Locate student across all sheets
    for (const [sheetName, list] of Object.entries(rosters)) {
      if (sheetName === 'UPDATE') continue;
      const index = list.findIndex((s) => s.digitalId === digitalId);
      if (index !== -1) {
        foundStudent = list[index];
        originalSheet = sheetName as SheetName;
        // Remove from original sheet
        list.splice(index, 1);
        break;
      }
    }

    if (!foundStudent || !originalSheet) {
      return { success: false, message: `Student with Digital ID ${digitalId} not found.` };
    }

    // Determine destination sheet based on batch and new PCD
    const targetBatchShort = foundStudent.batch.slice(2); // '25', '24', '23'
    const targetSheetName = `${toPcd} ${targetBatchShort}` as SheetName;

    // Create updated student object
    const updatedStudent: Student = {
      ...foundStudent,
      pcd: toPcd,
      sourceSheet: targetSheetName,
      slNo: (rosters[targetSheetName]?.length || 0) + 1,
    };

    if (!rosters[targetSheetName]) {
      rosters[targetSheetName] = [];
    }
    rosters[targetSheetName].push(updatedStudent);

    // Save updated rosters
    this.saveRosters(rosters);

    // Record into UPDATE sheet log
    this.addUpdateLog({
      action: 'TRANSFERRED',
      digitalId: foundStudent.digitalId,
      studentName: foundStudent.name,
      dept: foundStudent.dept,
      fromPcd: foundStudent.pcd,
      toPcd,
      remarks: reason || `Transferred from [${originalSheet}] to [${targetSheetName}].`,
      updatedBy: operatorEmail,
    });

    return {
      success: true,
      message: `Successfully transferred ${foundStudent.name} from ${originalSheet} to ${targetSheetName}.`,
    };
  }

  static addStudentToSheet(sheetName: SheetName, studentData: Omit<Student, 'slNo' | 'sourceSheet'>): Student {
    const rosters = this.getRosters();
    if (!rosters[sheetName]) rosters[sheetName] = [];

    const newStudent: Student = {
      ...studentData,
      slNo: rosters[sheetName].length + 1,
      sourceSheet: sheetName,
    };

    rosters[sheetName].push(newStudent);
    this.saveRosters(rosters);

    this.addUpdateLog({
      action: 'ENROLLED',
      digitalId: newStudent.digitalId,
      studentName: newStudent.name,
      dept: newStudent.dept,
      fromPcd: 'None',
      toPcd: newStudent.pcd,
      remarks: `Direct manual enrolment into ${sheetName}.`,
      updatedBy: this.getCurrentUser().email,
    });

    return newStudent;
  }

  // ================= CSV EXPORTERS =================
  static exportSheetAsCsv(sheetName: SheetName): string {
    const rosters = this.getRosters();
    if (sheetName === 'UPDATE') {
      const logs = this.getUpdateLogs();
      const headers = ['Log ID', 'Timestamp', 'Action', 'Digital ID', 'Student Name', 'Department', 'From PCD', 'To PCD', 'Remarks', 'Updated By'];
      const rows = logs.map((l) => [
        `"${l.id}"`,
        `"${new Date(l.timestamp).toLocaleString()}"`,
        `"${l.action}"`,
        `"${l.digitalId}"`,
        `"${l.studentName}"`,
        `"${l.dept}"`,
        `"${l.fromPcd || ''}"`,
        `"${l.toPcd || ''}"`,
        `"${l.remarks.replace(/"/g, '""')}"`,
        `"${l.updatedBy}"`,
      ]);
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    const students = rosters[sheetName] || [];
    const headers = ['Sl No', 'Dept', 'Digital ID', 'Name', 'Section', 'PCD', 'Registernumber', 'Email-ID'];
    const rows = students.map((s) => [
      s.slNo,
      `"${s.dept}"`,
      `"${s.digitalId}"`,
      `"${s.name}"`,
      `"${s.section}"`,
      `"${s.pcd}"`,
      `"${s.registerNumber}"`,
      `"${s.email}"`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  static exportEventAttendanceCsv(eventId: string): string {
    const events = this.getEvents();
    const event = events.find((e) => e.id === eventId);
    const records = this.getAttendance().filter((a) => a.eventId === eventId);

    const headers = [
      'Digital ID',
      'Name',
      'Department',
      'Register Number',
      'PCD Activity',
      'Section',
      'Batch',
      'Marked By (Coordinator)',
      'Timestamp (ISO)',
      'Local Time',
      'Scan Method',
    ];

    const rows = records.map((r) => [
      `"${r.digitalId}"`,
      `"${r.name}"`,
      `"${r.dept}"`,
      `"${r.registerNumber}"`,
      `"${r.pcd}"`,
      `"${r.section}"`,
      `"${r.batch}"`,
      `"${r.markedBy}"`,
      `"${r.timestamp}"`,
      `"${new Date(r.timestamp).toLocaleString()}"`,
      `"${r.method}"`,
    ]);

    const title = `# Attendance Export: ${event ? event.name : eventId} - Total Marked: ${records.length}\n`;
    return title + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  // ================= GOOGLE SHEETS SYNC SIMULATOR =================
  static getLastSyncTime(): string {
    return localStorage.getItem(STORAGE_KEYS.LAST_SHEETS_SYNC) || 'Just now';
  }

  static touchSyncTime(): string {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    localStorage.setItem(STORAGE_KEYS.LAST_SHEETS_SYNC, now);
    return now;
  }

  static resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEYS.ROSTERS, JSON.stringify(SEED_ROSTERS));
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(SEED_EVENTS));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(SEED_ATTENDANCE));
    localStorage.setItem(STORAGE_KEYS.UPDATE_LOGS, JSON.stringify(SEED_UPDATE_LOGS));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(INITIAL_USER_PROFILES[0]));
    this.touchSyncTime();
  }

  // ================= GOOGLE APPS SCRIPT WEBHOOK INTEGRATION =================
  static getGasWebhookUrl(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.GAS_WEBHOOK_URL) || '';
    } catch {
      return '';
    }
  }

  static setGasWebhookUrl(url: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GAS_WEBHOOK_URL, url.trim());
      this.touchSyncTime();
    } catch {
      // ignore
    }
  }

  static async testGasWebhook(testUrl?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const url = (testUrl || this.getGasWebhookUrl()).trim();
    if (!url) {
      return { success: false, error: 'Please enter a Google Apps Script Web App URL first.' };
    }
    try {
      const response = await fetch(url, { method: 'GET' });
      const data = await response.json();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Could not reach the Apps Script Webhook. Make sure access is set to "Anyone".',
      };
    }
  }

  static async postAttendanceToWebhook(
    record: AttendanceRecord,
    eventName: string
  ): Promise<{ success: boolean; error?: string }> {
    const url = this.getGasWebhookUrl();
    if (!url) return { success: false, error: 'No webhook configured' };

    try {
      // Google Apps Script requires text/plain to avoid pre-flight CORS block
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'MARK_ATTENDANCE',
          ...record,
          eventName,
        }),
      });
      this.touchSyncTime();
      return { success: true };
    } catch (err: any) {
      console.warn('Google Sheets Webhook Sync Notice:', err);
      return { success: false, error: err?.message };
    }
  }

  static async notifyCoordinatorViaWebhook(
    coordinatorEmail: string,
    event: PCDEvent,
    portalUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    const url = this.getGasWebhookUrl();
    if (!url) return { success: false, error: 'No webhook configured' };

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'NOTIFY_COORDINATOR',
          coordinatorEmail,
          event,
          portalUrl: portalUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
          password: this.getCoordinatorPassword(coordinatorEmail),
        }),
      });
      return { success: true };
    } catch (err: any) {
      console.warn('Coordinator notify webhook error:', err);
      return { success: false, error: err?.message };
    }
  }
}
