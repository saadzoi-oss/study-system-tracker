const STAGE_SHEET_NAME = "Study Sessions";
const WEEKLY_SHEET_NAME = "Weekly Summary";
const WEEK_FORMAT = "yyyy-MM-dd";

const STAGE_HEADERS = [
  "Received At", "Session Timestamp", "Device ID", "Class", "Subject",
  "Stage", "Stage Name", "Method", "Study Seconds", "Crosscheck Seconds",
  "Total Seconds"
];

const WEEKLY_HEADERS = [
  "Received At", "Device ID", "Week Start", "Total Seconds", "Study Days",
  "Stage 1 Seconds", "Stage 2 Seconds", "Stage 3 Seconds",
  "Crosscheck Seconds", "Stage Count", "Classes JSON", "Method Counts JSON"
];


function doGet() {
  return text_("Study System Tracker endpoint is running.");
}


function doPost(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || "").trim();

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return text_("Server busy, try again");
  }

  try {
    if (action === "submitStage") return submitStage_(p);
    if (action === "submitWeekly") return submitWeekly_(p);
    return text_("Unknown action");
  } finally {
    lock.releaseLock();
  }
}


/* =========================================
   AUTOMATIC INDIVIDUAL STUDY SESSION LOG
   ========================================= */

function submitStage_(p) {
  const sheet = getSheet_(STAGE_SHEET_NAME, STAGE_HEADERS);

  // Keep Device ID as text so it is never coerced to a number
  sheet.getRange("C:C").setNumberFormat("@");

  sheet.appendRow([
    new Date(),
    p.timestamp || "",
    String(p.deviceId || ""),
    p.className || "",
    p.subject || "",
    p.stage || "",
    p.stageName || "",
    p.method || "",
    Number(p.studySeconds || 0),
    Number(p.crosscheckSeconds || 0),
    Number(p.totalSeconds || 0)
  ]);

  return text_("Stage saved");
}


/* =========================================
   WEEKLY SUMMARY
   ========================================= */

function submitWeekly_(p) {
  const sheet = getSheet_(WEEKLY_SHEET_NAME, WEEKLY_HEADERS);
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  // Device ID (B) and Week Start (C) stored as plain text so matching works
  sheet.getRange("B:C").setNumberFormat("@");

  const deviceId = String(p.deviceId || "").trim();
  const weekStart = String(p.weekStart || "").trim();

  const values = [
    new Date(),
    deviceId,
    weekStart,
    Number(p.totalSeconds || 0),
    Number(p.studyDays || 0),
    Number(p.stage1Seconds || 0),
    Number(p.stage2Seconds || 0),
    Number(p.stage3Seconds || 0),
    Number(p.crosscheckSeconds || 0),
    Number(p.stageCount || 0),
    p.classesJson || "{}",
    p.methodCountsJson || "{}"
  ];

  // Same device + same week: update that row instead of duplicating
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const keys = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (
        normalize_(keys[i][0], tz) === deviceId &&
        normalize_(keys[i][1], tz) === weekStart
      ) {
        sheet.getRange(i + 2, 1, 1, values.length).setValues([values]);
        return text_("Weekly summary updated");
      }
    }
  }

  sheet.appendRow(values);
  return text_("Weekly summary saved");
}


/* =========================================
   HELPERS
   ========================================= */

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}


// Converts legacy Date cells back to the yyyy-MM-dd string the client sends
function normalize_(v, tz) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, tz, WEEK_FORMAT);
  }
  return String(v || "").trim();
}


function text_(msg) {
  return ContentService
    .createTextOutput(msg)
    .setMimeType(ContentService.MimeType.TEXT);
}
