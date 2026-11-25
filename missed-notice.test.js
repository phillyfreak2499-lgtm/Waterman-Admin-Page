/* node --test missed-notice.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const Nightly = require("./nightly.js");

const source = readFileSync(require.resolve("./app.js"), "utf8");
const start = source.indexOf("const MISSED_NOTICE_CLOSED_STORES");
const path = source.slice(start < 0 ? source.indexOf("function missedAckKey(") : start, source.indexOf("function ackMissed("));
const stores = ["WAX", "ARL", "SLK", "ALL", "FTW", "PLN", "RKW", "TMP", "ALN", "CST", "WCO"];
const storeNames = { ALL: "Fort Worth - Alliance", FTW: "Fort Worth - Hulen" };

async function signIn(now, code, periodStart = "2026-11-22") {
  const active = { code, name: storeNames[code] || code, district: "West" };
  const fields = new Map();
  const datesRead = [];
  let shown = false;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
  const context = {
    Date: Clock, Nightly, active,
    nightlyReady: () => true,
    prettyISO: (iso) => iso,
    localStorage: { getItem: () => null },
    localDayFor: (_name, iso) => { datesRead.push(iso); return {}; },
    syncOn: () => false,
    salesPeriodOn: () => ({ start: periodStart, year: 2026, n: 13 }),
    $: (id) => {
      if (!fields.has(id)) fields.set(id, {
        dataset: {},
        classList: { add: (name) => { if (id === "missedAsk" && name === "on") shown = true; } },
        appendChild: () => {},
      });
      return fields.get(id);
    },
    document: { createElement: () => ({}) },
  };
  await runInNewContext(path + "\nshowMissedNotice();", context);
  return { datesRead, shown, title: fields.get("missedAskTitle")?.textContent };
}

test("Friday after Thanksgiving skips the previous holiday at all 11 rostered stores", async () => {
  for (const code of stores) {
    const result = await signIn("2026-11-27T06:01:00Z", code);
    assert.equal(result.shown, false, code);
    assert.deepEqual(result.datesRead, [], code);
  }
});

test("adjacent Chicago workdays still prompt, and the exception does not apply to a non-rostered code", async () => {
  const before = await signIn("2026-11-27T05:59:00Z", "ALL");
  assert.deepEqual(before.datesRead, ["2026-11-25"]);
  assert.equal(before.title, "You missed 5 things yesterday");

  const after = await signIn("2026-11-28T16:00:00Z", "FTW");
  assert.deepEqual(after.datesRead, ["2026-11-27"]);
  assert.equal(after.title, "You missed 5 things yesterday");

  const unlisted = await signIn("2026-11-27T16:00:00Z", "OTHER");
  assert.deepEqual(unlisted.datesRead, ["2026-11-26"]);
  assert.equal(unlisted.title, "You missed 6 things yesterday");
});

test("a regular supply Thursday still prompts for supply and Sunday is still skipped", async () => {
  const regular = await signIn("2026-12-25T16:00:00Z", "PLN", "2026-12-20");
  assert.deepEqual(regular.datesRead, ["2026-12-24"]);
  assert.equal(regular.title, "You missed 6 things yesterday");

  const monday = await signIn("2026-11-30T16:00:00Z", "PLN");
  assert.deepEqual(monday.datesRead, []);
  assert.equal(monday.shown, false);
});
