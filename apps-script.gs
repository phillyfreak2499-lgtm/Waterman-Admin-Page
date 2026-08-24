/**
 * Waterman Ops Deck — shared backend
 * ---------------------------------------------------------------------------
 * One Apps Script web app behind the whole deck. It does five jobs:
 *
 *   1. Tick log      — which store ticked which task, when, and who ticked it.
 *   2. Settings      — module links and options the Admin page saves, so a new
 *                      workbook reaches all eleven stores without a redeploy.
 *   3. Schedule      — reads the Work Schedule workbook and hands the deck the
 *                      current periods, so nobody has to rebuild the site.
 *   4. Pace          — reads the EOD workbook's Dashboard tab for sales vs goal.
 *   5. Form truth    — reads the Google Form response sheets, so opening/closing/
 *                      workshop are scored on real submissions, not on ticks.
 *
 * Plus a nudge: a timed email listing stores that have ticked nothing yet.
 *
 * SETUP (once)
 *  1. Create a Google Sheet. Name it "Ops Deck Log" or similar.
 *  2. Extensions > Apps Script. Delete the placeholder, paste this file in.
 *  3. Save, then Deploy > New deployment > Web app.
 *       Execute as:     Me
 *       Who has access: Anyone
 *     "Anyone" is required — store tablets are not signed in to Google.
 *  4. Copy the deployment URL (ends in /exec) into CONFIG.sync.url in index.html.
 *  5. Run installNudges() once from the editor to switch the reminder emails on.
 *     It will ask for permission the first time; that is expected.
 *
 * Changing this file later: Deploy > Manage deployments > edit > New version, so
 * the URL stays the same and the site needs no change.
 * ---------------------------------------------------------------------------
 */

var TICKS_NAME    = 'Ticks';
var SETTINGS_NAME = 'Settings';

var STORES = ['Waxahachie','Arlington','Southlake','Alliance','Fort Worth',
              'Plano','Rockwall','Temple','Allen','College Station','Waco'];

var TASK_IDS = ['opening','bankAM','eod','closing','bankPM'];

/* Store names as they appear in the schedule workbook, mapped to ours. */
var STORE_ALIASES = {
  'Alliance- FW': 'Alliance', 'Alliance-FW': 'Alliance', 'Alliance': 'Alliance',
  'College S': 'College Station', 'College Station': 'College Station',
  'Ft. Worth': 'Fort Worth', 'Fort Worth': 'Fort Worth',
  'Rocwall': 'Rockwall', 'Rockwall': 'Rockwall'
};

