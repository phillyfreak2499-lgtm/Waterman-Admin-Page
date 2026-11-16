/* Nightly refresh for the Ops Deck.
 *
 * Sign-in is a store name (or an open Company / Admin view) kept on the device.
 * There is no server session to revoke. At 9:00 PM America/Chicago every open
 * session ends, and the next sign-in looks at the previous Chicago calendar day.
 *
 * CST and CDT both come from the time zone. 9:00 PM is never inside the
 * 2:00 AM clock change, so the cutoff is a single instant on every date.
 *
 * This file has no DOM. The page loads it, and `node --test nightly.test.js`
 * loads the same functions.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Nightly = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var CHICAGO_TZ = "America/Chicago";
  var LOGOUT_HOUR = 21;

  /* The five boxes on a trading day, in the order the deck already runs them.
     Sunday is not a trading day. Saturday also expects the Weekly Training Recap
     when the caller can actually see form responses. The supply order is due
     the first Thursday of the sales period, and only that day. */
  var DAILY_FIVE = [
    { id: "opening", label: "Opening checklist" },
    { id: "bankAM",  label: "Banking — morning" },
    { id: "eod",     label: "End of day form" },
    { id: "closing", label: "Closing checklist" },
    { id: "bankPM",  label: "Banking — afternoon" }
  ];

  function pad(n) { return String(n).padStart(2, "0"); }

  function chicagoParts(date) {
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: CHICAGO_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    var bag = {};
    fmt.formatToParts(date).forEach(function (p) {
      if (p.type !== "literal") bag[p.type] = p.value;
    });
    var hour = Number(bag.hour);
    if (hour === 24) hour = 0;
    return {
      year: Number(bag.year),
      month: Number(bag.month),
      day: Number(bag.day),
      hour: hour,
      minute: Number(bag.minute),
      second: Number(bag.second)
    };
  }

  function chicagoISO(date) {
    var p = chicagoParts(date);
    return p.year + "-" + pad(p.month) + "-" + pad(p.day);
  }

  function addDaysISO(iso, days) {
    var parts = String(iso).split("-").map(Number);
    var dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.getUTCFullYear() + "-" + pad(dt.getUTCMonth() + 1) + "-" + pad(dt.getUTCDate());
  }

  function previousChicagoDay(now) {
    return addDaysISO(chicagoISO(now), -1);
  }

  function weekdayOfISO(iso) {
    var parts = String(iso).split("-").map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
  }

  /* Wall-clock time in Chicago, as a UTC instant. */
  function zonedTimeToUtc(year, month, day, hour, minute, second) {
    var utc = Date.UTC(year, month - 1, day, hour, minute || 0, second || 0);
    for (var i = 0; i < 4; i++) {
      var p = chicagoParts(new Date(utc));
      var got = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
      var want = Date.UTC(year, month - 1, day, hour, minute || 0, second || 0);
      if (got === want) return new Date(utc);
      utc += want - got;
    }
    return new Date(utc);
  }

  /* First 9:00:00 PM Chicago strictly after the session started.
     A sign-in at 9:00:00 PM itself lasts until 9:00 PM the next day.
     A session still open at 9:00:00 PM is already over. */
  function cutoffForSession(startedAt) {
    var start = startedAt instanceof Date ? startedAt : new Date(startedAt);
    if (isNaN(start.getTime())) return new Date(NaN);
    var p = chicagoParts(start);
    var candidate = zonedTimeToUtc(p.year, p.month, p.day, LOGOUT_HOUR, 0, 0);
    if (candidate.getTime() <= start.getTime()) {
      var next = addDaysISO(p.year + "-" + pad(p.month) + "-" + pad(p.day), 1);
      var n = next.split("-").map(Number);
      candidate = zonedTimeToUtc(n[0], n[1], n[2], LOGOUT_HOUR, 0, 0);
    }
    return candidate;
  }

  function sessionExpired(now, startedAt) {
    if (!startedAt) return true;
    var n = now instanceof Date ? now : new Date(now);
    var start = startedAt instanceof Date ? startedAt : new Date(startedAt);
    if (isNaN(n.getTime()) || isNaN(start.getTime())) return true;
    return n.getTime() >= cutoffForSession(start).getTime();
  }

  function msUntilCutoff(now, startedAt) {
    var n = now instanceof Date ? now : new Date(now);
    return cutoffForSession(startedAt).getTime() - n.getTime();
  }

  function firstThursdayISO(startISO) {
    var parts = String(startISO).split("-").map(Number);
    var dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    dt.setUTCDate(dt.getUTCDate() + ((4 - dt.getUTCDay() + 7) % 7));
    return dt.getUTCFullYear() + "-" + pad(dt.getUTCMonth() + 1) + "-" + pad(dt.getUTCDate());
  }

  function supplyDueOn(iso, periodStartISO) {
    if (!iso || !periodStartISO) return false;
    return iso === firstThursdayISO(periodStartISO);
  }

  function requiredItemsForDay(iso, options) {
    var opts = options || {};
    if (weekdayOfISO(iso) === 0) return [];
    var items = DAILY_FIVE.map(function (item) { return { id: item.id, label: item.label }; });
    if (weekdayOfISO(iso) === 6 && opts.includeWorkshop) {
      items.push({ id: "workshop", label: "Weekly Training Recap" });
    }
    if (opts.supplyDue) items.push({ id: "supply", label: "Supply Order" });
    return items;
  }

  function recordedDone(recorded, id) {
    if (!recorded) return false;
    var rec = recorded[id];
    return !!rec;
  }

  /* Fold local ticks, the shared tick log, and form responses into one map.
     A missing source (the request failed) leaves the other sources in place. */
  function mergeRecorded(local, tickStore, formStore) {
    var done = {};
    [local, tickStore, formStore].forEach(function (src) {
      if (!src) return;
      Object.keys(src).forEach(function (id) {
        if (src[id]) done[id] = true;
      });
    });
    return done;
  }

  /* Supply is posted to the shared log on the period start date, not on the
     Thursday it is due. Any one of these records means it was submitted. */
  function supplyIsRecorded(localDone, dayStore, periodStartStore) {
    return !!(localDone
      || (dayStore && dayStore.supply)
      || (periodStartStore && periodStartStore.supply));
  }

  /* `recorded` is a map of task id -> anything truthy (a tick or a form row).
     Options:
       includeWorkshop — Saturday recap, only when form responses were readable
       supplyDue / supplyDone — first Thursday of the period */
  function missedItems(iso, recorded, options) {
    var opts = options || {};
    return requiredItemsForDay(iso, opts).filter(function (item) {
      if (item.id === "supply") return !opts.supplyDone;
      return !recordedDone(recorded, item.id);
    });
  }

  /* District is the only DM identity the deck stores. No person's name. */
  function dmMessage(district, count) {
    var who = district
      ? "your DM, the " + district + " district manager,"
      : "your DM";
    var why = count === 1 ? "why you missed it" : "why you missed them";
    return "Message " + who + " and explain " + why + ". This deck does not send that message for you.";
  }

  return {
    CHICAGO_TZ: CHICAGO_TZ,
    LOGOUT_HOUR: LOGOUT_HOUR,
    DAILY_FIVE: DAILY_FIVE,
    chicagoParts: chicagoParts,
    chicagoISO: chicagoISO,
    addDaysISO: addDaysISO,
    previousChicagoDay: previousChicagoDay,
    weekdayOfISO: weekdayOfISO,
    zonedTimeToUtc: zonedTimeToUtc,
    cutoffForSession: cutoffForSession,
    sessionExpired: sessionExpired,
    msUntilCutoff: msUntilCutoff,
    firstThursdayISO: firstThursdayISO,
    supplyDueOn: supplyDueOn,
    requiredItemsForDay: requiredItemsForDay,
    missedItems: missedItems,
    mergeRecorded: mergeRecorded,
    supplyIsRecorded: supplyIsRecorded,
    dmMessage: dmMessage
  };
});
