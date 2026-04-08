// ============================================================
//  ICF-SL  School-Based ITN Distribution — Google Apps Script
//  Handles:
//    1. Form data submission → Google Sheet (human-readable headers)
//    2. Claude AI agent proxy (Anthropic API)
//    3. getData action for Analysis dashboard
// ============================================================

const CONFIG = {
  ANTHROPIC_API_KEY: 'PASTE_YOUR_KEY_HERE',   // ← replace this with your real sk-ant-api03-... key
  ANTHROPIC_MODEL:   'claude-sonnet-4-20250514',
  SHEET_NAME_DATA:   'Submissions',
  SHEET_NAME_ITN:    'ITN Movement',           // ← new tab for ITN movement records
  SHEET_NAME_PHU:    'PHU Receipts',            // ← PHU delivery confirmations
  SHEET_NAME_LOG:    'AI_Log',
  MAX_TOKENS:        1200
};

// ── FIELD MAP: variable name → human-readable label ──────────
// Order here = column order in the sheet
const FIELD_MAP = [
  // Meta
  { field: 'timestamp',           label: 'Submission Date & Time'       },
  { field: 'submitted_by',        label: 'Submitted By'                 },
  { field: 'form_status',         label: 'Form Status'                  },
  // Location
  { field: 'district',            label: 'District'                     },
  { field: 'chiefdom',            label: 'Chiefdom'                     },
  { field: 'section_loc',         label: 'Section'                      },
  { field: 'facility',            label: 'Health Facility (PHU)'        },
  { field: 'community',           label: 'Community / Village'          },
  { field: 'school_name',         label: 'School Name'                  },
  { field: 'emis_number',         label: 'EMIS Number'                  },
  { field: 'school_status',       label: 'School Status'                },
  { field: 'is_new_school',       label: 'New School?'                  },
  // School profile
  { field: 'head_teacher',        label: 'Head Teacher Name'            },
  { field: 'head_teacher_phone',  label: 'Head Teacher Phone'           },
  { field: 'distribution_date',   label: 'Distribution Date'            },
  // ITNs received
  { field: 'itns_received',       label: 'Total ITNs Received'          },
  { field: 'itn_type_pbo',        label: 'PBO ITNs?'                    },
  { field: 'itn_type_ig2',        label: 'IG2 ITNs?'                    },
  { field: 'itn_qty_pbo',         label: 'Quantity PBO ITNs'            },
  { field: 'itn_qty_ig2',         label: 'Quantity IG2 ITNs'            },
  // Class 1
  { field: 'c1_teacher_name',     label: 'Class 1 Teacher Name'         },
  { field: 'c1_teacher_phone',    label: 'Class 1 Teacher Phone'        },
  { field: 'c1_boys',             label: 'Class 1 — Boys Enrolled'      },
  { field: 'c1_boys_itn',         label: 'Class 1 — Boys Received ITN'  },
  { field: 'c1_girls',            label: 'Class 1 — Girls Enrolled'     },
  { field: 'c1_girls_itn',        label: 'Class 1 — Girls Received ITN' },
  // Class 2
  { field: 'c2_teacher_name',     label: 'Class 2 Teacher Name'         },
  { field: 'c2_teacher_phone',    label: 'Class 2 Teacher Phone'        },
  { field: 'c2_boys',             label: 'Class 2 — Boys Enrolled'      },
  { field: 'c2_boys_itn',         label: 'Class 2 — Boys Received ITN'  },
  { field: 'c2_girls',            label: 'Class 2 — Girls Enrolled'     },
  { field: 'c2_girls_itn',        label: 'Class 2 — Girls Received ITN' },
  // Class 3
  { field: 'c3_teacher_name',     label: 'Class 3 Teacher Name'         },
  { field: 'c3_teacher_phone',    label: 'Class 3 Teacher Phone'        },
  { field: 'c3_boys',             label: 'Class 3 — Boys Enrolled'      },
  { field: 'c3_boys_itn',         label: 'Class 3 — Boys Received ITN'  },
  { field: 'c3_girls',            label: 'Class 3 — Girls Enrolled'     },
  { field: 'c3_girls_itn',        label: 'Class 3 — Girls Received ITN' },
  // Class 4
  { field: 'c4_teacher_name',     label: 'Class 4 Teacher Name'         },
  { field: 'c4_teacher_phone',    label: 'Class 4 Teacher Phone'        },
  { field: 'c4_boys',             label: 'Class 4 — Boys Enrolled'      },
  { field: 'c4_boys_itn',         label: 'Class 4 — Boys Received ITN'  },
  { field: 'c4_girls',            label: 'Class 4 — Girls Enrolled'     },
  { field: 'c4_girls_itn',        label: 'Class 4 — Girls Received ITN' },
  // Class 5
  { field: 'c5_teacher_name',     label: 'Class 5 Teacher Name'         },
  { field: 'c5_teacher_phone',    label: 'Class 5 Teacher Phone'        },
  { field: 'c5_boys',             label: 'Class 5 — Boys Enrolled'      },
  { field: 'c5_boys_itn',         label: 'Class 5 — Boys Received ITN'  },
  { field: 'c5_girls',            label: 'Class 5 — Girls Enrolled'     },
  { field: 'c5_girls_itn',        label: 'Class 5 — Girls Received ITN' },
  // Computed totals
  { field: 'total_boys',          label: 'Total Boys Enrolled'          },
  { field: 'total_girls',         label: 'Total Girls Enrolled'         },
  { field: 'total_pupils',        label: 'Total Pupils Enrolled'        },
  { field: 'total_boys_itn',      label: 'Total Boys Received ITN'      },
  { field: 'total_girls_itn',     label: 'Total Girls Received ITN'     },
  { field: 'total_itn',           label: 'Total ITNs Distributed'       },
  { field: 'itns_remaining',      label: 'ITNs Remaining'               },
  { field: 'prop_boys',           label: 'Proportion Boys (%)'          },
  { field: 'prop_girls',          label: 'Proportion Girls (%)'         },
  { field: 'coverage_boys',       label: 'Boys ITN Coverage (%)'        },
  { field: 'coverage_girls',      label: 'Girls ITN Coverage (%)'       },
  { field: 'coverage_total',      label: 'Overall ITN Coverage (%)'     },
  // Team & GPS
  { field: 'survey_date',         label: 'Survey Date'                  },
  { field: 'gps_lat',             label: 'GPS Latitude'                 },
  { field: 'gps_lng',             label: 'GPS Longitude'                },
  { field: 'gps_acc',             label: 'GPS Accuracy (m)'             },
  { field: 'team1_name',          label: 'Team Member 1 — Name'         },
  { field: 'team1_phone',         label: 'Team Member 1 — Phone'        },
  { field: 'team1_signature',     label: 'Team Member 1 — Signed?'      },
  { field: 'team2_name',          label: 'Team Member 2 — Name'         },
  { field: 'team2_phone',         label: 'Team Member 2 — Phone'        },
  { field: 'team2_signature',     label: 'Team Member 2 — Signed?'      },
  { field: 'team3_name',          label: 'Team Member 3 — Name'         },
  { field: 'team3_phone',         label: 'Team Member 3 — Phone'        },
  { field: 'team3_signature',     label: 'Team Member 3 — Signed?'      }
];

