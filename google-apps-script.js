/**
 * ====================================================================
 * SSN PCD ACTIVITIES - GOOGLE APPS SCRIPT WEB APP BACKEND (Code.gs)
 * ====================================================================
 * Full Two-Way Integration:
 * 1. GET_STUDENTS / SEARCH_STUDENT: Reads all student roster sheets in
 *    your master Google Spreadsheet so the app can search and display
 *    all student details (Name, Register Number, Department, Year, PCD Wing).
 * 2. MARK_ATTENDANCE: Automatically creates a dedicated sheet tab per
 *    event ("PCD - [Event Name]"), records attendance, remarks, prevents
 *    duplicates, and emails instant verification receipts to students.
 * 3. NOTIFY_COORDINATOR: Sends 1-click coordinator access email.
 *
 * HOW TO SET UP (Takes 1 Minute):
 * 1. In your master Google Spreadsheet (with your student data), click:
 *    Extensions > Apps Script.
 * 2. Replace all existing text with this ENTIRE file.
 * 3. Click Save (Ctrl+S / Cmd+S).
 * 4. AUTHORIZATION STEP (CRITICAL FOR EMAILS):
 *    - In the function dropdown at top (next to 'Debug'), select 'authorizeEmailPermissions'.
 *    - Click 'Run'.
 *    - A Google popup will appear: Click 'Review permissions' -> Select your Google account
 *      -> Click 'Advanced' -> Click 'Go to SSN PCD Activities (unsafe)' -> Click 'Allow'.
 *    - This permanently authorizes Google Apps Script to send emails to Coordinators & Students!
 * 5. Click "Deploy" (blue button at top right) > "New deployment" (or "Manage deployments" > Edit > New version).
 * 6. Set Description: "SSN PCD Activities v2"
 * 7. Set "Execute as": "Me (your email)"
 * 8. Set "Who has access": "Anyone"  <-- CRITICAL! Must be "Anyone"!
 * 9. Click "Deploy" and copy the Web App URL:
 *    (e.g., https://script.google.com/macros/s/.../exec)
 * 10. Paste that URL into the Webhook settings in the SSN PCD Activities app.
 * ====================================================================
 */

