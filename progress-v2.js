(() => {
  "use strict";

  /*
    STUDY SYSTEM — FOCUSED PROGRESS VIEW
    Version: focused-progress-20261016-4

    DATA SAFETY
    - Reads existing Study System records.
    - Does not rename, migrate, delete, or replace student data.
    - app.js still owns saving, recovery, timers, check-ins,
      Study Log, Google sync, and backups.
    - Removing this file returns the original Progress page.

    STUDENT VIEW
    - This Week
    - Last Week
    - This Month
    - Prior Month
    - Actual time above allocation graph
    - One interpretation
    - One next step
    - Distinguishes "study more" from "study differently"
    - Visual progress snapshot for sharing/email
  */

  if (
    typeof StudyCoach === "undefined" ||
    typeof StudyFollowup === "undefined" ||
    typeof StudyMonthly === "undefined" ||
    typeof CoachRules === "undefined"
  ) {
    return;
  }

  const C = StudyCoach;
  const BUILD = "focused-progress-20261016-4";

  const K = {
    classes: "studySystem.classes.v4",
    sessions: "studySystem.sessions.v4",
    device: "studySystem.deviceId.v4",
    reflections: "studySystem.weeklyReflections.v1",
    history: "studySystem.reflectionHistory.v1"
  };

  const PERIODS = {
    "this-week": "This Week",
    "last-week": "Last Week",
    "this-month": "This Month",
    "prior-month": "Prior Month"
  };

  const TEST_METHODS = [
    "Practice Test",
    "AI Practice Test",
    "Practice Problems",
    "Homework as Test"
  ];

  const VERDICTS = {
    keep: {
      label: "KEEP THIS APPROACH",
      tone: "keep",
      order: 4
    },

    test: {
      label: "KEEP TESTING THIS ADJUSTMENT",
      tone: "test",
      order: 3
    },

    try: {
      label: "KEEP TESTING THIS ADJUSTMENT",
      tone: "test",
      order: 3
    },

    change: {
      label: "CHANGE ONE THING",
      tone: "change",
      order: 1
    },

    unknown: {
      label: "NOT ENOUGH INFORMATION YET",
      tone: "neutral",
      order: 5
    },

    checkin: {
      label: "CHECK-IN NEEDED",
      tone: "add",
      order: 2
    },

    start: {
      label: "ADD A SESSION",
      tone: "add",
      order: 2
    },

    session: {
      label: "ADD ANOTHER SESSION",
      tone: "add",
      order: 2
    }
  };

  const root = document.getElementById("appRoot");

  if (!root) {
    return;
  }

  let selectedPeriod = "this-week";
  let rendering = false;
  let renderQueued = false;

  const displayedCards = new Map();


  // =====================================================
  // READ EXISTING STUDENT DATA
  // =====================================================

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);

      return raw === null
        ? fallback
        : JSON.parse(raw);

    } catch (error) {
      return fallback;
    }
  }

  function objectOrEmpty(value) {
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    )
      ? value
      : {};
  }

  function owner() {
    return String(
      localStorage.getItem(K.device) || ""
    );
  }

  function sessions() {
    const value = readJson(
      K.sessions,
      []
    );

    return Array.isArray(value)
      ? value
      : [];
  }

  function savedClasses() {
    const value = readJson(
      K.classes,
      []
    );

    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      item =>
        item &&
        typeof item.name === "string" &&
        item.name.trim()
    );
  }

  function currentReflections() {
    return objectOrEmpty(
      readJson(
        K.reflections,
        {}
      )
    );
  }

  function historyList() {
    const map = new Map();

    [
      ...Object.values(
        objectOrEmpty(
          readJson(
            K.history,
            {}
          )
        )
      ),

      ...Object.values(
        currentReflections()
      )

    ].forEach(record => {

      if (
        record &&
        typeof record.className === "string" &&
        C.validDate(record.weekStart) &&
        record.timestamp
      ) {
        map.set(
          StudyFollowup.historyId(record),
          record
        );
      }
    });

    return [...map.values()];
  }

  function latestChecks(className) {
    const me = owner();
    const newest = new Map();

    historyList().forEach(record => {

      if (
        record.className !== className ||
        !C.validDate(record.weekStart)
      ) {
        return;
      }

      if (
        record.ownerDeviceId &&
        me &&
        record.ownerDeviceId !== me
      ) {
        return;
      }

      if (
        CoachRules.rate(
          record.learningRating
        ) === null
      ) {
        return;
      }

      const previous =
        newest.get(
          record.weekStart
        );

      if (
        !previous ||
        String(record.timestamp) >
          String(previous.timestamp)
      ) {
        newest.set(
          record.weekStart,
          record
        );
      }
    });

    return [...newest.values()]
      .sort(
        (a, b) =>
          a.weekStart.localeCompare(
            b.weekStart
          )
      );
  }

  function rowsBetween(
    start,
    end,
    className = ""
  ) {
    return sessions()
      .filter(row => {

        const day =
          C.localDay(row);

        return (
          day &&
          day >= start &&
          day < end &&
          (
            !className ||
            row.className === className
          )
        );
      });
  }

  function rowsForWeek(
    className,
    weekStart
  ) {
    return rowsBetween(
      weekStart,
      C.addDays(
        weekStart,
        7
      ),
      className
    );
  }


  // =====================================================
  // FORMATTING
  // =====================================================

  function escapeHtml(value) {
    return String(
      value ?? ""
    ).replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]
    );
  }

  function human(seconds) {
    const amount =
      Math.max(
        0,
        C.number(seconds)
      );

    if (
      amount > 0 &&
      amount < 60
    ) {
      return "<1 min";
    }

    const minutes =
      Math.round(
        amount / 60
      );

    if (minutes < 60) {
      return minutes + " min";
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    const rest =
      minutes % 60;

    return rest
      ? hours + " hr " + rest + " min"
      : hours + " hr";
  }

  function prettyDate(
    key,
    year = false
  ) {
    if (!C.validDate(key)) {
      return key;
    }

    return new Date(
      key + "T12:00:00Z"
    ).toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",

        ...(year
          ? { year: "numeric" }
          : {})
      }
    );
  }

  function rangeLabel(
    start,
    endExclusive
  ) {
    const end =
      C.addDays(
        endExclusive,
        -1
      );

    const differentYear =
      start.slice(0, 4) !==
      end.slice(0, 4);

    return (
      prettyDate(
        start,
        differentYear
      ) +
      "–" +
      prettyDate(
        end,
        true
      )
    );
  }

  function monthLabel(start) {
    return new Date(
      start + "T12:00:00Z"
    ).toLocaleDateString(
      undefined,
      {
        month: "long",
        year: "numeric"
      }
    );
  }

  function previousMonth(key) {
    const date =
      new Date(
        C.monthStart(key) +
        "T12:00:00Z"
      );

    date.setUTCMonth(
      date.getUTCMonth() - 1
    );

    return date
      .toISOString()
      .slice(0, 10);
  }

  function median(values) {
    const sorted =
      values
        .map(Number)
        .filter(
          value =>
            Number.isFinite(value) &&
            value > 0
        )
        .sort(
          (a, b) =>
            a - b
        );

    if (!sorted.length) {
      return null;
    }

    const middle =
      Math.floor(
        sorted.length / 2
      );

    return sorted.length % 2
      ? sorted[middle]
      : (
        sorted[middle - 1] +
        sorted[middle]
      ) / 2;
  }

  function safeFilename(value) {
    return String(
      value || "progress"
    )
      .replace(
        /[^a-z0-9]+/gi,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(
        0,
        60
      )
      .toLowerCase();
  }


  // =====================================================
  // TIME PERIODS
  // =====================================================

  function periodBounds(kind) {
    const now =
      C.dateKey();

    const week =
      C.weekStart(now);

    const month =
      C.monthStart(now);


    if (kind === "last-week") {
      const start =
        C.addDays(
          week,
          -7
        );

      return {
        kind,
        title: "Last Week",
        start,
        end: week,

        dates:
          rangeLabel(
            start,
            week
          )
      };
    }


    if (kind === "this-month") {
      return {
        kind,
        title: "This Month",
        start: month,

        end:
          C.nextMonth(month),

        dates:
          monthLabel(month)
      };
    }


    if (kind === "prior-month") {
      const start =
        previousMonth(month);

      return {
        kind,
        title: "Prior Month",
        start,
        end: month,

        dates:
          monthLabel(start)
      };
    }


    const end =
      C.addDays(
        week,
        7
      );

    return {
      kind: "this-week",
      title: "This Week",
      start: week,
      end,

      dates:
        rangeLabel(
          week,
          end
        )
    };
  }


  // =====================================================
  // COACHING HELPERS
  // =====================================================

  function verdict(
    key,
    interpretation,
    next,
    stage = 0,
    extra = {}
  ) {
    return Object.assign(
      {},
      VERDICTS[key] ||
        VERDICTS.unknown,

      {
        key,
        interpretation,
        next,
        stage
      },

      extra
    );
  }

  function rating(record) {
    return record
      ? CoachRules.rate(
          record.learningRating
        )
      : null;
  }

  function assessment(record) {
    return record
      ? CoachRules.assessment(record)
      : null;
  }

  function isStrong(record) {
    return CoachRules.strong(record);
  }

  function isConcern(record) {
    return CoachRules.concerns(record);
  }

  function followupFor(record) {
    const saved =
      record.followup ||
      (
        record.snapshot &&
        record.snapshot.keepAdjust
      );

    if (
      saved &&
      saved.version ===
        CoachRules.version &&
      saved.next
    ) {
      return saved;
    }

    if (record.snapshot) {
      try {
        return StudyFollowup.evaluate(
          record,
          historyList()
        );

      } catch (error) {
      }
    }

    return (
      saved &&
      saved.next
    )
      ? saved
      : null;
  }

  function snapshotFor(rows) {
    const snapshot =
      C.summarize(rows);

    snapshot.behaviorEvidence =
      StudyFollowup.evidence(
        rows
      );

    return snapshot;
  }

  function stageOf(advice) {
    return advice
      ? (
        Number(
          advice.targetStage
        ) || 2
      )
      : 0;
  }

  function visitCount(rows) {
    return new Set(
      rows
        .filter(
          row => row.visitId
        )
        .map(
          row => row.visitId
        )
    ).size;
  }

  function retrievalCrosscheckRounds(rows) {
    const checked =
      rows.filter(
        row =>
          Number(row.stage) === 2 &&
          C.number(
            row.studySeconds
          ) > 0 &&
          C.number(
            row.crosscheckSeconds
          ) > 0
      );

    const visitIds =
      new Set(
        checked
          .filter(
            row => row.visitId
          )
          .map(
            row => row.visitId
          )
      );

    if (visitIds.size) {
      return visitIds.size;
    }

    return new Set(
      checked
        .map(
          row =>
            C.localDay(row)
        )
        .filter(Boolean)
    ).size;
  }

  function stageSeconds(
    summary,
    stage
  ) {
    return C.number(
      summary &&
      summary.stages &&
      summary.stages[stage] &&
      summary.stages[stage].seconds
    );
  }

  function crossSeconds(summary) {
    return C.number(
      summary &&
      summary.crossSeconds
    );
  }

  function usefulSequence(summary) {
    return (
      stageSeconds(
        summary,
        2
      ) > 0 &&

      crossSeconds(
        summary
      ) > 0 &&

      stageSeconds(
        summary,
        3
      ) > 0
    );
  }

  function hasTestLikeAssess(summary) {
    const methods =
      summary &&
      summary.stages &&
      summary.stages[3] &&
      summary.stages[3].methods

        ? summary.stages[3].methods
        : {};

    return Object.entries(
      methods
    ).some(
      ([name, data]) =>
        TEST_METHODS.includes(name) &&
        (
          C.number(
            data &&
            data.count
          ) > 0 ||

          C.number(
            data &&
            data.seconds
          ) > 0
        )
    );
  }

  function summaryForCheck(record) {
    const rows =
      rowsForWeek(
        record.className,
        record.weekStart
      );

    if (rows.length) {
      return C.summarize(rows);
    }

    if (
      record.snapshot &&
      typeof record.snapshot ===
        "object"
    ) {
      return record.snapshot;
    }

    return null;
  }


  // =====================================================
  // PERSONAL PRACTICE-AMOUNT CHECK
  // =====================================================

  function successfulDoseHistory(
    className,
    beforeWeek
  ) {
    return latestChecks(
      className
    )
      .filter(
        record =>
          record.weekStart <
            beforeWeek &&
          isStrong(record)
      )

      .map(record => {

        const summary =
          summaryForCheck(record);

        if (!summary) {
          return null;
        }

        const rows =
          rowsForWeek(
            className,
            record.weekStart
          );

        return {
          weekStart:
            record.weekStart,

          seconds:
            C.number(
              summary.seconds
            ),

          visits:
            rows.length
              ? visitCount(rows)
              : 0,

          days:
            Array.isArray(
              summary.days
            )
              ? summary.days.length
              : 0
        };
      })

      .filter(
        item =>
          item &&
          item.seconds > 0
      );
  }

  function doseSignal(
    className,
    record,
    summary,
    rows
  ) {
    if (
      !record ||
      !isConcern(record) ||
      !usefulSequence(summary)
    ) {
      return null;
    }

    const learning =
      rating(record);

    const assess =
      assessment(record);

    if (
      learning !== null &&
      learning >= 4 &&
      assess !== null &&
      assess <= 2 &&
      !hasTestLikeAssess(summary)
    ) {
      return null;
    }

    const history =
      successfulDoseHistory(
        className,
        record.weekStart
      );

    const currentSeconds =
      C.number(
        summary.seconds
      );

    const currentVisits =
      visitCount(rows);

    const currentDays =
      Array.isArray(
        summary.days
      )
        ? summary.days.length
        : 0;

    if (history.length) {
      const baselineSeconds =
        median(
          history.map(
            item => item.seconds
          )
        );

      const baselineVisits =
        median(
          history
            .map(
              item => item.visits
            )
            .filter(
              value => value > 0
            )
        );

      const baselineDays =
        median(
          history
            .map(
              item => item.days
            )
            .filter(
              value => value > 0
            )
        );

      const timeFactor =
        history.length >= 2
          ? 0.70
          : 0.60;

      const muchLessTime =
        Boolean(
          baselineSeconds &&
          currentSeconds > 0 &&
          currentSeconds <
            baselineSeconds *
            timeFactor
        );

      const fewerVisits =
        Boolean(
          baselineVisits &&
          currentVisits > 0 &&
          currentVisits <
            Math.max(
              1,
              Math.floor(
                baselineVisits
              )
            )
        );

      const fewerDays =
        Boolean(
          baselineDays &&
          currentDays > 0 &&
          currentDays <
            Math.max(
              1,
              Math.floor(
                baselineDays
              )
            )
        );

      if (
        muchLessTime ||
        fewerVisits ||
        fewerDays
      ) {
        return {
          kind:
            "personal-baseline",

          baselineSeconds
        };
      }
    }

    const oneVisit =
      currentVisits === 1;

    const oneDay =
      currentDays === 1;

    if (
      !history.length &&
      (
        oneVisit ||
        (
          currentVisits === 0 &&
          oneDay
        )
      )
    ) {
      return {
        kind:
          "one-round",

        baselineSeconds:
          null
      };
    }

    return null;
  }

  function doseVerdict(
    className,
    record,
    summary,
    rows
  ) {
    const signal =
      doseSignal(
        className,
        record,
        summary,
        rows
      );

    if (!signal) {
      return null;
    }

    const learning =
      rating(record);

    const assess =
      assessment(record);

    const interpretation =
      signal.kind ===
        "personal-baseline"

        ? (
          "Your study pattern includes the useful stages, " +
          "but you practiced less than in your own weeks that went well."
        )

        : (
          "You used Retrieval, Crosscheck, and Assess, " +
          "but this was only one practice round. " +
          "Try more practice before changing the whole approach."
        );

    if (
      assess !== null &&
      assess <= 2 &&
      learning !== null &&
      learning >= 3
    ) {
      return verdict(
        "session",

        interpretation,

        (
          "Add one more Retrieval → Crosscheck round, " +
          "then finish with Practice Problems or a Practice Test " +
          "before changing your whole approach."
        ),

        2,

        {
          focus:
            "session"
        }
      );
    }

    return verdict(
      "session",

      interpretation,

      (
        "Add one more Retrieval → Crosscheck session, " +
        "then Assess again before changing your whole approach."
      ),

      2,

      {
        focus:
          "session"
      }
    );
  }


  // =====================================================
  // COMPLETED WEEK COACHING
  // =====================================================

  function completedWeekCoach(
    className,
    record,
    summary,
    rows
  ) {
    if (!record) {
      if (!summary.seconds) {
        return verdict(
          "start",

          "No study time was recorded for this class.",

          "Start one short session: Retrieval from memory, then Crosscheck.",

          2,

          {
            focus:
              "session"
          }
        );
      }

      return verdict(
        "checkin",

        (
          "You studied " +
          human(
            summary.seconds
          ) +
          ", but you haven't rated how it went."
        ),

        "Answer the two-question check-in to get your next step.",

        0,

        {
          needsCheckIn:
            true
        }
      );
    }

    if (isStrong(record)) {
      return verdict(
        "keep",

        (
          "Your results were strong. " +
          "Your current study pattern does not need to be made more even."
        ),

        "Continue the same approach in your next study week.",

        0,

        {
          focus:
            "maintain"
        }
      );
    }

    const dose =
      doseVerdict(
        className,
        record,
        summary,
        rows
      );

    if (dose) {
      return dose;
    }

    const followup =
      followupFor(record);

    if (!followup) {
      return verdict(
        "unknown",

        (
          "Your check-in is saved, " +
          "but there isn't enough recorded study to judge it."
        ),

        (
          "Log your next study sessions, " +
          "then check in again."
        ),

        0
      );
    }

    const advice =
      StudyFollowup.normalize(
        followup.next
      );

    return verdict(
      followup.decision ||
        "test",

      followup.title,

      advice.text ||
        advice.action,

      stageOf(advice),

      {
        focus:
          advice.focus ||
          followup.target ||
          ""
      }
    );
  }


  // =====================================================
  // THIS WEEK
  // =====================================================

  function targetVisible(
    rows,
    advice
  ) {
    if (
      !rows.length ||
      !advice
    ) {
      return false;
    }

    if (
      advice.focus ===
      "unobservable"
    ) {
      return false;
    }

    try {
      return StudyFollowup
        .metric(
          snapshotFor(rows),
          advice.focus
        )
        .visible;

    } catch (error) {
      return false;
    }
  }

  function thisWeekCoach(
    className,
    bounds,
    rows,
    summary
  ) {
    const prior =
      latestChecks(className)
        .filter(
          record =>
            record.weekStart <
              bounds.start
        )
        .pop() ||
      null;

    if (!prior) {
      const first =
        CoachRules.recommend(
          summary
        );

      if (!summary.seconds) {
        return verdict(
          "start",

          "Nothing is logged for this class yet this week.",

          (
            "Start one session. Use Learn only as needed, " +
            "then Retrieval → Crosscheck to find what still needs work."
          ),

          2,

          {
            focus:
              "session"
          }
        );
      }

      const normalized =
        StudyFollowup.normalize(
          first
        );

      return verdict(
        "test",

        (
          "You've started this week. " +
          "Your first completed check-in will show what is working."
        ),

        first.text,

        stageOf(first),

        {
          focus:
            normalized.focus
        }
      );
    }

    const priorRows =
      rowsForWeek(
        className,
        prior.weekStart
      );

    const priorSummary =
      priorRows.length

        ? C.summarize(
            priorRows
          )

        : (
          prior.snapshot ||
          C.summarize([])
        );

    const priorCoach =
      completedWeekCoach(
        className,
        prior,
        priorSummary,
        priorRows
      );

    if (
      priorCoach.key ===
      "keep"
    ) {
      return verdict(
        "keep",

        "Your most recent completed results were strong.",

        "Continue the same study pattern this week.",

        0,

        {
          focus:
            "maintain"
        }
      );
    }

    if (
      priorCoach.key ===
      "session"
    ) {
      const priorRounds =
        retrievalCrosscheckRounds(
          priorRows
        );

      const currentRounds =
        retrievalCrosscheckRounds(
          rows
        );

      const targetRounds =
        Math.max(
          2,
          priorRounds + 1
        );

      if (
        currentRounds >=
        targetRounds
      ) {
        return verdict(
          "test",

          (
            "You have added the extra Retrieval → Crosscheck " +
            "practice this week."
          ),

          (
            "Keep this amount of practice until your next check-in " +
            "before changing the approach."
          ),

          0,

          {
            focus:
              "session"
          }
        );
      }

      return verdict(
        "session",

        (
          "Your last completed result suggests the stage pattern " +
          "may be useful, but it needs another practice round."
        ),

        priorCoach.next,

        2,

        {
          focus:
            "session"
        }
      );
    }

    const followup =
      followupFor(prior);

    if (!followup) {
      return verdict(
        "unknown",

        (
          "Your last check-in does not have enough " +
          "recorded study to judge it."
        ),

        "Study this week and complete your next check-in.",

        0
      );
    }

    const advice =
      StudyFollowup.normalize(
        followup.next
      );

    if (
      targetVisible(
        rows,
        advice
      )
    ) {
      return verdict(
        "test",

        "You are already doing the suggested adjustment this week.",

        (
          "Keep testing it until your next check-in. " +
          "Do not add another major change yet."
        ),

        0,

        {
          focus:
            advice.focus
        }
      );
    }

    return verdict(
      priorCoach.key,

      (
        "Your last completed week suggests this is still " +
        "the most useful adjustment."
      ),

      priorCoach.next,

      priorCoach.stage,

      {
        focus:
          advice.focus
      }
    );
  }


  // =====================================================
  // MONTHLY VIEW
  // =====================================================

  function monthCoach(
    className,
    bounds,
    summary
  ) {
    const review =
      StudyMonthly.review(
        className,
        bounds.start,
        C.dateKey(),
        currentReflections(),
        historyList(),
        owner()
      );

    if (!review.rated) {
      if (!summary.seconds) {
        return verdict(
          "start",

          (
            "No study time or completed check-in is recorded " +
            "for this class in this month."
          ),

          (
            "Start one short session: " +
            "Retrieval from memory, then Crosscheck."
          ),

          2,

          {
            focus:
              "session"
          }
        );
      }

      return verdict(
        "checkin",

        (
          "Study time is recorded, but there is not a completed " +
          "weekly check-in in this month yet."
        ),

        (
          "Complete your next weekly check-in so the app can judge " +
          "whether this pattern is working."
        ),

        0
      );
    }

    const latest =
      review.latest ||
      null;

    if (
      latest &&
      isConcern(latest)
    ) {
      const latestRows =
        rowsForWeek(
          className,
          latest.weekStart
        );

      const latestSummary =
        latestRows.length

          ? C.summarize(
              latestRows
            )

          : (
            latest.snapshot ||
            null
          );

      if (latestSummary) {
        const dose =
          doseVerdict(
            className,
            latest,
            latestSummary,
            latestRows
          );

        if (dose) {
          return dose;
        }
      }
    }

    const advice =
      review.advice

        ? StudyFollowup.normalize(
            review.advice
          )

        : null;

    if (
      review.verdict ===
      "keep"
    ) {
      return verdict(
        "keep",

        (
          "Your recent results in this month are strong enough " +
          "to keep the current approach."
        ),

        "Continue the same approach into the next study week.",

        0,

        {
          focus:
            "maintain"
        }
      );
    }

    if (
      review.verdict ===
      "unknown"
    ) {
      return verdict(
        "unknown",

        review.title,

        advice
          ? (
            advice.text ||
            advice.action
          )

          : (
            "Keep studying and use your next weekly check-in " +
            "to decide what to change."
          ),

        0,

        {
          focus:
            advice
              ? advice.focus
              : ""
        }
      );
    }

    return verdict(
      review.verdict ||
        "test",

      review.title,

      advice
        ? (
          advice.text ||
          advice.action
        )

        : (
          "Keep one useful adjustment long enough to judge it."
        ),

      stageOf(advice),

      {
        focus:
          advice
            ? advice.focus
            : ""
      }
    );
  }


  // =====================================================
  // ONE CLASS CARD
  // =====================================================

  function cardData(
    className,
    bounds
  ) {
    const rows =
      rowsBetween(
        bounds.start,
        bounds.end,
        className
      );

    const summary =
      C.summarize(rows);

    let coach;

    if (
      bounds.kind ===
      "this-week"
    ) {
      coach =
        thisWeekCoach(
          className,
          bounds,
          rows,
          summary
        );
    }

    else if (
      bounds.kind ===
      "last-week"
    ) {
      const record =
        latestChecks(className)
          .find(
            item =>
              item.weekStart ===
              bounds.start
          ) ||
        null;

      coach =
        completedWeekCoach(
          className,
          record,
          summary,
          rows
        );
    }

    else {
      coach =
        monthCoach(
          className,
          bounds,
          summary
        );
    }

    return {
      className,
      bounds,
      rows,
      summary,
      coach
    };
  }

  function classNamesForPeriod(
    bounds
  ) {
    const names =
      new Set();

    rowsBetween(
      bounds.start,
      bounds.end
    ).forEach(row => {

      if (row.className) {
        names.add(
          row.className
        );
      }
    });

    if (
      bounds.kind ===
        "this-week" ||
      bounds.kind ===
        "last-week"
    ) {
      savedClasses()
        .forEach(item => {

          names.add(
            item.name
          );
        });
    }

    if (
      bounds.kind ===
      "last-week"
    ) {
      historyList()
        .forEach(record => {

          if (
            record.weekStart ===
            bounds.start
          ) {
            names.add(
              record.className
            );
          }
        });
    }

    else if (
      bounds.kind !==
      "this-week"
    ) {
      historyList()
        .forEach(record => {

          const sunday =
            C.addDays(
              record.weekStart,
              6
            );

          if (
            sunday >=
              bounds.start &&
            sunday <
              bounds.end
          ) {
            names.add(
              record.className
            );
          }
        });
    }

    return [
      ...names
    ];
  }


  // =====================================================
  // GRAPH
  // =====================================================

  function graphParts(
    summary
  ) {
    return [
      {
        css: "learn",
        name: "Learn",

        seconds:
          stageSeconds(
            summary,
            1
          )
      },

      {
        css: "retrieval",
        name: "Retrieval",

        seconds:
          stageSeconds(
            summary,
            2
          )
      },

      {
        css: "crosscheck",
        name: "↳ Crosscheck",

        seconds:
          crossSeconds(
            summary
          )
      },

      {
        css: "assess",
        name: "Assess",

        seconds:
          stageSeconds(
            summary,
            3
          )
      }
    ];
  }

  function graphHtml(
    summary
  ) {
    const parts =
      graphParts(
        summary
      );

    const total =
      parts.reduce(
        (sum, part) =>
          sum +
          part.seconds,

        0
      );

    const times =
      parts.map(
        part =>

          '<div class="fp-time fp-' +
          part.css +
          '">' +

            '<strong>' +
              escapeHtml(
                human(
                  part.seconds
                )
              ) +
            '</strong>' +

            '<span>' +
              escapeHtml(
                part.name
              ) +
            '</span>' +

          '</div>'

      ).join("");

    const segments =
      total

        ? parts.map(
            part =>

              '<i class="fp-segment fp-' +
              part.css +
              '" style="width:' +

              (
                part.seconds /
                total *
                100
              ).toFixed(3) +

              '%"></i>'

          ).join("")

        : (
          '<i class="fp-empty"></i>'
        );

    const aria =
      parts
        .map(
          part =>
            part.name.replace(
              "↳ ",
              ""
            ) +
            " " +
            human(
              part.seconds
            )
        )
        .join(
          ", "
        );

    return (
      '<div class="fp-times">' +
        times +
      '</div>' +

      '<div class="fp-bar" role="img" aria-label="' +
        escapeHtml(
          aria
        ) +
      '">' +

        segments +

      '</div>'
    );
  }


  // =====================================================
  // ACTION BUTTON RULES
  // =====================================================

  function shouldShowStartButton(
    coach
  ) {
    if (
      !coach ||
      !coach.stage
    ) {
      return false;
    }

    if (
      coach.key ===
        "keep" ||
      coach.key ===
        "unknown" ||
      coach.key ===
        "checkin"
    ) {
      return false;
    }

    return true;
  }


  // =====================================================
  // CARD HTML
  // =====================================================

  function classCardHtml(
    data
  ) {
    const {
      className,
      bounds,
      summary,
      coach
    } = data;

    const name =
      escapeHtml(
        className
      );

    const startButton =
      shouldShowStartButton(
        coach
      )

        ? (
          '<button ' +
          'type="button" ' +
          'class="primary" ' +

          'data-coach-class="' +
          name +
          '" ' +

          'data-coach-stage="' +
          Number(
            coach.stage
          ) +
          '">' +

          'Start this step →' +

          '</button>'
        )

        : "";

    let checkInButton =
      "";

    if (
      bounds.kind ===
      "last-week"
    ) {
      const existing =
        latestChecks(
          className
        ).some(
          record =>
            record.weekStart ===
            bounds.start
        );

      checkInButton =
        '<button ' +
        'type="button" ' +

        'class="' +
        (
          coach.needsCheckIn
            ? "primary"
            : "secondary"
        ) +
        '" ' +

        'data-reflection-class="' +
        name +
        '" ' +

        'data-week="' +
        escapeHtml(
          bounds.start
        ) +
        '">' +

        (
          coach.needsCheckIn
            ? "Answer check-in"

            : (
              existing
                ? "Update check-in"
                : "Weekly check-in"
            )
        ) +

        '</button>';
    }

    return (
      '<section class="card fp-class-card">' +


        '<div class="fp-card-head">' +

          '<div>' +

            '<h2>' +
              name +
            '</h2>' +

            '<p class="small fp-dates">' +
              escapeHtml(
                bounds.dates
              ) +
            '</p>' +

          '</div>' +


          '<div class="fp-total">' +

            '<span>Total</span>' +

            '<strong>' +
              escapeHtml(
                human(
                  summary.seconds
                )
              ) +
            '</strong>' +

          '</div>' +

        '</div>' +


        graphHtml(
          summary
        ) +


        '<div class="fp-coach fp-' +
        coach.tone +
        '">' +

          '<span class="fp-verdict">' +
            escapeHtml(
              coach.label
            ) +
          '</span>' +

          '<p>' +
            escapeHtml(
              coach.interpretation
            ) +
          '</p>' +

          '<p class="fp-next">' +

            '<strong>Next:</strong> ' +

            escapeHtml(
              coach.next
            ) +

          '</p>' +

        '</div>' +


        '<div class="actions fp-actions">' +

          checkInButton +

          startButton +

          '<button ' +
          'type="button" ' +
          'class="secondary" ' +

          'data-fp-share="' +
          name +
          '">' +

          'Share / email progress' +

          '</button>' +

        '</div>' +


      '</section>'
    );
  }

  function headerHtml(
    bounds
  ) {
    const tabs =
      Object.entries(
        PERIODS
      ).map(
        ([key, label]) =>

          '<button ' +
          'type="button" ' +
          'role="tab" ' +

          'data-fp-period="' +
          key +
          '" ' +

          'aria-selected="' +
          (
            selectedPeriod ===
            key
          ) +
          '" ' +

          'class="' +
          (
            selectedPeriod ===
              key

              ? "fp-tab-active"
              : ""
          ) +
          '">' +

          escapeHtml(
            label
          ) +

          '</button>'

      ).join("");

    return (
      '<section ' +
      'class="card fp-header" ' +

      'data-focused-progress="' +
      BUILD +
      '">' +

        '<h2>' +
          'Progress & next step' +
        '</h2>' +

        '<p class="fp-intro">' +
          'Where your time went, what it means, and what to do next.' +
        '</p>' +

        '<div ' +
        'class="fp-tabs" ' +
        'role="tablist" ' +
        'aria-label="Progress timeframe">' +

          tabs +

        '</div>' +

        '<p class="small fp-period">' +

          '<strong>' +
            escapeHtml(
              bounds.title
            ) +
          ':</strong> ' +

          escapeHtml(
            bounds.dates
          ) +

        '</p>' +

      '</section>'
    );
  }


  // =====================================================
  // RENDER
  // =====================================================

  function originalProgressVisible() {
    return [
      ...root.querySelectorAll(
        "h2"
      )
    ].some(
      element =>
        element.textContent.trim() ===
        "Progress & next steps"
    );
  }

  function focusedProgressVisible() {
    return Boolean(
      root.querySelector(
        "[data-focused-progress]"
      )
    );
  }

  function renderFocused() {
    const bounds =
      periodBounds(
        selectedPeriod
      );

    const cards =
      classNamesForPeriod(
        bounds
      )
        .map(
          name =>
            cardData(
              name,
              bounds
            )
        )

        .sort(
          (a, b) =>
            a.coach.order -
              b.coach.order ||

            a.className.localeCompare(
              b.className
            )
        );

    displayedCards.clear();

    cards.forEach(
      card => {

        displayedCards.set(
          card.className,
          card
        );
      }
    );

    root.innerHTML =
      headerHtml(
        bounds
      ) +

      (
        cards.length

          ? cards
              .map(
                classCardHtml
              )
              .join("")

          : (
            '<section class="card">' +
              '<h2>Nothing to show yet</h2>' +
              '<p>No study time or check-ins are saved for this period.</p>' +
            '</section>'
          )
      );
  }

  function replaceOriginalProgress() {
    if (
      rendering ||
      !originalProgressVisible()
    ) {
      return;
    }

    rendering =
      true;

    try {
      renderFocused();

    } catch (error) {
      console.error(
        error
      );

    } finally {
      rendering =
        false;
    }
  }

  function queueReplacement() {
    if (
      renderQueued
    ) {
      return;
    }

    renderQueued =
      true;

    requestAnimationFrame(
      () => {

        renderQueued =
          false;

        if (
          originalProgressVisible()
        ) {
          replaceOriginalProgress();
        }
      }
    );
  }


  // =====================================================
  // VISUAL SHARE SNAPSHOT
  // =====================================================

  function roundRect(
    context,
    x,
    y,
    width,
    height,
    radius
  ) {
    const r =
      Math.min(
        radius,
        width / 2,
        height / 2
      );

    context.beginPath();

    context.moveTo(
      x + r,
      y
    );

    context.arcTo(
      x + width,
      y,
      x + width,
      y + height,
      r
    );

    context.arcTo(
      x + width,
      y + height,
      x,
      y + height,
      r
    );

    context.arcTo(
      x,
      y + height,
      x,
      y,
      r
    );

    context.arcTo(
      x,
      y,
      x + width,
      y,
      r
    );

    context.closePath();
  }

  function wrapCanvasText(
    context,
    text,
    x,
    y,
    maxWidth,
    lineHeight,
    maxLines = 8
  ) {
    const words =
      String(
        text || ""
      ).split(
        /\s+/
      );

    let line =
      "";

    let lineNumber =
      0;

    for (
      let index = 0;
      index <
      words.length;
      index++
    ) {
      const test =
        line
          ? (
            line +
            " " +
            words[index]
          )
          : words[index];

      const width =
        context
          .measureText(
            test
          )
          .width;

      if (
        width >
          maxWidth &&
        line
      ) {
        context.fillText(
          line,
          x,
          y +
          (
            lineNumber *
            lineHeight
          )
        );

        line =
          words[index];

        lineNumber++;

        if (
          lineNumber >=
          maxLines
        ) {
          break;
        }

      } else {
        line =
          test;
      }
    }

    if (
      line &&
      lineNumber <
        maxLines
    ) {
      context.fillText(
        line,
        x,
        y +
        (
          lineNumber *
          lineHeight
        )
      );

      lineNumber++;
    }

    return (
      lineNumber *
      lineHeight
    );
  }

  function snapshotColors() {
    return {
      background: "#f5f8fb",
      card: "#ffffff",
      dark: "#17344d",
      muted: "#647485",
      border: "#d8e2e9",
      learn: "#2a78d6",
      retrieval: "#eb6834",
      crosscheck: "#6250d6",
      assess: "#1b8f72",
      keep: "#eef8f3",
      test: "#eef4fb",
      change: "#fff4e8",
      add: "#f5f1ff",
      neutral: "#f4f6f8"
    };
  }

  function snapshotToneColor(
    coach,
    colors
  ) {
    if (
      coach.tone ===
      "keep"
    ) {
      return colors.keep;
    }

    if (
      coach.tone ===
      "test"
    ) {
      return colors.test;
    }

    if (
      coach.tone ===
      "change"
    ) {
      return colors.change;
    }

    if (
      coach.tone ===
      "add"
    ) {
      return colors.add;
    }

    return colors.neutral;
  }

  function canvasToBlob(
    canvas
  ) {
    return new Promise(
      (resolve, reject) => {

        canvas.toBlob(
          blob => {

            if (blob) {
              resolve(blob);

            } else {
              reject(
                new Error(
                  "The progress image could not be created."
                )
              );
            }
          },

          "image/png"
        );
      }
    );
  }

  async function createProgressSnapshot(
    data
  ) {
    const colors =
      snapshotColors();

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      1200;

    canvas.height =
      1180;

    const context =
      canvas.getContext(
        "2d"
      );

    if (!context) {
      throw new Error(
        "This browser cannot create the progress image."
      );
    }

    context.fillStyle =
      colors.background;

    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    context.fillStyle =
      colors.card;

    roundRect(
      context,
      70,
      60,
      1060,
      1060,
      34
    );

    context.fill();

    context.strokeStyle =
      colors.border;

    context.lineWidth =
      2;

    context.stroke();

    const left =
      130;

    const right =
      1070;

    context.fillStyle =
      colors.muted;

    context.font =
      "700 28px Arial, sans-serif";

    context.fillText(
      "STUDY SYSTEM",
      left,
      130
    );

    context.fillStyle =
      colors.dark;

    context.font =
      "700 54px Arial, sans-serif";

    context.fillText(
      data.className,
      left,
      200
    );

    context.fillStyle =
      colors.dark;

    context.font =
      "700 31px Arial, sans-serif";

    context.fillText(
      data.bounds.title,
      left,
      255
    );

    context.fillStyle =
      colors.muted;

    context.font =
      "400 27px Arial, sans-serif";

    context.fillText(
      data.bounds.dates,
      left,
      296
    );

    context.textAlign =
      "right";

    context.fillStyle =
      colors.muted;

    context.font =
      "700 22px Arial, sans-serif";

    context.fillText(
      "TOTAL STUDY TIME",
      right,
      150
    );

    context.fillStyle =
      colors.dark;

    context.font =
      "700 43px Arial, sans-serif";

    context.fillText(
      human(
        data.summary.seconds
      ),
      right,
      205
    );

    context.textAlign =
      "left";

    const parts =
      graphParts(
        data.summary
      );

    const usableWidth =
      right -
      left;

    const columnWidth =
      usableWidth /
      4;

    const stageColors = [
      colors.learn,
      colors.retrieval,
      colors.crosscheck,
      colors.assess
    ];

    parts.forEach(
      (part, index) => {

        const center =
          left +
          (
            columnWidth *
            index
          ) +
          (
            columnWidth /
            2
          );

        context.textAlign =
          "center";

        context.fillStyle =
          stageColors[
            index
          ];

        context.font =
          "700 32px Arial, sans-serif";

        context.fillText(
          human(
            part.seconds
          ),
          center,
          385
        );

        context.fillStyle =
          colors.muted;

        context.font =
          "700 22px Arial, sans-serif";

        context.fillText(
          part.name,
          center,
          423
        );
      }
    );

    context.textAlign =
      "left";

    const barX =
      left;

    const barY =
      458;

    const barWidth =
      usableWidth;

    const barHeight =
      32;

    roundRect(
      context,
      barX,
      barY,
      barWidth,
      barHeight,
      16
    );

    context.save();

    context.clip();

    context.fillStyle =
      "#e6edf2";

    context.fillRect(
      barX,
      barY,
      barWidth,
      barHeight
    );

    const graphTotal =
      parts.reduce(
        (sum, part) =>
          sum +
          part.seconds,
        0
      );

    if (
      graphTotal >
      0
    ) {
      let cursor =
        barX;

      parts.forEach(
        (part, index) => {

          const width =
            barWidth *
            (
              part.seconds /
              graphTotal
            );

          context.fillStyle =
            stageColors[
              index
            ];

          context.fillRect(
            cursor,
            barY,
            width,
            barHeight
          );

          cursor +=
            width;
        }
      );
    }

    context.restore();

    const coachY =
      555;

    const coachHeight =
      430;

    context.fillStyle =
      snapshotToneColor(
        data.coach,
        colors
      );

    roundRect(
      context,
      left,
      coachY,
      usableWidth,
      coachHeight,
      26
    );

    context.fill();

    context.fillStyle =
      colors.dark;

    context.font =
      "800 27px Arial, sans-serif";

    context.fillText(
      data.coach.label,
      left + 40,
      coachY + 60
    );

    context.font =
      "400 30px Arial, sans-serif";

    const interpretationHeight =
      wrapCanvasText(
        context,
        data.coach.interpretation,
        left + 40,
        coachY + 120,
        usableWidth - 80,
        42,
        5
      );

    const nextY =
      coachY +
      145 +
      interpretationHeight;

    context.font =
      "700 29px Arial, sans-serif";

    context.fillText(
      "Next:",
      left + 40,
      nextY
    );

    context.font =
      "400 29px Arial, sans-serif";

    wrapCanvasText(
      context,
      data.coach.next,
      left + 40,
      nextY + 45,
      usableWidth - 80,
      41,
      5
    );

    context.fillStyle =
      colors.muted;

    context.font =
      "400 22px Arial, sans-serif";

    context.fillText(
      "Learn → Retrieval → Crosscheck → Assess",
      left,
      1050
    );

    context.textAlign =
      "right";

    context.fillText(
      "Study System",
      right,
      1050
    );

    context.textAlign =
      "left";

    const blob =
      await canvasToBlob(
        canvas
      );

    const filename =
      (
        "study-system-" +
        safeFilename(
          data.className
        ) +
        "-" +
        safeFilename(
          data.bounds.title
        ) +
        ".png"
      );

    return new File(
      [blob],
      filename,
      {
        type:
          "image/png"
      }
    );
  }


  // =====================================================
  // SHARE TEXT
  // =====================================================

  function shareText(
    data
  ) {
    const summary =
      data.summary;

    return [
      (
        "Study System Progress — " +
        data.className
      ),

      (
        data.bounds.title +
        " · " +
        data.bounds.dates
      ),

      "",

      (
        "Total: " +
        human(
          summary.seconds
        )
      ),

      (
        "Learn " +
        human(
          stageSeconds(
            summary,
            1
          )
        ) +

        " · Retrieval " +
        human(
          stageSeconds(
            summary,
            2
          )
        ) +

        " · Crosscheck " +
        human(
          crossSeconds(
            summary
          )
        ) +

        " · Assess " +
        human(
          stageSeconds(
            summary,
            3
          )
        )
      ),

      "",

      data.coach.label,

      data.coach.interpretation,

      (
        "Next: " +
        data.coach.next
      )

    ].join("\n");
  }

  function emailSummary(
    data
  ) {
    const title =
      (
        "Study System Progress — " +
        data.className
      );

    const text =
      shareText(
        data
      );

    window.location.href =
      "mailto:?subject=" +
      encodeURIComponent(
        title
      ) +
      "&body=" +
      encodeURIComponent(
        text
      );
  }


  // =====================================================
  // SHARE / EMAIL
  // =====================================================

  async function shareProgress(
    className
  ) {
    const data =
      displayedCards.get(
        className
      );

    if (!data) {
      return;
    }

    const title =
      (
        "Study System Progress — " +
        className
      );

    const text =
      shareText(
        data
      );

    const message =
      document.getElementById(
        "message"
      );

    if (message) {
      message.textContent =
        "Creating progress snapshot…";
    }

    let imageFile =
      null;

    try {
      imageFile =
        await createProgressSnapshot(
          data
        );

    } catch (error) {
      console.error(
        error
      );
    }

    if (
      imageFile &&
      typeof navigator.share ===
        "function" &&
      typeof navigator.canShare ===
        "function"
    ) {
      const files = [
        imageFile
      ];

      if (
        navigator.canShare({
          files
        })
      ) {
        try {
          await navigator.share({
            title,
            text,
            files
          });

          if (message) {
            message.textContent =
              "";
          }

          return;

        } catch (error) {
          if (
            error &&
            error.name ===
              "AbortError"
          ) {
            if (message) {
              message.textContent =
                "";
            }

            return;
          }
        }
      }
    }

    if (
      typeof navigator.share ===
      "function"
    ) {
      try {
        await navigator.share({
          title,
          text
        });

        if (message) {
          message.textContent =
            "";
        }

        return;

      } catch (error) {
        if (
          error &&
          error.name ===
            "AbortError"
        ) {
          if (message) {
            message.textContent =
              "";
          }

          return;
        }
      }
    }

    if (message) {
      message.textContent =
        "Opening your email with the progress summary…";
    }

    emailSummary(
      data
    );
  }


  // =====================================================
  // EVENTS
  // =====================================================

  document.addEventListener(
    "click",
    event => {

      const tab =
        event.target.closest(
          "[data-fp-period]"
        );

      if (tab) {
        event.preventDefault();

        selectedPeriod =
          tab.dataset.fpPeriod;

        if (
          focusedProgressVisible()
        ) {
          try {
            renderFocused();

          } catch (error) {
            console.error(
              error
            );
          }
        }

        return;
      }

      const share =
        event.target.closest(
          "[data-fp-share]"
        );

      if (share) {
        event.preventDefault();

        shareProgress(
          share.dataset.fpShare
        );
      }
    }
  );


  // =====================================================
  // STYLES
  // =====================================================

  function installStyles() {
    if (
      document.getElementById(
        "focusedProgressStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "focusedProgressStyles";

    style.textContent = `
      :root {
        --fp-learn: #2a78d6;
        --fp-retrieval: #eb6834;
        --fp-crosscheck: #6250d6;
        --fp-assess: #1b8f72;
        --fp-track: #e6edf2;
        --fp-dark: #17344d;
        --fp-muted: #647485;
        --fp-border: #d8e2e9;
        --fp-keep: #eef8f3;
        --fp-test: #eef4fb;
        --fp-change: #fff4e8;
        --fp-add: #f5f1ff;
        --fp-neutral: #f4f6f8;
      }

      .fp-intro {
        max-width: 42rem;
        margin-bottom: 1rem;
      }

      .fp-tabs {
        display: grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );
        gap: .45rem;
        margin: 1rem 0 .7rem;
      }

      .fp-tabs button {
        min-height: 2.7rem;
        padding: .55rem .4rem;
        border:
          1px solid
          var(--fp-border);
        border-radius: .75rem;
        background: #fff;
        color: var(--fp-dark);
        font: inherit;
        font-weight: 750;
        cursor: pointer;
      }

      .fp-tabs button.fp-tab-active {
        background:
          var(--fp-dark);
        border-color:
          var(--fp-dark);
        color: #fff;
      }

      .fp-period {
        margin: .6rem 0 0;
      }

      .fp-card-head {
        display: flex;
        justify-content:
          space-between;
        align-items:
          flex-start;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .fp-card-head h2 {
        margin: 0 0 .15rem;
      }

      .fp-dates {
        margin: 0;
      }

      .fp-total {
        flex: 0 0 auto;
        text-align: right;
      }

      .fp-total span {
        display: block;
        color:
          var(--fp-muted);
        font-size: .72rem;
        font-weight: 800;
        letter-spacing: .06em;
        text-transform: uppercase;
      }

      .fp-total strong {
        display: block;
        margin-top: .1rem;
        color:
          var(--fp-dark);
        font-size: 1.15rem;
      }

      .fp-times {
        display: grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );
        gap: .35rem;
        margin: .25rem 0 .5rem;
      }

      .fp-time {
        min-width: 0;
        text-align: center;
      }

      .fp-time strong {
        display: block;
        font-size: 1rem;
        line-height: 1.15;
      }

      .fp-time span {
        display: block;
        margin-top: .18rem;
        color:
          var(--fp-muted);
        font-size: .72rem;
        font-weight: 750;
        line-height: 1.15;
      }

      .fp-time.fp-learn strong {
        color:
          var(--fp-learn);
      }

      .fp-time.fp-retrieval strong {
        color:
          var(--fp-retrieval);
      }

      .fp-time.fp-crosscheck strong {
        color:
          var(--fp-crosscheck);
      }

      .fp-time.fp-assess strong {
        color:
          var(--fp-assess);
      }

      .fp-bar {
        display: flex;
        width: 100%;
        height: 1.15rem;
        overflow: hidden;
        margin-bottom: 1rem;
        border-radius: 999px;
        background:
          var(--fp-track);
      }

      .fp-segment {
        display: block;
        height: 100%;
      }

      .fp-segment.fp-learn {
        background:
          var(--fp-learn);
      }

      .fp-segment.fp-retrieval {
        background:
          var(--fp-retrieval);
      }

      .fp-segment.fp-crosscheck {
        background:
          var(--fp-crosscheck);
      }

      .fp-segment.fp-assess {
        background:
          var(--fp-assess);
      }

      .fp-empty {
        width: 100%;
        height: 100%;
        background:
          var(--fp-track);
      }

      .fp-coach {
        padding: 1rem 1rem .95rem;
        border:
          1px solid
          var(--fp-border);
        border-radius: .9rem;
      }

      .fp-coach p {
        margin: .45rem 0 0;
      }

      .fp-verdict {
        display: inline-block;
        font-size: .78rem;
        font-weight: 900;
        letter-spacing: .055em;
      }

      .fp-next {
        color:
          var(--fp-dark);
      }

      .fp-keep {
        background:
          var(--fp-keep);
      }

      .fp-test {
        background:
          var(--fp-test);
      }

      .fp-change {
        background:
          var(--fp-change);
      }

      .fp-add {
        background:
          var(--fp-add);
      }

      .fp-neutral {
        background:
          var(--fp-neutral);
      }

      .fp-actions {
        margin-top: .9rem;
      }

      @media (
        max-width: 560px
      ) {
        .fp-tabs {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }

        .fp-times {
          gap: .2rem;
        }

        .fp-time strong {
          font-size: .88rem;
        }

        .fp-time span {
          font-size: .64rem;
        }
      }

      @media (
        max-width: 370px
      ) {
        .fp-time strong {
          font-size: .8rem;
        }

        .fp-time span {
          font-size: .59rem;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }


  // =====================================================
  // WATCH EXISTING APP
  // =====================================================

  installStyles();

  new MutationObserver(
    queueReplacement
  ).observe(
    root,
    {
      childList: true,
      subtree: true
    }
  );

  const version =
    document.getElementById(
      "coachVersion"
    );

  function stampVersion() {
    if (
      version &&
      version.textContent.includes(
        "coaching"
      ) &&
      !version.textContent.includes(
        BUILD
      )
    ) {
      version.textContent +=
        " · " +
        BUILD;
    }
  }

  if (version) {
    new MutationObserver(
      stampVersion
    ).observe(
      version,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );

    stampVersion();
  }

  queueReplacement();

})();