// ── ENTRY POINTS ─────────────────────────────────────────────
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'ping') {
    return jsonResponse({ status: 'ok', message: 'ICF-SL GAS Backend live' });
  }
  if (action === 'count') {
    return jsonResponse({ count: getSubmissionCount() });
  }
  if (action === 'getData') {
    return jsonResponse({ success: true, rows: getAllSubmissionsAsObjects() });
  }
  if (action === 'checkDuplicate') {
    return jsonResponse(checkDuplicateInSheet(e.parameter));
  }
  if (action === 'checkPHUDispatch') {
    return jsonResponse(checkPHUDispatch(e.parameter));
  }
  if (action === 'getPHUReceipts') {
    return jsonResponse(getPHUReceipts());
  }
  if (action === 'getDispatch') {
    return jsonResponse(getDispatchById(e.parameter.id || ''));
  }
  return jsonResponse({ status: 'ok' });
}

function doPost(e) {
  try {
    let body = {};
    if (e && e.parameter && e.parameter.payload) {
      body = JSON.parse(e.parameter.payload);
    } else if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    const action = body.action || 'submit';
    if (action === 'submit')           return handleSubmission(body);
    if (action === 'itn_movement')     return handleITNMovement(body);
    if (action === 'ai_query')         return handleAIQuery(body);
    if (action === 'savePHUReceipt')   return handlePHUReceipt(body);
    if (action === 'saveAssessmentGrade') return handleAssessmentGrade(body);

    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── ITN MOVEMENT SUBMISSION ───────────────────────────────────
// Handles records from itn_movement.html (DMS to PHU dispatches)
function handleITNMovement(data) {
  try {
    const ss  = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME_ITN);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME_ITN);
      // Write headers
      const headers = [
        'Dispatch ID', 'Timestamp', 'DMS Staff Name', 'DMS Staff Username',
        'Staff District', 'Destination District', 'Chiefdom', 'Health Facility (PHU)',
        'IG2 ITNs', 'PBO ITNs', 'Total ITNs',
        'Driver Name', 'Driver Username', 'Vehicle Plate', 'Status', 'Notes'
      ];
      sheet.appendRow(headers);
      const hdr = sheet.getRange(1, 1, 1, headers.length);
      hdr.setBackground('#004080');
      hdr.setFontColor('#ffffff');
      hdr.setFontWeight('bold');
      hdr.setFontFamily('Arial');
      hdr.setFontSize(10);
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 160);
      sheet.setColumnWidth(2, 170);
      sheet.setColumnWidth(8, 200);
    }

    const row = [
      data.dispatch_id        || '',
      data.timestamp          || new Date().toISOString(),
      data.staff_name         || '',
      data.staff_username     || '',
      data.staff_district     || '',
      data.destination_district || '',
      data.chiefdom           || '',
      data.phu                || '',
      parseInt(data.ig2_qty)  || 0,
      parseInt(data.pbo_qty)  || 0,
      parseInt(data.total_qty)|| 0,
      data.driver_name        || '',
      data.driver_username    || '',
      data.vehicle            || '',
      data.status             || 'dispatched',
      data.notes              || ''
    ];

    sheet.appendRow(row);

    // Alternate row shading
    const lastRow = sheet.getLastRow();
    if (lastRow % 2 === 0) {
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#f0f6ff');
    }

    return jsonResponse({ success: true, message: 'ITN movement recorded', row: lastRow });

  } catch(err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ── FORM DATA SUBMISSION ───────────────────────────────────────
function handleSubmission(data) {
  try {
    const ss  = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME_DATA);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME_DATA);
      writeHeaders(sheet);
    } else if (sheet.getLastRow() === 0) {
      writeHeaders(sheet);
    }

    // Map field values in FIELD_MAP order
    const row = FIELD_MAP.map(({ field }) => {
      const val = data[field];
      // Store base64 signatures as YES/NO flag (saves space)
      if (field.includes('signature') && val && String(val).length > 100) return 'YES';
      return val !== undefined ? val : '';
    });

    sheet.appendRow(row);

    try {
      sheet.autoResizeColumns(1, Math.min(FIELD_MAP.length, 50));
    } catch(e) {}

    return jsonResponse({
      success: true,
      message: 'Submission saved',
      row:     sheet.getLastRow()
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function writeHeaders(sheet) {
  const labels = FIELD_MAP.map(f => f.label);
  sheet.appendRow(labels);

  const headerRange = sheet.getRange(1, 1, 1, labels.length);
  headerRange.setBackground('#004080');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontFamily('Arial');
  headerRange.setFontSize(10);
  sheet.setFrozenRows(1);

  // Extra wide for label columns
  sheet.setColumnWidth(1, 180);  // Submission Date
  sheet.setColumnWidth(9, 200);  // School Name
  sheet.setColumnWidth(10, 180); // Head Teacher
  sheet.setColumnWidth(7, 200);  // PHU
}

function getSubmissionCount() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME_DATA);
    if (!sheet) return 0;
    return Math.max(0, sheet.getLastRow() - 1);
  } catch(e) { return 0; }
}