var YRC_REPLY_TO_EMAIL = 'yrc-attendance-management-team-ssn@ssn.edu.in';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'Empty payload received' });
    }

    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'MARK_ATTENDANCE';

    if (action === 'MARK_ATTENDANCE') {
      return handleMarkAttendance(data);
    } else if (action === 'GET_STUDENTS') {
      return handleGetStudents(data.query);
    } else if (action === 'SEARCH_STUDENT') {
      return handleSearchStudent(data.query || data.registerNumber || data.studentId);
    } else if (action === 'NOTIFY_COORDINATOR') {
      return handleNotifyCoordinator(data);
    } else if (action === 'CREATE_EVENT' || action === 'createEvent') {
      return handleCreateEvent(data);
    } else if (action === 'GET_EVENTS' || action === 'getEvents') {
      return handleGetEvents();
    } else if (action === 'GET_EVENT_ATTENDANCE' || action === 'getEventAttendance') {
      return handleGetEventAttendance(data);
    } else if (action === 'DELETE_EVENT' || action === 'deleteEvent') {
      return handleDeleteEvent(data);
    } else {
      return jsonResponse({ success: true, message: 'Received action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  var callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : '';

  // 1. Get all students from master sheet(s)
  if (action === 'getStudents' || action === 'GET_STUDENTS') {
    return handleGetStudents(e.parameter.query, callback);
  }

  // 2. Search student in master sheet(s)
  if (action === 'search' || action === 'SEARCH_STUDENT') {
    var query = e.parameter.query || e.parameter.q || e.parameter.id || '';
    return handleSearchStudent(query, callback);
  }

  // 3. Coordinator Email Notification via GET
  if (action === 'notifyCoordinator' || action === 'NOTIFY_COORDINATOR') {
    return handleNotifyCoordinator({
      coordinatorEmail: e.parameter.coordinatorEmail || e.parameter.email,
      eventName: e.parameter.eventName,
      eventDate: e.parameter.eventDate,
      startTime: e.parameter.startTime,
      endTime: e.parameter.endTime,
      venue: e.parameter.venue,
      directLink: e.parameter.directLink,
    }, callback);
  }

  // 4. Events Synchronization (reads all events from PCD_Events sheet)
  if (action === 'getEvents' || action === 'GET_EVENTS') {
    return handleGetEvents(callback);
  }

  // 5. Create event & provision dedicated sheet tab
  if (action === 'createEvent' || action === 'CREATE_EVENT') {
    return handleCreateEvent(e.parameter, callback);
  }

  // 6. Get attendance for a specific event
  if (action === 'getEventAttendance' || action === 'GET_EVENT_ATTENDANCE') {
    return handleGetEventAttendance(e.parameter, callback);
  }

  // 7. Delete / Archive event
  if (action === 'deleteEvent' || action === 'DELETE_EVENT') {
    return handleDeleteEvent(e.parameter, callback);
  }

  // 8. Health check
  if (e && e.parameter && e.parameter.format === 'json') {
    return jsonResponse({
      status: 'online',
      service: 'SSN PCD Activities Attendance & Roster Webhook',
      timestamp: new Date().toISOString()
    }, callback);
  }

  // 4. Default: Redirect to live application when opened in a browser
  var appBaseUrl = 'https://myselfgokul-1111.github.io/SSN-YRC-Attendance-Management/';
  var queryParam = (e && e.queryString) ? ('?' + e.queryString) : '';
  var targetUrl = appBaseUrl + queryParam;

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<meta http-equiv="refresh" content="0; url=' + targetUrl + '">' +
    '<script>window.location.replace("' + targetUrl + '");</script></head>' +
    '<body style="font-family:sans-serif;text-align:center;padding:50px;">' +
    '<h3>SSN PCD Activities</h3><p>Redirecting to portal... <a href="' + targetUrl + '">Click here</a></p>' +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('SSN PCD Activities')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ====================================================================
 * ROSTER READER: Scans master spreadsheet sheets for student data
 * ====================================================================
 */
function handleGetStudents(query, callback) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var allStudents = [];
  var seenIds = {};

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var sheetName = sheet.getName();

    // Skip attendance log sheets created for events
    if (sheetName.indexOf('PCD - ') === 0 || sheetName === 'Attendance' || sheetName === 'Attendance Logs') {
      continue;
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) continue;

    var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    if (data.length < 2) continue;

    var headers = data[0];
    var univRegCol = -1;
    var rollCol = -1;
    var nameCol = -1;
    var deptCol = -1;
    var yearCol = -1;
    var pcdCol = -1;
    var emailCol = -1;

    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c] || '').trim().toLowerCase();
      if (univRegCol === -1 && (h.indexOf('univ') !== -1 || h.indexOf('anna') !== -1 || (h.indexOf('reg') !== -1 && h.indexOf('roll') === -1))) {
        univRegCol = c;
      } else if (rollCol === -1 && (h.indexOf('roll') !== -1 || h === 'id' || h.indexOf('digital') !== -1 || h.indexOf('barcode') !== -1 || h.indexOf('student id') !== -1)) {
        rollCol = c;
      } else if (nameCol === -1 && (h.indexOf('name') !== -1 || h.indexOf('student') !== -1)) {
        nameCol = c;
      } else if (deptCol === -1 && (h.indexOf('dept') !== -1 || h.indexOf('branch') !== -1 || h.indexOf('department') !== -1 || h.indexOf('prog') !== -1)) {
        deptCol = c;
      } else if (yearCol === -1 && (h.indexOf('year') !== -1 || h.indexOf('batch') !== -1 || h.indexOf('class') !== -1)) {
        yearCol = c;
      } else if (pcdCol === -1 && (h.indexOf('pcd') !== -1 || h.indexOf('wing') !== -1 || h.indexOf('activity') !== -1 || h.indexOf('category') !== -1 || h.indexOf('club') !== -1)) {
        pcdCol = c;
      } else if (emailCol === -1 && (h.indexOf('mail') !== -1 || h.indexOf('email') !== -1)) {
        emailCol = c;
      }
    }

    // Fallbacks if columns are not explicitly labeled
    if (univRegCol === -1 && rollCol === -1) {
      if (headers.length >= 2) rollCol = 1;
      else rollCol = 0;
    }
    if (nameCol === -1 && headers.length >= 3) {
      nameCol = 2;
    }

    // Default PCD if the sheet itself is named after the wing
    var defaultPcd = 'NReg';
    var sheetUpper = sheetName.toUpperCase();
    if (sheetUpper.indexOf('YRC') !== -1) defaultPcd = 'YRC';
    else if (sheetUpper.indexOf('NSS') !== -1) defaultPcd = 'NSS';
    else if (sheetUpper.indexOf('NSO') !== -1) defaultPcd = 'NSO';

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var cellUniv = univRegCol >= 0 ? String(row[univRegCol] || '').trim() : '';
      var cellRoll = rollCol >= 0 ? String(row[rollCol] || '').trim() : '';

      // Look across all cells in the row for AU 3122... and 7-digit roll numbers if not identified yet
      var foundUniv = '';
      var foundRoll = '';

      // Check designated cells first
      var cleanCellUniv = cellUniv.replace(/[^0-9]/g, '');
      if (cleanCellUniv.indexOf('3122') === 0 && cleanCellUniv.length >= 10) {
        foundUniv = cleanCellUniv;
      }
      var cleanCellRoll = cellRoll.replace(/[^a-zA-Z0-9]/g, '');
      if (cleanCellRoll.length >= 6 && cleanCellRoll.length <= 9) {
        foundRoll = cleanCellRoll;
      }

      // If still missing, scan remaining cells in the row
      if (!foundUniv || !foundRoll) {
        for (var colIdx = 0; colIdx < row.length; colIdx++) {
          var valStr = String(row[colIdx] || '').trim();
          var digitsOnly = valStr.replace(/[^0-9]/g, '');
          if (!foundUniv && digitsOnly.indexOf('3122') === 0 && digitsOnly.length >= 10) {
            foundUniv = digitsOnly;
          } else if (!foundRoll && digitsOnly.length >= 6 && digitsOnly.length <= 8 && digitsOnly.indexOf('3122') !== 0) {
            foundRoll = digitsOnly;
          }
        }
      }

      var digitalId = foundRoll || (cellRoll.replace(/[^a-zA-Z0-9]/g, '') || foundUniv);
      var registerNumber = foundUniv || (cellUniv.replace(/[^0-9]/g, '') || foundRoll || digitalId);

      if (!digitalId && !registerNumber) continue;
      if (digitalId.toLowerCase() === 'null' || registerNumber.toLowerCase() === 'null') continue;

      // Duplicate check in response dataset
      var idKey1 = digitalId ? digitalId.toLowerCase() : '';
      var idKey2 = registerNumber ? registerNumber.toLowerCase() : '';
      if ((idKey1 && seenIds[idKey1]) || (idKey2 && seenIds[idKey2])) continue;

      var rawName = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';
      var rawDept = deptCol >= 0 ? String(row[deptCol] || '').trim() : 'Engineering';
      var rawYear = yearCol >= 0 ? String(row[yearCol] || '').trim() : '';
      var rawPcdVal = pcdCol >= 0 ? String(row[pcdCol] || '').trim().toUpperCase() : defaultPcd;
      var rawEmail = emailCol >= 0 ? String(row[emailCol] || '').trim() : '';

      // Determine PCD: YRC (Red), NSS (Blue), NSO (Green), or Not Registered
      var pcd = 'NReg';
      if (rawPcdVal.indexOf('YRC') !== -1) pcd = 'YRC';
      else if (rawPcdVal.indexOf('NSS') !== -1) pcd = 'NSS';
      else if (rawPcdVal.indexOf('NSO') !== -1) pcd = 'NSO';
      else if (defaultPcd !== 'NReg') pcd = defaultPcd;

      // Determine Year based on AU 3122 prefix or SSN Digital ID Pattern
      var year = '2nd Year';
      if (registerNumber.indexOf('3122') === 0 && registerNumber.length >= 6) {
        var auBatch = registerNumber.substring(4, 6);
        if (auBatch === '23') year = '4th Year';
        else if (auBatch === '24') year = '3rd Year';
        else if (auBatch === '25') year = '2nd Year';
        else if (auBatch === '26') year = '1st Year';
      } else if (digitalId.indexOf('231') === 0 || digitalId.indexOf('237') === 0) {
        year = '4th Year';
      } else if (digitalId.indexOf('241') === 0 || digitalId.indexOf('247') === 0) {
        year = '3rd Year';
      } else if (digitalId.indexOf('251') === 0 || digitalId.indexOf('257') === 0) {
        year = '2nd Year';
      } else if (rawYear) {
        if (rawYear.indexOf('4') !== -1) year = '4th Year';
        else if (rawYear.indexOf('3') !== -1) year = '3rd Year';
        else if (rawYear.indexOf('2') !== -1) year = '2nd Year';
        else if (rawYear.indexOf('1') !== -1) year = '1st Year';
      }

      if (!rawEmail) {
        rawEmail = (foundRoll || digitalId || registerNumber).toLowerCase() + '@ssn.edu.in';
      }

      var studentObj = {
        digitalId: digitalId,
        registerNumber: registerNumber,
        name: rawName || ('Student (' + (registerNumber || digitalId) + ')'),
        dept: rawDept || 'Engineering',
        year: year,
        pcd: pcd,
        email: rawEmail
      };

      if (query) {
        var q = query.trim().toLowerCase();
        var matchId = (digitalId && digitalId.toLowerCase().indexOf(q) !== -1);
        var matchReg = (registerNumber && registerNumber.toLowerCase().indexOf(q) !== -1);
        var matchName = (rawName && rawName.toLowerCase().indexOf(q) !== -1);
        if (matchId || matchReg || matchName) {
          allStudents.push(studentObj);
          if (idKey1) seenIds[idKey1] = true;
          if (idKey2) seenIds[idKey2] = true;
        }
      } else {
        allStudents.push(studentObj);
        if (idKey1) seenIds[idKey1] = true;
        if (idKey2) seenIds[idKey2] = true;
      }
    }
  }

  return jsonResponse({
    success: true,
    count: allStudents.length,
    students: allStudents
  }, callback);
}

