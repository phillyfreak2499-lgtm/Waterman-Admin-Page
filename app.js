
/* =====================================================================
   CONFIG  —  paste your real Google Form / Sheet links below.
   ---------------------------------------------------------------------
   Every module takes a `url`. Leave "" and the tile shows a "link not set
   yet" warning instead of sending someone to a dead page.

   If a module has a DIFFERENT link per store, use `byStore` instead of
   `url`, e.g.:
       byStore: { "Waco": "https://…", "Plano": "https://…" }
   A store missing from byStore falls back to `url`.

   Google Forms prefill: if you have a prefilled link that fills in the
   Store field, put the prefilled URL in byStore for each store and the
   employee never has to pick their store twice.
   ===================================================================== */

const BUILD = "2026-08-31-d";

const CONFIG = {
  // Set to false to let anyone straight in without a code.
  requireCode: true,

  /* STORE CODE — four digits, one per store. Entered once; the tablet then stays
     signed in to that store until someone hits "Change store".
     Rotate a store's code whenever someone leaves. */
  storePasswords: {
    "Waxahachie": "9486",
    "Arlington": "9646",
    "Southlake": "3566",
    "Fort Worth - Alliance": "4764",
    "Fort Worth - Hulen": "9144",
    "Plano": "5824",
    "Rockwall": "9475",
    "Temple": "1995",
    "Allen": "7291",
    "College Station": "9375",
    "Waco": "2272"
  },

  // When the deck switches from morning to afternoon. 24-hour clock.
  hours: { amEnds: 12, pmStarts: 15 },

  // Admin page — swaps the module links for every store at once.
  adminPin: "1104",

  // Company view code.
  managerPin: "7531",

  /* Defaults the Admin page can override, and the shared log then pushes to every
     store. Anything left here is the fallback when the log is unreachable. */
  features: { pace: true },

  /* Manager tools — the DM's monthly round. Not shown on any store's deck. */
  dm: { storeVisitUrl: "https://docs.google.com/forms/d/e/1FAIpQLSe5RPPJlMfC_rM305gBY2-pQO3JkSZdMiiI9QwPKzhaDh1dFA/viewform" },

  // Shared tick log. Paste the Apps Script web-app URL from apps-script.gs here.
  // Leave "" and the deck still works: ticks stay on the tablet and the district
  // view explains that it isn't connected yet.
  sync: { url: "https://script.google.com/macros/s/AKfycbxXJrsbNPCDqq33bvv2f4JnEV6iAHgVThAy4_AGm0itEdhQnzQ5HOnprOutX9Q6KuSvaQ/exec" },

  modules: {
    opening: {
      url: "https://docs.google.com/forms/d/e/1FAIpQLSeI-ovRFjLSUs25K83ykxbnEWFMLtNzofeaSRrfOlqStQrM5g/viewform",
      byStore: {}
    },
    closing: {
      url: "https://docs.google.com/forms/d/e/1FAIpQLSc-BFeH-xtomBXQOhqZ2y6aPuFGtsYLMECQMI5TYFghVftpYg/viewform",
      byStore: {}
    },
    // NOTE: this workbook is period-specific ("9 26 EOD Form" = Period 9, 2026).
    // Swap this URL at the start of each new period.
    eod: {
      url: "https://docs.google.com/spreadsheets/d/19RXyq-Bt5urhItx5ezDmCfbnPNNOvkaSWEQYEVFRlKA/edit",
      byStore: {}
    },
    // NOTE: this workbook is monthly ("August 2026 Banking Sheet").
    // Swap this URL on the 1st of each month, or send Zach the next one.
    banking: {
      url: "https://docs.google.com/spreadsheets/d/1rFZ732bhbO_Ttke04kmEI3uBqAWXwvmOVJ5zlaf57YQ/edit",
      byStore: {}
    },
    // The schedule tile renders natively from embedded data. This URL is only
    // used for the "Master sheet" link in the schedule panel — handy for managers,
    // and it's where you re-export from when a new period is published.
    schedule: {
      url: "https://docs.google.com/spreadsheets/d/1zjlPRv35QrmC0ThnHnW7xwwoHp8HrpaTVgiwDLsKaow/edit",
      byStore: {}
    },
    // Weekly Training Recap — submitted the same day the store runs Saturday training.
    workshop: {
      url: "https://docs.google.com/forms/d/e/1FAIpQLSfuKQzysgfx1w2Xg1kvEOJpDPZRgBvw7vEbH5XTi_laRTNsQA/viewform",
      byStore: {}
    },
    // NOTE: a new workbook every period. Due the first Thursday of the period.
    // Swap this URL on Admin when the next period's sheet is ready.
    supply: {
      url: "https://docs.google.com/spreadsheets/d/1wwZLB6qxvv0CRJQxunQj2OI1lizP79mL_5Dd5VffqBE/edit",
      byStore: {}
    }
  },

  /* Meeting join links. Paste the Zoom / Meet / Teams URL in Admin.
     The deck only shows the matching one on that meeting's day. */
  meetings: {
    managers: { url: "" },
    allHands: { url: "" },
    training: { url: "" }
  }
};

const STORES = [
  {name:"Waxahachie",    district:"West", code:"WAX"},
  {name:"Arlington",     district:"West", code:"ARL"},
  {name:"Southlake",     district:"West", code:"SLK"},
  {name:"Fort Worth - Alliance", district:"West", code:"ALL"},
  {name:"Fort Worth - Hulen",    district:"West", code:"FTW"},
  {name:"Plano",         district:"East", code:"PLN"},
  {name:"Rockwall",      district:"East", code:"RKW"},
  {name:"Temple",        district:"East", code:"TMP"},
  {name:"Allen",         district:"East", code:"ALN"},
  {name:"College Station",district:"East",code:"CST"},
  {name:"Waco",          district:"East", code:"WCO"}
];

/* These two stores were renamed in Aug 2026. Everything already in the shared log,
   and every schedule tab, still says the old name — so anything read back gets mapped
   forward. Without this, Alliance's history would simply vanish from the views. */
const STORE_RENAMES = {
  "Alliance": "Fort Worth - Alliance",
  "Alliance- FW": "Fort Worth - Alliance",
  "Alliance-FW": "Fort Worth - Alliance",
  "Fort Worth": "Fort Worth - Hulen",
  "Ft. Worth": "Fort Worth - Hulen"
};
function canonStoreName(name){
  const n = String(name || "").trim();
  return STORE_RENAMES[n] || n;
}
/* Re-key a {store: …} map coming back from the log. */
function canonStores(obj){
  if(!obj) return obj;
  const out = {};
  Object.keys(obj).forEach(k => {
    const c = canonStoreName(k);
    out[c] = out[c] ? Object.assign({}, out[c], obj[k]) : obj[k];
  });
  return out;
}


/* Official Waterman / Good Feet sales periods. Each period is 28 days.
   Period 1 of a year starts in late December of the prior year. */