// ── checkDuplicate: returns {exists, timestamp, submitted_by} ──
// Called by the browser before allowing submission.
// Matches on ALL 6 geo-hierarchy fields (case-insensitive).
// ── CHECK PHU DISPATCH (ITN Movement sheet) ─────────────────────────────────
// Called via GET ?action=checkPHUDispatch&district=X&chiefdom=Y&phu=Z
// Returns { found: true/false, ...dispatch fields } 
function checkPHUDispatch(params) {
  try {
    const district = String(params.district || '').trim().toLowerCase();
    const chiefdom = String(params.chiefdom || '').trim().toLowerCase();
    const phu      = String(params.phu      || '').trim().toLowerCase();

    if (!district || !chiefdom || !phu) return { found: false };

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME_ITN);
    if (!sheet || sheet.getLastRow() <= 1) return { found: false };

    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());

    // Find column positions by header name
    const col = name => headers.indexOf(name);
    const iDispatchId = col('dispatch id');
    const iTimestamp  = col('timestamp');
    const iStaff      = col('dms staff name');
    const iDistrict   = col('destination district');
    const iChiefdom   = col('chiefdom');
    const iPHU        = col('health facility (phu)');
    const iIG2        = col('ig2 itns');
    const iPBO        = col('pbo itns');
    const iTotal      = col('total itns');
    const iDriver     = col('driver name');
    const iVehicle    = col('vehicle plate');

    const lc = s => String(s || '').trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (lc(row[iDistrict]) === district &&
          lc(row[iChiefdom]) === chiefdom &&
          lc(row[iPHU])      === phu) {
        return {
          found:        true,
          dispatch_id:  row[iDispatchId] || '',
          timestamp:    row[iTimestamp]  ? new Date(row[iTimestamp]).toISOString() : '',
          staff_name:   row[iStaff]      || '',
          chiefdom:     row[iChiefdom]   || '',
          phu:          row[iPHU]        || '',
          ig2_qty:      row[iIG2]        || 0,
          pbo_qty:      row[iPBO]        || 0,
          total_qty:    row[iTotal]      || 0,
          driver_name:  row[iDriver]     || '',
          vehicle:      row[iVehicle]    || ''
        };
      }
    }
    return { found: false };

  } catch(err) {
    return { found: false, error: err.message };
  }
}

