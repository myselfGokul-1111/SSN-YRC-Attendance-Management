import React, { useState } from 'react';
import {
  Code,
  Layers,
  Zap,
  Copy,
  Check,
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { PCDStorageService } from '../services/storage';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [gasUrl, setGasUrl] = useState<string>(() => PCDStorageService.getGasWebhookUrl());
  const [testState, setTestState] = useState<{
    testing: boolean;
    success?: boolean;
    message?: string;
  }>({ testing: false });

  if (!isOpen) return null;

  const nodeSnippet = `/**
 * Look up student information based on Digital ID routing rules.
 * @param {string} digitalId - The scanned Digital ID (e.g., "2511064").
 * @returns {object|null} Student profile data.
 */
async function lookupStudent(digitalId) {
  if (!digitalId || digitalId.length < 3) return null;

  // Extract 2nd and 3rd digits (0-indexed: index 1 and 2)
  const batchCode = digitalId.substring(1, 3);
  let targetSheets = [];

  if (['51', '52', '57'].includes(batchCode)) {
    targetSheets = ['YRC 25', 'NSS 25', 'NSO 25'];
  } else if (['41', '42', '47'].includes(batchCode)) {
    targetSheets = ['YRC 24', 'NSS 24', 'NSO 24'];
  } else if (['31', '32', '37'].includes(batchCode)) {
    targetSheets = ['YRC 23', 'NSS 23', 'NSO 23'];
  } else {
    throw new Error(\`Invalid or unsupported Digital ID pattern: \${digitalId}\`);
  }

  // Search across candidate sheets until student is found
  for (const sheetName of targetSheets) {
    const student = await searchSheetByDigitalId(sheetName, digitalId);
    if (student) {
      return { ...student, sourceSheet: sheetName };
    }
  }

  return null; // Student not found
}`;

  const gasSnippet = `/**
 * SSN YOUTH RED CROSS - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * Handles:
 * 1. MARK_ATTENDANCE: Duplicate checking, logging to Google Sheet & instant student confirmation email.
 * 2. NOTIFY_COORDINATOR: Sends coordinator their 1-click Direct Scanner Link + Multi-Device Login credentials.
 * 3. LOOKUP_STUDENT: Dynamic batch routing by 2nd/3rd digits across 13 PCD Roster sheets.
 * 
 * Deployment: Deploy as Web App -> Execute as: "Me" -> Who has access: "Anyone".
 */

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || 'MARK_ATTENDANCE';

    if (action === 'MARK_ATTENDANCE') {
      return handleMarkAttendance(payload);
    } else if (action === 'NOTIFY_COORDINATOR') {
      return handleNotifyCoordinator(payload);
    } else if (action === 'LOOKUP_STUDENT') {
      return handleLookupStudent(payload);
    }

    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ================= 1. MARK ATTENDANCE & EMAIL STUDENT =================
function handleMarkAttendance(data) {
  const ss = SpreadsheetApp.openById(data.spreadsheetId || SpreadsheetApp.getActiveSpreadsheet().getId());
  const sheetName = data.eventSheetName || data.eventName || 'Attendance';
  const targetSheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  // Set up header row if brand new sheet
  if (targetSheet.getLastRow() === 0) {
    targetSheet.appendRow([
      'Digital ID', 'Student Name', 'Department', 'Register Number',
      'PCD Category', 'Coordinator Email', 'Check-in Timestamp', 'Verification Code'
    ]);
    targetSheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#f3f4f6');
  }

  // Duplicate Check: Column 1 (Digital ID)
  const lastRow = targetSheet.getLastRow();
  if (lastRow > 1) {
    const existingIds = targetSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
    if (existingIds.includes(String(data.digitalId).trim())) {
      return jsonResponse({
        success: false,
        error: 'DUPLICATE_ENTRY',
        message: 'Student ' + data.name + ' (' + data.digitalId + ') is already marked present.'
      });
    }
  }

  const confirmationCode = 'YRC-ATT-' + data.digitalId + '-' + Utilities.formatDate(new Date(), 'IST', 'HHmmss');

  // Append attendance record
  targetSheet.appendRow([
    data.digitalId,
    data.name,
    data.dept,
    data.registerNumber,
    data.pcd || 'YRC',
    data.markedBy || 'Coordinator',
    new Date().toISOString(),
    confirmationCode
  ]);

  // Send Confirmation Email to Student
  let emailSent = false;
  const recipientEmail = data.studentEmail || (data.name.toLowerCase().replace(/\\s+/g, '') + data.digitalId + '@ssn.edu.in');
  
  if (recipientEmail && recipientEmail.includes('@')) {
    try {
      sendStudentEmail(recipientEmail, data, confirmationCode);
      emailSent = true;
    } catch (e) {
      Logger.log('Student email error: ' + e.toString());
    }
  }

  return jsonResponse({
    success: true,
    confirmationCode: confirmationCode,
    emailSent: emailSent,
    recipientEmail: recipientEmail
  });
}

// Student Confirmation Email Template
function sendStudentEmail(recipient, data, confirmationCode) {
  const subject = '✓ Attendance Confirmed: ' + data.eventName + ' (' + data.digitalId + ')';
  const htmlBody = 
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">' +
      '<div style="background-color: #b91c1c; color: #ffffff; padding: 20px; text-align: center;">' +
        '<h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">SSN YOUTH RED CROSS</h2>' +
        '<p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">PCD Activity & Event Attendance Verification</p>' +
      '</div>' +
      '<div style="padding: 24px; background-color: #ffffff; color: #1f2937;">' +
        '<div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">' +
          '<span style="color: #065f46; font-weight: bold; font-size: 14px;">✓ Attendance Successfully Recorded</span>' +
          '<div style="color: #047857; font-size: 12px; margin-top: 4px;">Verified in the official SSN PCD Roster database.</div>' +
        '</div>' +
        '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">' +
          '<tr><td style="padding: 8px 0; color: #6b7280; width: 140px;">Student Name:</td><td style="font-weight: bold; color: #111827;">' + data.name + '</td></tr>' +
          '<tr><td style="padding: 8px 0; color: #6b7280;">Digital ID:</td><td style="font-weight: bold; font-family: monospace; color: #b91c1c;">' + data.digitalId + '</td></tr>' +
          '<tr><td style="padding: 8px 0; color: #6b7280;">Register Number:</td><td style="font-family: monospace;">' + (data.registerNumber || '-') + '</td></tr>' +
          '<tr><td style="padding: 8px 0; color: #6b7280;">Department:</td><td>' + (data.dept || '-') + '</td></tr>' +
          '<tr><td style="padding: 8px 0; color: #6b7280;">Event Name:</td><td style="font-weight: bold;">' + data.eventName + '</td></tr>' +
          '<tr><td style="padding: 8px 0; color: #6b7280;">Time of Check-in:</td><td>' + new Date().toLocaleString() + '</td></tr>' +
          '<tr><td style="padding: 8px 0; color: #6b7280;">Verification Code:</td><td style="font-family: monospace; font-weight: bold; color: #374151;">' + confirmationCode + '</td></tr>' +
        '</table>' +
        '<hr style="border: none; border-top: 1px solid #f3f4f6; margin: 20px 0;" />' +
        '<p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">' +
          'This is an automated attendance receipt issued by SSN Youth Red Cross. Keep this for your PCD records.' +
        '</p>' +
      '</div>' +
    '</div>';

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: htmlBody
  });
}

// ================= 2. NOTIFY COORDINATOR (DIRECT LINK + CREDENTIALS) =================
function handleNotifyCoordinator(data) {
  const coordinatorEmail = data.coordinatorEmail;
  const event = data.event;
  const portalUrl = data.portalUrl || 'https://ais-pre-w3kbmasubibq7vlfn3nxki-46665299577.asia-southeast1.run.app';
  const directLink = portalUrl + '/?event=' + encodeURIComponent(event.id) + '&coordinator=' + encodeURIComponent(coordinatorEmail);
  const password = data.password || 'coord@' + coordinatorEmail.split('@')[0];

  const subject = 'SSN YRC Event Attendance Coordinator: ' + event.name;
  const htmlBody =
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">' +
      '<div style="background-color: #b91c1c; color: #ffffff; padding: 20px;">' +
        '<h2 style="margin: 0; font-size: 20px;">SSN YOUTH RED CROSS</h2>' +
        '<p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Event Attendance Coordinator Allocation</p>' +
      '</div>' +
      '<div style="padding: 24px; background-color: #ffffff; color: #1f2937;">' +
        '<p>Dear Volunteer / Coordinator,</p>' +
        '<p>You have been assigned to record attendance for the following YRC event:</p>' +
        '<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px;">' +
          '<div><b>Event:</b> ' + event.name + '</div>' +
          '<div><b>Date:</b> ' + event.date + ' (' + event.startTime + ' - ' + event.endTime + ')</div>' +
          '<div><b>Venue:</b> ' + event.venue + '</div>' +
        '</div>' +

        '<!-- METHOD 1: 1-CLICK DIRECT LINK -->' +
        '<div style="border: 2px solid #b91c1c; border-radius: 8px; padding: 16px; margin-bottom: 16px; background-color: #fef2f2;">' +
          '<div style="color: #991b1b; font-weight: bold; font-size: 14px; margin-bottom: 6px;">' +
            'Method 1: 1-Click Direct Access (No Login Required)' +
          '</div>' +
          '<p style="margin: 0 0 12px; font-size: 12px; color: #4b5563;">' +
            'Click below to open your live scanner directly on this device without typing any password:' +
          '</p>' +
          '<a href="' + directLink + '" style="display: inline-block; background-color: #b91c1c; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">' +
            'Open Live Event Scanner (Direct)' +
          '</a>' +
          '<div style="margin-top: 10px; font-size: 10px; color: #9ca3af; word-break: break-all;">' +
            'Direct URL: ' + directLink +
          '</div>' +
        '</div>' +

        '<!-- METHOD 2: LOGIN CREDENTIALS FOR OTHER DEVICES -->' +
        '<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; background-color: #ffffff;">' +
          '<div style="color: #111827; font-weight: bold; font-size: 14px; margin-bottom: 6px;">' +
            'Method 2: Multi-Device Login (Phone, Tablet, or PC)' +
          '</div>' +
          '<p style="margin: 0 0 10px; font-size: 12px; color: #4b5563;">' +
            'If you open the portal on another phone or device, click the <b>Coordinator Access</b> tab and log in:' +
          '</p>' +
          '<table style="width: 100%; font-size: 12px; font-family: monospace;">' +
            '<tr><td style="padding: 4px 0; color: #6b7280; width: 100px;">Portal URL:</td><td><a href="' + portalUrl + '">' + portalUrl + '</a></td></tr>' +
            '<tr><td style="padding: 4px 0; color: #6b7280;">Email ID:</td><td style="color: #b91c1c; font-weight: bold;">' + coordinatorEmail + '</td></tr>' +
            '<tr><td style="padding: 4px 0; color: #6b7280;">Password:</td><td style="color: #b91c1c; font-weight: bold;">' + password + '</td></tr>' +
          '</table>' +
        '</div>' +

        '<p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 24px;">' +
          'SSN Youth Red Cross • Community Service & PCD Attendance Portal' +
        '</p>' +
      '</div>' +
    '</div>';

  MailApp.sendEmail({
    to: coordinatorEmail,
    subject: subject,
    htmlBody: htmlBody
  });

  return jsonResponse({ success: true, directLink: directLink, coordinatorEmail: coordinatorEmail });
}

// ================= 3. LOOKUP STUDENT ROUTING =================
function handleLookupStudent(data) {
  const digitalId = String(data.digitalId || '').trim();
  if (digitalId.length < 3) {
    return jsonResponse({ success: false, error: 'Digital ID too short' });
  }

  const batchCode = digitalId.substring(1, 3);
  let targetSheets = [];
  if (['51', '52', '57'].includes(batchCode)) {
    targetSheets = ['YRC 25', 'NSS 25', 'NSO 25'];
  } else if (['41', '42', '47'].includes(batchCode)) {
    targetSheets = ['YRC 24', 'NSS 24', 'NSO 24'];
  } else if (['31', '32', '37'].includes(batchCode)) {
    targetSheets = ['YRC 23', 'NSS 23', 'NSO 23'];
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (let i = 0; i < targetSheets.length; i++) {
    const sheet = ss.getSheetByName(targetSheets[i]);
    if (!sheet) continue;
    const values = sheet.getDataRange().getValues();
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][0]).trim() === digitalId) {
        return jsonResponse({
          success: true,
          student: {
            digitalId: values[r][0],
            name: values[r][1],
            dept: values[r][2],
            registerNumber: values[r][3],
            pcd: values[r][4] || targetSheets[i].split(' ')[0],
            sourceSheet: targetSheets[i]
          }
        });
      }
    }
  }

  return jsonResponse({ success: false, error: 'Student not found in batch sheets' });
}

function doGet(e) {
  if (e && e.parameter && e.parameter.format === 'json') {
    return jsonResponse({ status: 'online', service: 'SSN YRC Attendance Webhook', time: new Date().toISOString() });
  }

  // When opened in browser, redirect directly to the SSN YRC Attendance Web Application
  const appBaseUrl = 'https://ais-dev-w3kbmasubibq7vlfn3nxki-46665299577.asia-southeast1.run.app';
  const queryString = (e && e.queryString) ? ('?' + e.queryString) : '';
  const targetUrl = appBaseUrl + queryString;

  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=' + targetUrl + '" />' +
    '<script>window.location.replace("' + targetUrl + '");</script></head><body>' +
    '<p style="font-family:sans-serif;text-align:center;padding:40px;">Opening SSN Youth Red Cross Attendance Portal... <a href="' + targetUrl + '">Click here</a></p>' +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('SSN Youth Red Cross Attendance Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  const handleTestAndSaveWebhook = async () => {
    const trimmed = gasUrl.trim();
    if (!trimmed) {
      PCDStorageService.setGasWebhookUrl('');
      setTestState({ testing: false, success: false, message: 'Webhook cleared. Local storage mode active.' });
      return;
    }

    setTestState({ testing: true });
    PCDStorageService.setGasWebhookUrl(trimmed);

    const res = await PCDStorageService.testGasWebhook(trimmed);
    if (res.success) {
      setTestState({
        testing: false,
        success: true,
        message: `✓ Connected! Webhook responded: "${res.data?.service || 'Online'}" (${res.data?.status || 'OK'})`,
      });
    } else {
      setTestState({
        testing: false,
        success: false,
        message: `⚠ Connection check note: ${res.error || 'Failed to ping'}. If your browser shows {"status":"online"}, it will work for POST requests!`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl my-8 space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-neutral-900" />
            <h2 className="text-lg font-bold text-neutral-900">
              System Architecture & Routing Specification
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        {/* Live Webhook Connector Card */}
        <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                Live Google Apps Script Web App Endpoint
              </span>
            </div>
            {gasUrl && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Endpoint Saved
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Paste your Google Apps Script Web App URL below (the link ending in <code className="bg-neutral-200 px-1 py-0.5 rounded text-[11px] font-mono">/exec</code>). When connected, live scans will push rows into your Google Sheet and send real email receipts to students!
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 font-mono bg-white"
            />
            <button
              onClick={handleTestAndSaveWebhook}
              disabled={testState.testing}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-neutral-400 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[38px]"
            >
              {testState.testing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save & Connect
                </>
              )}
            </button>
          </div>

          {testState.message && (
            <div
              className={`text-xs p-2.5 rounded-lg flex items-start gap-2 ${
                testState.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {testState.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <span>{testState.message}</span>
            </div>
          )}
        </div>

        {/* Dynamic Routing Matrix Table */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 uppercase tracking-wide">
            <Zap className="w-4 h-4 text-amber-600" />
            <span>Digital ID Dynamic Routing Rule Matrix</span>
          </div>

          <div className="border border-neutral-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-100 border-b border-neutral-200 font-semibold text-neutral-700">
                <tr>
                  <th className="py-2.5 px-4 font-mono">2nd & 3rd Digits (Index 1..2)</th>
                  <th className="py-2.5 px-4">Target Batch Year</th>
                  <th className="py-2.5 px-4">Targeted Student Roster Sheets</th>
                  <th className="py-2.5 px-4">Sample Student Digital IDs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                <tr className="hover:bg-neutral-50">
                  <td className="py-2.5 px-4 font-mono font-bold text-neutral-900">51, 52, or 57</td>
                  <td className="py-2.5 px-4 font-semibold text-neutral-800">Batch 2025</td>
                  <td className="py-2.5 px-4 font-mono text-neutral-700">YRC 25, NSS 25, NSO 25, NReg 25</td>
                  <td className="py-2.5 px-4 font-mono text-neutral-500">2511064, 2570070, 2521015</td>
                </tr>
                <tr className="hover:bg-neutral-50">
                  <td className="py-2.5 px-4 font-mono font-bold text-neutral-900">41, 42, or 47</td>
                  <td className="py-2.5 px-4 font-semibold text-neutral-800">Batch 2024</td>
                  <td className="py-2.5 px-4 font-mono text-neutral-700">YRC 24, NSS 24, NSO 24, NReg 24</td>
                  <td className="py-2.5 px-4 font-mono text-neutral-500">2470019, 2411012, 2470041</td>
                </tr>
                <tr className="hover:bg-neutral-50">
                  <td className="py-2.5 px-4 font-mono font-bold text-neutral-900">31, 32, or 37</td>
                  <td className="py-2.5 px-4 font-semibold text-neutral-800">Batch 2023</td>
                  <td className="py-2.5 px-4 font-mono text-neutral-700">YRC 23, NSS 23, NSO 23, NReg 23</td>
                  <td className="py-2.5 px-4 font-mono text-neutral-500">2311022, 2370008, 2311019</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Architecture Flow ASCII */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
            Component Dataflow Diagram
          </div>
          <pre className="p-4 bg-neutral-950 text-neutral-200 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-neutral-800">
{`                          ┌──────────────────────────┐
                          │   Admin Interface        │
                          │ - Create Event           │
                          │ - Assign Coordinators    │
                          │ - View/Export Attendance │
                          └────────────┬─────────────┘
                                       │
┌──────────────────────────┐           │           ┌──────────────────────────┐
│   Coordinator Interface  │           │           │     Google Sheets API    │
│ - View Assigned Events   │◄──────────┼──────────►│ - Read: PCD Roster Sheets│
│ - Barcode / Manual Search│           │           │ - Write: Event Attendance│
│ - Mark Attendance        │           │           └──────────────────────────┘
└──────────────────────────┘           │
                                       ▼
                          ┌──────────────────────────┐
                          │  Backend Server (Node/Py)│
                          │ - Authentication (OAuth) │
                          │ - Dynamic Routing Logic  │
                          │ - Notification Emailer   │
                          └──────────────────────────┘`}
          </pre>
        </div>

        {/* Code Snippets Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Node.js Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-neutral-500" />
                Dynamic Routing (Node.js)
              </span>
              <button
                onClick={() => copyToClipboard(nodeSnippet, 'node')}
                className="text-[11px] text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
              >
                {copiedSnippet === 'node' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedSnippet === 'node' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-3 bg-neutral-900 text-neutral-200 rounded-lg font-mono text-[10px] overflow-x-auto max-h-48">
              {nodeSnippet}
            </pre>
          </div>

          {/* Google Apps Script Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-neutral-500" />
                Google Apps Script Webhook
              </span>
              <button
                onClick={() => copyToClipboard(gasSnippet, 'gas')}
                className="text-[11px] text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
              >
                {copiedSnippet === 'gas' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedSnippet === 'gas' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-3 bg-neutral-900 text-neutral-200 rounded-lg font-mono text-[10px] overflow-x-auto max-h-48">
              {gasSnippet}
            </pre>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-neutral-100">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