function handleSearchStudent(query, callback) {
  if (!query) {
    return jsonResponse({ success: false, error: 'Query parameter is missing' }, callback);
  }
  return handleGetStudents(query, callback);
}

var PCD_EVENTS_SHEET_NAME = 'PCD_Events';

function getOrCreatePcdEventsSheet(ss) {
  var sheet = ss.getSheetByName(PCD_EVENTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PCD_EVENTS_SHEET_NAME, 0);
    var headers = [
      'Event ID',
      'Event Name',
      'Date',
      'Start Time',
      'End Time',
      'Venue',
      'Target PCD',
      'Coordinators',
      'Sheet Tab Name',
      'Status',
      'Created At'
    ];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#991b1b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    for (var col = 1; col <= headers.length; col++) {
      sheet.autoResizeColumn(col);
    }
  }
  return sheet;
}

function getCleanEventTabName(eventName) {
  var raw = eventName || 'Event Attendance';
  var clean = raw.replace(/[:\\/?*\[\]]/g, '').trim().substring(0, 35);
  if (!clean) clean = 'Event Attendance';
  if (clean.indexOf('PCD - ') === 0) return clean;
  return 'PCD - ' + clean;
}

function getOrCreateEventAttendanceSheet(ss, sheetTabName) {
  var sheet = ss.getSheetByName(sheetTabName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetTabName);
    var headers = [
      'Timestamp',
      'Student ID / Roll No',
      'Register Number (3122...)',
      'Student Name',
      'Department',
      'Year',
      'PCD Category',
      'Remark',
      'Marked By (Coordinator)',
      'Confirmation Code'
    ];
    sheet.appendRow(headers);

    // Style Header Row: SSN Red with bold white text
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#991b1b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);

    for (var col = 1; col <= headers.length; col++) {
      sheet.autoResizeColumn(col);
    }
  }
  return sheet;
}

