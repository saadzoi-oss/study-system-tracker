(() => {
  "use strict";

  /*
    STUDY SYSTEM — WEEKLY RHYTHM & PERSONALIZED FOLLOW-UP
    Version: weekly-rhythm-20261017-1

    Keeps all existing classes, sessions, check-ins and revisions.
    Does not write or remove any localStorage key.
    Adds rhythm metadata only to NEW check-in snapshots.
    Uses previous successful weeks as context, never as a quota.
    Leaves app.js, the recovery system, and Google sync untouched.
  */

  if (
    typeof StudyCoach === "undefined" ||
    typeof StudyFollowup === "undefined" ||
    typeof CoachRules === "undefined"
  ) return;

  const C = StudyCoach;
  const F = StudyFollowup;
  const VERSION = "weekly-rhythm-20261017-1";
  const SESSION_KEY = "studySystem.sessions.v4";
  const ROOT = document.getElementById("appRoot");

  if (!ROOT || F.evaluate.__studyRhythmWrapped) return;

  const originalEvaluate = F.evaluate;

  function readSessions() {
    try {
      const rows = JSON.parse(
        localStorage.getItem(SESSION_KEY) || "[]"
      );
      return Array.isArray(rows) ? rows : [];
    } catch (_) {
      return [];
    }
  }

  function validDay(day) {
    return C.validDate(day);
  }

  function weekRows(className, start) {
    const end = C.addDays(start, 7);

    return readSessions().filter(row => {
      const day = C.localDay(row);

      return row &&
        row.className === className &&
        validDay(day) &&
        day >= start &&
        day < end;
    });
  }

  function analyzeRows(rows, start) {
    const days = Array.from(
      { length: 7 },
      (_, i) => ({
        date: C.addDays(start, i),
        seconds: 0,
        checked: 0,
        assessed: 0
      })
    );

    const roundKeys = new Set();

    let retrieval = 0;
    let crosscheck = 0;
    let assess = 0;
    let testPractice = 0;
    let total = 0;

    const testMethods = new Set([
      "Practice Test",
      "AI Practice Test",
      "Practice Problems",
      "Homework as Test"
    ]);

    rows.forEach(row => {
      const date = C.localDay(row);

      if (!validDay(date)) return;

      const index = C.daysBetween(start, date);

      if (index < 0 || index > 6) return;

      const stage = Number(row.stage);

      if (![1, 2, 3].includes(stage)) return;

      const study = C.number(row.studySeconds);

      const cross = stage === 2
        ? C.number(row.crosscheckSeconds)
        : 0;

      if (study + cross <= 0) return;

      days[index].seconds += study + cross;
      total += study + cross;

      if (stage === 2 && study > 0) {
        retrieval++;

        if (cross > 0) {
          crosscheck++;
          days[index].checked++;

          const key = row.visitId
            ? "visit:" + String(row.visitId)
            : "day:" + date;

          roundKeys.add(key);
        }
      }

      if (stage === 3 && study > 0) {
        assess++;
        days[index].assessed++;

        if (testMethods.has(String(row.method))) {
          testPractice++;
        }
      }
    });

    return {
      studyDays: days.filter(
        day => day.seconds > 0
      ).length,

      roundCount: roundKeys.size,
      retrievalCount: retrieval,
      crosscheckCount: crosscheck,
      assessCount: assess,
      testPractice,
      totalSeconds: total,
      days,
      source: "sessions",
      roundsMeasured: true
    };
  }

  function rhythmForRecord(record) {
    const rows = weekRows(
      record.className,
      record.weekStart
    );

    if (rows.some(r =>
      C.number(r.studySeconds) +
      C.number(r.crosscheckSeconds) > 0
    )) {
      return analyzeRows(rows, record.weekStart);
    }

    // Older or recovered records may have a snapshot
    // even if matching session rows are unavailable.

    const s = record.snapshot || {};
    const e = s.behaviorEvidence || {};

    const dated = Array.isArray(s.days)
      ? [...new Set(s.days.filter(validDay))]
      : [];

    const days = Array.from(
      { length: 7 },
      (_, i) => ({
        date: C.addDays(record.weekStart, i),

        seconds: dated.includes(
          C.addDays(record.weekStart, i)
        ) ? 1 : 0,

        checked: 0,
        assessed: 0
      })
    );

    const stage = k =>
      s.stages && s.stages[k] || {};

    const savedRhythm = s.weeklyRhythm || {};

    const accurateRounds = Number.isFinite(
      Number(savedRhythm.retrievalCrosscheckRounds)
    ) &&
      savedRhythm.retrievalCrosscheckRounds !== null &&
      savedRhythm.retrievalCrosscheckRounds !== undefined;

    return {
      studyDays: dated.length,

      roundCount: accurateRounds
        ? Number(savedRhythm.retrievalCrosscheckRounds)
        : Number.isFinite(Number(e.crosschecked))
          ? Number(e.crosschecked)
          : C.number(s.crossCount),

      retrievalCount: C.number(stage(2).count),
      crosscheckCount: C.number(s.crossCount),
      assessCount: C.number(stage(3).count),
      testPractice: C.number(e.tests),
      totalSeconds: C.number(s.seconds),
      days,
      source: "snapshot",
      roundsMeasured: accurateRounds
    };
  }

  function latestEarlierWeeks(current, history) {
    const latest = new Map();
    const cutoff = Date.parse(current.timestamp);

    (Array.isArray(history) ? history : [])
      .forEach(record => {

        if (
          !record ||
          record.className !== current.className ||
          !validDay(record.weekStart) ||
          record.weekStart >= current.weekStart ||
          !Number.isFinite(Date.parse(record.timestamp)) ||
          (
            Number.isFinite(cutoff) &&
            Date.parse(record.timestamp) > cutoff
          ) ||
          (
            record.ownerDeviceId &&
            current.ownerDeviceId &&
            record.ownerDeviceId !== current.ownerDeviceId
          )
        ) {
          return;
        }

        const old = latest.get(record.weekStart);

        if (
          !old ||
          Date.parse(record.timestamp) >
          Date.parse(old.timestamp)
        ) {
          latest.set(record.weekStart, record);
        }
      });

    return [...latest.values()]
      .sort(
        (a, b) =>
          a.weekStart.localeCompare(b.weekStart)
      );
  }

  function median(values) {
    const sorted = values
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    if (!sorted.length) return null;

    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function plan(
    base,
    decision,
    title,
    reason,
    code,
    action,
    stage,
    focus
  ) {
    const next = F.normalize({
      code,
      focus,
      title,
      action,
      text: action,
      targetStage: stage,

      targetMethod: stage === 3
        ? "Practice Test"
        : stage === 1
          ? "Worked Examples"
          : "Teach"
    });

    next.text = action;

    return {
      ...base,
      version: CoachRules.version,
      decision,

      label: ({
        keep: "Keep this approach",
        session: "Add another session",
        change: "Change one thing"
      })[decision] || "Keep testing this adjustment",

      title,
      reason,
      next,
      target: focus
    };
  }

  function evaluateWithRhythm(current, history) {
    const base = originalEvaluate(current, history);

    try {
      if (
        !current ||
        !validDay(current.weekStart) ||
        !current.className ||
        !current.snapshot
      ) {
        return base;
      }

      const now = rhythmForRecord(current);

      // New metadata is added only to the new check-in.
      // Existing history and storage keys stay intact.

      current.snapshot.weeklyRhythm = {
        version: VERSION,
        studyDays: now.studyDays,
        retrievalCrosscheckRounds: now.roundCount,
        assessActivities: now.assessCount,
        totalSeconds: now.totalSeconds
      };

      // Strong results take priority over any arbitrary
      // number of days or minutes.

      if (CoachRules.strong(current)) {
        return plan(
          base,
          "keep",
          "Keep this approach",

          "Your reported results were strong this week. " +
          "Keep the study pattern that worked; the number " +
          "of days does not need to match a target.",

          "RHYTHM_KEEP_APPROACH",

          "Continue the useful parts of your approach " +
          "and check the results again next week.",

          0,
          "maintain"
        );
      }

      // A middle learning rating is not automatically
      // a problem.

      if (
        !CoachRules.concerns(current) ||
        !now.totalSeconds
      ) {
        return base;
      }

      // Correct missing stages before suggesting more
      // minutes or sessions.

      if (
        !now.retrievalCount ||
        !now.crosscheckCount ||
        !now.assessCount
      ) {
        return base;
      }

      const learning = CoachRules.rate(
        current.learningRating
      );

      const assessment = CoachRules.assessment(current);

      // If learning feels strong but assessment is weak,
      // prioritize realistic test practice when missing.

      if (
        learning >= 4 &&
        assessment !== null &&
        assessment <= 2 &&
        !now.testPractice
      ) {
        return base;
      }

      const previous = latestEarlierWeeks(
        current,
        history
      );

      const successful = previous
        .filter(CoachRules.strong)
        .slice(-8)
        .map(record => rhythmForRecord(record))
        .filter(
          item =>
            item.totalSeconds > 0 &&
            item.studyDays > 0
        );

      const baselineDays = median(
        successful.map(x => x.studyDays)
      );

      const baselineRounds = median(
        successful
          .filter(x => x.roundsMeasured)
          .map(x => x.roundCount)
      );

      const baselineSeconds = median(
        successful.map(x => x.totalSeconds)
      );

      const oneDay = now.studyDays === 1;

      const fewerDays =
        successful.length > 0 &&
        baselineDays >= 2 &&
        now.studyDays < baselineDays;

      const fewerRounds =
        successful.length >= 2 &&
        baselineRounds >= 2 &&
        now.roundCount < baselineRounds;

      const muchLessTime =
        successful.length > 0 &&
        baselineSeconds > 0 &&
        now.totalSeconds <
          baselineSeconds *
          (successful.length >= 2 ? 0.65 : 0.50);

      if (
        !oneDay &&
        !fewerDays &&
        !fewerRounds &&
        !muchLessTime
      ) {
        return base;
      }

      // If the student already increased spaced practice
      // and still has weak results, change the task instead
      // of endlessly recommending more sessions.

      const mostRecent = previous[
        previous.length - 1
      ];

      const previousPlan =
        mostRecent && mostRecent.recommendation;

      if (
        previousPlan &&
        previousPlan.code ===
          "RHYTHM_MORE_SPACED_PRACTICE"
      ) {
        const earlier = rhythmForRecord(mostRecent);

        if (
          now.studyDays > earlier.studyDays ||
          now.roundCount > earlier.roundCount
        ) {
          const lowTest =
            assessment !== null &&
            assessment <= 2;

          return plan(
            base,
            "change",
            "Change one part of your practice",

            "You recorded more distributed practice, " +
            "but this week's result is still difficult. " +
            "That suggests trying a different task, " +
            "not simply increasing study time again.",

            "RHYTHM_TARGET_ONE_GAP",

            lowTest
              ? "Keep Retrieval → Crosscheck. Change Assess " +
                "to a Practice Test or problems matching the " +
                "questions that were difficult."
              : "Choose one confusing idea. Work through a " +
                "Worked Example, then retrieve the explanation " +
                "from memory and Crosscheck it.",

            lowTest ? 3 : 1,
            lowTest ? "testCycle" : "exampleRecall"
          );
        }
      }

      let reason;

      if (successful.length >= 2) {
        const parts = [];

        if (fewerDays) {
          parts.push(
            "about " +
            Math.round(baselineDays) +
            " study days"
          );
        }

        if (fewerRounds) {
          parts.push(
            "about " +
            Math.round(baselineRounds) +
            " Retrieval → Crosscheck rounds"
          );
        }

        reason = parts.length
          ? "In your stronger weeks, you recorded " +
            parts.join(" and ") +
            ". This week had " +
            now.studyDays +
            " study " +
            (now.studyDays === 1 ? "day" : "days") +
            " and " +
            now.roundCount +
            " checked retrieval " +
            (now.roundCount === 1 ? "round" : "rounds") +
            ". This comparison is a clue, not a requirement."

          : "You spent considerably less time practicing " +
            "than in your stronger weeks. Keep the useful " +
            "stages and try another spaced round.";

      } else if (
        successful.length === 1 &&
        (fewerDays || muchLessTime)
      ) {
        reason =
          "One earlier successful week included more " +
          "distributed practice. That is limited evidence, " +
          "but another spaced round is worth trying before " +
          "changing your whole approach.";

      } else {
        reason =
          "Your Retrieval, Crosscheck and Assess are present, " +
          "but this week's practice was concentrated on one day. " +
          "Try spacing another round across the week before " +
          "rebuilding the whole approach.";
      }

      const lowTest =
        assessment !== null &&
        assessment <= 2 &&
        learning !== null &&
        learning >= 3;

      return plan(
        base,
        "session",
        "Add a spaced practice session",
        reason,
        "RHYTHM_MORE_SPACED_PRACTICE",

        lowTest
          ? "Next week, add Retrieval → Crosscheck on another " +
            "day, then use Practice Problems or a Practice Test " +
            "that matches the real assessment."
          : "Next week, add one Retrieval → Crosscheck session " +
            "on another day, then Assess again.",

        2,
        "cycle"
      );

    } catch (error) {
      console.error(
        "Weekly rhythm coaching:",
        error
      );

      // Fall back to the original coaching engine.
      // Never prevent a check-in from saving because
      // the rhythm calculation failed.

      return base;
    }
  }

  evaluateWithRhythm.__studyRhythmWrapped = true;

  F.evaluate = evaluateWithRhythm;

  // =====================================================
  // WEEKLY STUDY RHYTHM VISUAL
  // =====================================================

  const style = document.createElement("style");

  style.textContent = `
    .sr-rhythm {
      margin: .25rem 0 1rem;
      padding: .85rem .9rem;
      border: 1px solid #d8e2e9;
      border-radius: .8rem;
    }

    .sr-title {
      font-size: .75rem;
      font-weight: 850;
      letter-spacing: .055em;
      color: #34536b;
      margin-bottom: .6rem;
    }

    .sr-days {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: .25rem;
    }

    .sr-day {
      text-align: center;
      min-width: 0;
    }

    .sr-name {
      display: block;
      font-size: .72rem;
      color: #647485;
    }

    .sr-dot {
      display: block;
      width: .75rem;
      height: .75rem;
      border: 2px solid #bfcbd5;
      border-radius: 50%;
      margin: .45rem auto;
    }

    .sr-active .sr-dot {
      background: #2a78d6;
      border-color: #2a78d6;
    }

    .sr-detail {
      display: block;
      min-height: 1.1rem;
      font-size: .58rem;
      font-weight: 750;
      color: #506577;
      overflow-wrap: anywhere;
    }

    .sr-counts {
      font-size: .81rem;
      color: #455c70;
      margin: .75rem 0 0;
    }

    @media (max-width: 400px) {
      .sr-rhythm {
        padding: .7rem .45rem;
      }

      .sr-days {
        gap: .1rem;
      }

      .sr-detail {
        font-size: .52rem;
      }
    }
  `;

  document.head.appendChild(style);

  function selectedWeeklyStart() {
    const tab = ROOT.querySelector(
      '[data-fp-period][aria-selected="true"]'
    );

    if (!tab) return null;

    const choice = tab.getAttribute(
      "data-fp-period"
    );

    const current = C.weekStart(
      C.dateKey()
    );

    if (choice === "this-week") {
      return current;
    }

    if (choice === "last-week") {
      return C.addDays(current, -7);
    }

    // Monthly cards remain concise.
    return null;
  }

  function rhythmElement(data) {
    const section = document.createElement("section");

    section.className = "sr-rhythm";

    section.setAttribute(
      "data-study-rhythm",
      VERSION
    );

    const heading = document.createElement("div");

    heading.className = "sr-title";
    heading.textContent = "WEEKLY STUDY RHYTHM";

    section.appendChild(heading);

    const grid = document.createElement("div");

    grid.className = "sr-days";

    grid.setAttribute(
      "role",
      "group"
    );

    grid.setAttribute(
      "aria-label",
      "Study activity, Monday through Sunday"
    );

    const names = [
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun"
    ];

    data.days.forEach((day, i) => {
      const cell = document.createElement("div");

      cell.className =
        "sr-day" +
        (day.seconds > 0 ? " sr-active" : "");

      const name = document.createElement("span");

      name.className = "sr-name";
      name.textContent = names[i];

      const dot = document.createElement("span");

      dot.className = "sr-dot";

      dot.setAttribute(
        "aria-hidden",
        "true"
      );

      const detail = document.createElement("span");

      detail.className = "sr-detail";

      detail.textContent = day.checked
        ? (
          day.assessed
            ? "R+C · A"
            : "R+C"
        )
        : day.assessed
          ? "Assess"
          : day.seconds
            ? "Study"
            : "—";

      cell.setAttribute(
        "aria-label",

        names[i] + ": " +
        (
          day.seconds > 0
            ? "studied" +
              (
                day.checked
                  ? ", retrieval and crosscheck"
                  : ""
              ) +
              (
                day.assessed
                  ? ", assess"
                  : ""
              )
            : "no recorded study"
        )
      );

      cell.append(
        name,
        dot,
        detail
      );

      grid.appendChild(cell);
    });

    section.appendChild(grid);

    const footer = document.createElement("p");

    footer.className = "sr-counts";

    const word = (n, one, many) =>
      n + " " + (n === 1 ? one : many);

    footer.textContent = [
      word(
        data.studyDays,
        "study day",
        "study days"
      ),

      word(
        data.roundCount,
        "Retrieval + Crosscheck round",
        "Retrieval + Crosscheck rounds"
      ),

      word(
        data.assessCount,
        "Assess activity",
        "Assess activities"
      )
    ].join(" · ");

    section.appendChild(footer);

    return section;
  }

  let queued = false;

  function updateRhythm() {
    const start = selectedWeeklyStart();

    if (!start) return;

    ROOT.querySelectorAll(
      ".fp-class-card"
    ).forEach(card => {

      if (
        card.querySelector(
          "[data-study-rhythm]"
        )
      ) {
        return;
      }

      const className = card.querySelector("h2")
        ?.textContent
        ?.trim();

      const bar = card.querySelector(
        ".fp-bar"
      );

      if (!className || !bar) return;

      const data = analyzeRows(
        weekRows(className, start),
        start
      );

      bar.insertAdjacentElement(
        "afterend",
        rhythmElement(data)
      );
    });
  }

  new MutationObserver(() => {
    if (queued) return;

    queued = true;

    requestAnimationFrame(() => {
      queued = false;

      try {
        updateRhythm();
      } catch (error) {
        console.error(
          "Weekly rhythm visual:",
          error
        );
      }
    });

  }).observe(
    ROOT,
    {
      childList: true,
      subtree: true
    }
  );

  updateRhythm();

})();