const SALES_PERIODS = [
  {year:2025,n:1,start:"2024-12-22",end:"2025-01-18"},
  {year:2025,n:2,start:"2025-01-19",end:"2025-02-15"},
  {year:2025,n:3,start:"2025-02-16",end:"2025-03-15"},
  {year:2025,n:4,start:"2025-03-16",end:"2025-04-12"},
  {year:2025,n:5,start:"2025-04-13",end:"2025-05-10"},
  {year:2025,n:6,start:"2025-05-11",end:"2025-06-07"},
  {year:2025,n:7,start:"2025-06-08",end:"2025-07-05"},
  {year:2025,n:8,start:"2025-07-06",end:"2025-08-02"},
  {year:2025,n:9,start:"2025-08-03",end:"2025-08-30"},
  {year:2025,n:10,start:"2025-08-31",end:"2025-09-27"},
  {year:2025,n:11,start:"2025-09-28",end:"2025-10-25"},
  {year:2025,n:12,start:"2025-10-26",end:"2025-11-22"},
  {year:2025,n:13,start:"2025-11-23",end:"2025-12-20"},
  {year:2026,n:1,start:"2025-12-21",end:"2026-01-17"},
  {year:2026,n:2,start:"2026-01-18",end:"2026-02-14"},
  {year:2026,n:3,start:"2026-02-15",end:"2026-03-14"},
  {year:2026,n:4,start:"2026-03-15",end:"2026-04-11"},
  {year:2026,n:5,start:"2026-04-12",end:"2026-05-09"},
  {year:2026,n:6,start:"2026-05-10",end:"2026-06-06"},
  {year:2026,n:7,start:"2026-06-07",end:"2026-07-04"},
  {year:2026,n:8,start:"2026-07-05",end:"2026-08-01"},
  {year:2026,n:9,start:"2026-08-02",end:"2026-08-29"},
  {year:2026,n:10,start:"2026-08-30",end:"2026-09-26"},
  {year:2026,n:11,start:"2026-09-27",end:"2026-10-24"},
  {year:2026,n:12,start:"2026-10-25",end:"2026-11-21"},
  {year:2026,n:13,start:"2026-11-22",end:"2026-12-19"},
  {year:2027,n:1,start:"2026-12-20",end:"2027-01-16"},
  {year:2027,n:2,start:"2027-01-17",end:"2027-02-13"},
  {year:2027,n:3,start:"2027-02-14",end:"2027-03-13"},
  {year:2027,n:4,start:"2027-03-14",end:"2027-04-10"},
  {year:2027,n:5,start:"2027-04-11",end:"2027-05-08"},
  {year:2027,n:6,start:"2027-05-09",end:"2027-06-05"},
  {year:2027,n:7,start:"2027-06-06",end:"2027-07-03"},
  {year:2027,n:8,start:"2027-07-04",end:"2027-07-31"},
  {year:2027,n:9,start:"2027-08-01",end:"2027-08-28"},
  {year:2027,n:10,start:"2027-08-29",end:"2027-09-25"},
  {year:2027,n:11,start:"2027-09-26",end:"2027-10-23"},
  {year:2027,n:12,start:"2027-10-24",end:"2027-11-20"},
  {year:2027,n:13,start:"2027-11-21",end:"2027-12-18"}
];
function dateFromISO(iso){
  const [y,m,d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function daysBetweenISO(a, b){
  return Math.round((dateFromISO(b) - dateFromISO(a)) / 86400000);
}
function salesPeriodOn(iso){
  iso = iso || todayISO();
  for(const p of SALES_PERIODS){
    if(iso >= p.start && iso <= p.end){
      const len = daysBetweenISO(p.start, p.end) + 1;
      const day = daysBetweenISO(p.start, iso) + 1;
      const left = daysBetweenISO(iso, p.end);
      return { year:p.year, n:p.n, start:p.start, end:p.end, len:len, day:day, left:left };
    }
  }
  return null;
}
function periodPhrase(p){
  if(!p) return "";
  const left = p.left === 0 ? "last day" : (p.left === 1 ? "1 day left" : p.left + " days left");
  return "Period " + p.n + " · " + p.year + " · Day " + p.day + " of " + p.len + " · " + left;
}
function fmtPeriodEnd(iso){
  const d = dateFromISO(iso);
  return d.toLocaleDateString([], {month:"short", day:"numeric"});
}

function nthSaturdayInPeriod(iso){
  const p = salesPeriodOn(iso);
  if(!p) return 0;
  const today = dateFromISO(iso);
  if(today.getDay() !== 6) return 0;
  let n = 0;
  const cur = dateFromISO(p.start);
  while(cur <= today){
    if(cur.getDay() === 6) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

function meetingLink(kind){
  const fromAdmin = SETTINGS["link.meet." + kind];
  if(fromAdmin) return fromAdmin;
  return (CONFIG.meetings && CONFIG.meetings[kind] && CONFIG.meetings[kind].url) || "";
}

function meetingToday(iso){
  iso = iso || todayISO();
  const d = dateFromISO(iso);
  const dow = d.getDay();
  const p = salesPeriodOn(iso);
  if(dow === 2){
    return {
      kind: "managers",
      title: "Managers meeting",
      when: "Tuesday 9 AM",
      blurb: "Managers-only. Opens in a new tab.",
      url: meetingLink("managers")
    };
  }
  if(dow === 6){
    const n = nthSaturdayInPeriod(iso);
    if(n === 1){
      return {
        kind: "allHands",
        title: "All-hands meeting",
        when: "First Saturday of the period · 9 AM",
        blurb: "Company all-hands. Opens in a new tab.",
        url: meetingLink("allHands")
      };
    }
    if(n === 2 || n === 4){
      return {
        kind: "training",
        title: "Sales manager training",
        when: (n === 2 ? "Second" : "Fourth") + " Saturday of the period · 9 AM",
        blurb: "Sales manager training. Opens in a new tab.",
        url: meetingLink("training")
      };
    }
  }
  return null;
}

function meetSeenKey(){
  const m = meetingToday();
  return "wg-ops-meet-seen-" + todayISO() + "-" + (m ? m.kind : "");
}

const ICONS = {
  opening:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>',
  closing:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  eod:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  banking:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="1"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
  schedule:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3M8 17h3M14 14h2"/></svg>',
  workshop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2 8.5 12 13l10-4.5z"/><path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5"/><path d="M21 9v6"/></svg>',
  supply:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v13H3z"/><path d="M3 7 6.2 3h11.6L21 7"/><path d="M12 11v6M9 14h6"/></svg>'
};

/* The day's rhythm, as the stores actually run it:
   opening checklist + banking in the morning, closing checklist + banking in the
   afternoon, EOD form filled in throughout the day. */
const TASKS = [
  {id:"opening", module:"opening", when:"am",  short:"Done",       abbr:"Open",    full:"Opening checklist"},
  {id:"bankAM",  module:"banking", when:"am",  short:"AM done",    abbr:"Bank AM", full:"Banking — morning"},
  {id:"eod",     module:"eod",     when:"all", short:"Done today", abbr:"EOD",     full:"End of day form"},
  {id:"closing", module:"closing", when:"pm",  short:"Done",       abbr:"Close",   full:"Closing checklist"},
  {id:"bankPM",  module:"banking", when:"pm",  short:"PM done",    abbr:"Bank PM", full:"Banking — afternoon"}
];

const MODULES = [
  {key:"opening", group:"daily", tag:"Every AM", title:"Opening Checklist",
   desc:"Leads contacted, CRM tasks, Erply open, banking verified, store set for the day."},
  {key:"closing", group:"daily", tag:"Every PM", title:"Closing Checklist",
   desc:"Erply closed, inventory accepted, stations restocked, cleaning list, clocked out."},
  {key:"eod", group:"daily", tag:"Every PM", title:"End of Day Form",
   desc:"Each rep's sales for the day, your initials, and the RICS ending amount. Open your store's tab."},
  {key:"banking", group:"daily", tag:"Every day", title:"Banking Sheet",
   desc:"Your store's tab — opening cash, drops, closing count, and any variance explained."},
  {key:"schedule", group:"weekly", tag:"Reference", title:"Work Schedule", internal:true,
   desc:"Your store's week, day by day. Opens right here — no hunting through the master sheet."},
  {key:"workshop", group:"weekly", tag:"Saturdays", title:"Weekly Training Recap",
   desc:"Submit the same day you run Saturday training — store, period and week, and whether everyone completed it. This is what the compliance report reads."},
  {key:"supply", group:"weekly", tag:"First Thursday", title:"Supply Order",
   desc:"One workbook per period. Open your store's tab and submit it by the first Thursday of the period."}
];

/* Schedule data lifted from Work Schedule 2026 — periods 8, 9, 10.
   To refresh: re-export the sheet and replace this object. */
const SCHEDULE = {"periods":{"8":{"weeks":[{"days":[{"d":"","label":""},{"d":"2026-07-06","label":""},{"d":"2026-07-07","label":"Growth Plans"},{"d":"2026-07-08","label":""},{"d":"2026-07-09","label":""},{"d":"2026-07-10","label":""},{"d":"2026-07-11","label":""}],"stores":{"Allen":{"shifts":["","BM/KB/CE","JW/KB/BM","JW/CE/KB","JW/BM-EL/CE","JW/KB/CE/BM","JW/KB/BM/CE"],"notes":[]},"Alliance":{"shifts":["","KD/JH","LO/KD","LO/JH","LO/KD/JH","LO/KD/JH","LO/KD/JH"],"notes":[]},"Arlington":{"shifts":["","AF/AL/VP","Ash/AF/AL","Ash/AF/AL/VP","Ash/AL/VP","Ash/AF/VP","Ash/AF/AL/VP"],"notes":[]},"Fort Worth":{"shifts":["","SE/LD","BS/SE/LD","BS/SE","BS/LD","BS/SE/LD","BS/SE/LD"],"notes":[]},"Plano":{"shifts":["","JL/KH/JC/BB","TH/JL/JC/BB","TH/JL/JC-x/KH","TH/KH/JC/BB","TH/JL/KH/BB","TH/JL/KH/JC/BB"],"notes":["7/8 JC PTO"]},"Southlake":{"shifts":["","AD/DP/HJ","JM/AD/DP","JM/AD/DP","JM/HJ/AD","JM/DP/HJ","JM/AD-x/DP/HJ"],"notes":["7/11 AD PTO"]},"Rockwall":{"shifts":["","BE/KA","SH/KA/BE","SH/BE","SH/KA/BE","SH/KA","SH/BE/KA"],"notes":[]},"Waco":{"shifts":["","LS/JA","JA-x/CB/LS","JA/LS","JA /LS","JA/LS","JA/LS"],"notes":["7/7 JA PTO"]},"Temple":{"shifts":["","CB/DP","EP/CB/DP","EP/CB/DP","EP/DP","EP/CB","EP/CB/DP"],"notes":[]},"College Station":{"shifts":["","ZO/CS/GM","KA/CS/ZO","KA/ZO/GM","KA/CS/GM","KA/ZO/CS/GM","KA/CS/ZO/GM"],"notes":[]},"Waxahachie":{"shifts":["","KM/CC/GH-x","LR/KM/GH","LR/KM/CC","LR/GH/CC","LR-x/KM/GH/CC","LR-x/KM/GH/CC/GN"],"notes":["7/10-7/11 LR PTO","7/6 GH NPS"]}}},{"days":[{"d":"","label":""},{"d":"2026-07-13","label":""},{"d":"2026-07-14","label":""},{"d":"","label":"Inventory East 7/15"},{"d":"2026-07-16","label":""},{"d":"2026-07-17","label":""},{"d":"2026-07-18","label":""}],"stores":{"Allen":{"shifts":["","BM/KB/CE","JW/KB/BE","JW/CE/KB","JW/BE/CE","JW/KB/CE","JW/KB/BE/CE"],"notes":[]},"Alliance":{"shifts":["","KD/JH","LO/KD-x/JH","LO/JH","LO/KD","LO/KD/JH","LO/KD/JH"],"notes":["7/14 KD PTS"]},"Arlington":{"shifts":["","AF/AL/VP","Ash-BR/AF/AL","Ash-x-BR/AF/AL/VP","Ash/AL/VP/BR-TF","Ash-BR/AF/VP","Ash-BR/AF/VP"],"notes":["7/15 Ash PTS"]},"Fort Worth":{"shifts":["","SE/LD","BS/SE/LD","BS/SE","BS/LD","BS/SE/LD","BS/SE-x/LD/AL"],"notes":["7/18 SE PTO"]},"Plano":{"shifts":["","JL/KH/JC/BB","TH/JL-x/JC/BB","TH/JL/JC/KH","TH/KH-x/JC/BB","TH/JL/KH/BB","TH/JL/KH/JC/BB"],"notes":["7/14 JL PTS","7/16 KH NPS"]},"Southlake":{"shifts":["","AD-x/DP/HJ","JM-JF/AD/DP","JM-JF/AD/DP","JM/HJ/DP","JM/AD/HJ","JM/AD/DP/HJ"],"notes":["7/13 AD PTO"]},"Rockwall":{"shifts":["","BE/KA","SH/KA/BM","SH/BE","SH/KA/BM","SH/KA","SH/BM/KA"],"notes":[]},"Waco":{"shifts":["","LS","JA/LS","JA/LS","JA","JA/LS","JA/LS"],"notes":[]},"Temple":{"shifts":["","CB/DP","EP/CB/DP","EP/CB/DP-x","EP/DP-x","CB","E/CB/DP"],"notes":["7/15-7/16 DP PTS"]},"College Station":{"shifts":["","ZO/CS-x/GM","KA/CS-x/ZO","KA/ZO/GM","KA/CS/GM","KA/ZO-x/CS/GM","KA/CS/ZO-x/GM"],"notes":["7/17-7/18 ZO PTO","7/13-7/14 CS PTO"]},"Waxahachie":{"shifts":["","KM/CC/GH","LR/KM/GH","LR/KM/CC","LR/GH/CC","LR/KM/GH/CC","LR/KM/GH/CC"],"notes":[]}}},{"days":[{"d":"","label":""},{"d":"2026-07-20","label":""},{"d":"2026-07-21","label":""},{"d":"","label":"Inventory West 7/22"},{"d":"2026-07-23","label":""},{"d":"2026-07-24","label":""},{"d":"2026-07-25","label":""}],"stores":{"Allen":{"shifts":["","KB/BE/CE","JW/KB-x/BE","JW/CE/KB-x","JW/BE/CE","JW/KB/CE","JW/KB/BE/CE"],"notes":["7/21 KB PTS","7/22 KB PTO"]},"Alliance":{"shifts":["","KD/JH","LO/KD","LO/JH","LO/KD/JH","LO/JH/KD","LO/JH"],"notes":[]},"Arlington":{"shifts":["","AF/AL/VP","Ash/AF/AL","Ash/AF-EL/AL/VP","Ash-x/AL/VP","Ash-x/AF/VP","Ash-x/AF/AL/VP"],"notes":["7/23 Ash PTS","7/24-7/25 Ash PTO"]},"Fort Worth":{"shifts":["","SE-x/LD/BR","BS/SE/LD","BS/BR","BS/LD/BR","BS/LD/BR-x","BS/LD/BR"],"notes":["7/20 SE PTO","7/24 BR NPS"]},"Plano":{"shifts":["","JL/JC/BB","TH/JL/JC/BB","TH/JL/JC/KH","TH/KH/JC/BB-x","TH/JL/KH/BB-x","TH/JL/KH/JC/BB-x"],"notes":["7/23 BB 4PTO","7/24 BB PTO","7/24 BB PTO"]},"Southlake":{"shifts":["","DP/HJ/KH","JM/AD/DP","JM/AD/DP","JM-x/HJ/DP-x/AD","JM/AD/HJ","JM/AD/DP/HJ-x"],"notes":["7/25 HJ Off","7/23 DP PTO","7/23 JM PTS"]},"Rockwall":{"shifts":["","BM/KA","SH/KA/BM","SH/BE","SH/KA/BM","SH/KA/BM","SH/BM/KA"],"notes":[]},"Waco":{"shifts":["","LS/PC","JA-x/PC","JA/LS","JA","JA/LS","JA/LS"],"notes":["7/21 LS PTO","7/21 JA PTO"]},"Temple":{"shifts":["","DP/CB","CB/DP","CB/DP","CB/DP","CB","CB/DP"],"notes":[]},"College Station":{"shifts":["","ZO/CS/GM","KA/CS/ZO-x","KA/ZO/GM","KA-x/CS-EL/GM","KA/ZO/CS-x/GM","KA/CS/ZO/GM"],"notes":["7/21 ZO PTO","7/23 KA PTS","7/23 CS-4PTO","7/24 CS PTO"]},"Waxahachie":{"shifts":["","KM/CC/GH","LR/KM/GH","LR/KM/CC","LR/GH/CC","LR/KM/GH/CC","LR/KM/GH/CC"],"notes":[]}}},{"days":[{"d":"","label":""},{"d":"2026-07-27","label":""},{"d":"2026-07-28","label":""},{"d":"2026-07-29","label":""},{"d":"2026-07-30","label":""},{"d":"2026-07-31","label":""},{"d":"2026-08-01","label":""}],"stores":{"Allen":{"shifts":["","KB/BE-x/CE/JW","JW/KB/BE","CE/KB","JW/BE/CE","JW/KB/CE","JW/KB/BE/CE"],"notes":["7/27 BE PTO"]},"Alliance":{"shifts":["","HJ/JH","LO/JH","LO/JH","LO/JH","LO/JH","LO/JH"],"notes":[]},"Arlington":{"shifts":["","AF/AL/VP-x","Ash-x/AF/AL","Ash/AF/AL/VP","Ash/AL/VP","Ash/AF/VP","Ash/AF-x/AL/VP"],"notes":["8/1 AF off","7/27 VP PTO","7/28 Ash PTO"]},"Fort Worth":{"shifts":["","LD/BR","BS/LD","BS/BR","BS/LD/BR","BS/LD/BR","BS/LD/BR"],"notes":[]},"Plano":{"shifts":["","JL/KH/JC/BB-x","TH/JL/JC","TH/JL/JC/KH","TH-x/KH/JC","TH-x/JL/KH","TH-x/JL/KH/JC"],"notes":["7/30-8/1 TH PTO","7/27 BB PTO"]},"Southlake":{"shifts":["","AD/DP/HJ","JM/AD/DP","JM/AD/DP","JM/HJ/DP","JM/AD/HJ","JM/AD/DP/HJ-x"],"notes":["8/1 HJ  off"]},"Rockwall":{"shifts":["","BM/KA","SH/KA/BM","SH/BE","SH/KA/BM","SH/KA/BM","SH/BM/KA"],"notes":[]},"Waco":{"shifts":["","LS","JA/LS","JA/LS","JA","JA/LS","JA/LS"],"notes":[]},"Temple":{"shifts":["","DP/CB","CB/DP","CB/DP","CB/DP","CB-x/PC/GM","CB-x/DP/KA"],"notes":["7/31-8/1 NP"]},"College Station":{"shifts":["","ZO/CS/GM","KA/CS/ZO","KA/ZO/GM","KA/CS/GM","KA/ZO/CS/GM","KA/CS/ZO/GM"],"notes":[]},"Waxahachie":{"shifts":["","KM/CC/GH","LR/KM/GH","LR/KM/CC","LR-x/GH/CC/KM","LR/GH/CC","LR/KM/GH/CC-x"],"notes":["7/30 LR PTO"]}}}]},"9":{"weeks":[{"days":[{"d":"","label":""},{"d":"2026-08-03","label":""},{"d":"2026-08-04","label":"Growth Plans"},{"d":"2026-08-05","label":""},{"d":"2026-08-06","label":""},{"d":"2026-08-07","label":""},{"d":"2026-08-08","label":""}],"stores":{"Allen":{"shifts":["","BE/KB/CE","JW/KB/BE","JW/CE/KB/BE","JW/BE/CE","JW/KB/CE","JW/KB/BE/CE"],"notes":[]},"Alliance":{"shifts":["","HJ/LO","LO/JH-x/Ash","LO/JH","HJ/JH","LO/JH/HJ","LO/JH/HJ"],"notes":[]},"Arlington":{"shifts":["","AF/VP","/AF/AL/JM","Ash/AF/VP","Ash/AL/VP","Ash/AF/VP","Ash/AF-x/AL/VP"],"notes":["8/8 AF NPS"]},"Fort Worth":{"shifts":["","LD/BR-x/AL","BS/LD/BR","BS/BR","BS/LD-x/BR","BS/LD/BR","BS/LD/BR"],"notes":["8/6 LD PTO"]},"Plano":{"shifts":["","JL/KH/JC","TH/JL/JC","TH/JL/JC/KH","TH/KH/JC","TH/JL/KH","TH/JL/KH/JC-x"],"notes":["8/8 JC 8PS"]},"Southlake":{"shifts":["","AD/DP","AD/DP","JM/AD/DP","JM/DP","JM/AD","JM/AD/DP"],"notes":[]},"Rockwall":{"shifts":["","BM/KA","SH/KA/BM","SH/BM","SH/KA","SH/KA/BM","SH/BM/KA"],"notes":[]},"Waco":{"shifts":["","LS","JA/LS","JA/LS","JA","JA/LS","JA/LS"],"notes":[]},"Temple":{"shifts":["","DP/CB-4","CB/DP","CB/DP","CB/PC","CB/DP","CB/DP"],"notes":[]},"College Station":{"shifts":["","ZO/CS/GM","KA/CS/ZO","KA/ZO/GM","KA/CS/GM","KA/ZO/CS/GM","KA/CS/ZO/GM"],"notes":[]},"Waxahachie":{"shifts":["","KM/GH","LR/KM/GH","LR/KM/AL","LR/GH","LR/KM/GH","LR/KM/GH"],"notes":[]}}},{"days":[{"d":"","label":""},{"d":"2026-08-10","label":""},{"d":"2026-08-11","label":""},{"d":"2026-08-12","label":"Inventory East"},{"d":"2026-08-13","label":""},{"d":"2026-08-14","label":""},{"d":"2026-08-15","label":""}],"stores":{"Allen":{"shifts":["","BE/KB/CE-x","JW/KB/BE","JW/CE/KB/BE","JW/BE-x/CE","JW/KB/CE","JW/KB/BE-x/CE"],"notes":["8/10 CE PH Off","8/13-8/15 BE PTO"]},"Alliance":{"shifts":["","HJ/JH","LO/JH","LO/JH","LO/JH","LO/HJ","LO/JH"],"notes":[]},"Arlington":{"shifts":["","AF/AL/VP","Ash/AF/AL","Ash/AF/VP","Ash/AL/VP","Ash/AF/VP","Ash/AF/VP"],"notes":[]},"Fort Worth":{"shifts":["","LD/BR","BS/LD","BS/BR","BS-x/LD/BR","BS/LD/BR","BS-x/LD/BR/AL"],"notes":["8/15 BS PTO","8/13 BS PTOS"]},"Plano":{"shifts":["","JL/KH/JC","TH/JL/JC","TH/JL/JC/KH","TH/KH/JC","TH/JL/KH","TH/JL/KH/JC"],"notes":[]},"Southlake":{"shifts":["","AD/DP","JM/AD/DP","JM/AD/DP","JM-x/DP/HJ","JM/AD","JM/AD-x/DP/HJ"],"notes":["8/15 AD PTO","8/13 JM 4PTO"]},"Rockwall":{"shifts":["","BM/KA","SH/KA/BM","SH/BM","SH/KA","SH/KA/BM","SH/BM/KA-4"],"notes":["8/15 KA-4hours PTO"]},"Waco":{"shifts":["","LS","JA/LS","JA/LS","JA","JA/LS","JA/LS"],"notes":[]},"Temple":{"shifts":["","DP","CB/DP","CB/DP","CB/DP","CB","CB/DP"],"notes":[]},"College Station":{"shifts":["","ZO/CS/GM","KA/CS/ZO","KA/ZO/GM","KA/CS/GM","KA/ZO-x/CS/GM","KA/CS/ZO-x/GM"],"notes":["8/14-8/15 ZO PTO"]},"Waxahachie":{"shifts":["","KM/GH","LR/KM/GH","LR/KM/AL","LR/GH","LR/KM/GH","LR/KM-x/GH"],"notes":["8/15 KM NPS"]}}},{"days":[{"d":"","label":""},{"d":"2026-08-17","label":""},{"d":"2026-08-18","label":""},{"d":"2026-08-19","label":"Inventory West"},{"d":"2026-08-20","label":""},{"d":"2026-08-21","label":""},{"d":"2026-08-22","label":""}],"stores":{"Allen":{"shifts":["","BE-x/JW/CE","JW/BE","JW/CE/BE","JW/BE/CE","JW/CE","JW/BE-x/CE"],"notes":["8/17 BE PTO","8/22 BE PTO"]},"Alliance":{"shifts":["","HJ/JH","LO/JH","LO/JH","LO/JH","LO/HJ","LO/JH/HJ"],"notes":[]},"Arlington":{"shifts":["","AF/AL/VP","Ash/AF/AL","Ash/AF/VP","Ash/AL/VP","Ash/AF/VP","Ash/AF//VP"],"notes":[]},"Fort Worth":{"shifts":["","LD/BR","BS-WG/LD","BS-WG/BR","BS/LD/BR/WG-TF","BS-WG/LD/BR","BS-WG/LD/BR"],"notes":[]},"Plano":{"shifts":["","TH/KH/JC","TH/KB/JC","TH/JC/KH/KB","KB/KH/JC","TH/KH/KB","TH/KB/KH/JC"],"notes":["8/17 JC out at 1:30 for long lunch"]},"Southlake":{"shifts":["","AD/DP","JM/AD/DP","JM/AD/DP","JM/DP/HJ","JM/AD","JM/AD/DP-x/AL"],"notes":["8/22 DP PTO"]},"Rockwall":{"shifts":["","BM/KA","SH/KA/BM","SH/BM","SH/KA","SH/KA/BM","SH/BM/KA"],"notes":[]},"Waco":{"shifts":["","LS","JA-JM/LS","JA-JM/LS","JA/PC-JM Wrap","JA-JM/LS-x/PC","JA-JM/LS-x/KA"],"notes":["8/21-8/22 LS PTO"]},"Temple":{"shifts":["","DP/CB","CB/DP","CB/DP-x","CB","CB/PC","CB/CS"],"notes":[]},"College Station":{"shifts":["","ZO/CS/GM","KA/CS/ZO","KA/ZO-4/GM","KA/CS/GM","KA/ZO/CS/GM","ZO/GM"],"notes":["8/19 ZO 1/2 day"]},"Waxahachie":{"shifts":["","KM/GH","LR/KM/GH","LR/KM/AL","LR/GH","LR/KM/GH","LR/KM/GH"],"notes":[]}}},{"days":[{"d":"","label":""},{"d":"2026-08-24","label":""},{"d":"2026-08-25","label":""},{"d":"2026-08-26","label":""},{"d":"2026-08-27","label":""},{"d":"2026-08-28","label":""},{"d":"2026-08-29","label":""}],"stores":{"Allen":{"shifts":["","BE/CE","JW/BE","JW/CE/BE","JW/BE/CE","JW/CE","JW/BE/CE"],"notes":[]},"Alliance":{"shifts":["","HJ/JH","LO/JH","LO/JH","LO/JH","LO/HJ/BR","LO/JH/HJ"],"notes":[]},"Arlington":{"shifts":["","AF/AL/VP","Ash/AF/AL","Ash/AF/VP","Ash/AL/VP","Ash/AF/VP","Ash/AF/AL/VP"],"notes":[]},"Fort Worth":{"shifts":["","LD/BR","BS/LD","BS/BR","BS/LD/BR","BS/LD","BS/LD-4/BR"],"notes":["8/29 LD 4PTO"]},"Plano":{"shifts":["","KB/KH/JC","TH/KB/JC","TH/JC/KH/KB","TH/KH/JC","TH/KH/KB","TH/KB/KH/JC"],"notes":[]},"Southlake":{"shifts":["","AD/DP","JM/AD/DP","JM/AD/DP","JM/AD/HJ","JM/DP","JM/AD/DP"],"notes":[]},"Rockwall":{"shifts":["","BM/KA","SH/KA/BM","SH/BM","SH/KA","SH/KA/BM","SH/BM/KA"],"notes":[]},"Waco":{"shifts":["","LS","JA/LS","JA/LS","JA","JA/LS","JA/LS"],"notes":[]},"Temple":{"shifts":["","CB/JM","CB/JM","JM/PC","CB/JM","CB","CB/JM"],"notes":[]},"College Station":{"shifts":["","ZO/CS/GM","KA/CS/ZO","KA/ZO/GM","KA/CS/GM","KA/ZO/CS/GM","KA/CS/ZO/GM"],"notes":[]},"Waxahachie":{"shifts":["","KM/GH","LR/KM/GH","LR/KM/AL","LR/GH","LR/KM/GH","LR/KM/GH"],"notes":[]}}}]},"10":{"weeks":[{"days":[{"d":"","label":""},{"d":"2026-08-31","label":""},{"d":"2026-09-01","label":"Growth Plans"},{"d":"2026-09-02","label":""},{"d":"2026-09-03","label":""},{"d":"2026-09-04","label":""},{"d":"2026-09-05","label":""}],"stores":{"Allen":{"shifts":["","BE/CE","JW/BE","JW/CE/BE","JW/BE/CE","JW/CE","JW/BE/CE"],"notes":[]},"Alliance":{"shifts":["","HJ/JH","LO/JH","LO/JH","LO/JH","LO/HJ","LO/JH/HJ"],"notes":[]},"Arlington":{"shifts":["","AF/AL/VP","Ash/AF/AL","Ash/AF/VP","Ash/AL/VP","Ash/AF/VP","Ash/AF/AL/VP"],"notes":[]},"Fort Worth":{"shifts":["","LD/BR","BS/LD","BS/BR","BS/LD/BR","BS/LD-x","BS/LD-x/BR"],"notes":["9/4-9/5 LD PTO"]},"Plano":{"shifts":["","KB/KH/JC","TH/KB/JC","TH/JC/KH/KB","TH/KH/JC","TH/KH/KB","TH/KB/KH/JC"],"notes":[]},"Southlake":{"shifts":["","AD/DP","JM/AD/DP","JM/AD","JM/DP/HJ","JM/AD/DP","JM/AD/DP"],"notes":[]},"Rockwall":{"shifts":["","BM/KA","SH/KA/BM","SH/BM","SH/KA","SH/KA/BM","SH/BM/KA"],"notes":[]},"Waco":{"shifts":["","LS","JA-x/LS","JA-x/LS","JA-x/JM","JA-x/LS","JA-x/LS/JM"],"notes":["9/1-9/5 JA PTO"]},"Temple":{"shifts":["","CB/JM","CB","JM/PC","CB","CB/JM","CB"],"notes":[]},"College Station":{"shifts":["","ZO/CS/GM","KA/CS/ZO","KA/ZO/GM","KA/CS/GM","KA/ZO/CS/GM","KA/CS/ZO/GM"],"notes":[]},"Waxahachie":{"shifts":["","KM/GH","LR/KM/GH","LR/KM/AL","LR/GH","LR/GH","LR/GH"],"notes":[]}}},{"days":[{"d":"","label":""},{"d":"2026-09-07","label":""},{"d":"2026-09-08","label":""},{"d":"2026-09-09","label":"Inventory East"},{"d":"2026-09-10","label":""},{"d":"2026-09-11","label":""},{"d":"2026-09-12","label":""}],"stores":{"Allen":{"shifts":["","BE/CE","JW/BE","JW/CE/BE","JW/BE/CE","JW/CE","JW/BE/CE"],"notes":[]},"Alliance":{"shifts":["","HJ/JH","LO/JH","LO/JH","LO/JH","LO/HJ/BR","LO/JH/HJ"],"notes":[]},"Arlington":{"shifts":["","AF/AL/VP","Ash/AF/AL","Ash/AF/VP","Ash/AL/VP","Ash/AF/VP","Ash/AF/AL/VP"],"notes":[]},"Fort Worth":{"shifts":["","LD/BR","BS/LD","BS/BR","BS/LD/BR","BS/LD","BS/LD/BR"],"notes":[]},"Plano":{"shifts":["","KB/KH/JC","TH/KB/JC","TH/JC/KH/KB","TH/KH/JC","TH/KH/KB","TH-x/KB/KH/JC"],"notes":["9/12 TH PTO"]},"Southlake":{"shifts":["","AD/DP","JM/AD/DP","JM/AD","JM/DP-x/HJ","JM/AD/DP","JM/AD/DP"],"notes":["9/10 DP PTO"]},"Rockwall":{"shifts":["","BM/KA","SH/KA/BM","SH/BM","SH/KA","SH/KA/BM","SH/BM/KA"],"notes":[]},"Waco":{"shifts":["","LS/JM","JA/LS","JA/LS","JA/JM","JA/LS","JA/LS"],"notes":[]},"Temple":{"shifts":["","/CB","CB/","JM","CB","CB/JM","CB/JM"],"notes":[]},"College Station":{"shifts":["","ZO/CS/GM","KA/CS/ZO","KA/ZO/GM","KA/CS/GM","KA/ZO/CS/GM","KA/CS/ZO/GM"],"notes":[]},"Waxahachie":{"shifts":["","GH","LR/GH","LR/AL","LR/GH","LR/GH","LR/GH"],"notes":[]}}},{"days":[{"d":"","label":""},{"d":"2026-09-14","label":""},{"d":"2026-09-15","label":""},{"d":"2026-09-16","label":"Inventory West"},{"d":"2026-09-17","label":""},{"d":"2026-09-18","label":""},{"d":"2026-09-19","label":""}],"stores":{"Allen":{"shifts":["","BE/CE","JW/BE","JW/CE/BE","JW/BE/CE","JW/CE","JW/BE/CE"],"notes":[]},"Alliance":{"shifts":["","HJ/JH","LO/JH","LO/JH","LO/JH","LO/HJ/BR","LO/JH/HJ"],"notes":[]},"Arlington":{"shifts":["","AF/AL/VP","Ash/AF/AL","Ash/AF/VP","Ash/AL/VP","Ash/AF/VP","Ash/AF/AL/VP"],"notes":[]},"Fort Worth":{"shifts":["","LD/BR","BS/LD","BS/BR","BS/LD/BR","BS/LD","BS/LD/BR"],"notes":[]},"Plano":{"shifts":["","KB/KH/JC","TH/KB/JC","TH/JC/KH/KB","TH/KH/JC","TH/KH/KB","TH/KB/KH/JC"],"notes":[]},"Southlake":{"shifts":["","AD/DP","JM/AD/DP","JM/AD","JM/DP/HJ","JM/AD/DP","JM/AD/DP"],"notes":[]},"Rockwall":{"shifts":["","BM/KA","SH/KA/BM","SH/BM","SH/KA","SH/KA/BM","SH-x/BM/KA"],"notes":["9/19 SH PTO"]},"Waco":{"shifts":["","LS/JM","JA/LS","JA/LS","JA/JM","JA/LS","JA/LS"],"notes":[]},"Temple":{"shifts":["","/CB","CB","JM","CB","CB/JM","CB/JM"],"notes":[]},"College Station":{"shifts":["","ZO/CS/GM","KA/CS/ZO","KA/ZO/GM","KA/CS/GM","KA/ZO/CS/GM","KA/CS/ZO/GM"],"notes":[]},"Waxahachie":{"shifts":["","GH","LR/GH","LR/AL","LR/GH","LR/GH","LR/GH"],"notes":[]}}},{"days":[{"d":"","label":""},{"d":"2026-09-21","label":""},{"d":"2026-09-22","label":""},{"d":"2026-09-23","label":""},{"d":"2026-09-24","label":""},{"d":"2026-09-25","label":""},{"d":"2026-09-26","label":""}],"stores":{"Allen":{"shifts":["","BE/CE","JW/BE","JW/CE/BE","JW/BE/CE","JW/CE","JW/BE/CE"],"notes":[]},"Alliance":{"shifts":["","HJ/JH","LO/JH","LO/JH","LO/JH","LO/HJ/BR","LO/JH/HJ"],"notes":[]},"Arlington":{"shifts":["","AF/AL/VP","Ash/AF/AL","Ash/AF/VP","Ash/AL/VP","Ash/AF/VP","Ash/AF/AL/VP"],"notes":[]},"Fort Worth":{"shifts":["","LD/BR","BS/LD","BS/BR","BS/LD/BR","BS/LD","BS/LD/BR"],"notes":[]},"Plano":{"shifts":["","KB/KH/JC","TH/KB/JC","TH/JC/KH/KB","TH/KH/JC","TH/KH/KB","TH/KB/KH/JC"],"notes":[]},"Southlake":{"shifts":["","AD/DP","JM/AD/DP","JM/AD","JM/DP-x/HJ","JM/AD/DP","JM/AD/DP"],"notes":["9/24 DP PTO"]},"Rockwall":{"shifts":["","BM/KA","SH/KA/BM","SH/BM","SH/KA","SH/KA/BM","SH/BM/KA"],"notes":[]},"Waco":{"shifts":["","LS/JM","JA/LS","JA/LS","JA/JM","JA/LS","JA/LS"],"notes":[]},"Temple":{"shifts":["","DP/CB","CB/DP","JM/DP","CB/DP","CB/JM","CB/DP/JM"],"notes":[]},"College Station":{"shifts":["","ZO/CS/GM","KA/CS/ZO","KA/ZO/GM","KA/CS/GM","KA/ZO/CS/GM","KA-x/CS/ZO/GM"],"notes":["9/26 KA PTO"]},"Waxahachie":{"shifts":["","GH","LR/GH","LR/AL","LR/GH","LR/GH","LR/GH"],"notes":[]}}}]}}};

/* ---------------------------------------------------------------- */
const $ = id => document.getElementById(id);

/* Every optional section of the deck runs inside this. A store tapping a checkbox must
   never depend on the schedule, the pace strip or a pushed task rendering cleanly — one
   bad row used to throw, abort the redraw, and leave the tick invisible while it had in
   fact been saved. People then tapped again, and again, toggling it on and off. */
function safe(label, fn){
  try{ return fn(); }
  catch(e){
    try{ console.error("Ops Deck: " + label + " failed —", e); }catch(_){}
    return null;
  }
}

/* Sandboxed frames block alert/confirm/prompt, so the page says things itself. */
let toastTimer = null;
function say(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 4200);
}
const KEY = "wg-ops-store";
let selected = null;   // store object, pending PIN
let active = null;     // store object, unlocked

/* ---- daily check-off state: per store, per calendar day, on this tablet ---- */
function dayKey(){ return "wg-ops-done-" + active.name + "-" + todayISO(); }
function loadDone(){
  try{ return JSON.parse(localStorage.getItem(dayKey()) || "{}"); }catch(e){ return {}; }
}
function saveDone(o){ try{ localStorage.setItem(dayKey(), JSON.stringify(o)); }catch(e){} }
function supplyTickKey(){
  if(!active) return "";
  const p = salesPeriodOn(todayISO());
  return p ? ("wg-ops-supply-" + active.name + "-" + p.year + "-" + p.n) : "";
}
function loadSupplyTick(){
  try{ return JSON.parse(localStorage.getItem(supplyTickKey()) || "null"); }catch(e){ return null; }
}
function saveSupplyTick(rec){
  try{
    const k = supplyTickKey();
    if(!k) return;
    if(rec) localStorage.setItem(k, JSON.stringify(rec));
    else localStorage.removeItem(k);
  }catch(e){}
}
function doneAt(id){
  const rec = loadDone()[id];
  if(!rec) return "";
  const d = new Date(rec.at || rec);
  return d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
}
function doneBy(id){
  const rec = loadDone()[id];
  return (rec && rec.by) || "";
}

/* ---- who is on the tablet right now ---- */
function whoKey(){ return "wg-ops-who-" + active.name + "-" + todayISO(); }
function getWho(){ try{ return localStorage.getItem(whoKey()) || ""; }catch(e){ return ""; } }
function setWho(v){ try{ localStorage.setItem(whoKey(), v); }catch(e){} }

let pendingTask = null;
function askWho(taskId){
  pendingTask = taskId;
  const crew = (crewOn(active.name, todayISO()) || "")
    .split("/").map(s => s.trim().replace(/-.*$/, "")).filter(Boolean);
  const host = $("whoOpts");
  host.innerHTML = "";
  [...new Set(crew)].forEach(i => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "who-opt"; b.textContent = i;
    b.addEventListener("click", () => { setWho(i); $("whoAsk").classList.remove("on"); commitTask(pendingTask); });
    host.appendChild(b);
  });
  $("whoOther").value = "";
  $("whoAsk").classList.add("on");
  if(!crew.length) $("whoOther").focus();
}

function toggleTask(id){
  const o = loadDone();
  if(o[id]){ commitTask(id); return; }        // untick needs no name
  if(!getWho()){ askWho(id); return; }
  commitTask(id);
}

/* Two taps on the same box inside this window are one tap that bounced. */
const TAP_GUARD_MS = 600;
const lastTap = {};

function commitTask(id){
  if(String(id).indexOf("push:") === 0){
    const t = PUSHED.find(x => ("push:" + x.id) === id);
    if(t) togglePushed(t);
    return;
  }
  if(id === "supply"){
    toggleSupply();
    return;
  }

  const now = Date.now();
  if(lastTap[id] && now - lastTap[id] < TAP_GUARD_MS) return;
  lastTap[id] = now;

  const o = loadDone();
  let action;
  if(o[id]){ delete o[id]; action = "clear"; }
  else { o[id] = { at: new Date().toISOString(), by: getWho() }; action = "set"; }
  saveDone(o);

  paintTask(id);            // the box changes now, whatever else happens next
  pushTick(id, action);
  safe("redraw", render);
}

/* Update just this checkbox, straight from stored state. No dependencies. */
function paintTask(id){
  const done = loadDone();
  const on = !!done[id];
  const t = TASKS.find(x => x.id === id);
  document.querySelectorAll('.chk[data-task="' + id + '"]').forEach(b => {
    b.setAttribute("aria-pressed", on ? "true" : "false");
    const lbl = b.querySelector(".lbl");
    if(lbl){
      const by = doneBy(id);
      lbl.textContent = on ? ((doneAt(id) || "Done") + (by ? " · " + by : "")) : (t ? t.short : "Done");
    }
    const tile = b.closest(".tile");
    if(tile){
      const mine = TASKS.filter(x => x.module === (t && t.module));
      tile.classList.toggle("done", mine.length > 0 && mine.every(x => done[x.id]));
    }
  });
}

/* ---- shared tick log (optional) ---- */
function syncOn(){ return !!(CONFIG.sync && CONFIG.sync.url); }
function pushTick(taskId, action){
  if(!syncOn()) return;
  const task = TASKS.find(t => t.id === taskId);
  const body = {
    date: todayISO(), store: active.name, task: taskId,
    label: task ? task.full : taskId, by: getWho(), action: action,
    at: new Date().toISOString()
  };
  try{
    fetch(CONFIG.sync.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // keeps the request preflight-free
      body: JSON.stringify(body)
    }).catch(() => {});   // a store with no signal still ticks locally
  }catch(e){}
}

/* LINK OVERRIDES
   The admin page saves module links to the shared log, so swapping the EOD workbook
   at the start of a period updates every store at once without touching the repo.
   Last known values are cached here so a tablet with no signal still opens the right
   sheet. Built-in CONFIG links are the floor if nothing has ever been overridden. */
const LINKS_KEY = "wg-ops-settings";
let SETTINGS = {};
try{ SETTINGS = JSON.parse(localStorage.getItem(LINKS_KEY) || "{}"); }catch(e){}

function cacheSettings(o){
  SETTINGS = o || {};
  try{ localStorage.setItem(LINKS_KEY, JSON.stringify(SETTINGS)); }catch(e){}
}
function setting(key, fallback){
  return (SETTINGS[key] !== undefined && SETTINGS[key] !== "") ? SETTINGS[key] : fallback;
}
function featureOn(name){
  const v = SETTINGS["feature." + name];
  if(v === undefined || v === "") return !!(CONFIG.features && CONFIG.features[name]);
  return v === "on" || v === "true" || v === "1";
}
/* kept as a name because the admin page and tiles both read link overrides */
const LINK_OVERRIDES = new Proxy({}, { get: (_, k) => SETTINGS["link." + String(k)] || undefined,
                                       has: (_, k) => !!SETTINGS["link." + String(k)],
                                       ownKeys: () => Object.keys(SETTINGS)
                                         .filter(k => k.indexOf("link.") === 0).map(k => k.slice(5)),
                                       getOwnPropertyDescriptor: () => ({enumerable:true, configurable:true}) });

function linkFor(key){
  if(LINK_OVERRIDES[key]) return LINK_OVERRIDES[key];
  const m = CONFIG.modules[key] || {};
  if(active && m.byStore && m.byStore[active.name]) return m.byStore[active.name];
  return m.url || "";
}
function builtInLink(key){
  const m = CONFIG.modules[key] || {};
  return m.url || "";
}

async function loadSettings(){
  if(!syncOn()) return "local";
  try{
    const sep = CONFIG.sync.url.includes("?") ? "&" : "?";
    const r = await fetch(CONFIG.sync.url + sep + "settings=1");
    if(!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    cacheSettings(j.settings || {});
    if(active) render();
    return "live";
  }catch(e){ return "offline"; }
}

async function saveSettings(map){
  // A key that has gone back to its built-in is sent as "" so the shared log drops it,
  // rather than quietly keeping a stale value alive.
  const payload = Object.assign({}, map);
  Object.keys(SETTINGS).forEach(k => { if(!(k in payload)) payload[k] = ""; });
  cacheSettings(map);
  if(active) render();
  if(!syncOn()) return "local";
  try{
    const r = await fetch(CONFIG.sync.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ kind: "settings", settings: payload, by: getWho() || "admin" })
    });
    if(!r.ok) throw new Error("http " + r.status);
    return "live";
  }catch(e){ return "offline"; }
}