// ---------------------------------------------------------------- utilities

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function tab_(name, header) {
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

function ticksSheet_()    { return tab_(TICKS_NAME, ['Recorded','Date','Store','Task','Label','By','Action']); }
function settingsSheet_() { return tab_(SETTINGS_NAME, ['Updated','Key','Value','By']); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isoDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Latest row per key wins, so the sheet doubles as a change history. */
function settings_() {
  var rows = settingsSheet_().getDataRange().getValues();
  var out = {};
  for (var i = 1; i < rows.length; i++) {
    var k = String(rows[i][1]);
    var v = String(rows[i][2]);
    if (!k) continue;
    if (v) out[k] = v; else delete out[k];
  }
  return out;
}

function setting_(key, fallback) {
  var s = settings_();
  return s[key] || fallback || '';
}

/** Pull a spreadsheet id out of any Google Sheets URL. */
function sheetIdFrom_(url) {
  if (!url) return '';
  var m = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : '';
}

function canonStore_(name) {
  var n = String(name || '').trim();
  if (STORE_ALIASES[n]) return STORE_ALIASES[n];
  for (var i = 0; i < STORES.length; i++) {
    if (STORES[i].toLowerCase() === n.toLowerCase()) return STORES[i];
    // Banking tabs look like "Ft. Worth 421" — match on the leading name.
    if (n.toLowerCase().indexOf(STORES[i].toLowerCase()) === 0) return STORES[i];
  }
  return n;
}

// ---------------------------------------------------------------- writes

/**
 * A tablet ticked something, or the Admin page saved settings.
 */
function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents);

    if (b.kind === 'settings' || b.kind === 'links') {
      var map = b.settings || {};
      if (b.kind === 'links') {                 // older payload shape
        map = {};
        var links = b.links || {};
        Object.keys(links).forEach(function (k) { map['link.' + k] = links[k]; });
      }
      var sh = settingsSheet_();
      var now = new Date();
      Object.keys(map).forEach(function (k) {
        sh.appendRow([now, String(k), String(map[k] === null ? '' : map[k]), String(b.by || '')]);
      });
      return json_({ ok: true, settings: settings_() });
    }

    if (!b.date || !b.store || !b.task) {
      return json_({ ok: false, error: 'date, store and task are required' });
    }
    ticksSheet_().appendRow([
      new Date(), String(b.date), String(b.store), String(b.task),
      String(b.label || ''), String(b.by || ''),
      b.action === 'clear' ? 'clear' : 'set'
    ]);
    return json_({ ok: true });

  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---------------------------------------------------------------- reads

/**
 *   ?settings=1                     -> { settings: { key: value } }
 *   ?links=1                        -> { links: { module: url } }   (compatibility)
 *   ?date=YYYY-MM-DD                -> { stores: { Store: { task: {at,by} } } }
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD  -> { days: { date: { Store: {...} } } }
 *   ?schedule=1                     -> { periods: { n: { weeks: [...] } } }
 *   ?pace=1                         -> { company: {...}, stores: { Store: {...} } }
 *   ?forms=1&from=&to=              -> { days: { date: { Store: { task: {at,by} } } } }
 */
function doGet(e) {
  try {
    var pr = (e && e.parameter) || {};

    if (pr.settings) return json_({ ok: true, settings: settings_() });

    if (pr.links) {
      var s = settings_(), links = {};
      Object.keys(s).forEach(function (k) {
        if (k.indexOf('link.') === 0) links[k.substring(5)] = s[k];
      });
      return json_({ ok: true, links: links });
    }

    if (pr.schedule) return json_(readSchedule_());
    if (pr.pace)     return json_(readPace_());
    if (pr.forms)    return json_(readForms_(pr.from || '', pr.to || ''));

    var date = pr.date || '', from = pr.from || '', to = pr.to || '';
    if (!date && !(from && to)) return json_({ ok: false, error: 'pass date, or from and to' });

    var rows = ticksSheet_().getDataRange().getValues();
    var days = {};
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i], d = String(r[1]);
      if (date) { if (d !== date) continue; }
      else if (d < from || d > to) continue;

      var store = String(r[2]), task = String(r[3]);
      if (!days[d]) days[d] = {};
      if (!days[d][store]) days[d][store] = {};
      if (String(r[6]) === 'clear') {
        delete days[d][store][task];
      } else {
        days[d][store][task] = {
          at: (r[0] instanceof Date) ? r[0].toISOString() : String(r[0]),
          by: String(r[5] || '')
        };
      }
    }
    if (date) return json_({ ok: true, date: date, stores: days[date] || {} });
    return json_({ ok: true, from: from, to: to, days: days });

  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---------------------------------------------------------------- schedule

/**
 * Reads the Work Schedule workbook and returns the same shape the deck used to
 * carry baked in. Only the current period and its neighbours are returned, so a
 * tablet is not downloading the whole year.
 */
function readSchedule_() {
  var id = sheetIdFrom_(setting_('link.schedule', ''));
  if (!id) return { ok: false, error: 'no schedule link saved in Admin' };

  var book = SpreadsheetApp.openById(id);
  var sheets = book.getSheets();
  var periods = {};
  var today = isoDate_(new Date());

  for (var s = 0; s < sheets.length; s++) {
    var name = sheets[s].getName();
    var m = name.match(/Period\s*(\d+)/i);
    if (!m) continue;

    var rows = sheets[s].getDataRange().getValues();
    var weeks = [];

    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() !== 'Date:') continue;

      var days = [];
      for (var c = 1; c <= 7; c++) {
        var cell = rows[i][c];
        if (cell instanceof Date) {
          days.push({ d: isoDate_(cell), label: '' });
        } else if (cell) {
          var txt = String(cell).trim();
          var dm = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
          if (dm) {
            var yy = parseInt(dm[3], 10); if (yy < 100) yy += 2000;
            var iso = yy + '-' + ('0' + dm[1]).slice(-2) + '-' + ('0' + dm[2]).slice(-2);
            days.push({ d: iso, label: txt.substring(0, dm.index).trim() });
          } else {
            days.push({ d: '', label: txt });
          }
        } else {
          days.push({ d: '', label: '' });
        }
      }

      var stores = {};
      for (var j = i + 1; j < rows.length; j++) {
        var label = String(rows[j][0]).trim();
        if (!label || label === 'Date:') break;
        var key = canonStore_(label);
        if (STORES.indexOf(key) < 0) continue;

        var shifts = [], notes = [];
        for (var k = 1; k <= 7; k++) shifts.push(String(rows[j][k] == null ? '' : rows[j][k]).trim());
        for (var n = 8; n < rows[j].length; n++) {
          var t = String(rows[j][n] == null ? '' : rows[j][n]).trim();
          if (t) notes.push(t);
        }
        stores[key] = { shifts: shifts, notes: notes };
      }
      if (Object.keys(stores).length) weeks.push({ days: days, stores: stores });
    }
    if (weeks.length) periods[m[1]] = { weeks: weeks };
  }

  // Keep the period containing today, plus the one either side of it.
  var keys = Object.keys(periods).sort(function (a, b) { return a - b; });
  var currentIdx = -1;
  for (var p = 0; p < keys.length; p++) {
    var wks = periods[keys[p]].weeks;
    for (var w = 0; w < wks.length; w++) {
      for (var dd = 0; dd < wks[w].days.length; dd++) {
        if (wks[w].days[dd].d === today) { currentIdx = p; break; }
      }
    }
  }
  if (currentIdx < 0) currentIdx = keys.length - 1;

  var keep = {};
  [currentIdx - 1, currentIdx, currentIdx + 1].forEach(function (idx) {
    if (idx >= 0 && idx < keys.length) keep[keys[idx]] = periods[keys[idx]];
  });

  return { ok: true, periods: keep };
}

