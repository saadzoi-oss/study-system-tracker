(() => {
  "use strict";

  /*
   * STUDY SYSTEM — COACHING CONSISTENCY
   * Version: coaching-consistency-20261017-1
   *
   * Presentation-only correction.
   * Does not change student storage or recovery.
   */

  const BUILD = "coaching-consistency-20261017-1";

  if (
    typeof StudyCoach === "undefined" ||
    typeof StudyMonthly === "undefined" ||
    typeof StudyFollowup === "undefined" ||
    typeof CoachRules === "undefined"
  ) return;

  const C = StudyCoach;
  const M = StudyMonthly;
  const F = StudyFollowup;

  const R = document.getElementById("appRoot");
  const D = document.getElementById("reflectionDialog");

  if (!R || !D) return;

  const KEYS = {
    current: "studySystem.weeklyReflections.v1",
    history: "studySystem.reflectionHistory.v1",
    sessions: "studySystem.sessions.v4",
    owner: "studySystem.deviceId.v4"
  };

  const NAMES = {
    keep: "KEEP THIS APPROACH",
    change: "CHANGE ONE THING",
    session: "ADD ANOTHER SESSION",
    test: "KEEP TESTING THIS ADJUSTMENT",
    try: "KEEP TESTING THIS ADJUSTMENT",
    unknown: "NOT ENOUGH INFORMATION YET"
  };

  const TONES = {
    keep: "keep",
    change: "change",
    session: "add",
    test: "test",
    try: "test",
    unknown: "neutral"
  };

  // =====================================================
  // READ EXISTING STUDENT HISTORY
  // =====================================================

  function read(key, fallback) {
    try {
      const value = JSON.parse(
        localStorage.getItem(key) || "null"
      );

      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function object(value) {
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) ? value : {};
  }

  function allRevisions() {
    const me = localStorage.getItem(KEYS.owner) || "";
    const map = new Map();

    const raw = [
      ...Object.values(object(read(KEYS.history, {}))),
      ...Object.values(object(read(KEYS.current, {})))
    ];

    for (const r of raw) {
      if (
        !r ||
        typeof r.className !== "string" ||
        !C.validDate(r.weekStart) ||
        !Number.isFinite(Date.parse(r.timestamp)) ||
        (
          r.ownerDeviceId &&
          me &&
          r.ownerDeviceId !== me
        )
      ) continue;

      map.set(F.historyId(r), r);
    }

    return [...map.values()];
  }

  function records() {
    const latest = new Map();

    for (const r of allRevisions()) {
      const key = JSON.stringify([
        r.className,
        r.weekStart
      ]);

      const old = latest.get(key);

      if (
        !old ||
        Date.parse(r.timestamp) >
          Date.parse(old.timestamp)
      ) {
        latest.set(key, r);
      }
    }

    return [...latest.values()];
  }

  // =====================================================
  // USE THE ORIGINAL SAVED CHECK-IN ADVICE
  // =====================================================

  function savedAdvice(record) {
    const f = record && (
      record.followup ||
      (
        record.snapshot &&
        record.snapshot.keepAdjust
      )
    );

    if (
      f &&
      f.next &&
      NAMES[f.decision] &&
      f.version === CoachRules.version
    ) {
      return f;
    }

    // Older-version advice is refreshed in memory only.
    // Nothing is saved or overwritten here.

    if (record && record.snapshot) {
      try {
        const copy = JSON.parse(
          JSON.stringify(record)
        );

        const refreshed = F.evaluate(
          copy,
          allRevisions()
        );

        if (
          refreshed &&
          refreshed.next &&
          NAMES[refreshed.decision]
        ) {
          return refreshed;
        }
      } catch (error) {
        console.warn(
          "Could not refresh old coaching:",
          error
        );
      }
    }

    return (
      f &&
      f.next &&
      NAMES[f.decision]
    ) ? f : null;
  }

  function action(f) {
    return String(
      (
        f.next &&
        (
          f.next.text ||
          f.next.action
        )
      ) ||
      "Use your next check-in to decide what to change."
    );
  }

  function stage(f) {
    const n = Number(
      f.next &&
      f.next.targetStage
    );

    return [1, 2, 3].includes(n) ? n : 2;
  }

  function plan(f, interpretation) {
    const decision = f.decision;

    return {
      decision,

      interpretation: String(
        interpretation ||
        f.title ||
        f.reason ||
        "Use your check-in result to guide your practice."
      ),

      next: action(f),

      stage:
        decision === "keep" ||
        decision === "unknown"
          ? 0
          : stage(f)
    };
  }

  // =====================================================
  // CURRENT WEEK ACTIVITY
  // =====================================================

  function rowsFor(name, start) {
    const end = C.addDays(start, 7);
    const list = read(KEYS.sessions, []);

    return (
      Array.isArray(list) ? list : []
    ).filter(row => {
      if (!row || row.className !== name) {
        return false;
      }

      const day = C.localDay(row);

      return (
        day &&
        day >= start &&
        day < end
      );
    });
  }

  function checkedDays(rows) {
    return new Set(
      rows
        .filter(r =>
          Number(r.stage) === 2 &&
          C.number(r.studySeconds) > 0 &&
          C.number(r.crosscheckSeconds) > 0
        )
        .map(r => C.localDay(r))
        .filter(Boolean)
    ).size;
  }

  // =====================================================
  // THIS WEEK: CONTINUE THE SAVED NEXT STEP
  // =====================================================

  function thisWeek(name, week, all) {
    const previous = all
      .filter(r =>
        r.className === name &&
        r.weekStart < week &&
        savedAdvice(r)
      )
      .sort(
        (a, b) =>
          b.weekStart.localeCompare(a.weekStart)
      )[0];

    if (!previous) return null;

    const f = savedAdvice(previous);

    if (f.decision === "keep") {
      return {
        decision: "keep",

        interpretation:
          "Your last completed check-in recommended keeping this approach.",

        next:
          "Continue the same study pattern this week.",

        stage: 0
      };
    }

    if (f.decision === "session") {
      const rows = rowsFor(name, week);
      const days = checkedDays(rows);

      if (days >= 2) {
        const assessed = rows.some(r =>
          Number(r.stage) === 3 &&
          C.number(r.studySeconds) > 0
        );

        return {
          decision: "test",

          interpretation:
            "You've spread Retrieval → Crosscheck across separate days this week.",

          next: assessed
            ? "Keep testing this practice pattern until the next check-in."
            : "Add an independent Assess activity, then check the result.",

          stage: assessed ? 0 : 3
        };
      }

      return {
        decision: "session",

        interpretation:
          "Your last completed check-in suggested another spaced practice session.",

        next: action(f),
        stage: 2
      };
    }

    if (
      f.decision === "change" ||
      f.decision === "test" ||
      f.decision === "try"
    ) {
      const rows = rowsFor(name, week);
      const normalized = F.normalize(f.next);

      let visible = false;

      if (
        rows.length &&
        normalized.focus &&
        ![
          "unobservable",
          "maintain"
        ].includes(normalized.focus)
      ) {
        try {
          const snapshot = C.summarize(rows);

          snapshot.behaviorEvidence =
            F.evidence(rows);

          visible = !!F.metric(
            snapshot,
            normalized.focus
          ).visible;

        } catch (_) {
          visible = false;
        }
      }

      if (visible) {
        return {
          decision: "test",

          interpretation:
            "This week's activity includes the adjustment suggested by your last check-in.",

          next:
            "Keep testing it until the next check-in before making another major change.",

          stage: 0
        };
      }

      return {
        ...plan(
          f,
          "Your last completed check-in recommended this next step."
        ),

        decision: f.decision
      };
    }

    return plan(f);
  }

  // =====================================================
  // MONTHLY ADVICE
  // =====================================================

  function monthReview(name, kind) {
    const today = C.dateKey();
    const month = C.monthStart(today);

    let start;

    if (kind === "this-month") {
      start = month;
    } else {
      const date = new Date(
        month + "T12:00:00Z"
      );

      date.setUTCMonth(
        date.getUTCMonth() - 1
      );

      start = date
        .toISOString()
        .slice(0, 10);
    }

    const current = object(
      read(KEYS.current, {})
    );

    const me =
      localStorage.getItem(KEYS.owner) || "";

    try {
      const review = M.review(
        name,
        start,
        today,
        current,
        allRevisions(),
        me
      );

      if (
        !review.rated ||
        !NAMES[review.verdict]
      ) {
        return null;
      }

      // One completed week is not yet a monthly trend.

      if (
        review.rated === 1 &&
        review.latest
      ) {
        const saved = savedAdvice(
          review.latest
        );

        if (saved) {
          return plan(
            saved,

            "One completed check-in this month. " +
            (
              saved.title ||
              "Keep testing your next step."
            )
          );
        }
      }

      const outcome = review.verdict;
      const advice = review.advice || null;

      return {
        decision: outcome,

        interpretation:
          "Across this month's check-ins: " +
          (
            review.title ||
            "keep reviewing your study pattern."
          ),

        next: outcome === "keep"
          ? "Continue the approach that has been working."
          : advice
            ? String(
              advice.text ||
              advice.action ||
              "Keep testing one useful change."
            )
            : "Use your next weekly check-in to guide your next change.",

        stage:
          outcome === "keep" ||
          outcome === "unknown"
            ? 0
            : advice &&
              [1, 2, 3].includes(
                Number(advice.targetStage)
              )
              ? Number(advice.targetStage)
              : 0
      };

    } catch (error) {
      console.error(
        "Monthly coaching display:",
        error
      );

      return null;
    }
  }

  // =====================================================
  // CHOOSE ADVICE FOR THE SELECTED TIMEFRAME
  // =====================================================

  function currentPeriod() {
    return R.querySelector(
      '[data-fp-period][aria-selected="true"]'
    )?.getAttribute(
      "data-fp-period"
    ) || null;
  }

  function desiredAdvice(
    className,
    period,
    all
  ) {
    if (!period) return null;

    const currentWeek = C.weekStart(
      C.dateKey()
    );

    if (period === "last-week") {
      const week = C.addDays(
        currentWeek,
        -7
      );

      const record = all.find(r =>
        r.className === className &&
        r.weekStart === week
      );

      const f = savedAdvice(record);

      return f ? plan(f, f.title) : null;
    }

    if (period === "this-week") {
      return thisWeek(
        className,
        currentWeek,
        all
      );
    }

    if (
      period === "this-month" ||
      period === "prior-month"
    ) {
      return monthReview(
        className,
        period
      );
    }

    return null;
  }

  // =====================================================
  // UPDATE THE EXISTING PROGRESS CARD
  // =====================================================

  function updateText(node, value) {
    if (
      node &&
      node.textContent !== value
    ) {
      node.textContent = value;
    }
  }

  function patchCard(card, advice) {
    if (
      !advice ||
      !NAMES[advice.decision]
    ) return;

    const coaching = card.querySelector(
      ".fp-coach"
    );

    const label = coaching?.querySelector(
      ".fp-verdict"
    );

    const paragraph = coaching?.querySelector(
      "p:not(.fp-next)"
    );

    const next = coaching?.querySelector(
      ".fp-next"
    );

    const actions = card.querySelector(
      ".fp-actions"
    );

    if (
      !coaching ||
      !label ||
      !paragraph ||
      !next ||
      !actions
    ) return;

    updateText(
      label,
      NAMES[advice.decision]
    );

    updateText(
      paragraph,
      advice.interpretation
    );

    const newNext =
      "Next: " + advice.next;

    if (next.textContent !== newNext) {
      next.textContent = "";

      const strong =
        document.createElement("strong");

      strong.textContent = "Next:";

      next.append(
        strong,
        " " + advice.next
      );
    }

    const tone = TONES[advice.decision];

    [
      "keep",
      "test",
      "change",
      "add",
      "neutral"
    ].forEach(t => {
      coaching.classList.toggle(
        "fp-" + t,
        t === tone
      );
    });

    const existing = actions.querySelector(
      "[data-coach-class]"
    );

    const className = card.querySelector(
      ".fp-card-head h2"
    )?.textContent || "";

    if (!advice.stage) {
      if (existing) {
        existing.remove();
      }

    } else if (existing) {
      if (
        existing.getAttribute(
          "data-coach-stage"
        ) !== String(advice.stage)
      ) {
        existing.setAttribute(
          "data-coach-stage",
          String(advice.stage)
        );
      }

    } else if (className) {
      const button =
        document.createElement("button");

      button.type = "button";
      button.className = "primary";

      button.setAttribute(
        "data-coach-class",
        className
      );

      button.setAttribute(
        "data-coach-stage",
        String(advice.stage)
      );

      button.textContent =
        "Start this step →";

      const share = actions.querySelector(
        "[data-fp-share]"
      );

      actions.insertBefore(
        button,
        share || null
      );
    }
  }

  // =====================================================
  // REMOVE UNNECESSARY BUTTON AFTER STRONG RESULTS
  // =====================================================

  function patchKeepButtons(container) {
    container.querySelectorAll(
      ".coach"
    ).forEach(box => {

      const badge = box.querySelector(
        ".badge"
      );

      if (
        !badge ||
        badge.textContent
          .trim()
          .toLowerCase() !==
          "keep this approach"
      ) return;

      box.querySelectorAll(
        "button[data-coach-class]"
      ).forEach(button => {
        button.remove();
      });
    });
  }

  // =====================================================
  // REFRESH PRESENTATION
  // =====================================================

  function refresh() {
    patchKeepButtons(D);
    patchKeepButtons(R);

    const period = currentPeriod();

    if (!period) return;

    const all = records();

    R.querySelectorAll(
      ".fp-class-card"
    ).forEach(card => {

      const className = card.querySelector(
        ".fp-card-head h2"
      )?.textContent;

      if (!className) return;

      const advice = desiredAdvice(
        className,
        period,
        all
      );

      if (advice) {
        patchCard(card, advice);
      }
    });
  }

  let queued = false;

  function schedule() {
    if (queued) return;

    queued = true;

    requestAnimationFrame(() => {
      queued = false;

      try {
        refresh();
      } catch (error) {
        console.error(
          "Coaching consistency display:",
          error
        );
      }
    });
  }

  const observer =
    new MutationObserver(schedule);

  observer.observe(R, {
    childList: true,
    subtree: true
  });

  observer.observe(D, {
    childList: true,
    subtree: true
  });

  // =====================================================
  // SHARE THE RECOMMENDATION ACTUALLY ON SCREEN
  // =====================================================

  function exportData(card) {
    const text = selector =>
      card.querySelector(
        selector
      )?.textContent.trim() || "";

    const label = R.querySelector(
      '[data-fp-period][aria-selected="true"]'
    )?.textContent.trim() || "Progress";

    const parts = [
      ...card.querySelectorAll(".fp-time")
    ].map(el => ({
      name:
        el.querySelector("span")
          ?.textContent.trim() || "",

      time:
        el.querySelector("strong")
          ?.textContent.trim() || "0 min"
    }));

    const widths = [
      ...card.querySelectorAll(".fp-segment")
    ].map(el =>
      Math.max(
        0,
        Number.parseFloat(el.style.width) || 0
      )
    );

    return {
      name: text(".fp-card-head h2"),
      dates: text(".fp-dates"),
      period: label,
      total: text(".fp-total strong"),
      parts,
      widths,

      verdict: text(".fp-verdict"),

      interpretation: text(
        ".fp-coach p:not(.fp-next)"
      ),

      next: text(".fp-next").replace(
        /^Next:\s*/,
        ""
      )
    };
  }

  // =====================================================
  // CREATE THE VISUAL PROGRESS SNAPSHOT
  // =====================================================

  function lines(ctx, text, maxWidth) {
    const result = [];
    let line = "";

    const words = String(text || "")
      .split(/\s+/)
      .filter(Boolean);

    for (const word of words) {
      const joined = line
        ? line + " " + word
        : word;

      if (
        line &&
        ctx.measureText(joined).width >
          maxWidth
      ) {
        result.push(line);
        line = word;
      } else {
        line = joined;
      }
    }

    if (line) {
      result.push(line);
    }

    return result.length ? result : [""];
  }

  function drawLines(
    ctx,
    list,
    x,
    y,
    spacing
  ) {
    list.forEach((line, index) => {
      ctx.fillText(
        line,
        x,
        y + index * spacing
      );
    });
  }

  function pngFromVisibleCard(d) {
    const canvas =
      document.createElement("canvas");

    canvas.width = 1000;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "Canvas is unavailable."
      );
    }

    ctx.font = "24px Arial, sans-serif";

    const classLines = lines(
      ctx,
      d.name,
      820
    );

    ctx.font = "22px Arial, sans-serif";

    const reasonLines = lines(
      ctx,
      d.interpretation,
      825
    );

    const nextLines = lines(
      ctx,
      d.next,
      825
    );

    const classExtra =
      (classLines.length - 1) * 40;

    const yCoach =
      470 + classExtra;

    const coachingHeight =
      145 +
      reasonLines.length * 34 +
      nextLines.length * 34;

    canvas.height =
      yCoach +
      coachingHeight +
      115;

    const colors = [
      "#2a78d6",
      "#eb6834",
      "#6250d6",
      "#1b8f72"
    ];

    const tone =
      /KEEP THIS APPROACH/i.test(d.verdict)
        ? "#eef8f3"

        : /CHANGE ONE THING/i.test(d.verdict)
          ? "#fff4e8"

          : /ADD ANOTHER SESSION/i.test(d.verdict)
            ? "#f5f1ff"

            : "#eef4fb";

    ctx.fillStyle = "#f5f8fb";

    ctx.fillRect(
      0,
      0,
      1000,
      canvas.height
    );

    ctx.fillStyle = "#fff";

    ctx.fillRect(
      40,
      40,
      920,
      canvas.height - 80
    );

    ctx.fillStyle = "#647485";
    ctx.font = "bold 24px Arial, sans-serif";

    ctx.fillText(
      "STUDY SYSTEM",
      85,
      100
    );

    ctx.fillStyle = "#17344d";
    ctx.font = "bold 38px Arial, sans-serif";

    const displayClassLines = lines(
      ctx,
      d.name,
      820
    );

    drawLines(
      ctx,
      displayClassLines,
      85,
      155,
      40
    );

    ctx.font = "25px Arial, sans-serif";

    ctx.fillText(
      d.period + "  ·  " + d.dates,
      85,
      205 + classExtra
    );

    ctx.font = "bold 26px Arial, sans-serif";

    ctx.fillText(
      "Total: " + d.total,
      85,
      255 + classExtra
    );

    const columnWidth = 830 / 4;

    d.parts.slice(0, 4).forEach(
      (part, index) => {

        const center =
          85 +
          (index + 0.5) * columnWidth;

        ctx.textAlign = "center";
        ctx.fillStyle = colors[index];
        ctx.font = "bold 26px Arial, sans-serif";

        ctx.fillText(
          part.time,
          center,
          322 + classExtra
        );

        ctx.fillStyle = "#506477";
        ctx.font = "19px Arial, sans-serif";

        ctx.fillText(
          part.name,
          center,
          355 + classExtra
        );
      }
    );

    ctx.textAlign = "left";

    ctx.fillStyle = "#e6edf2";

    ctx.fillRect(
      85,
      383 + classExtra,
      830,
      26
    );

    let left = 85;

    d.widths.forEach((pct, index) => {
      const width =
        pct / 100 * 830;

      ctx.fillStyle =
        colors[index] || colors[3];

      ctx.fillRect(
        left,
        383 + classExtra,
        width,
        26
      );

      left += width;
    });

    ctx.fillStyle = tone;

    ctx.fillRect(
      85,
      yCoach,
      830,
      coachingHeight
    );

    ctx.fillStyle = "#17344d";
    ctx.font = "bold 26px Arial, sans-serif";

    ctx.fillText(
      d.verdict,
      115,
      yCoach + 48
    );

    ctx.font = "23px Arial, sans-serif";

    drawLines(
      ctx,
      reasonLines,
      115,
      yCoach + 95,
      34
    );

    const nextY =
      yCoach +
      110 +
      reasonLines.length * 34;

    ctx.font = "bold 23px Arial, sans-serif";

    ctx.fillText(
      "Next:",
      115,
      nextY
    );

    ctx.font = "22px Arial, sans-serif";

    drawLines(
      ctx,
      nextLines,
      115,
      nextY + 35,
      34
    );

    ctx.font = "20px Arial, sans-serif";
    ctx.fillStyle = "#647485";

    ctx.fillText(
      "Learn → Retrieval → Crosscheck → Assess",
      85,
      canvas.height - 62
    );

    return canvas;
  }

  // =====================================================
  // SHARE TEXT
  // =====================================================

  function shareText(d) {
    return [
      "Study System Progress — " + d.name,

      d.period + " · " + d.dates,

      "Total: " + d.total,

      d.parts.map(p =>
        p.name + ": " + p.time
      ).join(" · "),

      "",

      d.verdict,
      d.interpretation,

      "Next: " + d.next
    ].join("\n");
  }

  function filename(d) {
    const safe = value =>
      String(value)
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 55)
        .toLowerCase();

    return (
      "study-progress-" +
      safe(d.name) +
      "-" +
      safe(d.period) +
      ".png"
    );
  }

  // =====================================================
  // SHARE / EMAIL
  // =====================================================

  async function shareCard(card) {
    refresh();

    const d = exportData(card);

    const message =
      document.getElementById("message");

    const title =
      "Study System Progress — " + d.name;

    const text = shareText(d);

    let blob;

    try {
      const canvas = pngFromVisibleCard(d);

      blob = await new Promise(
        (resolve, reject) => {

          canvas.toBlob(
            b => b
              ? resolve(b)
              : reject(
                new Error(
                  "Image creation failed."
                )
              ),

            "image/png"
          );
        }
      );

    } catch (error) {
      console.error(
        "Progress snapshot:",
        error
      );
    }

    if (
      blob &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      typeof File === "function"
    ) {
      const file = new File(
        [blob],
        filename(d),
        {
          type: "image/png"
        }
      );

      try {
        if (
          navigator.canShare({
            files: [file]
          })
        ) {
          await navigator.share({
            title,
            text,
            files: [file]
          });

          if (message) {
            message.textContent = "";
          }

          return;
        }

      } catch (error) {
        if (
          error &&
          error.name === "AbortError"
        ) return;

        console.warn(
          "File sharing unavailable:",
          error
        );
      }
    }

    if (blob) {
      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = filename(d);

      document.body.appendChild(link);

      link.click();
      link.remove();

      setTimeout(
        () => URL.revokeObjectURL(url),
        30000
      );

      if (message) {
        message.textContent =
          "Progress image saved. Attach the PNG to your email draft.";
      }

    } else if (message) {
      message.textContent =
        "Image unavailable; opening a text summary.";
    }

    window.location.href =
      "mailto:?subject=" +
      encodeURIComponent(title) +

      "&body=" +
      encodeURIComponent(
        text +
        (
          blob
            ? "\n\nAttach the downloaded progress PNG to this email."
            : ""
        )
      );
  }

  // Prevent the older Share handler from sending
  // an outdated recommendation.

  document.addEventListener(
    "click",
    event => {

      const button = event.target.closest(
        "[data-fp-share]"
      );

      if (!button) return;

      const card = button.closest(
        ".fp-class-card"
      );

      if (!card) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      shareCard(card).catch(error => {
        console.error(
          "Share progress:",
          error
        );

        const message =
          document.getElementById("message");

        if (message) {
          message.textContent =
            "Could not share automatically. Please try again.";
        }
      });
    },

    true
  );

  // =====================================================
  // VERSION MARKER
  // =====================================================

  const footer =
    document.getElementById("coachVersion");

  if (footer) {
    function markVersion() {
      if (
        !footer.textContent.includes(BUILD) &&
        !footer.textContent.includes("Loading")
      ) {
        footer.textContent +=
          " · " + BUILD;
      }
    }

    new MutationObserver(
      markVersion
    ).observe(
      footer,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );

    markVersion();
  }

  schedule();

})();