function buildGate(){
  ["West","East"].forEach(d => {
    const host = $("grid-" + d.toLowerCase());
    host.innerHTML = "";
    STORES.filter(s => s.district === d).forEach(s => {
      const b = document.createElement("button");
      b.className = "store-btn";
      b.setAttribute("aria-pressed","false");
      b.innerHTML = '<span class="nm"></span><span class="cd"></span>';
      b.querySelector(".nm").textContent = s.name;
      b.querySelector(".cd").textContent = s.code + " · " + d;
      b.addEventListener("click", () => pickStore(s, b));
      host.appendChild(b);
    });
  });
}

function pickStore(s, btn){
  selected = s;
  document.querySelectorAll(".store-btn").forEach(x => x.setAttribute("aria-pressed","false"));
  $("distOpen").setAttribute("aria-pressed","false");
  if(btn) btn.setAttribute("aria-pressed","true");
  $("pinErr").textContent = "";
  if(!CONFIG.requireCode){ unlock(s); return; }
  document.querySelectorAll(".pinFor").forEach(el => el.textContent = s.name);
  $("pinRow").classList.remove("hidden");
  $("mgrStep").style.display = "none";
  $("admStep").style.display = "none";
  $("codeStep").style.display = "";
  $("pin").value = "";
  $("pin").focus();
}

function showAdminStep(){
  selected = null;
  document.querySelectorAll(".store-btn").forEach(x => x.setAttribute("aria-pressed","false"));
  $("distOpen").setAttribute("aria-pressed","false");
  $("adminOpen").setAttribute("aria-pressed","true");
  $("pinErr").textContent = "";
  $("pinRow").classList.remove("hidden");
  $("codeStep").style.display = "none";
  $("mgrStep").style.display = "none";
  $("admStep").style.display = "";
  $("admCode").value = "";
  $("admCode").focus();
}

function tryAdmin(){
  if($("admCode").value.trim() !== String(CONFIG.adminPin)){
    $("pinErr").textContent = "That admin code doesn't match.";
    return;
  }
  $("pinErr").textContent = "";
  $("pinRow").classList.add("hidden");
  $("adminOpen").setAttribute("aria-pressed","false");
  openAdmin();
}

function showManagerStep(){
  selected = null;
  document.querySelectorAll(".store-btn").forEach(x => x.setAttribute("aria-pressed","false"));
  $("distOpen").setAttribute("aria-pressed","true");
  $("pinErr").textContent = "";
  $("pinRow").classList.remove("hidden");
  $("codeStep").style.display = "none";
  $("admStep").style.display = "none";
  $("adminOpen").setAttribute("aria-pressed","false");
  $("mgrStep").style.display = "";
  $("mgrCode").value = "";
  $("mgrCode").focus();
}

function tryManager(){
  if($("mgrCode").value.trim() !== String(CONFIG.managerPin)){
    $("pinErr").textContent = "That company code doesn't match.";
    return;
  }
  $("pinErr").textContent = "";
  $("pinRow").classList.add("hidden");
  $("distOpen").setAttribute("aria-pressed","false");
  openDist();
}

function tryPin(){
  if(!selected){ $("pinErr").textContent = "Pick your store first."; return; }
  const want = String(CONFIG.storePasswords[selected.name] || "");
  if(!want){ unlock(selected); return; }
  if($("pin").value.trim() === want){ unlock(selected); }
  else { $("pinErr").textContent = "That code doesn't match " + selected.name + ". Check with your manager."; }
}

function unlock(s){
  active = s;
  try{ localStorage.setItem(KEY, s.name); }catch(e){}
  $("gate").style.display = "none";
  $("app").classList.add("on");
  render();
  showHandover();
  try{
    const mine = localNote(s.name, todayISO());
    if(mine && mine.text) $("noteText").value = mine.text;
  }catch(e){}
  loadPushed().then(() => { renderPushed(); renderSupply(); renderMeeting(); maybeSupplyPopup(); maybeMeetPopup(); });
}

function relock(){
  active = null; selected = null;
  try{ localStorage.removeItem(KEY); }catch(e){}
  $("app").classList.remove("on");
  $("gate").style.display = "flex";
  $("pinRow").classList.add("hidden");
  document.querySelectorAll(".store-btn").forEach(x => x.setAttribute("aria-pressed","false"));
}

const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>';