function checkDuplicateInSheet(params) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME_DATA);
    if (!sheet || sheet.getLastRow() <= 1) return { exists: false };

    const data   = sheet.getDataRange().getValues();
    const labels = data[0].map(h => String(h).trim());

    // Find column indices for the four hierarchy fields (no section)
    const fieldCols = {
      district:  FIELD_MAP.findIndex(f => f.field === 'district'),
      chiefdom:  FIELD_MAP.findIndex(f => f.field === 'chiefdom'),
      facility:  FIELD_MAP.findIndex(f => f.field === 'facility'),
      community: FIELD_MAP.findIndex(f => f.field === 'community'),
      school:    FIELD_MAP.findIndex(f => f.field === 'school_name')
    };

    // Map FIELD_MAP index → actual sheet column index (via label matching)
    function sheetCol(fieldIdx) {
      if (fieldIdx < 0) return -1;
      const lbl = FIELD_MAP[fieldIdx].label;
      return labels.indexOf(lbl);
    }

    const colD  = sheetCol(fieldCols.district);
    const colC  = sheetCol(fieldCols.chiefdom);
    const colF  = sheetCol(fieldCols.facility);
    const colCo = sheetCol(fieldCols.community);
    const colSc = sheetCol(fieldCols.school);
    const colTs = sheetCol(FIELD_MAP.findIndex(f => f.field === 'timestamp'));
    const colBy = sheetCol(FIELD_MAP.findIndex(f => f.field === 'submitted_by'));

    const lc = s => String(s||'').trim().toLowerCase();

    const qD  = lc(params.district);
    const qC  = lc(params.chiefdom);
    const qF  = lc(params.facility);
    const qCo = lc(params.community);
    const qSc = lc(params.school);

    const rows = data.slice(1);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (
        lc(row[colD])  === qD  &&
        lc(row[colC])  === qC  &&
        lc(row[colF])  === qF  &&
        lc(row[colCo]) === qCo &&
        lc(row[colSc]) === qSc
      ) {
        return {
          exists:       true,
          timestamp:    colTs >= 0 ? String(row[colTs]) : '',
          submitted_by: colBy >= 0 ? String(row[colBy]) : ''
        };
      }
    }

    return { exists: false };

  } catch(e) {
    Logger.log('checkDuplicateInSheet error: ' + e.message);
    return { exists: false, error: e.message };
  }
}