/**
 * ====================================================================
 * EVENT LIFECYCLE MANAGEMENT & MULTI-DEVICE SYNC
 * ====================================================================
 */
function handleCreateEvent(data, callback) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var eventsSheet = getOrCreatePcdEventsSheet(ss);

    var eventId = String(data.id || data.eventId || ('evt-' + new Date().getTime().toString(36))).trim();
    var eventName = String(data.name || data.eventName || 'PCD Activity').trim();
    var date = String(data.date || data.eventDate || new Date().toISOString().split('T')[0]).trim();
    var startTime = String(data.startTime || '09:00').trim();
    var endTime = String(data.endTime || '17:00').trim();
    var venue = String(data.venue || 'SSN Campus').trim();
    var targetPcd = String(data.targetPcd || 'ALL').trim();
    var rawCoords = data.coordinators || data.coordinatorEmail || '';
    var coordinatorsStr = Array.isArray(rawCoords) ? rawCoords.join(', ') : String(rawCoords);
    var cleanTabName = data.sheetTabName ? String(data.sheetTabName).trim() : getCleanEventTabName(eventName);
    var status = 'ACTIVE';
    var createdAt = String(data.createdAt || new Date().toISOString());

    // 1. Check if event ID already exists in PCD_Events
    var lastRow = eventsSheet.getLastRow();
    var existingRowIndex = -1;
    if (lastRow > 1) {
      var ids = eventsSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === eventId) {
          existingRowIndex = i + 2;
          break;
        }
      }
    }

    var rowValues = [
      eventId,
      eventName,
      date,
      startTime,
      endTime,
      venue,
      targetPcd,
      coordinatorsStr,
      cleanTabName,
      status,
      createdAt
    ];

    if (existingRowIndex > 0) {
      eventsSheet.getRange(existingRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      eventsSheet.appendRow(rowValues);
    }

    // 2. Immediately provision dedicated attendance tab in Google Sheets
    getOrCreateEventAttendanceSheet(ss, cleanTabName);

    var coordsList = coordinatorsStr
      ? coordinatorsStr.split(',').map(function(c) { return c.trim().toLowerCase(); }).filter(Boolean)
      : [];

    var eventObj = {
      id: eventId,
      name: eventName,
      description: data.description || 'PCD Activity scheduled by admin.',
      venue: venue,
      date: date,
      startTime: startTime,
      endTime: endTime,
      targetPcd: targetPcd,
      coordinators: coordsList,
      sheetTabName: cleanTabName,
      createdAt: createdAt
    };

    return jsonResponse({
      success: true,
      message: 'Event registered in PCD_Events and tab "' + cleanTabName + '" created.',
      event: eventObj
    }, callback);
  } catch (err) {
    Logger.log('handleCreateEvent error: ' + err);
    return jsonResponse({ success: false, error: err.toString() }, callback);
  }
}

function handleGetEvents(callback) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(PCD_EVENTS_SHEET_NAME);
    if (!sheet) {
      return jsonResponse({ success: true, count: 0, events: [] }, callback);
    }

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return jsonResponse({ success: true, count: 0, events: [] }, callback);
    }

    var data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
    var events = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var eventId = String(row[0] || '').trim();
      var eventName = String(row[1] || '').trim();
      var status = String(row[9] || 'ACTIVE').trim().toUpperCase();

      if (!eventId || !eventName || status === 'ARCHIVED') {
        continue;
      }

      var coordsStr = String(row[7] || '').trim();
      var coordinators = coordsStr
        ? coordsStr.split(',').map(function(c) { return c.trim().toLowerCase(); }).filter(Boolean)
        : [];

      var dateVal = row[2] instanceof Date ? row[2].toISOString().split('T')[0] : String(row[2] || '');
      var createdVal = row[10] instanceof Date ? row[10].toISOString() : String(row[10] || new Date().toISOString());

      events.push({
        id: eventId,
        name: eventName,
        description: 'PCD Activity scheduled by admin.',
        date: dateVal,
        startTime: String(row[3] || '09:00'),
        endTime: String(row[4] || '17:00'),
        venue: String(row[5] || 'SSN Campus'),
        targetPcd: String(row[6] || 'ALL'),
        coordinators: coordinators,
        sheetTabName: String(row[8] || getCleanEventTabName(eventName)),
        createdAt: createdVal
      });
    }

    // Latest created events first
    events.reverse();

    return jsonResponse({
      success: true,
      count: events.length,
      events: events
    }, callback);
  } catch (err) {
    Logger.log('handleGetEvents error: ' + err);
    return jsonResponse({ success: false, error: err.toString() }, callback);
  }
}

