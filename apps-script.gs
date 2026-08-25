/**
 * Waterman Ops Deck — shared backend
 * ---------------------------------------------------------------------------
 * One Apps Script web app behind the whole deck. It does five jobs:
 *
 *   1. Tick log      — which store ticked which task, when, and who ticked it.
 *   1b. Notes        — what a closing shift left for whoever opens next.
 *   1c. Pushed tasks — one-off jobs a manager sends to some or all stores.
 *   2. Settings      — module links and options the Admin page saves, so a new
 *                      workbook reaches all eleven stores without a redeploy.
 *   3. Schedule      — reads the Work Schedule workbook and hands the deck the
 *                      current periods, so nobody has to rebuild the site.
 *   4. Pace          — reads the EOD workbook's Dashboard tab for sales vs goal.
 *   5. Form truth    — reads the Google Forms (or their linked response sheets), so
 *                      opening/closing/workshop are scored on real submissions rather
 *                      than on somebody ticking a box.
 *
 * Plus a nudge: a timed email showing which stores are done and which are outstanding.
 * Set "pilot.stores" in Settings (a comma-separated list) to limit it to the stores
 * actually running the pilot; leave it empty to cover all eleven.
 *
 * SETUP (once)
 *  1. Create a Google Sheet. Name it "Ops Deck Log" or similar.
 *  2. Extensions > Apps Script. Delete the placeholder, paste this file in.
 *  3. Save, then Deploy > New deployment > Web app.
 *       Execute as:     Me
 *       Who has access: Anyone
 *     "Anyone" is required — store tablets are not signed in to Google.
 *  4. Copy the deployment URL (ends in /exec) into CONFIG.sync.url in index.html.
 *  5. Run installNudges() once from the editor to switch on the reminder emails and
 *     the Monday self-check.
 *     It will ask for permission the first time; that is expected.
 *
 * Changing this file later: Deploy > Manage deployments > edit > New version, so
 * the URL stays the same and the site needs no change.
 * ---------------------------------------------------------------------------
 */

var TICKS_NAME    = 'Ticks';
var SETTINGS_NAME = 'Settings';
var NOTES_NAME    = 'Notes';
var TASKS_NAME    = 'Tasks';

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
function notesSheet_()    { return tab_(NOTES_NAME, ['Recorded','For date','Store','Note','By']); }
function tasksSheet_()    { return tab_(TASKS_NAME, ['Created','Id','Title','Detail','Scope','Due','By','Status']); }

/* ---------------------------------------------------------------------------
   CACHING
   The schedule parser walks eleven tabs of a thousand rows; the pace reader opens a
   second workbook. Neither changes more than once a day, and both were running on
   every tablet load. Cache them.
   Script cache tops out at 100KB per key, so an oversized payload is simply not cached
   rather than silently truncated.
   --------------------------------------------------------------------------- */
function cacheGet_(key) {
  try {
    var hit = CacheService.getScriptCache().get(key);
    return hit ? JSON.parse(hit) : null;
  } catch (e) { return null; }
}

function cachePut_(key, value, seconds) {
  try {
    var s = JSON.stringify(value);
    if (s.length > 95000) return;            // too big to cache — read it fresh each time
    CacheService.getScriptCache().put(key, s, seconds);
  } catch (e) {}
}