// ── getData: returns rows keyed by FIELD names (not labels) ──
// This lets the browser analysis dashboard work with field keys.
function getAllSubmissionsAsObjects() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME_DATA);
    if (!sheet || sheet.getLastRow() <= 1) return [];

    const data    = sheet.getDataRange().getValues();
    const labels  = data[0].map(h => String(h).trim());
    const rows    = data.slice(1).filter(r => r.some(c => c !== ''));

    // Build a label→field reverse map
    const labelToField = {};
    FIELD_MAP.forEach(({ field, label }) => { labelToField[label] = field; });

    return rows.map(row => {
      const obj = {};
      labels.forEach((lbl, i) => {
        const fieldName = labelToField[lbl] || lbl; // fallback to label if not found
        obj[fieldName] = row[i] !== undefined ? String(row[i]) : '';
      });
      return obj;
    });
  } catch(e) {
    Logger.log('getAllSubmissionsAsObjects error: ' + e.message);
    return [];
  }
}

// ── 2. AI AGENT PROXY ─────────────────────────────────────────
function handleAIQuery(body) {
  try {
    const userMessage    = body.message    || '';
    const history        = body.history    || [];
    const sessionContext = body.context    || '';

    if (!userMessage) {
      return jsonResponse({ success: false, error: 'No message provided' });
    }
    if (!CONFIG.ANTHROPIC_API_KEY || CONFIG.ANTHROPIC_API_KEY.trim() === '') {
      return jsonResponse({ success: false, error: 'Anthropic API key not configured in GAS. Add your key to CONFIG.ANTHROPIC_API_KEY.' });
    }

    const sheetContext = getAllSubmissionsAsText();
    const dataContext  = sheetContext +
      (sessionContext && sessionContext.trim().length > 50
        ? '\n\n=== ADDITIONAL SESSION DATA (not yet synced to sheet) ===\n' + sessionContext
        : '');

    const messages = [];
    history.forEach(h => {
      if (h.role && h.content) messages.push({ role: h.role, content: h.content });
    });
    messages.push({ role: 'user', content: userMessage });

    const payload = {
      model:      CONFIG.ANTHROPIC_MODEL,
      max_tokens: CONFIG.MAX_TOKENS,
      system:     buildSystemPrompt(dataContext),
      messages:   messages
    };

    const options = {
      method:      'post',
      contentType: 'application/json',
      headers: {
        'x-api-key':         CONFIG.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      payload:            JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response     = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      let errMsg = 'Anthropic API error (' + responseCode + ')';
      try { errMsg = JSON.parse(responseText).error?.message || errMsg; } catch(e) {}
      return jsonResponse({ success: false, error: errMsg });
    }

    const result = JSON.parse(responseText);
    const reply  = (result.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    logAIQuery(userMessage, reply);

    return jsonResponse({ success: true, reply, usage: result.usage || {} });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function buildSystemPrompt(dataContext) {
  return `You are the ICF Data Agent, an expert AI assistant embedded inside the ICF-SL School-Based ITN Distribution PWA for Sierra Leone, built by Informatics Consultancy Firm Sierra Leone (ICF-SL).

You have DIRECT ACCESS to all distribution data from the Google Sheet. The full dataset is provided below.

Your role:
- Answer any question about the distribution data quickly and accurately
- Perform calculations: totals, averages, coverage rates, rankings, comparisons, gender disaggregation
- Highlight insights, anomalies, or patterns
- Be concise but thorough — use bullet points and **bold** for key figures
- Respond in the same language the user writes in
- Only use data that is explicitly provided — do not invent figures

${dataContext ? 'LIVE DATA SNAPSHOT:\n' + dataContext : 'NOTE: No submissions in the sheet yet. Inform the user.'}`;
}

function logAIQuery(question, answer) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    let sheet   = ss.getSheetByName(CONFIG.SHEET_NAME_LOG);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME_LOG);
      sheet.appendRow(['Timestamp', 'Question', 'Answer (truncated)']);
      const hdr = sheet.getRange(1, 1, 1, 3);
      hdr.setBackground('#1a1a2e'); hdr.setFontColor('#fff'); hdr.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([
      new Date().toISOString(),
      question.substring(0, 500),
      answer.substring(0, 1000)
    ]);
  } catch(e) { /* non-critical */ }
}

// ── 3. ALL SUBMISSIONS AS TEXT (for AI context) ──────────────
function getAllSubmissionsAsText() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME_DATA);
    if (!sheet || sheet.getLastRow() <= 1) return 'No submissions in the Google Sheet yet.';

    const data   = sheet.getDataRange().getValues();
    const labels = data[0].map(h => String(h).trim());
    const rows   = data.slice(1).filter(r => r.some(c => c !== ''));
    if (!rows.length) return 'No submissions yet.';

    // Build label→field reverse map for lookup
    const labelToField = {};
    FIELD_MAP.forEach(({ field, label }) => { labelToField[label] = field; });

    function col(r, fieldName) {
      // find by field name via label
      const lbl = FIELD_MAP.find(f => f.field === fieldName)?.label;
      if (!lbl) return '';
      const i = labels.indexOf(lbl);
      return i >= 0 ? String(r[i]).trim() : '';
    }
    function num(r, fieldName) { return parseInt(col(r, fieldName)) || 0; }

    let totalPupils=0, totalITN=0, totalBoys=0, totalGirls=0,
        totalBoysITN=0, totalGirlsITN=0, totalReceived=0, totalRemaining=0;
    const byDistrict={}, byChiefdom={}, bySubmitter={};
    const schoolLines=[];

    rows.forEach((row, idx) => {
      const tp  = num(row,'total_pupils'),    ti  = num(row,'total_itn');
      const tb  = num(row,'total_boys'),      tg  = num(row,'total_girls');
      const tbi = num(row,'total_boys_itn'),  tgi = num(row,'total_girls_itn');
      const rec = num(row,'itns_received'),   rem = num(row,'itns_remaining');
      const cov = num(row,'coverage_total');
      const dist   = col(row,'district')    || 'Unknown';
      const chief  = col(row,'chiefdom')    || 'Unknown';
      const subBy  = col(row,'submitted_by')|| 'Unknown';
      const school = col(row,'school_name') || '—';
      const comm   = col(row,'community')   || '—';
      const sDate  = col(row,'distribution_date') || '—';
      const itnTypes = [
        col(row,'itn_type_pbo')==='Yes'?'PBO':'',
        col(row,'itn_type_ig2')==='Yes'?'IG2':''
      ].filter(Boolean).join(',') || '—';

      totalPupils   += tp; totalITN      += ti;
      totalBoys     += tb; totalGirls    += tg;
      totalBoysITN  += tbi; totalGirlsITN+= tgi;
      totalReceived += rec; totalRemaining+= rem;

      if (!byDistrict[dist]) byDistrict[dist] = {schools:0,pupils:0,itn:0,received:0};
      byDistrict[dist].schools++; byDistrict[dist].pupils+=tp;
      byDistrict[dist].itn+=ti;  byDistrict[dist].received+=rec;

      const ck = dist+'/'+chief;
      if (!byChiefdom[ck]) byChiefdom[ck] = {schools:0,pupils:0,itn:0};
      byChiefdom[ck].schools++; byChiefdom[ck].pupils+=tp; byChiefdom[ck].itn+=ti;

      if (!bySubmitter[subBy]) bySubmitter[subBy] = {count:0,pupils:0,itn:0};
      bySubmitter[subBy].count++; bySubmitter[subBy].pupils+=tp; bySubmitter[subBy].itn+=ti;

      const cLine = [1,2,3,4,5].map(c => {
        const cb =num(row,'c'+c+'_boys'),   cg =num(row,'c'+c+'_girls');
        const cbi=num(row,'c'+c+'_boys_itn'),cgi=num(row,'c'+c+'_girls_itn');
        return 'C'+c+':'+cb+'B/'+cg+'G('+cbi+'/'+cgi+'ITN)';
      }).join(' ');

      schoolLines.push(
        '[' + (idx+1) + '] ' + school + ' | ' + comm + ', ' + chief + ', ' + dist + '\n' +
        '    Date:'+sDate+' | SubmittedBy:'+subBy+' | Types:'+itnTypes+'\n' +
        '    Pupils:'+tp+'('+tb+'B/'+tg+'G) | Received:'+rec+' | Distributed:'+ti+' | Remaining:'+rem+' | Coverage:'+cov+'%\n' +
        '    BoysITN:'+tbi+'('+num(row,'coverage_boys')+'%) GirlsITN:'+tgi+'('+num(row,'coverage_girls')+'%)\n' +
        '    ' + cLine
      );
    });

    const ov  = totalPupils>0 ? Math.round((totalITN/totalPupils)*100) : 0;
    const bc  = totalBoys>0   ? Math.round((totalBoysITN/totalBoys)*100) : 0;
    const gc  = totalGirls>0  ? Math.round((totalGirlsITN/totalGirls)*100) : 0;
    const avg = rows.length>0 ? Math.round(totalPupils/rows.length) : 0;

    let out = '=== ICF-SL ITN DISTRIBUTION — GOOGLE SHEET DATA (' + new Date().toLocaleDateString() + ') ===\n\n';
    out += 'TOTALS\n';
    out += '  Schools submitted : ' + rows.length + '\n';
    out += '  Avg enrollment    : ' + avg + ' pupils/school\n';
    out += '  Total pupils      : ' + totalPupils + ' (Boys:' + totalBoys + ' Girls:' + totalGirls + ')\n';
    out += '  ITNs received     : ' + totalReceived + '\n';
    out += '  ITNs distributed  : ' + totalITN + '\n';
    out += '  ITNs remaining    : ' + totalRemaining + '\n';
    out += '  Overall coverage  : ' + ov + '%\n';
    out += '  Boys coverage     : ' + bc + '%\n';
    out += '  Girls coverage    : ' + gc + '%\n\n';

    out += 'BY SUBMITTER\n';
    Object.entries(bySubmitter)
      .sort((a,b) => b[1].count - a[1].count)
      .forEach(([name,v]) => {
        out += '  '+name+': '+v.count+' schools, '+v.pupils+' pupils, '+(v.pupils>0?Math.round((v.itn/v.pupils)*100):0)+'% coverage\n';
      });

    out += '\nBY DISTRICT\n';
    Object.entries(byDistrict)
      .sort((a,b) => b[1].schools - a[1].schools)
      .forEach(([d,v]) => {
        const c = v.pupils>0?Math.round((v.itn/v.pupils)*100):0;
        out += '  '+d+': '+v.schools+' schools, '+v.pupils+' pupils, '+v.received+' received, '+v.itn+' distributed, '+c+'% coverage\n';
      });

    out += '\nBY CHIEFDOM\n';
    Object.entries(byChiefdom)
      .sort((a,b) => b[1].schools - a[1].schools)
      .forEach(([ck,v]) => {
        const c = v.pupils>0?Math.round((v.itn/v.pupils)*100):0;
        out += '  '+ck+': '+v.schools+' schools, '+v.pupils+' pupils, '+c+'% coverage\n';
      });

    out += '\nALL SCHOOL RECORDS\n' + schoolLines.join('\n');
    return out;

  } catch(e) {
    return 'Error reading sheet: ' + e.message;
  }
}


