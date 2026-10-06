/* Study System coaching rules.
   No external AI service and no grade prediction. */
const StudyCoach = (() => {
  const DAY = 86400000;

  function dateKey(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function validDate(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key))) return false;
    const d = new Date(key + "T12:00:00Z");
    return !isNaN(d) && d.toISOString().slice(0, 10) === key;
  }

  function addDays(key, n) {
    const d = new Date(key + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function weekStart(key) {
    const day = new Date(key + "T12:00:00Z").getUTCDay();
    return addDays(key, -((day + 6) % 7));
  }

  function monthStart(key) {
    return key.slice(0, 7) + "-01";
  }

  function nextMonth(key) {
    const d = new Date(monthStart(key) + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  function daysBetween(a, b) {
    return Math.round(
      (
        new Date(b + "T12:00:00Z") -
        new Date(a + "T12:00:00Z")
      ) / DAY
    );
  }

  function key(week, name) {
    return JSON.stringify([week, name]);
  }

  function number(v) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function localDay(row) {
    if (validDate(row.localDate)) return row.localDate;
    const d = new Date(row.timestamp);
    return isNaN(d) ? "" : dateKey(d);
  }

  function stageName(stage) {
    return ({
      1: "Learn",
      2: "Retrieval",
      3: "Assess"
    })[stage] || "Unknown";
  }

  function summarize(rows) {
    const s = {
      count: 0,
      seconds: 0,
      crossSeconds: 0,
      days: [],
      devices: [],
      stages: {
        1: {count: 0, seconds: 0, methods: Object.create(null)},
        2: {count: 0, seconds: 0, methods: Object.create(null)},
        3: {count: 0, seconds: 0, methods: Object.create(null)}
      },
      crossCount: 0,
      linkedAssess: 0,
      pairedAssess: 0,
      classes: Object.create(null),
      methods: Object.create(null)
    };

    const days = new Set();
    const devices = new Set();

    const valid = rows.filter(r =>
      [1, 2, 3].includes(Number(r.stage))
    );

    valid.forEach(r => {
      const stage = Number(r.stage);
      const secs = number(r.studySeconds);
      const cross = number(r.crosscheckSeconds);
      const name = String(r.className || "Unnamed class");
      const method = String(r.method || "Unspecified");

      s.count++;
      s.seconds += secs + cross;
      s.crossSeconds += cross;
      days.add(localDay(r));

      if (r.deviceId) devices.add(r.deviceId);

      s.stages[stage].count++;
      s.stages[stage].seconds += secs;

      const methods = s.stages[stage].methods;

      if (!methods[method]) {
        methods[method] = {count: 0, seconds: 0};
      }

      methods[method].count++;
      methods[method].seconds += secs;

      s.classes[name] = (s.classes[name] || 0) + secs + cross;
      s.methods[method] = (s.methods[method] || 0) + 1;

      if (stage === 2 && cross > 0) s.crossCount++;

      if (stage === 3 && r.visitId) {
        s.linkedAssess++;

        const cutoff = Date.parse(r.startedAt || r.timestamp);

        if (valid.some(t =>
          Number(t.stage) === 2 &&
          t.visitId === r.visitId &&
          t.className === r.className &&
          (t.deviceId || "") === (r.deviceId || "") &&
          Date.parse(t.timestamp) <= cutoff
        )) {
          s.pairedAssess++;
        }
      }
    });

    s.days = [...days].filter(Boolean);
    s.devices = [...devices];

    return s;
  }

  function forClassWeek(rows, name, week) {
    const end = addDays(week, 7);

    return rows.filter(r =>
      r.className === name &&
      localDay(r) >= week &&
      localDay(r) < end
    );
  }

  function pending(rows, reflections, startWeek, today) {
    const groups = new Map();

    rows.forEach(r => {
      const day = localDay(r);

      if (
        !day ||
        ![1, 2, 3].includes(Number(r.stage))
      ) {
        return;
      }

      const week = weekStart(day);
      const name = String(r.className || "");

      if (
        !name ||
        week < startWeek ||
        addDays(week, 6) > today
      ) {
        return;
      }

      const id = key(week, name);
      const reflection = reflections[id];

      if (
        reflection &&
        reflection.learningRating >= 1 &&
        reflection.learningRating <= 5 &&
        (
          reflection.hadAssessment === false ||
          (
            reflection.assessmentRating >= 1 &&
            reflection.assessmentRating <= 5
          )
        )
      ) {
        return;
      }

      groups.set(id, {
        key: id,
        weekStart: week,
        className: name,
        dueDate: addDays(week, 6)
      });
    });

    return [...groups.values()].sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart) ||
      a.className.localeCompare(b.className)
    );
  }

  function recommend(s, outcome = null) {
    const a = s.stages;
    const t = a[1].seconds + a[2].seconds + a[3].seconds;

    const shares = {
      learn: t ? a[1].seconds / t : 0,
      retrieval: t ? a[2].seconds / t : 0,
      assess: t ? a[3].seconds / t : 0
    };

    const l = outcome ? Number(outcome.learningRating) : null;

    const p = outcome && outcome.hadAssessment
      ? Number(outcome.assessmentRating)
      : null;

    const low = l !== null &&
      (l <= 2 || (p !== null && p <= 2));

    const strong = l !== null &&
      l >= 4 && (p === null || p >= 4);

    const base = {
      version: "coach-1.0",
      targetStage: 2,
      targetMethod: "Teach",
      caution:
        "Based on your logged activity and self-ratings, not verified grades " +
        "or proof of what caused your results."
    };

    const result = (
      code, title, text, stage = 2, method = "Teach"
    ) => Object.assign({}, base, {
      code,
      title,
      text,
      targetStage: stage,
      targetMethod: method
    });

    if (s.count === 0) {
      return result(
        "NO_DATA",
        "Build a starting point",
        "Log a study stage in this class, then use a quick Retrieval and " +
        "Crosscheck to decide what needs more work."
      );
    }

    if (strong) {
      return result(
        "KEEP_WORKING_APPROACH",
        "Keep what appears to be working",
        p === null
          ? "You reported clear learning but no assessment this week. Keep your " +
            "useful methods and use a short independent practice test to check " +
            "that understanding."
          : "You reported strong learning and assessment performance. Keep your " +
            "current approach; a later Retrieval → Crosscheck → Assess visit can " +
            "check whether it lasts.",
        3,
        "Practice Test"
      );
    }

    if (s.count < 2) {
      return result(
        "SMALL_SAMPLE",
        "Try one complete study cycle",
        "There is only one logged stage for this class this week. Try Retrieval " +
        "→ Crosscheck → a short Assess; more activity will make the suggestions " +
        "more useful."
      );
    }

    const noRetrieval = a[2].count === 0;
    const littleRetrieval =
      noRetrieval || (low && shares.retrieval < 0.15);

    if (
      littleRetrieval &&
      a[1].count > 0 &&
      a[3].count > 0
    ) {
      return result(
        "CONNECT_RETRIEVAL_ASSESS",
        "Connect Learn and Assess with Retrieval",
        "You logged learning and assessment, but " +
        (noRetrieval ? "no Retrieval" : "little Retrieval time") +
        ". Next visit, teach or reconstruct the material from memory, " +
        "Crosscheck, then take a short practice test or Anki session. " +
        "You can stop after any stage."
      );
    }

    if (littleRetrieval && a[1].count > 0) {
      return result(
        "RETRIEVE_AFTER_LEARN",
        "Check recall before more review",
        "Your log is mostly Learn. Put materials away and teach what you " +
        "remember. Crosscheck the gaps, relearn only what needs work, " +
        "and try a short Assess."
      );
    }

    if (noRetrieval && a[3].count > 0) {
      return result(
        "RETRIEVE_BEFORE_ASSESS",
        "Start your next Assess with Retrieval",
        "Your log has Assess but no separate Retrieval. Try teaching from " +
        "memory, Crosscheck it, then assess. This is a suggested experiment, " +
        "not a required time ratio."
      );
    }

    const anki = a[3].methods.Anki;

    if (
      low &&
      anki &&
      a[3].count >= 3 &&
      anki.count / a[3].count >= 0.65
    ) {
      return result(
        "MATCH_ASSESSMENT_TASK",
        "Add practice that matches your assessment",
        "Most of your Assess stages were Anki and you reported some " +
        "difficulty. Keep Anki for recall; also try a practice test or " +
        "problems that match your actual assessment after Retrieval " +
        "and Crosscheck.",
        3,
        "Practice Test"
      );
    }

    if (l !== null && l >= 4 && p !== null && p <= 2) {
      return result(
        "CHECK_CONFIDENCE",
        "Check explanation against independent performance",
        "Your learning rating was stronger than your assessment rating. " +
        "Try explaining without notes, Crosscheck, then answer exam-style " +
        "questions without hints. This may reveal gaps the confidence " +
        "rating missed."
      );
    }

    if (l !== null && l <= 2 && p !== null && p >= 4) {
      return result(
        "LOW_CONFIDENCE_STRONG_RESULT",
        "Use your results to check your confidence",
        "Your assessment rating was stronger than your learning rating. " +
        "Keep the methods that helped; explain the most uncertain idea " +
        "from memory and Crosscheck before deciding how much review you need."
      );
    }

    if (low && shares.learn >= 0.5) {
      return result(
        "TARGETED_RELEARN",
        "Change how you tackle the difficult parts",
        "You reported difficulty and much of your time was Learn. Work " +
        "through one example or seek an explanation of a specific gap, " +
        "then close the materials and retrieve it.",
        1,
        "Worked Examples"
      );
    }

    if (a[2].count > 0 && a[3].count === 0) {
      return result(
        "PAIR_RETRIEVAL_ASSESS",
        "Follow Retrieval with a short Assess",
        "You logged Retrieval but no Assess for this class this week. " +
        "After your next Crosscheck, choose Test Yourself Now and try " +
        "a short practice test or Anki session.",
        3,
        "Practice Test"
      );
    }

    if (a[2].count >= 2 && s.crossCount === 0) {
      return result(
        "LOG_CROSSCHECK",
        "Include a Crosscheck",
        "No Crosscheck time is logged for your Retrieval stages. Compare " +
        "your explanation with a reliable source, fix gaps, then assess. " +
        "Missing logged time does not prove you skipped checking."
      );
    }

    if (low) {
      return result(
        "TARGET_GAPS",
        "Use one gap-focused cycle",
        "You reported difficulty despite using several stages. Pick a topic " +
        "you missed, relearn that part, retrieve it without help, Crosscheck, " +
        "then try different assessment questions."
      );
    }

    return result(
      "TRY_COMBINATION",
      "Try Retrieval → Crosscheck → Assess",
      "Combine these stages during one visit to this class, then return " +
      "on another day. Keep the sequence optional and judge the adjustment " +
      "using your next check-in."
    );
  }

  return {
    dateKey,
    validDate,
    addDays,
    weekStart,
    monthStart,
    nextMonth,
    daysBetween,
    key,
    number,
    localDay,
    stageName,
    summarize,
    forClassWeek,
    pending,
    recommend
  };
})();