function cacheBust_() {
  try { CacheService.getScriptCache().removeAll(['schedule', 'pace']); } catch (e) {}
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isoDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Sheets silently turns "2026-08-25" into a Date when it is appended, so reading the
 * column back gives a Date object whose String() is "Tue Aug 25 2026 00:00:00 GMT…".
 * Comparing that to "2026-08-25" never matches — which made every store look untouched.
 * Normalise whatever the cell actually holds.
 */
function asISO_(v) {
  if (v instanceof Date) return isoDate_(v);
  var s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = new Date(s);
  return isNaN(d.getTime()) ? s : isoDate_(d);
}

/* ---------------------------------------------------------------------------
   READING THE LOG WITHOUT READING ALL OF IT
   Ticks are appended as they happen and never edited, so the Date column is sorted.
   Rather than pull the whole history into memory on every request — fine at six rows,
   fatal at twenty thousand — binary-search both ends of the range and read only that
   slice. On a year of data this is ~2,000 cells instead of ~140,000.

   ASSUMPTION, worth knowing: the log is *nearly* sorted. A row can only land out of
   position by as much as a device clock is wrong, because the date is written at the
   moment of the tick — hours at worst, never days.
   Measured: at eleven stores, LOOKBACK_ROWS = 250 finds a row written up to five days
   out of position, and misses one written six days late. That is a wide margin over
   anything clock skew can produce.
   What would break it is bulk-inserting or hand-reordering old rows in the sheet. Don't
   do that; append-only is what keeps this fast. Sorting by date is always safe.
   --------------------------------------------------------------------------- */
var LOOKBACK_ROWS = 250;

/** Exact first row whose date is >= iso, or lastRow+1 if there is none. */
function lowerBound_(sh, iso) {
  var last = sh.getLastRow();
  if (last < 2) return 2;
  var lo = 2, hi = last, ans = last + 1;
  while (lo <= hi) {
    var mid = Math.floor((lo + hi) / 2);
    var v = asISO_(sh.getRange(mid, 2).getValue());
    if (v >= iso) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
}

/** Kept for archiveOldTicks, which wants the padded start. */
function firstRowOnOrAfter_(sh, iso) {
  return Math.max(2, lowerBound_(sh, iso) - LOOKBACK_ROWS);
}

function nextDay_(iso) {
  var d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Rows of the tick log covering [from, to], as raw arrays.
 * Both ends are found by binary search and padded by LOOKBACK_ROWS, so a row written
 * slightly out of order still gets picked up, and a one-day query reads a few hundred
 * cells instead of the entire history.
 */
function rowsInRange_(from, to) {
  var sh = ticksSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];

  var start = Math.max(2, lowerBound_(sh, from) - LOOKBACK_ROWS);
  var end = Math.min(last, lowerBound_(sh, nextDay_(to)) - 1 + LOOKBACK_ROWS);
  if (start > end) return [];

  var values = sh.getRange(start, 1, end - start + 1, 7).getValues();
  return values.filter(function (r) {
    var d = asISO_(r[1]);
    return d >= from && d <= to;
  });
}

/** During a pilot, only nag the stores that are actually running it. */
function pilotStores_() {
  var raw = setting_('pilot.stores', '');
  if (!raw) return STORES;
  var want = raw.split(',').map(function (s) { return canonStore_(s.trim()); })
                 .filter(function (s) { return STORES.indexOf(s) >= 0; });
  return want.length ? want : STORES;
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
      cacheBust_();
      return json_({ ok: true, settings: settings_() });
    }

    /* A shift leaving a note for whoever opens next. One per store per date; the
       latest row wins, so editing it before you leave just appends another. */
    if (b.kind === 'note') {
      if (!b.date || !b.store) return json_({ ok: false, error: 'date and store are required' });
      notesSheet_().appendRow([new Date(), String(b.date), String(b.store),
                               String(b.text || ''), String(b.by || '')]);
      return json_({ ok: true });
    }

    /* A manager pushing a one-off job to some or all stores. */
    if (b.kind === 'task') {
      var id = String(b.id || ('t' + new Date().getTime()));
      tasksSheet_().appendRow([new Date(), id, String(b.title || ''), String(b.detail || ''),
                               String(b.scope || 'all'), String(b.due || ''),
                               String(b.by || ''), 'open']);
      return json_({ ok: true, id: id });
    }

    if (b.kind === 'task_close') {
      if (!b.id) return json_({ ok: false, error: 'id is required' });
      tasksSheet_().appendRow([new Date(), String(b.id), '', '', '', '', String(b.by || ''), 'closed']);
      return json_({ ok: true });
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
 *   ?notes=1&store=&from=&to=       -> { notes: [ {date, store, text, by} ] }
 *   ?tasks=1                        -> { tasks: [ {id,title,detail,scope,due,done:{}} ] }
 *   ?forms=1&from=&to=              -> { days: { date: { Store: { task: {at,by} } } } }
 *                                      resp.* may be a Form EDIT url or a linked
 *                                      responses spreadsheet url — either works.
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

    if (pr.schedule) {
      if (!pr.fresh) { var cs = cacheGet_('schedule'); if (cs) return json_(cs); }
      var sched = readSchedule_();
      if (sched.ok) cachePut_('schedule', sched, 1800);      // 30 minutes
      return json_(sched);
    }
    if (pr.pace) {
      if (!pr.fresh) { var cp = cacheGet_('pace'); if (cp) return json_(cp); }
      var pace = readPace_();
      if (pace.ok) cachePut_('pace', pace, 900);             // 15 minutes
      return json_(pace);
    }
    if (pr.forms)    return json_(readForms_(pr.from || '', pr.to || ''));
    if (pr.notes)    return json_(readNotes_(pr.store || '', pr.from || '', pr.to || ''));
    if (pr.tasks)    return json_(readTasks_());

    var date = pr.date || '', from = pr.from || '', to = pr.to || '';
    if (!date && !(from && to)) return json_({ ok: false, error: 'pass date, or from and to' });

    var lo = date || from, hi = date || to;
    var rows = rowsInRange_(lo, hi);
    var days = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], d = asISO_(r[1]);
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

// ---------------------------------------------------------------- notes

/** Latest note wins for a given store and date. */
function readNotes_(store, from, to) {
  var rows = notesSheet_().getDataRange().getValues();
  var out = {};
  for (var i = 1; i < rows.length; i++) {
    var d = asISO_(rows[i][1]);
    var s = String(rows[i][2]);
    if (store && s !== store) continue;
    if (from && (d < from || d > to)) continue;
    out[s + '|' + d] = { date: d, store: s, text: String(rows[i][3] || ''),
                         by: String(rows[i][4] || ''),
                         at: (rows[i][0] instanceof Date) ? rows[i][0].toISOString() : '' };
  }
  var list = Object.keys(out).map(function (k) { return out[k]; })
                   .filter(function (n) { return n.text; });
  return { ok: true, notes: list };
}

// ---------------------------------------------------------------- pushed tasks

/**
 * Open tasks a manager pushed out, each with the stores that have ticked it.
 * Completion lives in the ordinary tick log under the id "push:<id>", so a pushed task
 * needs no separate bookkeeping and shows up in the CSV export like anything else.
 */
function readTasks_() {
  var rows = tasksSheet_().getDataRange().getValues();
  var byId = {};
  for (var i = 1; i < rows.length; i++) {
    var id = String(rows[i][1]);
    if (!id) continue;
    var status = String(rows[i][7] || 'open');
    if (status === 'closed') { delete byId[id]; continue; }
    byId[id] = {
      id: id,
      created: (rows[i][0] instanceof Date) ? isoDate_(rows[i][0]) : asISO_(rows[i][0]),
      title: String(rows[i][2] || ''),
      detail: String(rows[i][3] || ''),
      scope: String(rows[i][4] || 'all'),
      due: String(rows[i][5] || ''),
      by: String(rows[i][6] || ''),
      done: {}
    };
  }

  var ids = Object.keys(byId);
  if (!ids.length) return { ok: true, tasks: [] };

  var earliest = ids.map(function (k) { return byId[k].created; })
                    .sort()[0] || isoDate_(new Date());
  var ticks = rowsInRange_(earliest, isoDate_(new Date()));
  ticks.forEach(function (r) {
    var task = String(r[3]);
    if (task.indexOf('push:') !== 0) return;
    var id = task.substring(5);
    if (!byId[id]) return;
    var store = String(r[2]);
    if (String(r[6]) === 'clear') delete byId[id].done[store];
    else byId[id].done[store] = {
      at: (r[0] instanceof Date) ? r[0].toISOString() : String(r[0]),
      by: String(r[5] || '')
    };
  });

  return { ok: true, tasks: ids.map(function (k) { return byId[k]; }) };
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
  var days = {}, used = [], problems = [];

  Object.keys(map).forEach(function (task) {
    var url = setting_(map[task], '');
    if (!url) return;
    try {
      var rows = url.indexOf('/forms/') >= 0
        ? fromForm_(url)          // read the form itself — no linked sheet needed
        : fromSheet_(url);        // or a linked responses spreadsheet
      if (!rows.length) { used.push(task); return; }
      used.push(task);
      rows.forEach(function (r) {
        if (from && (r.date < from || r.date > to)) return;
        if (STORES.indexOf(r.store) < 0) return;
        if (!days[r.date]) days[r.date] = {};
        if (!days[r.date][r.store]) days[r.date][r.store] = {};
        days[r.date][r.store][task] = { at: r.at, by: r.by, src: 'form' };
      });
    } catch (err) {
      problems.push(task + ': ' + String(err));
    }
  });

  return { ok: true, tasks: used, problems: problems, days: days };
}

/** A Google Form read straight from its edit URL. */
function fromForm_(url) {
  var form = FormApp.openByUrl(url);
  var items = form.getItems();
  var storeIds = {}, nameIds = {}, dateIds = {};
  items.forEach(function (it) {
    var t = it.getTitle().toLowerCase();
    if (t.indexOf('store') >= 0) storeIds[it.getId()] = true;
    else if (t.indexOf('name') >= 0) nameIds[it.getId()] = true;
    else if (t.indexOf('date') >= 0) dateIds[it.getId()] = true;
  });

  return form.getResponses().map(function (resp) {
    var ts = resp.getTimestamp();
    var store = '', by = '', stated = '';
    resp.getItemResponses().forEach(function (ir) {
      var id = ir.getItem().getId();
      var v = ir.getResponse();
      if (storeIds[id]) store = String(v);
      else if (nameIds[id]) by = String(v);
      else if (dateIds[id]) stated = String(v);
    });
    return {
      date: stated && stated.match(/^\d{4}-\d{2}-\d{2}$/) ? stated : isoDate_(ts),
      store: canonStore_(store),
      by: by,
      at: ts.toISOString()
    };
  });
}

/** A linked responses spreadsheet. */
function fromSheet_(url) {
  var id = sheetIdFrom_(url);
  if (!id) return [];
  var sh = SpreadsheetApp.openById(id).getSheets()[0];
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return [];

  var head = rows[0].map(function (c) { return String(c).toLowerCase(); });
  var cStore = -1, cName = -1, cDate = -1;
  for (var i = 0; i < head.length; i++) {
    if (cStore < 0 && head[i].indexOf('store') >= 0) cStore = i;
    if (cName < 0 && head[i].indexOf('name') >= 0 && head[i].indexOf('store') < 0) cName = i;
    if (cDate < 0 && head[i] === 'date') cDate = i;
  }
  if (cStore < 0) return [];

  var out = [];
  for (var r = 1; r < rows.length; r++) {
    var stamp = rows[r][0];
    var when = (stamp instanceof Date) ? stamp : new Date(stamp);
    if (isNaN(when.getTime())) continue;
    out.push({
      date: (cDate >= 0 && rows[r][cDate] instanceof Date) ? isoDate_(rows[r][cDate]) : isoDate_(when),
      store: canonStore_(rows[r][cStore]),
      by: cName >= 0 ? String(rows[r][cName] || '') : '',
      at: when.toISOString()
    });
  }
  return out;
}

// ---------------------------------------------------------------- nudges

/**
 * Run once from the editor to switch the reminder emails on. Safe to re-run —
 * it clears its own triggers first.
 */
var OUR_TRIGGERS = ['nudgeMorning', 'nudgeEvening', 'weeklySelfCheck'];

function installNudges() {
  removeNudges();
  ScriptApp.newTrigger('nudgeMorning').timeBased().atHour(11).everyDays(1).create();
  ScriptApp.newTrigger('nudgeEvening').timeBased().atHour(19).everyDays(1).create();
  ScriptApp.newTrigger('weeklySelfCheck').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  return 'Installed: nudges at 11am and 7pm, self-check Monday 8am.';
}

function removeNudges() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (OUR_TRIGGERS.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  return 'Removed.';
}

/* ---------------------------------------------------------------------------
   WEEKLY SELF-CHECK
   Not a compliance report. This is the thing that tells you the plumbing broke,
   in days rather than whenever somebody happens to notice. It deliberately reports
   what it FAILED to do as loudly as what it managed.
   --------------------------------------------------------------------------- */
function weeklySelfCheck() {
  var to = setting_('nudge.to', '');
  if (!to) return;

  var today = new Date();
  var end = isoDate_(today);
  var startD = new Date(today.getTime() - 6 * 86400000);
  var start = isoDate_(startD);

  var lines = [];
  lines.push('Ops Deck self-check — ' + start + ' to ' + end);
  lines.push('');

  // what landed
  var rows = [];
  var readErr = '';
  try { rows = rowsInRange_(start, end); }
  catch (e) { readErr = String(e); }

  if (readErr) {
    lines.push('COULD NOT READ THE LOG: ' + readErr);
  } else {
    var byStore = {}, byDay = {};
    rows.forEach(function (r) {
      var s = String(r[2]), d = asISO_(r[1]);
      byStore[s] = (byStore[s] || 0) + 1;
      byDay[d] = (byDay[d] || 0) + 1;
    });
    var stores = pilotStores_();
    lines.push('Ticks recorded: ' + rows.length);
    lines.push('Days with any activity: ' + Object.keys(byDay).length + ' of 7');
    lines.push('');
    lines.push('BY STORE');
    stores.forEach(function (s) {
      lines.push('  ' + s + ' — ' + (byStore[s] || 0) + (byStore[s] ? '' : '   <-- nothing all week'));
    });
    var strangers = Object.keys(byStore).filter(function (s) { return stores.indexOf(s) < 0; });
    if (strangers.length) lines.push('  Outside the pilot list: ' + strangers.join(', '));
    lines.push('');
  }

  // is everything it depends on actually readable
  lines.push('DEPENDENCIES');
  var totalRows = 0;
  try { totalRows = ticksSheet_().getLastRow() - 1; } catch (e) {}
  lines.push('  Log size: ' + totalRows + ' rows' + (totalRows > 15000 ? '   <-- consider running archiveOldTicks()' : ''));

  var checks = [
    ['Schedule workbook', function () { var r = readSchedule_(); return r.ok ? Object.keys(r.periods).length + ' periods' : r.error; }],
    ['EOD workbook (pace)', function () { var r = readPace_(); return r.ok ? Object.keys(r.stores).length + ' stores' : r.error; }],
    ['Form responses', function () {
      var r = readForms_(start, end);
      if (r.problems && r.problems.length) return 'PROBLEM — ' + r.problems.join('; ');
      if (!r.tasks.length) return 'none connected';
      return r.tasks.join(', ');
    }]
  ];
  checks.forEach(function (c) {
    var v;
    try { v = c[1](); } catch (e) { v = 'FAILED — ' + String(e); }
    lines.push('  ' + c[0] + ': ' + v);
  });

  lines.push('');
  lines.push('If a store reads zero all week, check the build number in that tablet\'s footer');
  lines.push('before assuming anyone skipped anything.');

  MailApp.sendEmail(to, 'Ops Deck self-check — ' + end, lines.join('\n'));
}

/**
 * Move ticks older than `keepMonths` to an archive tab. Run by hand, or add a monthly
 * trigger. The company view only ever looks back a month or so, so nothing is lost.
 */
function archiveOldTicks(keepMonths) {
  keepMonths = keepMonths || 6;
  var cut = new Date();
  cut.setMonth(cut.getMonth() - keepMonths);
  var cutISO = isoDate_(cut);

  var sh = ticksSheet_();
  var last = sh.getLastRow();
  if (last < 2) return 'Nothing to archive.';

  var end = firstRowOnOrAfter_(sh, cutISO) + LOOKBACK_ROWS;   // undo the safety look-back
  if (end <= 2) return 'Nothing older than ' + cutISO + '.';
  var count = Math.min(end, last + 1) - 2;
  if (count < 1) return 'Nothing older than ' + cutISO + '.';

  var arch = tab_('Ticks Archive', ['Recorded','Date','Store','Task','Label','By','Action']);
  var block = sh.getRange(2, 1, count, 7).getValues();
  arch.getRange(arch.getLastRow() + 1, 1, count, 7).setValues(block);
  sh.deleteRows(2, count);
  cacheBust_();
  return 'Archived ' + count + ' rows older than ' + cutISO + '.';
}

function nudgeMorning() { sendNudge_('morning', ['opening', 'bankAM']); }
function nudgeEvening() { sendNudge_('evening', ['closing', 'bankPM', 'eod']); }

function sendNudge_(which, tasks) {
  var to = setting_('nudge.to', '');
  if (!to) return;                                   // nobody configured — stay quiet

  var day = new Date();
  if (day.getDay() === 0) return;                    // stores are shut on Sunday
  var iso = isoDate_(day);

  var rows = rowsInRange_(iso, iso);
  var have = {};
  for (var i = 0; i < rows.length; i++) {
    var st = String(rows[i][2]), tk = String(rows[i][3]);
    if (!have[st]) have[st] = {};
    if (String(rows[i][6]) === 'clear') delete have[st][tk];
    else have[st][tk] = rows[i][0];                  // keep the time it landed
  }

  var stores = pilotStores_();
  var done = [], missing = [];

  stores.forEach(function (s) {
    var gaps = tasks.filter(function (t) { return !(have[s] && have[s][t]); });
    if (!gaps.length) {
      var times = tasks.map(function (t) {
        var when = have[s][t];
        return (when instanceof Date)
          ? Utilities.formatDate(when, Session.getScriptTimeZone(), 'h:mm a')
          : '';
      }).filter(String);
      done.push(s + (times.length ? ' — ' + times.join(', ') : ''));
    } else {
      missing.push(s + ' — still open: ' + gaps.join(', '));
    }
  });

  var label = which === 'morning' ? 'Morning check' : 'Evening check';
  var subject = missing.length
    ? 'Ops Deck: ' + missing.length + ' of ' + stores.length + ' outstanding (' + which + ')'
    : 'Ops Deck: all clear (' + which + ')';

  var body = label + ' — ' + iso + '\n';
  body += 'Covering ' + stores.length + ' store' + (stores.length === 1 ? '' : 's') + '.\n\n';

  if (done.length) {
    body += 'DONE (' + done.length + ')\n' + done.join('\n') + '\n\n';
  }
  if (missing.length) {
    body += 'OUTSTANDING (' + missing.length + ')\n' + missing.join('\n') + '\n\n';
  } else {
    body += 'Nothing outstanding.\n\n';
  }

  body += 'A store listed as outstanding means nobody ticked it — not proof the work was skipped.\n';

  MailApp.sendEmail(to, subject, body);
}