function tileFor(m){
  const href = m.internal ? "" : linkFor(m.key);
  const unset = !href && !m.internal;
  const mine = TASKS.filter(t => t.module === m.key);
  const done = loadDone();
  const supplyRec = m.key === "supply" ? loadSupplyTick() : null;
  const allDone = m.key === "supply"
    ? !!supplyRec
    : (mine.length > 0 && mine.every(t => done[t.id]));

  const wrap = document.createElement("div");
  wrap.className = "tile" + (unset ? " unset" : "") + (allDone ? " done" : "");

  const embeds = href && isEmbeddable(href);
  const main = document.createElement((href && !embeds) ? "a" : "button");
  main.className = "tile-main";
  if(href && !embeds){ main.href = href; main.target = "_blank"; main.rel = "noopener"; }
  else {
    main.type = "button";
    main.addEventListener("click",
      m.internal ? openSched
      : embeds ? () => openViewer(m.title, href, (mine[0] || {}).id)
      : () => say(m.title + " isn't linked yet — send Zach the Google Form or Sheet link."));
  }
  const goLabel = m.internal ? "View schedule →"
    : !href ? "Link not set yet"
    : embeds ? "Open here →" : "Open →";
  main.innerHTML =
    '<div class="tile-top">' + ICONS[m.key] + '<span class="tag">' + tileTag(m) + '</span></div>' +
    '<h3></h3><p></p><span class="go">' + goLabel + '</span>';
  main.querySelector("h3").textContent = m.title;
  main.querySelector("p").textContent = m.desc;
  if(href && !embeds && !m.internal){
    const badge = document.createElement("span");
    badge.className = "opens-out";
    badge.textContent = "Opens in Google";
    badge.title = "Google Sheets won't run inside another page while they're editable, so this one opens in its own tab.";
    main.querySelector(".tile-top").appendChild(badge);
  }
  wrap.appendChild(main);

  if(mine.length){
    const row = document.createElement("div");
    row.className = "tile-checks";
    mine.forEach(t => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chk";
      b.dataset.task = t.id;
      const on = !!done[t.id];
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.setAttribute("aria-label", t.full + (on ? " — done" : " — not done yet"));
      b.innerHTML = '<span class="box">' + TICK + '</span><span class="lbl"></span>';
      const by = doneBy(t.id);
      b.querySelector(".lbl").textContent = on ? ((doneAt(t.id) || "Done") + (by ? " · " + by : "")) : t.short;
      b.addEventListener("click", () => toggleTask(t.id));
      row.appendChild(b);
    });
    wrap.appendChild(row);
  }
  if(m.key === "supply" && href){
    const row = document.createElement("div");
    row.className = "tile-checks";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chk";
    b.dataset.task = "supply";
    const on = !!supplyRec;
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.setAttribute("aria-label", "Supply order" + (on ? " — submitted" : " — not submitted yet"));
    b.innerHTML = '<span class="box">' + TICK + '</span><span class="lbl"></span>';
    const when = supplyRec && supplyRec.at ? new Date(supplyRec.at).toLocaleDateString([], {month:"short", day:"numeric"}) : "";
    b.querySelector(".lbl").textContent = on
      ? ("Submitted" + (when ? " · " + when : "") + (supplyRec.by ? " · " + supplyRec.by : ""))
      : "Mark submitted";
    b.addEventListener("click", () => toggleTask("supply"));
    row.appendChild(b);
    wrap.appendChild(row);
  }
  return wrap;
}
function tileTag(m){
  if(m.key !== "supply") return m.tag;
  const p = salesPeriodOn(todayISO());
  if(!p) return m.tag;
  const due = firstThursdayISO(p.start);
  const today = todayISO();
  if(loadSupplyTick()) return "Submitted";
  if(today > due) return "Was due " + fmtPeriodEnd(due);
  if(today === due) return "Due today";
  return "Due " + fmtPeriodEnd(due);
}

function render(){
  const w = getWho();
  const el = $("whoami");
  el.innerHTML = "";
  if(w){
    el.appendChild(document.createTextNode("Ticking as " + w + " · "));
    const b = document.createElement("button");
    b.type = "button"; b.textContent = "not you?";
    b.addEventListener("click", () => { setWho(""); render(); });
    el.appendChild(b);
  }
  $("hdrStore").textContent = active.name;
  const per = salesPeriodOn(todayISO());
  $("hdrMeta").textContent = active.code + " · " + active.district + " District" +
    (per ? " · Period " + per.n + " · Day " + per.day + " of " + per.len : "");
  safe("manager tasks", renderPushed);
  safe("supply order", renderSupply);
  safe("meeting today", renderMeeting);

  $("deckDaily").innerHTML = "";
  $("deckWeekly").innerHTML = "";
  MODULES.forEach(m => {
    safe("tile:" + m.key, () => {
      (m.group === "daily" ? $("deckDaily") : $("deckWeekly")).appendChild(tileFor(m));
    });
  });
  safe("status band", tick);
}

function nowAction(key, label){
  if(key === "schedule"){
    const b = document.createElement("button");
    b.className = "btn"; b.textContent = label;
    b.addEventListener("click", openSched);
    return b;
  }
  const href = linkFor(key);
  if(href && isEmbeddable(href)){
    const b = document.createElement("button");
    b.className = "btn"; b.textContent = label;
    const t = TASKS.find(x => x.module === key);
    b.addEventListener("click", () => openViewer(label, href, t ? t.id : null));
    return b;
  }
  if(href){
    const a = document.createElement("a");
    a.className = "btn"; a.href = href; a.target = "_blank"; a.rel = "noopener";
    a.textContent = label;
    a.style.textDecoration = "none";
    return a;
  }
  const b = document.createElement("button");
  b.className = "btn btn-ghost"; b.textContent = label + " (not linked)";
  b.addEventListener("click", () => say(label + " isn't linked yet."));
  return b;
}

function progressStrip(){
  const done = loadDone();
  const hh = new Date().getHours();
  const isOpen = t => t.when !== "pm" || hh >= CONFIG.hours.pmStarts;

  let host = $("progRow");
  if(!host){
    host = document.createElement("div");
    host.className = "prog"; host.id = "progRow";
    host.innerHTML = '<span class="pips" id="pips"></span><span class="prog-t" id="progT"></span>';
    $("nowSub").parentNode.appendChild(host);
  }

  const pips = $("pips");
  pips.innerHTML = "";
  TASKS.forEach(task => {
    const on = !!done[task.id];
    const s = document.createElement("span");
    s.className = "pip" + (on ? " on" : (isOpen(task) ? " due" : ""));
    s.title = task.full + (on ? " — done " + doneAt(task.id) : " — not done yet");
    pips.appendChild(s);
  });

  const ticked = TASKS.filter(task => done[task.id]).length;
  const open = TASKS.filter(task => !done[task.id] && isOpen(task));
  const txt = $("progT");
  txt.innerHTML = "";
  const b = document.createElement("b");
  b.textContent = ticked + " of " + TASKS.length;
  txt.appendChild(b);
  txt.appendChild(document.createTextNode(
    " ticked off today" + (open.length ? "  ·  still open: " + open.map(x => x.full).join(", ") : "  ·  all clear")));
}

function tick(){
  const d = new Date();
  const hh = d.getHours();
  const day = d.getDay();
  $("clockT").textContent = d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
  $("clockD").textContent = d.toLocaleDateString([], {weekday:"long", month:"short", day:"numeric"});
  const pNow = salesPeriodOn(todayISO());
  $("footStamp").textContent = d.toLocaleDateString([], {year:"numeric", month:"2-digit", day:"2-digit"}) +
    (pNow ? "  ·  P" + pNow.n + " D" + pNow.day + "/" + pNow.len : "") +
    "  ·  build " + BUILD;

  const crew = safe("crew", () => crewOn(active.name, todayISO()));
  let line = $("todayLine");
  if(!line){
    line = document.createElement("div");
    line.className = "today-line"; line.id = "todayLine";
    $("nowSub").parentNode.appendChild(line);
  }
  line.textContent = crew ? "On today: " + crew.split("/").map(s=>s.trim()).filter(Boolean).join("  ·  ")
                          : (crew === "" ? "On today: nobody scheduled" : "");

  const flag = $("nowFlag"), title = $("nowTitle"), sub = $("nowSub"), acts = $("nowActions");
  acts.innerHTML = "";
  flag.className = "now-flag";

  const meet = meetingToday();
  function addMeetJoin(){
    if(!meet || !meet.url) return;
    const a = document.createElement("a");
    a.className = "btn"; a.href = meet.url; a.target = "_blank"; a.rel = "noopener";
    a.textContent = "Join 9 AM meeting";
    a.style.textDecoration = "none";
    acts.appendChild(a);
  }

  if(meet && day === 2 && hh < CONFIG.hours.pmStarts){
    flag.classList.add("work"); flag.textContent = "Tuesday";
    title.textContent = meet.title + " · 9 AM";
    sub.textContent = meet.url
      ? "Managers-only meeting. Join from this button — the link is set in Admin."
      : "Managers meeting this morning. Paste the join link in Admin so stores can tap it here.";
    addMeetJoin();
    acts.appendChild(nowAction("opening","Opening checklist"));
  } else if(day === 6 && hh < CONFIG.hours.pmStarts){
    flag.classList.add("work"); flag.textContent = "Saturday";
    title.textContent = "Training recap day";
    sub.textContent = "Run Saturday training, then submit the Weekly Training Recap the same day — the compliance report only counts what's submitted.";
    if(meet){
      title.textContent = meet.title + " · 9 AM";
      sub.textContent = (meet.url ? meet.blurb + " " : "Paste today's join link in Admin. ") +
        "Then run Saturday training and submit the Weekly Training Recap.";
      addMeetJoin();
    }
    acts.appendChild(nowAction("workshop","Submit recap"));
    acts.appendChild(nowAction("opening","Opening checklist"));
  } else if(hh < CONFIG.hours.amEnds){
    flag.classList.add("open"); flag.textContent = "Opening";
    title.textContent = "Start the day";
    sub.textContent = "Opening checklist and the morning banking entry before the first appointment.";
    acts.appendChild(nowAction("opening","Opening checklist"));
    acts.appendChild(nowAction("banking","Banking sheet"));
  } else if(hh < CONFIG.hours.pmStarts){
    flag.classList.add("work"); flag.textContent = "Mid-day";
    title.textContent = "On the floor";
    sub.textContent = "Keep the end of day form current as sales come in. Closing tasks open at " + CONFIG.hours.pmStarts + ":00.";
    acts.appendChild(nowAction("eod","End of day form"));
    acts.appendChild(nowAction("schedule","Schedule"));
  } else {
    flag.classList.add("close"); flag.textContent = "Closing";
    title.textContent = "Close it out";
    sub.textContent = "Closing checklist, the afternoon banking entry, and the end of day form before you leave.";
    acts.appendChild(nowAction("closing","Closing checklist"));
    acts.appendChild(nowAction("banking","Banking sheet"));
    acts.appendChild(nowAction("eod","End of day form"));
  }
  const sInfo = supplyInfo(todayISO());
  if(sInfo && sInfo.url && !loadSupplyTick() && (sInfo.open || sInfo.overdue)){
    acts.appendChild(nowAction("supply", sInfo.overdue ? "Supply order overdue" : "Supply order"));
  }
  safe("progress", progressStrip);
  safe("period", periodStrip);
  safe("pace", paceStrip);
}

/* Where this store stands against goal. Hidden unless the numbers are actually there,
   because a pace line showing zeroes is worse than no pace line. */

function periodStrip(){
  const p = salesPeriodOn(todayISO());
  let host = $("periodRow");
  if(!p){ if(host) host.remove(); return; }
  if(!host){
    host = document.createElement("div");
    host.className = "period-chip";
    host.id = "periodRow";
    $("nowSub").parentNode.appendChild(host);
  }
  const pct = Math.round((p.day / p.len) * 100);
  host.innerHTML = "";
  const name = document.createElement("span");
  name.className = "pn";
  name.textContent = "Period " + p.n;
  host.appendChild(name);
  const bar = document.createElement("span");
  bar.className = "period-bar";
  bar.title = "Day " + p.day + " of " + p.len;
  const fill = document.createElement("i");
  fill.style.width = Math.min(100, pct) + "%";
  bar.appendChild(fill);
  host.appendChild(bar);
  const det = document.createElement("span");
  det.className = "pd";
  const left = p.left === 0 ? "last day" : (p.left === 1 ? "1 day left" : p.left + " days left");
  det.textContent = "Day " + p.day + " of " + p.len + "  ·  " + left + "  ·  ends " + fmtPeriodEnd(p.end);
  host.appendChild(det);
}

function paceStrip(){
  let host = $("paceRow");
  const on = featureOn("pace") && PACE && PACE.stores && PACE.stores[active.name] && PACE.stores[active.name].goal;
  if(!on){ if(host) host.remove(); return; }

  const s = PACE.stores[active.name];
  const c = PACE.company || {};
  if(!host){
    host = document.createElement("div");
    host.className = "pace"; host.id = "paceRow";
    $("nowSub").parentNode.appendChild(host);
  }
  const pct = Math.round(s.pct * 100);
  const expected = c.expectedPct ? Math.round(c.expectedPct * 100) : null;
  const behind = expected !== null && pct < expected;

  host.innerHTML = "";
  const bar = document.createElement("span");
  bar.className = "pace-bar";
  const fill = document.createElement("i");
  fill.style.width = Math.min(100, pct) + "%";
  fill.className = behind ? "behind" : "ahead";
  bar.appendChild(fill);
  if(expected !== null){
    const mark = document.createElement("b");
    mark.style.left = Math.min(100, expected) + "%";
    mark.title = "Where the period says you should be: " + expected + "%";
    bar.appendChild(mark);
  }
  host.appendChild(bar);

  const txt = document.createElement("span");
  txt.className = "pace-t";
  const strong = document.createElement("b");
  strong.textContent = money(s.sales) + " of " + money(s.goal);
  txt.appendChild(strong);
  let tail = "  ·  " + pct + "%";
  if(expected !== null) tail += " (period is " + expected + "% through)";
  if(s.needed) tail += "  ·  " + money(s.needed) + "/day to close it";
  txt.appendChild(document.createTextNode(tail));
  host.appendChild(txt);
}


/* Schedule and pace both come from the shared log when it's configured, and fall back
   to what the page shipped with (schedule) or simply stay hidden (pace). Both cache, so
   a tablet that loses signal still opens the right week. */
const SCHED_KEY = "wg-ops-schedule";
try{
  const cached = JSON.parse(localStorage.getItem(SCHED_KEY) || "null");
  if(cached && cached.periods && Object.keys(cached.periods).length) SCHEDULE.periods = cached.periods;
}catch(e){}

