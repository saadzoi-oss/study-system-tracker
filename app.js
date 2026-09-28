(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const CLASS_KEY = "studySystem.classes.v2";
  const SESSION_KEY = "studySystem.sessions.v2";
  const DEVICE_KEY = "studySystem.deviceId.v2";
  const SUBMIT_KEY = "studySystem.weeklySubmissions.v2";
  const ANKI_PREF = "studyTracker.ankiReminderEnabled";
  const ANKI_DONE = "studyTracker.ankiDone.";
  const ANKI_HIDE = "studyTracker.ankiDismiss.";

  const courses = {
    "Math": ["Algebra 1", "Geometry", "Algebra 2", "Integrated Math", "Math Analysis", "Precalculus", "Calculus", "AP Calculus AB", "AP Statistics", "Other Math"],
    "Science": ["Biology", "Honors Biology", "Chemistry", "Physics", "Physiology", "AP Biology", "AP Chemistry", "AP Environmental Science", "AP Physics 1", "Other Science"],
    "English": ["English 9", "English 9 Honors", "English 10", "English 10 Honors", "American Literature", "American Literature Honors", "AP English Language", "Advanced Composition", "Advanced Composition Honors", "AP English Literature", "Other English"],
    "History / Social Science": ["World History", "Honors World History", "AP World History", "U.S. History", "AP U.S. History", "Government", "Economics", "AP Government", "AP Human Geography", "AP Psychology", "Ethnic Studies", "Health", "Other History / Social Science"],
    "World Language": ["Spanish", "Spanish 2", "Spanish 3", "AP Spanish Language", "AP Spanish Literature", "Other World Language"],
    "Elective / CTE": ["Architecture 1", "Architecture 2", "Architectural Design", "Digital Design", "Film & Video Production", "Exploring Computer Science", "Robotics", "Child Development", "Health Science", "Emergency Medical Technician", "Art", "AP Drawing", "AP 3-D Art & Design", "AP Seminar", "AP Research", "JROTC", "PE / Athletics", "Other Elective / CTE"]
  };
  const stages = {
    1: { name: "Learn", purpose: "Build or rebuild your understanding using learning materials.",
      instruction: "Use notes, textbooks, examples, videos, AI, Unit Coach, or other resources.",
      methods: ["Study / Review", "Textbook", "Video", "Concept Map", "Worked Examples", "AI Tutor", "Unit Coach"] },
    2: { name: "Verify", purpose: "See what you can teach or produce from memory.",
      instruction: "Put your materials away. Show what you know before checking your notes.",
      methods: ["Teach", "Redo Notes from Memory", "Concept Map from Memory", "AI — Teach & Check"] },
    3: { name: "Assess", purpose: "Test what you can do independently without help.",
      instruction: "Treat this like a real assessment. Wait until you finish before checking hints or explanations.",
      methods: ["Homework as Test", "Practice Test", "Practice Problems", "Anki", "AI Practice Test", "AI Game"] }
  };

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const classes = () => {
    const key = localStorage.getItem(CLASS_KEY) === null ? "studySystem.classes.v3" : CLASS_KEY;
    const value = read(key, []);
    return Array.isArray(value) ? value : [];
  };
  const saveClasses = value => localStorage.setItem(CLASS_KEY, JSON.stringify(value));
  const sessions = () => {
    const value = read(SESSION_KEY, []);
    return Array.isArray(value) ? value : [];
  };
  const visible = (id, yes) => $(id).classList.toggle("hidden", !yes);
  const message = value => { $("message").textContent = value; };
  const fmt = seconds => {
    const n = Math.max(0, Math.floor(seconds || 0));
    return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
  };
  const human = seconds => {
    const min = Math.round((seconds || 0) / 60);
    return min < 60 ? min + " min" : Math.floor(min / 60) + " hr " + (min % 60) + " min";
  };
  const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");

  let selectedClass = null;
  let selectedStage = null;
  let selectedMethod = "";
  let pendingAnki = false;
  let studySeconds = 0;
  let crosscheckSeconds = 0;
  let elapsed = 0;
  let startedAt = null;
  let tickInterval = null;
  let crossElapsed = 0;
  let crossStartedAt = null;
  let crossInterval = null;

  function dueAnkiKey() {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let offset = 0; offset < 7; offset++) {
      const day = new Date(today);
      day.setDate(today.getDate() - offset);
      if (day.getDay() === 1 || day.getDay() === 4) {
        const key = dateKey(day);
        return localStorage.getItem(ANKI_DONE + key) === "1" ? null : key;
      }
    }
    return null;
  }
  function renderReminder() {
    visible("ankiReminderCard", false);
    if (!$("ankiReminderEnabled").checked) return;
    const due = dueAnkiKey();
    if (!due || localStorage.getItem(ANKI_HIDE + dateKey(new Date())) === "1") return;
    const today = due === dateKey(new Date());
    $("ankiReminderTitle").textContent = today ? "Anki due today" : "Anki make-up session due";
    $("ankiReminderText").textContent = today
      ? "Complete an Anki session for your Monday/Thursday review routine."
      : "Complete the Anki session you missed on " +
        new Date(due + "T12:00:00").toLocaleDateString(undefined, { weekday: "long" }) + ".";
    visible("ankiReminderCard", true);
  }
  $("ankiReminderEnabled").checked = localStorage.getItem(ANKI_PREF) !== "0";
  $("ankiReminderEnabled").addEventListener("change", () => {
    localStorage.setItem(ANKI_PREF, $("ankiReminderEnabled").checked ? "1" : "0");
    renderReminder();
  });
  $("dismissAnkiReminderBtn").addEventListener("click", () => {
    localStorage.setItem(ANKI_HIDE + dateKey(new Date()), "1");
    renderReminder();
  });
  $("startAnkiReminderBtn").addEventListener("click", () => {
    pendingAnki = true;
    message("Choose the class for your Anki session.");
    $("studyClassButtons").querySelector("button")?.focus();
  });

  function resetClassForm() {
    $("subjectSelect").value = "";
    $("courseSelect").innerHTML = '<option value="">Select class</option>';
    $("customCourse").value = "";
    visible("courseSelectWrap", false);
    visible("customCourseWrap", false);
    visible("addClassBtn", false);
  }
  function renderSavedClasses() {
    const list = $("savedClassesList");
    list.innerHTML = "";
    const saved = classes();
    visible("savedClassesPanel", saved.length > 0);
    saved.forEach((course, index) => {
      const row = document.createElement("div");
      row.className = "saved-class-row";
      const info = document.createElement("div");
      info.className = "saved-class-info";
      const name = document.createElement("strong");
      name.textContent = course.name;
      const subject = document.createElement("span");
      subject.className = "saved-class-subject";
      subject.textContent = course.subject;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        const next = classes();
        next.splice(index, 1);
        saveClasses(next);
        renderSavedClasses();
        renderClassButtons();
      });
      info.appendChild(name);
      info.appendChild(subject);
      row.appendChild(info);
      row.appendChild(remove);
      list.appendChild(row);
    });
  }
  $("subjectSelect").addEventListener("change", () => {
    const subject = $("subjectSelect").value;
    $("courseSelect").innerHTML = '<option value="">Select class</option>';
    $("customCourse").value = "";
    visible("customCourseWrap", false);
    visible("addClassBtn", false);
    visible("courseSelectWrap", !!subject);
    (courses[subject] || []).forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      $("courseSelect").appendChild(option);
    });
  });
  $("courseSelect").addEventListener("change", () => {
    const choice = $("courseSelect").value;
    visible("customCourseWrap", choice.startsWith("Other"));
    visible("addClassBtn", !!choice);
  });
  $("addClassBtn").addEventListener("click", () => {
    const subject = $("subjectSelect").value;
    const choice = $("courseSelect").value;
    const name = (choice.startsWith("Other") ? $("customCourse").value : choice).trim();
    if (!subject || !name) { message("Choose a subject and class."); return; }
    const saved = classes();
    if (!saved.some(x => x.name.toLowerCase() === name.toLowerCase())) {
      saved.push({ name, subject });
      saveClasses(saved);
    }
    renderSavedClasses();
    resetClassForm();
    message("");
  });
  $("addAnotherClassBtn").addEventListener("click", () => {
    resetClassForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("doneAddingClassesBtn").addEventListener("click", () => {
    if (!classes().length) { message("Add at least one class first."); return; }
    showHome();
  });
  $("editClassesBtn").addEventListener("click", showClassManager);

  function showClassManager() {
    pendingAnki = false;
    visible("progressScreen", false);
    visible("studyScreen", false);
    visible("classManagerScreen", true);
    renderSavedClasses();
    resetClassForm();
  }
  function showHome() {
    pendingAnki = false;
    selectedClass = null;
    selectedStage = null;
    selectedMethod = "";
    visible("classManagerScreen", false);
    visible("progressScreen", false);
    visible("studyScreen", true);
    visible("studyClassPanel", true);
    ["stagePanel", "methodPanel", "timerPanel", "crosscheckPanel", "completePanel"]
      .forEach(id => visible(id, false));
    renderClassButtons();
    renderReminder();
  }
  function renderClassButtons() {
    const area = $("studyClassButtons");
    area.innerHTML = "";
    classes().forEach(course => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "class-button";
      const name = document.createElement("strong");
      name.textContent = course.name;
      const subject = document.createElement("span");
      subject.textContent = course.subject;
      button.appendChild(name);
      button.appendChild(subject);
      button.addEventListener("click", () => {
        selectedClass = course;
        if (pendingAnki) {
          pendingAnki = false;
          selectedStage = 3;
          openTimer("Anki");
          message("");
        } else openStages();
      });
      area.appendChild(button);
    });
  }
  function openStages() {
    visible("studyClassPanel", false);
    visible("stagePanel", true);
    visible("methodPanel", false);
    selectedStage = null;
    $("selectedClassName").textContent = selectedClass.name;
    document.querySelectorAll(".stage-card").forEach(card => card.classList.remove("selected"));
  }
  $("changeClassBtn").addEventListener("click", () => {
    selectedClass = null;
    visible("stagePanel", false);
    visible("studyClassPanel", true);
    renderReminder();
  });
  document.querySelectorAll(".stage-card").forEach(card => card.addEventListener("click", () => {
    selectedStage = Number(card.dataset.stage);
    document.querySelectorAll(".stage-card").forEach(x => x.classList.remove("selected"));
    card.classList.add("selected");
    const stage = stages[selectedStage];
    $("methodTitle").textContent = "Stage " + selectedStage + " — " + stage.name;
    $("methodPurpose").textContent = stage.purpose;
    $("methodButtons").innerHTML = "";
    stage.methods.forEach(method => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = method;
      button.addEventListener("click", () => openTimer(method));
      $("methodButtons").appendChild(button);
    });
    visible("methodPanel", true);
  }));

  function current(base, start) { return base + (start === null ? 0 : (Date.now() - start) / 1000); }
  function stopStudyTimer() {
    elapsed = current(elapsed, startedAt);
    startedAt = null;
    clearInterval(tickInterval);
    tickInterval = null;
    $("timerDisplay").textContent = fmt(elapsed);
  }
  function stopCrossTimer() {
    crossElapsed = current(crossElapsed, crossStartedAt);
    crossStartedAt = null;
    clearInterval(crossInterval);
    crossInterval = null;
    $("crosscheckDisplay").textContent = fmt(crossElapsed);
  }
  function openTimer(method) {
    if (!selectedClass || !selectedStage) return;
    selectedMethod = method;
    elapsed = 0;
    startedAt = null;
    $("timerClass").textContent = selectedClass.name;
    $("timerStage").textContent = "Stage " + selectedStage + " — " + stages[selectedStage].name;
    $("timerMethod").textContent = method;
    $("timerInstruction").textContent = stages[selectedStage].instruction;
    $("timerDisplay").textContent = "00:00";
    $("pauseBtn").textContent = "Pause";
    visible("startBtn", true);
    visible("pauseBtn", false);
    visible("finishBtn", false);
    visible("studyClassPanel", false);
    visible("stagePanel", false);
    visible("completePanel", false);
    visible("timerPanel", true);
  }
  $("startBtn").addEventListener("click", () => {
    startedAt = Date.now();
    tickInterval = setInterval(() => { $("timerDisplay").textContent = fmt(current(elapsed, startedAt)); }, 250);
    visible("startBtn", false);
    visible("pauseBtn", true);
    visible("finishBtn", true);
  });
  $("pauseBtn").addEventListener("click", () => {
    if (startedAt !== null) {
      stopStudyTimer();
      $("pauseBtn").textContent = "Resume";
    } else {
      startedAt = Date.now();
      tickInterval = setInterval(() => { $("timerDisplay").textContent = fmt(current(elapsed, startedAt)); }, 250);
      $("pauseBtn").textContent = "Pause";
    }
  });
  $("finishBtn").addEventListener("click", () => {
    stopStudyTimer();
    studySeconds = Math.floor(elapsed);
    visible("timerPanel", false);
    if (selectedStage === 2) {
      crossElapsed = 0;
      crossStartedAt = null;
      $("crosscheckDisplay").textContent = "00:00";
      $("crosscheckPauseBtn").textContent = "Pause";
      visible("crosscheckStartBtn", true);
      visible("crosscheckPauseBtn", false);
      visible("crosscheckFinishBtn", false);
      visible("crosscheckPanel", true);
    } else {
      crosscheckSeconds = 0;
      saveStage();
    }
  });
  $("crosscheckStartBtn").addEventListener("click", () => {
    crossStartedAt = Date.now();
    crossInterval = setInterval(() => { $("crosscheckDisplay").textContent = fmt(current(crossElapsed, crossStartedAt)); }, 250);
    visible("crosscheckStartBtn", false);
    visible("crosscheckPauseBtn", true);
    visible("crosscheckFinishBtn", true);
  });
  $("crosscheckPauseBtn").addEventListener("click", () => {
    if (crossStartedAt !== null) {
      stopCrossTimer();
      $("crosscheckPauseBtn").textContent = "Resume";
    } else {
      crossStartedAt = Date.now();
      crossInterval = setInterval(() => { $("crosscheckDisplay").textContent = fmt(current(crossElapsed, crossStartedAt)); }, 250);
      $("crosscheckPauseBtn").textContent = "Pause";
    }
  });
  $("crosscheckFinishBtn").addEventListener("click", () => {
    stopCrossTimer();
    crosscheckSeconds = Math.floor(crossElapsed);
    visible("crosscheckPanel", false);
    saveStage();
  });
  function saveStage() {
    const record = {
      timestamp: new Date().toISOString(), className: selectedClass.name,
      subject: selectedClass.subject, stage: selectedStage, stageName: stages[selectedStage].name,
      method: selectedMethod, studySeconds, crosscheckSeconds,
      totalSeconds: studySeconds + crosscheckSeconds
    };
    const rows = sessions();
    rows.push(record);
    localStorage.setItem(SESSION_KEY, JSON.stringify(rows));
    if (selectedStage === 3 && selectedMethod === "Anki") {
      const due = dueAnkiKey();
      if (due) localStorage.setItem(ANKI_DONE + due, "1");
      renderReminder();
    }
    $("completeTitle").textContent = "Stage " + selectedStage + " — " + stages[selectedStage].name + " complete";
    $("completeDetails").textContent = selectedMethod + ": " + fmt(studySeconds) +
      (crosscheckSeconds ? " · Crosscheck: " + fmt(crosscheckSeconds) : "");
    visible("completePanel", true);
  }
  $("anotherStageBtn").addEventListener("click", () => {
    visible("completePanel", false);
    openStages();
  });
  $("finishStudyingBtn").addEventListener("click", () => {
    showHome();
    message("Study session saved.");
  });

  function weeklySummary() {
    const start = new Date();
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const rows = sessions().filter(row => {
      const time = new Date(row.timestamp);
      return time >= start && time < end;
    });
    const summary = {
      weekStart: dateKey(start), totalSeconds: 0, studyDays: 0, stageCount: rows.length,
      stage1Seconds: 0, stage2Seconds: 0, stage3Seconds: 0, crosscheckSeconds: 0,
      classes: {}, methods: {}, methodCounts: {}
    };
    const days = new Set();
    rows.forEach(row => {
      const study = Number(row.studySeconds) || 0;
      const cross = Number(row.crosscheckSeconds) || 0;
      const total = Number(row.totalSeconds) || 0;
      summary.totalSeconds += total;
      days.add(dateKey(new Date(row.timestamp)));
      const stageKey = "stage" + row.stage + "Seconds";
      if (stageKey in summary) summary[stageKey] += study;
      summary.crosscheckSeconds += cross;
      summary.classes[row.className] = (summary.classes[row.className] || 0) + total;
      summary.methods[row.method] = (summary.methods[row.method] || 0) + study;
      summary.methodCounts[row.method] = (summary.methodCounts[row.method] || 0) + 1;
    });
    summary.studyDays = days.size;
    return summary;
  }
  function renderRanking(id, values) {
    const area = $(id);
    area.innerHTML = "";
    const sorted = Object.entries(values).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) { area.textContent = "No activity yet this week."; return; }
    sorted.forEach(([label, seconds]) => {
      const row = document.createElement("div");
      row.className = "list-row";
      const left = document.createElement("span");
      left.textContent = label;
      const right = document.createElement("strong");
      right.textContent = human(seconds);
      row.appendChild(left);
      row.appendChild(right);
      area.appendChild(row);
    });
  }
  function showProgress() {
    const summary = weeklySummary();
    visible("classManagerScreen", false);
    visible("studyScreen", false);
    visible("progressScreen", true);
    $("weeklyTotal").textContent = human(summary.totalSeconds);
    $("weeklyStages").textContent = summary.stageCount;
    $("weeklyDays").textContent = summary.studyDays;
    const breakdown = $("stageBreakdown");
    breakdown.innerHTML = "";
    [["Learn", summary.stage1Seconds, "learn"], ["Verify", summary.stage2Seconds, "verify"],
      ["Assess", summary.stage3Seconds, "assess"], ["Crosscheck", summary.crosscheckSeconds, "crosscheck"]]
      .forEach(([name, seconds, css]) => {
        const row = document.createElement("div");
        row.className = "bar-row";
        const label = document.createElement("span");
        label.textContent = name;
        const track = document.createElement("div");
        track.className = "bar-track";
        const fill = document.createElement("div");
        fill.className = "bar-fill " + css;
        fill.style.width = (summary.totalSeconds ? Math.round(seconds / summary.totalSeconds * 100) : 0) + "%";
        const percent = document.createElement("strong");
        percent.textContent = fill.style.width;
        track.appendChild(fill);
        row.appendChild(label);
        row.appendChild(track);
        row.appendChild(percent);
        breakdown.appendChild(row);
      });
    renderRanking("classBreakdown", summary.classes);
    renderRanking("methodBreakdown", summary.methods);
    const sent = read(SUBMIT_KEY, {})[summary.weekStart];
    $("submissionStatus").textContent = sent
      ? "This week's summary was last shared on " + new Date(sent).toLocaleString() + "."
      : "This week has not been shared yet.";
    $("submitWeekBtn").textContent = sent ? "Update Weekly Summary" : "Share Weekly Summary";
  }
  $("progressBtn").addEventListener("click", () => {
    if (!$("timerPanel").classList.contains("hidden") ||
        !$("crosscheckPanel").classList.contains("hidden")) {
      message("Finish this stage before opening weekly progress.");
      return;
    }
    showProgress();
  });
  $("backBtn").addEventListener("click", () => classes().length ? showHome() : showClassManager());
  $("submitWeekBtn").addEventListener("click", () => {
    const endpoint = window.STUDY_TRACKER_WEEKLY_ENDPOINT;
    if (!endpoint) { $("submissionStatus").textContent = "Weekly reporting has not been configured yet."; return; }
    const s = weeklySummary();
    if (!s.stageCount) { $("submissionStatus").textContent = "There is no study activity to share yet."; return; }
    let deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId) {
      deviceId = window.crypto?.randomUUID?.() || "device-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_KEY, deviceId);
    }
    const payload = {
      action: "submitWeekly", deviceId, weekStart: s.weekStart, totalSeconds: s.totalSeconds,
      studyDays: s.studyDays, stage1Seconds: s.stage1Seconds, stage2Seconds: s.stage2Seconds,
      stage3Seconds: s.stage3Seconds, crosscheckSeconds: s.crosscheckSeconds,
      stageCount: s.stageCount, classesJson: JSON.stringify(s.classes),
      methodCountsJson: JSON.stringify(s.methodCounts)
    };
    const form = document.createElement("form");
    form.method = "POST";
    form.action = endpoint;
    form.target = "submissionFrame";
    form.className = "hidden";
    Object.entries(payload).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(value);
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    form.remove();
    const history = read(SUBMIT_KEY, {});
    history[s.weekStart] = new Date().toISOString();
    localStorage.setItem(SUBMIT_KEY, JSON.stringify(history));
    $("submissionStatus").textContent = "Weekly summary sent anonymously.";
    $("submitWeekBtn").textContent = "Update Weekly Summary";
  });

  classes().length ? showHome() : showClassManager();
})();