function handleGetEventAttendance(params, callback) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var targetTabName = params.sheetTabName || params.sheet || '';
    if (!targetTabName && params.eventName) {
      targetTabName = getCleanEventTabName(params.eventName);
    }

    if (!targetTabName && params.eventId) {
      var pcdEventsSheet = ss.getSheetByName(PCD_EVENTS_SHEET_NAME);
      if (pcdEventsSheet && pcdEventsSheet.getLastRow() > 1) {
        var vals = pcdEventsSheet.getRange(2, 1, pcdEventsSheet.getLastRow() - 1, 9).getValues();
        for (var i = 0; i < vals.length; i++) {
          if (String(vals[i][0]).trim() === String(params.eventId).trim()) {
            targetTabName = String(vals[i][8] || '').trim();
            break;
          }
        }
      }
    }

    if (!targetTabName) {
      return jsonResponse({ success: false, error: 'Event tab name or ID required' }, callback);
    }

    var sheet = ss.getSheetByName(targetTabName);
    if (!sheet) {
      var allSheets = ss.getSheets();
      for (var s = 0; s < allSheets.length; s++) {
        if (allSheets[s].getName().toLowerCase() === targetTabName.toLowerCase()) {
          sheet = allSheets[s];
          break;
        }
      }
    }

    if (!sheet) {
      return jsonResponse({ success: true, count: 0, attendance: [] }, callback);
    }

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return jsonResponse({ success: true, count: 0, attendance: [] }, callback);
    }

    var numCols = Math.min(sheet.getLastColumn(), 10);
    var rows = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
    var records = [];

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var is10Col = numCols >= 10;
      var digitalId = is10Col ? String(row[1] || '').trim() : String(row[1] || '').trim();
      var regNo = is10Col ? String(row[2] || '').trim() : digitalId;
      var name = is10Col ? String(row[3] || 'Student').trim() : String(row[2] || 'Student').trim();
      var dept = is10Col ? String(row[4] || 'Engineering').trim() : String(row[3] || 'Engineering').trim();
      var year = is10Col ? String(row[5] || '2nd Year').trim() : String(row[4] || '2nd Year').trim();
      var pcd = is10Col ? String(row[6] || 'NReg').trim() : String(row[5] || 'NReg').trim();
      var remarks = is10Col ? String(row[7] || '').trim() : String(row[6] || '').trim();
      var markedBy = is10Col ? String(row[8] || 'Coordinator').trim() : String(row[7] || 'Coordinator').trim();
      var confCode = is10Col ? String(row[9] || '').trim() : String(row[8] || '').trim();

      if (!digitalId && !regNo) continue;

      var ts = row[0] instanceof Date ? row[0].toISOString() : String(row[0] || new Date().toISOString());

      records.push({
        id: 'att-' + (regNo || digitalId) + '-' + r,
        eventId: params.eventId || '',
        eventName: params.eventName || targetTabName.replace(/^PCD\s*-\s*/, ''),
        digitalId: digitalId || regNo,
        registerNumber: regNo || digitalId,
        name: name,
        dept: dept,
        year: year,
        pcd: pcd,
        remarks: remarks,
        markedBy: markedBy,
        markedByName: markedBy,
        confirmationCode: confCode,
        timestamp: ts,
        method: 'barcode_scanner'
      });
    }

    return jsonResponse({
      success: true,
      sheetTabName: targetTabName,
      count: records.length,
      attendance: records
    }, callback);
  } catch (err) {
    Logger.log('handleGetEventAttendance error: ' + err);
    return jsonResponse({ success: false, error: err.toString() }, callback);
  }
}

function handleDeleteEvent(params, callback) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(PCD_EVENTS_SHEET_NAME);
    if (!sheet) {
      return jsonResponse({ success: true, message: 'No events sheet found' }, callback);
    }

    var targetId = String(params.id || params.eventId || '').trim();
    if (!targetId) {
      return jsonResponse({ success: false, error: 'Missing event ID' }, callback);
    }

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return jsonResponse({ success: false, error: 'No events to delete' }, callback);
    }

    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === targetId) {
        sheet.getRange(i + 2, 10).setValue('ARCHIVED');
        return jsonResponse({ success: true, message: 'Event ' + targetId + ' marked as ARCHIVED' }, callback);
      }
    }

    return jsonResponse({ success: false, error: 'Event ID not found in sheet' }, callback);
  } catch (err) {
    Logger.log('handleDeleteEvent error: ' + err);
    return jsonResponse({ success: false, error: err.toString() }, callback);
  }
}

