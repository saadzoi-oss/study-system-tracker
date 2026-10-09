/*
 * Complete student app.
 * Version: student-learning-first-20261009-3
 *
 * Learning feedback does not require an assessment rating.
 * Existing storage keys, timers and submission workflow are retained.
 */

const CoachRules = (() => {
  const version = "student-learning-first-20261009-3";

  const methods = {
    1: [
      "Study / Review", "Textbook", "Video", "Concept Map",
      "Worked Examples", "AI Tutor", "Unit Coach"
    ],
    2: [
      "Teach", "Redo Notes from Memory",
      "Concept Map from Memory", "AI — Teach & Check"
    ],
    3: [
      "Homework as Test", "Practice Test", "Practice Problems",
      "Anki", "AI Practice Test", "AI Game"
    ]
  };

  const n = v =>
    v !== null &&
    v !== "" &&
    v !== undefined &&
    !(v instanceof Date) &&
    typeof v !== "boolean" &&
    Number.isFinite(Number(v)) &&
    Number(v) >= 0
      ? Number(v)
      : null;

  const z = v => n(v) ?? 0;

  const rate = v =>
    [1, 2, 3, 4, 5].includes(n(v))
      ? Number(v)
      : null;

  const assessment = r =>
    r && r.hadAssessment === true
      ? rate(r.assessmentRating)
      : null;

  // A 3 is a middle response, not automatically a difficulty.
  const concerns = r => !!r && (
    (rate(r.learningRating) !== null && rate(r.learningRating) <= 2) ||
    (assessment(r) !== null && assessment(r) <= 2)
  );

  const strong = r =>
    !!r &&
    rate(r.learningRating) >= 4 &&
    (r.hadAssessment === false || assessment(r) >= 4);

  const stage = (s, k) =>
    s?.stages?.[k] || {
      count: 0,
      seconds: 0,
      methods: {}
    };

  const entries = t =>
    t.methods instanceof Map
      ? [...t.methods.entries()]
      : Object.entries(t.methods || {});

  function enough(s) {
    const positive =
      n(s?.positive) ??
      n(s?.behaviorEvidence?.positiveStages);

    return !!s &&
      [1, 2, 3].reduce(
        (a, k) => a + z(stage(s, k).count), 0
      ) >= 2 &&
      [1, 2, 3].reduce(
        (a, k) => a + z(stage(s, k).seconds), 0
      ) > 0 &&
      (positive === null || positive >= 2);
  }

  function issues(s, r) {
    if (!enough(s) || strong(r)) return [];

    const a = [
      null,
      stage(s, 1),
      stage(s, 2),
      stage(s, 3)
    ];

    const total = a.slice(1).reduce(
      (v, t) => v + z(t.seconds), 0
    );

    const concern = concerns(r);
    const result = [];

    function add(
      code, label, observed, text,
      focus, targetStage, targetMethod, rank
    ) {
      result.push({
        code,
        title: label,
        label,
        observed,
        text,
        action: text,
        focus,
        targetStage,
        targetMethod,
        rank,
        concern,
        hasRating: !!r
      });
    }

    if (
      z(a[1].count) + z(a[3].count) > 0 &&
      (
        z(a[2].count) === 0 ||
        (concern && z(a[2].seconds) / total < .15)
      )
    ) {
      add(
        "CONNECT_RETRIEVAL_ASSESS",
        "Connect review with a memory check",
        "Learn or Assess recorded with little or no separate Retrieval.",
        "Try teaching or reconstructing from memory, Crosscheck, then a short Practice Test, problems, or Anki assessment in one visit.",
        "cycle", 2, "Teach", 10
      );
    }

    const cross =
      n(s?.crossCount) ??
      n(s?.checked);

    if (
      z(a[2].count) >= 2 &&
      cross !== null &&
      cross / z(a[2].count) < .8
    ) {
      add(
        "LOG_CROSSCHECK",
        "Check what you recalled",
        "Some Retrieval stages have no Crosscheck time.",
        "After Retrieval, compare your work with a reliable source. Correct one gap before moving on. Checking may also have happened without being logged.",
        "crosscheck", 2, "Teach", 20
      );
    }

    if (
      r &&
      rate(r.learningRating) >= 4 &&
      assessment(r) !== null &&
      assessment(r) <= 2
    ) {
      add(
        "CHECK_CONFIDENCE",
        "Check how your explanation transfers to questions",
        "Learning feels clear, but the assessment rating is low.",
        "Keep Retrieval and Crosscheck. Try a Practice Test or Practice Problems matching the questions you found difficult, without hints.",
        "testCycle", 3, "Practice Test", 30
      );
    }

    const anki = entries(a[3])
      .find(x => /^anki$/i.test(x[0]))?.[1];

    if (
      assessment(r) !== null &&
      assessment(r) <= 2 &&
      z(a[3].count) >= 3 &&
      anki &&
      z(anki.count) / z(a[3].count) >= .65
    ) {
      add(
        "MATCH_ASSESSMENT_TASK",
        "Add practice that matches your assessment",
        "Most Assess uses are Anki, alongside a low assessment rating.",
        "Keep Anki for recall. After Retrieval and Crosscheck, add a Practice Test or problems resembling your actual assessment.",
        "testCycle", 3, "Practice Test", 40
      );
    }

    if (
      z(a[2].count) > 0 &&
      z(a[3].count) === 0
    ) {
      add(
        "PAIR_RETRIEVAL_ASSESS",
        "Try a short independent practice check",
        "Retrieval is recorded, but no Assess practice is logged.",
        "After Retrieval and Crosscheck, try a short independent practice test, problem set, or Anki assessment. An actual school test is not needed to do this practice.",
        "cycle", 3, "Practice Test", 50
      );
    }

    if (
      concern &&
      z(a[1].seconds) / total >= .5
    ) {
      add(
        "TARGETED_RELEARN",
        "Work through one example, then explain it",
        "Much of the logged time is Learn, and you reported difficulty.",
        "Work through one difficult Worked Example, then close your notes and explain it from memory. Crosscheck the step that was confusing.",
        "exampleRecall", 1, "Worked Examples", 60
      );
    }

    if (concern && !result.length) {
      add(
        "TARGETED_RELEARN",
        "Make the next visit more focused",
        "Several stages are recorded, but an outcome still feels difficult.",
        "Choose one missed question as a Worked Example. Work through it, close your notes, explain it from memory, and Crosscheck. Ask for help with the confusing step when needed.",
        "exampleRecall", 1, "Worked Examples", 70
      );
    }

    return result.sort((a, b) => a.rank - b.rank);
  }

  function recommend(s, r = null) {
    const base = {
      version,
      caution: "Based on your ratings and recorded activity."
    };

    const issue = issues(s, r)[0];

    if (issue) {
      return Object.assign(base, issue);
    }

    if (strong(r)) {
      const text = r.hadAssessment === false
        ? "Keep the study methods you find useful and check again next week. Your learning rating is strong; assessment results can be reviewed when you have one."
        : "Keep the methods you find useful. You do not need to change just to make your stage percentages even.";

      return Object.assign(base, {
        code: "KEEP_WORKING_APPROACH",
        focus: "maintain",
        title: "Keep the useful parts",
        text,
        action: text,
        targetStage: 2,
        targetMethod: "Teach"
      });
    }

    const neutral =
      r &&
      rate(r.learningRating) === 3 &&
      (
        assessment(r) === null ||
        assessment(r) === 3 ||
        assessment(r) >= 4
      );

    if (neutral && enough(s)) {
      const text =
        "Keep the useful parts of your routine for another week. Pick one idea that still feels uncertain and use a brief memory check to decide what needs review.";

      return Object.assign(base, {
        code: "KEEP_TESTING_APPROACH",
        focus: "maintain",
        title: "Keep testing your approach",
        text,
        action: text,
        targetStage: 2,
        targetMethod: "Teach"
      });
    }

    const text =
      "Try one short Retrieval from memory, Crosscheck what you missed, then choose a brief Assess practice. Use your next learning rating to decide what to keep.";

    return Object.assign(base, {
      code: "TRY_COMBINATION",
      focus: "cycle",
      title: "Choose one useful next step",
      text,
      action: text,
      targetStage: 2,
      targetMethod: "Teach"
    });
  }

  return {
    version, methods, n, z, rate, assessment,
    concerns, strong, stage, entries, enough,
    issues, recommend
  };
})();


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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key))) {
      return false;
    }

    const d = new Date(key + "T12:00:00Z");

    return !isNaN(d) &&
      d.toISOString().slice(0, 10) === key;
  }

  function addDays(key, n) {
    const d = new Date(key + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function weekStart(key) {
    const day = new Date(
      key + "T12:00:00Z"
    ).getUTCDay();

    return addDays(key, -((day + 6) % 7));
  }

  function monthStart(key) {
    return key.slice(0, 7) + "-01";
  }

  function nextMonth(key) {
    const d = new Date(
      monthStart(key) + "T12:00:00Z"
    );

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
    if (validDate(row.localDate)) {
      return row.localDate;
    }

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
      positive: 0,
      seconds: 0,
      crossSeconds: 0,
      days: [],
      devices: [],
      stages: {
        1: {
          count: 0,
          seconds: 0,
          methods: Object.create(null)
        },
        2: {
          count: 0,
          seconds: 0,
          methods: Object.create(null)
        },
        3: {
          count: 0,
          seconds: 0,
          methods: Object.create(null)
        }
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
      if (secs > 0) s.positive++;

      s.seconds += secs + cross;
      s.crossSeconds += cross;
      days.add(localDay(r));

      if (r.deviceId) {
        devices.add(r.deviceId);
      }

      s.stages[stage].count++;
      s.stages[stage].seconds += secs;

      const methods = s.stages[stage].methods;

      if (!methods[method]) {
        methods[method] = {
          count: 0,
          seconds: 0
        };
      }

      methods[method].count++;
      methods[method].seconds += secs;

      s.classes[name] =
        (s.classes[name] || 0) + secs + cross;

      s.methods[method] =
        (s.methods[method] || 0) + 1;

      if (stage === 2 && cross > 0) {
        s.crossCount++;
      }

      if (
        stage === 3 &&
        r.visitId &&
        Number.isFinite(Date.parse(r.startedAt))
      ) {
        s.linkedAssess++;

        const cutoff = Date.parse(r.startedAt);

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

  function pending(
    rows, reflections, startWeek, today
  ) {
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
    return CoachRules.recommend(s, outcome);
  }

  return {
    dateKey, validDate, addDays, weekStart,
    monthStart, nextMonth, daysBetween, key,
    number, localDay, stageName, summarize,
    forClassWeek, pending, recommend
  };
})();


/*
 * Weekly keep-or-adjust evaluation.
 * Outcome guidance and attribution to an earlier suggestion
 * are deliberately handled separately.
 */

const StudyFollowup = (() => {
  const C = StudyCoach;
  const VERSION = CoachRules.version;

  const decisionLabels = {
    keep: "Keep this approach",
    test: "Keep testing this adjustment",
    change: "Change one thing",
    try: "Keep testing this adjustment",
    unknown: "Not enough information yet"
  };

  const validTime = v =>
    typeof v === "string" &&
    Number.isFinite(Date.parse(v));

  const known = v =>
    v !== null &&
    v !== undefined &&
    v !== "" &&
    Number.isFinite(Number(v)) &&
    Number(v) >= 0;

  const rating = v =>
    [1, 2, 3, 4, 5].includes(Number(v))
      ? Number(v)
      : null;

  const assessment = r =>
    r && r.hadAssessment === true
      ? rating(r.assessmentRating)
      : null;

  const positive = r =>
    [1, 2, 3].includes(Number(r.stage)) &&
    C.number(r.studySeconds) > 0;

  const tests = [
    "Practice Test",
    "AI Practice Test",
    "Practice Problems",
    "Homework as Test"
  ];

  const sameVisit = (a, b) =>
    !!a.visitId &&
    a.visitId === b.visitId &&
    a.className === b.className &&
    (a.deviceId || "") === (b.deviceId || "");

  function evidence(rows) {
    const all = rows.filter(r =>
      [1, 2, 3].includes(Number(r.stage))
    );

    const valid = all.filter(positive);

    const retrieve = valid.filter(r =>
      Number(r.stage) === 2
    );

    const assess = valid.filter(r =>
      Number(r.stage) === 3
    );

    const examples = valid.filter(r =>
      Number(r.stage) === 1 &&
      r.method === "Worked Examples"
    );

    const e = {
      version: VERSION,
      positiveStages: valid.length,
      retrieval: retrieve.length,
      crosschecked: 0,
      assess: assess.length,

      tests: assess.filter(r =>
        tests.includes(r.method)
      ).length,

      assessKnown: 0,
      linkedAssess: 0,
      paired: 0,
      cycles: 0,
      testCycles: 0,
      sequenceUnknown: 0,
      exampleRecall: 0,
      startedAt: "",

      completeVisitIds:
        all.length > 0 &&
        all.every(r => !!r.visitId),

      completeStartTimes:
        all.length > 0 &&
        all.every(r =>
          validTime(r.startedAt) &&
          validTime(r.timestamp) &&
          Date.parse(r.startedAt) <=
            Date.parse(r.timestamp)
        )
    };

    if (e.completeStartTimes) {
      e.startedAt = all
        .map(r => r.startedAt)
        .sort((a, b) =>
          Date.parse(a) - Date.parse(b)
        )[0];
    }

    retrieve.forEach(r => {
      if (C.number(r.crosscheckSeconds) > 0) {
        e.crosschecked++;
      }

      if (
        validTime(r.startedAt) &&
        examples.some(x =>
          sameVisit(x, r) &&
          validTime(x.timestamp) &&
          Date.parse(x.timestamp) <=
            Date.parse(r.startedAt)
        )
      ) {
        e.exampleRecall++;
      }
    });

    assess.forEach(a => {
      if (
        !a.visitId ||
        !validTime(a.startedAt)
      ) {
        e.sequenceUnknown++;
        return;
      }

      e.linkedAssess++;

      const cutoff = Date.parse(a.startedAt);

      const candidates = retrieve.filter(r =>
        sameVisit(r, a) &&
        validTime(r.timestamp) &&
        Date.parse(r.timestamp) <= cutoff
      );

      const checked = candidates.filter(r =>
        C.number(r.crosscheckSeconds) > 0
      );

      const complete = checked.some(r =>
        validTime(r.crosscheckFinishedAt) &&
        Date.parse(r.crosscheckFinishedAt) >=
          Date.parse(r.timestamp) &&
        Date.parse(r.crosscheckFinishedAt) <= cutoff
      );

      if (candidates.length) {
        e.paired++;
      }

      if (complete) {
        e.cycles++;

        if (tests.includes(a.method)) {
          e.testCycles++;
        }
      }

      if (
        !complete &&
        checked.some(r =>
          !validTime(r.crosscheckFinishedAt)
        )
      ) {
        e.sequenceUnknown++;
      } else {
        e.assessKnown++;
      }
    });

    return e;
  }

  function focusFor(rec) {
    if (rec && rec.focus) return rec.focus;

    const code = rec ? rec.code : "";

    if ([
      "CONNECT_RETRIEVAL_ASSESS",
      "RETRIEVE_BEFORE_ASSESS",
      "PAIR_RETRIEVAL_ASSESS",
      "TRY_COMBINATION",
      "SMALL_SAMPLE",
      "GAP_CYCLE"
    ].includes(code)) {
      return "cycle";
    }

    if ([
      "NO_DATA",
      "RETRIEVE_AFTER_LEARN",
      "LOW_CONFIDENCE_STRONG_RESULT",
      "FOCUSED_RECALL"
    ].includes(code)) {
      return "recallCheck";
    }

    if (code === "LOG_CROSSCHECK") {
      return "crosscheck";
    }

    if ([
      "MATCH_ASSESSMENT_TASK",
      "CHECK_CONFIDENCE"
    ].includes(code)) {
      return "testCycle";
    }

    if (code === "TARGETED_RELEARN") {
      return "exampleRecall";
    }

    if ([
      "KEEP_WORKING_APPROACH",
      "KEEP_TESTING_APPROACH"
    ].includes(code)) {
      return "maintain";
    }

    return "unobservable";
  }

  function normalize(rec) {
    const r = Object.assign({}, rec || {});

    r.focus = focusFor(rec);

    const actions = {
      cycle:
        "In one visit: explain the topic from memory (Retrieval), check it " +
        "against your notes (Crosscheck), then take a short practice test or Anki (Assess).",

      recallCheck:
        "Close your notes and explain what you remember. Then Crosscheck and " +
        "review only what you missed.",

      crosscheck:
        "After Retrieval, check your work against your notes or another " +
        "reliable source before moving on.",

      testCycle:
        "Keep Retrieval and Crosscheck. For Assess, use a Practice Test or " +
        "Practice Problems that look like your real test.",

      exampleRecall:
        "Work through one hard Worked Example, then close your notes and " +
        "explain it from memory.",

      maintain:
        "Keep the methods that are working and check again next week."
    };

    r.action =
      r.action ||
      r.text ||
      actions[r.focus] ||
      "Choose one short memory check and review the result next week.";

    r.version = VERSION;
    r.caution = "Based on your ratings and recorded activity.";

    return r;
  }

  function stageCount(snapshot, stage) {
    const v =
      snapshot &&
      snapshot.stages &&
      snapshot.stages[stage];

    return v && known(v.count)
      ? Number(v.count)
      : null;
  }

  function metric(snapshot, focus) {
    const e =
      snapshot &&
      snapshot.behaviorEvidence;

    const retrieve = e
      ? e.retrieval
      : stageCount(snapshot, 2);

    const crossed = e
      ? e.crosschecked
      : snapshot && known(snapshot.crossCount)
        ? Number(snapshot.crossCount)
        : null;

    const pair = e
      ? e.paired
      : snapshot && known(snapshot.pairedAssess)
        ? Number(snapshot.pairedAssess)
        : null;

    const lines = [];

    const line = (label, n, d) => {
      lines.push({
        label,

        value: n === null || n === undefined
          ? "Not recorded"
          : d === null || d === undefined
            ? String(n)
            : n + " of " + d
      });
    };

    let n = null;
    let unknown = false;

    if (
      focus === "cycle" ||
      focus === "testCycle"
    ) {
      line(
        "Assess after Retrieval (same visit)",
        pair,

        e
          ? e.linkedAssess
          : snapshot && known(snapshot.linkedAssess)
            ? Number(snapshot.linkedAssess)
            : null
      );

      line(
        "Retrieval with Crosscheck time",
        crossed,
        retrieve
      );

      n = e
        ? (
            focus === "testCycle"
              ? e.testCycles
              : e.cycles
          )
        : null;

      line(
        focus === "testCycle"
          ? "Confirmed cycles ending with test/problem practice"
          : "Confirmed Retrieval → Crosscheck → Assess cycles",
        n,
        null
      );

      unknown =
        !e ||
        !known(n) ||
        (
          Number(n) === 0 &&
          e.sequenceUnknown > 0
        );

    } else if (
      focus === "recallCheck" ||
      focus === "crosscheck"
    ) {
      n = crossed;

      line(
        "Retrieval with Crosscheck time",
        crossed,
        retrieve
      );

      unknown = !known(crossed);

    } else if (focus === "exampleRecall") {
      n = e ? e.exampleRecall : null;

      line(
        "Worked Examples followed by Retrieval (same visit)",
        n,
        null
      );

      unknown =
        !e ||
        !known(n) ||
        (
          Number(n) === 0 &&
          (
            !e.completeStartTimes ||
            !e.completeVisitIds
          )
        );

    } else if (focus === "maintain") {
      n = e
        ? e.positiveStages
        : snapshot && known(snapshot.count)
          ? Number(snapshot.count)
          : null;

      line(
        "Completed study stages",
        n,
        null
      );

      unknown = !known(n);

    } else {
      line(
        "Topic-specific change",
        null,
        null
      );

      unknown = true;
    }

    return {
      lines,
      n: known(n) ? Number(n) : null,
      unknown,
      visible: known(n) && Number(n) > 0
    };
  }

  function historyId(r) {
    return r.revisionId ||
      JSON.stringify([
        r.className,
        r.weekStart,
        r.timestamp
      ]);
  }

  function usable(r, current) {
    return !!r &&
      r.className === current.className &&
      C.validDate(r.weekStart) &&
      C.weekStart(r.weekStart) === r.weekStart &&
      r.weekStart < current.weekStart &&
      validTime(r.timestamp) &&
      (
        !validTime(current.timestamp) ||
        Date.parse(r.timestamp) <=
          Date.parse(current.timestamp)
      ) &&
      (
        !r.ownerDeviceId ||
        !current.ownerDeviceId ||
        r.ownerDeviceId === current.ownerDeviceId
      ) &&
      rating(r.learningRating) !== null &&
      typeof r.hadAssessment === "boolean" &&
      (
        !r.hadAssessment ||
        assessment(r) !== null
      );
  }

  function moved(label, a, b) {
    if (a === null || b === null) return "";

    if (b > a) {
      return label + " went up (" + a + " → " + b + ")";
    }

    if (b < a) {
      return label + " went down (" + a + " → " + b + ")";
    }

    return label + " stayed at " + b + "/5";
  }

  function compare(before, after) {
    const l1 = rating(before.learningRating);
    const l2 = rating(after.learningRating);
    const a1 = assessment(before);
    const a2 = assessment(after);

    const dl = l1 !== null && l2 !== null
      ? l2 - l1
      : null;

    const da = a1 !== null && a2 !== null
      ? a2 - a1
      : null;

    const learningText = moved(
      "Your learning rating",
      l1,
      l2
    );

    const assessmentText = da !== null
      ? moved("Your assessment rating", a1, a2)

      : a2 !== null
        ? "Your assessment rating is " + a2 +
          "/5; there is no assessment rating from the previous week to compare"

        : a1 !== null
          ? "No assessment this week; your previous assessment rating was " +
            a1 + "/5"

          : "No assessments were rated in these two weeks";

    return {
      dl, da, l1, l2, a1, a2,
      comparable: dl !== null,
      assessmentComparable: da !== null,

      improved:
        dl !== null &&
        dl >= 0 &&
        (da === null || da >= 0) &&
        (dl > 0 || (da !== null && da > 0)),

      fell:
        (dl !== null && dl < 0) ||
        (da !== null && da < 0),

      bothStrong: [l1, l2, a1, a2].every(v =>
        v !== null && v >= 4
      ),

      stayedLow:
        (
          l1 !== null &&
          l2 !== null &&
          l1 <= 2 &&
          l2 <= 2 &&
          dl <= 0
        ) ||
        (
          a1 !== null &&
          a2 !== null &&
          a1 <= 2 &&
          a2 <= 2 &&
          da <= 0
        ),

      learningText,
      assessmentText,

      text: [
        learningText,
        assessmentText
      ].filter(Boolean).join(". ") + "."
    };
  }

  function changePlanFor(focus, outcome = null) {
    const learningLow =
      outcome &&
      rating(outcome.learningRating) !== null &&
      rating(outcome.learningRating) <= 2;

    const testLow =
      assessment(outcome) !== null &&
      assessment(outcome) <= 2;

    if (
      learningLow &&
      (
        !testLow ||
        !["cycle", "testCycle"].includes(focus)
      )
    ) {
      if (focus === "exampleRecall") {
        return normalize({
          code: "FOCUSED_RECALL",
          focus: "recallCheck",
          title: "Check the one step that remains confusing",

          text:
            "Take one unresolved question to your teacher or tutor. Then teach the corrected explanation from memory and Crosscheck it. Keep the rest of your routine.",

          targetStage: 2,
          targetMethod: "Teach"
        });
      }

      return normalize({
        code: "TARGETED_RELEARN",
        focus: "exampleRecall",
        title: "Try one worked example, then explain it",

        text:
          "Work through one difficult Worked Example. Close your notes, explain each step from memory, and Crosscheck the explanation before trying a new question.",

        targetStage: 1,
        targetMethod: "Worked Examples"
      });
    }

    if (testLow && focus !== "testCycle") {
      return normalize({
        code: "MATCH_ASSESSMENT_TASK",
        focus: "testCycle",
        title: "Change the practice questions, not the whole routine",

        text:
          "Keep Retrieval and Crosscheck. For Assess, try a Practice Test or Practice Problems that match the kind of question you found difficult. Anki can stay part of your practice.",

        targetStage: 3,
        targetMethod: "Practice Test"
      });
    }

    if (focus === "testCycle") {
      return normalize({
        code: "TARGETED_RELEARN",
        focus: "exampleRecall",
        title: "Repair one missed example before another test",

        text:
          "Pick one question you missed. Work through it as a Worked Example, then close your notes and explain it from memory before reassessing.",

        targetStage: 1,
        targetMethod: "Worked Examples"
      });
    }

    return normalize({
      code: "FOCUSED_RECALL",
      focus: "recallCheck",
      title: "Make the next recall check more focused",

      text:
        "Choose one idea that still feels uncertain. Explain it without notes, Crosscheck it, and get help with that specific gap rather than adding more general review.",

      targetStage: 2,
      targetMethod: "Teach"
    });
  }

  function selectPrevious(current, history) {
    const e =
      current.snapshot &&
      current.snapshot.behaviorEvidence;

    const candidates = history
      .filter(r =>
        usable(r, current) &&
        r.weekStart === C.addDays(current.weekStart, -7)
      )
      .sort((a, b) =>
        Date.parse(a.timestamp) -
        Date.parse(b.timestamp)
      );

    if (!candidates.length) {
      return {
        record: null,
        timing: "missing"
      };
    }

    if (
      !e ||
      e.completeStartTimes !== true ||
      !validTime(e.startedAt)
    ) {
      return {
        record: candidates[candidates.length - 1],
        timing: "unknown"
      };
    }

    const early = candidates.filter(r =>
      Date.parse(r.timestamp) <=
        Date.parse(e.startedAt)
    );

    return early.length
      ? {
          record: early[early.length - 1],
          timing: "before"
        }
      : {
          record: candidates[0],
          timing: "late"
        };
  }

  function latestPrevious(current, history) {
    return history
      .filter(r =>
        usable(r, current) &&
        r.weekStart === C.addDays(current.weekStart, -7)
      )
      .sort((a, b) =>
        Date.parse(b.timestamp) -
        Date.parse(a.timestamp)
      )[0] || null;
  }

  function planKey(rec) {
    if (!rec) return "";

    const r = normalize(rec);

    return JSON.stringify([
      r.code,
      r.focus,
      r.targetStage || "",
      r.targetMethod || ""
    ]);
  }

  function evaluate(current, history) {
    const initial = normalize(
      C.recommend(current.snapshot, current)
    );

    const selected = selectPrevious(current, history);
    const previous = latestPrevious(current, history);
    const delivered = selected.record;

    const oldPlan =
      delivered && delivered.recommendation
        ? normalize(delivered.recommendation)
        : null;

    const focus = oldPlan
      ? oldPlan.focus
      : initial.focus;

    const before = metric(
      previous && previous.snapshot,
      focus
    );

    const after = metric(
      current.snapshot,
      focus
    );

    const fairTrial =
      !!oldPlan &&
      focus !== "unobservable" &&
      selected.timing === "before" &&
      !after.unknown &&
      after.visible &&
      CoachRules.enough(current.snapshot);

    const trialNote = !oldPlan
      ? "There is no earlier suggestion to check."

      : selected.timing === "late"
        ? "The earlier suggestion was saved after studying had started, so it is not credited for these results."

        : selected.timing !== "before"
          ? "Start times are missing, so we cannot tell whether the earlier suggestion came before the studying."

          : focus === "unobservable" || after.unknown
            ? "The log cannot verify the earlier suggestion. We can still choose a useful next step from your ratings."

            : !after.visible
              ? "The suggested step is not visible in the log yet; that does not mean a tried step failed."

              : "The suggested activity is recorded after the advice. This shows it was logged, not how well it was done.";

    const out = {
      version: VERSION,
      timing: selected.timing,
      priorWeek: previous ? previous.weekStart : "",
      currentWeek: current.weekStart,

      previousRevision: delivered
        ? historyId(delivered)
        : "",

      previousOutcomeRevision: previous
        ? historyId(previous)
        : "",

      previousSuggestion: oldPlan ? oldPlan.text : "",
      previousTitle: oldPlan ? oldPlan.title : "",

      target: focus,
      behaviorVisible: after.visible,
      fairTrial,
      trialNote,
      evaluatedAt: current.timestamp,

      rows: after.lines.map((r, i) => ({
        label: r.label,
        before: before.lines[i]?.value || "Not recorded",
        after: r.value
      })).concat([
        {
          label: "Your learning rating",

          before: previous
            ? previous.learningRating + "/5"
            : "Not recorded",

          after: current.learningRating + "/5"
        },
        {
          label: "Your assessment rating",

          before: previous
            ? assessment(previous) === null
              ? "No assessment"
              : assessment(previous) + "/5"
            : "Not recorded",

          after: assessment(current) === null
            ? "No assessment"
            : assessment(current) + "/5"
        }
      ])
    };

    const finish = (
      decision, title, reason, next = initial
    ) => {
      const advice = normalize(next);
      advice.text = advice.action;

      return Object.assign(out, {
        decision,
        label: decisionLabels[decision],
        title,
        reason,
        next: advice
      });
    };

    if (rating(current.learningRating) === null) {
      return finish(
        "unknown",
        "Add your learning rating",
        "A learning rating will help you choose a useful next step. An assessment rating is optional when no assessment took place."
      );
    }

    if (!previous) {
      return finish(
        "test",
        "Use this week as your starting point",

        "Your learning rating is " +
        current.learningRating + "/5. " +

        (
          assessment(current) === null
            ? "No assessment is rated, and that does not stop you choosing a study step. "
            : "Your assessment rating is " +
              assessment(current) + "/5. "
        ) +

        "Try one useful step and compare your next check-in."
      );
    }

    const c = compare(previous, current);
    const detail = c.text + " ";

    const learningPersisted =
      c.l1 <= 2 &&
      c.l2 <= 2 &&
      c.dl <= 0;

    const testPersisted =
      c.da !== null &&
      c.a1 <= 2 &&
      c.a2 <= 2 &&
      c.da <= 0;

    const changedLow =
      learningPersisted ||
      testPersisted;

    if (changedLow) {
      const domain = learningPersisted
        ? "Learning"
        : "Assessment";

      const rationale = fairTrial
        ? "The earlier step appears in your log, but " +
          domain.toLowerCase() +
          " still feels difficult. Change one part for the next visit."

        : domain +
          " has felt difficult in both rated weeks. We cannot judge whether the earlier suggestion helped; this is a new, focused experiment.";

      return finish(
        "change",
        "Change one part of the next visit",
        detail + rationale,
        changePlanFor(focus, current)
      );
    }

    if (c.fell) {
      return finish(
        "test",
        "Check the part that became harder",

        detail +
        "One change does not mean you should rebuild your whole routine. Keep useful parts and check the specific task that felt harder.",

        CoachRules.concerns(current)
          ? initial
          : oldPlan || initial
      );
    }

    const learningStrong =
      c.l1 >= 4 &&
      c.l2 >= 4;

    const assessmentNotLow =
      c.a2 === null ||
      c.a2 >= 3;

    if (learningStrong && assessmentNotLow) {
      const testsStrong =
        c.a2 !== null &&
        c.a2 >= 4;

      return finish(
        "keep",

        testsStrong
          ? "Your reported results are strong"
          : "Keep the approach you find useful",

        detail +

        (
          c.a2 === null
            ? "Your learning ratings remain strong. Keep the useful methods; assessment results can be reviewed when you have one."
            : "Keep the useful methods. You do not need to change just to make the percentages even."
        ),

        normalize(
          C.recommend(current.snapshot, current)
        )
      );
    }

    if (c.improved) {
      const learningOnly = c.da === null;

      const mayKeep =
        c.l2 >= 4 &&
        (c.a2 === null || c.a2 >= 3);

      return finish(
        mayKeep ? "keep" : "test",
        "Your ratings are moving in a useful direction",

        detail +

        (
          learningOnly
            ? "Keep trying the useful parts. This is progress in your reported learning; assessment results remain separate."

            : fairTrial
              ? "The suggested step is also recorded. Keep trying it and check the next outcome."

              : "Keep trying the useful parts. These ratings do not tell us whether the earlier suggestion was used."
        ),

        oldPlan && oldPlan.focus !== "unobservable"
          ? oldPlan
          : initial
      );
    }

    if (
      c.l2 === 3 &&
      (c.a2 === null || c.a2 >= 3)
    ) {
      return finish(
        "test",
        "Keep testing your approach",

        detail +
        "A 3/5 is a middle response, not a failure. Keep what helps and check one idea that still feels uncertain.",

        initial
      );
    }

    return finish(
      "test",
      "Give one adjustment another useful try",

      detail +

      (
        after.unknown
          ? "The log cannot check the earlier suggestion, but that does not block your next step. Choose a small, visible activity below."

          : oldPlan && !after.visible
            ? "The earlier step is not visible yet. Try it before deciding whether it helps."

            : "Keep one useful step and review the next learning rating."
      ),

      oldPlan && oldPlan.focus !== "unobservable"
        ? oldPlan
        : initial
    );
  }

  return {
    VERSION,
    evidence,
    metric,
    evaluate,
    historyId,
    normalize,
    compare,
    selectPrevious,
    latestPrevious,
    usable,
    planKey,
    changePlanFor,
    labels: decisionLabels
  };
})();


/*
 * Monthly and eight-week views.
 * Learning and assessment trends are kept separate.
 */

const StudyMonthly = (() => {
  const C = StudyCoach;
  const F = StudyFollowup;

  function trend(values) {
    const v = values
      .filter(x => CoachRules.rate(x) !== null)
      .map(Number);

    if (!v.length) return "not rated";
    if (v.length === 1) return "one rating";

    const d = v.slice(1).map(
      (x, i) => x - v[i]
    );

    if (d.every(x => x === 0)) {
      return "unchanged";
    }

    if (
      d.some(x => x > 0) &&
      d.some(x => x < 0)
    ) {
      return "mixed";
    }

    return d.some(x => x < 0)
      ? "declining"
      : "rising";
  }

  function analyze(
    name,
    weeks,
    refs,
    history = [],
    owner = "",
    asOf = ""
  ) {
    weeks = [...new Set(weeks)]
      .filter(C.validDate)
      .sort();

    const seen = new Map();

    const cutoff =
      asOf && C.validDate(asOf)
        ? new Date(
            C.addDays(asOf, 1) + "T00:00:00"
          ).getTime()
        : Infinity;

    [
      ...history,
      ...Object.values(refs || {})
    ].forEach(r => {
      const stamp =
        r && typeof r.timestamp === "string"
          ? Date.parse(r.timestamp)
          : NaN;

      if (
        !r ||
        r.className !== name ||
        !C.validDate(r.weekStart) ||
        C.weekStart(r.weekStart) !== r.weekStart ||
        !Number.isFinite(stamp) ||
        stamp >= cutoff ||
        CoachRules.rate(r.learningRating) === null ||
        typeof r.hadAssessment !== "boolean" ||
        (
          r.hadAssessment &&
          CoachRules.assessment(r) === null
        ) ||
        (
          r.ownerDeviceId &&
          owner &&
          r.ownerDeviceId !== owner
        )
      ) {
        return;
      }

      seen.set(F.historyId(r), r);
    });

    const all = [...seen.values()];
    const latest = new Map();

    all.forEach(r => {
      const old = latest.get(r.weekStart);

      if (
        !old ||
        Date.parse(r.timestamp) >
          Date.parse(old.timestamp)
      ) {
        latest.set(r.weekStart, r);
      }
    });

    const dated = weeks.map(w =>
      latest.get(w) || null
    );

    const rated = dated.filter(Boolean);
    const last = rated[rated.length - 1] || null;

    const assessed = rated.filter(r =>
      CoachRules.assessment(r) !== null
    );

    const learning = dated.map(r =>
      r ? String(r.learningRating) : "—"
    );

    const tests = dated.map(r =>
      !r
        ? "—"
        : r.hadAssessment
          ? String(r.assessmentRating)
          : "No assessment"
    );

    const lv = rated.map(r =>
      Number(r.learningRating)
    );

    const av = assessed.map(r =>
      Number(r.assessmentRating)
    );

    const lt = trend(lv);
    const at = trend(av);

    const outcomeLine = (
      label, values, state
    ) => {
      if (!values.length) {
        return label + ": not rated in this period.";
      }

      if (values.length === 1) {
        return label + ": one rating of " +
          values[0] + "/5; no trend yet.";
      }

      if (state === "unchanged") {
        return label + ": stayed at " +
          values[0] + "/5 across " +
          values.length + " rated weeks.";
      }

      return label + ": " +

        (
          state === "rising"
            ? "rated higher over time"
            : state === "declining"
              ? "rated lower over time"
              : "varied across the weeks"
        ) +

        " (" + values.join(" → ") + ").";
    };

    const learningMessage = outcomeLine(
      "Learning", lv, lt
    );

    const assessmentMessage = outcomeLine(
      "Assessment", av, at
    );

    // Evaluate only a continuous run of the same delivered suggestion.
    const episode = [];

    let wantedKey = "";
    let trialPlan = null;
    let trialStopped = "";

    for (let i = dated.length - 1; i >= 0; i--) {
      const r = dated[i];

      if (!r) {
        trialStopped = "A check-in is missing.";
        break;
      }

      const prior = F.selectPrevious(r, all);

      if (
        !prior.record ||
        !prior.record.recommendation
      ) {
        trialStopped =
          "No preceding recommendation is saved.";
        break;
      }

      if (prior.timing !== "before") {
        trialStopped =
          "The suggestion's before-study timing is unknown or late.";
        break;
      }

      if (!CoachRules.enough(r.snapshot)) {
        trialStopped =
          "There is too little timed activity to check that suggestion.";
        break;
      }

      const k = F.planKey(
        prior.record.recommendation
      );

      if (wantedKey && k !== wantedKey) {
        trialStopped = "The suggested step changed.";
        break;
      }

      const advice = F.normalize(
        prior.record.recommendation
      );

      const metric = F.metric(
        r.snapshot,
        advice.focus
      );

      if (
        advice.focus === "unobservable" ||
        metric.unknown
      ) {
        trialStopped =
          "The log cannot verify that particular step.";
        break;
      }

      if (!wantedKey) {
        wantedKey = k;
        trialPlan = advice;
      }

      episode.unshift({
        before: prior.record,
        after: r,
        metric
      });
    }

    const checked = episode.length;

    const followed = episode.filter(x =>
      x.metric.visible
    ).length;

    const out = {
      version: CoachRules.version,
      weeks: weeks.length,
      dates: weeks,
      rated: rated.length,
      assessed: assessed.length,
      checked,
      followed,
      learning,
      tests,
      latest: last,
      learningTrend: lt,
      assessmentTrend: at,
      learningMessage,
      assessmentMessage,

      trialNote: checked
        ? "The same suggestion is visible in " +
          followed + " of " +
          checked + " timing-qualified weeks. " +
          trialStopped

        : "The prior suggestion cannot yet be evaluated from the log. " +
          trialStopped,

      advice: null
    };

    function finish(
      verdict, title, why, chosen
    ) {
      const candidate =
        chosen ||
        (
          last
            ? C.recommend(last.snapshot, last)
            : null
        );

      const advice = candidate
        ? F.normalize(candidate)
        : null;

      if (advice) {
        advice.text = advice.action;
      }

      return Object.assign(out, {
        verdict,
        label: F.labels[verdict],
        title,
        advice,

        reason:
          learningMessage + " " +
          assessmentMessage + " " +
          why
      });
    }

    if (!last) {
      return finish(
        "unknown",
        "Add a weekly check-in",
        "A learning rating is enough to start this review. Choose No assessment when no assessment took place."
      );
    }

    if (rated.length === 1) {
      return finish(
        "test",
        "Start with one useful experiment",
        "You have a starting point, not a trend. Try the next step and review another weekly learning rating; no test is required."
      );
    }

    const prior = rated[rated.length - 2];

    const adjacentLearning =
      C.addDays(prior.weekStart, 7) ===
      last.weekStart;

    const latestLearning =
      Number(last.learningRating);

    const oldLearning =
      Number(prior.learningRating);

    const lastTest =
      assessed[assessed.length - 1] || null;

    const priorTest =
      assessed[assessed.length - 2] || null;

    const latestHasThatTest =
      lastTest &&
      lastTest.weekStart === last.weekStart;

    const persistentLearning =
      adjacentLearning &&
      oldLearning <= 2 &&
      latestLearning <= 2 &&
      latestLearning <= oldLearning;

    const persistentAssessment = !!(
      priorTest &&
      lastTest &&
      latestHasThatTest &&
      priorTest.assessmentRating <= 2 &&
      lastTest.assessmentRating <= 2 &&
      lastTest.assessmentRating <=
        priorTest.assessmentRating
    );

    const delivered = F.selectPrevious(
      last,
      all
    );

    const oldAdvice =
      delivered.record &&
      delivered.record.recommendation;

    const goal = oldAdvice
      ? F.normalize(oldAdvice).focus
      : "unobservable";

    const recentTrial = episode.slice(-2);

    const observedTrial =
      recentTrial.length === 2 &&
      recentTrial.every(x =>
        x.metric.visible
      );

    if (
      persistentLearning ||
      persistentAssessment
    ) {
      return finish(
        "change",
        "Change one part, not the whole system",

        observedTrial
          ? "The suggested activity is logged repeatedly, but difficulty continues in the same outcome. Try one targeted adjustment."

          : "You have reported difficulty more than once. We cannot say the earlier advice was tried or failed, but you can choose a new, focused experiment.",

        F.changePlanFor(goal, last)
      );
    }

    if (
      lt === "mixed" ||
      lt === "declining" ||
      at === "mixed" ||
      at === "declining"
    ) {
      return finish(
        "test",

        lt === "declining" || at === "declining"
          ? "Check what became harder"
          : "Keep testing the useful parts",

        "Keep learning and assessment separate. Check the difficult task before changing the whole routine; one outcome does not cancel the other.",

        CoachRules.concerns(last)
          ? C.recommend(last.snapshot, last)
          : trialPlan || C.recommend(last.snapshot, last)
      );
    }

    const learningStrong =
      lv.slice(-2).every(v => v >= 4);

    const currentTest =
      CoachRules.assessment(last);

    const testNotLow =
      currentTest === null ||
      currentTest >= 3;

    if (learningStrong && testNotLow) {
      return finish(
        "keep",
        "Keep the approach you find useful",

        av.length === 0
          ? "Your learning ratings remain strong. Keep the useful methods; assessment evidence can be reviewed later."

          : "The learning ratings are strong. Keep the useful methods and continue reviewing each outcome separately.",

        C.recommend(last.snapshot, last)
      );
    }

    if (
      (lt === "rising" || at === "rising") &&
      latestLearning >= 3 &&
      testNotLow
    ) {
      return finish(
        latestLearning >= 4 ? "keep" : "test",

        av.length
          ? "The recent ratings look encouraging"
          : "Your reported learning is improving",

        av.length === 0
          ? "Continue the useful approach for now. This is encouraging learning feedback without a claim about test results."

          : "Keep trying useful methods. Any assessment comparison uses only the dated assessment ratings that actually exist.",

        trialPlan &&
        trialPlan.focus !== "unobservable"
          ? trialPlan
          : C.recommend(last.snapshot, last)
      );
    }

    return finish(
      "test",
      "Keep one experiment long enough to judge it",
      "Middle or mixed readiness is not failure. Keep what helps, check one uncertain idea, and use your next learning rating.",

      trialPlan &&
      trialPlan.focus !== "unobservable"
        ? trialPlan
        : C.recommend(last.snapshot, last)
    );
  }

  function review(
    name,
    monthStart,
    today,
    refs,
    history = [],
    owner = ""
  ) {
    const end = C.nextMonth(monthStart);
    const weeks = [];

    for (
      let w = C.weekStart(monthStart);
      w < end;
      w = C.addDays(w, 7)
    ) {
      const sunday = C.addDays(w, 6);

      if (
        sunday >= monthStart &&
        sunday < end &&
        C.addDays(w, 7) <= today
      ) {
        weeks.push(w);
      }
    }

    return Object.assign(
      analyze(
        name,
        weeks,
        refs,
        history,
        owner,
        today
      ),
      {
        complete: today >= end,
        start: monthStart,
        end
      }
    );
  }

  function recent(
    name,
    today,
    refs,
    history = [],
    owner = ""
  ) {
    const end = C.weekStart(today);
    const start = C.addDays(end, -56);
    const weeks = [];

    for (
      let w = start;
      w < end;
      w = C.addDays(w, 7)
    ) {
      weeks.push(w);
    }

    return Object.assign(
      analyze(
        name,
        weeks,
        refs,
        history,
        owner,
        today
      ),
      {
        complete: true,
        start,
        end
      }
    );
  }

  return {
    review,
    recent,
    trend,
    analyze
  };
})();


/*
 * Student interface, timers, storage, upload queue,
 * Sunday check-ins, progress and backups.
 */

(() => {
  "use strict";

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
    backup: "studySystem.preCoachBackup.v1",
    history: "studySystem.reflectionHistory.v1"
  };

  const C = StudyCoach;

  const catalog = {
    "Math": [
      "Algebra 1", "Geometry", "Algebra 2",
      "Integrated Math", "Math Analysis", "Precalculus",
      "Calculus", "AP Calculus AB", "AP Statistics",
      "Other Math"
    ],

    "Science": [
      "Biology", "Honors Biology", "Chemistry",
      "Physics", "Physiology", "AP Biology",
      "AP Chemistry", "AP Environmental Science",
      "AP Physics 1", "Other Science"
    ],

    "English": [
      "English 9", "English 9 Honors", "English 10",
      "English 10 Honors", "American Literature",
      "American Literature Honors", "AP English Language",
      "Advanced Composition", "Advanced Composition Honors",
      "AP English Literature", "Other English"
    ],

    "History / Social Science": [
      "World History", "Honors World History",
      "AP World History", "U.S. History",
      "AP U.S. History", "Government", "Economics",
      "AP Government", "AP Human Geography",
      "AP Psychology", "Ethnic Studies", "Health",
      "Other History / Social Science"
    ],

    "World Language": [
      "Spanish", "Spanish 2", "Spanish 3",
      "AP Spanish Language", "AP Spanish Literature",
      "Other World Language"
    ],

    "Elective / CTE": [
      "Architecture 1", "Architecture 2",
      "Architectural Design", "Digital Design",
      "Film & Video Production", "Exploring Computer Science",
      "Robotics", "Child Development", "Health Science",
      "Emergency Medical Technician", "Art",
      "AP Drawing", "AP 3-D Art & Design",
      "AP Seminar", "AP Research", "JROTC",
      "PE / Athletics", "Other Elective / CTE"
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
        "Study / Review", "Textbook", "Video",
        "Concept Map", "Worked Examples",
        "AI Tutor", "Unit Coach"
      ]
    },

    2: {
      name: "Retrieval",

      purpose:
        "See what you can teach or produce from memory.",

      instruction:
        "Put your materials away. Do not check your notes yet. " +
        "First show yourself what you actually know.",

      methods: [
        "Teach",
        "Redo Notes from Memory",
        "Concept Map from Memory",
        "AI — Teach & Check"
      ]
    },

    3: {
      name: "Assess",

      purpose:
        "Test what you can do independently without help.",

      instruction:
        "Treat this like a real assessment. Avoid hints or " +
        "explanations until the activity is finished.",

      methods: [
        "Homework as Test",
        "Practice Test",
        "Practice Problems",
        "Anki",
        "AI Practice Test",
        "AI Game"
      ]
    }
  };

  const $ = id =>
    document.getElementById(id);

  const root = $("appRoot");
  const dialog = $("reflectionDialog");

  const esc = v =>
    String(v ?? "").replace(
      /[&<>"']/g,
      c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c])
    );

  const uid = () =>
    window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now() + "-" +
        Math.random().toString(36).slice(2);

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

  // ==================================================
  // STORAGE
  // ==================================================

  function read(k, fallback) {
    try {
      const raw = localStorage.getItem(k);

      return raw === null
        ? fallback
        : JSON.parse(raw);

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
      localStorage.setItem(
        k,
        JSON.stringify(v)
      );
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
    const v = read(K.reflections, {});

    if (
      !v ||
      Array.isArray(v) ||
      typeof v !== "object"
    ) {
      throw new Error(
        "Saved check-ins need recovery. Do not clear them."
      );
    }

    return v;
  }

  function reflectionHistory() {
    const h = read(K.history, {});

    if (
      !h ||
      Array.isArray(h) ||
      typeof h !== "object"
    ) {
      throw new Error(
        "Reflection history needs recovery. Export a backup."
      );
    }

    return h;
  }

  function historyList() {
    const map = new Map();

    [
      ...Object.values(reflectionHistory()),
      ...Object.values(reflections())
    ].forEach(r => {
      if (
        r &&
        r.className &&
        C.validDate(r.weekStart) &&
        r.timestamp
      ) {
        map.set(
          StudyFollowup.historyId(r),
          r
        );
      }
    });

    return [...map.values()];
  }

  function saveReflectionLocal(record) {
    const history = reflectionHistory();

    Object.values(reflections()).forEach(r => {
      history[StudyFollowup.historyId(r)] = r;
    });

    history[
      StudyFollowup.historyId(record)
    ] = record;

    // History is written first to support interrupted-write recovery.
    write(K.history, history);

    const all = reflections();

    all[
      C.key(record.weekStart, record.className)
    ] = record;

    write(K.reflections, all);
  }

  function latestReflection(
    name,
    through = "9999-12-31"
  ) {
    return Object.values(reflections())
      .filter(r =>
        r.className === name &&
        r.weekStart < through
      )
      .sort((a, b) =>
        b.weekStart.localeCompare(a.weekStart) ||
        b.timestamp.localeCompare(a.timestamp)
      )[0] || null;
  }

  // ==================================================
  // SAVED WEEKLY AND MONTHLY FEEDBACK
  // ==================================================

  function feedbackHtml(record, compact = false) {
    if (!record) return "";

    const saved =
      record.followup ||
      record.snapshot?.keepAdjust;

    const refreshed =
      !saved ||
      saved.version !== CoachRules.version;

    let f = saved;
    let advice = record.recommendation;

    // Read-only refresh: original saved ratings/advice are preserved.
    if (refreshed && record.snapshot) {
      f = StudyFollowup.evaluate(
        record,
        historyList()
      );

      advice = f.next;
    }

    if (!advice) return "";

    const button =
      '<button type="button" class="text-button" ' +
      'data-coach-class="' +
      esc(record.className) +
      '" data-coach-stage="' +
      Number(advice.targetStage || 2) +
      '">Choose this next step →</button>';

    if (!f) {
      return (
        '<div class="coach"><span class="eyebrow">' +
        "LAST RATED WEEK · " +
        esc(rangeLabel(record.weekStart)) +
        "</span><h3>" +
        esc(advice.title) +
        "</h3><p>" +
        esc(advice.text) +
        '</p><p class="small">' +
        "Your next check-in will compare weeks." +
        "</p>" +
        button +
        "</div>"
      );
    }

    const shown = [
      f.rows[0],
      ...f.rows.slice(-2)
    ];

    const table =
      '<div class="table-wrap"><table>' +
      '<caption class="small">' +
      "Last week vs. this week" +
      "</caption><thead><tr>" +
      "<th>What changed</th><th>Previous<br>" +

      esc(
        f.priorWeek
          ? pretty(f.priorWeek)
          : "Not available"
      ) +

      "</th><th>Latest<br>" +
      esc(pretty(f.currentWeek)) +
      "</th></tr></thead><tbody>" +

      shown.map(r =>
        "<tr><td>" +
        esc(r.label) +
        "</td><td>" +
        esc(r.before) +
        "</td><td>" +
        esc(r.after) +
        "</td></tr>"
      ).join("") +

      "</tbody></table></div>";

    const more =
      '<p class="small"><strong>Previous suggestion:</strong> ' +
      esc(f.previousSuggestion || "None saved.") +
      "</p>" +

      f.rows.slice(1, -2).map(r =>
        '<p class="small">' +
        esc(r.label) +
        ": " +
        esc(r.before) +
        " → " +
        esc(r.after) +
        "</p>"
      ).join("");

    const result =
      "<p>" + esc(f.reason) + "</p>";

    return (
      '<div class="coach">' +

      (
        refreshed
          ? '<p class="small">Updated coaching for this saved check-in. Your original ratings and advice are unchanged in history.</p>'
          : ""
      ) +

      '<span class="eyebrow">KEEP OR ADJUST? · ' +
      esc(record.className) +
      '</span><span class="badge">' +
      esc(f.label) +
      "</span><h3>" +
      esc(f.title) +
      '</h3><p class="small">Rated week: ' +
      esc(rangeLabel(record.weekStart)) +
      "</p>" +

      (compact ? "" : table + result) +

      "<p><strong>Next step:</strong> " +
      esc(advice.text) +
      "</p>" +
      button +

      "<details><summary>" +

      (
        compact
          ? "See last week vs. this week"
          : "More detail"
      ) +

      "</summary>" +
      (compact ? table + result : "") +
      more +

      (
        f.trialNote
          ? '<p class="small">' +
            esc(f.trialNote) +
            "</p>"
          : ""
      ) +

      '</details><p class="small">' +
      "Based on your ratings and recorded activity." +
      "</p></div>"
    );
  }

  function monthlyHtml(
    name,
    month,
    recent = false
  ) {
    const m = recent
      ? StudyMonthly.recent(
          name,
          today(),
          reflections(),
          historyList(),
          deviceId()
        )

      : StudyMonthly.review(
          name,
          month,
          today(),
          reflections(),
          historyList(),
          deviceId()
        );

    const label = recent
      ? "LAST 8 COMPLETED WEEKS"

      : new Date(
          month + "T12:00:00"
        ).toLocaleDateString(
          undefined,
          {
            month: "long",
            year: "numeric"
          }
        ) +
        (m.complete ? "" : " · so far");

    const advice = m.advice;

    const rows = m.dates.map((w, i) =>
      "<tr><td>" +
      esc(pretty(w)) +
      "</td><td>" +
      esc(m.learning[i]) +
      "</td><td>" +
      esc(m.tests[i]) +
      "</td></tr>"
    ).join("");

    return `<div class="coach">
      <span class="eyebrow">${esc(label)} · ${esc(name)}</span>
      <span class="badge">${esc(m.label)}</span>
      <h3>${esc(m.title)}</h3>
      <p class="small">${m.rated} learning-rated weeks; ${m.assessed} assessment-rated weeks.
        ${m.latest ? "Latest rated week starts " + esc(pretty(m.latest.weekStart)) + "." : ""}</p>
      <p>${esc(m.reason)}</p>
      ${advice ? `<p><strong>Next step:</strong> ${esc(advice.text)}</p>
        <button type="button" class="text-button" data-coach-class="${esc(name)}"
          data-coach-stage="${Number(advice.targetStage || 2)}">Choose this next step →</button>` : ""}
      <details><summary>See the weeks and the earlier suggestion</summary>
        <div class="table-wrap"><table><thead><tr>
          <th>Week starting</th><th>Learning</th><th>Assessment</th>
        </tr></thead><tbody>${rows}</tbody></table></div>
        <p class="small">${esc(m.trialNote)}</p>
        <p class="small">— means no check-in. No assessment is not a zero.
          Learning feedback does not require an assessment. Weeks belong to the month
          of their ending Sunday. The current unfinished week is not included.</p>
      </details>
      <p class="small">Based on your ratings and recorded activity.</p>
    </div>`;
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
    const n = Math.max(
      0,
      Math.floor(sec || 0)
    );

    return String(
      Math.floor(n / 60)
    ).padStart(2, "0") +
      ":" +
      String(n % 60).padStart(2, "0");
  }

  function human(sec) {
    if (sec > 0 && sec < 60) {
      return Math.round(sec) + " sec";
    }

    const m = Math.round((sec || 0) / 60);

    return m < 60
      ? m + " min"
      : Math.floor(m / 60) + " hr" +
        (m % 60 ? " " + m % 60 + " min" : "");
  }

  function pretty(key) {
    return new Date(
      key + "T12:00:00"
    ).toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    );
  }

  function rangeLabel(week) {
    return pretty(week) +
      " – " +
      pretty(C.addDays(week, 6));
  }

  function pct(n, d) {
    return d
      ? Math.round(n / d * 100) + "%"
      : "—";
  }

  function lastChecked(name) {
    const checks = sessions()
      .filter(r =>
        r.className === name &&
        [2, 3].includes(Number(r.stage))
      )
      .sort((a, b) =>
        String(b.timestamp).localeCompare(
          String(a.timestamp)
        )
      );

    if (!checks.length) {
      return sessions().some(r =>
        r.className === name
      )
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

      localStorage.getItem(K.start) ||
      C.weekStart(today()),

      today()
    );
  }

  function ankiDue() {
    const start = C.weekStart(today());
    const out = [];

    [
      start,
      C.addDays(start, 3)
    ].forEach(day => {
      if (
        day <= today() &&
        localStorage.getItem(
          K.ankiDone + day
        ) !== "1"
      ) {
        out.push(day);
      }
    });

    return out;
  }

  // ==================================================
  // SCREEN AND TIMER STATE
  // ==================================================

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
    if (
      active &&
      active.runningSince !== null
    ) {
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

    if (
      screen === "home" &&
      !classes().length
    ) {
      screen = "classes";
    }

    if (screen === "classes") {
      renderClasses();
    } else if (screen === "stage") {
      renderStages();
    } else if (screen === "timer") {
      renderTimer();
    } else if (screen === "complete") {
      renderComplete();
    } else if (screen === "progress") {
      renderProgress();
    } else if (screen === "backup") {
      renderBackup();
    } else {
      renderHome();
    }

    updateSync();
  }

  // ==================================================
  // HOME
  // ==================================================

  function renderHome() {
    const due = pending();
    const anki = ankiDue();

    let s =
      '<section class="card intro">' +
      '<span class="eyebrow">YOUR NEXT STUDY VISIT</span>' +
      "<h2>Pick a class. Make one useful next move.</h2>" +
      '<p class="muted">' +
      "Start at any stage. A second stage is always optional." +
      "</p></section>";

    if (due.length) {
      s +=
        '<section class="notice"><strong>' +
        due.length +
        " weekly check-in" +
        (due.length === 1 ? " is" : "s are") +
        ' waiting</strong><p class="small">' +
        "Two ratings per class. Unanswered check-ins stay here, " +
        "including after the week ends.</p>" +
        '<button class="primary" data-action="reflect">' +
        "Answer check-in</button></section>";
    }

    if (
      anki.length &&
      localStorage.getItem(
        K.ankiHide + today()
      ) !== "1"
    ) {
      s +=
        '<section class="notice">' +
        "<strong>Anki — Stage 3 Assess</strong><p>" +

        (
          anki[0] === today()
            ? "Your Monday/Thursday Anki session is due today."

            : "An Anki make-up for " +
              pretty(anki[0]) +
              " is due this week."
        ) +

        '</p><div class="actions">' +
        '<button class="primary" data-action="anki">' +
        "Choose a class for Anki</button>" +
        '<button class="secondary" data-action="hide-anki">' +
        "Hide for today</button></div></section>";
    }

    s +=
      '<section class="card">' +
      '<div class="section-head">' +
      "<h2>Your classes</h2>" +
      '<button class="secondary" data-nav="classes">' +
      "Edit classes</button></div>" +
      '<div class="class-grid">';

    classes().forEach((c, i) => {
      s +=
        '<button class="class-button" data-class="' +
        i + '">' +
        "<strong>" +
        esc(c.name) +
        "</strong><span>" +
        esc(lastChecked(c.name)) +
        "</span></button>";
    });

    root.innerHTML = s + "</div></section>";

    maybePrompt();
  }

  // ==================================================
  // CLASS SETUP
  // ==================================================

  function renderClasses() {
    root.innerHTML =
      '<section class="card">' +
      '<span class="eyebrow">SAVED ON THIS DEVICE</span>' +
      "<h2>Set up your classes</h2>" +
      '<p class="muted">' +
      "Add once; choose them for future study visits.</p>" +

      '<label class="field" for="subject">Subject</label>' +
      '<select id="subject">' +
      '<option value="">Choose a subject</option>' +

      Object.keys(catalog).map(x =>
        "<option>" + esc(x) + "</option>"
      ).join("") +

      "</select>" +

      '<label class="field" for="course">Class</label>' +
      '<select id="course">' +
      '<option value="">Choose a subject first</option>' +
      "</select>" +

      '<div id="customWrap" hidden>' +
      '<label class="field" for="custom">Your class name</label>' +
      '<input id="custom" type="text" maxlength="100" ' +
      'placeholder="Class name, not your name">' +
      "</div>" +

      '<div class="actions">' +
      '<button class="primary" data-action="add-class">' +
      "Add class</button></div></section>" +

      '<section class="card"><h3>Your saved classes</h3>' +

      classes().map((c, i) =>
        '<div class="saved-row"><div><strong>' +
        esc(c.name) +
        '</strong><div class="small">' +
        esc(c.subject) +
        "</div></div>" +
        '<button class="secondary" data-remove="' +
        i + '">Remove</button></div>'
      ).join("") +

      (
        classes().length
          ? '<div class="actions">' +
            '<button class="primary" data-nav="home">' +
            "Done adding classes</button></div>"

          : '<p class="muted">' +
            "Add at least one class to get started.</p>"
      ) +

      "</section>";

    $("subject").onchange = () => {
      $("course").innerHTML =
        '<option value="">Choose a class</option>' +

        (catalog[$("subject").value] || [])
          .map(x =>
            "<option>" + esc(x) + "</option>"
          )
          .join("");

      $("customWrap").hidden = true;
    };

    $("course").onchange = () => {
      $("customWrap").hidden =
        !$("course").value.startsWith("Other");
    };
  }

  // ==================================================
  // STAGES AND METHODS
  // ==================================================

  function renderStages() {
    if (!chosenClass) {
      screen = "home";
      render();
      return;
    }

    const ws = C.weekStart(today());

    const sum = C.summarize(
      C.forClassWeek(
        sessions(),
        chosenClass.name,
        ws
      )
    );

    const recent = latestReflection(
      chosenClass.name
    );

    const advice =
      recent && recent.recommendation
        ? recent.recommendation
        : C.recommend(sum);

    root.innerHTML =
      '<section class="card">' +
      '<div class="section-head"><div>' +
      '<span class="eyebrow">STUDYING</span><h2>' +
      esc(chosenClass.name) +
      "</h2></div>" +

      '<button class="secondary" data-nav="home">' +
      "Change class</button></div>" +

      (
        recent
          ? feedbackHtml(recent, true)

          : sum.count
            ? '<div class="coach"><h3>' +
              esc(advice.title) +
              "</h3><p>" +
              esc(advice.text) +
              "</p></div>"
            : ""
      ) +

      '<p class="muted">' +
      "Choose any stage. The suggestions are options, " +
      "not a required sequence.</p>" +

      '<div class="grid">' +

      [1, 2, 3].map(n =>
        '<button class="stage-button ' +
        (chosenStage === n ? "selected" : "") +
        '" data-stage="' + n + '">' +

        "<span>Stage " + n + "</span>" +
        "<strong>" + stages[n].name + "</strong>" +
        "<span>" + stages[n].purpose + "</span>" +
        "</button>"
      ).join("") +

      "</div>" +

      (
        chosenStage
          ? '<div class="stage-details"><h3>Choose your ' +
            stages[chosenStage].name +
            ' method</h3><div class="methods">' +

            stages[chosenStage].methods.map((m, i) =>
              '<button class="method-button" data-method="' +
              i + '">' +
              esc(m) +
              "</button>"
            ).join("") +

            "</div></div>"

          : ""
      ) +

      "</section>";
  }

  function openTimer(method) {
    if (active) return;

    // Anki always remains Stage 3 — Assess.
    if (method === "Anki") {
      chosenStage = 3;
    }

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

  // ==================================================
  // STUDY AND CROSSCHECK TIMERS
  // ==================================================

  function renderTimer() {
    const cross =
      active.phase === "crosscheck";

    root.innerHTML =
      '<section class="card timer">' +
      '<span class="eyebrow">' +
      esc(active.className) +
      "</span><h2>" +

      (
        cross
          ? "Crosscheck"
          : "Stage " + active.stage + " — " +
            C.stageName(active.stage)
      ) +

      "</h2><h3>" +
      esc(active.method) +
      '</h3><p class="muted">' +

      (
        cross
          ? "Your Retrieval is already saved. Compare it with notes or another " +
            "reliable source, correct gaps, then consider a short Assess."

          : stages[active.stage].instruction
      ) +

      "</p>" +

      '<div id="clock" class="clock" role="timer" ' +
      'aria-label="Elapsed study time">' +
      time(elapsed() / 1000) +
      "</div>" +

      '<div class="actions">' +
      '<button class="primary" data-action="toggle-timer">' +

      (
        active.runningSince !== null
          ? "Pause"
          : active.ms > 0
            ? "Resume"
            : cross
              ? "Start Crosscheck"
              : "Start"
      ) +

      "</button>" +

      (
        active.startedAt || cross
          ? '<button class="secondary" data-action="finish-timer">' +
            (
              cross
                ? "Finish Crosscheck"
                : "Finish stage"
            ) +
            "</button>"
          : ""
      ) +

      '<button class="text-button" data-action="' +

      (
        cross
          ? "skip-crosscheck"
          : "cancel-timer"
      ) +

      '">' +

      (
        cross
          ? "Skip Crosscheck for now"
          : "Cancel stage"
      ) +

      "</button></div>" +

      '<p class="small">' +
      "Time is logged automatically. Do not enter names or grades." +
      "</p></section>";
  }

  function persistRecord(record) {
    const rows = sessions();

    const i = rows.findIndex(r =>
      (r.id && r.id === record.id) ||
      r.timestamp === record.timestamp
    );

    if (i >= 0) {
      rows[i] = record;
    } else {
      rows.push(record);
    }

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
        message(
          "Start the timer before finishing."
        );
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

      // Save Retrieval before moving to Crosscheck.
      persistRecord(record);

      if (
        record.stage === 3 &&
        record.method === "Anki"
      ) {
        const due = ankiDue();

        if (due.length) {
          rawWrite(
            K.ankiDone + due[0],
            "1"
          );
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
      const r = Object.assign(
        {},
        active.record
      );

      r.crosscheckSeconds = skip
        ? 0
        : Math.floor(active.ms / 1000);

      r.crosscheckSkipped = skip;

      r.crosscheckFinishedAt = skip
        ? ""
        : new Date().toISOString();

      r.totalSeconds =
        r.studySeconds +
        r.crosscheckSeconds;

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

      "<h2>Stage " +
      completed.stage +
      " — " +
      C.stageName(completed.stage) +
      " complete</h2>" +

      "<p><strong>" +
      esc(completed.className) +
      "</strong> · " +
      esc(completed.method) +
      " · " +
      human(completed.studySeconds) +

      (
        completed.crosscheckSeconds
          ? " + " +
            human(completed.crosscheckSeconds) +
            " Crosscheck"
          : ""
      ) +

      "</p>" +

      '<div class="coach"><h3>' +
      next +
      "</h3><p>" +

      (
        completed.stage === 2
          ? "Ready to continue? Try a short independent practice test, " +
            "problems, or Anki after your Crosscheck."

          : "Continue only if it serves your learning goal. " +
            "You can also finish now."
      ) +

      "</p></div>" +

      '<div class="actions">' +
      '<button class="primary" data-action="next-stage">' +
      next +
      "</button>" +

      '<button class="secondary" data-action="finish-visit">' +
      "Finish studying</button></div></section>";
  }

  // ==================================================
  // WEEKLY AND MONTHLY PROGRESS
  // ==================================================

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

    Object.values(reflections()).forEach(r => {
      if (C.validDate(r.weekStart)) {
        keys.add(
          periodKind === "week"
            ? r.weekStart

            : C.monthStart(
                C.addDays(r.weekStart, 6)
              )
        );
      }
    });

    if (!keys.has(periodKey)) {
      periodKey =
        [...keys].sort().reverse()[0];
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
      "<h2>Progress & next steps</h2>" +

      '<div class="actions">' +
      '<button class="' +

      (
        periodKind === "week"
          ? "primary"
          : "secondary"
      ) +

      '" data-period="week">Weekly</button>' +

      '<button class="' +

      (
        periodKind === "month"
          ? "primary"
          : "secondary"
      ) +

      '" data-period="month">Monthly</button>' +
      "</div>" +

      '<label class="field" for="periodSelect">Choose a ' +
      periodKind +
      "</label>" +

      '<select id="periodSelect">' +

      [...keys].sort().reverse().map(k =>
        '<option value="' +
        k + '" ' +
        (k === periodKey ? "selected" : "") +
        ">" +

        (
          periodKind === "week"
            ? esc(rangeLabel(k))

            : esc(
                new Date(
                  k + "T12:00:00"
                ).toLocaleDateString(
                  undefined,
                  {
                    month: "long",
                    year: "numeric"
                  }
                )
              )
        ) +

        "</option>"
      ).join("") +

      "</select></section>" +

      '<section class="card"><div class="stats">' +

      '<div class="stat"><span>Total time</span><strong>' +
      human(s.seconds) +
      "</strong></div>" +

      '<div class="stat"><span>Completed stages</span><strong>' +
      s.count +
      "</strong></div>" +

      '<div class="stat"><span>Study days</span><strong>' +
      s.days.length +
      "</strong></div></div>" +

      '<h3 style="margin-top:20px">Your study mix</h3>' +

      '<div class="mixbar" aria-hidden="true">' +

      [1, 2, 3].map(k =>
        '<i class="' +

        ({
          1: "learn",
          2: "retrieval",
          3: "assess"
        }[k]) +

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

        ({
          1: "learn",
          2: "retrieval",
          3: "assess"
        }[k]) +

        '"></i>' +

        C.stageName(k) +
        " " +
        pct(s.stages[k].seconds, stageTotal) +
        "</span>"
      ).join("") +

      '</div><p class="small">' +
      "Stage percentages use study time, not Crosscheck. Crosscheck: " +
      human(s.crossSeconds) +
      ". There is no required “perfect” percentage." +
      "</p></section>";

    const periodRefs = Object.values(
      reflections()
    ).filter(r =>
      periodKind === "week"
        ? r.weekStart === periodKey

        : C.addDays(r.weekStart, 6) >= periodKey &&
          C.addDays(r.weekStart, 6) < end
    );

    const names = [
      ...new Set([
        ...selected.map(r => r.className),
        ...periodRefs.map(r => r.className)
      ])
    ];

    names.forEach(name => {
      const classRows = selected.filter(r =>
        r.className === name
      );

      const cs = C.summarize(classRows);

      const visits = new Set(
        classRows
          .filter(r => r.visitId)
          .map(r => r.visitId)
      ).size;

      const ref = periodKind === "week"
        ? reflections()[
            C.key(periodKey, name)
          ]
        : null;

      const advice =
        ref && ref.recommendation
          ? ref.recommendation
          : C.recommend(cs);

      html +=
        '<section class="card">' +
        '<div class="section-head"><div>' +
        '<span class="eyebrow">' +

        human(cs.seconds) +
        " · " +
        cs.count +
        " COMPLETED STAGES</span><h2>" +

        esc(name) +

        "</h2></div>" +

        (
          periodKind === "week" &&
          C.addDays(periodKey, 6) <= today()

            ? '<button class="secondary" ' +
              'data-reflection-class="' +
              esc(name) +
              '" data-week="' +
              periodKey +
              '">' +

              (
                ref
                  ? "Update ratings"
                  : "Weekly check-in"
              ) +

              "</button>"

            : ""
        ) +

        "</div>";

      if (ref) {
        html +=
          '<p class="small">Your ratings: learning ' +
          ref.learningRating +
          "/5 · " +

          (
            ref.hadAssessment
              ? "assessment " +
                ref.assessmentRating +
                "/5"

              : "no assessment this week"
          ) +

          ". Advice below uses the snapshot saved " +

          esc(
            new Date(
              ref.timestamp
            ).toLocaleString()
          ) +

          ".</p>";
      }

      const displayed =
        ref ||
        latestReflection(name, end);

      if (periodKind === "month") {
        html += monthlyHtml(
          name,
          periodKey
        );

        if (
          displayed &&
          displayed.recommendation
        ) {
          html +=
            "<details><summary>Latest weekly comparison</summary>" +
            feedbackHtml(displayed) +
            "</details>";
        }

      } else {
        html += displayed
          ? feedbackHtml(displayed)

          : '<div class="coach"><h3>' +
            esc(advice.title) +
            "</h3><p>" +
            esc(advice.text) +
            "</p></div>";
      }

      html +=
        '<p class="small">Recorded visits: ' +
        visits +
        " · Stages without a visit ID: " +
        classRows.filter(r => !r.visitId).length +
        ".</p>";

      html +=
        "<details><summary>My longer-term pattern · last 8 completed weeks</summary>" +
        monthlyHtml(name, periodKey, true) +
        "</details>";

      html +=
        "<details><summary>Methods within each stage</summary>";

      [1, 2, 3].forEach(k => {
        const st = cs.stages[k];

        const entries = Object.entries(
          st.methods
        ).sort(
          (a, b) => b[1].count - a[1].count
        );

        html +=
          '<div class="stage-details"><h3>' +
          C.stageName(k) +
          "</h3>";

        if (!entries.length) {
          html +=
            '<p class="small">No ' +
            C.stageName(k) +
            " stage logged in this period.</p>";

        } else {
          html +=
            '<div class="table-wrap"><table>' +
            "<thead><tr>" +
            "<th>Method</th>" +
            '<th class="num">Uses</th>' +
            '<th class="num">% of uses</th>' +
            '<th class="num">Time</th>' +
            '<th class="num">% of time</th>' +
            "</tr></thead><tbody>" +

            entries.map(([n, d]) =>
              "<tr><td>" +
              esc(n) +

              '</td><td class="num">' +
              d.count +

              '</td><td class="num">' +
              pct(d.count, st.count) +

              '</td><td class="num">' +
              human(d.seconds) +

              '</td><td class="num">' +
              pct(d.seconds, st.seconds) +

              "</td></tr>"
            ).join("") +

            "</tbody></table></div>";
        }

        html += "</div>";
      });

      html +=
        "</details><details>" +
        "<summary>Saved check-in and advice history</summary>" +

        historyList()
          .filter(r => r.className === name)
          .sort((a, b) =>
            b.timestamp.localeCompare(a.timestamp)
          )
          .map(r =>
            '<p class="small"><strong>' +

            esc(rangeLabel(r.weekStart)) +

            "</strong> · learning " +
            esc(r.learningRating) +
            "/5 · " +

            (
              r.hadAssessment
                ? "assessment " +
                  esc(r.assessmentRating) +
                  "/5"

                : "no assessment"
            ) +

            "<br>" +

            esc(
              r.recommendation?.text ||
              "Recommendation not recorded"
            ) +

            "<br>Saved " +

            esc(
              new Date(
                r.timestamp
              ).toLocaleString()
            ) +

            "</p>"
          ).join("") +

        "</details></section>";
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
        '<p class="small">' +
        "Stages and check-ins sync automatically. " +
        "This button also sends the compatible weekly aggregate." +
        "</p>" +

        '<button class="secondary" data-action="weekly-share">' +
        "Share / update weekly summary</button></section>";
    }

    root.innerHTML = html;

    $("periodSelect").onchange = () => {
      periodKey = $("periodSelect").value;
      render();
    };
  }

  // ==================================================
  // SUNDAY CHECK-INS
  // ==================================================

  function ratingField(name, label) {
    return (
      "<fieldset><legend>" +
      label +
      '</legend><div class="rating-grid">' +

      [1, 2, 3, 4, 5].map(n =>
        '<label class="rating-option">' +
        '<input type="radio" name="' +
        name +
        '" value="' +
        n +
        '" required aria-label="' +
        n +
        ' out of 5"><span>' +
        n +
        "</span></label>"
      ).join("") +

      '</div><div class="scale">' +
      "<span>1 · Not well</span>" +
      "<span>5 · Very well</span></div>" +

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

    reflectionTarget =
      target || due[0];

    if (!reflectionTarget) {
      message(
        "All due check-ins are answered."
      );
      return;
    }

    const r = reflections()[
      C.key(
        reflectionTarget.weekStart,
        reflectionTarget.className
      )
    ];

    dialog.innerHTML =
      '<form id="reflectionForm">' +
      '<span class="badge">WEEKLY CHECK-IN' +

      (
        due.length > 1
          ? " · " + due.length + " waiting"
          : ""
      ) +

      '</span><h2 id="reflectionTitle">' +
      esc(reflectionTarget.className) +

      '</h2><p class="small">' +

      esc(
        rangeLabel(
          reflectionTarget.weekStart
        )
      ) +

      "</p><p>" +
      "Think about this class during the dates above. " +
      "These are self-ratings, not a grade submission." +
      "</p>" +

      ratingField(
        "learning",
        "How well did your learning go?"
      ) +

      ratingField(
        "assessment",
        "How well did your quizzes, tests, or graded assessments go?"
      ) +

      '<p class="small">' +
      "A rating is optional now, but this check-in " +
      "stays due until both questions are answered." +
      "</p>" +

      '<div class="actions">' +
      '<button class="primary" type="submit">' +
      "Save ratings & see my next step</button>" +

      '<button type="button" class="secondary" id="laterReflection">' +
      "Study first</button></div>" +

      '<p id="reflectionError" role="alert"></p>' +
      "</form>";

    if (r) {
      const l = dialog.querySelector(
        'input[name="learning"][value="' +
        Number(r.learningRating) +
        '"]'
      );

      const a = dialog.querySelector(
        'input[name="assessment"][value="' +

        (
          r.hadAssessment
            ? Number(r.assessmentRating)
            : "none"
        ) +

        '"]'
      );

      if (l) l.checked = true;
      if (a) a.checked = true;
    }

    $("laterReflection").onclick = () => {
      reminderDismissed = true;
      dialog.close();
    };

    $("reflectionForm").onsubmit = e => {
      e.preventDefault();

      try {
        const form = new FormData(e.target);

        const learning = Number(
          form.get("learning")
        );

        const answer = form.get("assessment");

        if (
          ![1, 2, 3, 4, 5].includes(learning) ||
          ![
            "1", "2", "3", "4", "5", "none"
          ].includes(answer)
        ) {
          throw new Error(
            "Answer both questions, or choose No assessment this week."
          );
        }

        const target = reflectionTarget;

        const rs = C.forClassWeek(
          sessions(),
          target.className,
          target.weekStart
        );

        const snapshot = C.summarize(rs);

        snapshot.behaviorEvidence =
          StudyFollowup.evidence(rs);

        const record = {
          ownerDeviceId: deviceId(),
          weekStart: target.weekStart,
          className: target.className,
          timestamp: new Date().toISOString(),
          revisionId: uid(),
          snapshot,
          learningRating: learning,
          hadAssessment: answer !== "none",

          assessmentRating: answer === "none"
            ? null
            : Number(answer)
        };

        const followup =
          StudyFollowup.evaluate(
            record,
            historyList()
          );

        record.followup = followup;
        record.recommendation = followup.next;
        snapshot.keepAdjust = followup;

        saveReflectionLocal(record);

        let uploadWarning = "";

        try {
          rs.forEach(queueStage);
          queueReflection(record);

        } catch (error) {
          uploadWarning =
            "Saved locally. Upload will retry: " +
            error.message;
        }

        dialog.innerHTML =
          '<span class="badge">RATINGS SAVED ON THIS DEVICE</span>' +
          '<h2 id="reflectionTitle">Your week in ' +
          esc(record.className) +
          "</h2>" +

          feedbackHtml(record) +

          '<p class="small">' +
          esc(uploadWarning) +
          "</p>" +

          '<div class="actions">' +
          '<button class="primary" id="doneReflection">' +
          "Continue</button></div>";

        $("doneReflection").onclick = () => {
          dialog.close();
          reminderDismissed = false;
          screen = "home";
          render();
        };

        updateSync();

      } catch (error) {
        const output = $("reflectionError");

        if (output) {
          output.textContent = error.message;
        } else {
          message(error.message);
        }
      }
    };

    if (!dialog.open) {
      dialog.showModal();
    }
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

  // ==================================================
  // PERSISTENT SUBMISSION QUEUE
  // ==================================================

  function enqueue(key, payload) {
    const queue = read(K.queue, []);
    const fingerprint = JSON.stringify(payload);
    const receipt = read(K.sync, {});

    if (receipt[key] === fingerprint) {
      return;
    }

    const existing = queue.find(q =>
      q.key === key
    );

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

    const i = queue.findIndex(x =>
      x.key === key
    );

    if (i >= 0) {
      queue[i] = q;
    } else {
      queue.push(q);
    }

    write(K.queue, queue);
    updateSync();

    setTimeout(() => syncQueue(), 0);
  }

  function queueStage(r) {
    enqueue(
      "stage:" +
      deviceId() +
      ":" +
      r.timestamp,

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
        crosscheckFinishedAt: r.crosscheckFinishedAt || "",

        totalSeconds:
          C.number(r.studySeconds) +
          C.number(r.crosscheckSeconds)
      }
    );
  }

  function queueReflection(r) {
    enqueue(
      "reflection:" +
      deviceId() +
      ":" +
      C.key(r.weekStart, r.className) +

      (
        r.followup
          ? ":" + r.revisionId
          : ""
      ),

      {
        action: "submitReflection",
        deviceId: deviceId(),
        weekStart: r.weekStart,
        className: r.className,
        timestamp: r.timestamp,
        revisionId: r.revisionId,
        learningRating: r.learningRating,
        hadAssessment: r.hadAssessment,

        assessmentRating: r.hadAssessment
          ? r.assessmentRating
          : "",

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
          " item" +
          (queue.length === 1 ? "" : "s") +
          " saved locally; waiting for Google confirmation." +

          (
            lastError
              ? " " + lastError
              : ""
          )

        : "New uploads are up to date. " +
          "Your study history stays saved on this device.";
  }

  function post(payload) {
    return new Promise((resolve, reject) => {
      const endpoint =
        window.STUDY_TRACKER_WEEKLY_ENDPOINT;

      if (!endpoint) {
        reject(
          new Error("Backend URL missing.")
        );
        return;
      }

      if (location.protocol === "file:") {
        reject(
          new Error(
            "Open the GitHub Pages site to sync."
          )
        );
        return;
      }

      const requestId = uid();

      const frame =
        document.createElement("iframe");

      const form =
        document.createElement("form");

      frame.name =
        "study_upload_" +
        requestId.replace(/[^a-z0-9]/gi, "");

      frame.hidden = true;
      frame.title = "Study data submission";

      form.method = "POST";
      form.action = endpoint;
      form.target = frame.name;
      form.hidden = true;

      Object.entries(
        Object.assign({}, payload, {
          requestId,
          replyOrigin: location.origin
        })
      ).forEach(([k, v]) => {
        const input =
          document.createElement("input");

        input.type = "hidden";
        input.name = k;
        input.value = String(v ?? "");

        form.appendChild(input);
      });

      const clean = () => {
        clearTimeout(timeout);

        window.removeEventListener(
          "message",
          receive
        );

        frame.remove();
        form.remove();
      };

      const receive = e => {
        const validOrigin =
          e.origin === "https://script.google.com" ||
          e.origin === "https://script.googleusercontent.com" ||
          /^https:\/\/[a-z0-9-]+[.-]script\.googleusercontent\.com$/i.test(
            e.origin
          );

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
          reject(
            new Error(
              e.data.message ||
              "Google did not accept this item."
            )
          );
        }
      };

      const timeout = setTimeout(() => {
        clean();

        reject(
          new Error(
            "No confirmation yet. It will retry."
          )
        );
      }, 45000);

      window.addEventListener(
        "message",
        receive
      );

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

          found.nextTry =
            Date.now() +

            Math.min(
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
      "weekly:" +
      deviceId() +
      ":" +
      periodKey,

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

    history[periodKey] =
      new Date().toISOString();

    write(K.submissions, history);

    message(
      "Weekly summary queued. The sync bar shows when Google confirms it."
    );
  }

  // ==================================================
  // BACKUP AND RESTORE
  // ==================================================

  function backupData() {
    const data = {};

    for (
      let i = 0;
      i < localStorage.length;
      i++
    ) {
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
      [
        JSON.stringify(
          backupData(),
          null,
          2
        )
      ],
      {
        type: "application/json"
      }
    );

    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);

    a.download =
      "study-system-backup-" +
      today() +
      ".json";

    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(a.href);
    }, 5000);

    message(
      "Backup exported. Keep it somewhere safe."
    );
  }

  function renderBackup() {
    root.innerHTML =
      '<section class="card">' +
      "<h2>Keep your study history safe</h2>" +

      "<p>This update uses your existing v4 classes, sessions, and " +
      "anonymous device ID. New check-ins are stored separately.</p>" +

      '<p class="muted">' +
      "A browser update does not transfer data between devices, " +
      "browsers, or Home Screen apps. Clearing site data can " +
      "remove the local copy. Export a backup first.</p>" +

      '<div class="actions">' +
      '<button class="primary" data-action="export">' +
      "Export my backup</button>" +

      '<button class="secondary" data-action="import">' +
      "Restore / merge a backup</button></div>" +

      '<p class="small">' +
      "Restoring merges records; it does not erase your current records. " +
      "Backups from a different device ID are accepted only when this " +
      "device has no study history or classes.</p></section>";
  }

  $("backupInput").onchange = async e => {
    try {
      const file = e.target.files[0];
      if (!file) return;

      const b = JSON.parse(
        await file.text()
      );

      if (
        b.format !== "Study System Backup" ||
        !b.data
      ) {
        throw new Error(
          "Choose a Study System backup JSON file."
        );
      }

      const oldId = b.data[K.device];

      const currentId =
        localStorage.getItem(K.device);

      if (
        oldId &&
        currentId !== oldId &&
        (
          classes().length ||
          sessions().length ||
          Object.keys(reflections()).length ||
          Object.keys(reflectionHistory()).length
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
        b.data[k]
          ? JSON.parse(b.data[k])
          : null;

      const incomingClasses =
        parsed(K.classes) || [];

      const incomingSessions =
        parsed(K.sessions) || [];

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
            x.name.toLowerCase() ===
            c.name.toLowerCase()
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
          C.number(
            mergedSessions[i].totalSeconds
          )
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

      const importedHistory =
        parsed(K.history) || {};

      if (
        !importedHistory ||
        Array.isArray(importedHistory) ||
        typeof importedHistory !== "object"
      ) {
        throw new Error(
          "Invalid check-in history in backup."
        );
      }

      const mergedHistory =
        reflectionHistory();

      [
        ...Object.values(importedHistory),
        ...Object.values(reflections()),
        ...Object.values(mergedRefs)
      ].forEach(r => {
        if (
          r &&
          r.className &&
          C.validDate(r.weekStart) &&
          r.timestamp
        ) {
          mergedHistory[
            StudyFollowup.historyId(r)
          ] = r;
        }
      });

      // Preserve a pre-restore copy before changing local records.
      write(
        "studySystem.beforeRestore.v1",
        backupData()
      );

      write(K.classes, mergedClasses);
      write(K.sessions, mergedSessions);
      write(K.history, mergedHistory);
      write(K.reflections, mergedRefs);

      if (oldId) {
        rawWrite(K.device, oldId);
      }

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
        const start =
          localStorage.getItem(K.start);

        rawWrite(
          K.start,

          start && start < b.data[K.start]
            ? start
            : b.data[K.start]
        );
      }

      mergedSessions
        .filter(r => r.id)
        .forEach(queueStage);

      Object.values(mergedHistory)
        .filter(r =>
          r.revisionId &&
          r.recommendation &&
          r.snapshot
        )
        .forEach(queueReflection);

      message(
        "Backup merged. Your existing records were retained."
      );

      render();

    } catch (err) {
      message(err.message);
    }

    e.target.value = "";
  };

  // ==================================================
  // STARTUP AND INTERRUPTED-WRITE RECOVERY
  // ==================================================

  function init() {
    const versionLabel =
      document.getElementById("coachVersion");

    if (versionLabel) {
      versionLabel.textContent =
        "Learning-first coaching · " +
        CoachRules.version;
    }

    classes();
    sessions();
    reflections();
    reflectionHistory();

    const latest = reflections();
    let repaired = false;

    Object.values(
      reflectionHistory()
    ).forEach(r => {
      if (
        !r ||
        !r.className ||
        !C.validDate(r.weekStart) ||
        !r.timestamp ||
        (
          r.ownerDeviceId &&
          localStorage.getItem(K.device) &&
          r.ownerDeviceId !==
            localStorage.getItem(K.device)
        )
      ) {
        return;
      }

      const k = C.key(
        r.weekStart,
        r.className
      );

      if (
        !latest[k] ||
        r.timestamp > latest[k].timestamp
      ) {
        latest[k] = r;
        repaired = true;
      }
    });

    if (repaired) {
      write(K.reflections, latest);
    }

    if (!localStorage.getItem(K.backup)) {
      try {
        write(
          K.backup,
          backupData()
        );

      } catch (e) {
        message(
          "Automatic backup could not be made. " +
          "Use Backup → Export before continuing."
        );
      }
    }

    deviceId();

    if (!localStorage.getItem(K.start)) {
      rawWrite(
        K.start,
        C.weekStart(today())
      );
    }

    active = read(K.active, null);

    if (active) {
      if (active.runningSince !== null) {
        active.ms += Math.max(
          0,

          (
            active.lastSeen ||
            active.runningSince
          ) -
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

    sessions()
      .filter(r => r.id)
      .forEach(queueStage);

    historyList()
      .filter(r =>
        r.revisionId &&
        r.recommendation &&
        r.snapshot
      )
      .forEach(queueReflection);

    syncQueue();
  }

  // ==================================================
  // BUTTON ACTIONS
  // ==================================================

  document.addEventListener(
    "click",
    safe(e => {
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
        chosenClass =
          classes()[Number(b.dataset.class)];

        visitId = uid();

        chosenStage = launchAnki
          ? 3
          : null;

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
        chosenStage =
          Number(b.dataset.stage);

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

        list.splice(
          Number(b.dataset.remove),
          1
        );

        write(K.classes, list);
        render();
        return;
      }

      if (b.dataset.period) {
        periodKind =
          b.dataset.period;

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
        if (dialog.open) {
          dialog.close();
        }

        reminderDismissed = true;

        chosenClass = classes().find(c =>
          c.name === b.dataset.coachClass
        ) || {
          name: b.dataset.coachClass,
          subject: ""
        };

        visitId = uid();

        chosenStage = Number(
          b.dataset.coachStage
        );

        screen = "stage";
        render();
        return;
      }

      switch (b.dataset.action) {
        case "add-class": {
          const subject =
            $("subject").value;

          const course =
            $("course").value;

          const name = course.startsWith("Other")
            ? $("custom").value.trim()
            : course;

          if (!subject || !name) {
            message(
              "Choose a subject and class."
            );
            return;
          }

          const list = classes();

          if (!list.some(c =>
            c.name.toLowerCase() ===
            name.toLowerCase()
          )) {
            list.push({
              name,
              subject
            });
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
          rawWrite(
            K.ankiHide + today(),
            "1"
          );

          render();
          break;

        case "toggle-timer":
          if (active.runningSince !== null) {
            pause();

          } else {
            active.runningSince = Date.now();

            if (!active.startedAt) {
              active.startedAt =
                new Date().toISOString();
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
    })
  );

  $("syncNow").onclick = () => {
    syncQueue(true);
  };

  window.addEventListener(
    "online",
    () => syncQueue(true)
  );

  document.addEventListener(
    "visibilitychange",
    safe(() => {
      if (
        document.visibilityState === "hidden"
      ) {
        if (active) {
          saveActive();
        }

      } else {
        reminderDismissed = false;

        if (screen === "home") {
          render();
        }

        syncQueue();
      }
    })
  );

  window.addEventListener(
    "pagehide",
    safe(() => {
      if (active) {
        saveActive();
      }
    })
  );

  setInterval(
    safe(() => {
      if (active) {
        if ($("clock")) {
          $("clock").textContent =
            time(elapsed() / 1000);
        }

        if (
          Date.now() - lastCheckpoint > 5000
        ) {
          saveActive();
          lastCheckpoint = Date.now();
        }
      }

      if (lastDay !== today()) {
        lastDay = today();
        reminderDismissed = false;

        if (
          !active &&
          !dialog.open
        ) {
          render();
        }
      }
    }),
    1000
  );

  setInterval(
    () => syncQueue(),
    15000
  );

  window.addEventListener(
    "storage",
    safe(e => {
      if (
        [
          K.classes,
          K.sessions,
          K.reflections
        ].includes(e.key) &&
        !active &&
        !dialog.open
      ) {
        render();
      }
    })
  );

  try {
    init();

  } catch (err) {
    root.innerHTML =
      '<section class="card">' +
      "<h2>Your saved data needs attention</h2><p>" +
      esc(err.message) +
      "</p>" +

      '<button class="primary" data-action="export">' +
      "Export a recovery backup</button></section>";

    message("Nothing has been erased.");
  }
})();
