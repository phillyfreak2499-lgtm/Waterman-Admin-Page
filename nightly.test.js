/* node --test nightly.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("./nightly.js");

test("9pm cutoff uses CDT in summer (UTC-5) and CST in winter (UTC-6)", () => {
  // 3:00 PM CDT = 20:00 UTC. Cutoff is 9:00 PM CDT = 02:00 UTC next day.
  assert.equal(
    N.cutoffForSession(new Date("2026-07-15T20:00:00.000Z")).toISOString(),
    "2026-07-16T02:00:00.000Z"
  );
  // 3:00 PM CST = 21:00 UTC. Cutoff is 9:00 PM CST = 03:00 UTC next day.
  assert.equal(
    N.cutoffForSession(new Date("2026-01-15T21:00:00.000Z")).toISOString(),
    "2026-01-16T03:00:00.000Z"
  );
});

test("cutoff follows the spring-forward and fall-back weekends", () => {
  // Saturday March 7, 2026 is still CST. 3:00 PM CST = 21:00 UTC.
  // 9:00 PM CST = 03:00 UTC Sunday.
  assert.equal(
    N.cutoffForSession(new Date("2026-03-07T21:00:00.000Z")).toISOString(),
    "2026-03-08T03:00:00.000Z"
  );
  // Sunday March 8, 2026 has already sprung forward by evening.
  // 3:00 PM CDT = 20:00 UTC. 9:00 PM CDT = 02:00 UTC Monday.
  assert.equal(
    N.cutoffForSession(new Date("2026-03-08T20:00:00.000Z")).toISOString(),
    "2026-03-09T02:00:00.000Z"
  );
  // Saturday October 31, 2026 is still CDT.
  assert.equal(
    N.cutoffForSession(new Date("2026-10-31T20:00:00.000Z")).toISOString(),
    "2026-11-01T02:00:00.000Z"
  );
  // Sunday November 1, 2026 has fallen back by evening. 9:00 PM CST.
  assert.equal(
    N.cutoffForSession(new Date("2026-11-01T21:00:00.000Z")).toISOString(),
    "2026-11-02T03:00:00.000Z"
  );
});

test("a session open at 9:00:00 PM is over, and a sign-in at that instant lasts until the next night", () => {
  const afternoon = new Date("2026-01-15T20:00:00.000Z"); // 2:00 PM CST
  const nine = new Date("2026-01-16T03:00:00.000Z");      // 9:00 PM CST
  assert.equal(N.sessionExpired(new Date(nine.getTime() - 1), afternoon), false);
  assert.equal(N.sessionExpired(nine, afternoon), true);
  assert.equal(N.sessionExpired(nine, nine), false);
  assert.equal(N.cutoffForSession(nine).toISOString(), "2026-01-17T03:00:00.000Z");
  assert.equal(N.msUntilCutoff(afternoon, afternoon), nine.getTime() - afternoon.getTime());
});

test("the same rule holds on a CDT evening", () => {
  const afternoon = new Date("2026-07-15T19:00:00.000Z"); // 2:00 PM CDT
  const nine = new Date("2026-07-16T02:00:00.000Z");      // 9:00 PM CDT
  assert.equal(N.sessionExpired(new Date(nine.getTime() - 1), afternoon), false);
  assert.equal(N.sessionExpired(nine, afternoon), true);
  assert.equal(N.sessionExpired(new Date("2026-07-16T03:00:00.000Z"), nine), false);
});

test("missing or unreadable session start counts as expired", () => {
  assert.equal(N.sessionExpired(new Date("2026-07-15T18:00:00.000Z"), null), true);
  assert.equal(N.sessionExpired(new Date("2026-07-15T18:00:00.000Z"), "not-a-date"), true);
});

test("Chicago calendar day, including just before and after local midnight", () => {
  // 9:30 PM CDT on July 15 is 02:30 UTC July 16. Previous Chicago day is July 14.
  assert.equal(N.chicagoISO(new Date("2026-07-16T02:30:00.000Z")), "2026-07-15");
  assert.equal(N.previousChicagoDay(new Date("2026-07-16T02:30:00.000Z")), "2026-07-14");
  // 12:30 AM CDT July 16 is 05:30 UTC. Previous day is July 15.
  assert.equal(N.chicagoISO(new Date("2026-07-16T05:30:00.000Z")), "2026-07-16");
  assert.equal(N.previousChicagoDay(new Date("2026-07-16T05:30:00.000Z")), "2026-07-15");
  // 9:30 PM CST on January 15 is 03:30 UTC January 16.
  assert.equal(N.chicagoISO(new Date("2026-01-16T03:30:00.000Z")), "2026-01-15");
  assert.equal(N.previousChicagoDay(new Date("2026-01-16T03:30:00.000Z")), "2026-01-14");
  // 12:30 AM CST January 16 is 06:30 UTC.
  assert.equal(N.previousChicagoDay(new Date("2026-01-16T06:30:00.000Z")), "2026-01-15");
  // Year boundary: 10:00 AM CST January 1, 2027. Previous day is December 31, 2026.
  assert.equal(N.previousChicagoDay(new Date("2027-01-01T16:00:00.000Z")), "2026-12-31");
});

test("weekday of a calendar date does not depend on the machine's time zone", () => {
  assert.equal(N.weekdayOfISO("2026-11-15"), 0); // Sunday
  assert.equal(N.weekdayOfISO("2026-11-16"), 1); // Monday
  assert.equal(N.weekdayOfISO("2026-11-14"), 6); // Saturday
  assert.equal(N.weekdayOfISO("2026-11-12"), 4); // Thursday
});

test("Sunday has nothing required", () => {
  assert.deepEqual(N.missedItems("2026-11-15", {}, { includeWorkshop: true, supplyDue: true }), []);
  assert.deepEqual(N.requiredItemsForDay("2026-11-15", { includeWorkshop: true, supplyDue: true }), []);
});

test("a weekday misses exactly the five daily tasks that were not recorded", () => {
  const none = N.missedItems("2026-11-16", {}, {});
  assert.deepEqual(none.map((item) => item.id), ["opening", "bankAM", "eod", "closing", "bankPM"]);
  assert.deepEqual(none.map((item) => item.label), [
    "Opening checklist",
    "Banking — morning",
    "End of day form",
    "Closing checklist",
    "Banking — afternoon"
  ]);

  const partial = N.missedItems("2026-11-16", {
    opening: { at: "2026-11-16T14:00:00.000Z", by: "AB" },
    bankAM: true,
    eod: { src: "form" }
  }, {});
  assert.deepEqual(partial.map((item) => item.id), ["closing", "bankPM"]);

  assert.deepEqual(N.missedItems("2026-11-16", {
    opening: 1, bankAM: 1, eod: 1, closing: 1, bankPM: 1
  }, {}), []);

  const blanks = N.missedItems("2026-11-16", {
    opening: null, bankAM: 0, eod: "", closing: false
  }, {});
  assert.deepEqual(blanks.map((item) => item.id), ["opening", "bankAM", "eod", "closing", "bankPM"]);
});

test("Saturday recap counts only when the caller can see form responses", () => {
  const done = { opening: 1, bankAM: 1, eod: 1, closing: 1, bankPM: 1 };
  assert.deepEqual(
    N.missedItems("2026-11-14", done, { includeWorkshop: true }).map((item) => item.id),
    ["workshop"]
  );
  assert.deepEqual(N.missedItems("2026-11-14", done, { includeWorkshop: false }), []);
  assert.deepEqual(
    N.missedItems("2026-11-14", Object.assign({ workshop: { src: "form" } }, done), { includeWorkshop: true }),
    []
  );
  const monday = N.missedItems("2026-11-16", {}, { includeWorkshop: true });
  assert.equal(monday.some((item) => item.id === "workshop"), false);
});

test("supply order is missed only on its due date, and only if it was not marked", () => {
  assert.equal(N.firstThursdayISO("2026-08-30"), "2026-09-03");
  assert.equal(N.firstThursdayISO("2026-08-02"), "2026-08-06");
  assert.equal(N.supplyDueOn("2026-09-03", "2026-08-30"), true);
  assert.equal(N.supplyDueOn("2026-09-02", "2026-08-30"), false);
  assert.equal(N.supplyDueOn("2026-09-04", "2026-08-30"), false);

  const done = { opening: 1, bankAM: 1, eod: 1, closing: 1, bankPM: 1 };
  assert.deepEqual(
    N.missedItems("2026-11-12", done, { supplyDue: true, supplyDone: false }).map((item) => item.id),
    ["supply"]
  );
  assert.deepEqual(
    N.missedItems("2026-11-12", done, { supplyDue: true, supplyDone: true }),
    []
  );
  assert.equal(
    N.missedItems("2026-11-13", done, { supplyDue: false, supplyDone: false }).length,
    0
  );
});

test("the DM line names the district when we have one, and never sends anything", () => {
  const west = N.dmMessage("West", 3);
  assert.equal(
    west,
    "Message your DM, the West district manager, and explain why you missed them. This deck does not send that message for you."
  );
  const one = N.dmMessage("East", 1);
  assert.equal(
    one,
    "Message your DM, the East district manager, and explain why you missed it. This deck does not send that message for you."
  );
  const unnamed = N.dmMessage("", 2);
  assert.equal(
    unnamed,
    "Message your DM and explain why you missed them. This deck does not send that message for you."
  );
});