/**
 * ====================================================================
 * ATTENDANCE LOGGING: Appends to event sheet tab & dispatches receipt
 * ====================================================================
 */
function handleMarkAttendance(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Dedicated event tab: "PCD - [Event Name]"
  var rawName = data.sheetTabName || data.eventName || 'Event Attendance';
  var cleanSheetName = getCleanEventTabName(rawName);

  var sheet = getOrCreateEventAttendanceSheet(ss, cleanSheetName);

  var studentId = String(data.studentId || data.digitalId || '').trim();
  var regNo = String(data.registerNumber || '').trim();

  // If studentId starts with 3122 and regNo is empty, set regNo
  if (studentId.indexOf('3122') === 0 && !regNo) {
    regNo = studentId;
  }
  if (!studentId && regNo) studentId = regNo;
  if (!regNo && studentId) regNo = studentId;

  // Check for duplicate in Column B (Student ID) or Column C (Register Number)
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow > 1) {
    var checkCols = lastCol >= 3 ? 2 : 1;
    var idValues = sheet.getRange(2, 2, lastRow - 1, checkCols).getValues();
    for (var i = 0; i < idValues.length; i++) {
      var existingId = String(idValues[i][0] || '').trim().toLowerCase();
      var existingReg = checkCols > 1 ? String(idValues[i][1] || '').trim().toLowerCase() : '';

      var isDup = false;
      if (studentId && (existingId === studentId.toLowerCase() || existingReg === studentId.toLowerCase())) isDup = true;
      if (regNo && (existingId === regNo.toLowerCase() || existingReg === regNo.toLowerCase())) isDup = true;

      if (isDup) {
        return jsonResponse({
          success: false,
          duplicate: true,
          message: 'Student (' + (regNo || studentId) + ') is already marked present in ' + cleanSheetName + '.'
        });
      }
    }
  }

  var confirmationCode = data.confirmationCode || ('SSN-' + Math.floor(100000 + Math.random() * 900000));

  // Append attendance row (10 columns)
  var rowData = [
    new Date(),
    studentId,
    regNo,
    data.studentName || 'Student',
    data.dept || 'Engineering',
    data.year || '2nd Year',
    data.pcd || 'Not Registered',
    data.remarks || '',
    data.markedByName ? (data.markedByName + ' (' + data.markedBy + ')') : (data.markedBy || 'Admin'),
    confirmationCode
  ];

  sheet.appendRow(rowData);

  // Send confirmation receipt email if student email is present or can be inferred
  var studentMail = String(data.studentEmail || '').trim();
  if (!studentMail) {
    if (regNo && regNo.indexOf('@') !== -1) studentMail = regNo;
    else if (studentId && studentId.indexOf('@') !== -1) studentMail = studentId;
    else if (studentId && studentId.length >= 6) studentMail = studentId.toLowerCase().replace(/[^a-z0-9]/g, '') + '@ssn.edu.in';
    else if (regNo && regNo.length >= 6) studentMail = regNo.toLowerCase().replace(/[^a-z0-9]/g, '') + '@ssn.edu.in';
  }

  if (studentMail && studentMail.indexOf('@') !== -1) {
    try {
      data.studentEmail = studentMail;
      data.studentId = studentId;
      data.registerNumber = regNo;
      data.confirmationCode = confirmationCode;
      sendStudentReceiptEmail(data);
    } catch (mailErr) {
      Logger.log('Student mail dispatch notice: ' + mailErr);
    }
  }

  return jsonResponse({
    success: true,
    sheet: cleanSheetName,
    message: 'Attendance saved to sheet "' + cleanSheetName + '"'
  });
}