async function loadSchedule(){
  if(!syncOn()) return "local";
  try{
    const sep = CONFIG.sync.url.includes("?") ? "&" : "?";
    const r = await fetch(CONFIG.sync.url + sep + "schedule=1");
    if(!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    if(!j.ok || !j.periods || !Object.keys(j.periods).length) return "empty";
    SCHEDULE.periods = j.periods;
    try{ localStorage.setItem(SCHED_KEY, JSON.stringify({periods: j.periods})); }catch(e){}
    if($("sched").classList.contains("on")){ weekPtr = null; renderSched(); }
    if(active) render();
    return "live";
  }catch(e){ return "offline"; }
}

const PACE_KEY = "wg-ops-pace";
let PACE = null;
try{ PACE = JSON.parse(localStorage.getItem(PACE_KEY) || "null"); }catch(e){}

async function loadPace(){
  if(!syncOn() || !featureOn("pace")) return "off";
  try{
    const sep = CONFIG.sync.url.includes("?") ? "&" : "?";
    const r = await fetch(CONFIG.sync.url + sep + "pace=1");
    if(!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    if(!j.ok) return "empty";
    PACE = j;
    try{ localStorage.setItem(PACE_KEY, JSON.stringify(j)); }catch(e){}
    if(active) render();
    return "live";
  }catch(e){ return "offline"; }
}

const money = n => "$" + Math.round(n).toLocaleString();

/* ================= SCHEDULE ENGINE ================= */
const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
let weekPtr = null;   // {period:"9", idx:2}

function allWeeks(){
  const out = [];
  Object.keys(SCHEDULE.periods).sort((a,b)=>a-b).forEach(pk => {
    SCHEDULE.periods[pk].weeks.forEach((w,i) => out.push({period:pk, idx:i, week:w}));
  });
  return out;
}
function todayISO(){
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function findWeekFor(iso){
  const ws = allWeeks();
  for(let i=0;i<ws.length;i++){
    if(ws[i].week.days.some(d => d.d === iso)) return i;
  }
  // not in range — fall back to the nearest week that starts after today, else the last one
  for(let i=0;i<ws.length;i++){
    const first = ws[i].week.days.map(d=>d.d).filter(Boolean)[0];
    if(first && first > iso) return i;
  }
  return ws.length - 1;
}
function fmtShort(iso){
  if(!iso) return "";
  const [y,m,dd] = iso.split("-");
  return m.replace(/^0/,"") + "/" + dd.replace(/^0/,"");
}
function crewOn(storeName, iso){
  const ws = allWeeks();
  for(const w of ws){
    const di = w.week.days.findIndex(d => d.d === iso);
    if(di < 0) continue;
    const s = w.week.stores[storeName];
    if(!s) return null;
    return (s.shifts[di] || "").trim();
  }
  return null;
}
function renderSched(){
  const ws = allWeeks();
  if(weekPtr === null) weekPtr = findWeekFor(todayISO());
  weekPtr = Math.max(0, Math.min(ws.length - 1, weekPtr));
  const cur = ws[weekPtr];
  const store = cur.week.stores[active.name];
  const dates = cur.week.days.map(d => d.d).filter(Boolean);

  $("schStore").textContent = active.name + " — schedule";
  $("schRange").textContent = "Period " + cur.period + " · Week " + (cur.idx + 1) +
    (dates.length ? " · " + fmtShort(dates[0]) + " – " + fmtShort(dates[dates.length-1]) : "");
  $("schPrev").disabled = weekPtr === 0;
  $("schNext").disabled = weekPtr === ws.length - 1;

  const host = $("schContent");
  host.innerHTML = "";
  if(!store){
    const e = document.createElement("div");
    e.className = "sched-empty";
    e.textContent = "No schedule rows for " + active.name + " in this week.";
    host.appendChild(e);
    return;
  }

  const iso = todayISO();
  const grid = document.createElement("div");
  grid.className = "week";
  for(let i = 1; i <= 6; i++){          // Monday .. Saturday
    const day = cur.week.days[i] || {d:"",label:""};
    const cell = document.createElement("div");
    cell.className = "day" + (day.d === iso ? " today" : "");
    const raw = (store.shifts[i] || "").trim();

    const h = document.createElement("div");
    h.className = "day-h";
    h.innerHTML = '<span class="dow"></span><span class="dt"></span>';
    h.querySelector(".dow").textContent = DOW[i];
    h.querySelector(".dt").textContent = fmtShort(day.d);
    cell.appendChild(h);

    if(day.label){
      const f = document.createElement("span");
      f.className = "day-flag";
      f.textContent = day.label;
      cell.appendChild(f);
    }

    const crew = document.createElement("div");
    crew.className = "crew";
    const people = raw.split("/").map(s => s.trim()).filter(Boolean);
    if(people.length){
      people.forEach(t => {
        const c = document.createElement("span");
        c.className = "who" + (/-x$/i.test(t) ? " flagged" : "");
        c.textContent = t;
        crew.appendChild(c);
      });
    } else {
      const n = document.createElement("span");
      n.className = "none";
      n.textContent = "—";
      crew.appendChild(n);
    }
    cell.appendChild(crew);
    grid.appendChild(cell);
  }
  host.appendChild(grid);

  if(store.notes && store.notes.length){
    const nb = document.createElement("div");
    nb.className = "notes";
    nb.innerHTML = "<h3>Notes this week</h3><ul></ul>";
    const ul = nb.querySelector("ul");
    store.notes.forEach(t => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
    host.appendChild(nb);
  }

  const lg = document.createElement("p");
  lg.className = "legend";
  lg.textContent = "Initials are shown exactly as they appear on the master schedule. Anything marked with a suffix (-x, -4, and so on) is explained in the notes for that week. If a day looks wrong here, it's wrong on the master sheet — tell your RM.";
  host.appendChild(lg);
}
function openSched(){
  const src = (CONFIG.modules.schedule && CONFIG.modules.schedule.url) || "";
  const a = $("schSource");
  if(src){ a.href = src; a.style.display = ""; } else { a.style.display = "none"; }
  weekPtr = null; $("sched").classList.add("on"); renderSched();
}
function closeSched(){ $("sched").classList.remove("on"); }


/* ================= DISTRICT VIEW ================= */
let distISO = null;
let distCache = {};

function shiftISO(iso, days){
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + days);
  return dt.getFullYear() + "-" + String(dt.getMonth()+1).padStart(2,"0") + "-" + String(dt.getDate()).padStart(2,"0");
}
function prettyISO(iso){
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y, m-1, d).toLocaleDateString([], {weekday:"long", month:"long", day:"numeric"});
}
function localDayFor(storeName, iso){
  try{ return JSON.parse(localStorage.getItem("wg-ops-done-" + storeName + "-" + iso) || "{}"); }
  catch(e){ return {}; }
}

function mondayOf(iso){
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  const shift = (dt.getDay() + 6) % 7;      // Monday = 0
  dt.setDate(dt.getDate() - shift);
  return isoOf(dt);
}
function isoOf(dt){
  return dt.getFullYear() + "-" + String(dt.getMonth()+1).padStart(2,"0") + "-" + String(dt.getDate()).padStart(2,"0");
}
/* Stores trade Monday to Saturday, so Sundays are not counted anywhere. */
function weekDates(mondayISO){
  const out = [];
  for(let i=0;i<6;i++) out.push(shiftISO(mondayISO, i));
  return out;
}
function monthDates(iso){
  const [y,m] = iso.split("-").map(Number);
  const out = [];
  const dt = new Date(y, m-1, 1);
  while(dt.getMonth() === m-1){
    if(dt.getDay() !== 0) out.push(isoOf(dt));
    dt.setDate(dt.getDate() + 1);
  }
  return out;
}
function datesForPeriod(){
  if(distPeriod === "day") return [distISO];
  if(distPeriod === "week") return weekDates(mondayOf(distISO));
  return monthDates(distISO);
}

/* One request for a span, rather than one per day. */
async function fetchSpan(dates){
  const out = {};
  if(!syncOn()){
    dates.forEach(d => { out[d] = {}; STORES.forEach(s => {
      const v = localDayFor(s.name, d);
      if(Object.keys(v).length) out[d][s.name] = v;
    }); });
    return { data: out, mode: "local" };
  }
  const from = dates[0], to = dates[dates.length-1];
  const cacheKey = from + ".." + to;
  if(distCache[cacheKey]) return { data: distCache[cacheKey], mode: "remote" };
  try{
    const sep = CONFIG.sync.url.includes("?") ? "&" : "?";
    const [r, rf] = await Promise.all([
      fetch(CONFIG.sync.url + sep + "from=" + from + "&to=" + to),
      fetch(CONFIG.sync.url + sep + "forms=1&from=" + from + "&to=" + to).catch(() => null)
    ]);
    if(!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    const days = j.days || {};
    dates.forEach(d => { out[d] = canonStores(days[d] || {}); });

    /* A real form submission beats a tick. Opening, closing and workshop already
       produce a response row; the tick for those is only a convenience copy. */
    if(rf && rf.ok){
      try{
        const jf = await rf.json();
        const fdays = (jf && jf.days) || {};
        dates.forEach(d => {
          const src = canonStores(fdays[d]); if(!src) return;
          Object.keys(src).forEach(store => {
            if(!out[d][store]) out[d][store] = {};
            Object.keys(src[store]).forEach(task => { out[d][store][task] = src[store][task]; });
          });
        });
      }catch(e){}
    }

    distCache[cacheKey] = out;
    return { data: out, mode: "remote" };
  }catch(e){
    dates.forEach(d => { out[d] = {}; STORES.forEach(s => {
      const v = localDayFor(s.name, d);
      if(Object.keys(v).length) out[d][s.name] = v;
    }); });
    return { data: out, mode: "error" };
  }
}

async function fetchDay(iso){
  if(!syncOn()) return null;
  if(distCache[iso]) return distCache[iso];
  try{
    const r = await fetch(CONFIG.sync.url + (CONFIG.sync.url.includes("?") ? "&" : "?") + "date=" + iso);
    if(!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    distCache[iso] = canonStores(j.stores || {});
    return distCache[iso];
  }catch(e){ return "error"; }
}

/* The monthly compliance report is built by hand from several sources. This drops the
   deck's half of it out as a spreadsheet-ready file for whatever period is on screen. */
let lastSpan = { dates: [], data: {} };

function exportCSV(){
  const { dates, data } = lastSpan;
  if(!dates.length){ say("Nothing loaded to export yet."); return; }

  const rows = [["Date","District","Store","Task","Status","By","Time","Source"]];
  const inScope = STORES.filter(s => distScope === "all" || s.district === distScope);
  dates.forEach(d => inScope.forEach(s => TASKS.forEach(t => {
    const rec = data[d] && data[d][s.name] && data[d][s.name][t.id];
    const at = rec ? new Date(rec.at || rec) : null;
    rows.push([
      d, s.district, s.name, t.full,
      rec ? "done" : "not recorded",
      rec && rec.by ? rec.by : "",
      at ? at.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}) : "",
      rec ? (rec.src === "form" ? "form response" : "tick") : ""
    ]);
  })));

  const csv = rows.map(r => r.map(v => {
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(",")).join("\r\n");

  const name = "ops-deck-" + (distScope === "all" ? "company" : distScope.toLowerCase()) +
    "-" + dates[0] + (dates.length > 1 ? "_to_" + dates[dates.length-1] : "") + ".csv";

  deliverFile(name, "\ufeff" + csv, rows.length - 1);
}

/* Saving a file works differently depending on where the deck is being viewed: a
   normal browser takes a blob link, while a sandboxed preview has to hand the file to
   its host. Try the host first, fall back to the link, and say so if neither lands. */
async function deliverFile(name, text, count){
  try{
    if(window.claude && typeof window.claude.use === "function"){
      const dl = await window.claude.use("downloads");
      if(dl){
        try{
          await dl.save({ filename: name, data: text });
          say("Exported " + count + " rows.");
        }catch(err){
          if(err && err.code === "declined") say("Export cancelled.");
          else say("Couldn't save the file here — try the deck in its own browser tab.");
        }
        return;
      }
    }
  }catch(e){}

  try{
    const blob = new Blob([text], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    say("Exported " + count + " rows.");
  }catch(e){
    say("This view blocked the download. Open the deck in its own browser tab and try again.");
  }
}

function openDist(){
  distISO = todayISO();
  distScope = "all";
  distPeriod = "day";
  distView = "stores";
  $("dist").classList.add("on");
  syncScopeButtons();
  renderView();
}

function renderView(){
  const dm = distView === "dm";
  $("periodSel").style.display = (dm || distView === "tasks") ? "none" : "";
  $("distExport").style.display = (distView === "stores") ? "" : "none";
  if(dm) return renderDM();
  if(distView === "compare") return renderCompare();
  if(distView === "tasks") return renderTasks();
  return renderDist();
}
function closeDist(){ $("dist").classList.remove("on"); }

let distScope = "all";
let distPeriod = "day";
function syncScopeButtons(){
  $("scopeSel").querySelectorAll("button").forEach(b =>
    b.setAttribute("aria-pressed", b.dataset.scope === distScope ? "true" : "false"));
  $("periodSel").querySelectorAll("button").forEach(b =>
    b.setAttribute("aria-pressed", b.dataset.period === distPeriod ? "true" : "false"));
  $("viewSel").querySelectorAll("button").forEach(b =>
    b.setAttribute("aria-pressed", b.dataset.view === distView ? "true" : "false"));
}

function scoreClass(n){ return n === TASKS.length ? "full" : (n === 0 ? "none" : "part"); }

function storeCard(store, day){
  const done = TASKS.filter(t => day && day[t.id]).length;

  const card = document.createElement("div");
  card.className = "scard";

  const h = document.createElement("div");
  h.className = "scard-h";
  h.innerHTML = '<div><div class="nm"></div><div class="cd"></div></div><span class="score"></span>';
  h.querySelector(".nm").textContent = store.name;
  h.querySelector(".cd").textContent = store.code + " · " + store.district;
  const sc = h.querySelector(".score");
  sc.classList.add(scoreClass(done));
  sc.textContent = done + "/" + TASKS.length;
  card.appendChild(h);

  const cells = document.createElement("div");
  cells.className = "cells";
  TASKS.forEach(t => {
    const rec = day && day[t.id];
    const c = document.createElement("div");
    c.className = "cell" + (rec ? " yes" : "") + (rec && rec.src === "form" ? " src-form" : "");
    c.innerHTML = '<span class="mk">' + TICK + '</span><span class="ab"></span>';
    c.querySelector(".ab").textContent = t.abbr;
    if(rec){
      const at = new Date(rec.at || rec);
      c.title = t.full + " — " + (rec.src === "form" ? "submitted" : "ticked") + " " +
        (rec.by ? "by " + rec.by + ", " : "") +
        at.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
    } else {
      c.title = t.full + " — nothing recorded";
    }
    cells.appendChild(c);
  });
  card.appendChild(cells);

  const f = document.createElement("div");
  f.className = "scard-f";
  const names = [...new Set(TASKS.map(t => day && day[t.id] && day[t.id].by).filter(Boolean))];
  if(names.length){
    f.innerHTML = "<b></b>";
    f.querySelector("b").textContent = names.join(", ");
  } else if(done){
    f.textContent = "no name recorded";
  } else {
    f.textContent = "nothing ticked";
  }
  card.appendChild(f);
  return card;
}

function doneCount(day){ return TASKS.filter(t => day && day[t.id]).length; }
function levelOf(n){ return n === TASKS.length ? "full" : (n > 0 ? "part" : ""); }
const DW = ["Mon","Tue","Wed","Thu","Fri","Sat"];

function weekCard(store, span, dates){
  const total = dates.length * TASKS.length;
  let ticked = 0;
  dates.forEach(d => { ticked += doneCount(span[d] && span[d][store.name]); });

  const card = document.createElement("div");
  card.className = "scard";
  const h = document.createElement("div");
  h.className = "scard-h";
  h.innerHTML = '<div><div class="nm"></div><div class="cd"></div></div><span class="score"></span>';
  h.querySelector(".nm").textContent = store.name;
  h.querySelector(".cd").textContent = store.code + " · " + store.district;
  const sc = h.querySelector(".score");
  sc.classList.add(ticked === total ? "full" : (ticked ? "part" : "none"));
  sc.textContent = ticked + "/" + total;
  card.appendChild(h);

  const cells = document.createElement("div");
  cells.className = "wcells";
  dates.forEach((d, i) => {
    const n = doneCount(span[d] && span[d][store.name]);
    const c = document.createElement("div");
    c.className = "wcell " + levelOf(n) + (d === todayISO() ? " today" : "");
    c.innerHTML = '<span class="dw"></span><span class="ct"></span>';
    c.querySelector(".dw").textContent = DW[i];
    c.querySelector(".ct").textContent = String(n);
    c.title = prettyISO(d) + " — " + n + " of " + TASKS.length + " ticked";
    cells.appendChild(c);
  });
  card.appendChild(cells);

  const names = new Set();
  dates.forEach(d => TASKS.forEach(t => {
    const rec = span[d] && span[d][store.name] && span[d][store.name][t.id];
    if(rec && rec.by) names.add(rec.by);
  }));
  const f = document.createElement("div");
  f.className = "scard-f";
  if(names.size){ f.innerHTML = "<b></b>"; f.querySelector("b").textContent = [...names].join(", "); }
  else f.textContent = "nothing ticked this week";
  card.appendChild(f);
  return card;
}

function monthCard(store, span, dates){
  const total = dates.length * TASKS.length;
  let ticked = 0, fullDays = 0;
  dates.forEach(d => {
    const n = doneCount(span[d] && span[d][store.name]);
    ticked += n;
    if(n === TASKS.length) fullDays++;
  });
  const pct = total ? Math.round(ticked / total * 100) : 0;

  const card = document.createElement("div");
  card.className = "scard";
  const h = document.createElement("div");
  h.className = "scard-h";
  h.innerHTML = '<div><div class="nm"></div><div class="cd"></div></div><span class="score"></span>';
  h.querySelector(".nm").textContent = store.name;
  h.querySelector(".cd").textContent = store.code + " · " + store.district;
  const sc = h.querySelector(".score");
  sc.classList.add(pct === 100 ? "full" : (pct ? "part" : "none"));
  sc.textContent = pct + "%";
  card.appendChild(h);

  const cells = document.createElement("div");
  cells.className = "mcells";
  dates.forEach(d => {
    const n = doneCount(span[d] && span[d][store.name]);
    const c = document.createElement("div");
    c.className = "mcell " + levelOf(n) + (d === todayISO() ? " today" : "");
    c.title = prettyISO(d) + " — " + n + " of " + TASKS.length + " ticked";
    cells.appendChild(c);
  });
  card.appendChild(cells);

  const f = document.createElement("div");
  f.className = "scard-f";
  f.innerHTML = "<b></b>";
  f.querySelector("b").textContent = fullDays + " of " + dates.length + " days complete";
  card.appendChild(f);
  return card;
}

function periodLabel(){
  let core;
  if(distPeriod === "day") core = prettyISO(distISO);
  else if(distPeriod === "week"){
    const ds = weekDates(mondayOf(distISO));
    core = "Week of " + prettyISO(ds[0]).replace(/^\w+, /, "") + " — " + fmtShort(ds[ds.length-1]);
  } else {
    const [y,m] = distISO.split("-").map(Number);
    core = new Date(y, m-1, 1).toLocaleDateString([], {month:"long", year:"numeric"});
  }
  const p = salesPeriodOn(distPeriod === "day" ? distISO : (distPeriod === "week" ? mondayOf(distISO) : distISO));
  return p ? core + "  ·  " + periodPhrase(p) : core;
}

function stepPeriod(dir){
  if(distView === "dm"){
    const [y,m] = distISO.split("-").map(Number);
    distISO = isoOf(new Date(y, m - 1 + dir, 1));
    return;
  }
  if(distPeriod === "day"){ distISO = shiftISO(distISO, dir); return; }
  if(distPeriod === "week"){ distISO = shiftISO(mondayOf(distISO), dir * 7); return; }
  const [y,m] = distISO.split("-").map(Number);
  const dt = new Date(y, m - 1 + dir, 1);
  distISO = isoOf(dt);
}

function atLatest(){
  const t = todayISO();
  if(distPeriod === "day") return distISO >= t;
  if(distPeriod === "week") return mondayOf(distISO) >= mondayOf(t);
  return distISO.slice(0,7) >= t.slice(0,7);
}






/* ================= SEND A TASK ================= */
async function renderTasks(){
  $("distDate").textContent = "Open tasks";
  $("distTitle").textContent = "Send a task";
  $("distPrev").disabled = true;
  $("distNext").disabled = true;

  const host = $("distContent");
  host.innerHTML = "";

  if(!syncOn()){
    const n = document.createElement("div");
    n.className = "dist-note";
    n.innerHTML = "<h3>Needs the shared log</h3><p>A task you send has to reach other people's tablets, so this only works once <code>CONFIG.sync.url</code> is set.</p>";
    host.appendChild(n);
    return;
  }

  // composer
  const box = document.createElement("div");
  box.className = "newtask";
  box.innerHTML =
    "<h3>New task</h3>" +
    '<input type="text" id="ntTitle" maxlength="90" placeholder="What needs doing? e.g. Photograph your window display">' +
    '<textarea id="ntDetail" maxlength="300" placeholder="Any detail they need (optional)"></textarea>' +
    '<div class="row">' +
      '<select id="ntScope"></select>' +
      '<input type="date" id="ntDue">' +
      '<input type="text" id="ntBy" maxlength="20" placeholder="From (your name)">' +
      '<button class="btn" id="ntSend">Send it</button>' +
    '</div>';
  host.appendChild(box);

  /* Everyone, a district, or a single store. The backend already accepts a
     comma-separated list, so one store is just a list of one. */
  const scope = $("ntScope");
  const opt = (value, label) => {
    const o = document.createElement("option");
    o.value = value; o.textContent = label;
    return o;
  };
  scope.appendChild(opt("all", "Every store"));
  scope.appendChild(opt("West", "West district — " + STORES.filter(s => s.district === "West").length + " stores"));
  scope.appendChild(opt("East", "East district — " + STORES.filter(s => s.district === "East").length + " stores"));
  ["West","East"].forEach(d => {
    const g = document.createElement("optgroup");
    g.label = d + " — one store";
    STORES.filter(s => s.district === d).forEach(s => g.appendChild(opt(s.name, s.name)));
    scope.appendChild(g);
  });

  $("ntDue").value = todayISO();
  try{ $("ntBy").value = localStorage.getItem("wg-ops-dm") || ""; }catch(e){}

  $("ntSend").addEventListener("click", async () => {
    const title = $("ntTitle").value.trim();
    if(!title){ say("Give the task a title first."); $("ntTitle").focus(); return; }
    const by = $("ntBy").value.trim();
    if(!by){ say("Put your name on it so stores know who's asking."); $("ntBy").focus(); return; }
    try{ localStorage.setItem("wg-ops-dm", by); }catch(e){}

    $("ntSend").disabled = true;
    try{
      await fetch(CONFIG.sync.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ kind: "task", title: title, detail: $("ntDetail").value.trim(),
                               scope: $("ntScope").value, due: $("ntDue").value, by: by })
      });
      say("Sent. Stores see it the next time their deck loads.");
    }catch(e){ say("Couldn't reach the shared log — nothing was sent."); }
    $("ntSend").disabled = false;
    await loadPushed();
    renderTasks();
  });

  // what's already out there
  await loadPushed();
  if(!PUSHED.length){
    const n = document.createElement("div");
    n.className = "dist-note";
    n.innerHTML = "<h3>Nothing outstanding</h3><p>Tasks you send appear here with who has ticked them off, until you close them.</p>";
    host.appendChild(n);
    return;
  }

  const head = document.createElement("div");
  head.className = "sec-sub";
  head.innerHTML = '<span class="eyebrow">Out there now</span><span class="rule"></span>';
  host.appendChild(head);

  PUSHED.forEach(t => {
    const targets = STORES.filter(s => taskAppliesTo(t, s.name));
    const doneN = targets.filter(s => t.done && t.done[s.name]).length;

    const card = document.createElement("div");
    card.className = "tk";
    const h = document.createElement("div");
    h.className = "tk-h";
    h.innerHTML = '<span class="t"></span><span class="m"></span><span class="score"></span>';
    h.querySelector(".t").textContent = t.title;
    h.querySelector(".m").textContent =
      (t.scope === "all" ? "every store"
        : (t.scope === "West" || t.scope === "East") ? t.scope + " district"
        : t.scope) +
      (t.due ? " · due " + fmtShort(t.due) : "") + (t.by ? " · " + t.by : "");
    const sc = h.querySelector(".score");
    sc.className = "score " + (doneN === targets.length ? "full" : (doneN ? "part" : "none"));
    sc.textContent = doneN + "/" + targets.length;
    card.appendChild(h);

    if(t.detail){
      const d = document.createElement("p");
      d.style.cssText = "margin:0 0 10px;font-size:14px;color:var(--ink-2)";
      d.textContent = t.detail;
      card.appendChild(d);
    }

    const chips = document.createElement("div");
    chips.className = "tk-stores";
    targets.forEach(s => {
      const rec = t.done && t.done[s.name];
      const c = document.createElement("span");
      c.className = "tk-store" + (rec ? " yes" : "");
      c.textContent = s.name + (rec && rec.by ? " · " + rec.by : "");
      if(rec) c.title = "Ticked " + new Date(rec.at).toLocaleString();
      chips.appendChild(c);
    });
    card.appendChild(chips);

    const close = document.createElement("button");
    close.className = "mini";
    close.style.marginTop = "12px";
    close.textContent = doneN === targets.length ? "Close it out" : "Close early";
    close.addEventListener("click", async () => {
      close.disabled = true;
      try{
        await fetch(CONFIG.sync.url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ kind: "task_close", id: t.id, by: $("ntBy").value.trim() })
        });
        say("Closed. It drops off the stores' decks.");
      }catch(e){ say("Couldn't reach the shared log."); }
      await loadPushed();
      renderTasks();
    });
    card.appendChild(close);
    host.appendChild(card);
  });

  const note = document.createElement("div");
  note.className = "dist-note";
  note.innerHTML = "<h3>How stores see it</h3>" +
    "<p>A task shows up under <b>From your manager</b> at the top of their deck, above the daily list, with a box to tick. It stays there until they tick it or you close it.</p>" +
    "<p>Ticks land in the same log as everything else, so they come out in the CSV export too.</p>";
  host.appendChild(note);
}