// ---------------------------------------------------------------- pace

/**
 * Reads the Dashboard tab of the EOD workbook. Column positions are found by
 * header text rather than assumed, so the workbook can move columns around
 * without silently returning wrong numbers.
 */
function readPace_() {
  var id = sheetIdFrom_(setting_('link.eod', ''));
  if (!id) return { ok: false, error: 'no EOD link saved in Admin' };

  var book = SpreadsheetApp.openById(id);
  var sh = book.getSheetByName('Dashboard');
  if (!sh) return { ok: false, error: 'no Dashboard tab in the EOD workbook' };

  var rows = sh.getDataRange().getValues();
  var hdr = -1, col = {};

  for (var i = 0; i < rows.length; i++) {
    var joined = rows[i].map(function (c) { return String(c).toLowerCase(); });
    if (joined.indexOf('store') >= 0 && joined.join('|').indexOf('current sales') >= 0) {
      hdr = i;
      for (var c2 = 0; c2 < joined.length; c2++) {
        var h = joined[c2];
        if (h === 'store') col.store = c2;
        else if (h.indexOf('current sales') >= 0) col.sales = c2;
        else if (h.indexOf('store goal') >= 0) col.goal = c2;
        else if (h.indexOf('daily needed') >= 0) col.needed = c2;
        else if (h.indexOf('pace variance') >= 0) col.variance = c2;
      }
      break;
    }
  }
  if (hdr < 0 || col.store == null) return { ok: false, error: 'could not find the Dashboard header row' };

  var stores = {}, totalSales = 0, totalGoal = 0;
  for (var r = hdr + 1; r < rows.length; r++) {
    var nm = canonStore_(rows[r][col.store]);
    if (STORES.indexOf(nm) < 0) continue;
    var sales = Number(rows[r][col.sales]) || 0;
    var goal  = Number(rows[r][col.goal]) || 0;
    stores[nm] = {
      sales: sales,
      goal: goal,
      pct: goal ? sales / goal : 0,
      needed: col.needed != null ? (Number(rows[r][col.needed]) || 0) : 0,
      variance: col.variance != null ? (Number(rows[r][col.variance]) || 0) : 0
    };
    totalSales += sales; totalGoal += goal;
  }

  // Selling-day counters sit above the table as label/value pairs.
  var totalDays = 0, doneDays = 0;
  for (var q = 0; q < Math.min(hdr, rows.length); q++) {
    var lab = String(rows[q][0]).toLowerCase();
    if (lab.indexOf('total selling days') >= 0) totalDays = Number(rows[q][1]) || 0;
    if (lab.indexOf('days completed') >= 0)     doneDays  = Number(rows[q][1]) || 0;
  }

  return {
    ok: true,
    company: {
      sales: totalSales, goal: totalGoal,
      pct: totalGoal ? totalSales / totalGoal : 0,
      totalDays: totalDays, doneDays: doneDays,
      expectedPct: totalDays ? doneDays / totalDays : 0
    },
    stores: stores
  };
}