function handleNotifyCoordinator(data, callback) {
  if (!data.coordinatorEmail) {
    return jsonResponse({ success: false, error: 'Missing coordinatorEmail' }, callback);
  }

  var eventName = data.eventName || 'SSN PCD Activity';
  var eventDate = data.eventDate || 'Scheduled date';
  var startTime = data.startTime || '09:00';
  var endTime = data.endTime || '17:00';
  var venue = data.venue || 'SSN College Campus';
  var directLink = data.directLink || 'https://myselfgokul-1111.github.io/SSN-YRC-Attendance-Management/';

  var subject = '📋 Assignment & Access: Event Coordinator for "' + eventName + '"';
  var htmlBody =
    '<div style="font-family:Arial,-apple-system,sans-serif;max-width:600px;margin:auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">' +
    '<div style="background:#991b1b;color:#ffffff;padding:26px 24px;text-align:center;">' +
    '<h1 style="margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;">SSN PCD Activities</h1>' +
    '<p style="margin:6px 0 0;font-size:13px;color:#fecaca;font-weight:500;">Coordinator Assignment & Live Scanner Credentials</p>' +
    '</div>' +
    '<div style="padding:24px 28px;color:#1f2937;line-height:1.6;">' +
    '<p style="margin-top:0;font-size:14px;">Dear Coordinator,</p>' +
    '<p style="font-size:14px;">You have been assigned as an official Attendance Coordinator for the following PCD activity:</p>' +
    
    '<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:14px 18px;margin:18px 0;border-radius:6px;">' +
    '<h2 style="margin:0;color:#991b1b;font-size:16px;font-weight:800;">' + eventName + '</h2>' +
    '<p style="margin:8px 0 0;font-size:13px;color:#374151;">' +
    '📅 <b>Date:</b> ' + eventDate + '<br>' +
    '⏰ <b>Allowed Access Window:</b> <span style="color:#b91c1c;font-weight:bold;">' + startTime + ' - ' + endTime + '</span> (Strictly Time-Locked)<br>' +
    '📍 <b>Venue:</b> ' + venue +
    '</p></div>' +

    '<div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:12px;color:#92400e;">' +
    '⏳ <b>Important Time Restriction:</b> Your access to the Live Scanner is strictly active during <b>' + startTime + ' to ' + endTime + '</b>. ' +
    'Scanning will be automatically locked before and after this duration.' +
    '</div>' +

    '<h3 style="font-size:14px;margin:20px 0 8px;color:#111827;font-weight:bold;">How to Access Your Scanner:</h3>' +
    
    '<p style="font-size:13px;color:#4b5563;margin-bottom:12px;"><b>Option 1: 1-Click Instant Scanner Access (No password required)</b></p>' +
    '<div style="text-align:center;margin:16px 0;">' +
    '<a href="' + directLink + '" style="display:inline-block;background:#991b1b;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;letter-spacing:0.2px;">' +
    'Launch Event Scanner →</a>' +
    '</div>' +

    '<p style="font-size:13px;color:#4b5563;margin-top:20px;margin-bottom:6px;"><b>Option 2: Manual Login (From any device or mobile browser)</b></p>' +
    '<table style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:13px;">' +
    '<tr><td style="padding:6px;color:#6b7280;width:120px;">Username / Email:</td><td style="padding:6px;font-family:monospace;font-weight:bold;color:#111827;">' + data.coordinatorEmail + '</td></tr>' +
    '<tr><td style="padding:6px;color:#6b7280;">Password:</td><td style="padding:6px;font-family:monospace;font-weight:bold;color:#991b1b;">SSN@Coord2026</td></tr>' +
    '<tr><td style="padding:6px;color:#6b7280;">Assigned Role:</td><td style="padding:6px;font-weight:bold;color:#2563eb;">Event Coordinator (Live Scanner Only)</td></tr>' +
    '</table>' +

    '<p style="font-size:12px;color:#6b7280;margin-top:20px;border-top:1px solid #f3f4f6;padding-top:14px;">' +
    '🔒 <i>Note: Your coordinator dashboard gives you exclusive access to scan barcodes/IDs and mark attendance for this event. No administrative settings or other tabs are accessible.</i>' +
    '</p>' +
    '</div></div>';

  try {
    MailApp.sendEmail({
      to: data.coordinatorEmail,
      subject: subject,
      htmlBody: htmlBody,
      replyTo: YRC_REPLY_TO_EMAIL,
      name: 'SSN PCD Activities'
    });
    return jsonResponse({ success: true, message: 'Notification email sent to ' + data.coordinatorEmail }, callback);
  } catch (err) {
    Logger.log('MailApp error, trying GmailApp: ' + err);
    try {
      GmailApp.sendEmail(data.coordinatorEmail, subject, '', {
        htmlBody: htmlBody,
        name: 'SSN PCD Activities',
        replyTo: YRC_REPLY_TO_EMAIL
      });
      return jsonResponse({ success: true, message: 'Notification email sent via Gmail to ' + data.coordinatorEmail }, callback);
    } catch (gErr) {
      Logger.log('GmailApp error: ' + gErr);
      return jsonResponse({ success: false, error: err.toString() }, callback);
    }
  }
}

