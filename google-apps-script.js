/**
 * SSN YOUTH RED CROSS - GOOGLE APPS SCRIPT WEB APP (Code.gs)
 * ==========================================================
 * Deployment Instructions:
 * 1. Open your master Google Sheet (containing PCD sheets or event sheets).
 * 2. Click Extensions > Apps Script.
 * 3. Delete any default code in Code.gs and paste this entire file.
 * 4. Click Deploy > New deployment.
 * 5. Select type: "Web app".
 * 6. Execute as: "Me" (your Google account).
 * 7. Who has access: "Anyone" (allows the scanner applet to post attendance).
 * 8. Authorize the permissions (Spreadsheet & Gmail access).
 * 9. Copy the generated Web App URL (starts with https://script.google.com/macros/s/...)
 * 
 * Capabilities handled by this script:
 * - MARK_ATTENDANCE: Duplicate prevention in event sheet, logging row, and instant rich HTML email confirmation to the student.
 * - NOTIFY_COORDINATOR: Sends automated email to assigned coordinator containing both:
 *     1) 1-Click Direct Scanner Link (bypasses login)
 *     2) Multi-Device Login credentials (email + password)
 * - LOOKUP_STUDENT: Dynamic batch routing by 2nd/3rd digits (e.g., 2511064 -> Batch 25 -> YRC 25 / NSS 25 / NSO 25).
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

function doGet(e) {
  // If explicitly queried as API/JSON check
  if (e && e.parameter && e.parameter.format === 'json') {
    return jsonResponse({
      status: 'online',
      service: 'SSN Youth Red Cross Attendance & Notification Webhook',
      timestamp: new Date().toISOString()
    });
  }

  // When opened directly in a browser, immediately redirect to the full SSN YRC Web Application
  const appBaseUrl = 'https://ais-dev-w3kbmasubibq7vlfn3nxki-46665299577.asia-southeast1.run.app';
  const queryString = (e && e.queryString) ? ('?' + e.queryString) : '';
  const destinationUrl = appBaseUrl + queryString;

  const html = '<!DOCTYPE html>' +
    '<html><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta http-equiv="refresh" content="0; url=' + destinationUrl + '" />' +
    '<title>SSN Youth Red Cross Attendance Portal</title>' +
    '<script>' +
      'window.location.replace("' + destinationUrl + '");' +
    '</script>' +
    '<style>' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fff5f5; color: #1f2937; text-align: center; }' +
      '.card { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(185, 28, 28, 0.1); border: 1px solid #fee2e2; max-width: 420px; }' +
      'h2 { color: #b91c1c; margin-top: 0; font-size: 18px; }' +
      'p { font-size: 14px; color: #4b5563; line-height: 1.5; }' +
      'a { display: inline-block; margin-top: 12px; background: #b91c1c; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; }' +
    '</style>' +
    '</head><body>' +
    '<div class="card">' +
      '<h2>SSN Youth Red Cross</h2>' +
      '<p>Opening the live Attendance Portal...</p>' +
      '<p><a href="' + destinationUrl + '">Click here if not redirected automatically</a></p>' +
    '</div>' +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('SSN Youth Red Cross Attendance Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// =========================================================================
// 1. MARK ATTENDANCE & AUTOMATED EMAIL TO STUDENT
// =========================================================================
function handleMarkAttendance(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = data.eventSheetName || data.eventName || 'Attendance';
  const targetSheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  // Initialize header row if sheet is freshly created
  if (targetSheet.getLastRow() === 0) {
    targetSheet.appendRow([
      'Digital ID',
      'Student Name',
      'Department',
      'Register Number',
      'PCD Category',
      'Coordinator Email',
      'Check-in Timestamp',
      'Verification Code'
    ]);
    targetSheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#fee2e2');
    targetSheet.setFrozenRows(1);
  }

  // Duplicate Check on Column A (Digital ID)
  const lastRow = targetSheet.getLastRow();
  if (lastRow > 1) {
    const existingIds = targetSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
    const targetId = String(data.digitalId).trim();
    if (existingIds.includes(targetId)) {
      return jsonResponse({
        success: false,
        error: 'DUPLICATE_ENTRY',
        message: 'Student ' + data.name + ' (' + data.digitalId + ') is already marked present for this event.'
      });
    }
  }

  const confirmationCode = 'YRC-ATT-' + data.digitalId + '-' + Utilities.formatDate(new Date(), 'IST', 'HHmmss');

  // Append new row
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

  // Automated Confirmation Email to the Student
  let emailSent = false;
  const recipientEmail = data.studentEmail || (data.name.toLowerCase().replace(/\s+/g, '') + data.digitalId + '@ssn.edu.in');

  if (recipientEmail && recipientEmail.includes('@')) {
    try {
      sendStudentAttendanceReceipt(recipientEmail, data, confirmationCode);
      emailSent = true;
    } catch (e) {
      Logger.log('Error dispatching student email: ' + e.toString());
    }
  }

  return jsonResponse({
    success: true,
    confirmationCode: confirmationCode,
    emailSent: emailSent,
    recipientEmail: recipientEmail,
    timestamp: new Date().toISOString()
  });
}

function sendStudentAttendanceReceipt(recipient, data, confirmationCode) {
  const subject = '✓ Attendance Confirmed: ' + data.eventName + ' - ' + data.name + ' (' + data.digitalId + ')';
  
  const htmlBody =
    '<div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">' +
      '<div style="background-color: #b91c1c; color: #ffffff; padding: 22px; text-align: center;">' +
        '<h1 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">SSN YOUTH RED CROSS</h1>' +
        '<p style="margin: 6px 0 0; font-size: 13px; opacity: 0.95;">Official PCD Attendance Verification Receipt</p>' +
      '</div>' +
      '<div style="padding: 24px; background-color: #ffffff; color: #1f2937;">' +
        '<div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">' +
          '<div style="color: #065f46; font-weight: bold; font-size: 14px;">✓ Attendance Verified & Recorded</div>' +
          '<div style="color: #047857; font-size: 12px; margin-top: 4px;">' +
            'Your presence has been successfully registered in the official SSN PCD Roster database.' +
          '</div>' +
        '</div>' +
        '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">' +
          '<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280; width: 140px;">Student Name:</td><td style="font-weight: bold; color: #111827;">' + data.name + '</td></tr>' +
          '<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Digital ID:</td><td style="font-weight: bold; font-family: monospace; color: #b91c1c;">' + data.digitalId + '</td></tr>' +
          '<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Register Number:</td><td style="font-family: monospace;">' + (data.registerNumber || '-') + '</td></tr>' +
          '<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Department:</td><td>' + (data.dept || '-') + '</td></tr>' +
          '<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">PCD Activity:</td><td style="font-weight: 600; color: #991b1b;">' + (data.pcd || 'YRC') + '</td></tr>' +
          '<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Event Name:</td><td style="font-weight: bold;">' + data.eventName + '</td></tr>' +
          '<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Time of Check-in:</td><td>' + new Date().toLocaleString() + '</td></tr>' +
          '<tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 10px 0; color: #6b7280;">Verified By:</td><td>' + (data.markedByName || 'Coordinator') + ' (' + (data.markedBy || '') + ')</td></tr>' +
          '<tr><td style="padding: 10px 0; color: #6b7280;">Confirmation Code:</td><td style="font-family: monospace; font-weight: bold; color: #374151;">' + confirmationCode + '</td></tr>' +
        '</table>' +
        '<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">' +
          '<p style="font-size: 11px; color: #9ca3af; margin: 0;">' +
            'This is an automated system confirmation from SSN Youth Red Cross. Please retain this email for your PCD credit verification.' +
          '</p>' +
        '</div>' +
      '</div>' +
    '</div>';

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: htmlBody
  });
}

// =========================================================================
// 2. NOTIFY COORDINATOR (DIRECT LINK + MULTI-DEVICE LOGIN CREDENTIALS)
// =========================================================================
function handleNotifyCoordinator(data) {
  const coordinatorEmail = data.coordinatorEmail;
  const event = data.event;
  const portalUrl = data.portalUrl || 'https://ais-pre-w3kbmasubibq7vlfn3nxki-46665299577.asia-southeast1.run.app';
  
  // Method 1: 1-Click Direct Link
  const directLink = portalUrl + '/?event=' + encodeURIComponent(event.id) + '&coordinator=' + encodeURIComponent(coordinatorEmail);
  
  // Method 2: Multi-Device Login Password
  const password = data.password || ('coord@' + coordinatorEmail.split('@')[0]);

  const subject = 'SSN YRC Event Attendance Coordinator: ' + event.name;
  
  const htmlBody =
    '<div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">' +
      '<div style="background-color: #b91c1c; color: #ffffff; padding: 22px;">' +
        '<h1 style="margin: 0; font-size: 20px;">SSN YOUTH RED CROSS</h1>' +
        '<p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">Event Attendance Coordinator Allocation Notice</p>' +
      '</div>' +
      '<div style="padding: 24px; background-color: #ffffff; color: #1f2937;">' +
        '<p style="font-size: 14px;">Dear Volunteer / Coordinator,</p>' +
        '<p style="font-size: 13px; color: #4b5563;">You have been assigned to record and verify student attendance for the following Youth Red Cross session:</p>' +
        
        '<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px; line-height: 1.6;">' +
          '<div><b>Event:</b> ' + event.name + '</div>' +
          '<div><b>Date:</b> ' + event.date + ' (' + event.startTime + ' - ' + event.endTime + ')</div>' +
          '<div><b>Venue:</b> ' + event.venue + '</div>' +
        '</div>' +

        '<!-- METHOD 1: 1-CLICK DIRECT ACCESS -->' +
        '<div style="border: 2px solid #b91c1c; border-radius: 8px; padding: 16px; margin-bottom: 16px; background-color: #fef2f2;">' +
          '<div style="color: #991b1b; font-weight: bold; font-size: 14px; margin-bottom: 6px;">' +
            'Method 1: 1-Click Direct Access (No Password Required)' +
          '</div>' +
          '<p style="margin: 0 0 12px; font-size: 12px; color: #4b5563;">' +
            'Click below on your mobile browser to open the scanner immediately without entering any password:' +
          '</p>' +
          '<a href="' + directLink + '" style="display: inline-block; background-color: #b91c1c; color: #ffffff; padding: 10px 22px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">' +
            'Open Live Event Scanner (Direct)' +
          '</a>' +
          '<div style="margin-top: 10px; font-size: 10px; color: #9ca3af; word-break: break-all;">' +
            'Direct URL: ' + directLink +
          '</div>' +
        '</div>' +

        '<!-- METHOD 2: MULTI-DEVICE LOGIN -->' +
        '<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; background-color: #ffffff;">' +
          '<div style="color: #111827; font-weight: bold; font-size: 14px; margin-bottom: 6px;">' +
            'Method 2: Multi-Device Login (Phone, Tablet, or PC)' +
          '</div>' +
          '<p style="margin: 0 0 10px; font-size: 12px; color: #4b5563;">' +
            'If you open the portal on another device, switch to the <b>Coordinator Access</b> tab and sign in:' +
          '</p>' +
          '<table style="width: 100%; font-size: 12px; font-family: monospace;">' +
            '<tr><td style="padding: 5px 0; color: #6b7280; width: 100px;">Portal URL:</td><td><a href="' + portalUrl + '">' + portalUrl + '</a></td></tr>' +
            '<tr><td style="padding: 5px 0; color: #6b7280;">Email ID:</td><td style="color: #b91c1c; font-weight: bold;">' + coordinatorEmail + '</td></tr>' +
            '<tr><td style="padding: 5px 0; color: #6b7280;">Password:</td><td style="color: #b91c1c; font-weight: bold;">' + password + '</td></tr>' +
          '</table>' +
        '</div>' +

        '<div style="margin-top: 24px; text-align: center; font-size: 11px; color: #9ca3af;">' +
          'SSN Youth Red Cross • Community Service & PCD Attendance Management' +
        '</div>' +
      '</div>' +
    '</div>';

  MailApp.sendEmail({
    to: coordinatorEmail,
    subject: subject,
    htmlBody: htmlBody
  });

  return jsonResponse({
    success: true,
    directLink: directLink,
    coordinatorEmail: coordinatorEmail
  });
}

// =========================================================================
// 3. LOOKUP STUDENT (DYNAMIC ROUTING ACROSS 13 PCD ROSTER SHEETS)
// =========================================================================
function handleLookupStudent(data) {
  const digitalId = String(data.digitalId || '').trim();
  if (digitalId.length < 3) {
    return jsonResponse({ success: false, error: 'Digital ID too short' });
  }

  // 2nd and 3rd digits dictate the candidate sheets
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

  return jsonResponse({ success: false, error: 'Student not found in candidate roster sheets' });
}

// Helper: JSON response with CORS headers
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