/* ================= TICK VS FORM =================
   A tick says somebody pressed a button. A form response says Google recorded a
   submission. Where both exist for the same store and day, the gap between them is the
   honest measure of whether the ticks mean anything. A tick with no submission behind it
   is the one worth looking at. */
const FORM_TASKS = [
  { id: "opening",  full: "Opening checklist" },
  { id: "closing",  full: "Closing checklist" },
  { id: "workshop", full: "Weekly Training Recap" }
];

async function fetchCompare(dates){
  const out = { ticks: {}, forms: {}, ok: false, note: "" };
  if(!syncOn()){ out.note = "no shared log configured"; return out; }
  const from = dates[0], to = dates[dates.length - 1];
  const sep = CONFIG.sync.url.includes("?") ? "&" : "?";
  try{
    const [rt, rf] = await Promise.all([
      fetch(CONFIG.sync.url + sep + "from=" + from + "&to=" + to),
      fetch(CONFIG.sync.url + sep + "forms=1&from=" + from + "&to=" + to)
    ]);
    const jt = await rt.json();
    out.ticks = {};
    Object.keys((jt && jt.days) || {}).forEach(d => { out.ticks[d] = canonStores(jt.days[d]); });
    const jf = await rf.json();
    out.forms = {};
    Object.keys((jf && jf.days) || {}).forEach(d => { out.forms[d] = canonStores(jf.days[d]); });
    out.tasksWired = (jf && jf.tasks) || [];
    out.problems = (jf && jf.problems) || [];
    out.ok = true;
  }catch(e){ out.note = "couldn't reach the shared log"; }
  return out;
}

function minutesBetween(a, b){
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

async function renderCompare(){
  $("distDate").textContent = periodLabel();
  $("distTitle").textContent = "Tick vs form" + (distScope === "all" ? "" : " — " + distScope);
  $("distNext").disabled = atLatest();

  const host = $("distContent");
  host.innerHTML = "";
  const loading = document.createElement("p");
  loading.className = "legend"; loading.textContent = "Reading ticks and form responses…";
  host.appendChild(loading);

  const dates = datesForPeriod();
  const res = await fetchCompare(dates);
  host.innerHTML = "";

  if(!res.ok){
    const n = document.createElement("div");
    n.className = "dist-note";
    n.innerHTML = "<h3>Nothing to compare yet</h3><p>" + (res.note || "The shared log didn't answer.") + "</p>";
    host.appendChild(n);
    return;
  }

  if(!res.tasksWired || !res.tasksWired.length){
    const n = document.createElement("div");
    n.className = "dist-note";
    n.innerHTML = "<h3>No forms connected yet</h3>" +
      "<p>Put the Opening, Closing and Workshop forms into the <b>Form responses</b> section of the Admin page. Either the form's own edit URL or its linked responses sheet will do.</p>" +
      "<p>Until then there is nothing to check a tick against.</p>";
    host.appendChild(n);
    return;
  }

  const inScope = STORES.filter(s => distScope === "all" || s.district === distScope);
  let both = 0, tickOnly = 0, formOnly = 0, gaps = [];

  const cards = document.createElement("div");
  cards.className = "cmp";

  inScope.forEach(s => {
    const lines = [];
    dates.forEach(d => {
      FORM_TASKS.forEach(t => {
        const tick = res.ticks[d] && res.ticks[d][s.name] && res.ticks[d][s.name][t.id];
        const form = res.forms[d] && res.forms[d][s.name] && res.forms[d][s.name][t.id];
        if(!tick && !form) return;
        let state, gapMin = null;
        if(tick && form){
          gapMin = minutesBetween(tick.at, form.at);
          gaps.push(Math.abs(gapMin));
          state = Math.abs(gapMin) <= 30 ? "good" : "wide";
          both++;
        } else if(tick && !form){ state = "none"; tickOnly++; }
        else { state = "only"; formOnly++; }
        lines.push({ d, t, tick, form, state, gapMin });
      });
    });
    if(!lines.length) return;

    const card = document.createElement("div");
    card.className = "cmpcard";
    const h = document.createElement("div");
    h.className = "scard-h";
    h.innerHTML = '<div><div class="nm"></div><div class="cd"></div></div>';
    h.querySelector(".nm").textContent = s.name;
    h.querySelector(".cd").textContent = s.code + " · " + s.district;
    card.appendChild(h);

    const box = document.createElement("div");
    box.className = "cmp-lines";
    lines.forEach(l => {
      const row = document.createElement("div");
      row.className = "cmp-line";
      const nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = l.t.full + (dates.length > 1 ? " · " + fmtShort(l.d) : "");
      row.appendChild(nm);

      const tm = document.createElement("span");
      tm.className = "tm";
      const fmt = x => new Date(x).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
      tm.textContent = (l.tick ? "tick " + fmt(l.tick.at) : "no tick") + "  ·  " +
                       (l.form ? "form " + fmt(l.form.at) : "no form");
      row.appendChild(tm);

      const g = document.createElement("span");
      g.className = "gap " + l.state;
      g.textContent = l.state === "none" ? "no submission"
        : l.state === "only" ? "not ticked"
        : (l.gapMin === 0 ? "same minute"
           : (l.gapMin > 0 ? "form " + l.gapMin + "m later" : "form " + Math.abs(l.gapMin) + "m earlier"));
      row.appendChild(g);
      box.appendChild(row);
    });
    card.appendChild(box);
    cards.appendChild(card);
  });

  const median = gaps.length ? gaps.slice().sort((a,b)=>a-b)[Math.floor(gaps.length/2)] : null;
  const tally = document.createElement("div");
  tally.className = "tally";
  [[String(both), "matched up"],
   [String(tickOnly), tickOnly === 1 ? "tick with no form" : "ticks with no form"],
   [median === null ? "—" : median + "m", "typical gap"]]
    .forEach(([n,k]) => {
      const d = document.createElement("div");
      d.innerHTML = '<span class="n"></span><span class="k"></span>';
      d.querySelector(".n").textContent = n;
      d.querySelector(".k").textContent = k;
      tally.appendChild(d);
    });
  host.appendChild(tally);
  host.appendChild(cards);

  const key = document.createElement("div");
  key.className = "cmp-key";
  key.innerHTML = '<span><b style="color:var(--ok)">within 30m</b> — tick tracks the work</span>' +
    '<span><b style="color:var(--warn)">wider gap</b> — ticked at a different time than submitted</span>' +
    '<span><b style="color:var(--stop)">no submission</b> — ticked, but Google has no form</span>' +
    '<span><b>not ticked</b> — form submitted, nobody ticked</span>';
  host.appendChild(key);

  const note = document.createElement("div");
  note.className = "dist-note";
  let body = "<h3>How to read this</h3>" +
    "<p><b>Ticks with no form</b> is the number that matters. One or two is noise — someone ticked, then got pulled onto the floor. A pattern at the same store means the tick has become the ritual and the form has been dropped.</p>" +
    "<p>A wide gap is not automatically bad. Ticking on arrival and submitting an hour later is still an honest day's work. What you're looking for is whether the two numbers move together at all.</p>";
  if(res.problems && res.problems.length){
    body += "<p><b>Couldn't read:</b> " + res.problems.join("; ") + "</p>";
  }
  note.innerHTML = body;
  host.appendChild(note);
}


/* ================= CONNECTION CHECK =================
   When a store goes missing from the company view there are only a few possible
   reasons, and guessing between them is miserable. This asks the endpoint directly and
   reports which stores have ever reached it. */
async function renderDiag(host){
  const box = document.createElement("div");
  box.className = "diag";
  host.appendChild(box);

  const row = (label, value, state) => {
    const d = document.createElement("div");
    d.className = "diag-row" + (state ? " " + state : "");
    d.innerHTML = '<span class="dot"></span><span class="lbl"></span><span class="val"></span>';
    d.querySelector(".lbl").textContent = label;
    d.querySelector(".val").textContent = value;
    box.appendChild(d);
    return d;
  };

  row("This page", "build " + BUILD, "ok");

  const url = (CONFIG.sync && CONFIG.sync.url) || "";
  if(!url){
    row("Shared log", "no URL set in CONFIG.sync.url — nothing is being shared", "bad");
    return;
  }
  row("Shared log", url.length > 72 ? url.slice(0, 72) + "…" : url, "ok");

  const pending = row("Endpoint", "checking…", "");
  let reachable = false;
  try{
    const sep = url.includes("?") ? "&" : "?";
    const r = await fetch(url + sep + "settings=1");
    if(!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if(!j || j.ok !== true) throw new Error("unexpected reply");
    reachable = true;
    pending.className = "diag-row ok";
    pending.querySelector(".val").textContent = "answering — " + Object.keys(j.settings || {}).length + " setting(s) stored";
  }catch(e){
    pending.className = "diag-row bad";
    pending.querySelector(".val").textContent = "no usable reply (" + e.message + ")";

    /* "Failed to fetch" is the browser refusing to tell us why. An opaque no-cors probe
       can at least separate "the host is unreachable from here" from "the host answered
       but wouldn't let this page read it", which point at completely different fixes. */
    const verdict = row("What that means", "narrowing it down…", "");
    let opaqueOK = false;
    try{
      await fetch(url, { mode: "no-cors", cache: "no-store" });
      opaqueOK = true;
    }catch(e2){}

    if(opaqueOK){
      verdict.className = "diag-row warn";
      verdict.querySelector(".val").textContent =
        "Google answered but blocked this page from reading it. Almost always the web app's access setting: it must be Anyone, not Anyone with a Google account. Ticks may still be saving; nothing can be read back.";
    } else {
      verdict.className = "diag-row bad";
      verdict.querySelector(".val").textContent =
        "script.google.com could not be reached from this device at all — network, wifi filter, VPN or an extension. Try the same URL in a browser tab; if that works too, it is this page being blocked, not the script.";
    }

    const openIt = row("Check it by hand", "", "");
    const a = document.createElement("a");
    a.href = url + (url.includes("?") ? "&" : "?") + "settings=1";
    a.target = "_blank"; a.rel = "noopener";
    a.textContent = "Open the endpoint in a new tab";
    a.style.cssText = "color:var(--brand);font-size:13px";
    openIt.querySelector(".val").textContent = "";
    openIt.querySelector(".val").appendChild(a);
    openIt.querySelector(".lbl").textContent = "Check it by hand";
  }
  if(!reachable) return;

  // which stores have actually reached the log in the last two weeks
  const to = todayISO();
  const from = shiftISO(to, -13);
  const seenRow = row("Stores reporting", "checking the last 14 days…", "");
  let days = {};
  try{
    const sep = url.includes("?") ? "&" : "?";
    const r = await fetch(url + sep + "from=" + from + "&to=" + to);
    const j = await r.json();
    days = (j && j.days) || {};
  }catch(e){
    seenRow.className = "diag-row bad";
    seenRow.querySelector(".val").textContent = "couldn't read the range";
    return;
  }

  const last = {};
  Object.keys(days).forEach(d => Object.keys(days[d] || {}).forEach(store => {
    if(!last[store] || d > last[store]) last[store] = d;
  }));

  const known = STORES.map(s => s.name);
  const reporting = known.filter(n => last[n]).length;
  const strangers = Object.keys(last).filter(n => known.indexOf(n) < 0);

  seenRow.className = "diag-row " + (reporting === known.length ? "ok" : "warn");
  seenRow.querySelector(".val").textContent =
    reporting + " of " + known.length + " have posted since " + from +
    (strangers.length ? "  ·  unrecognised names in the log: " + strangers.join(", ") : "");

  const grid = document.createElement("div");
  grid.className = "seen";
  STORES.forEach(s => {
    const d = document.createElement("div");
    if(!last[s.name]) d.className = "never";
    d.innerHTML = '<span class="s"></span><span class="t"></span>';
    d.querySelector(".s").textContent = s.name;
    d.querySelector(".t").textContent = last[s.name] ? "last " + fmtShort(last[s.name]) : "never";
    grid.appendChild(d);
  });
  host.appendChild(grid);

  const note = document.createElement("p");
  note.className = "legend";
  note.style.marginTop = "12px";
  note.textContent = "A store reading \u201cnever\u201d has not reached this log at all. Either nobody has ticked anything there, or that tablet is on an older copy of the page — open the deck on it and check the build number in the footer against the one above.";
  host.appendChild(note);
}


/* ================= HANDOVER NOTE =================
   The closing form already ends with "anything you need, problems you had" — and that
   text goes into a response sheet nobody opens again. This is the same thought, put
   where it is actually useful: in front of whoever opens next. */
function prevTradingDay(iso){
  let d = shiftISO(iso, -1);
  const dow = new Date(d + "T00:00:00").getDay();
  if(dow === 0) d = shiftISO(d, -1);          // Sunday — skip back to Saturday
  return d;
}
function noteKey(store, iso){ return "wg-ops-note-" + store + "-" + iso; }
function seenKey(store, iso){ return "wg-ops-noteseen-" + store + "-" + iso; }

function localNote(store, iso){
  try{ return JSON.parse(localStorage.getItem(noteKey(store, iso)) || "null"); }catch(e){ return null; }
}

async function saveNote(){
  const text = $("noteText").value.trim();
  const iso = todayISO();
  const rec = { date: iso, store: active.name, text: text, by: getWho() || "", at: new Date().toISOString() };
  try{ localStorage.setItem(noteKey(active.name, iso), JSON.stringify(rec)); }catch(e){}

  $("noteSaved").textContent = "Saved on this tablet";
  if(syncOn()){
    try{
      const r = await fetch(CONFIG.sync.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ kind: "note", date: iso, store: active.name, text: text, by: rec.by })
      });
      if(r.ok) $("noteSaved").textContent = text ? "Saved — tomorrow's shift will see it" : "Note cleared";
    }catch(e){
      $("noteSaved").textContent = "Saved here, but it didn't reach the log";
    }
  }
  setTimeout(() => { $("noteSaved").textContent = ""; }, 6000);
}

async function showHandover(){
  const slot = $("handoverSlot");
  slot.innerHTML = "";
  const from = prevTradingDay(todayISO());

  let note = localNote(active.name, from);
  if(syncOn()){
    try{
      const sep = CONFIG.sync.url.includes("?") ? "&" : "?";
      const r = await fetch(CONFIG.sync.url + sep + "notes=1&store=" + encodeURIComponent(active.name) +
                            "&from=" + from + "&to=" + from);
      const j = await r.json();
      if(j && j.ok && j.notes && j.notes.length) note = j.notes[0];
    }catch(e){}
  }
  if(!note || !note.text) return;
  try{ if(localStorage.getItem(seenKey(active.name, from))) return; }catch(e){}

  const box = document.createElement("div");
  box.className = "handover";
  box.innerHTML =
    '<div class="handover-h"><span class="flag">Left for you</span>' +
    '<span class="who"></span><button class="x" type="button">Got it</button></div><p></p>';
  box.querySelector(".who").textContent =
    prettyISO(from).replace(/,.*/, "") + (note.by ? " · " + note.by : "");
  box.querySelector("p").textContent = note.text;
  box.querySelector(".x").addEventListener("click", () => {
    try{ localStorage.setItem(seenKey(active.name, from), "1"); }catch(e){}
    box.remove();
  });
  slot.appendChild(box);
}

/* ================= PUSHED TASKS =================
   A one-off job a manager sends out — "photograph your window display", "count the
   demo socks". It rides the ordinary tick log under the id push:<id>, so it needs no
   separate bookkeeping and lands in the CSV export like everything else. */
let PUSHED = [];

async function loadPushed(){
  if(!syncOn()){ PUSHED = []; return; }
  try{
    const sep = CONFIG.sync.url.includes("?") ? "&" : "?";
    const r = await fetch(CONFIG.sync.url + sep + "tasks=1");
    const j = await r.json();
    PUSHED = (j && j.tasks) || [];
  }catch(e){ PUSHED = []; }
}

function taskAppliesTo(t, store){
  if(!t.scope || t.scope === "all") return true;
  if(t.scope === "West" || t.scope === "East"){
    const s = STORES.find(x => x.name === store);
    return s && s.district === t.scope;
  }
  return t.scope.split(",").map(x => x.trim()).indexOf(store) >= 0;
}

