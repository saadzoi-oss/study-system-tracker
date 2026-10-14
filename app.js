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
    history: "studySystem.reflectionHistory.v1",
    start: "studySystem.reflectionStartWeek.v1",
    active: "studySystem.activeSession.v1",
    queue: "studySystem.outbox.v1",
    sync: "studySystem.syncReceipts.v1"
  };

  const RULE_VERSION = "stable-recovery-20261013-6";

  const catalog = {
    "Math": [
      "Algebra 1",
      "Geometry",
      "Algebra 2",
      "Integrated Math",
      "Math Analysis",
      "Precalculus",
      "Calculus",
      "AP Calculus AB",
      "AP Statistics",
      "Other Math"
    ],

    "Science": [
      "Biology",
      "Honors Biology",
      "Chemistry",
      "Physics",
      "Physiology",
      "AP Biology",
      "AP Chemistry",
      "AP Environmental Science",
      "AP Physics 1",
      "Other Science"
    ],

    "English": [
      "English 9",
      "English 9 Honors",
      "English 10",
      "English 10 Honors",
      "American Literature",
      "American Literature Honors",
      "AP English Language",
      "Advanced Composition",
      "Advanced Composition Honors",
      "AP English Literature",
      "Other English"
    ],

    "History / Social Science": [
      "World History",
      "Honors World History",
      "AP World History",
      "U.S. History",
      "AP U.S. History",
      "Government",
      "Economics",
      "AP Government",
      "AP Human Geography",
      "AP Psychology",
      "Ethnic Studies",
      "Health",
      "Other History / Social Science"
    ],

    "World Language": [
      "Spanish",
      "Spanish 2",
      "Spanish 3",
      "AP Spanish Language",
      "AP Spanish Literature",
      "Other World Language"
    ],

    "Elective / CTE": [
      "Architecture 1",
      "Architecture 2",
      "Architectural Design",
      "Digital Design",
      "Film & Video Production",
      "Exploring Computer Science",
      "Robotics",
      "Child Development",
      "Health Science",
      "Emergency Medical Technician",
      "Art",
      "AP Drawing",
      "AP 3-D Art & Design",
      "AP Seminar",
      "AP Research",
      "JROTC",
      "PE / Athletics",
      "Other Elective / CTE"
    ]
  };

  const stages = {
    1: {
      name: "Learn",

      purpose:
        "Build or rebuild your understanding using your learning materials.",

      instruction:
        "Use your notes, textbook, examples, videos, AI, Unit Coach, or other learning resources to understand the material.",

      methods: [
        "Study / Review",
        "Textbook",
        "Video",
        "Concept Map",
        "Worked Examples",
        "AI Tutor",
        "Unit Coach"
      ]
    },

    2: {
      name: "Retrieval",

      purpose:
        "See what you can teach or produce from memory.",

      instruction:
        "Put your materials away. First show yourself what you actually know from memory.",

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
        "Treat this like a real assessment. Avoid hints or explanations until the activity is finished.",

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

  const root =
    $("appRoot");

  const dialog =
    $("reflectionDialog");

  const esc = value =>
    String(value ?? "").replace(
      /[&<>"']/g,
      c =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[c]
    );

  const uid = () =>
    window.crypto &&
    crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2);

  const dateKey = (
    date = new Date()
  ) => [
    date.getFullYear(),

    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),

    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    )
  ].join("-");

  const today = () =>
    dateKey();

  function validDate(key) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        String(key)
      )
    ) {
      return false;
    }

    const d =
      new Date(
        key +
        "T12:00:00Z"
      );

    return (
      !Number.isNaN(
        d.getTime()
      ) &&
      d
        .toISOString()
        .slice(
          0,
          10
        ) === key
    );
  }

  function addDays(
    key,
    amount
  ) {
    const d =
      new Date(
        key +
        "T12:00:00Z"
      );

    d.setUTCDate(
      d.getUTCDate() +
      amount
    );

    return d
      .toISOString()
      .slice(
        0,
        10
      );
  }

  function weekStart(key) {
    const day =
      new Date(
        key +
        "T12:00:00Z"
      ).getUTCDay();

    return addDays(
      key,
      -(
        (
          day +
          6
        ) %
        7
      )
    );
  }

  function monthStart(key) {
    return (
      key.slice(
        0,
        7
      ) +
      "-01"
    );
  }

  function nextMonth(key) {
    const d =
      new Date(
        monthStart(key) +
        "T12:00:00Z"
      );

    d.setUTCMonth(
      d.getUTCMonth() +
      1
    );

    return d
      .toISOString()
      .slice(
        0,
        10
      );
  }

  function daysBetween(
    a,
    b
  ) {
    return Math.round(
      (
        new Date(
          b +
          "T12:00:00Z"
        ) -
        new Date(
          a +
          "T12:00:00Z"
        )
      ) /
      86400000
    );
  }

  function pretty(key) {
    return new Date(
      key +
      "T12:00:00"
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
    return (
      pretty(week) +
      " – " +
      pretty(
        addDays(
          week,
          6
        )
      )
    );
  }

  function stageName(stage) {
    return (
      stages[
        Number(stage)
      ]?.name ||
      "Unknown"
    );
  }

  function number(value) {
    const n =
      Number(value);

    return (
      Number.isFinite(n) &&
      n >= 0
    )
      ? n
      : 0;
  }

  function pct(
    n,
    d
  ) {
    return d
      ? Math.round(
          n /
          d *
          100
        ) +
        "%"
      : "—";
  }

  function human(seconds) {
    const sec =
      number(seconds);

    if (
      sec > 0 &&
      sec < 60
    ) {
      return (
        Math.round(sec) +
        " sec"
      );
    }

    const min =
      Math.round(
        sec /
        60
      );

    if (
      min < 60
    ) {
      return (
        min +
        " min"
      );
    }

    return (
      Math.floor(
        min /
        60
      ) +
      " hr" +
      (
        min % 60
          ? " " +
            min % 60 +
            " min"
          : ""
      )
    );
  }

  function clock(seconds) {
    const sec =
      Math.max(
        0,
        Math.floor(
          seconds ||
          0
        )
      );

    return (
      String(
        Math.floor(
          sec /
          60
        )
      ).padStart(
        2,
        "0"
      ) +
      ":" +
      String(
        sec %
        60
      ).padStart(
        2,
        "0"
      )
    );
  }

  function localDay(row) {
    if (
      validDate(
        row.localDate
      )
    ) {
      return row.localDate;
    }

    const d =
      new Date(
        row.timestamp
      );

    return Number.isNaN(
      d.getTime()
    )
      ? ""
      : dateKey(d);
  }

  function reflectionKey(
    week,
    className
  ) {
    return JSON.stringify(
      [
        week,
        className
      ]
    );
  }

  function read(
    key,
    fallback
  ) {
    try {
      const raw =
        localStorage.getItem(
          key
        );

      return raw === null
        ? fallback
        : JSON.parse(raw);

    } catch (error) {
      throw new Error(
        "Saved data could not be read. Do not clear site data. Export a backup before making changes."
      );
    }
  }

  function write(
    key,
    value
  ) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(
          value
        )
      );

    } catch (error) {
      throw new Error(
        "This browser could not save data. Free device space or export a backup; do not clear this site's storage."
      );
    }
  }

  function rawWrite(
    key,
    value
  ) {
    try {
      localStorage.setItem(
        key,
        String(value)
      );

    } catch (error) {
      throw new Error(
        "This browser could not save data. Export a backup before continuing."
      );
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(
        key
      );

    } catch (error) {
      throw new Error(
        "This browser could not update saved data."
      );
    }
  }

  function classes() {
    const value =
      read(
        K.classes,
        []
      );

    if (
      !Array.isArray(
        value
      )
    ) {
      throw new Error(
        "Saved classes need recovery."
      );
    }

    return value;
  }

  function sessions() {
    const value =
      read(
        K.sessions,
        []
      );

    if (
      !Array.isArray(
        value
      )
    ) {
      throw new Error(
        "Saved study history needs recovery."
      );
    }

    return value;
  }

  function reflections() {
    const value =
      read(
        K.reflections,
        {}
      );

    if (
      !value ||
      Array.isArray(
        value
      ) ||
      typeof value !==
      "object"
    ) {
      throw new Error(
        "Saved check-ins need recovery."
      );
    }

    return value;
  }

  function reflectionHistory() {
    const value =
      read(
        K.history,
        {}
      );

    if (
      !value ||
      Array.isArray(
        value
      ) ||
      typeof value !==
      "object"
    ) {
      throw new Error(
        "Saved check-in history needs recovery."
      );
    }

    return value;
  }

  /*
    --------------------------------------------------
    STABLE RECOVERY ID
    --------------------------------------------------

    IMPORTANT:
    Keep using studySystem.deviceId.v4.

    Existing students keep the ID that is already
    stored in their browser.

    A new ID is created only when there truly is no
    saved ID in this browser.
  */

  let stableDeviceId =
    null;

  function cleanDeviceId(
    value
  ) {
    const id =
      String(
        value ||
        ""
      ).trim();

    if (
      !id ||
      id === "null" ||
      id === "undefined"
    ) {
      return "";
    }

    return id;
  }

  function deviceId() {
    let stored = "";

    try {
      stored =
        cleanDeviceId(
          localStorage.getItem(
            K.device
          )
        );

    } catch (error) {
      throw new Error(
        "This browser could not read your anonymous recovery ID. Do not clear website data."
      );
    }

    /*
      If this page already established an identity,
      never silently switch identities during the
      same page session.
    */
    if (
      stableDeviceId
    ) {
      if (
        stored &&
        stored !==
        stableDeviceId
      ) {
        throw new Error(
          "Your anonymous recovery ID changed unexpectedly. Nothing was erased. Export a backup before continuing."
        );
      }

      /*
        If only the device ID key disappeared while
        this page is still running, restore the
        already-known ID instead of creating another.
      */
      if (!stored) {
        rawWrite(
          K.device,
          stableDeviceId
        );
      }

      return stableDeviceId;
    }

    /*
      Existing student:
      use the saved ID.
    */
    if (stored) {
      stableDeviceId =
        stored;

      return stableDeviceId;
    }

    /*
      Truly new browser/site storage:
      create one ID.
    */
    const created =
      uid();

    rawWrite(
      K.device,
      created
    );

    /*
      Confirm that the browser actually saved it.
    */
    const verified =
      cleanDeviceId(
        localStorage.getItem(
          K.device
        )
      );

    if (
      verified !==
      created
    ) {
      throw new Error(
        "This browser did not preserve your recovery ID. Do not continue until browser storage is working."
      );
    }

    stableDeviceId =
      created;

    return stableDeviceId;
  }

  function summarize(rows) {
    const result = {
      count: 0,
      seconds: 0,
      studySeconds: 0,
      crossSeconds: 0,
      crossCount: 0,
      days: [],
      classes: {},
      methods: {},

      stages: {
        1: {
          count: 0,
          seconds: 0,
          methods: {}
        },

        2: {
          count: 0,
          seconds: 0,
          methods: {}
        },

        3: {
          count: 0,
          seconds: 0,
          methods: {}
        }
      }
    };

    const daySet =
      new Set();

    rows.forEach(row => {
      const stage =
        Number(
          row.stage
        );

      if (
        ![
          1,
          2,
          3
        ].includes(
          stage
        )
      ) {
        return;
      }

      const study =
        number(
          row.studySeconds
        );

      const cross =
        number(
          row.crosscheckSeconds
        );

      const method =
        String(
          row.method ||
          "Unspecified"
        );

      const className =
        String(
          row.className ||
          "Unnamed class"
        );

      result.count++;

      result.studySeconds +=
        study;

      result.crossSeconds +=
        cross;

      result.seconds +=
        study +
        cross;

      result
        .stages[
          stage
        ]
        .count++;

      result
        .stages[
          stage
        ]
        .seconds +=
        study;

      if (
        !result
          .stages[
            stage
          ]
          .methods[
            method
          ]
      ) {
        result
          .stages[
            stage
          ]
          .methods[
            method
          ] = {
            count: 0,
            seconds: 0
          };
      }

      result
        .stages[
          stage
        ]
        .methods[
          method
        ]
        .count++;

      result
        .stages[
          stage
        ]
        .methods[
          method
        ]
        .seconds +=
        study;

      result.methods[
        method
      ] =
        (
          result.methods[
            method
          ] ||
          0
        ) +
        1;

      result.classes[
        className
      ] =
        (
          result.classes[
            className
          ] ||
          0
        ) +
        study +
        cross;

      if (
        stage === 2 &&
        cross > 0
      ) {
        result.crossCount++;
      }

      const day =
        localDay(row);

      if (day) {
        daySet.add(day);
      }
    });

    result.days =
      [
        ...daySet
      ];

    return result;
  }

  function rowsForClassWeek(
    className,
    week
  ) {
    const end =
      addDays(
        week,
        7
      );

    return sessions()
      .filter(row =>
        row.className ===
          className &&
        localDay(row) >=
          week &&
        localDay(row) <
          end
      );
  }

  function previousReflection(
    className,
    beforeWeek
  ) {
    return Object.values(
      reflections()
    )
      .filter(r =>
        r.className ===
          className &&
        r.weekStart <
          beforeWeek
      )
      .sort(
        (
          a,
          b
        ) =>
          b.weekStart
            .localeCompare(
              a.weekStart
            ) ||
          String(
            b.timestamp
          ).localeCompare(
            String(
              a.timestamp
            )
          )
      )[0] ||
      null;
  }

  function recommendation(
    summary,
    outcome = null,
    previous = null
  ) {
    const learn =
      summary.stages[1];

    const retrieve =
      summary.stages[2];

    const assess =
      summary.stages[3];

    const learningRating =
      outcome
        ? Number(
            outcome.learningRating
          )
        : null;

    const assessmentRating =
      outcome &&
      outcome.hadAssessment
        ? Number(
            outcome.assessmentRating
          )
        : null;

    const prevLearning =
      previous
        ? Number(
            previous.learningRating
          )
        : null;

    const prevAssessment =
      previous &&
      previous.hadAssessment
        ? Number(
            previous.assessmentRating
          )
        : null;

    const base = {
      version:
        RULE_VERSION,

      targetStage:
        2,

      targetMethod:
        "Teach"
    };

    /*
      Repeated low learning rating:
      give a useful change even if an older suggestion
      cannot be proven from the timer log.
    */
    if (
      previous &&
      learningRating <= 2 &&
      prevLearning <= 2
    ) {
      return Object.assign(
        base,
        {
          code:
            "CHANGE_ONE_THING_LEARNING",

          title:
            "Change one part of the next study visit",

          text:
            "Learning has felt difficult in two rated weeks. Pick one confusing example, work through it, then close your notes and explain the corrected idea from memory. Crosscheck the gap.",

          targetStage:
            1,

          targetMethod:
            "Worked Examples"
        }
      );
    }

    /*
      Repeated low assessment rating:
      separate assessment evidence from learning rating.
    */
    if (
      previous &&
      assessmentRating !==
        null &&
      prevAssessment !==
        null &&
      assessmentRating <=
        2 &&
      prevAssessment <=
        2
    ) {
      return Object.assign(
        base,
        {
          code:
            "CHANGE_ONE_THING_ASSESSMENT",

          title:
            "Change the kind of practice",

          text:
            "Assessment has felt difficult in two rated weeks. Keep Retrieval and Crosscheck, then use a Practice Test or Practice Problems that resemble the assessment.",

          targetStage:
            3,

          targetMethod:
            "Practice Test"
        }
      );
    }

    /*
      Strong outcome:
      do not force artificial stage balancing.
    */
    if (
      outcome &&
      learningRating >=
        4 &&
      (
        assessmentRating ===
          null ||
        assessmentRating >=
          4
      )
    ) {
      return Object.assign(
        base,
        {
          code:
            "KEEP_WORKING_APPROACH",

          title:
            "Keep the useful parts",

          text:
            assessmentRating ===
              null
              ? "Your learning rating is strong. Keep the methods that are helping; assessment results can be reviewed when you have one."
              : "Your learning and assessment ratings are strong. Keep the methods that are helping. You do not need to make the stage percentages even."
        }
      );
    }

    /*
      Learn or Assess activity but no Retrieval.
    */
    if (
      summary.count >
        0 &&
      retrieve.count ===
        0
    ) {
      return Object.assign(
        base,
        {
          code:
            "ADD_RETRIEVAL",

          title:
            "Add a memory check",

          text:
            "You logged studying but no separate Retrieval. Close your materials and teach or reconstruct the idea from memory before deciding what needs review."
        }
      );
    }

    /*
      Retrieval is happening but Crosscheck is often missing.
    */
    if (
      retrieve.count >=
        2 &&
      summary.crossCount /
        retrieve.count <
        0.8
    ) {
      return Object.assign(
        base,
        {
          code:
            "ADD_CROSSCHECK",

          title:
            "Crosscheck what you retrieved",

          text:
            "Some Retrieval stages do not show Crosscheck time. After retrieving, compare what you produced with a reliable source and correct the specific gap."
        }
      );
    }

    /*
      Retrieval exists, Assess does not.
    */
    if (
      retrieve.count >
        0 &&
      assess.count ===
        0
    ) {
      return Object.assign(
        base,
        {
          code:
            "ADD_ASSESS",

          title:
            "Try a short independent check",

          text:
            "After Retrieval and Crosscheck, try a short Practice Test, Practice Problems, or Anki assessment without help.",

          targetStage:
            3,

          targetMethod:
            "Practice Test"
        }
      );
    }

    /*
      Low assessment rating and most assessment practice
      is Anki.
    */
    const anki =
      assess.methods.Anki;

    if (
      assessmentRating !==
        null &&
      assessmentRating <=
        2 &&
      assess.count >=
        3 &&
      anki &&
      anki.count /
        assess.count >=
        0.65
    ) {
      return Object.assign(
        base,
        {
          code:
            "MATCH_ASSESSMENT",

          title:
            "Add practice that matches the assessment",

          text:
            "Keep Anki for recall, but add Practice Problems or a Practice Test that matches the kind of questions you found difficult.",

          targetStage:
            3,

          targetMethod:
            "Practice Test"
        }
      );
    }

    /*
      Difficulty + lots of Learn:
      focus on one gap rather than more general review.
    */
    if (
      outcome &&
      learningRating <=
        2 &&
      summary.studySeconds >
        0 &&
      learn.seconds /
        summary.studySeconds >=
        0.5
    ) {
      return Object.assign(
        base,
        {
          code:
            "TARGETED_RELEARN",

          title:
            "Relearn one gap, not everything",

          text:
            "Choose one difficult Worked Example, work through it, then close your notes and explain the idea from memory. Crosscheck only what you missed.",

          targetStage:
            1,

          targetMethod:
            "Worked Examples"
        }
      );
    }

    /*
      3/5 is a middle response, not automatic failure.
    */
    if (
      outcome &&
      learningRating ===
        3
    ) {
      return Object.assign(
        base,
        {
          code:
            "KEEP_TESTING",

          title:
            "Keep testing your approach",

          text:
            "A 3/5 is a middle response, not a failure. Keep the useful parts and use one short Retrieval plus Crosscheck to identify what still needs work."
        }
      );
    }

    return Object.assign(
      base,
      {
        code:
          "TRY_CYCLE",

        title:
          "Choose one useful next step",

        text:
          "Retrieve what you know first, Crosscheck what you missed, then choose a brief independent Assess activity."
      }
    );
  }

  function pendingReflections() {
    const start =
      localStorage.getItem(
        K.start
      ) ||
      weekStart(
        today()
      );

    const current =
      reflections();

    const groups =
      new Map();

    sessions().forEach(
      row => {
        const day =
          localDay(row);

        if (!day) {
          return;
        }

        const week =
          weekStart(day);

        const className =
          String(
            row.className ||
            ""
          );

        if (
          !className ||
          week <
            start ||
          addDays(
            week,
            6
          ) >
            today()
        ) {
          return;
        }

        const key =
          reflectionKey(
            week,
            className
          );

        const saved =
          current[key];

        if (
          saved &&
          [
            1,
            2,
            3,
            4,
            5
          ].includes(
            Number(
              saved.learningRating
            )
          ) &&
          (
            saved.hadAssessment ===
              false ||
            [
              1,
              2,
              3,
              4,
              5
            ].includes(
              Number(
                saved.assessmentRating
              )
            )
          )
        ) {
          return;
        }

        groups.set(
          key,
          {
            className,
            weekStart:
              week
          }
        );
      }
    );

    return [
      ...groups.values()
    ].sort(
      (
        a,
        b
      ) =>
        a.weekStart
          .localeCompare(
            b.weekStart
          ) ||
        a.className
          .localeCompare(
            b.className
          )
    );
  }

  function historyList() {
    const map =
      new Map();

    [
      ...Object.values(
        reflectionHistory()
      ),

      ...Object.values(
        reflections()
      )
    ].forEach(
      record => {
        if (
          !record ||
          !record.className ||
          !record.weekStart ||
          !record.timestamp
        ) {
          return;
        }

        const key =
          record.revisionId ||
          JSON.stringify(
            [
              record.className,
              record.weekStart,
              record.timestamp
            ]
          );

        map.set(
          key,
          record
        );
      }
    );

    return [
      ...map.values()
    ];
  }

  function saveReflection(
    record
  ) {
    const latest =
      reflections();

    latest[
      reflectionKey(
        record.weekStart,
        record.className
      )
    ] =
      record;

    write(
      K.reflections,
      latest
    );

    const history =
      reflectionHistory();

    history[
      record.revisionId
    ] =
      record;

    write(
      K.history,
      history
    );
  }

  function latestReflection(
    className,
    through =
      "9999-12-31"
  ) {
    return Object.values(
      reflections()
    )
      .filter(
        r =>
          r.className ===
            className &&
          r.weekStart <
            through
      )
      .sort(
        (
          a,
          b
        ) =>
          b.weekStart
            .localeCompare(
              a.weekStart
            ) ||
          String(
            b.timestamp
          ).localeCompare(
            String(
              a.timestamp
            )
          )
      )[0] ||
      null;
  }

  function message(text) {
    const el =
      $("message");

    if (el) {
      el.textContent =
        text ||
        "";
    }
  }

  function safe(fn) {
    return (
      ...args
    ) => {
      try {
        return fn(
          ...args
        );

      } catch (error) {
        console.error(
          error
        );

        message(
          error.message
        );
      }
    };
  }

  let screen =
    "home";

  let chosenClass =
    null;

  let chosenStage =
    null;

  let visitId =
    null;

  let completed =
    null;

  let active =
    null;

  let launchAnki =
    false;

  let reminderDismissed =
    false;

  let reflectionTarget =
    null;

  let periodKind =
    "week";

  let periodKey =
    weekStart(
      today()
    );

  let lastDay =
    today();

  let lastCheckpoint =
    Date.now();

  let syncBusy =
    false;

  let lastError =
    "";

  function ankiDue() {
    const monday =
      weekStart(
        today()
      );

    const due =
      [];

    [
      monday,
      addDays(
        monday,
        3
      )
    ].forEach(
      day => {
        if (
          day <=
            today() &&
          localStorage.getItem(
            K.ankiDone +
            day
          ) !==
            "1"
        ) {
          due.push(
            day
          );
        }
      }
    );

    return due;
  }

  function lastChecked(
    className
  ) {
    const checks =
      sessions()
        .filter(
          row =>
            row.className ===
              className &&
            [
              2,
              3
            ].includes(
              Number(
                row.stage
              )
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            String(
              b.timestamp
            ).localeCompare(
              String(
                a.timestamp
              )
            )
        );

    if (
      !checks.length
    ) {
      return sessions()
        .some(
          row =>
            row.className ===
            className
        )
        ? "Learn logged; no check logged yet"
        : "No check logged yet";
    }

    const diff =
      daysBetween(
        localDay(
          checks[0]
        ),
        today()
      );

    if (
      diff <=
      0
    ) {
      return "Last checked today";
    }

    if (
      diff ===
      1
    ) {
      return "Last checked yesterday";
    }

    return (
      "Last checked " +
      diff +
      " days ago"
    );
  }

  function elapsedMs() {
    if (!active) {
      return 0;
    }

    return (
      active.ms +
      (
        active.runningSince !==
          null
          ? Date.now() -
            active.runningSince
          : 0
      )
    );
  }

  function saveActive() {
    if (active) {
      active.lastSeen =
        Date.now();

      write(
        K.active,
        active
      );

    } else {
      remove(
        K.active
      );
    }
  }

  function pauseTimer() {
    if (
      active &&
      active.runningSince !==
        null
    ) {
      active.ms =
        elapsedMs();

      active.runningSince =
        null;

      saveActive();
    }
  }

  function navigate(to) {
    if (
      active &&
      to !==
        "timer"
    ) {
      message(
        "Finish or cancel the current stage before leaving its timer."
      );

      return;
    }

    screen =
      to;

    render();
  }

  function render() {
    $("navigation").innerHTML =
      active
        ? '<span class="small">Session in progress</span>'
        : '<button class="text-button" data-nav="home">Study</button>' +
          '<button class="text-button" data-nav="progress">Progress</button>' +
          '<button class="text-button" data-nav="backup">Backup</button>';

    if (active) {
      screen =
        "timer";
    }

    if (
      screen ===
        "home" &&
      classes().length ===
        0
    ) {
      screen =
        "classes";
    }

    if (
      screen ===
      "classes"
    ) {
      renderClasses();

    } else if (
      screen ===
      "stage"
    ) {
      renderStages();

    } else if (
      screen ===
      "timer"
    ) {
      renderTimer();

    } else if (
      screen ===
      "complete"
    ) {
      renderComplete();

    } else if (
      screen ===
      "progress"
    ) {
      renderProgress();

    } else if (
      screen ===
      "backup"
    ) {
      renderBackup();

    } else {
      renderHome();
    }

    updateSync();
  }

  function renderHome() {
    const due =
      pendingReflections();

    const dueAnki =
      ankiDue();

    let html =
      '<section class="card intro">' +
      '<span class="eyebrow">YOUR NEXT STUDY VISIT</span>' +
      '<h2>Pick a class. Make one useful next move.</h2>' +
      '<p class="muted">Start at any stage. A second stage is optional.</p>' +
      '</section>';

    if (
      due.length
    ) {
      html +=
        '<section class="notice"><strong>' +

        due.length +

        " weekly check-in" +

        (
          due.length ===
            1
            ? " is"
            : "s are"
        ) +

        ' waiting</strong><p class="small">' +

        'Your learning rating can guide feedback even when there was no assessment.' +

        '</p><button class="primary" data-action="reflect">Answer check-in</button></section>';
    }

    if (
      dueAnki.length &&
      localStorage.getItem(
        K.ankiHide +
        today()
      ) !==
        "1"
    ) {
      html +=
        '<section class="notice">' +

        '<strong>Anki — Stage 3 Assess</strong><p>' +

        (
          dueAnki[0] ===
            today()
            ? "Your Monday/Thursday Anki session is due today."
            : "An Anki make-up for " +
              pretty(
                dueAnki[0]
              ) +
              " is due this week."
        ) +

        '</p><div class="actions">' +

        '<button class="primary" data-action="anki">Choose a class for Anki</button>' +

        '<button class="secondary" data-action="hide-anki">Hide for today</button>' +

        '</div></section>';
    }

    html +=
      '<section class="card">' +

      '<div class="section-head">' +

      '<h2>Your classes</h2>' +

      '<button class="secondary" data-nav="classes">Edit classes</button>' +

      '</div>' +

      '<div class="class-grid">' +

      classes()
        .map(
          (
            c,
            i
          ) =>
            '<button class="class-button" data-class="' +
            i +
            '">' +

            '<strong>' +
            esc(
              c.name
            ) +
            '</strong>' +

            '<span>' +
            esc(
              lastChecked(
                c.name
              )
            ) +
            '</span>' +

            '</button>'
        )
        .join("") +

      '</div></section>';

    root.innerHTML =
      html;

    maybePromptReflection();
  }

  function renderClasses() {
    const saved =
      classes();

    root.innerHTML =
      '<section class="card">' +

      '<span class="eyebrow">SAVED ON THIS DEVICE</span>' +

      '<h2>Set up your classes</h2>' +

      '<label class="field" for="subject">Subject</label>' +

      '<select id="subject">' +

      '<option value="">Choose a subject</option>' +

      Object.keys(
        catalog
      )
        .map(
          s =>
            '<option>' +
            esc(s) +
            '</option>'
        )
        .join("") +

      '</select>' +

      '<label class="field" for="course">Class</label>' +

      '<select id="course">' +

      '<option value="">Choose a subject first</option>' +

      '</select>' +

      '<div id="customWrap" hidden>' +

      '<label class="field" for="custom">Your class name</label>' +

      '<input id="custom" type="text" maxlength="100" placeholder="Class name, not your name">' +

      '</div>' +

      '<div class="actions">' +

      '<button class="primary" data-action="add-class">Add class</button>' +

      '</div>' +

      '</section>' +

      '<section class="card">' +

      '<h3>Your saved classes</h3>' +

      saved
        .map(
          (
            c,
            i
          ) =>
            '<div class="saved-row">' +

            '<div>' +

            '<strong>' +
            esc(
              c.name
            ) +
            '</strong>' +

            '<div class="small">' +
            esc(
              c.subject
            ) +
            '</div>' +

            '</div>' +

            '<button class="secondary" data-remove="' +
            i +
            '">Remove</button>' +

            '</div>'
        )
        .join("") +

      (
        saved.length
          ? '<div class="actions">' +

            '<button class="primary" data-nav="home">Done adding classes</button>' +

            '</div>'

          : '<p class="muted">Add at least one class to get started.</p>'
      ) +

      '</section>';

    $("subject").onchange =
      () => {
        const subject =
          $("subject").value;

        $("course").innerHTML =
          '<option value="">Choose a class</option>' +

          (
            catalog[
              subject
            ] ||
            []
          )
            .map(
              c =>
                '<option>' +
                esc(c) +
                '</option>'
            )
            .join("");

        $("customWrap").hidden =
          true;
      };

    $("course").onchange =
      () => {
        $("customWrap").hidden =
          !$(
            "course"
          ).value.startsWith(
            "Other"
          );
      };
  }

  function feedbackHtml(record) {
    if (
      !record ||
      !record.recommendation
    ) {
      return "";
    }

    const r =
      record.recommendation;

    return (
      '<div class="coach">' +

      '<span class="eyebrow">YOUR NEXT STEP</span>' +

      '<h3>' +
      esc(
        r.title
      ) +
      '</h3>' +

      '<p>' +
      esc(
        r.text
      ) +
      '</p>' +

      '<p class="small">Based on your ratings and recorded activity.</p>' +

      '<button type="button" class="text-button" ' +

      'data-coach-class="' +
      esc(
        record.className
      ) +
      '" ' +

      'data-coach-stage="' +
      Number(
        r.targetStage ||
        2
      ) +
      '">' +

      'Choose this next step →' +

      '</button>' +

      '</div>'
    );
  }

  function renderStages() {
    if (
      !chosenClass
    ) {
      screen =
        "home";

      render();

      return;
    }

    const week =
      weekStart(
        today()
      );

    const sum =
      summarize(
        rowsForClassWeek(
          chosenClass.name,
          week
        )
      );

    const recent =
      latestReflection(
        chosenClass.name
      );

    const advice =
      recent?.recommendation ||
      recommendation(
        sum
      );

    root.innerHTML =
      '<section class="card">' +

      '<div class="section-head">' +

      '<div>' +

      '<span class="eyebrow">STUDYING</span>' +

      '<h2>' +
      esc(
        chosenClass.name
      ) +
      '</h2>' +

      '</div>' +

      '<button class="secondary" data-nav="home">Change class</button>' +

      '</div>' +

      (
        recent
          ? feedbackHtml(
              recent
            )

          : sum.count
            ? '<div class="coach">' +

              '<h3>' +
              esc(
                advice.title
              ) +
              '</h3>' +

              '<p>' +
              esc(
                advice.text
              ) +
              '</p>' +

              '</div>'

            : ''
      ) +

      '<p class="muted">Choose any stage. The suggestions are options, not a required sequence.</p>' +

      '<div class="grid">' +

      [
        1,
        2,
        3
      ]
        .map(
          n =>
            '<button class="stage-button ' +

            (
              chosenStage ===
                n
                ? "selected"
                : ""
            ) +

            '" data-stage="' +
            n +
            '">' +

            '<span>Stage ' +
            n +
            '</span>' +

            '<strong>' +
            stages[n].name +
            '</strong>' +

            '<span>' +
            stages[n].purpose +
            '</span>' +

            '</button>'
        )
        .join("") +

      '</div>' +

      (
        chosenStage
          ? '<div class="stage-details">' +

            '<h3>Choose your ' +
            stages[
              chosenStage
            ].name +
            ' method</h3>' +

            '<div class="methods">' +

            stages[
              chosenStage
            ]
              .methods
              .map(
                (
                  method,
                  i
                ) =>
                  '<button class="method-button" data-method="' +
                  i +
                  '">' +

                  esc(
                    method
                  ) +

                  '</button>'
              )
              .join("") +

            '</div>' +

            '</div>'

          : ''
      ) +

      '</section>';
  }

  function openTimer(method) {
    if (active) {
      return;
    }

    if (
      method ===
      "Anki"
    ) {
      chosenStage =
        3;
    }

    active = {
      id:
        uid(),

      visitId:
        visitId ||
        uid(),

      className:
        chosenClass.name,

      subject:
        chosenClass.subject,

      stage:
        Number(
          chosenStage
        ),

      method,

      phase:
        "study",

      ms:
        0,

      runningSince:
        null,

      startedAt:
        null,

      lastSeen:
        Date.now(),

      record:
        null
    };

    saveActive();

    screen =
      "timer";

    render();
  }

  function renderTimer() {
    const crosscheck =
      active.phase ===
      "crosscheck";

    root.innerHTML =
      '<section class="card timer">' +

      '<span class="eyebrow">' +
      esc(
        active.className
      ) +
      '</span>' +

      '<h2>' +

      (
        crosscheck
          ? 'Crosscheck'
          : 'Stage ' +
            active.stage +
            ' — ' +
            stageName(
              active.stage
            )
      ) +

      '</h2>' +

      '<h3>' +
      esc(
        active.method
      ) +
      '</h3>' +

      '<p class="muted">' +

      (
        crosscheck
          ? 'Compare what you retrieved with notes or another reliable source. Correct the gap before moving on.'
          : stages[
              active.stage
            ].instruction
      ) +

      '</p>' +

      '<div id="clock" class="clock" role="timer">' +

      clock(
        elapsedMs() /
        1000
      ) +

      '</div>' +

      '<div class="actions">' +

      '<button class="primary" data-action="toggle-timer">' +

      (
        active.runningSince !==
          null
          ? 'Pause'

          : active.ms >
            0
            ? 'Resume'

            : crosscheck
              ? 'Start Crosscheck'

              : 'Start'
      ) +

      '</button>' +

      (
        active.startedAt ||
        crosscheck
          ? '<button class="secondary" data-action="finish-timer">' +

            (
              crosscheck
                ? 'Finish Crosscheck'
                : 'Finish stage'
            ) +

            '</button>'

          : ''
      ) +

      '<button class="text-button" data-action="' +

      (
        crosscheck
          ? 'skip-crosscheck'
          : 'cancel-timer'
      ) +

      '">' +

      (
        crosscheck
          ? 'Skip Crosscheck for now'
          : 'Cancel stage'
      ) +

      '</button>' +

      '</div>' +

      '<p class="small">Time is logged automatically. Do not enter names or grades.</p>' +

      '</section>';
  }

  function persistRecord(record) {
    const rows =
      sessions();

    const index =
      rows.findIndex(
        r =>
          (
            record.id &&
            r.id ===
              record.id
          ) ||
          r.timestamp ===
            record.timestamp
      );

    if (
      index >=
      0
    ) {
      rows[index] =
        record;

    } else {
      rows.push(
        record
      );
    }

    write(
      K.sessions,
      rows
    );

    try {
      queueStage(
        record
      );

    } catch (error) {
      message(
        "Saved on this device; upload will retry. " +
        error.message
      );
    }
  }

  function finishTimer(
    skipCrosscheck =
      false
  ) {
    if (!active) {
      return;
    }

    pauseTimer();

    if (
      active.phase ===
      "study"
    ) {
      if (
        !active.startedAt
      ) {
        message(
          "Start the timer before finishing."
        );

        return;
      }

      const now =
        new Date();

      const record = {
        id:
          active.id,

        visitId:
          active.visitId,

        startedAt:
          active.startedAt,

        timestamp:
          now.toISOString(),

        localDate:
          dateKey(now),

        className:
          active.className,

        subject:
          active.subject,

        stage:
          Number(
            active.stage
          ),

        stageName:
          stageName(
            active.stage
          ),

        method:
          active.method,

        studySeconds:
          Math.floor(
            active.ms /
            1000
          ),

        crosscheckSeconds:
          0,

        crosscheckFinishedAt:
          "",

        totalSeconds:
          Math.floor(
            active.ms /
            1000
          )
      };

      persistRecord(
        record
      );

      if (
        record.stage ===
          3 &&
        record.method ===
          "Anki"
      ) {
        const due =
          ankiDue();

        if (
          due.length
        ) {
          rawWrite(
            K.ankiDone +
            due[0],

            "1"
          );
        }
      }

      if (
        record.stage ===
        2
      ) {
        active.record =
          record;

        active.phase =
          "crosscheck";

        active.ms =
          0;

        active.runningSince =
          null;

        active.startedAt =
          null;

        saveActive();

        render();

        return;
      }

      completed =
        record;

    } else {
      const record =
        Object.assign(
          {},
          active.record
        );

      record.crosscheckSeconds =
        skipCrosscheck
          ? 0
          : Math.floor(
              active.ms /
              1000
            );

      record.crosscheckSkipped =
        skipCrosscheck;

      record.crosscheckFinishedAt =
        skipCrosscheck
          ? ""
          : new Date()
              .toISOString();

      record.totalSeconds =
        number(
          record.studySeconds
        ) +
        number(
          record.crosscheckSeconds
        );

      persistRecord(
        record
      );

      completed =
        record;
    }

    active =
      null;

    saveActive();

    screen =
      "complete";

    render();
  }

  function renderComplete() {
    if (
      !completed
    ) {
      screen =
        "home";

      render();

      return;
    }

    const next =
      completed.stage ===
        1
        ? "Retrieve What You Remember"

        : completed.stage ===
          2
          ? "Test Yourself Now"

          : "Choose Another Stage";

    root.innerHTML =
      '<section class="card">' +

      '<span class="eyebrow">SAVED ON THIS DEVICE</span>' +

      '<h2>Stage ' +
      completed.stage +
      ' — ' +
      stageName(
        completed.stage
      ) +
      ' complete</h2>' +

      '<p><strong>' +
      esc(
        completed.className
      ) +
      '</strong> · ' +

      esc(
        completed.method
      ) +
      ' · ' +

      human(
        completed.studySeconds
      ) +

      (
        completed.crosscheckSeconds
          ? ' + ' +
            human(
              completed.crosscheckSeconds
            ) +
            ' Crosscheck'

          : ''
      ) +

      '</p>' +

      '<div class="coach">' +

      '<h3>' +
      next +
      '</h3>' +

      '<p>' +

      (
        completed.stage ===
          2
          ? 'Ready to continue? Try a short independent Practice Test, Practice Problems, or Anki after your Crosscheck.'
          : 'Continue only if it serves your learning goal. You can also finish now.'
      ) +

      '</p>' +

      '</div>' +

      '<div class="actions">' +

      '<button class="primary" data-action="next-stage">' +
      next +
      '</button>' +

      '<button class="secondary" data-action="finish-visit">Finish studying</button>' +

      '</div>' +

      '</section>';
  }

  function ratingSummary(
    className,
    start,
    end
  ) {
    const records =
      Object.values(
        reflections()
      )
        .filter(
          r => {
            const sunday =
              addDays(
                r.weekStart,
                6
              );

            return (
              r.className ===
                className &&
              sunday >=
                start &&
              sunday <
                end
            );
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            a.weekStart
              .localeCompare(
                b.weekStart
              )
        );

    const learning =
      records.map(
        r =>
          Number(
            r.learningRating
          )
      );

    const assessment =
      records
        .filter(
          r =>
            r.hadAssessment
        )
        .map(
          r =>
            Number(
              r.assessmentRating
            )
        );

    const trend =
      values => {
        if (
          !values.length
        ) {
          return "not rated";
        }

        if (
          values.length ===
          1
        ) {
          return "one rating";
        }

        const first =
          values[0];

        const last =
          values[
            values.length -
            1
          ];

        if (
          last >
          first
        ) {
          return "higher than the first rating";
        }

        if (
          last <
          first
        ) {
          return "lower than the first rating";
        }

        return "same as the first rating";
      };

    return {
      records,
      learning,
      assessment,

      learningTrend:
        trend(
          learning
        ),

      assessmentTrend:
        trend(
          assessment
        )
    };
  }

  function renderProgress() {
    const allRows =
      sessions();

    const current =
      today();

    const keys =
      new Set(
        [
          periodKind ===
            "week"
            ? weekStart(
                current
              )
            : monthStart(
                current
              )
        ]
      );

    allRows.forEach(
      row => {
        const day =
          localDay(row);

        if (!day) {
          return;
        }

        keys.add(
          periodKind ===
            "week"
            ? weekStart(
                day
              )
            : monthStart(
                day
              )
        );
      }
    );

    Object.values(
      reflections()
    ).forEach(
      r => {
        if (
          !validDate(
            r.weekStart
          )
        ) {
          return;
        }

        keys.add(
          periodKind ===
            "week"
            ? r.weekStart

            : monthStart(
                addDays(
                  r.weekStart,
                  6
                )
              )
        );
      }
    );

    if (
      !keys.has(
        periodKey
      )
    ) {
      periodKey =
        [
          ...keys
        ]
          .sort()
          .reverse()[0];
    }

    const end =
      periodKind ===
        "week"
        ? addDays(
            periodKey,
            7
          )

        : nextMonth(
            periodKey
          );

    const selected =
      allRows.filter(
        row => {
          const day =
            localDay(row);

          return (
            day >=
              periodKey &&
            day <
              end
          );
        }
      );

    const summary =
      summarize(
        selected
      );

    const stageTotal =
      summary
        .stages[1]
        .seconds +

      summary
        .stages[2]
        .seconds +

      summary
        .stages[3]
        .seconds;

    let html =
      '<section class="card">' +

      '<span class="eyebrow">YOUR STUDY PATTERNS</span>' +

      '<h2>Progress & next steps</h2>' +

      '<div class="actions">' +

      '<button class="' +

      (
        periodKind ===
          "week"
          ? "primary"
          : "secondary"
      ) +

      '" data-period="week">Weekly</button>' +

      '<button class="' +

      (
        periodKind ===
          "month"
          ? "primary"
          : "secondary"
      ) +

      '" data-period="month">Monthly</button>' +

      '</div>' +

      '<label class="field" for="periodSelect">Choose a ' +
      periodKind +
      '</label>' +

      '<select id="periodSelect">' +

      [
        ...keys
      ]
        .sort()
        .reverse()
        .map(
          key =>
            '<option value="' +
            key +
            '" ' +

            (
              key ===
                periodKey
                ? "selected"
                : ""
            ) +

            '>' +

            (
              periodKind ===
                "week"
                ? esc(
                    rangeLabel(
                      key
                    )
                  )

                : esc(
                    new Date(
                      key +
                      "T12:00:00"
                    ).toLocaleDateString(
                      undefined,
                      {
                        month:
                          "long",

                        year:
                          "numeric"
                      }
                    )
                  )
            ) +

            '</option>'
        )
        .join("") +

      '</select>' +

      '</section>' +

      '<section class="card">' +

      '<div class="stats">' +

      '<div class="stat">' +

      '<span>Total time</span>' +

      '<strong>' +
      human(
        summary.seconds
      ) +
      '</strong>' +

      '</div>' +

      '<div class="stat">' +

      '<span>Completed stages</span>' +

      '<strong>' +
      summary.count +
      '</strong>' +

      '</div>' +

      '<div class="stat">' +

      '<span>Study days</span>' +

      '<strong>' +
      summary.days.length +
      '</strong>' +

      '</div>' +

      '</div>' +

      '<h3 style="margin-top:20px">Your study mix</h3>' +

      '<div class="mixbar" aria-hidden="true">' +

      [
        1,
        2,
        3
      ]
        .map(
          stage =>
            '<i class="' +

            (
              {
                1:
                  "learn",

                2:
                  "retrieval",

                3:
                  "assess"
              }
            )[
              stage
            ] +

            '" style="width:' +

            (
              stageTotal
                ? summary
                    .stages[
                      stage
                    ]
                    .seconds /
                  stageTotal *
                  100

                : 0
            ) +

            '%"></i>'
        )
        .join("") +

      '</div>' +

      '<div class="legend">' +

      [
        1,
        2,
        3
      ]
        .map(
          stage =>
            '<span>' +

            '<i class="dot ' +

            (
              {
                1:
                  "learn",

                2:
                  "retrieval",

                3:
                  "assess"
              }
            )[
              stage
            ] +

            '"></i>' +

            stageName(
              stage
            ) +

            ' ' +

            pct(
              summary
                .stages[
                  stage
                ]
                .seconds,

              stageTotal
            ) +

            '</span>'
        )
        .join("") +

      '</div>' +

      '<p class="small">' +

      'Stage percentages use study time, not Crosscheck. Crosscheck: ' +

      human(
        summary.crossSeconds
      ) +

      '. There is no required perfect percentage.' +

      '</p>' +

      '</section>';

    const periodRefs =
      Object.values(
        reflections()
      )
        .filter(
          r => {
            const sunday =
              addDays(
                r.weekStart,
                6
              );

            return (
              periodKind ===
                "week"
                ? r.weekStart ===
                  periodKey

                : sunday >=
                    periodKey &&
                  sunday <
                    end
            );
          }
        );

    const classNames =
      [
        ...new Set(
          [
            ...selected.map(
              r =>
                r.className
            ),

            ...periodRefs.map(
              r =>
                r.className
            )
          ]
        )
      ];

    classNames.forEach(
      className => {
        const classRows =
          selected.filter(
            r =>
              r.className ===
              className
          );

        const classSummary =
          summarize(
            classRows
          );

        const ref =
          periodKind ===
            "week"
            ? reflections()[
                reflectionKey(
                  periodKey,
                  className
                )
              ]

            : null;

        const latest =
          ref ||
          latestReflection(
            className,
            end
          );

        const advice =
          latest?.recommendation ||
          recommendation(
            classSummary
          );

        html +=
          '<section class="card">' +

          '<div class="section-head">' +

          '<div>' +

          '<span class="eyebrow">' +

          human(
            classSummary.seconds
          ) +

          ' · ' +

          classSummary.count +

          ' COMPLETED STAGES</span>' +

          '<h2>' +
          esc(
            className
          ) +
          '</h2>' +

          '</div>' +

          (
            periodKind ===
              "week" &&
            addDays(
              periodKey,
              6
            ) <=
              today()

              ? '<button class="secondary" data-reflection-class="' +

                esc(
                  className
                ) +

                '" data-week="' +

                periodKey +

                '">' +

                (
                  ref
                    ? 'Update ratings'
                    : 'Weekly check-in'
                ) +

                '</button>'

              : ''
          ) +

          '</div>';

        if (
          latest?.recommendation
        ) {
          html +=
            feedbackHtml(
              latest
            );

        } else {
          html +=
            '<div class="coach">' +

            '<h3>' +
            esc(
              advice.title
            ) +
            '</h3>' +

            '<p>' +
            esc(
              advice.text
            ) +
            '</p>' +

            '</div>';
        }

        if (
          periodKind ===
          "month"
        ) {
          const rating =
            ratingSummary(
              className,
              periodKey,
              end
            );

          html +=
            '<div class="coach">' +

            '<span class="eyebrow">MONTHLY OUTCOMES</span>' +

            '<p><strong>Learning:</strong> ' +

            (
              rating
                .learning
                .length
                ? rating
                    .learning
                    .join(
                      " → "
                    ) +
                  '/5 · ' +
                  rating
                    .learningTrend

                : 'not rated'
            ) +

            '</p>' +

            '<p><strong>Assessment:</strong> ' +

            (
              rating
                .assessment
                .length
                ? rating
                    .assessment
                    .join(
                      " → "
                    ) +
                  '/5 · ' +
                  rating
                    .assessmentTrend

                : 'no assessment ratings in this month'
            ) +

            '</p>' +

            '<p class="small">' +

            'Learning and assessment are shown separately. One assessment is one result, not a trend.' +

            '</p>' +

            '</div>';
        }

        html +=
          '<details>' +

          '<summary>Methods within each stage</summary>';

        [
          1,
          2,
          3
        ].forEach(
          stage => {
            const s =
              classSummary
                .stages[
                  stage
                ];

            const methods =
              Object.entries(
                s.methods
              )
                .sort(
                  (
                    a,
                    b
                  ) =>
                    b[1].count -
                    a[1].count
                );

            html +=
              '<div class="stage-details">' +

              '<h3>' +
              stageName(
                stage
              ) +
              '</h3>';

            if (
              !methods.length
            ) {
              html +=
                '<p class="small">' +

                'No ' +

                stageName(
                  stage
                ) +

                ' stage logged in this period.' +

                '</p>';

            } else {
              html +=
                '<div class="table-wrap">' +

                '<table>' +

                '<thead>' +

                '<tr>' +

                '<th>Method</th>' +

                '<th class="num">Uses</th>' +

                '<th class="num">% of uses</th>' +

                '<th class="num">Time</th>' +

                '</tr>' +

                '</thead>' +

                '<tbody>' +

                methods
                  .map(
                    (
                      [
                        method,
                        data
                      ]
                    ) =>
                      '<tr>' +

                      '<td>' +
                      esc(
                        method
                      ) +
                      '</td>' +

                      '<td class="num">' +
                      data.count +
                      '</td>' +

                      '<td class="num">' +
                      pct(
                        data.count,
                        s.count
                      ) +
                      '</td>' +

                      '<td class="num">' +
                      human(
                        data.seconds
                      ) +
                      '</td>' +

                      '</tr>'
                  )
                  .join("") +

                '</tbody>' +

                '</table>' +

                '</div>';
            }

            html +=
              '</div>';
          }
        );

        html +=
          '</details>';

        const recentEight =
          historyList()
            .filter(
              r =>
                r.className ===
                className
            )
            .sort(
              (
                a,
                b
              ) =>
                b.weekStart
                  .localeCompare(
                    a.weekStart
                  )
            )
            .slice(
              0,
              8
            );

        if (
          recentEight.length
        ) {
          html +=
            '<details>' +

            '<summary>My longer-term pattern · recent check-ins</summary>' +

            recentEight
              .map(
                r =>
                  '<p class="small">' +

                  '<strong>' +
                  esc(
                    rangeLabel(
                      r.weekStart
                    )
                  ) +
                  '</strong> · ' +

                  'learning ' +
                  esc(
                    r.learningRating
                  ) +
                  '/5 · ' +

                  (
                    r.hadAssessment
                      ? 'assessment ' +
                        esc(
                          r.assessmentRating
                        ) +
                        '/5'

                      : 'no assessment'
                  ) +

                  '<br>' +

                  esc(
                    r.recommendation?.text ||
                    'No recommendation saved'
                  ) +

                  '</p>'
              )
              .join("") +

            '</details>';
        }

        html +=
          '</section>';
      }
    );

    if (
      !classNames.length
    ) {
      html +=
        '<section class="card">' +

        '<p>No completed stages in this period.</p>' +

        '</section>';
    }

    if (
      periodKind ===
      "week"
    ) {
      html +=
        '<section class="card">' +

        '<h3>Weekly summary</h3>' +

        '<p class="small">' +

        'Stages and check-ins sync automatically. This also sends the compatible weekly aggregate.' +

        '</p>' +

        '<button class="secondary" data-action="weekly-share">' +

        'Share / update weekly summary' +

        '</button>' +

        '</section>';
    }

    root.innerHTML =
      html;

    $("periodSelect").onchange =
      () => {
        periodKey =
          $("periodSelect").value;

        render();
      };
  }

  function ratingField(
    name,
    label
  ) {
    return (
      '<fieldset>' +

      '<legend>' +
      label +
      '</legend>' +

      '<div class="rating-grid">' +

      [
        1,
        2,
        3,
        4,
        5
      ]
        .map(
          n =>
            '<label class="rating-option">' +

            '<input type="radio" name="' +
            name +
            '" value="' +
            n +
            '" aria-label="' +
            n +
            ' out of 5">' +

            '<span>' +
            n +
            '</span>' +

            '</label>'
        )
        .join("") +

      '</div>' +

      '<div class="scale">' +

      '<span>1 · Not well</span>' +

      '<span>5 · Very well</span>' +

      '</div>' +

      (
        name ===
          "assessment"
          ? '<label class="none-option">' +

            '<input type="radio" name="assessment" value="none">' +

            ' No assessment this week' +

            '</label>'

          : ''
      ) +

      '</fieldset>'
    );
  }

  function openReflection(
    target = null
  ) {
    if (active) {
      return;
    }

    const due =
      pendingReflections();

    reflectionTarget =
      target ||
      due[0];

    if (
      !reflectionTarget
    ) {
      message(
        "All due check-ins are answered."
      );

      return;
    }

    const saved =
      reflections()[
        reflectionKey(
          reflectionTarget.weekStart,
          reflectionTarget.className
        )
      ];

    dialog.innerHTML =
      '<form id="reflectionForm">' +

      '<span class="badge">WEEKLY CHECK-IN</span>' +

      '<h2 id="reflectionTitle">' +
      esc(
        reflectionTarget.className
      ) +
      '</h2>' +

      '<p class="small">' +
      esc(
        rangeLabel(
          reflectionTarget.weekStart
        )
      ) +
      '</p>' +

      '<p>' +

      'Think about this class during the dates above. These are self-ratings, not a grade submission.' +

      '</p>' +

      ratingField(
        "learning",
        "How well did your learning go?"
      ) +

      ratingField(
        "assessment",
        "How well did your quizzes, tests, or graded assessments go?"
      ) +

      '<p class="small">' +

      'Choose “No assessment this week” when there was no graded assessment. That does not count as a zero and does not block learning feedback.' +

      '</p>' +

      '<div class="actions">' +

      '<button class="primary" type="submit">' +

      'Save ratings & see my next step' +

      '</button>' +

      '<button class="secondary" type="button" id="laterReflection">' +

      'Study first' +

      '</button>' +

      '</div>' +

      '<p id="reflectionError" role="alert"></p>' +

      '</form>';

    if (saved) {
      const l =
        dialog.querySelector(
          'input[name="learning"][value="' +
          Number(
            saved.learningRating
          ) +
          '"]'
        );

      const a =
        dialog.querySelector(
          'input[name="assessment"][value="' +

          (
            saved.hadAssessment
              ? Number(
                  saved.assessmentRating
                )
              : "none"
          ) +

          '"]'
        );

      if (l) {
        l.checked =
          true;
      }

      if (a) {
        a.checked =
          true;
      }
    }

    $("laterReflection").onclick =
      () => {
        reminderDismissed =
          true;

        dialog.close();
      };

    $("reflectionForm").onsubmit =
      event => {
        event.preventDefault();

        try {
          const data =
            new FormData(
              event.target
            );

          const learning =
            Number(
              data.get(
                "learning"
              )
            );

          const assessmentAnswer =
            data.get(
              "assessment"
            );

          if (
            ![
              1,
              2,
              3,
              4,
              5
            ].includes(
              learning
            ) ||
            ![
              "1",
              "2",
              "3",
              "4",
              "5",
              "none"
            ].includes(
              assessmentAnswer
            )
          ) {
            throw new Error(
              "Answer both questions, or choose No assessment this week."
            );
          }

          const className =
            reflectionTarget.className;

          const week =
            reflectionTarget.weekStart;

          const rows =
            rowsForClassWeek(
              className,
              week
            );

          const snapshot =
            summarize(
              rows
            );

          const record = {
            ownerDeviceId:
              deviceId(),

            className,

            weekStart:
              week,

            timestamp:
              new Date()
                .toISOString(),

            revisionId:
              uid(),

            learningRating:
              learning,

            hadAssessment:
              assessmentAnswer !==
              "none",

            assessmentRating:
              assessmentAnswer ===
                "none"
                ? null
                : Number(
                    assessmentAnswer
                  ),

            snapshot
          };

          const previous =
            previousReflection(
              className,
              week
            );

          record.recommendation =
            recommendation(
              snapshot,
              record,
              previous
            );

          saveReflection(
            record
          );

          try {
            rows.forEach(
              queueStage
            );

            queueReflection(
              record
            );

          } catch (error) {
            message(
              "Ratings saved locally. Upload will retry. " +
              error.message
            );
          }

          dialog.innerHTML =
            '<span class="badge">RATINGS SAVED ON THIS DEVICE</span>' +

            '<h2 id="reflectionTitle">Your week in ' +
            esc(
              className
            ) +
            '</h2>' +

            '<p>' +

            '<strong>Learning:</strong> ' +
            learning +
            '/5<br>' +

            '<strong>Assessment:</strong> ' +

            (
              record.hadAssessment
                ? record.assessmentRating +
                  '/5'
                : 'No assessment this week'
            ) +

            '</p>' +

            feedbackHtml(
              record
            ) +

            '<div class="actions">' +

            '<button class="primary" id="doneReflection">' +

            'Continue' +

            '</button>' +

            '</div>';

          $("doneReflection").onclick =
            () => {
              dialog.close();

              reminderDismissed =
                false;

              screen =
                "home";

              render();
            };

          updateSync();

        } catch (error) {
          $("reflectionError").textContent =
            error.message;
        }
      };

    if (
      !dialog.open
    ) {
      dialog.showModal();
    }
  }

  function maybePromptReflection() {
    if (
      screen !==
        "home" ||
      active ||
      dialog.open ||
      reminderDismissed ||
      !pendingReflections().length
    ) {
      return;
    }

    setTimeout(
      () => {
        if (
          screen ===
            "home" &&
          !active &&
          !dialog.open &&
          !reminderDismissed
        ) {
          openReflection();
        }
      },

      80
    );
  }

  function enqueue(
    key,
    payload
  ) {
    const queue =
      read(
        K.queue,
        []
      );

    const receipts =
      read(
        K.sync,
        {}
      );

    const fingerprint =
      JSON.stringify(
        payload
      );

    if (
      receipts[key] ===
      fingerprint
    ) {
      return;
    }

    const existing =
      queue.find(
        item =>
          item.key ===
          key
      );

    if (
      existing &&
      existing.fingerprint ===
        fingerprint
    ) {
      return;
    }

    const item = {
      key,
      payload,
      fingerprint,

      revision:
        uid(),

      attempts:
        0,

      nextTry:
        0
    };

    const index =
      queue.findIndex(
        q =>
          q.key ===
          key
      );

    if (
      index >=
      0
    ) {
      queue[index] =
        item;

    } else {
      queue.push(
        item
      );
    }

    write(
      K.queue,
      queue
    );

    updateSync();

    setTimeout(
      () =>
        syncQueue(),

      0
    );
  }

  function queueStage(record) {
    enqueue(
      "stage:" +
      deviceId() +
      ":" +
      record.timestamp,

      {
        action:
          "submitStage",

        deviceId:
          deviceId(),

        sessionId:
          record.id ||
          "",

        visitId:
          record.visitId ||
          "",

        startedAt:
          record.startedAt ||
          "",

        timestamp:
          record.timestamp,

        localDate:
          localDay(
            record
          ),

        className:
          record.className,

        subject:
          record.subject ||
          "",

        stage:
          record.stage,

        stageName:
          stageName(
            record.stage
          ),

        method:
          record.method,

        studySeconds:
          number(
            record.studySeconds
          ),

        crosscheckSeconds:
          number(
            record.crosscheckSeconds
          ),

        crosscheckFinishedAt:
          record.crosscheckFinishedAt ||
          "",

        totalSeconds:
          number(
            record.studySeconds
          ) +
          number(
            record.crosscheckSeconds
          )
      }
    );
  }

  function queueReflection(record) {
    enqueue(
      "reflection:" +
      deviceId() +
      ":" +
      reflectionKey(
        record.weekStart,
        record.className
      ) +
      ":" +
      record.revisionId,

      {
        action:
          "submitReflection",

        deviceId:
          deviceId(),

        weekStart:
          record.weekStart,

        className:
          record.className,

        timestamp:
          record.timestamp,

        revisionId:
          record.revisionId,

        learningRating:
          record.learningRating,

        hadAssessment:
          record.hadAssessment,

        assessmentRating:
          record.hadAssessment
            ? record.assessmentRating
            : "",

        snapshotJson:
          JSON.stringify(
            record.snapshot
          ),

        recommendationCode:
          record.recommendation.code,

        recommendationText:
          record.recommendation.text,

        ruleVersion:
          record.recommendation.version
      }
    );
  }

  function updateSync() {
    const status =
      $("syncStatus");

    if (!status) {
      return;
    }

    let queue = [];

    try {
      queue =
        read(
          K.queue,
          []
        );

    } catch (error) {
      status.textContent =
        "Saved locally; sync status unavailable.";

      return;
    }

    status.textContent =
      syncBusy
        ? "Sending saved data…"

        : queue.length
          ? queue.length +

            " item" +

            (
              queue.length ===
                1
                ? ""
                : "s"
            ) +

            " saved locally; waiting for Google confirmation." +

            (
              lastError
                ? " " +
                  lastError
                : ""
            )

          : "New uploads are up to date. Your study history stays saved on this device.";
  }

  function post(payload) {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const endpoint =
          window.STUDY_TRACKER_WEEKLY_ENDPOINT;

        if (
          !endpoint
        ) {
          reject(
            new Error(
              "Backend URL missing."
            )
          );

          return;
        }

        if (
          location.protocol ===
          "file:"
        ) {
          reject(
            new Error(
              "Open the GitHub Pages site to sync."
            )
          );

          return;
        }

        const requestId =
          uid();

        const frame =
          document.createElement(
            "iframe"
          );

        const form =
          document.createElement(
            "form"
          );

        frame.name =
          "study_upload_" +

          requestId.replace(
            /[^a-z0-9]/gi,
            ""
          );

        frame.hidden =
          true;

        frame.title =
          "Study data submission";

        form.method =
          "POST";

        form.action =
          endpoint;

        form.target =
          frame.name;

        form.hidden =
          true;

        Object.entries(
          Object.assign(
            {},
            payload,
            {
              requestId,

              replyOrigin:
                location.origin
            }
          )
        ).forEach(
          (
            [
              key,
              value
            ]
          ) => {
            const input =
              document.createElement(
                "input"
              );

            input.type =
              "hidden";

            input.name =
              key;

            input.value =
              String(
                value ??
                ""
              );

            form.appendChild(
              input
            );
          }
        );

        const cleanup =
          () => {
            clearTimeout(
              timeout
            );

            window.removeEventListener(
              "message",
              receive
            );

            frame.remove();

            form.remove();
          };

        const receive =
          event => {
            const validOrigin =
              event.origin ===
                "https://script.google.com" ||

              event.origin ===
                "https://script.googleusercontent.com" ||

              /^https:\/\/[a-z0-9-]+[.-]script\.googleusercontent\.com$/i.test(
                event.origin
              );

            if (
              !validOrigin ||
              !event.data ||
              event.data.channel !==
                "study-coach-ack" ||
              event.data.requestId !==
                requestId
            ) {
              return;
            }

            cleanup();

            if (
              event.data.ok
            ) {
              resolve(
                event.data
              );

            } else {
              reject(
                new Error(
                  event.data.message ||
                  "Google did not accept this item."
                )
              );
            }
          };

        const timeout =
          setTimeout(
            () => {
              cleanup();

              reject(
                new Error(
                  "No confirmation yet. It will retry."
                )
              );
            },

            45000
          );

        window.addEventListener(
          "message",
          receive
        );

        document.body.append(
          frame,
          form
        );

        form.submit();
      }
    );
  }

  async function syncQueue(
    force = false
  ) {
    if (
      syncBusy ||
      !navigator.onLine
    ) {
      return;
    }

    try {
      const queue =
        read(
          K.queue,
          []
        );

      const item =
        queue.find(
          q =>
            force ||
            !q.nextTry ||
            q.nextTry <=
              Date.now()
        );

      if (!item) {
        updateSync();

        return;
      }

      syncBusy =
        true;

      updateSync();

      try {
        await post(
          item.payload
        );

        const latest =
          read(
            K.queue,
            []
          ).filter(
            q =>
              !(
                q.key ===
                  item.key &&
                q.revision ===
                  item.revision
              )
          );

        write(
          K.queue,
          latest
        );

        const receipts =
          read(
            K.sync,
            {}
          );

        receipts[
          item.key
        ] =
          item.fingerprint;

        write(
          K.sync,
          receipts
        );

        lastError =
          "";

      } catch (error) {
        lastError =
          error.message;

        const latest =
          read(
            K.queue,
            []
          );

        const found =
          latest.find(
            q =>
              q.key ===
                item.key &&
              q.revision ===
                item.revision
          );

        if (found) {
          found.attempts++;

          found.nextTry =
            Date.now() +

            Math.min(
              600000,

              15000 *
              Math.pow(
                2,

                Math.min(
                  found.attempts,
                  6
                )
              )
            );

          write(
            K.queue,
            latest
          );
        }

      } finally {
        syncBusy =
          false;

        updateSync();
      }

      setTimeout(
        () =>
          syncQueue(),

        1000
      );

    } catch (error) {
      syncBusy =
        false;

      message(
        error.message
      );
    }
  }

  function shareWeek() {
    const end =
      addDays(
        periodKey,
        7
      );

    const summary =
      summarize(
        sessions()
          .filter(
            row => {
              const day =
                localDay(
                  row
                );

              return (
                day >=
                  periodKey &&
                day <
                  end
              );
            }
          )
      );

    if (
      !summary.count
    ) {
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
        action:
          "submitWeekly",

        deviceId:
          deviceId(),

        weekStart:
          periodKey,

        totalSeconds:
          summary.seconds,

        studyDays:
          summary.days.length,

        stage1Seconds:
          summary
            .stages[1]
            .seconds,

        stage2Seconds:
          summary
            .stages[2]
            .seconds,

        stage3Seconds:
          summary
            .stages[3]
            .seconds,

        crosscheckSeconds:
          summary.crossSeconds,

        stageCount:
          summary.count,

        classesJson:
          JSON.stringify(
            summary.classes
          ),

        methodCountsJson:
          JSON.stringify(
            summary.methods
          )
      }
    );

    const history =
      read(
        K.submissions,
        {}
      );

    history[
      periodKey
    ] =
      new Date()
        .toISOString();

    write(
      K.submissions,
      history
    );

    message(
      "Weekly summary queued. The sync bar shows when Google confirms it."
    );
  }

  /*
    --------------------------------------------------
    BACKUP / RECOVERY
    --------------------------------------------------
  */

  function backupData() {
    const data =
      {};

    for (
      let i = 0;
      i <
      localStorage.length;
      i++
    ) {
      const key =
        localStorage.key(
          i
        );

      if (
        key &&
        key.startsWith(
          "studySystem."
        )
      ) {
        data[key] =
          localStorage.getItem(
            key
          );
      }
    }

    return {
      format:
        "Study System Backup",

      version:
        2,

      exportedAt:
        new Date()
          .toISOString(),

      recoveryId:
        deviceId(),

      data
    };
  }

  function exportBackup() {
    const blob =
      new Blob(
        [
          JSON.stringify(
            backupData(),
            null,
            2
          )
        ],

        {
          type:
            "application/json"
        }
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      URL.createObjectURL(
        blob
      );

    link.download =
      "study-system-backup-" +
      today() +
      ".json";

    link.click();

    setTimeout(
      () =>
        URL.revokeObjectURL(
          link.href
        ),

      5000
    );

    message(
      "Backup exported. Keep it somewhere safe."
    );
  }

  function renderBackup() {
    const recoveryId =
      deviceId();

    root.innerHTML =
      '<section class="card">' +

      '<span class="eyebrow">BACKUP & RECOVERY</span>' +

      '<h2>Keep your study history safe</h2>' +

      '<div class="coach">' +

      '<span class="eyebrow">YOUR ANONYMOUS RECOVERY ID</span>' +

      '<h3 id="recoveryIdDisplay">' +
      esc(
        recoveryId
      ) +
      '</h3>' +

      '<p class="small">' +

      'This ID should stay exactly the same when you refresh, close the page, or return later in this same browser. Studying, syncing, or answering a check-in should not change it.' +

      '</p>' +

      '<button class="secondary" data-action="copy-recovery-id">' +

      'Copy recovery ID' +

      '</button>' +

      '</div>' +

      '<p>' +

      'Your classes and study history are stored on this browser. Export a backup before clearing website data or changing devices.' +

      '</p>' +

      '<div class="actions">' +

      '<button class="primary" data-action="export">' +

      'Export my backup' +

      '</button>' +

      '<button class="secondary" data-action="import">' +

      'Restore / merge a backup' +

      '</button>' +

      '</div>' +

      '<p class="small">' +

      'A normal refresh should never create a new recovery ID.' +

      '</p>' +

      '</section>';
  }

  async function restoreBackup(file) {
    const backup =
      JSON.parse(
        await file.text()
      );

    if (
      !backup ||
      backup.format !==
        "Study System Backup" ||
      !backup.data ||
      typeof backup.data !==
        "object"
    ) {
      throw new Error(
        "Choose a valid Study System backup JSON file."
      );
    }

    const backupId =
      cleanDeviceId(
        backup.recoveryId ||
        backup.data[
          K.device
        ]
      );

    const currentId =
      deviceId();

    const hasCurrentStudyData =
      classes().length >
        0 ||

      sessions().length >
        0 ||

      Object.keys(
        reflections()
      ).length >
        0 ||

      Object.keys(
        reflectionHistory()
      ).length >
        0;

    if (
      backupId &&
      backupId !==
        currentId &&
      hasCurrentStudyData
    ) {
      throw new Error(
        "This backup belongs to a different recovery ID. This browser already contains Study System data, so the app will not mix the two identities."
      );
    }

    let adoptBackupId =
      false;

    if (
      backupId &&
      backupId !==
        currentId &&
      !hasCurrentStudyData
    ) {
      adoptBackupId =
        confirm(
          "This empty browser has a different recovery ID. Restore this backup and adopt its recovery ID?"
        );

      if (
        !adoptBackupId
      ) {
        return;
      }
    }

    if (
      !confirm(
        "Merge this backup into this browser? Existing study records will be retained."
      )
    ) {
      return;
    }

    const parseStored =
      (
        key,
        fallback
      ) => {
        if (
          backup.data[
            key
          ] ===
            undefined ||
          backup.data[
            key
          ] ===
            null
        ) {
          return fallback;
        }

        try {
          return JSON.parse(
            backup.data[
              key
            ]
          );

        } catch (error) {
          return fallback;
        }
      };

    const incomingClasses =
      parseStored(
        K.classes,
        []
      );

    const incomingSessions =
      parseStored(
        K.sessions,
        []
      );

    const incomingRefs =
      parseStored(
        K.reflections,
        {}
      );

    const incomingHistory =
      parseStored(
        K.history,
        {}
      );

    if (
      !Array.isArray(
        incomingClasses
      ) ||
      !Array.isArray(
        incomingSessions
      )
    ) {
      throw new Error(
        "This backup contains invalid class or session data."
      );
    }

    const mergedClasses =
      classes();

    incomingClasses.forEach(
      c => {
        if (
          c &&
          typeof c.name ===
            "string" &&
          !mergedClasses.some(
            x =>
              String(
                x.name
              ).toLowerCase() ===
              String(
                c.name
              ).toLowerCase()
          )
        ) {
          mergedClasses.push(
            c
          );
        }
      }
    );

    const mergedSessions =
      sessions();

    incomingSessions.forEach(
      record => {
        if (
          !record ||
          ![
            1,
            2,
            3
          ].includes(
            Number(
              record.stage
            )
          ) ||
          !record.timestamp
        ) {
          return;
        }

        const index =
          mergedSessions.findIndex(
            existing =>
              (
                record.id &&
                existing.id ===
                  record.id
              ) ||
              existing.timestamp ===
                record.timestamp
          );

        if (
          index <
          0
        ) {
          mergedSessions.push(
            record
          );

        } else if (
          number(
            record.totalSeconds
          ) >
          number(
            mergedSessions[
              index
            ].totalSeconds
          )
        ) {
          mergedSessions[
            index
          ] =
            record;
        }
      }
    );

    const mergedRefs =
      reflections();

    Object.entries(
      incomingRefs ||
      {}
    ).forEach(
      (
        [
          key,
          record
        ]
      ) => {
        if (
          record &&
          (
            !mergedRefs[
              key
            ] ||
            String(
              record.timestamp
            ) >
            String(
              mergedRefs[
                key
              ].timestamp
            )
          )
        ) {
          mergedRefs[
            key
          ] =
            record;
        }
      }
    );

    const mergedHistory =
      reflectionHistory();

    Object.entries(
      incomingHistory ||
      {}
    ).forEach(
      (
        [
          key,
          record
        ]
      ) => {
        if (
          record &&
          record.className &&
          record.weekStart &&
          record.timestamp
        ) {
          mergedHistory[
            key
          ] =
            record;
        }
      }
    );

    Object.values(
      mergedRefs
    ).forEach(
      record => {
        if (
          !record ||
          !record.timestamp
        ) {
          return;
        }

        const key =
          record.revisionId ||

          JSON.stringify(
            [
              record.className,
              record.weekStart,
              record.timestamp
            ]
          );

        mergedHistory[
          key
        ] =
          record;
      }
    );

    write(
      K.classes,
      mergedClasses
    );

    write(
      K.sessions,
      mergedSessions
    );

    write(
      K.reflections,
      mergedRefs
    );

    write(
      K.history,
      mergedHistory
    );

    /*
      An empty browser may adopt the backup's ID.
      An existing browser keeps its established ID.
    */
    if (
      adoptBackupId &&
      backupId
    ) {
      rawWrite(
        K.device,
        backupId
      );

      stableDeviceId =
        backupId;

    } else {
      rawWrite(
        K.device,
        currentId
      );

      stableDeviceId =
        currentId;
    }

    Object.entries(
      backup.data
    ).forEach(
      (
        [
          key,
          value
        ]
      ) => {
        if (
          (
            key.startsWith(
              K.ankiDone
            ) ||
            key.startsWith(
              K.ankiHide
            )
          ) &&
          value !==
            null
        ) {
          rawWrite(
            key,
            value
          );
        }
      }
    );

    if (
      backup.data[
        K.start
      ] &&
      validDate(
        backup.data[
          K.start
        ]
      )
    ) {
      const currentStart =
        localStorage.getItem(
          K.start
        );

      rawWrite(
        K.start,

        currentStart &&
        currentStart <
          backup.data[
            K.start
          ]
          ? currentStart
          : backup.data[
              K.start
            ]
      );
    }

    mergedSessions
      .filter(
        r =>
          r.id
      )
      .forEach(
        queueStage
      );

    Object.values(
      mergedHistory
    )
      .filter(
        r =>
          r.revisionId &&
          r.recommendation &&
          r.snapshot
      )
      .forEach(
        queueReflection
      );

    message(
      "Backup merged. Your existing records were retained."
    );

    render();
  }

  $("backupInput").onchange =
    async event => {
      try {
        const file =
          event.target.files[0];

        if (!file) {
          return;
        }

        await restoreBackup(
          file
        );

      } catch (error) {
        message(
          error.message
        );

      } finally {
        event.target.value =
          "";
      }
    };

  /*
    --------------------------------------------------
    BUTTONS
    --------------------------------------------------
  */

  document.addEventListener(
    "click",

    safe(
      event => {
        const button =
          event.target.closest(
            "button"
          );

        if (!button) {
          return;
        }

        if (
          button.dataset.nav
        ) {
          launchAnki =
            false;

          if (
            button.dataset.nav ===
            "home"
          ) {
            chosenClass =
              null;

            reminderDismissed =
              false;
          }

          navigate(
            button.dataset.nav
          );

          return;
        }

        if (
          button.dataset.class !==
          undefined
        ) {
          chosenClass =
            classes()[
              Number(
                button.dataset.class
              )
            ];

          visitId =
            uid();

          chosenStage =
            launchAnki
              ? 3
              : null;

          if (
            launchAnki
          ) {
            launchAnki =
              false;

            openTimer(
              "Anki"
            );

          } else {
            screen =
              "stage";

            render();
          }

          return;
        }

        if (
          button.dataset.stage
        ) {
          chosenStage =
            Number(
              button.dataset.stage
            );

          render();

          return;
        }

        if (
          button.dataset.method !==
          undefined
        ) {
          openTimer(
            stages[
              chosenStage
            ].methods[
              Number(
                button.dataset.method
              )
            ]
          );

          return;
        }

        if (
          button.dataset.remove !==
          undefined
        ) {
          const list =
            classes();

          list.splice(
            Number(
              button.dataset.remove
            ),
            1
          );

          write(
            K.classes,
            list
          );

          render();

          return;
        }

        if (
          button.dataset.period
        ) {
          periodKind =
            button.dataset.period;

          periodKey =
            periodKind ===
              "week"
              ? weekStart(
                  today()
                )
              : monthStart(
                  today()
                );

          render();

          return;
        }

        if (
          button.dataset.reflectionClass
        ) {
          openReflection(
            {
              className:
                button.dataset.reflectionClass,

              weekStart:
                button.dataset.week
            }
          );

          return;
        }

        if (
          button.dataset.coachClass
        ) {
          if (
            dialog.open
          ) {
            dialog.close();
          }

          chosenClass =
            classes()
              .find(
                c =>
                  c.name ===
                  button.dataset.coachClass
              ) ||
            {
              name:
                button.dataset.coachClass,

              subject:
                ""
            };

          chosenStage =
            Number(
              button.dataset.coachStage ||
              2
            );

          visitId =
            uid();

          screen =
            "stage";

          render();

          return;
        }

        switch (
          button.dataset.action
        ) {
          case "add-class": {
            const subject =
              $("subject").value;

            const course =
              $("course").value;

            const name =
              course.startsWith(
                "Other"
              )
                ? $("custom")
                    .value
                    .trim()

                : course;

            if (
              !subject ||
              !name
            ) {
              message(
                "Choose a subject and class."
              );

              return;
            }

            const list =
              classes();

            if (
              !list.some(
                c =>
                  c.name
                    .toLowerCase() ===
                  name
                    .toLowerCase()
              )
            ) {
              list.push(
                {
                  name,
                  subject
                }
              );

              write(
                K.classes,
                list
              );
            }

            message(
              "Class saved."
            );

            render();

            break;
          }

          case "anki":
            launchAnki =
              true;

            reminderDismissed =
              true;

            message(
              "Choose a class. Anki opens under Stage 3 — Assess."
            );

            break;

          case "hide-anki":
            rawWrite(
              K.ankiHide +
              today(),

              "1"
            );

            render();

            break;

          case "toggle-timer":
            if (
              active.runningSince !==
              null
            ) {
              pauseTimer();

            } else {
              active.runningSince =
                Date.now();

              if (
                !active.startedAt
              ) {
                active.startedAt =
                  new Date()
                    .toISOString();
              }

              saveActive();
            }

            render();

            break;

          case "finish-timer":
            finishTimer(
              false
            );

            break;

          case "skip-crosscheck":
            finishTimer(
              true
            );

            break;

          case "cancel-timer":
            if (
              confirm(
                "Cancel this unfinished stage? It will not be added to your completed stages."
              )
            ) {
              active =
                null;

              saveActive();

              screen =
                "stage";

              render();
            }

            break;

          case "next-stage":
            chosenClass = {
              name:
                completed.className,

              subject:
                completed.subject
            };

            visitId =
              completed.visitId;

            chosenStage =
              completed.stage ===
                1
                ? 2

                : completed.stage ===
                  2
                  ? 3

                  : null;

            screen =
              "stage";

            render();

            break;

          case "finish-visit":
            visitId =
              null;

            completed =
              null;

            chosenClass =
              null;

            chosenStage =
              null;

            reminderDismissed =
              false;

            screen =
              "home";

            render();

            break;

          case "reflect":
            openReflection();

            break;

          case "weekly-share":
            shareWeek();

            break;

          case "copy-recovery-id": {
            const id =
              deviceId();

            if (
              navigator.clipboard &&
              navigator.clipboard.writeText
            ) {
              navigator.clipboard
                .writeText(
                  id
                )
                .then(
                  () =>
                    message(
                      "Recovery ID copied."
                    )
                )
                .catch(
                  () =>
                    message(
                      "Could not copy automatically. Select the recovery ID and copy it manually."
                    )
                );

            } else {
              message(
                "Select the recovery ID and copy it manually."
              );
            }

            break;
          }

          case "export":
            exportBackup();

            break;

          case "import":
            $("backupInput").click();

            break;
        }
      }
    )
  );

  $("syncNow").onclick =
    () =>
      syncQueue(
        true
      );

  dialog.addEventListener(
    "cancel",

    () => {
      reminderDismissed =
        true;
    }
  );

  window.addEventListener(
    "online",

    () =>
      syncQueue(
        true
      )
  );

  document.addEventListener(
    "visibilitychange",

    safe(
      () => {
        if (
          document.visibilityState ===
          "hidden"
        ) {
          if (active) {
            saveActive();
          }

        } else {
          reminderDismissed =
            false;

          if (
            screen ===
            "home"
          ) {
            render();
          }

          syncQueue();
        }
      }
    )
  );

  window.addEventListener(
    "pagehide",

    safe(
      () => {
        if (active) {
          saveActive();
        }
      }
    )
  );

  /*
    If another tab changes the recovery ID,
    do not silently accept the change.
  */
  window.addEventListener(
    "storage",

    safe(
      event => {
        if (
          [
            K.classes,
            K.sessions,
            K.reflections,
            K.device
          ].includes(
            event.key
          ) &&
          !active &&
          !dialog.open
        ) {
          if (
            event.key ===
            K.device
          ) {
            const current =
              cleanDeviceId(
                event.newValue
              );

            if (
              stableDeviceId &&
              current &&
              current !==
                stableDeviceId
            ) {
              message(
                "The recovery ID changed in another tab. Export a backup before continuing."
              );

              return;
            }
          }

          render();
        }
      }
    )
  );

  setInterval(
    safe(
      () => {
        if (active) {
          const clockEl =
            $("clock");

          if (
            clockEl
          ) {
            clockEl.textContent =
              clock(
                elapsedMs() /
                1000
              );
          }

          if (
            Date.now() -
            lastCheckpoint >
            5000
          ) {
            saveActive();

            lastCheckpoint =
              Date.now();
          }
        }

        if (
          lastDay !==
          today()
        ) {
          lastDay =
            today();

          reminderDismissed =
            false;

          if (
            !active &&
            !dialog.open
          ) {
            render();
          }
        }
      }
    ),

    1000
  );

  setInterval(
    () =>
      syncQueue(),

    15000
  );

  /*
    --------------------------------------------------
    STARTUP
    --------------------------------------------------
  */

  function init() {
    /*
      Validate the existing local data first.
      Nothing is intentionally cleared.
    */
    classes();

    sessions();

    reflections();

    reflectionHistory();

    /*
      Establish the persistent anonymous recovery ID.

      Existing studySystem.deviceId.v4 is reused.
    */
    deviceId();

    if (
      !localStorage.getItem(
        K.start
      )
    ) {
      rawWrite(
        K.start,
        weekStart(
          today()
        )
      );
    }

    active =
      read(
        K.active,
        null
      );

    /*
      If the browser closed while a timer was running,
      restore it paused at its last saved checkpoint.
    */
    if (active) {
      if (
        active.runningSince !==
        null
      ) {
        active.ms +=
          Math.max(
            0,

            (
              active.lastSeen ||
              active.runningSince
            ) -
            active.runningSince
          );

        active.runningSince =
          null;
      }

      chosenClass = {
        name:
          active.className,

        subject:
          active.subject
      };

      chosenStage =
        Number(
          active.stage
        );

      visitId =
        active.visitId;

      saveActive();

      message(
        "Restored your unfinished stage, paused at the last saved checkpoint."
      );
    }

    render();

    /*
      Requeue existing locally saved records when needed.
      The receipt system prevents already-confirmed records
      from being resent unnecessarily.
    */
    sessions()
      .filter(
        record =>
          record.id
      )
      .forEach(
        queueStage
      );

    historyList()
      .filter(
        record =>
          record.revisionId &&
          record.recommendation &&
          record.snapshot
      )
      .forEach(
        queueReflection
      );

    syncQueue();
  }

  try {
    init();

  } catch (error) {
    console.error(
      error
    );

    root.innerHTML =
      '<section class="card">' +

      '<h2>Your saved data needs attention</h2>' +

      '<p>' +
      esc(
        error.message
      ) +
      '</p>' +

      '<p class="small">Do not clear website data.</p>' +

      '</section>';

    message(
      "Nothing has been erased."
    );
  }
})();