function sendStudentReceiptEmail(data) {
  var pcdColor = data.pcd === 'YRC' ? '#dc2626' : (data.pcd === 'NSS' ? '#2563eb' : (data.pcd === 'NSO' ? '#059669' : '#6b7280'));
  var pcdName = data.pcd === 'NReg' ? 'Not Registered' : data.pcd;

  var eventName = data.eventName || 'SSN PCD Activity';
  var eventDate = data.eventDate || (data.timestamp ? (new Date(data.timestamp).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]);
  var venue = data.venue || '';
  var rollNo = data.studentId || data.digitalId || '';
  var regNo = data.registerNumber || rollNo || '';

  var subject = '✓ Attendance Marked: ' + eventName + ' (' + eventDate + ')';
  var htmlBody =
    '<div style="font-family:Arial,-apple-system,sans-serif;max-width:550px;margin:auto;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">' +
    '<div style="background:#111827;color:#ffffff;padding:22px 20px;text-align:center;">' +
    '<h2 style="margin:0;font-size:18px;font-weight:bold;letter-spacing:-0.3px;">SSN PCD Activities</h2>' +
    '<p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Official Digital Attendance Receipt</p>' +
    '</div>' +

    '<div style="padding:22px 24px;color:#1f2937;">' +
    '<div style="text-align:center;padding:6px 0 16px;">' +
    '<span style="display:inline-block;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:6px 16px;border-radius:24px;font-weight:bold;font-size:13px;">✓ Attendance Recorded & Verified</span>' +
    '</div>' +

    // Event Details Card
    '<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;margin-bottom:16px;border-radius:6px;">' +
    '<div style="font-size:11px;font-weight:bold;text-transform:uppercase;color:#991b1b;letter-spacing:0.5px;">Event Details</div>' +
    '<h3 style="margin:4px 0 6px;color:#111827;font-size:16px;font-weight:800;">' + eventName + '</h3>' +
    '<p style="margin:0;font-size:13px;color:#4b5563;">' +
    '📅 <b>Date:</b> ' + eventDate +
    (venue ? ('<br>📍 <b>Venue:</b> ' + venue) : '') +
    '</p>' +
    '</div>' +

    // Student & Verification Details
    '<table style="width:100%;margin-top:10px;border-collapse:collapse;font-size:13px;">' +
    '<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0;color:#6b7280;">Student Name:</td><td style="padding:8px 0;font-weight:bold;color:#111827;">' + (data.studentName || 'Student') + '</td></tr>' +
    '<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0;color:#6b7280;">Register Number (3122...):</td><td style="padding:8px 0;font-family:monospace;font-weight:bold;color:#991b1b;">' + regNo + '</td></tr>' +
    (rollNo && rollNo !== regNo ? ('<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0;color:#6b7280;">Roll No / Digital ID:</td><td style="padding:8px 0;font-family:monospace;font-weight:bold;color:#111827;">' + rollNo + '</td></tr>') : '') +
    '<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0;color:#6b7280;">Department:</td><td style="padding:8px 0;font-weight:bold;color:#111827;">' + (data.dept || 'Engineering') + '</td></tr>' +
    '<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0;color:#6b7280;">Year:</td><td style="padding:8px 0;font-weight:bold;color:#111827;">' + (data.year || '2nd Year') + '</td></tr>' +
    '<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0;color:#6b7280;">PCD Category:</td><td style="padding:8px 0;"><span style="color:' + pcdColor + ';font-weight:bold;">' + pcdName + '</span></td></tr>' +
    (data.remarks ? ('<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0;color:#6b7280;">Remark:</td><td style="padding:8px 0;font-style:italic;color:#374151;">' + data.remarks + '</td></tr>') : '') +
    '<tr><td style="padding:8px 0;color:#6b7280;">Confirmation Code:</td><td style="padding:8px 0;font-family:monospace;font-weight:bold;color:#111827;">' + (data.confirmationCode || 'VERIFIED') + '</td></tr>' +
    '</table>' +

    // Reply-to prompt
    '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-top:18px;font-size:12px;color:#4b5563;text-align:center;">' +
    '💬 <b>Questions or discrepancies?</b><br>' +
    'Reply directly to this email to reach the <b style="color:#111827;">SSN YRC Attendance Management Team</b> (<a href="mailto:yrc-attendance-management-team-ssn@ssn.edu.in" style="color:#dc2626;text-decoration:none;">yrc-attendance-management-team-ssn@ssn.edu.in</a>).' +
    '</div>' +

    '<p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:18px;border-top:1px solid #f3f4f6;padding-top:12px;">Logged on ' + new Date().toLocaleString() + ' via SSN PCD Activities Portal</p>' +
    '</div></div>';

  try {
    MailApp.sendEmail({
      to: data.studentEmail,
      subject: subject,
      htmlBody: htmlBody,
      replyTo: YRC_REPLY_TO_EMAIL,
      name: 'SSN PCD Activities'
    });
  } catch (err) {
    Logger.log('MailApp receipt error, trying GmailApp: ' + err);
    try {
      GmailApp.sendEmail(data.studentEmail, subject, '', {
        htmlBody: htmlBody,
        name: 'SSN PCD Activities',
        replyTo: YRC_REPLY_TO_EMAIL
      });
    } catch (gErr) {
      Logger.log('GmailApp receipt error: ' + gErr);
    }
  }
}

/**
 * ====================================================================
 * ONE-CLICK AUTHORIZATION HELPER
 * ====================================================================
 * Select 'authorizeEmailPermissions' from the toolbar function dropdown
 * and click 'Run' to trigger Google's permission review window.
 * This grants https://www.googleapis.com/auth/script.send_mail
 */
function authorizeEmailPermissions() {
  var email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to: email,
    subject: '✓ SSN PCD Activities - Email Authorization Verified',
    body: 'Your Google Apps Script Web App now has full authorization to dispatch emails to event coordinators and student verification receipts! Outbound replies are directed to ' + YRC_REPLY_TO_EMAIL,
    replyTo: YRC_REPLY_TO_EMAIL,
    name: 'SSN PCD Activities'
  });
  Logger.log('Successfully authorized email permissions! Test email sent to: ' + email);
  return 'Authorized and sent test email to ' + email;
}

function jsonResponse(obj, callback) {
  var jsonStr = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonStr + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}