(() => {
  "use strict";

  // Existing v4 keys are deliberately retained.
  const K = {
    classes: "studySystem.classes.v4",
    sessions: "studySystem.sessions.v4",
    device: "studySystem.deviceId.v4",
    submissions: "studySystem.weeklySubmissions.v4",
    ankiDone: "studySystem.ankiDone.v4.",
    ankiHide: "studySystem.ankiDismiss.v4.",
    reflections: "studySystem.weeklyReflections.v1",
    start: "studySystem.reflectionStartWeek.v1",
    active: "studySystem.activeSession.v1",
    queue: "studySystem.outbox.v1",
    sync: "studySystem.syncReceipts.v1",
    backup: "studySystem.preCoachBackup.v1"
  };

  const C = StudyCoach;

  const catalog = {
    "Math": [
      "Algebra 1", "Geometry", "Algebra 2", "Integrated Math",
      "Math Analysis", "Precalculus", "Calculus",
      "AP Calculus AB", "AP Statistics", "Other Math"
    ],
    "Science": [
      "Biology", "Honors Biology", "Chemistry", "Physics",
      "Physiology", "AP Biology", "AP Chemistry",
      "AP Environmental Science", "AP Physics 1", "Other Science"
    ],
    "English": [
      "English 9", "English 9 Honors", "English 10",
      "English 10 Honors", "American Literature",
      "American Literature Honors", "AP English Language",
      "Advanced Composition", "Advanced Composition Honors",
      "AP English Literature", "Other English"
    ],
    "History / Social Science": [
      "World History", "Honors World History", "AP World History",
      "U.S. History", "AP U.S. History", "Government", "Economics",
      "AP Government", "AP Human Geography", "AP Psychology",
      "Ethnic Studies", "Health", "Other History / Social Science"
    ],
    "World Language": [
      "Spanish", "Spanish 2", "Spanish 3", "AP Spanish Language",
      "AP Spanish Literature", "Other World Language"
    ],
    "Elective / CTE": [
      "Architecture 1", "Architecture 2", "Architectural Design",
      "Digital Design", "Film & Video Production",
      "Exploring Computer Science", "Robotics",
      "Child Development", "Health Science",
      "Emergency Medical Technician", "Art", "AP Drawing",
      "AP 3-D Art & Design", "AP Seminar", "AP Research",
      "JROTC", "PE / Athletics", "Other Elective / CTE"
    ]
  };

  const stages = {
    1: {
      name: "Learn",
      purpose:
        "Build or rebuild your understanding using your learning materials.",
      instruction:
        "Use your notes, textbook, examples, videos, AI, Unit Coach, or " +
        "other learning resources to understand the material.",
      methods: [
        "Study / Review", "Textbook", "Video", "Concept Map",
        "Worked Examples", "AI Tutor", "Unit Coach"
      ]
    },
    2: {
      name: "Retrieval",
      purpose: "See what you can teach or produce from memory.",
      instruction:
        "Put your materials away. Do not check your notes yet. " +
        "First show yourself what you actually know.",
      methods: [
        "Teach", "Redo Notes from Memory",
        "Concept Map from Memory", "AI — Teach & Check"
      ]
    },
    3: {
      name: "Assess",
      purpose: "Test what you can do independently without help.",
      instruction:
        "Treat this like a real assessment. Avoid hints or " +
        "explanations until the activity is finished.",
      methods: [
        "Homework as Test", "Practice Test", "Practice Problems",
        "Anki", "AI Practice Test", "AI Game"
      ]
    }
  };

  const $ = id => document.getElementById(id);
  const root = $("appRoot");
  const dialog = $("reflectionDialog");

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

  const uid = () =>
    window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now() + "-" + Math.random().toString(36).slice(2);

  const today = () => C.dateKey();

  let screen = "home";
  let chosenClass = null;
  let chosenStage = null;
  let visitId = null;
  let completed = null;
  let periodKind = "week";
  let periodKey = C.weekStart(today());
  let reminderDismissed = false;
  let reflectionTarget = null;
  let syncBusy = false;
  let lastError = "";
  let lastDay = today();
  let storageBlocked = false;
  let lastCheckpoint = Date.now();
  let active = null;
  let launchAnki = false;

  // --------------------------------------------------
  // STORAGE
  // --------------------------------------------------

  function read(k, fallback) {
    try {
      const raw = localStorage.getItem(k);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      storageBlocked = true;
      throw new Error(
        "Saved data could not be read. Do not clear site data. " +
        "Export a backup before making changes."
      );
    }
  }

  function write(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      throw new Error(
        "This browser could not save data. Free device space or " +
        "export a backup; do not clear this site's storage."
      );
    }
  }

  function rawWrite(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      throw new Error(
        "Unable to save on this device. Please export a backup."
      );
    }
  }

  function classes() {
    const v = read(K.classes, []);

    if (!Array.isArray(v)) {
      throw new Error(
        "The saved classes need recovery. Do not clear them."
      );
    }

    return v;
  }

  function sessions() {
    const v = read(K.sessions, []);

    if (!Array.isArray(v)) {
      throw new Error(
        "The saved study history needs recovery. Do not clear it."
      );
    }

    return v;
  }

  function reflections() {
    return read(K.reflections, {});
  }

  function deviceId() {
    let id = localStorage.getItem(K.device);

    if (!id) {
      id = uid();
      rawWrite(K.device, id);
    }

    return id;
  }

  function message(text) {
    $("message").textContent = text;
  }

  function safe(fn) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (e) {
        console.error(e);
        message(e.message);
      }
    };
  }

  function time(sec) {
    const n = Math.max(0, Math.floor(sec || 0));

    return String(Math.floor(n / 60)).padStart(2, "0") +
      ":" + String(n % 60).padStart(2, "0");
  }

  function human(sec) {
    if (sec > 0 && sec < 60) return Math.round(sec) + " sec";

    const m = Math.round((sec || 0) / 60);

    return m < 60
      ? m + " min"
      : Math.floor(m / 60) + " hr" +
        (m % 60 ? " " + m % 60 + " min" : "");
  }

  function pretty(key) {
    return new Date(key + "T12:00:00").toLocaleDateString(
      undefined,
      {month: "short", day: "numeric", year: "numeric"}
    );
  }

  function rangeLabel(week) {
    return pretty(week) + " – " + pretty(C.addDays(week, 6));
  }

  function pct(n, d) {
    return d ? Math.round(n / d * 100) + "%" : "—";
  }

  function lastChecked(name) {
    const checks = sessions()
      .filter(r =>
        r.className === name &&
        [2, 3].includes(Number(r.stage))
      )
      .sort((a, b) =>
        String(b.timestamp).localeCompare(String(a.timestamp))
      );

    if (!checks.length) {
      return sessions().some(r => r.className === name)
        ? "Learn logged; no check logged yet"
        : "No check logged yet";
    }

    const diff = C.daysBetween(
      C.localDay(checks[0]),
      today()
    );

    return diff <= 0
      ? "Last checked today"
      : diff === 1
        ? "Last checked yesterday"
        : "Last checked " + diff + " days ago";
  }

  function pending() {
    return C.pending(
      sessions(),
      reflections(),
      localStorage.getItem(K.start) || C.weekStart(today()),
      today()
    );
  }

  function ankiDue() {
    const start = C.weekStart(today());
    const out = [];

    [start, C.addDays(start, 3)].forEach(day => {
      if (
        day <= today() &&
        localStorage.getItem(K.ankiDone + day) !== "1"
      ) {
        out.push(day);
      }
    });

    return out;
  }

  // --------------------------------------------------
  // SCREEN AND TIMER STATE
  // --------------------------------------------------

  function saveActive() {
    if (active) {
      active.lastSeen = Date.now();
      write(K.active, active);
    } else {
      localStorage.removeItem(K.active);
    }
  }

  function elapsed() {
    return active
      ? active.ms +
        (
          active.runningSince !== null
            ? Date.now() - active.runningSince
            : 0
        )
      : 0;
  }

  function pause() {
    if (active && active.runningSince !== null) {
      active.ms = elapsed();
      active.runningSince = null;
      saveActive();
    }
  }

  function navigate(to) {
    if (active && to !== "timer") {
      message(
        "Finish or cancel the current stage before leaving its timer."
      );
      return;
    }

    screen = to;
    render();
  }

  function render() {
    $("navigation").innerHTML = active
      ? '<span class="small">Session in progress</span>'
      : '<button class="text-button" data-nav="home">Study</button>' +
        '<button class="text-button" data-nav="progress">Progress</button>' +
        '<button class="text-button" data-nav="backup">Backup</button>';

    if (active) screen = "timer";

    if (screen === "home" && !classes().length) {
      screen = "classes";
    }

    if (screen === "classes") renderClasses();
    else if (screen === "stage") renderStages();
    else if (screen === "timer") renderTimer();
    else if (screen === "complete") renderComplete();
    else if (screen === "progress") renderProgress();
    else if (screen === "backup") renderBackup();
    else renderHome();

    updateSync();
  }

  // --------------------------------------------------
  // HOME
  // --------------------------------------------------

  function renderHome() {
    const due = pending();
    const anki = ankiDue();

    let s =
      '<section class="card intro">' +
      '<span class="eyebrow">YOUR NEXT STUDY VISIT</span>' +
      '<h2>Pick a class. Make one useful next move.</h2>' +
      '<p class="muted">Start at any stage. A second stage is always optional.</p>' +
      '</section>';

    if (due.length) {
      s +=
        '<section class="notice"><strong>' +
        due.length + " weekly check-in" +
        (due.length === 1 ? " is" : "s are") +
        ' waiting</strong><p class="small">' +
        "Two ratings per class. Unanswered check-ins stay here, " +
        "including after the week ends.</p>" +
        '<button class="primary" data-action="reflect">' +
        "Answer check-in</button></section>";
    }

    if (
      anki.length &&
      localStorage.getItem(K.ankiHide + today()) !== "1"
    ) {
      s +=
        '<section class="notice"><strong>Anki — Stage 3 Assess</strong><p>' +
        (
          anki[0] === today()
            ? "Your Monday/Thursday Anki session is due today."
            : "An Anki make-up for " + pretty(anki[0]) +
              " is due this week."
        ) +
        '</p><div class="actions">' +
        '<button class="primary" data-action="anki">' +
        "Choose a class for Anki</button>" +
        '<button class="secondary" data-action="hide-anki">' +
        "Hide for today</button></div></section>";
    }

    s +=
      '<section class="card"><div class="section-head">' +
      '<h2>Your classes</h2><button class="secondary" data-nav="classes">' +
      'Edit classes</button></div><div class="class-grid">';

    classes().forEach((c, i) => {
      s +=
        '<button class="class-button" data-class="' + i + '">' +
        "<strong>" + esc(c.name) + "</strong><span>" +
        esc(lastChecked(c.name)) + "</span></button>";
    });

    root.innerHTML = s + "</div></section>";

    maybePrompt();
  }

  // --------------------------------------------------
  // CLASS SETUP
  // --------------------------------------------------

  function renderClasses() {
    root.innerHTML =
      '<section class="card">' +
      '<span class="eyebrow">SAVED ON THIS DEVICE</span>' +
      '<h2>Set up your classes</h2>' +
      '<p class="muted">Add once; choose them for future study visits.</p>' +
      '<label class="field" for="subject">Subject</label>' +
      '<select id="subject"><option value="">Choose a subject</option>' +
      Object.keys(catalog)
        .map(x => "<option>" + esc(x) + "</option>")
        .join("") +
      "</select>" +
      '<label class="field" for="course">Class</label>' +
      '<select id="course">' +
      '<option value="">Choose a subject first</option></select>' +
      '<div id="customWrap" hidden>' +
      '<label class="field" for="custom">Your class name</label>' +
      '<input id="custom" type="text" maxlength="100" ' +
      'placeholder="Class name, not your name"></div>' +
      '<div class="actions">' +
      '<button class="primary" data-action="add-class">' +
      "Add class</button></div></section>" +
      '<section class="card"><h3>Your saved classes</h3>' +
      classes().map((c, i) =>
        '<div class="saved-row"><div><strong>' +
        esc(c.name) + '</strong><div class="small">' +
        esc(c.subject) +
        '</div></div><button class="secondary" data-remove="' +
        i + '">Remove</button></div>'
      ).join("") +
      (
        classes().length
          ? '<div class="actions">' +
            '<button class="primary" data-nav="home">' +
            "Done adding classes</button></div>"
          : '<p class="muted">Add at least one class to get started.</p>'
      ) +
      "</section>";

    $("subject").onchange = () => {
      $("course").innerHTML =
        '<option value="">Choose a class</option>' +
        (catalog[$("subject").value] || [])
          .map(x => "<option>" + esc(x) + "</option>")
          .join("");

      $("customWrap").hidden = true;
    };

    $("course").onchange = () => {
      $("customWrap").hidden =
        !$("course").value.startsWith("Other");
    };
  }

  // --------------------------------------------------
  // STAGES AND METHODS
  // --------------------------------------------------

  function renderStages() {
    if (!chosenClass) {
      screen = "home";
      render();
      return;
    }

    const ws = C.weekStart(today());

    const sum = C.summarize(
      C.forClassWeek(sessions(), chosenClass.name, ws)
    );

    const recent = Object.values(reflections())
      .filter(r => r.className === chosenClass.name)
      .sort((a, b) =>
        b.weekStart.localeCompare(a.weekStart)
      )[0];

    const advice = recent && recent.recommendation
      ? recent.recommendation
      : C.recommend(sum);

    root.innerHTML =
      '<section class="card"><div class="section-head"><div>' +
      '<span class="eyebrow">STUDYING</span><h2>' +
      esc(chosenClass.name) +
      '</h2></div><button class="secondary" data-nav="home">' +
      "Change class</button></div>" +
      (
        sum.count || recent
          ? '<div class="coach"><h3>' + esc(advice.title) +
            "</h3><p>" + esc(advice.text) + "</p></div>"
          : ""
      ) +
      '<p class="muted">Choose any stage. The suggestions are options, ' +
      'not a required sequence.</p><div class="grid">' +
      [1, 2, 3].map(n =>
        '<button class="stage-button ' +
        (chosenStage === n ? "selected" : "") +
        '" data-stage="' + n + '"><span>Stage ' + n +
        "</span><strong>" + stages[n].name +
        "</strong><span>" + stages[n].purpose +
        "</span></button>"
      ).join("") +
      "</div>" +
      (
        chosenStage
          ? '<div class="stage-details"><h3>Choose your ' +
            stages[chosenStage].name +
            ' method</h3><div class="methods">' +
            stages[chosenStage].methods.map((m, i) =>
              '<button class="method-button" data-method="' +
              i + '">' + esc(m) + "</button>"
            ).join("") +
            "</div></div>"
          : ""
      ) +
      "</section>";
  }

  function openTimer(method) {
    if (active) return;

    // Anki always belongs to Stage 3 — Assess.
    if (method === "Anki") chosenStage = 3;

    active = {
      id: uid(),
      visitId: visitId || uid(),
      className: chosenClass.name,
      subject: chosenClass.subject,
      stage: chosenStage,
      method,
      phase: "study",
      ms: 0,
      runningSince: null,
      startedAt: null,
      lastSeen: Date.now(),
      record: null
    };

    saveActive();
    screen = "timer";
    render();
  }

  // --------------------------------------------------
  // STUDY AND CROSSCHECK TIMERS
  // --------------------------------------------------

  function renderTimer() {
    const cross = active.phase === "crosscheck";

    root.innerHTML =
      '<section class="card timer"><span class="eyebrow">' +
      esc(active.className) + "</span><h2>" +
      (
        cross
          ? "Crosscheck"
          : "Stage " + active.stage + " — " +
            C.stageName(active.stage)
      ) +
      "</h2><h3>" + esc(active.method) +
      '</h3><p class="muted">' +
      (
        cross
          ? "Your Retrieval is already saved. Compare it with notes or another " +
            "reliable source, correct gaps, then consider a short Assess."
          : stages[active.stage].instruction
      ) +
      '</p><div id="clock" class="clock" role="timer" ' +
      'aria-label="Elapsed study time">' +
      time(elapsed() / 1000) +
      '</div><div class="actions">' +
      '<button class="primary" data-action="toggle-timer">' +
      (
        active.runningSince !== null
          ? "Pause"
          : active.ms > 0
            ? "Resume"
            : cross ? "Start Crosscheck" : "Start"
      ) +
      "</button>" +
      (
        active.startedAt || cross
          ? '<button class="secondary" data-action="finish-timer">' +
            (cross ? "Finish Crosscheck" : "Finish stage") +
            "</button>"
          : ""
      ) +
      '<button class="text-button" data-action="' +
      (cross ? "skip-crosscheck" : "cancel-timer") + '">' +
      (cross ? "Skip Crosscheck for now" : "Cancel stage") +
      '</button></div><p class="small">' +
      "Time is logged automatically. Do not enter names or grades." +
      "</p></section>";
  }

  function persistRecord(record) {
    const rows = sessions();

    const i = rows.findIndex(r =>
      (r.id && r.id === record.id) ||
      r.timestamp === record.timestamp
    );

    if (i >= 0) rows[i] = record;
    else rows.push(record);

    write(K.sessions, rows);

    try {
      queueStage(record);
    } catch (e) {
      message(
        "Saved on this device; the upload is waiting. " +
        e.message
      );
    }
  }

  function finishTimer(skip = false) {
    if (!active) return;

    pause();

    if (active.phase === "study") {
      if (!active.startedAt) {
        message("Start the timer before finishing.");
        return;
      }

      const now = new Date();

      const record = {
        id: active.id,
        visitId: active.visitId,
        startedAt: active.startedAt,
        timestamp: now.toISOString(),
        localDate: C.dateKey(now),
        className: active.className,
        subject: active.subject,
        stage: active.stage,
        stageName: C.stageName(active.stage),
        method: active.method,
        studySeconds: Math.floor(active.ms / 1000),
        crosscheckSeconds: 0,
        totalSeconds: Math.floor(active.ms / 1000)
      };

      // Save Retrieval before Crosscheck so it is not lost.
      persistRecord(record);

      if (
        record.stage === 3 &&
        record.method === "Anki"
      ) {
        const due = ankiDue();

        if (due.length) {
          rawWrite(K.ankiDone + due[0], "1");
        }
      }

      if (active.stage === 2) {
        active.record = record;
        active.phase = "crosscheck";
        active.ms = 0;
        active.runningSince = null;
        saveActive();
        render();
        return;
      }

      completed = record;

    } else {
      const r = Object.assign({}, active.record);

      r.crosscheckSeconds = skip
        ? 0
        : Math.floor(active.ms / 1000);

      r.crosscheckSkipped = skip;
      r.totalSeconds =
        r.studySeconds + r.crosscheckSeconds;

      persistRecord(r);
      completed = r;
    }

    active = null;
    saveActive();
    screen = "complete";
    render();
  }

  function renderComplete() {
    if (!completed) {
      screen = "home";
      render();
      return;
    }

    const next = completed.stage === 1
      ? "Retrieve What You Remember"
      : completed.stage === 2
        ? "Test Yourself Now"
        : "Choose Another Stage";

    root.innerHTML =
      '<section class="card">' +
      '<span class="eyebrow">SAVED ON THIS DEVICE</span>' +
      "<h2>Stage " + completed.stage + " — " +
      C.stageName(completed.stage) +
      " complete</h2><p><strong>" +
      esc(completed.className) + "</strong> · " +
      esc(completed.method) + " · " +
      human(completed.studySeconds) +
      (
        completed.crosscheckSeconds
          ? " + " + human(completed.crosscheckSeconds) +
            " Crosscheck"
          : ""
      ) +
      '</p><div class="coach"><h3>' +
      next + "</h3><p>" +
      (
        completed.stage === 2
          ? "Ready to continue? Try a short independent practice test, " +
            "problems, or Anki after your Crosscheck."
          : "Continue only if it serves your learning goal. " +
            "You can also finish now."
      ) +
      '</p></div><div class="actions">' +
      '<button class="primary" data-action="next-stage">' +
      next +
      '</button><button class="secondary" data-action="finish-visit">' +
      "Finish studying</button></div></section>";
  }

  // --------------------------------------------------
  // WEEKLY AND MONTHLY STUDENT PROGRESS
  // --------------------------------------------------

  function renderProgress() {
    const rows = sessions();
    const now = today();

    const keys = new Set([
      periodKind === "week"
        ? C.weekStart(now)
        : C.monthStart(now)
    ]);

    rows.forEach(r => {
      const day = C.localDay(r);

      if (day) {
        keys.add(
          periodKind === "week"
            ? C.weekStart(day)
            : C.monthStart(day)
        );
      }
    });

    if (!keys.has(periodKey)) {
      periodKey = [...keys].sort().reverse()[0];
    }

    const end = periodKind === "week"
      ? C.addDays(periodKey, 7)
      : C.nextMonth(periodKey);

    const selected = rows.filter(r =>
      C.localDay(r) >= periodKey &&
      C.localDay(r) < end
    );

    const s = C.summarize(selected);

    const stageTotal = [1, 2, 3].reduce(
      (n, k) => n + s.stages[k].seconds,
      0
    );

    let html =
      '<section class="card">' +
      '<span class="eyebrow">YOUR STUDY PATTERNS</span>' +
      '<h2>Progress & next steps</h2><div class="actions">' +
      '<button class="' +
      (periodKind === "week" ? "primary" : "secondary") +
      '" data-period="week">Weekly</button>' +
      '<button class="' +
      (periodKind === "month" ? "primary" : "secondary") +
      '" data-period="month">Monthly</button></div>' +
      '<label class="field" for="periodSelect">Choose a ' +
      periodKind +
      '</label><select id="periodSelect">' +
      [...keys].sort().reverse().map(k =>
        '<option value="' + k + '" ' +
        (k === periodKey ? "selected" : "") + ">" +
        (
          periodKind === "week"
            ? esc(rangeLabel(k))
            : esc(new Date(k + "T12:00:00").toLocaleDateString(
                undefined,
                {month: "long", year: "numeric"}
              ))
        ) +
        "</option>"
      ).join("") +
      '</select></section><section class="card">' +
      '<div class="stats"><div class="stat">' +
      "<span>Total time</span><strong>" +
      human(s.seconds) +
      '</strong></div><div class="stat">' +
      "<span>Completed stages</span><strong>" +
      s.count +
      '</strong></div><div class="stat">' +
      "<span>Study days</span><strong>" +
      s.days.length +
      "</strong></div></div>" +
      '<h3 style="margin-top:20px">Your study mix</h3>' +
      '<div class="mixbar" aria-hidden="true">' +
      [1, 2, 3].map(k =>
        '<i class="' +
        ({1: "learn", 2: "retrieval", 3: "assess"}[k]) +
        '" style="width:' +
        (
          stageTotal
            ? s.stages[k].seconds / stageTotal * 100
            : 0
        ) +
        '%"></i>'
      ).join("") +
      '</div><div class="legend">' +
      [1, 2, 3].map(k =>
        '<span><i class="dot ' +
        ({1: "learn", 2: "retrieval", 3: "assess"}[k]) +
        '"></i>' +
        C.stageName(k) + " " +
        pct(s.stages[k].seconds, stageTotal) +
        "</span>"
      ).join("") +
      '</div><p class="small">' +
      "Stage percentages use study time, not Crosscheck. Crosscheck: " +
      human(s.crossSeconds) +
      ". There is no required “perfect” percentage.</p></section>";

    const names = [
      ...new Set(selected.map(r => r.className))
    ];

    names.forEach(name => {
      const classRows = selected.filter(r =>
        r.className === name
      );

      const cs = C.summarize(classRows);

      const ref = periodKind === "week"
        ? reflections()[C.key(periodKey, name)]
        : null;

      const advice = ref && ref.recommendation
        ? ref.recommendation
        : C.recommend(cs);

      html +=
        '<section class="card"><div class="section-head"><div>' +
        '<span class="eyebrow">' +
        human(cs.seconds) + " · " +
        cs.count + " COMPLETED STAGES</span><h2>" +
        esc(name) + "</h2></div>" +
        (
          periodKind === "week" &&
          C.addDays(periodKey, 6) <= today()
            ? '<button class="secondary" data-reflection-class="' +
              esc(name) + '" data-week="' + periodKey + '">' +
              (ref ? "Update ratings" : "Weekly check-in") +
              "</button>"
            : ""
        ) +
        "</div>";

      if (ref) {
        html +=
          '<p class="small">Your ratings: learning ' +
          ref.learningRating + "/5 · " +
          (
            ref.hadAssessment
              ? "assessment " + ref.assessmentRating + "/5"
              : "no assessment this week"
          ) +
          ". Advice below uses the snapshot saved " +
          esc(new Date(ref.timestamp).toLocaleString()) +
          ".</p>";
      }

      html +=
        '<div class="coach"><h3>' +
        esc(advice.title) + "</h3><p>" +
        esc(advice.text) + "</p>" +
        '<button class="text-button" data-coach-class="' +
        esc(name) +
        '" data-coach-stage="' +
        advice.targetStage +
        '">Choose this next step →</button></div>' +
        "<details><summary>Methods within each stage</summary>";

      [1, 2, 3].forEach(k => {
        const st = cs.stages[k];

        const entries = Object.entries(st.methods).sort(
          (a, b) => b[1].count - a[1].count
        );

        html +=
          '<div class="stage-details"><h3>' +
          C.stageName(k) + "</h3>";

        if (!entries.length) {
          html +=
            '<p class="small">No ' +
            C.stageName(k) +
            " stage logged in this period.</p>";

        } else {
          html +=
            '<div class="table-wrap"><table><thead><tr>' +
            '<th>Method</th><th class="num">Uses</th>' +
            '<th class="num">% of uses</th>' +
            '<th class="num">Time</th>' +
            '<th class="num">% of time</th>' +
            "</tr></thead><tbody>" +
            entries.map(([n, d]) =>
              "<tr><td>" + esc(n) +
              '</td><td class="num">' + d.count +
              '</td><td class="num">' +
              pct(d.count, st.count) +
              '</td><td class="num">' + human(d.seconds) +
              '</td><td class="num">' +
              pct(d.seconds, st.seconds) +
              "</td></tr>"
            ).join("") +
            "</tbody></table></div>";
        }

        html += "</div>";
      });

      html +=
        '</details><p class="small">' +
        esc(advice.caution) +
        "</p></section>";
    });

    if (!names.length) {
      html +=
        '<section class="card"><p>' +
        "No completed stages in this period. Earlier records remain " +
        "available in the period selector.</p></section>";
    }

    if (periodKind === "week") {
      html +=
        '<section class="card"><h3>Weekly summary</h3>' +
        '<p class="small">Stages and check-ins sync automatically. ' +
        "This button also sends the compatible weekly aggregate.</p>" +
        '<button class="secondary" data-action="weekly-share">' +
        "Share / update weekly summary</button></section>";
    }

    root.innerHTML = html;

    $("periodSelect").onchange = () => {
      periodKey = $("periodSelect").value;
      render();
    };
  }

  // --------------------------------------------------
  // SUNDAY CHECK-INS
  // --------------------------------------------------

  function ratingField(name, label) {
    return (
      "<fieldset><legend>" + label +
      '</legend><div class="rating-grid">' +
      [1, 2, 3, 4, 5].map(n =>
        '<label class="rating-option">' +
        '<input type="radio" name="' +
        name + '" value="' + n +
        '" required aria-label="' + n +
        ' out of 5"><span>' +
        n + "</span></label>"
      ).join("") +
      '</div><div class="scale">' +
      "<span>1 · Not well</span><span>5 · Very well</span></div>" +
      (
        name === "assessment"
          ? '<label class="none-option">' +
            '<input type="radio" name="assessment" value="none">' +
            " No assessment this week</label>"
          : ""
      ) +
      "</fieldset>"
    );
  }

  function openReflection(target = null) {
    if (active) return;

    const due = pending();
    reflectionTarget = target || due[0];

    if (!reflectionTarget) {
      message("All due check-ins are answered.");
      return;
    }

    const r = reflections()[
      C.key(
        reflectionTarget.weekStart,
        reflectionTarget.className
      )
    ];

    dialog.innerHTML =
      '<form id="reflectionForm"><span class="badge">WEEKLY CHECK-IN' +
      (due.length > 1 ? " · " + due.length + " waiting" : "") +
      '</span><h2 id="reflectionTitle">' +
      esc(reflectionTarget.className) +
      '</h2><p class="small">' +
      esc(rangeLabel(reflectionTarget.weekStart)) +
      "</p><p>Think about this class during the dates above. " +
      "These are self-ratings, not a grade submission.</p>" +
      ratingField(
        "learning",
        "How well did your learning go?"
      ) +
      ratingField(
        "assessment",
        "How well did your quizzes, tests, or graded assessments go?"
      ) +
      '<p class="small">A rating is optional now, but this check-in ' +
      "stays due until both questions are answered.</p>" +
      '<div class="actions">' +
      '<button class="primary" type="submit">' +
      "Save ratings & see my next step</button>" +
      '<button type="button" class="secondary" id="laterReflection">' +
      "Study first</button></div>" +
      '<p id="reflectionError" role="alert"></p></form>';

    if (r) {
      dialog.querySelector(
        'input[name="learning"][value="' +
        r.learningRating + '"]'
      ).checked = true;

      dialog.querySelector(
        'input[name="assessment"][value="' +
        (r.hadAssessment ? r.assessmentRating : "none") +
        '"]'
      ).checked = true;
    }

    $("laterReflection").onclick = () => {
      reminderDismissed = true;
      dialog.close();
    };

    $("reflectionForm").onsubmit = e => {
      e.preventDefault();

      try {
        const form = new FormData(e.target);
        const learning = Number(form.get("learning"));
        const result = form.get("assessment");

        if (
          !(learning >= 1 && learning <= 5) ||
          !result
        ) {
          throw new Error(
            "Please answer both questions, or choose No assessment this week."
          );
        }

        const target = reflectionTarget;

        const rs = C.forClassWeek(
          sessions(),
          target.className,
          target.weekStart
        );

        const snapshot = C.summarize(rs);

        const outcome = {
          learningRating: learning,
          hadAssessment: result !== "none",
          assessmentRating:
            result === "none" ? null : Number(result)
        };

        const advice = C.recommend(snapshot, outcome);

        const record = Object.assign({
          weekStart: target.weekStart,
          className: target.className,
          timestamp: new Date().toISOString(),
          revisionId: uid(),
          snapshot,
          recommendation: advice
        }, outcome);

        const all = reflections();

        all[C.key(record.weekStart, record.className)] = record;

        write(K.reflections, all);

        // Queue the underlying stages before the reflection.
        rs.forEach(queueStage);
        queueReflection(record);

        dialog.innerHTML =
          '<span class="badge">RATINGS SAVED ON THIS DEVICE</span>' +
          '<h2 id="reflectionTitle">' +
          esc(advice.title) + "</h2><p>" +
          esc(advice.text) +
          '</p><p class="small">' +
          esc(advice.caution) +
          '</p><div class="actions">' +
          '<button class="primary" id="doneReflection">' +
          "Continue</button></div>";

        $("doneReflection").onclick = () => {
          dialog.close();
          reminderDismissed = false;
          screen = "home";
          render();
        };

        updateSync();

      } catch (err) {
        $("reflectionError").textContent = err.message;
      }
    };

    if (!dialog.open) dialog.showModal();
  }

  dialog.addEventListener("cancel", () => {
    reminderDismissed = true;
  });

  function maybePrompt() {
    if (
      screen !== "home" ||
      active ||
      dialog.open ||
      reminderDismissed ||
      !pending().length
    ) {
      return;
    }

    setTimeout(() => {
      if (
        !active &&
        screen === "home" &&
        !dialog.open &&
        !reminderDismissed
      ) {
        openReflection();
      }
    }, 80);
  }

  // --------------------------------------------------
  // GOOGLE SUBMISSION QUEUE
  // Remove queued items only after Google confirms them.
  // --------------------------------------------------

  function enqueue(key, payload) {
    const queue = read(K.queue, []);
    const fingerprint = JSON.stringify(payload);
    const receipt = read(K.sync, {});

    if (receipt[key] === fingerprint) return;

    const existing = queue.find(q => q.key === key);

    if (
      existing &&
      existing.fingerprint === fingerprint
    ) {
      return;
    }

    const q = {
      key,
      payload,
      fingerprint,
      revision: uid(),
      attempts: 0,
      nextTry: 0
    };

    const i = queue.findIndex(x => x.key === key);

    if (i >= 0) queue[i] = q;
    else queue.push(q);

    write(K.queue, queue);
    updateSync();

    setTimeout(() => syncQueue(), 0);
  }

  function queueStage(r) {
    enqueue(
      "stage:" + deviceId() + ":" + r.timestamp,
      {
        action: "submitStage",
        deviceId: deviceId(),
        sessionId: r.id || "",
        visitId: r.visitId || "",
        startedAt: r.startedAt || "",
        timestamp: r.timestamp,
        localDate: C.localDay(r),
        className: r.className,
        subject: r.subject || "",
        stage: r.stage,
        stageName: C.stageName(Number(r.stage)),
        method: r.method,
        studySeconds: r.studySeconds || 0,
        crosscheckSeconds: r.crosscheckSeconds || 0,
        totalSeconds:
          C.number(r.studySeconds) +
          C.number(r.crosscheckSeconds)
      }
    );
  }

  function queueReflection(r) {
    enqueue(
      "reflection:" + deviceId() + ":" +
      C.key(r.weekStart, r.className),
      {
        action: "submitReflection",
        deviceId: deviceId(),
        weekStart: r.weekStart,
        className: r.className,
        timestamp: r.timestamp,
        revisionId: r.revisionId,
        learningRating: r.learningRating,
        hadAssessment: r.hadAssessment,
        assessmentRating:
          r.hadAssessment ? r.assessmentRating : "",
        snapshotJson: JSON.stringify(r.snapshot),
        recommendationCode: r.recommendation.code,
        recommendationText: r.recommendation.text,
        ruleVersion: r.recommendation.version
      }
    );
  }

  function updateSync() {
    let queue = [];

    try {
      queue = read(K.queue, []);
    } catch (e) {
      return;
    }

    $("syncStatus").textContent = syncBusy
      ? "Sending saved data…"
      : queue.length
        ? queue.length +
          " item" + (queue.length === 1 ? "" : "s") +
          " saved locally; waiting for Google confirmation." +
          (lastError ? " " + lastError : "")
        : "New uploads are up to date. Your study history stays saved on this device.";
  }

  function post(payload) {
    return new Promise((resolve, reject) => {
      const endpoint = window.STUDY_TRACKER_WEEKLY_ENDPOINT;

      if (!endpoint) {
        reject(new Error("Backend URL missing."));
        return;
      }

      if (location.protocol === "file:") {
        reject(new Error("Open the GitHub Pages site to sync."));
        return;
      }

      const requestId = uid();
      const frame = document.createElement("iframe");
      const form = document.createElement("form");

      frame.name =
        "study_upload_" +
        requestId.replace(/[^a-z0-9]/gi, "");

      frame.hidden = true;
      frame.title = "Study data submission";

      form.method = "POST";
      form.action = endpoint;
      form.target = frame.name;
      form.hidden = true;

      Object.entries(Object.assign({}, payload, {
        requestId,
        replyOrigin: location.origin
      })).forEach(([k, v]) => {
        const input = document.createElement("input");

        input.type = "hidden";
        input.name = k;
        input.value = String(v ?? "");

        form.appendChild(input);
      });

      const clean = () => {
        clearTimeout(timeout);
        window.removeEventListener("message", receive);
        frame.remove();
        form.remove();
      };

      const receive = e => {
        const validOrigin =
          e.origin === "https://script.google.com" ||
          e.origin === "https://script.googleusercontent.com" ||
          /^https:\/\/[a-z0-9-]+[.-]script\.googleusercontent\.com$/i.test(e.origin);

        if (
          !validOrigin ||
          !e.data ||
          e.data.channel !== "study-coach-ack" ||
          e.data.requestId !== requestId
        ) {
          return;
        }

        clean();

        if (e.data.ok) {
          resolve(e.data);
        } else {
          reject(new Error(
            e.data.message ||
            "Google did not accept this item."
          ));
        }
      };

      const timeout = setTimeout(() => {
        clean();

        reject(new Error(
          "No confirmation yet. It will retry."
        ));
      }, 45000);

      window.addEventListener("message", receive);
      document.body.append(frame, form);
      form.submit();
    });
  }

  async function syncQueue(force = false) {
    if (
      syncBusy ||
      storageBlocked ||
      !navigator.onLine
    ) {
      return;
    }

    try {
      const queue = read(K.queue, []);

      const q = queue.find(x =>
        force ||
        !x.nextTry ||
        x.nextTry <= Date.now()
      );

      if (!q) {
        updateSync();
        return;
      }

      syncBusy = true;
      updateSync();

      try {
        await post(q.payload);

        const latest = read(K.queue, []);

        write(
          K.queue,
          latest.filter(x =>
            !(
              x.key === q.key &&
              x.revision === q.revision
            )
          )
        );

        const receipts = read(K.sync, {});
        receipts[q.key] = q.fingerprint;
        write(K.sync, receipts);

        lastError = "";

      } catch (e) {
        lastError = e.message;

        const latest = read(K.queue, []);

        const found = latest.find(x =>
          x.key === q.key &&
          x.revision === q.revision
        );

        if (found) {
          found.attempts++;

          found.nextTry = Date.now() + Math.min(
            600000,
            15000 * Math.pow(
              2,
              Math.min(found.attempts, 6)
            )
          );

          write(K.queue, latest);
        }

      } finally {
        syncBusy = false;
        updateSync();
      }

      setTimeout(() => syncQueue(), 1000);

    } catch (e) {
      syncBusy = false;
      message(e.message);
    }
  }

  function shareWeek() {
    const end = C.addDays(periodKey, 7);

    const s = C.summarize(
      sessions().filter(r =>
        C.localDay(r) >= periodKey &&
        C.localDay(r) < end
      )
    );

    if (!s.count) {
      message(
        "There is no activity to share for this week."
      );
      return;
    }

    enqueue(
      "weekly:" + deviceId() + ":" + periodKey,
      {
        action: "submitWeekly",
        deviceId: deviceId(),
        weekStart: periodKey,
        totalSeconds: s.seconds,
        studyDays: s.days.length,
        stage1Seconds: s.stages[1].seconds,
        stage2Seconds: s.stages[2].seconds,
        stage3Seconds: s.stages[3].seconds,
        crosscheckSeconds: s.crossSeconds,
        stageCount: s.count,
        classesJson: JSON.stringify(s.classes),
        methodCountsJson: JSON.stringify(s.methods)
      }
    );

    const history = read(K.submissions, {});
    history[periodKey] = new Date().toISOString();
    write(K.submissions, history);

    message(
      "Weekly summary queued. The sync bar shows when Google confirms it."
    );
  }

  // --------------------------------------------------
  // BACKUP AND RESTORE
  // --------------------------------------------------

  function backupData() {
    const data = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (
        key.startsWith("studySystem.") &&
        key !== K.backup &&
        key !== "studySystem.beforeRestore.v1"
      ) {
        data[key] = localStorage.getItem(key);
      }
    }

    return {
      format: "Study System Backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  function exportBackup() {
    const blob = new Blob(
      [JSON.stringify(backupData(), null, 2)],
      {type: "application/json"}
    );

    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);
    a.download =
      "study-system-backup-" + today() + ".json";

    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(a.href);
    }, 5000);

    message("Backup exported. Keep it somewhere safe.");
  }

  function renderBackup() {
    root.innerHTML =
      '<section class="card"><h2>Keep your study history safe</h2>' +
      "<p>This update uses your existing v4 classes, sessions, and " +
      "anonymous device ID. New check-ins are stored separately.</p>" +
      '<p class="muted">A browser update does not transfer data between ' +
      "devices, browsers, or Home Screen apps. Clearing site data can " +
      "remove the local copy. Export a backup first.</p>" +
      '<div class="actions">' +
      '<button class="primary" data-action="export">' +
      "Export my backup</button>" +
      '<button class="secondary" data-action="import">' +
      "Restore / merge a backup</button></div>" +
      '<p class="small">Restoring merges records; it does not erase your ' +
      "current records. Backups from a different device ID are accepted " +
      "only when this device has no study history or classes.</p></section>";
  }

  $("backupInput").onchange = async e => {
    try {
      const file = e.target.files[0];
      if (!file) return;

      const b = JSON.parse(await file.text());

      if (
        b.format !== "Study System Backup" ||
        !b.data
      ) {
        throw new Error(
          "Choose a Study System backup JSON file."
        );
      }

      const oldId = b.data[K.device];
      const currentId = localStorage.getItem(K.device);

      if (
        oldId &&
        currentId !== oldId &&
        (
          classes().length ||
          sessions().length ||
          Object.keys(reflections()).length
        )
      ) {
        throw new Error(
          "This backup belongs to a different anonymous device. " +
          "Use an empty browser profile to restore it without mixing identities."
        );
      }

      if (!confirm(
        "Merge this backup into this browser? " +
        "Existing study records will not be deleted."
      )) {
        return;
      }

      const parsed = k =>
        b.data[k] ? JSON.parse(b.data[k]) : null;

      const incomingClasses = parsed(K.classes) || [];
      const incomingSessions = parsed(K.sessions) || [];

      if (
        !Array.isArray(incomingClasses) ||
        !Array.isArray(incomingSessions)
      ) {
        throw new Error(
          "This backup has an invalid format."
        );
      }

      const mergedClasses = classes();

      incomingClasses.forEach(c => {
        if (
          c &&
          typeof c.name === "string" &&
          !mergedClasses.some(x =>
            x.name.toLowerCase() === c.name.toLowerCase()
          )
        ) {
          mergedClasses.push(c);
        }
      });

      const mergedSessions = sessions();

      incomingSessions.forEach(r => {
        if (
          !r ||
          !C.validDate(C.localDay(r)) ||
          ![1, 2, 3].includes(Number(r.stage))
        ) {
          return;
        }

        const i = mergedSessions.findIndex(x =>
          (r.id && x.id === r.id) ||
          x.timestamp === r.timestamp
        );

        if (i < 0) {
          mergedSessions.push(r);
        } else if (
          C.number(r.totalSeconds) >
          C.number(mergedSessions[i].totalSeconds)
        ) {
          mergedSessions[i] = r;
        }
      });

      const mergedRefs = reflections();
      const refData = parsed(K.reflections) || {};

      Object.entries(refData).forEach(([k, r]) => {
        if (
          !mergedRefs[k] ||
          r.timestamp > mergedRefs[k].timestamp
        ) {
          mergedRefs[k] = r;
        }
      });

      // Save a pre-restore copy before applying merged data.
      write(
        "studySystem.beforeRestore.v1",
        backupData()
      );

      write(K.classes, mergedClasses);
      write(K.sessions, mergedSessions);
      write(K.reflections, mergedRefs);

      if (oldId) rawWrite(K.device, oldId);

      Object.entries(b.data).forEach(([k, v]) => {
        if (
          k.startsWith(K.ankiDone) &&
          v === "1"
        ) {
          rawWrite(k, v);
        }
      });

      if (
        b.data[K.start] &&
        C.validDate(b.data[K.start])
      ) {
        const start = localStorage.getItem(K.start);

        rawWrite(
          K.start,
          start && start < b.data[K.start]
            ? start
            : b.data[K.start]
        );
      }

      Object.values(mergedRefs).forEach(queueReflection);
      mergedSessions.filter(r => r.id).forEach(queueStage);

      message(
        "Backup merged. Your existing records were retained."
      );

      render();

    } catch (err) {
      message(err.message);
    }

    e.target.value = "";
  };

  // --------------------------------------------------
  // INITIALIZE WITHOUT ERASING OLD DATA
  // --------------------------------------------------

  function init() {
    classes();
    sessions();
    reflections();

    if (!localStorage.getItem(K.backup)) {
      try {
        write(K.backup, backupData());
      } catch (e) {
        message(
          "Automatic backup could not be made. " +
          "Use Backup → Export before continuing."
        );
      }
    }

    deviceId();

    // Do not generate a backlog of pre-upgrade reflections.
    if (!localStorage.getItem(K.start)) {
      rawWrite(K.start, C.weekStart(today()));
    }

    active = read(K.active, null);

    if (active) {
      if (active.runningSince !== null) {
        active.ms += Math.max(
          0,
          (active.lastSeen || active.runningSince) -
          active.runningSince
        );

        active.runningSince = null;
      }

      chosenClass = {
        name: active.className,
        subject: active.subject
      };

      chosenStage = active.stage;
      visitId = active.visitId;

      saveActive();

      message(
        "Restored your unfinished stage, paused at the last saved checkpoint."
      );
    }

    render();

    // Recover new-format uploads after an interrupted local save.
    sessions().filter(r => r.id).forEach(queueStage);
    Object.values(reflections()).forEach(queueReflection);
    syncQueue();
  }

  // --------------------------------------------------
  // BUTTON ACTIONS
  // --------------------------------------------------

  document.addEventListener("click", safe(e => {
    const b = e.target.closest("button");
    if (!b) return;

    if (b.dataset.nav) {
      launchAnki = false;

      if (b.dataset.nav === "home") {
        reminderDismissed = false;
        chosenClass = null;
      }

      navigate(b.dataset.nav);
      return;
    }

    if (b.dataset.class !== undefined) {
      chosenClass = classes()[Number(b.dataset.class)];
      visitId = uid();
      chosenStage = launchAnki ? 3 : null;

      if (launchAnki) {
        launchAnki = false;
        openTimer("Anki");
      } else {
        screen = "stage";
        render();
      }

      return;
    }

    if (b.dataset.stage) {
      chosenStage = Number(b.dataset.stage);
      render();
      return;
    }

    if (b.dataset.method !== undefined) {
      openTimer(
        stages[chosenStage].methods[
          Number(b.dataset.method)
        ]
      );

      return;
    }

    if (b.dataset.remove !== undefined) {
      const list = classes();
      list.splice(Number(b.dataset.remove), 1);
      write(K.classes, list);
      render();
      return;
    }

    if (b.dataset.period) {
      periodKind = b.dataset.period;

      periodKey = periodKind === "week"
        ? C.weekStart(today())
        : C.monthStart(today());

      render();
      return;
    }

    if (b.dataset.reflectionClass) {
      openReflection({
        className: b.dataset.reflectionClass,
        weekStart: b.dataset.week
      });

      return;
    }

    if (b.dataset.coachClass) {
      chosenClass = classes().find(c =>
        c.name === b.dataset.coachClass
      ) || {
        name: b.dataset.coachClass,
        subject: ""
      };

      visitId = uid();
      chosenStage = Number(b.dataset.coachStage);
      screen = "stage";
      render();
      return;
    }

    switch (b.dataset.action) {
      case "add-class": {
        const subject = $("subject").value;
        const course = $("course").value;

        const name = course.startsWith("Other")
          ? $("custom").value.trim()
          : course;

        if (!subject || !name) {
          message("Choose a subject and class.");
          return;
        }

        const list = classes();

        if (!list.some(c =>
          c.name.toLowerCase() === name.toLowerCase()
        )) {
          list.push({name, subject});
        }

        write(K.classes, list);
        message("Class saved.");
        render();
        break;
      }

      case "anki":
        launchAnki = true;
        reminderDismissed = true;

        message(
          "Choose a class. Anki opens under Stage 3 — Assess."
        );

        break;

      case "hide-anki":
        rawWrite(K.ankiHide + today(), "1");
        render();
        break;

      case "toggle-timer":
        if (active.runningSince !== null) {
          pause();
        } else {
          active.runningSince = Date.now();

          if (!active.startedAt) {
            active.startedAt = new Date().toISOString();
          }

          saveActive();
        }

        render();
        break;

      case "finish-timer":
        finishTimer();
        break;

      case "skip-crosscheck":
        finishTimer(true);
        break;

      case "cancel-timer":
        if (confirm(
          "Cancel this unfinished stage? " +
          "It will not be added to your completed stages."
        )) {
          active = null;
          saveActive();
          screen = "stage";
          render();
        }

        break;

      case "next-stage":
        chosenClass = {
          name: completed.className,
          subject: completed.subject
        };

        visitId = completed.visitId;

        chosenStage = completed.stage === 1
          ? 2
          : completed.stage === 2
            ? 3
            : null;

        screen = "stage";
        render();
        break;

      case "finish-visit":
        visitId = null;
        completed = null;
        reminderDismissed = false;
        screen = "home";
        render();
        break;

      case "reflect":
        openReflection();
        break;

      case "weekly-share":
        shareWeek();
        break;

      case "export":
        exportBackup();
        break;

      case "import":
        $("backupInput").click();
        break;
    }
  }));

  $("syncNow").onclick = () => syncQueue(true);

  window.addEventListener("online", () => {
    syncQueue(true);
  });

  document.addEventListener("visibilitychange", safe(() => {
    if (document.visibilityState === "hidden") {
      if (active) saveActive();
    } else {
      reminderDismissed = false;

      if (screen === "home") render();

      syncQueue();
    }
  }));

  window.addEventListener("pagehide", safe(() => {
    if (active) saveActive();
  }));

  setInterval(safe(() => {
    if (active) {
      if ($("clock")) {
        $("clock").textContent = time(elapsed() / 1000);
      }

      if (Date.now() - lastCheckpoint > 5000) {
        saveActive();
        lastCheckpoint = Date.now();
      }
    }

    if (lastDay !== today()) {
      lastDay = today();
      reminderDismissed = false;

      if (!active && !dialog.open) render();
    }
  }), 1000);

  setInterval(() => syncQueue(), 15000);

  window.addEventListener("storage", safe(e => {
    if (
      [K.classes, K.sessions, K.reflections].includes(e.key) &&
      !active &&
      !dialog.open
    ) {
      render();
    }
  }));

  try {
    init();
  } catch (err) {
    root.innerHTML =
      '<section class="card"><h2>Your saved data needs attention</h2><p>' +
      esc(err.message) +
      '</p><button class="primary" data-action="export">' +
      "Export a recovery backup</button></section>";

    message("Nothing has been erased.");
  }
})();