// ---------------------------------------------------------------- form truth

/**
 * Opening, closing and workshop already produce a row in a Form response sheet.
 * That row is the real record of submission; a tick is only a convenience. Save
 * the response sheet URLs in Admin and the company view scores those three on
 * actual submissions.
 */
function readForms_(from, to) {
  var map = { opening: 'resp.opening', closing: 'resp.closing', workshop: 'resp.workshop' };
  var days = {}, used = [];

  Object.keys(map).forEach(function (task) {
    var id = sheetIdFrom_(setting_(map[task], ''));
    if (!id) return;
    used.push(task);

    var sh = SpreadsheetApp.openById(id).getSheets()[0];
    var rows = sh.getDataRange().getValues();
    if (!rows.length) return;

    var head = rows[0].map(function (c) { return String(c).toLowerCase(); });
    var cTime = 0;                                   // Forms always stamps column A
    var cStore = -1, cName = -1, cDate = -1;
    for (var i = 0; i < head.length; i++) {
      if (cStore < 0 && head[i].indexOf('store') >= 0) cStore = i;
      if (cName  < 0 && head[i].indexOf('name')  >= 0 && head[i].indexOf('store') < 0) cName = i;
      if (cDate  < 0 && head[i] === 'date') cDate = i;
    }
    if (cStore < 0) return;

    for (var r = 1; r < rows.length; r++) {
      var stamp = rows[r][cTime];
      var when = (stamp instanceof Date) ? stamp : new Date(stamp);
      if (isNaN(when.getTime())) continue;

      var d = (cDate >= 0 && rows[r][cDate] instanceof Date)
        ? isoDate_(rows[r][cDate])
        : isoDate_(when);
      if (from && (d < from || d > to)) continue;

      var store = canonStore_(rows[r][cStore]);
      if (STORES.indexOf(store) < 0) continue;

      if (!days[d]) days[d] = {};
      if (!days[d][store]) days[d][store] = {};
      days[d][store][task] = {
        at: when.toISOString(),
        by: cName >= 0 ? String(rows[r][cName] || '') : '',
        src: 'form'
      };
    }
  });

  return { ok: true, tasks: used, days: days };
}

// ---------------------------------------------------------------- nudges

/**
 * Run once from the editor to switch the reminder emails on. Safe to re-run —
 * it clears its own triggers first.
 */
function installNudges() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'nudgeMorning' || fn === 'nudgeEvening') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('nudgeMorning').timeBased().atHour(11).everyDays(1).create();
  ScriptApp.newTrigger('nudgeEvening').timeBased().atHour(19).everyDays(1).create();
  return 'Nudges installed for 11am and 7pm.';
}

function removeNudges() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'nudgeMorning' || fn === 'nudgeEvening') ScriptApp.deleteTrigger(t);
  });
  return 'Nudges removed.';
}

function nudgeMorning() { sendNudge_('morning', ['opening', 'bankAM']); }
function nudgeEvening() { sendNudge_('evening', ['closing', 'bankPM', 'eod']); }

function sendNudge_(which, tasks) {
  var to = setting_('nudge.to', '');
  if (!to) return;                                   // nobody configured — stay quiet

  var day = new Date();
  if (day.getDay() === 0) return;                    // stores are shut on Sunday
  var iso = isoDate_(day);

  var rows = ticksSheet_().getDataRange().getValues();
  var have = {};
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== iso) continue;
    var st = String(rows[i][2]), tk = String(rows[i][3]);
    if (!have[st]) have[st] = {};
    if (String(rows[i][6]) === 'clear') delete have[st][tk]; else have[st][tk] = true;
  }

  var missing = [];
  STORES.forEach(function (s) {
    var gaps = tasks.filter(function (t) { return !(have[s] && have[s][t]); });
    if (gaps.length) missing.push(s + ' — ' + gaps.join(', '));
  });

  if (!missing.length) {
    MailApp.sendEmail(to, 'Ops Deck: all clear (' + which + ')',
      'Every store has ticked its ' + which + ' tasks for ' + iso + '.');
    return;
  }

  MailApp.sendEmail(to,
    'Ops Deck: ' + missing.length + ' store' + (missing.length === 1 ? '' : 's') + ' outstanding (' + which + ')',
    'Not ticked as of the ' + which + ' check on ' + iso + ':\n\n' + missing.join('\n') +
    '\n\nA blank here means nobody marked it — not proof the work was skipped.\n');
}