// ================================================================
// PHU RECEIPT HANDLERS — itn_received.html + itn_reconciliation
// ================================================================

function handlePHUReceipt(data) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    let sheet   = ss.getSheetByName(CONFIG.SHEET_NAME_PHU);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME_PHU);
      const headers = [
        'Receipt ID','Dispatch ID','Confirmed At','Confirmed Date','Confirmed Time',
        'District','Chiefdom','PHU',
        'DMS Staff','Driver Name','Driver Username','Vehicle Plate','Dispatch Date',
        'Expected IG2','Expected PBO','Expected Total',
        'Received IG2','Received PBO','Received Total',
        'Variance','Quantity Match',
        'Discrepancy Reason','Discrepancy Notes',
        'PHU Staff Name','PHU Staff Username',
        'Driver Confirmed','Driver Held Accountable'
      ];
      sheet.appendRow(headers);
      const hdr = sheet.getRange(1, 1, 1, headers.length);
      hdr.setBackground('#004080').setFontColor('#ffffff')
         .setFontWeight('bold').setFontFamily('Arial');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      data.id                    || '',
      data.dispatchId            || '',
      data.confirmedAt           || new Date().toISOString(),
      data.confirmedDate         || '',
      data.confirmedTime         || '',
      data.district              || '',
      data.chiefdom              || '',
      data.phu                   || '',
      data.dmsStaff              || '',
      data.driverName            || '',
      data.driverUsername        || '',
      data.vehiclePlate          || '',
      data.dispatchDate          || '',
      parseInt(data.expectedIG2) || 0,
      parseInt(data.expectedPBO) || 0,
      parseInt(data.expectedTotal)|| 0,
      parseInt(data.receivedIG2) || 0,
      parseInt(data.receivedPBO) || 0,
      parseInt(data.receivedTotal)|| 0,
      parseInt(data.variance)    || 0,
      data.quantityMatch         ? 'Yes' : 'No',
      data.discrepancyReason     || '',
      data.discrepancyNotes      || '',
      data.phuStaffName          || '',
      data.phuStaffUsername      || '',
      data.driverConfirmed       ? 'Yes' : 'No',
      data.driverHeldAccountable ? 'Yes' : 'No'
    ]);

    return jsonResponse({ success: true, id: data.id });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function getPHUReceipts() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME_PHU);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data    = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

    return data.map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      // Friendly keys for reconciliation matching
      obj.district      = (obj['District']       || '').trim();
      obj.chiefdom      = (obj['Chiefdom']        || '').trim();
      obj.phu           = (obj['PHU']             || '').trim();
      obj.receivedTotal = parseInt(obj['Received Total']) || 0;
      obj.expectedTotal = parseInt(obj['Expected Total']) || 0;
      obj.variance      = parseInt(obj['Variance'])       || 0;
      obj.quantityMatch = obj['Quantity Match'] === 'Yes';
      return obj;
    });
  } catch (err) {
    return [];
  }
}