function pushDoneLocally(id){
  try{ return !!JSON.parse(localStorage.getItem("wg-ops-push-" + active.name + "-" + id) || "null"); }
  catch(e){ return false; }
}

async function togglePushed(t){
  const already = (t.done && t.done[active.name]) || pushDoneLocally(t.id);
  const who = getWho();
  if(!already && !who){ askWho("push:" + t.id); return; }

  const key = "wg-ops-push-" + active.name + "-" + t.id;
  try{
    if(already) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ at: new Date().toISOString(), by: who }));
  }catch(e){}

  if(already && t.done) delete t.done[active.name];
  else { t.done = t.done || {}; t.done[active.name] = { at: new Date().toISOString(), by: who }; }
  safe("manager task redraw", renderPushed);

  if(syncOn()){
    try{
      fetch(CONFIG.sync.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ date: todayISO(), store: active.name, task: "push:" + t.id,
                               label: t.title, by: who, action: already ? "clear" : "set",
                               at: new Date().toISOString() })
      }).catch(() => {});
    }catch(e){}
  }
  safe("manager task redraw", renderPushed);
}

function renderPushed(){
  const slot = $("pushedSlot");
  slot.innerHTML = "";
  const mine = PUSHED.filter(t => taskAppliesTo(t, active.name));
  if(!mine.length) return;

  const head = document.createElement("div");
  head.className = "sec-head";
  head.innerHTML = '<span class="eyebrow">From your manager</span><span class="rule"></span>';
  slot.appendChild(head);

  const list = document.createElement("div");
  list.className = "pushed";
  mine.forEach(t => {
    const done = (t.done && t.done[active.name]) || pushDoneLocally(t.id);
    const overdue = !done && t.due && t.due < todayISO();

    const item = document.createElement("div");
    item.className = "push-item" + (done ? " done" : "") + (overdue ? " overdue" : "");
    const b = document.createElement("button");
    b.type = "button"; b.className = "push-main";
    b.innerHTML = '<span class="box">' + TICK + '</span><span class="push-body">' +
                  '<span class="t"></span><span class="d"></span><span class="m"></span></span>';
    b.querySelector(".t").textContent = t.title;
    b.querySelector(".d").textContent = t.detail || "";
    if(!t.detail) b.querySelector(".d").style.display = "none";
    const rec = t.done && t.done[active.name];
    b.querySelector(".m").textContent = done
      ? ("Done" + (rec && rec.by ? " by " + rec.by : "") +
         (rec && rec.at ? " · " + new Date(rec.at).toLocaleDateString([], {month:"numeric", day:"numeric"}) : ""))
      : ((t.due ? (overdue ? "Was due " : "Due ") + fmtShort(t.due) : "No date") +
         (t.by ? " · from " + t.by : ""));
    b.addEventListener("click", () => togglePushed(t));
    item.appendChild(b);
    list.appendChild(item);
  });
  slot.appendChild(list);
}


/* ================= IN-PAGE VIEWER =================
   Google Forms allow themselves to be embedded, so opening/closing/workshop and the DM's
   store visit all run inside the deck. Google Sheets refuse to be framed when they're
   editable — banking, EOD and the master schedule set frame-ancestors, so those still
   have to open in a tab. The tiles say which is which rather than letting a blank frame
   make it look broken. */
function isEmbeddable(url){
  return /\/forms\/|docs\.google\.com\/forms/i.test(url || "");
}
function embedURL(url){
  if(!url) return "";
  return url + (url.includes("?") ? "&" : "?") + "embedded=true";
}

let viewerTask = null;      // task id to offer a tick for on close

function openViewer(title, url, taskId){
  if(!url){ say(title + " isn't linked yet."); return; }
  viewerTask = taskId || null;

  $("vwTitle").textContent = title;
  $("vwSub").textContent = active ? active.name : "";
  $("vwOut").href = url;
  $("vwFrame").src = embedURL(url);

  const foot = $("vwFoot");
  if(viewerTask && active && !loadDone()[viewerTask]){
    $("vwAsk").textContent = "When the form says your response is recorded, tick it off here.";
    foot.style.display = "";
  } else {
    foot.style.display = "none";
  }
  $("viewer").classList.add("on");
}

function closeViewer(){
  $("viewer").classList.remove("on");
  $("vwFrame").src = "about:blank";     // stop it running in the background
  viewerTask = null;
}

/* ================= DM MONTHLY ROUND =================
   Every month a DM walks each store: one Store Visit Checklist, and one PE with that
   store's manager. Twenty-two things across eleven stores, currently tracked in
   somebody's head. This is the same tick machinery the stores use, keyed to the first
   of the month instead of to a day, so it rides the shared log without any new plumbing. */
const DM_TASKS = [
  { id: "dmVisit", full: "Store visit checklist" },
  { id: "dmPE",    full: "PE with the manager" }
];

let distView = "stores";

function monthStart(iso){ return iso.slice(0, 7) + "-01"; }
function dmKeyFor(store, iso){ return "wg-ops-done-" + store + "-" + monthStart(iso); }
function dmLoad(store, iso){
  try{ return JSON.parse(localStorage.getItem(dmKeyFor(store, iso)) || "{}"); }catch(e){ return {}; }
}
function dmSave(store, iso, o){
  try{ localStorage.setItem(dmKeyFor(store, iso), JSON.stringify(o)); }catch(e){}
}

function getDM(){ try{ return localStorage.getItem("wg-ops-dm") || ""; }catch(e){ return ""; } }
function setDM(v){ try{ localStorage.setItem("wg-ops-dm", v); }catch(e){} }

function dmToggle(store, taskId){
  const who = getDM();
  if(!who){ say("Put your initials in at the top first, so the round has a name on it."); 
            const f = $("dmWho"); if(f){ f.focus(); } return; }

  const iso = monthStart(distISO);
  const o = dmLoad(store, distISO);
  let action;
  if(o[taskId]){ delete o[taskId]; action = "clear"; }
  else { o[taskId] = { at: new Date().toISOString(), by: who }; action = "set"; }
  dmSave(store, distISO, o);

  if(syncOn()){
    const t = DM_TASKS.find(x => x.id === taskId);
    try{
      fetch(CONFIG.sync.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ date: iso, store: store, task: taskId,
                               label: t ? t.full : taskId, by: who, action: action,
                               at: new Date().toISOString() })
      }).catch(() => {});
    }catch(e){}
  }
  distCache = {};
  renderDM();
}

function visitLink(){
  return setting("link.storeVisit", (CONFIG.dm && CONFIG.dm.storeVisitUrl) || "");
}

function daysLeftInMonth(){
  const [y, m] = distISO.split("-").map(Number);
  const end = new Date(y, m, 0).getDate();
  const today = new Date();
  const sameMonth = (today.getFullYear() === y && today.getMonth() + 1 === m);
  if(!sameMonth) return null;
  return end - today.getDate();
}

async function renderDM(){
  $("distDate").textContent = periodLabel();
  $("distTitle").textContent = distScope === "all" ? "DM month — company" : "DM month — " + distScope;
  $("distNext").disabled = distISO.slice(0,7) >= todayISO().slice(0,7);

  const host = $("distContent");
  host.innerHTML = "";

  // who is walking the round
  const whoBox = document.createElement("div");
  whoBox.className = "dm-who";
  whoBox.innerHTML = '<label for="dmWho">Recording as</label>';
  const inp = document.createElement("input");
  inp.id = "dmWho"; inp.maxLength = 4; inp.placeholder = "ABC"; inp.value = getDM();
  inp.addEventListener("input", () => setDM(inp.value.trim().toUpperCase()));
  whoBox.appendChild(inp);
  const hint = document.createElement("span");
  hint.className = "hint";
  hint.textContent = "Your initials go on every box you tick this month. Set once on this device.";
  whoBox.appendChild(hint);
  host.appendChild(whoBox);

  // pull the month from the shared log so a round started on another device shows up
  let remote = null;
  if(syncOn()){
    try{
      const sep = CONFIG.sync.url.includes("?") ? "&" : "?";
      const r = await fetch(CONFIG.sync.url + sep + "date=" + monthStart(distISO));
      if(r.ok){ const j = await r.json(); if(j.ok) remote = canonStores(j.stores || {}); }
    }catch(e){}
  }

  const recFor = (store, taskId) => {
    if(remote && remote[store] && remote[store][taskId]) return remote[store][taskId];
    return dmLoad(store, distISO)[taskId] || null;
  };

  const inScope = STORES.filter(s => distScope === "all" || s.district === distScope);
  let visits = 0, pes = 0;
  inScope.forEach(s => {
    if(recFor(s.name, "dmVisit")) visits++;
    if(recFor(s.name, "dmPE")) pes++;
  });

  const tally = document.createElement("div");
  tally.className = "tally";
  const left = daysLeftInMonth();
  [[visits + "/" + inScope.length, "store visits done"],
   [pes + "/" + inScope.length, "manager PEs done"],
   [left === null ? "—" : String(left), left === null ? "not this month" : (left === 1 ? "day left" : "days left")]]
    .forEach(([n,k]) => {
      const d = document.createElement("div");
      d.innerHTML = '<span class="n"></span><span class="k"></span>';
      d.querySelector(".n").textContent = n;
      d.querySelector(".k").textContent = k;
      tally.appendChild(d);
    });
  host.appendChild(tally);

  const groups = distScope === "all" ? ["West","East"] : [distScope];
  groups.forEach(g => {
    if(distScope === "all"){
      const head = document.createElement("div");
      head.className = "sec-sub";
      head.innerHTML = '<span class="eyebrow"></span><span class="rule"></span>';
      head.querySelector(".eyebrow").textContent = g + " District";
      host.appendChild(head);
    }
    const grid = document.createElement("div");
    grid.className = "store-cards";
    STORES.filter(s => s.district === g).forEach(s => {
      const card = document.createElement("div");
      card.className = "dmcard";

      const done = DM_TASKS.filter(t => recFor(s.name, t.id)).length;
      const h = document.createElement("div");
      h.className = "scard-h";
      h.innerHTML = '<div><div class="nm"></div><div class="cd"></div></div><span class="score"></span>';
      h.querySelector(".nm").textContent = s.name;
      h.querySelector(".cd").textContent = s.code + " · " + s.district;
      const sc = h.querySelector(".score");
      sc.classList.add(done === 2 ? "full" : (done ? "part" : "none"));
      sc.textContent = done + "/2";
      card.appendChild(h);

      const rows = document.createElement("div");
      rows.className = "dm-rows";
      DM_TASKS.forEach(t => {
        const rec = recFor(s.name, t.id);
        const b = document.createElement("button");
        b.type = "button"; b.className = "dm-row";
        b.setAttribute("aria-pressed", rec ? "true" : "false");
        b.innerHTML = '<span class="box">' + TICK + '</span><span class="lb"></span><span class="stamp"></span>';
        b.querySelector(".lb").textContent = t.full;
        if(rec){
          const at = new Date(rec.at || rec);
          b.querySelector(".stamp").textContent =
            (rec.by ? rec.by + " · " : "") + at.toLocaleDateString([], {month:"numeric", day:"numeric"});
        }
        b.addEventListener("click", () => dmToggle(s.name, t.id));
        rows.appendChild(b);
      });
      card.appendChild(rows);

      const link = visitLink();
      if(link){
        const a = document.createElement("a");
        a.className = "dm-open"; a.href = link;
        if(isEmbeddable(link)){
          a.href = "#";
          a.addEventListener("click", e => { e.preventDefault(); openViewer("Store visit checklist — " + s.name, link, null); });
          a.textContent = "Open store visit checklist →";
        } else {
          a.target = "_blank"; a.rel = "noopener";
          a.textContent = "Open store visit checklist ↗";
        }
        card.appendChild(a);
      }
      grid.appendChild(card);
    });
    host.appendChild(grid);
  });

  const note = document.createElement("div");
  note.className = "dist-note";
  note.innerHTML = "<h3>Your round, not the stores'</h3>" +
    "<p>This tab is yours. Stores never see it, and nothing here appears on their deck.</p>" +
    "<p>Ticking a box records that you did it — it does not submit the checklist. Open the form, fill it in, then tick.</p>";
  host.appendChild(note);
}

async function renderDist(){
  const dates = datesForPeriod();
  $("distDate").textContent = periodLabel();
  $("distTitle").textContent = distScope === "all" ? "Company view" : distScope + " District";
  $("distNext").disabled = atLatest();

  const host = $("distContent");
  host.innerHTML = "";
  if(syncOn()){
    const l = document.createElement("p");
    l.className = "legend"; l.textContent = "Loading…";
    host.appendChild(l);
  }

  const { data: span, mode } = await fetchSpan(dates);
  lastSpan = { dates: dates, data: span };
  host.innerHTML = "";

  const inScope = STORES.filter(s => distScope === "all" || s.district === distScope);
  const total = inScope.length * dates.length * TASKS.length;
  let ticked = 0, fullStoreDays = 0, emptyStores = 0;
  inScope.forEach(s => {
    let any = 0;
    dates.forEach(d => {
      const n = doneCount(span[d] && span[d][s.name]);
      ticked += n; any += n;
      if(n === TASKS.length) fullStoreDays++;
    });
    if(!any) emptyStores++;
  });

  const tally = document.createElement("div");
  tally.className = "tally";
  const storeDays = inScope.length * dates.length;
  const rows = distPeriod === "day"
    ? [[ticked + "/" + total, "tasks ticked"],
       [fullStoreDays + "/" + inScope.length, "stores complete"],
       [String(emptyStores), emptyStores === 1 ? "store with nothing" : "stores with nothing"]]
    : [[(total ? Math.round(ticked/total*100) : 0) + "%", "of tasks ticked"],
       [fullStoreDays + "/" + storeDays, "store-days complete"],
       [String(emptyStores), emptyStores === 1 ? "store with nothing" : "stores with nothing"]];
  rows.forEach(([n,k]) => {
    const d = document.createElement("div");
    d.innerHTML = '<span class="n"></span><span class="k"></span>';
    d.querySelector(".n").textContent = n;
    d.querySelector(".k").textContent = k;
    tally.appendChild(d);
  });
  host.appendChild(tally);

  const groups = distScope === "all" ? ["West","East"] : [distScope];
  groups.forEach(g => {
    if(distScope === "all"){
      const head = document.createElement("div");
      head.className = "sec-sub";
      head.innerHTML = '<span class="eyebrow"></span><span class="rule"></span>';
      head.querySelector(".eyebrow").textContent = g + " District";
      host.appendChild(head);
    }
    const grid = document.createElement("div");
    grid.className = "store-cards";
    STORES.filter(s => s.district === g).forEach(s => {
      if(distPeriod === "day")       grid.appendChild(storeCard(s, span[distISO] && span[distISO][s.name]));
      else if(distPeriod === "week") grid.appendChild(weekCard(s, span, dates));
      else                           grid.appendChild(monthCard(s, span, dates));
    });
    host.appendChild(grid);
  });

  if(distPeriod === "month"){
    const lg = document.createElement("div");
    lg.className = "mlegend";
    lg.innerHTML = '<span><i></i>nothing</span><span><i class="part"></i>some</span>' +
                   '<span><i class="full"></i>all five</span><span>Sundays not counted</span>';
    host.appendChild(lg);
  }

  const note = document.createElement("div");
  note.className = "dist-note";
  if(mode === "remote"){
    note.innerHTML = "<h3>Reading the shared tick log</h3><p>Every store's tablet posts here as tasks get ticked. An empty box means nobody ticked it — which is not proof the work wasn't done, only that nobody marked it.</p>";
  } else if(mode === "error"){
    note.innerHTML = "<h3>Couldn't reach the tick log</h3><p>The endpoint is set but didn't answer, so this is only what this tablet knows. Check that the Apps Script deployment is set to <code>Anyone</code> and that the URL in <code>CONFIG.sync.url</code> ends in <code>/exec</code>.</p>";
  } else {
    note.innerHTML = "<h3>Not connected yet — this is one tablet's view</h3>" +
      "<p>Ticks are stored on each store's own tablet, so these cards can only show what this device did. Every other store will read empty here no matter what they actually did.</p>" +
      "<p>To see all eleven for real, deploy the <code>apps-script.gs</code> file as a Google Apps Script web app and paste its URL into <code>CONFIG.sync.url</code>.</p>";
  }
  host.appendChild(note);
}



/* ================= SUPPLY ORDER =================
   One Google Sheet per period, due the first Thursday. Lives as a tile and as a
   banner from period start through that Thursday. Tick is keyed to the period,
   not the calendar day, so it doesn't vanish overnight. */
function firstThursdayISO(startISO){
  const d = dateFromISO(startISO);
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7));
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function supplyInfo(iso){
  const p = salesPeriodOn(iso || todayISO());
  if(!p) return null;
  const due = firstThursdayISO(p.start);
  const today = iso || todayISO();
  return {
    period: p,
    due: due,
    url: (typeof linkFor === "function" ? linkFor("supply") : ""),
    open: today >= p.start && today <= due,
    overdue: today > due
  };
}
function toggleSupply(){
  const already = !!loadSupplyTick();
  const who = getWho();
  if(!already && !who){ askWho("supply"); return; }
  if(already) saveSupplyTick(null);
  else saveSupplyTick({ at: new Date().toISOString(), by: who });
  const p = salesPeriodOn(todayISO());
  if(syncOn() && p){
    try{
      fetch(CONFIG.sync.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          date: p.start, store: active.name, task: "supply",
          label: "Supply order P" + p.n, by: who,
          action: already ? "clear" : "set",
          at: new Date().toISOString()
        })
      }).catch(() => {});
    }catch(e){}
  }
  render();
}
function supplySeenKey(){
  const p = salesPeriodOn(todayISO());
  return p ? ("wg-ops-supplyseen-" + active.name + "-" + p.year + "-" + p.n + "-" + todayISO()) : "";
}
function closeSupplyAsk(){
  const el = $("supplyAsk");
  if(el) el.classList.remove("on");
}
function maybeSupplyPopup(){
  const info = supplyInfo(todayISO());
  if(!info || !info.url || !info.open || loadSupplyTick()) return;
  try{ if(localStorage.getItem(supplySeenKey())) return; }catch(e){}
  const el = $("supplyAsk");
  if(!el) return;
  $("supplyAskFlag").textContent = "Period " + info.period.n;
  $("supplyAskTitle").textContent = "Supply order is open";
  const dueTxt = info.due === todayISO()
    ? "It is due today."
    : "It is due " + prettyISO(info.due) + " — the first Thursday of the period.";
  $("supplyAskBody").textContent =
    "Period " + info.period.n + " order sheet is ready. Open your store's tab and submit it. " + dueTxt;
  $("supplyAskOpen").href = info.url;
  el.classList.add("on");
}
function closeMeetAsk(){ const el = $("meetAsk"); if(el) el.classList.remove("on"); }

function maybeMeetPopup(){
  const meet = meetingToday();
  if(!meet || !meet.url) return;
  try{ if(localStorage.getItem(meetSeenKey())) return; }catch(e){}
  const el = $("meetAsk");
  if(!el) return;
  $("meetAskFlag").textContent = meet.when;
  $("meetAskTitle").textContent = meet.title + " · 9 AM";
  $("meetAskBody").textContent = meet.blurb + " Tap Join now when you are ready.";
  $("meetAskOpen").href = meet.url;
  el.classList.add("on");
}

