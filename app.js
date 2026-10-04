(() => {

  // ==========================================
  // STORAGE
  // ==========================================

  const CLASS_STORAGE_KEY = "studySystem.classes.v4";
  const SESSION_STORAGE_KEY = "studySystem.sessions.v4";
  const DEVICE_ID_KEY = "studySystem.deviceId.v4";
  const SUBMISSION_STORAGE_KEY = "studySystem.weeklySubmissions.v4";
  const ANKI_DONE_PREFIX = "studySystem.ankiDone.v4.";
  const ANKI_DISMISS_PREFIX = "studySystem.ankiDismiss.v4.";


  // ==========================================
  // COURSE CATALOG
  // ==========================================

  const courseCatalog = {
    "Math": [
      "Algebra 1", "Geometry", "Algebra 2", "Integrated Math", "Math Analysis",
      "Precalculus", "Calculus", "AP Calculus AB", "AP Statistics", "Other Math"
    ],
    "Science": [
      "Biology", "Honors Biology", "Chemistry", "Physics", "Physiology",
      "AP Biology", "AP Chemistry", "AP Environmental Science", "AP Physics 1",
      "Other Science"
    ],
    "English": [
      "English 9", "English 9 Honors", "English 10", "English 10 Honors",
      "American Literature", "American Literature Honors", "AP English Language",
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
      "Digital Design", "Film & Video Production", "Exploring Computer Science",
      "Robotics", "Child Development", "Health Science",
      "Emergency Medical Technician", "Art", "AP Drawing",
      "AP 3-D Art & Design", "AP Seminar", "AP Research", "JROTC",
      "PE / Athletics", "Other Elective / CTE"
    ]
  };


  // ==========================================
  // STUDY STAGES
  // ==========================================

  const stages = {
    1: {
      name: "Learn",
      purpose: "Build or rebuild your understanding using your learning materials.",
      instruction: "Use your notes, textbook, examples, videos, AI, Unit Coach, or other learning resources to understand the material.",
      methods: [
        "Study / Review", "Textbook", "Video", "Concept Map",
        "Worked Examples", "AI Tutor", "Unit Coach"
      ]
    },
    2: {
      name: "Retrieval",
      purpose: "See what you can teach or produce from memory.",
      instruction: "Put your materials away. Do not check your notes yet. First show yourself what you actually know.",
      methods: [
        "Teach", "Redo Notes from Memory", "Concept Map from Memory",
        "AI — Teach & Check"
      ]
    },
    3: {
      name: "Assess",
      purpose: "Test what you can do independently without help.",
      instruction: "Treat this like a real assessment. Avoid hints or explanations until the activity is finished.",
      methods: [
        "Homework as Test", "Practice Test", "Practice Problems", "Anki",
        "AI Practice Test", "AI Game"
      ]
    }
  };


  // ==========================================
  // ELEMENTS
  // ==========================================

  const $ = id => document.getElementById(id);

  const classManagerScreen = $("classManagerScreen");
  const subjectSelect = $("subjectSelect");
  const courseSelect = $("courseSelect");
  const courseSelectWrap = $("courseSelectWrap");
  const customCourseWrap = $("customCourseWrap");
  const customCourse = $("customCourse");
  const addClassBtn = $("addClassBtn");
  const savedClassesPanel = $("savedClassesPanel");
  const savedClassesList = $("savedClassesList");
  const addAnotherClassBtn = $("addAnotherClassBtn");
  const doneAddingClassesBtn = $("doneAddingClassesBtn");

  const studyScreen = $("studyScreen");
  const studyClassPanel = $("studyClassPanel");
  const studyClassButtons = $("studyClassButtons");
  const editClassesBtn = $("editClassesBtn");
  const stagePanel = $("stagePanel");
  const selectedClassName = $("selectedClassName");
  const changeClassBtn = $("changeClassBtn");

  const methodPanel = $("methodPanel");
  const methodTitle = $("methodTitle");
  const methodPurpose = $("methodPurpose");
  const methodButtons = $("methodButtons");

  const timerPanel = $("timerPanel");
  const timerClass = $("timerClass");
  const timerStage = $("timerStage");
  const timerMethod = $("timerMethod");
  const timerInstruction = $("timerInstruction");
  const timerDisplay = $("timerDisplay");
  const startBtn = $("startBtn");
  const pauseBtn = $("pauseBtn");
  const finishBtn = $("finishBtn");

  const crosscheckPanel = $("crosscheckPanel");
  const crosscheckDisplay = $("crosscheckDisplay");
  const crosscheckStartBtn = $("crosscheckStartBtn");
  const crosscheckPauseBtn = $("crosscheckPauseBtn");
  const crosscheckFinishBtn = $("crosscheckFinishBtn");

  const completePanel = $("completePanel");
  const completeTitle = $("completeTitle");
  const completeDetails = $("completeDetails");
  const anotherStageBtn = $("anotherStageBtn");
  const finishStudyingBtn = $("finishStudyingBtn");

  const progressScreen = $("progressScreen");
  const progressBtn = $("progressBtn");
  const backBtn = $("backBtn");
  const weeklyTotal = $("weeklyTotal");
  const weeklyStages = $("weeklyStages");
  const weeklyDays = $("weeklyDays");
  const stageBreakdown = $("stageBreakdown");
  const classBreakdown = $("classBreakdown");
  const methodBreakdown = $("methodBreakdown");
  const submitWeekBtn = $("submitWeekBtn");
  const submissionStatus = $("submissionStatus");

  const ankiReminderCard = $("ankiReminderCard");
  const ankiReminderTitle = $("ankiReminderTitle");
  const ankiReminderText = $("ankiReminderText");
  const ankiReminderStartBtn = $("ankiReminderStartBtn");
  const ankiReminderDismissBtn = $("ankiReminderDismissBtn");

  const message = $("message");


  // ==========================================
  // STATE
  // ==========================================

  let selectedClass = null;
  let selectedStage = null;
  let selectedMethod = "";
  let pendingAnkiLaunch = false;

  let elapsedSeconds = 0;
  let timerStartedAt = null;
  let timerInterval = null;

  let crosscheckElapsed = 0;
  let crosscheckStartedAt = null;
  let crosscheckInterval = null;

  let completedStudySeconds = 0;
  let completedCrosscheckSeconds = 0;

  // The Retrieval record waiting for its crosscheck time
  let currentRecord = null;


  // ==========================================
  // LOCAL STORAGE
  // ==========================================

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function getSavedClasses() { return readJson(CLASS_STORAGE_KEY, []); }
  function saveClassList(classes) { localStorage.setItem(CLASS_STORAGE_KEY, JSON.stringify(classes)); }

  function getSessions() { return readJson(SESSION_STORAGE_KEY, []); }
  function saveSessions(rows) { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(rows)); }

  function getSubmissionHistory() { return readJson(SUBMISSION_STORAGE_KEY, {}); }
  function saveSubmissionHistory(history) { localStorage.setItem(SUBMISSION_STORAGE_KEY, JSON.stringify(history)); }

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);

    if (!id) {
      if (window.crypto && crypto.randomUUID) {
        id = crypto.randomUUID();
      } else {
        id = "device-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      }
      localStorage.setItem(DEVICE_ID_KEY, id);
    }

    return id;
  }


  // ==========================================
  // DATE HELPERS
  // ==========================================

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function daysAgo(date) {
    const then = new Date(date);
    then.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((today - then) / 86400000);
  }


  // ==========================================
  // CLASS SETUP
  // ==========================================

  subjectSelect.addEventListener("change", () => {
    populateCourses(subjectSelect.value);
  });

  function populateCourses(subject) {
    courseSelect.innerHTML = '<option value="">Select class</option>';
    customCourse.value = "";
    customCourseWrap.classList.add("hidden");
    addClassBtn.classList.add("hidden");

    if (!subject) {
      courseSelectWrap.classList.add("hidden");
      return;
    }

    (courseCatalog[subject] || []).forEach(course => {
      const option = document.createElement("option");
      option.value = course;
      option.textContent = course;
      courseSelect.appendChild(option);
    });

    courseSelectWrap.classList.remove("hidden");
  }

  courseSelect.addEventListener("change", () => {
    const value = courseSelect.value;

    if (!value) {
      customCourseWrap.classList.add("hidden");
      addClassBtn.classList.add("hidden");
      return;
    }

    if (value.startsWith("Other")) {
      customCourseWrap.classList.remove("hidden");
    } else {
      customCourseWrap.classList.add("hidden");
    }

    addClassBtn.classList.remove("hidden");
  });

  addClassBtn.addEventListener("click", () => {
    const subject = subjectSelect.value;
    let className = courseSelect.value;

    if (className.startsWith("Other")) {
      className = customCourse.value.trim();
    }

    if (!subject || !className) {
      message.textContent = "Choose a subject and class.";
      return;
    }

    const classes = getSavedClasses();
    const exists = classes.some(
      item => item.name.toLowerCase() === className.toLowerCase()
    );

    if (!exists) {
      classes.push({ name: className, subject: subject });
      saveClassList(classes);
    }

    renderSavedClasses();
    savedClassesPanel.classList.remove("hidden");
    resetClassForm();
    message.textContent = "";
  });

  function resetClassForm() {
    subjectSelect.value = "";
    courseSelect.innerHTML = '<option value="">Select class</option>';
    courseSelectWrap.classList.add("hidden");
    customCourseWrap.classList.add("hidden");
    customCourse.value = "";
    addClassBtn.classList.add("hidden");
  }

  function renderSavedClasses() {
    const classes = getSavedClasses();
    savedClassesList.innerHTML = "";

    if (classes.length === 0) {
      savedClassesPanel.classList.add("hidden");
      return;
    }

    savedClassesPanel.classList.remove("hidden");

    classes.forEach((course, index) => {
      const row = document.createElement("div");
      row.className = "saved-class-row";

      const info = document.createElement("div");
      info.className = "saved-class-info";

      const name = document.createElement("span");
      name.className = "saved-class-name";
      name.textContent = course.name;

      const subject = document.createElement("span");
      subject.className = "saved-class-subject";
      subject.textContent = course.subject;

      info.appendChild(name);
      info.appendChild(subject);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary small";
      remove.textContent = "Remove";

      remove.addEventListener("click", () => {
        const updated = getSavedClasses();
        updated.splice(index, 1);
        saveClassList(updated);
        renderSavedClasses();
        renderStudyClassButtons();
      });

      row.appendChild(info);
      row.appendChild(remove);
      savedClassesList.appendChild(row);
    });
  }

  addAnotherClassBtn.addEventListener("click", resetClassForm);

  doneAddingClassesBtn.addEventListener("click", () => {
    if (getSavedClasses().length === 0) {
      message.textContent = "Add at least one class first.";
      return;
    }
    showStudyHome();
  });

  editClassesBtn.addEventListener("click", showClassManager);


  // ==========================================
  // LAST CHECKED
  // Retrieval (2) or Assess (3) count as a check
  // ==========================================

  function lastCheckedText(className) {
    const sessions = getSessions();

    const checks = sessions.filter(
      row => row.className === className && Number(row.stage) >= 2
    );

    if (checks.length === 0) {
      const learned = sessions.some(
        row => row.className === className && Number(row.stage) === 1
      );
      return learned ? "Learned, but not checked yet" : "Not checked yet";
    }

    const latest = checks.reduce((a, b) =>
      new Date(a.timestamp) > new Date(b.timestamp) ? a : b
    );

    const d = daysAgo(new Date(latest.timestamp));

    if (d >= 7) return d + " days since Retrieval/Assess";
    if (d <= 0) return "Last checked today";
    if (d === 1) return "Last checked yesterday";
    return "Last checked " + d + " days ago";
  }


  // ==========================================
  // CLASS SELECTION
  // ==========================================

  function renderStudyClassButtons() {
    const classes = getSavedClasses();
    studyClassButtons.innerHTML = "";

    classes.forEach(course => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "class-button";

      const name = document.createElement("strong");
      name.textContent = course.name;

      const checked = document.createElement("span");
      checked.textContent = lastCheckedText(course.name);

      button.appendChild(name);
      button.appendChild(checked);

      button.addEventListener("click", () => {
        selectedClass = course;

        if (pendingAnkiLaunch) {
          pendingAnkiLaunch = false;
          selectedStage = 3;
          openTimer("Anki");
          return;
        }

        openStageSelection();
      });

      studyClassButtons.appendChild(button);
    });
  }

  function openStageSelection() {
    studyClassPanel.classList.add("hidden");
    stagePanel.classList.remove("hidden");
    selectedClassName.textContent = selectedClass.name;
    methodPanel.classList.add("hidden");
    selectedStage = null;

    document.querySelectorAll(".stage-card").forEach(card => {
      card.classList.remove("selected");
    });
  }

  changeClassBtn.addEventListener("click", () => {
    selectedClass = null;
    selectedStage = null;
    pendingAnkiLaunch = false;

    stagePanel.classList.add("hidden");
    methodPanel.classList.add("hidden");
    studyClassPanel.classList.remove("hidden");

    renderStudyClassButtons();
    renderAnkiReminder();
  });


  // ==========================================
  // STAGE SELECTION
  // ==========================================

  document.querySelectorAll(".stage-card").forEach(button => {
    button.addEventListener("click", () => {
      selectedStage = Number(button.dataset.stage);

      document.querySelectorAll(".stage-card").forEach(card => {
        card.classList.remove("selected");
      });

      button.classList.add("selected");
      renderMethods(selectedStage);
    });
  });

  function renderMethods(stageNumber) {
    const stage = stages[stageNumber];

    methodTitle.textContent = "Stage " + stageNumber + " — " + stage.name;
    methodPurpose.textContent = stage.purpose;
    methodButtons.innerHTML = "";

    stage.methods.forEach(method => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = method;
      button.addEventListener("click", () => openTimer(method));
      methodButtons.appendChild(button);
    });

    methodPanel.classList.remove("hidden");
  }

  // Opens the stage screen with a stage already selected
  function jumpToStage(stageNumber) {
    selectedStage = stageNumber;

    stagePanel.classList.remove("hidden");
    selectedClassName.textContent = selectedClass.name;

    document.querySelectorAll(".stage-card").forEach(card => {
      card.classList.toggle("selected", Number(card.dataset.stage) === stageNumber);
    });

    renderMethods(stageNumber);
  }


  // ==========================================
  // MAIN TIMER
  // ==========================================

  function openTimer(method) {
    selectedMethod = method;
    elapsedSeconds = 0;
    timerStartedAt = null;

    timerDisplay.textContent = "00:00";
    timerClass.textContent = selectedClass.name;
    timerStage.textContent = "Stage " + selectedStage + " — " + stages[selectedStage].name;
    timerMethod.textContent = method;
    timerInstruction.textContent = stages[selectedStage].instruction;

    startBtn.classList.remove("hidden");
    pauseBtn.classList.add("hidden");
    finishBtn.classList.add("hidden");
    pauseBtn.textContent = "Pause";

    studyClassPanel.classList.add("hidden");
    stagePanel.classList.add("hidden");
    timerPanel.classList.remove("hidden");
    ankiReminderCard.classList.add("hidden");

    progressBtn.classList.add("hidden");
    message.textContent = "";
  }

  function updateTimer() {
    let total = elapsedSeconds;
    if (timerStartedAt) total += (Date.now() - timerStartedAt) / 1000;
    timerDisplay.textContent = formatTimer(total);
  }

  function stopTimer() {
    if (timerStartedAt) {
      elapsedSeconds += (Date.now() - timerStartedAt) / 1000;
      timerStartedAt = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    updateTimer();
  }

  startBtn.addEventListener("click", () => {
    timerStartedAt = Date.now();
    timerInterval = setInterval(updateTimer, 250);

    startBtn.classList.add("hidden");
    pauseBtn.classList.remove("hidden");
    finishBtn.classList.remove("hidden");
  });

  pauseBtn.addEventListener("click", () => {
    if (timerStartedAt) {
      stopTimer();
      pauseBtn.textContent = "Resume";
    } else {
      timerStartedAt = Date.now();
      timerInterval = setInterval(updateTimer, 250);
      pauseBtn.textContent = "Pause";
    }
  });

  finishBtn.addEventListener("click", () => {
    stopTimer();
    completedStudySeconds = Math.floor(elapsedSeconds);
    completedCrosscheckSeconds = 0;
    timerPanel.classList.add("hidden");

    // Save immediately for every stage, including Retrieval.
    // A Retrieval session is never lost if the student skips Crosscheck.
    currentRecord = saveStageRecord();

    if (selectedStage === 2) {
      prepareCrosscheck();
    } else {
      showCompletePanel();
    }
  });


  // ==========================================
  // CROSSCHECK
  // ==========================================

  function prepareCrosscheck() {
    crosscheckElapsed = 0;
    crosscheckStartedAt = null;

    crosscheckDisplay.textContent = "00:00";
    crosscheckStartBtn.classList.remove("hidden");
    crosscheckPauseBtn.classList.add("hidden");
    crosscheckFinishBtn.classList.add("hidden");
    crosscheckPauseBtn.textContent = "Pause";

    crosscheckPanel.classList.remove("hidden");
    progressBtn.classList.add("hidden");
  }

  function updateCrosscheckTimer() {
    let total = crosscheckElapsed;
    if (crosscheckStartedAt) total += (Date.now() - crosscheckStartedAt) / 1000;
    crosscheckDisplay.textContent = formatTimer(total);
  }

  function stopCrosscheckTimer() {
    if (crosscheckStartedAt) {
      crosscheckElapsed += (Date.now() - crosscheckStartedAt) / 1000;
      crosscheckStartedAt = null;
    }
    if (crosscheckInterval) {
      clearInterval(crosscheckInterval);
      crosscheckInterval = null;
    }
    updateCrosscheckTimer();
  }

  crosscheckStartBtn.addEventListener("click", () => {
    crosscheckStartedAt = Date.now();
    crosscheckInterval = setInterval(updateCrosscheckTimer, 250);

    crosscheckStartBtn.classList.add("hidden");
    crosscheckPauseBtn.classList.remove("hidden");
    crosscheckFinishBtn.classList.remove("hidden");
  });

  crosscheckPauseBtn.addEventListener("click", () => {
    if (crosscheckStartedAt) {
      stopCrosscheckTimer();
      crosscheckPauseBtn.textContent = "Resume";
    } else {
      crosscheckStartedAt = Date.now();
      crosscheckInterval = setInterval(updateCrosscheckTimer, 250);
      crosscheckPauseBtn.textContent = "Pause";
    }
  });

  crosscheckFinishBtn.addEventListener("click", () => {
    stopCrosscheckTimer();
    completedCrosscheckSeconds = Math.floor(crosscheckElapsed);
    crosscheckPanel.classList.add("hidden");

    // Add crosscheck time to the Retrieval record already saved
    updateRecordCrosscheck(currentRecord, completedCrosscheckSeconds);

    showCompletePanel();
  });


  // ==========================================
  // NEXT STEP BUTTON
  // ==========================================

  function configureNextStepButton() {
    if (selectedStage === 1) {
      anotherStageBtn.textContent = "Retrieve What You Remember";
    } else if (selectedStage === 2) {
      anotherStageBtn.textContent = "Test Yourself Now";
    } else {
      anotherStageBtn.textContent = "Choose Another Stage";
    }
  }


  // ==========================================
  // SAVE STAGE
  // ==========================================

  // Builds the record, saves it on the device, sends it to the Sheet
  function saveStageRecord() {
    const now = new Date();

    const record = {
      timestamp: now.toISOString(),
      localDate: localDateKey(now),
      className: selectedClass.name,
      subject: selectedClass.subject,
      stage: selectedStage,
      stageName: stages[selectedStage].name,
      method: selectedMethod,
      studySeconds: completedStudySeconds,
      crosscheckSeconds: completedCrosscheckSeconds,
      totalSeconds: completedStudySeconds + completedCrosscheckSeconds
    };

    const rows = getSessions();
    rows.push(record);
    saveSessions(rows);

    submitCompletedStage(record);

    if (selectedStage === 3 && selectedMethod === "Anki") {
      completeAnkiRequirement();
    }

    return record;
  }

  // Updates a saved Retrieval record with crosscheck time and resends it.
  // The Sheet matches it by timestamp + device and updates the same row.
  function updateRecordCrosscheck(record, seconds) {
    if (!record) return;

    record.crosscheckSeconds = seconds;
    record.totalSeconds = record.studySeconds + seconds;

    const rows = getSessions();
    const index = rows.findIndex(row => row.timestamp === record.timestamp);

    if (index >= 0) {
      rows[index] = record;
      saveSessions(rows);
    }

    submitCompletedStage(record);
  }

  function showCompletePanel() {
    completeTitle.textContent =
      "Stage " + selectedStage + " — " + stages[selectedStage].name + " complete";

    completeDetails.textContent =
      selectedMethod + ": " + formatTimer(completedStudySeconds) +
      (completedCrosscheckSeconds
        ? " · Crosscheck: " + formatTimer(completedCrosscheckSeconds)
        : "");

    configureNextStepButton();

    completePanel.classList.remove("hidden");
    progressBtn.classList.remove("hidden");
  }


  // ==========================================
  // GOOGLE SUBMISSION
  // ==========================================

  function postToEndpoint(payload) {
    const endpoint = window.STUDY_TRACKER_WEEKLY_ENDPOINT;
    if (!endpoint) return false;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = endpoint;
    form.target = "submissionFrame";
    form.className = "hidden";

    Object.entries(payload).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    form.remove();
    return true;
  }

  function submitCompletedStage(record) {
    postToEndpoint({
      action: "submitStage",
      deviceId: getDeviceId(),
      timestamp: record.timestamp,
      localDate: record.localDate,
      className: record.className,
      subject: record.subject,
      stage: record.stage,
      stageName: record.stageName,
      method: record.method,
      studySeconds: record.studySeconds,
      crosscheckSeconds: record.crosscheckSeconds,
      totalSeconds: record.totalSeconds
    });
  }


  // ==========================================
  // AFTER STAGE
  // ==========================================

  anotherStageBtn.addEventListener("click", () => {
    completePanel.classList.add("hidden");
    progressBtn.classList.remove("hidden");

    if (selectedStage === 1) {
      jumpToStage(2);   // Learn → Retrieval
      return;
    }

    if (selectedStage === 2) {
      jumpToStage(3);   // Retrieval → Assess
      return;
    }

    openStageSelection();
  });

  finishStudyingBtn.addEventListener("click", () => {
    completePanel.classList.add("hidden");

    selectedClass = null;
    selectedStage = null;
    selectedMethod = "";
    pendingAnkiLaunch = false;
    currentRecord = null;

    studyClassPanel.classList.remove("hidden");
    renderStudyClassButtons();
    renderAnkiReminder();
    progressBtn.classList.remove("hidden");

    message.textContent = "Study session saved.";
  });


  // ==========================================
  // TIMER HELPERS
  // ==========================================

  function formatTimer(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function humanTime(seconds) {
    const minutes = Math.round((seconds || 0) / 60);
    if (minutes < 60) return minutes + " min";

    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    if (remaining === 0) return hours + " hr";
    return hours + " hr " + remaining + " min";
  }


  // ==========================================
  // ANKI REMINDERS
  // ==========================================

  function isAnkiDay(date) {
    return date.getDay() === 1 || date.getDay() === 4;
  }

  function isAnkiDone(dateKey) {
    return localStorage.getItem(ANKI_DONE_PREFIX + dateKey) === "1";
  }

  function markAnkiDone(dateKey) {
    localStorage.setItem(ANKI_DONE_PREFIX + dateKey, "1");
  }

  function getOutstandingAnkiDays() {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const monday = new Date(today);
    const currentDay = today.getDay();
    const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
    monday.setDate(today.getDate() - daysSinceMonday);

    const missing = [];
    const cursor = new Date(monday);

    while (cursor <= today) {
      if (isAnkiDay(cursor)) {
        const key = localDateKey(cursor);
        if (!isAnkiDone(key)) {
          missing.push({ date: new Date(cursor), dateKey: key });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return missing;
  }

  function completeAnkiRequirement() {
    const missing = getOutstandingAnkiDays();
    if (missing.length === 0) return;
    markAnkiDone(missing[0].dateKey);
  }

  function renderAnkiReminder() {
    ankiReminderCard.classList.add("hidden");

    if (getSavedClasses().length === 0) return;

    const todayKey = localDateKey();
    if (localStorage.getItem(ANKI_DISMISS_PREFIX + todayKey) === "1") return;

    const missing = getOutstandingAnkiDays();
    if (missing.length === 0) return;

    const requirement = missing[0];

    if (requirement.dateKey === todayKey) {
      ankiReminderTitle.textContent = "Anki due today";
      ankiReminderText.textContent = "Complete one Anki session today.";
    } else {
      const dayName = requirement.date.toLocaleDateString(undefined, { weekday: "long" });
      ankiReminderTitle.textContent = "Anki make-up session due";
      ankiReminderText.textContent =
        "You missed your " + dayName + " Anki session. Complete one session when you can.";
    }

    ankiReminderCard.classList.remove("hidden");
  }

  ankiReminderStartBtn.addEventListener("click", () => {
    pendingAnkiLaunch = true;
    selectedClass = null;

    studyClassPanel.classList.remove("hidden");
    stagePanel.classList.add("hidden");
    methodPanel.classList.add("hidden");

    renderStudyClassButtons();
    message.textContent = "Choose the class for your Anki session.";
  });

  ankiReminderDismissBtn.addEventListener("click", () => {
    localStorage.setItem(ANKI_DISMISS_PREFIX + localDateKey(), "1");
    ankiReminderCard.classList.add("hidden");
  });


  // ==========================================
  // WEEKLY SUMMARY
  // ==========================================

  function getMonday(date = new Date()) {
    const result = new Date(date);
    const day = (result.getDay() + 6) % 7;
    result.setDate(result.getDate() - day);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function createWeeklySummary() {
    const start = getMonday();
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const rows = getSessions().filter(row => {
      const timestamp = new Date(row.timestamp);
      return timestamp >= start && timestamp < end;
    });

    const summary = {
      weekStart: localDateKey(start),
      totalSeconds: 0,
      stageCount: rows.length,
      classStages: {},
      studyDays: new Set(),
      stage1Seconds: 0,
      stage2Seconds: 0,
      stage3Seconds: 0,
      crosscheckSeconds: 0,
      classes: {},
      methods: {},
      methodCounts: {}
    };

    rows.forEach(row => {
      const stage = Number(row.stage);

      summary.totalSeconds += row.totalSeconds || 0;
      summary.studyDays.add(row.localDate || localDateKey(new Date(row.timestamp)));

      // Session count per stage, per class
      if (!summary.classStages[row.className]) {
        summary.classStages[row.className] = { 1: 0, 2: 0, 3: 0 };
      }
      if (summary.classStages[row.className][stage] !== undefined) {
        summary.classStages[row.className][stage] += 1;
      }

      if (stage === 1) summary.stage1Seconds += row.studySeconds || 0;
      if (stage === 2) summary.stage2Seconds += row.studySeconds || 0;
      if (stage === 3) summary.stage3Seconds += row.studySeconds || 0;

      summary.crosscheckSeconds += row.crosscheckSeconds || 0;

      summary.classes[row.className] =
        (summary.classes[row.className] || 0) + (row.totalSeconds || 0);

      summary.methods[row.method] =
        (summary.methods[row.method] || 0) + (row.studySeconds || 0);

      summary.methodCounts[row.method] =
        (summary.methodCounts[row.method] || 0) + 1;
    });

    summary.studyDays = summary.studyDays.size;

    return summary;
  }


  // ==========================================
  // CLASS-SPECIFIC BALANCE NUDGES
  // One line per class that needs it; silent otherwise
  // ==========================================

  function classNudges(summary) {
    const nudges = [];

    Object.entries(summary.classStages).forEach(([className, s]) => {
      const total = s[1] + s[2] + s[3];

      // One session in a class isn't enough to see a pattern
      if (total < 2) return;

      // Only Learn in this class
      if (s[2] === 0 && s[3] === 0) {
        nudges.push(className + ": only Learn this week. Try Retrieval next.");
        return;
      }

      // Retrieval done, but no Assess yet
      if (s[2] > 0 && s[3] === 0) {
        nudges.push(className + ": you've practiced retrieval. Try a short Assess next.");
      }
    });

    return nudges;
  }


  // ==========================================
  // PROGRESS SCREEN
  // ==========================================

  progressBtn.addEventListener("click", showWeeklyProgress);
  backBtn.addEventListener("click", showStudyHome);

  function showWeeklyProgress() {
    const summary = createWeeklySummary();

    classManagerScreen.classList.add("hidden");
    studyScreen.classList.add("hidden");
    progressScreen.classList.remove("hidden");
    progressBtn.classList.add("hidden");

    weeklyTotal.textContent = humanTime(summary.totalSeconds);
    weeklyStages.textContent = summary.stageCount;
    weeklyDays.textContent = summary.studyDays;

    renderStageBreakdown(summary);
    renderRanking(classBreakdown, summary.classes);
    renderRanking(methodBreakdown, summary.methods);
    updateSubmissionStatus(summary.weekStart);
  }

  function renderStageBreakdown(summary) {
    stageBreakdown.innerHTML = "";

    classNudges(summary).forEach(text => {
      const p = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = text;
      p.appendChild(strong);
      stageBreakdown.appendChild(p);
    });

    const items = [
      { name: "Learn", seconds: summary.stage1Seconds, css: "learn" },
      { name: "Retrieval", seconds: summary.stage2Seconds, css: "verify" },
      { name: "Assess", seconds: summary.stage3Seconds, css: "assess" },
      { name: "Crosscheck", seconds: summary.crosscheckSeconds, css: "crosscheck" }
    ];

    items.forEach(item => {
      const percent = summary.totalSeconds
        ? Math.round((item.seconds / summary.totalSeconds) * 100)
        : 0;

      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `
        <span>${item.name}</span>
        <div class="bar-track">
          <div class="bar-fill ${item.css}" style="width:${percent}%"></div>
        </div>
        <strong>${percent}%</strong>
      `;

      stageBreakdown.appendChild(row);
    });
  }

  function renderRanking(element, data) {
    element.innerHTML = "";

    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      element.innerHTML = '<span class="muted">No activity yet this week.</span>';
      return;
    }

    entries.forEach(([name, value]) => {
      const row = document.createElement("div");
      row.className = "list-row";

      const left = document.createElement("span");
      left.textContent = name;

      const right = document.createElement("strong");
      right.textContent = humanTime(value);

      row.appendChild(left);
      row.appendChild(right);
      element.appendChild(row);
    });
  }


  // ==========================================
  // WEEKLY SUBMISSION
  // ==========================================

  function updateSubmissionStatus(week) {
    const history = getSubmissionHistory();

    if (history[week]) {
      submissionStatus.textContent =
        "This week's summary was last shared on " +
        new Date(history[week]).toLocaleString() + ".";
      submitWeekBtn.textContent = "Update Weekly Summary";
    } else {
      submissionStatus.textContent = "This week has not been shared yet.";
      submitWeekBtn.textContent = "Share Weekly Summary";
    }
  }

  submitWeekBtn.addEventListener("click", submitWeeklySummary);

  function submitWeeklySummary() {
    if (!window.STUDY_TRACKER_WEEKLY_ENDPOINT) {
      submissionStatus.textContent = "Weekly reporting has not been configured yet.";
      return;
    }

    const summary = createWeeklySummary();

    if (summary.stageCount === 0) {
      submissionStatus.textContent = "There is no study activity to share yet.";
      return;
    }

    postToEndpoint({
      action: "submitWeekly",
      deviceId: getDeviceId(),
      weekStart: summary.weekStart,
      totalSeconds: summary.totalSeconds,
      studyDays: summary.studyDays,
      stage1Seconds: summary.stage1Seconds,
      stage2Seconds: summary.stage2Seconds,
      stage3Seconds: summary.stage3Seconds,
      crosscheckSeconds: summary.crosscheckSeconds,
      stageCount: summary.stageCount,
      classesJson: JSON.stringify(summary.classes),
      methodCountsJson: JSON.stringify(summary.methodCounts)
    });

    const history = getSubmissionHistory();
    history[summary.weekStart] = new Date().toISOString();
    saveSubmissionHistory(history);

    submissionStatus.textContent = "Weekly summary sent anonymously.";
    submitWeekBtn.textContent = "Update Weekly Summary";
  }


  // ==========================================
  // SCREEN HELPERS
  // ==========================================

  function showClassManager() {
    classManagerScreen.classList.remove("hidden");
    studyScreen.classList.add("hidden");
    progressScreen.classList.add("hidden");
    progressBtn.classList.add("hidden");

    pendingAnkiLaunch = false;

    renderSavedClasses();
    resetClassForm();
  }

  function showStudyHome() {
    classManagerScreen.classList.add("hidden");
    progressScreen.classList.add("hidden");
    studyScreen.classList.remove("hidden");
    progressBtn.classList.remove("hidden");

    studyClassPanel.classList.remove("hidden");
    stagePanel.classList.add("hidden");
    methodPanel.classList.add("hidden");
    timerPanel.classList.add("hidden");
    crosscheckPanel.classList.add("hidden");
    completePanel.classList.add("hidden");

    selectedClass = null;
    selectedStage = null;
    selectedMethod = "";
    pendingAnkiLaunch = false;
    currentRecord = null;

    renderStudyClassButtons();
    renderAnkiReminder();
  }


  // ==========================================
  // INITIALIZE
  // ==========================================

  function initialize() {
    if (getSavedClasses().length === 0) {
      showClassManager();
    } else {
      showStudyHome();
    }
  }

  initialize();

})();