// ================================================================
// GET SINGLE DISPATCH BY ID — used by itn_received.html for
// QR verification and manual dispatch ID lookup
// ================================================================
function handleAssessmentGrade(data) {
  try {
    const ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const name  = 'Assessment Grades';
    let sheet   = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(['Timestamp','Name','Role','Score %','Correct','Total','Time Used','Result','Timed Out','Date/Time']);
      sheet.getRange(1,1,1,10).setFontWeight('bold').setBackground('#004080').setFontColor('#ffffff');
    }
    sheet.appendRow([
      new Date(),
      data.name        || '',
      data.role        || '',
      data.pct         || 0,
      data.correct     || 0,
      data.total       || 50,
      data.timeUsed    || '',
      data.pass ? 'PASS' : 'FAIL',
      data.timedOut ? 'Yes' : 'No',
      data.datetime    || ''
    ]);
    return jsonResponse({ status: 'ok' });
  } catch(e) {
    return jsonResponse({ status: 'error', message: e.toString() });
  }
}

function getDispatchById(dispatchId) {
  if (!dispatchId) return { error: 'No dispatch ID provided' };

  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME_ITN);
    if (!sheet || sheet.getLastRow() < 2) return { error: 'ITN Movement sheet not found or empty' };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data    = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

    // Find the row where Dispatch ID matches
    const idIdx = headers.findIndex(h => h.toString().toLowerCase().replace(/\s/g,'_') === 'dispatch_id'
                                      || h.toString() === 'Dispatch ID');

    for (const row of data) {
      const rowId = (row[idIdx] || '').toString().trim().toUpperCase();
      if (rowId === dispatchId.trim().toUpperCase()) {
        // Build object from headers
        const obj = {};
        headers.forEach((h, i) => {
          const key = h.toString().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
          obj[key] = row[i];
        });
        // Friendly field aliases for itn_received.html
        obj.dispatch_id      = obj.dispatch_id    || dispatchId;
        obj.district         = obj.destination_district || obj.district || '';
        obj.chiefdom         = obj.chiefdom        || '';
        obj.phu              = obj.health_facility_phu || obj.phu || '';
        obj.ig2_qty          = parseInt(obj.ig2_itns)   || parseInt(obj.ig2_qty) || 0;
        obj.pbo_qty          = parseInt(obj.pbo_itns)   || parseInt(obj.pbo_qty) || 0;
        obj.total_qty        = parseInt(obj.total_itns) || parseInt(obj.total_qty) || 0;
        obj.driver_name      = obj.driver_name     || obj.conveyor_name || '';
        obj.driver_username  = obj.driver_username || obj.conveyor_username || '';
        obj.vehicle          = obj.vehicle_plate   || obj.vehicle || '';
        return obj;
      }
    }

    return { error: 'Dispatch ID not found: ' + dispatchId };

  } catch(err) {
    return { error: err.message };
  }
}