function renderMeeting(){
  const slot = $("meetSlot");
  if(!slot) return;
  slot.innerHTML = "";
  const meet = meetingToday();
  if(!meet) return;
  const box = document.createElement("div");
  box.className = "handover supply-banner";
  box.innerHTML =
    '<div class="handover-h"><span class="flag"></span>' +
    '<span class="who"></span></div><p></p><div class="acts"></div>';
  box.querySelector(".flag").textContent = "9 AM today";
  box.querySelector(".who").textContent = meet.when;
  box.querySelector("p").textContent = meet.url
    ? meet.title + ". " + meet.blurb
    : meet.title + " is on the calendar today, but no join link is pasted in Admin yet.";
  const acts = box.querySelector(".acts");
  if(meet.url){
    const a = document.createElement("a");
    a.className = "btn"; a.href = meet.url; a.target = "_blank"; a.rel = "noopener";
    a.textContent = "Join now";
    acts.appendChild(a);
  }
  slot.appendChild(box);
}

function renderSupply(){
  const slot = $("supplySlot");
  if(!slot) return;
  slot.innerHTML = "";
  const info = supplyInfo(todayISO());
  if(!info || !info.url) return;
  const done = loadSupplyTick();
  if(done) return;
  if(!(info.open || info.overdue)) return;

  const box = document.createElement("div");
  box.className = "handover supply-banner" + (info.overdue ? " overdue" : "");
  const duePretty = fmtPeriodEnd(info.due);
  box.innerHTML =
    '<div class="handover-h"><span class="flag"></span>' +
    '<span class="who"></span></div><p></p><div class="acts"></div>';
  box.querySelector(".flag").textContent = info.overdue ? "Overdue" : "Period order";
  box.querySelector(".who").textContent = "Period " + info.period.n + "  ·  due " + duePretty;
  box.querySelector("p").textContent = info.overdue
    ? "The supply order was due " + duePretty + " (first Thursday of the period). Open the sheet and submit it."
    : "New period, new supply order. Open your store's tab and submit it by " + duePretty + ".";
  const acts = box.querySelector(".acts");
  const a = document.createElement("a");
  a.className = "btn"; a.href = info.url; a.target = "_blank"; a.rel = "noopener";
  a.textContent = "Open the order";
  acts.appendChild(a);
  const mark = document.createElement("button");
  mark.type = "button"; mark.className = "btn ghost"; mark.textContent = "Mark submitted";
  mark.addEventListener("click", () => toggleTask("supply"));
  acts.appendChild(mark);
  slot.appendChild(box);
}

/* ================= ADMIN ================= */
const ROTATES = {
  eod: "New workbook each period",
  banking: "New workbook each month",
  supply: "New workbook each period"
};

let adminNote = "";
function openAdmin(){ adminNote = ""; $("admin").classList.add("on"); renderAdmin(); }
function closeAdmin(){ $("admin").classList.remove("on"); }

async function renderAdmin(){
  const host = $("adminContent");
  host.innerHTML = "";

  const st = document.createElement("div");
  st.className = "status";
  st.innerHTML = '<span class="dot"></span><p></p>';
  const setStatus = (kind, html) => { st.className = "status " + kind; st.querySelector("p").innerHTML = html; };

  const inputs = {};

  const section = (title, blurb) => {
    const h = document.createElement("div");
    h.className = "sec-sub";
    h.innerHTML = '<span class="eyebrow"></span><span class="rule"></span>';
    h.querySelector(".eyebrow").textContent = title;
    host.appendChild(h);
    if(blurb){
      const b = document.createElement("p");
      b.className = "legend"; b.style.margin = "0 0 12px";
      b.textContent = blurb;
      host.appendChild(b);
    }
  };

  const urlRow = (key, title, hint, opts) => {
    opts = opts || {};
    const row = document.createElement("div");
    row.className = "lrow";
    const h = document.createElement("div");
    h.className = "lrow-h";
    h.innerHTML = '<h3></h3><span class="tagline"></span>';
    h.querySelector("h3").textContent = title;
    h.querySelector(".tagline").textContent = key;
    if(opts.rotates){
      const r = document.createElement("span"); r.className = "rotates"; r.textContent = opts.rotates; h.appendChild(r);
    }
    if(SETTINGS[key]){
      const o = document.createElement("span"); o.className = "over"; o.textContent = "Set here"; h.appendChild(o);
    }
    row.appendChild(h);

    const inp = document.createElement("input");
    inp.type = "url"; inp.className = "urlin"; inp.spellcheck = false;
    inp.placeholder = opts.placeholder || "https://docs.google.com/…";
    inp.value = SETTINGS[key] || opts.fallback || "";
    inputs[key] = inp;
    row.appendChild(inp);

    const f = document.createElement("div");
    f.className = "lrow-f";
    const hi = document.createElement("span"); hi.className = "hint"; hi.textContent = hint; f.appendChild(hi);

    if(opts.fallback !== undefined){
      const reset = document.createElement("button");
      reset.type = "button"; reset.className = "mini"; reset.textContent = "Reset to built-in";
      reset.addEventListener("click", () => { inp.value = opts.fallback || ""; });
      f.appendChild(reset);
    }
    const open = document.createElement("button");
    open.type = "button"; open.className = "mini"; open.textContent = "Open";
    open.addEventListener("click", () => {
      const v = inp.value.trim();
      if(!v){ say("Nothing to open — that field is empty."); return; }
      window.open(v, "_blank", "noopener");
    });
    f.appendChild(open);
    row.appendChild(f);
    host.appendChild(row);
  };

  // ---- connection ---------------------------------------------------------
  section("Connection", "Whether the shared log is answering, and which stores have reached it.");
  await renderDiag(host);

  // ---- links -------------------------------------------------------------
  section("Links & settings", "");
  host.appendChild(st);
  setStatus("", "Checking…");
  const state = await loadSettings();
  if(state === "live")         setStatus("live", "<b>Connected.</b> Anything you save here reaches every store the next time a tablet loads the deck.");
  else if(state === "offline") setStatus("offline", "<b>Can't reach the shared log.</b> Saving still works on this device, but other stores won't get it.");
  else                         setStatus("offline", "<b>Not connected.</b> <code>CONFIG.sync.url</code> is empty, so a save only changes this device.");

  section("Module links", "Paste a new URL over the old one when a workbook or form is replaced.");
  MODULES.forEach(m => {
    urlRow("link." + m.key, m.title,
      m.key === "schedule"
        ? "Also the workbook the deck reads the schedule out of, so a new period appears on its own."
        : m.desc,
      { fallback: builtInLink(m.key), rotates: ROTATES[m.key] });
  });

  section("Meetings", "Paste the Zoom / Meet / Teams link. The deck only shows the matching meeting on that day — Tuesday, first Saturday, or 2nd/4th Saturday.");
  urlRow("link.meet.managers", "Managers meeting — Tuesdays 9 AM",
    "Shows every Tuesday on the store deck. Replace this URL whenever the room changes.",
    { fallback: (CONFIG.meetings && CONFIG.meetings.managers && CONFIG.meetings.managers.url) || "", placeholder: "https://zoom.us/j/…" });
  urlRow("link.meet.allHands", "All-hands — first Saturday 9 AM",
    "Shows on the first Saturday of each sales period only.",
    { fallback: (CONFIG.meetings && CONFIG.meetings.allHands && CONFIG.meetings.allHands.url) || "", placeholder: "https://zoom.us/j/…" });
  urlRow("link.meet.training", "Sales manager training — 2nd & 4th Saturday 9 AM",
    "Shows on the second and fourth Saturday of each period.",
    { fallback: (CONFIG.meetings && CONFIG.meetings.training && CONFIG.meetings.training.url) || "", placeholder: "https://zoom.us/j/…" });

  // ---- form response sheets ----------------------------------------------
  section("Form responses",
    "Every submission is already recorded by Google. Point at each form and the company view scores it on real submissions rather than on ticks — and the Tick vs form tab can check one against the other. Paste either the form's EDIT url (the one ending /edit, not /viewform) or its linked responses spreadsheet.");
  urlRow("resp.opening",  "Opening — responses",  "Opening Daily Check List — form edit URL or its responses sheet.", {});
  urlRow("resp.closing",  "Closing — responses",  "Closing Daily Check List — form edit URL or its responses sheet.", {});
  urlRow("resp.workshop", "Weekly Training Recap — responses", "Weekly Training Recap form — edit URL or its responses sheet.", {});

  // ---- manager tools -------------------------------------------------------
  section("Manager tools", "Used only in the DM month tab. Stores never see this.");
  urlRow("link.storeVisit", "Store Visit Checklist",
    "The form a DM fills in on each store's monthly walk.",
    { fallback: (CONFIG.dm && CONFIG.dm.storeVisitUrl) || "" });

  // ---- options ------------------------------------------------------------
  section("Options", "");

  const nrow = document.createElement("div");
  nrow.className = "lrow";
  nrow.innerHTML = '<div class="lrow-h"><h3>Reminder emails</h3><span class="tagline">nudge.to</span></div>';
  const nin = document.createElement("input");
  nin.type = "text"; nin.className = "urlin"; nin.spellcheck = false;
  nin.placeholder = "you@wcogs.com, dm@wcogs.com";
  nin.value = SETTINGS["nudge.to"] || "";
  inputs["nudge.to"] = nin;
  nrow.appendChild(nin);
  const nf = document.createElement("div");
  nf.className = "lrow-f";
  nf.innerHTML = '<span class="hint">A list of what has not been ticked, at 11am and 7pm on trading days. Leave blank for none. Run <code>installNudges()</code> once in Apps Script to switch the schedule on.</span>';
  nrow.appendChild(nf);
  host.appendChild(nrow);


  const prow = document.createElement("div");
  prow.className = "lrow";
  prow.innerHTML = '<div class="lrow-h"><h3>Show sales pace to stores</h3><span class="tagline">feature.pace</span></div>';
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mini";
  let paceOn = featureOn("pace");
  const paintToggle = () => { toggle.textContent = paceOn ? "On" : "Off"; toggle.style.borderColor = paceOn ? "var(--ok)" : "var(--line)"; toggle.style.color = paceOn ? "var(--ok)" : "var(--ink-2)"; };
  paintToggle();
  toggle.addEventListener("click", () => { paceOn = !paceOn; paintToggle(); });
  const pf = document.createElement("div");
  pf.className = "lrow-f";
  pf.innerHTML = '<span class="hint">Puts the store\'s sales against goal, and the daily number needed to close the gap, on every shift\'s screen. Read from the EOD workbook\'s Dashboard tab. Worth thinking about whether your teams find that motivating on a bad week.</span>';
  pf.appendChild(toggle);
  prow.appendChild(pf);
  host.appendChild(prow);

  // ---- save ---------------------------------------------------------------
  const acts = document.createElement("div");
  acts.className = "admin-actions";
  const save = document.createElement("button");
  save.className = "btn"; save.textContent = "Save";
  acts.appendChild(save);
  const note = document.createElement("span");
  note.className = "hint"; note.style.fontSize = "13px"; note.style.color = "var(--ink-3)";
  note.textContent = adminNote;
  acts.appendChild(note);
  host.appendChild(acts);

  const paste = document.createElement("div");
  paste.className = "paste";
  paste.innerHTML = "<h3>Config block for the repo</h3>" +
    "<p>Optional. Paste this over the <code>modules</code> section of <code>site/index.html</code> to bake the current links in permanently.</p>" +
    "<textarea readonly spellcheck='false'></textarea>";
  host.appendChild(paste);
  const refreshPaste = () => {
    const lines = MODULES.map(m =>
      '    ' + m.key + ': { url: "' + (inputs["link." + m.key].value.trim().replace(/"/g, '\\"')) + '", byStore: {} }');
    paste.querySelector("textarea").value = "  modules: {\n" + lines.join(",\n") + "\n  },";
  };
  refreshPaste();
  Object.keys(inputs).forEach(k => inputs[k].addEventListener("input", refreshPaste));

  save.addEventListener("click", async () => {
    const map = {};
    let bad = "";
    Object.keys(inputs).forEach(k => {
      const v = inputs[k].value.trim();
      if(!v) return;
      if(k !== "nudge.to" && !/^https?:\/\//i.test(v)) bad = bad || k;
      if(k.indexOf("link.") === 0 && v === builtInLink(k.slice(5))) return;   // unchanged
      map[k] = v;
    });
    if(bad){ say("The " + bad + " field doesn't look like a link — check it before saving."); return; }
    map["feature.pace"] = paceOn ? "on" : "off";

    save.disabled = true; note.textContent = "Saving…";
    const res = await saveSettings(map);
    save.disabled = false;
    if(res === "live"){
      adminNote = "Saved. Every store picks this up on their next load.";
      say("Saved for all stores.");
      loadSchedule(); loadPace();
    } else if(res === "offline"){
      adminNote = "Saved on this device only — the shared log didn't answer.";
      say("Saved here, but other stores didn't get it.");
    } else {
      adminNote = "Saved on this device only — no shared log configured.";
      say("Saved on this device only.");
    }
    distCache = {};
    renderAdmin();
  });
}

/* wire up */
try{ const gs=document.getElementById("gateStamp"); if(gs) gs.textContent = "Build " + BUILD + "  ·  Period logic + supply order"; }catch(e){}
buildGate();
(function paintGatePeriod(){
  const el = $("gatePeriod");
  if(!el) return;
  const p = salesPeriodOn(todayISO());
  el.textContent = p ? periodPhrase(p) + "  ·  ends " + fmtPeriodEnd(p.end) : "";
})();
$("enterBtn").addEventListener("click", tryPin);
$("cancelBtn").addEventListener("click", () => { $("pinRow").classList.add("hidden"); selected = null;
  document.querySelectorAll(".store-btn").forEach(x => x.setAttribute("aria-pressed","false")); });
$("pin").addEventListener("keydown", e => { if(e.key === "Enter") tryPin(); });
$("swapBtn").addEventListener("click", relock);
$("noteSave").addEventListener("click", saveNote);
$("schClose").addEventListener("click", closeSched);
$("schPrev").addEventListener("click", () => { weekPtr--; renderSched(); });
$("schNext").addEventListener("click", () => { weekPtr++; renderSched(); });
$("schToday").addEventListener("click", () => { weekPtr = findWeekFor(todayISO()); renderSched(); });
document.addEventListener("keydown", e => {
  if(e.key === "Escape"){ closeViewer(); closeSched(); closeDist(); closeAdmin(); $("whoAsk").classList.remove("on"); closeSupplyAsk(); }
});

$("whoGo").addEventListener("click", () => {
  const v = $("whoOther").value.trim().toUpperCase();
  if(!v){ $("whoOther").focus(); return; }
  setWho(v); $("whoAsk").classList.remove("on"); commitTask(pendingTask);
});
$("whoOther").addEventListener("keydown", e => { if(e.key === "Enter") $("whoGo").click(); });
$("whoCancel").addEventListener("click", () => { pendingTask = null; $("whoAsk").classList.remove("on"); });
$("supplyAskLater").addEventListener("click", () => {
  try{ localStorage.setItem(supplySeenKey(), "1"); }catch(e){}
  closeSupplyAsk();
});
$("supplyAskOpen").addEventListener("click", () => {
  try{ localStorage.setItem(supplySeenKey(), "1"); }catch(e){}
  closeSupplyAsk();
});
if($("meetAskLater")) $("meetAskLater").addEventListener("click", () => {
  try{ localStorage.setItem(meetSeenKey(), "1"); }catch(e){}
  closeMeetAsk();
});
if($("meetAskOpen")) $("meetAskOpen").addEventListener("click", () => {
  try{ localStorage.setItem(meetSeenKey(), "1"); }catch(e){}
  closeMeetAsk();
});


$("distOpen").addEventListener("click", () => {
  if(CONFIG.managerPin) showManagerStep();
  else openDist();
});
$("mgrBtn").addEventListener("click", tryManager);
$("adminOpen").addEventListener("click", () => { if(CONFIG.adminPin) showAdminStep(); else openAdmin(); });
$("admBtn").addEventListener("click", tryAdmin);
$("admCode").addEventListener("keydown", e => { if(e.key === "Enter") tryAdmin(); });
$("admCancel").addEventListener("click", () => {
  $("pinRow").classList.add("hidden");
  $("adminOpen").setAttribute("aria-pressed","false");
  $("pinErr").textContent = "";
});
$("admClose").addEventListener("click", closeAdmin);
$("vwClose").addEventListener("click", closeViewer);
$("vwSkip").addEventListener("click", closeViewer);
$("vwDone").addEventListener("click", () => {
  const t = viewerTask;
  closeViewer();
  if(t && active && !loadDone()[t]) toggleTask(t);
});
$("installBtn").addEventListener("click", async () => {
  if(!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $("installBtn").style.display = "none";
});
$("admReload").addEventListener("click", renderAdmin);
$("mgrCode").addEventListener("keydown", e => { if(e.key === "Enter") tryManager(); });
$("mgrCancel").addEventListener("click", () => {
  $("pinRow").classList.add("hidden");
  $("distOpen").setAttribute("aria-pressed","false");
  $("pinErr").textContent = "";
});
$("distClose").addEventListener("click", closeDist);
$("distExport").addEventListener("click", exportCSV);
$("distPrev").addEventListener("click", () => { stepPeriod(-1); renderView(); });
$("distNext").addEventListener("click", () => { if(!atLatest()){ stepPeriod(1); renderView(); } });
$("viewSel").addEventListener("click", e => {
  const b = e.target.closest("button[data-view]");
  if(!b) return;
  distView = b.dataset.view;
  if(distView === "dm") distPeriod = "month";
  if(distView === "compare" && distPeriod === "month") distPeriod = "week";
  distISO = todayISO();
  syncScopeButtons();
  renderView();
});
$("periodSel").addEventListener("click", e => {
  const b = e.target.closest("button[data-period]");
  if(!b) return;
  distPeriod = b.dataset.period;
  distISO = todayISO();
  syncScopeButtons();
  renderView();
});
$("distToday").addEventListener("click", () => { distISO = todayISO(); renderView(); });
$("scopeSel").addEventListener("click", e => {
  const b = e.target.closest("button[data-scope]");
  if(!b) return;
  distScope = b.dataset.scope;
  syncScopeButtons();
  renderView();
});

/* remember the store on this tablet */
/* The tablet stays signed in to its store. Who is working is asked at the first tick of
   the day, so ticks carry the right initials without anyone typing a code twice. */
try{
  const saved = localStorage.getItem(KEY);
  const s = STORES.find(x => x.name === saved);
  if(s) unlock(s);
}catch(e){}

loadSettings();
loadSchedule();
loadPace();

/* Installable on a store tablet: home-screen icon, full screen, and the shell kept on
   the device so a dropped connection doesn't take the checklists down with it. The
   registration is best-effort — it does nothing when the site is opened as a preview
   rather than served from its own origin. */
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

let installEvent = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installEvent = e;
  const b = $("installBtn");
  if(b) b.style.display = "";
});
setInterval(tick, 30000);
