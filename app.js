(() => {

  // ==========================================
  // STORAGE
  // ==========================================

  const CLASS_STORAGE_KEY =
    "studySystem.classes.v2";

  const SESSION_STORAGE_KEY =
    "studySystem.sessions.v2";

  const DEVICE_ID_KEY =
    "studySystem.deviceId.v2";

  const SUBMISSION_STORAGE_KEY =
    "studySystem.weeklySubmissions.v2";

  const ANKI_DONE_PREFIX =
    "studySystem.ankiDone.v2.";

  const ANKI_DISMISS_PREFIX =
    "studySystem.ankiDismiss.v2.";


  // ==========================================
  // COURSE CATALOG
  // ==========================================

  const courseCatalog = {

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


  // ==========================================
  // STUDY SYSTEM STAGES
  // ==========================================

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
      name: "Verify",

      purpose:
        "See what you can teach or produce from memory.",

      instruction:
        "Put your materials away. Do not check your notes yet. First show yourself what you actually know.",

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


  // ==========================================
  // ELEMENTS
  // ==========================================

  const $ =
    id =>
      document.getElementById(id);


  const classManagerScreen =
    $("classManagerScreen");

  const subjectSelect =
    $("subjectSelect");

  const courseSelect =
    $("courseSelect");

  const courseSelectWrap =
    $("courseSelectWrap");

  const customCourseWrap =
    $("customCourseWrap");

  const customCourse =
    $("customCourse");

  const addClassBtn =
    $("addClassBtn");

  const savedClassesPanel =
    $("savedClassesPanel");

  const savedClassesList =
    $("savedClassesList");

  const addAnotherClassBtn =
    $("addAnotherClassBtn");

  const doneAddingClassesBtn =
    $("doneAddingClassesBtn");


  const studyScreen =
    $("studyScreen");

  const studyClassPanel =
    $("studyClassPanel");

  const studyClassButtons =
    $("studyClassButtons");

  const editClassesBtn =
    $("editClassesBtn");

  const stagePanel =
    $("stagePanel");

  const selectedClassName =
    $("selectedClassName");

  const changeClassBtn =
    $("changeClassBtn");


  const methodPanel =
    $("methodPanel");

  const methodTitle =
    $("methodTitle");

  const methodPurpose =
    $("methodPurpose");

  const methodButtons =
    $("methodButtons");


  const timerPanel =
    $("timerPanel");

  const timerClass =
    $("timerClass");

  const timerStage =
    $("timerStage");

  const timerMethod =
    $("timerMethod");

  const timerInstruction =
    $("timerInstruction");

  const timerDisplay =
    $("timerDisplay");

  const startBtn =
    $("startBtn");

  const pauseBtn =
    $("pauseBtn");

  const finishBtn =
    $("finishBtn");


  const crosscheckPanel =
    $("crosscheckPanel");

  const crosscheckDisplay =
    $("crosscheckDisplay");

  const crosscheckStartBtn =
    $("crosscheckStartBtn");

  const crosscheckPauseBtn =
    $("crosscheckPauseBtn");

  const crosscheckFinishBtn =
    $("crosscheckFinishBtn");


  const completePanel =
    $("completePanel");

  const completeTitle =
    $("completeTitle");

  const completeDetails =
    $("completeDetails");

  const anotherStageBtn =
    $("anotherStageBtn");

  const finishStudyingBtn =
    $("finishStudyingBtn");


  const progressScreen =
    $("progressScreen");

  const progressBtn =
    $("progressBtn");

  const backBtn =
    $("backBtn");

  const weeklyTotal =
    $("weeklyTotal");

  const weeklyStages =
    $("weeklyStages");

  const weeklyDays =
    $("weeklyDays");

  const stageBreakdown =
    $("stageBreakdown");

  const classBreakdown =
    $("classBreakdown");

  const methodBreakdown =
    $("methodBreakdown");

  const submitWeekBtn =
    $("submitWeekBtn");

  const submissionStatus =
    $("submissionStatus");

  const message =
    $("message");


  // ==========================================
  // STATE
  // ==========================================

  let selectedClass =
    null;

  let selectedStage =
    null;

  let selectedMethod =
    "";

  let elapsedSeconds =
    0;

  let timerStartedAt =
    null;

  let timerInterval =
    null;

  let crosscheckElapsed =
    0;

  let crosscheckStartedAt =
    null;

  let crosscheckInterval =
    null;

  let completedStudySeconds =
    0;

  let completedCrosscheckSeconds =
    0;

  /*
    Used only when the student presses
    "Start Anki Session" from the reminder.

    They still choose one of their saved
    classes before the Anki timer begins.
  */

  let pendingAnkiLaunch =
    false;


  // ==========================================
  // LOCAL STORAGE
  // ==========================================

  function getSavedClasses() {

    try {

      return JSON.parse(
        localStorage.getItem(
          CLASS_STORAGE_KEY
        ) || "[]"
      );

    } catch {

      return [];
    }
  }


  function saveClassList(classes) {

    localStorage.setItem(
      CLASS_STORAGE_KEY,
      JSON.stringify(classes)
    );
  }


  function getSessions() {

    try {

      return JSON.parse(
        localStorage.getItem(
          SESSION_STORAGE_KEY
        ) || "[]"
      );

    } catch {

      return [];
    }
  }


  function saveSessions(rows) {

    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(rows)
    );
  }


  function getSubmissionHistory() {

    try {

      return JSON.parse(
        localStorage.getItem(
          SUBMISSION_STORAGE_KEY
        ) || "{}"
      );

    } catch {

      return {};
    }
  }


  function saveSubmissionHistory(history) {

    localStorage.setItem(
      SUBMISSION_STORAGE_KEY,
      JSON.stringify(history)
    );
  }


  function getDeviceId() {

    let id =
      localStorage.getItem(
        DEVICE_ID_KEY
      );

    if (!id) {

      if (
        window.crypto &&
        crypto.randomUUID
      ) {

        id =
          crypto.randomUUID();

      } else {

        id =
          "device-" +
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2);
      }

      localStorage.setItem(
        DEVICE_ID_KEY,
        id
      );
    }

    return id;
  }


  // ==========================================
  // ANKI REMINDER HELPERS
  // Monday + Thursday
  // ==========================================

  function localDateKey(
    date = new Date()
  ) {

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        date.getDate()
      ).padStart(
        2,
        "0"
      );

    return (
      year +
      "-" +
      month +
      "-" +
      day
    );
  }


  function isAnkiDay(date) {

    const day =
      date.getDay();

    return (
      day === 1 ||
      day === 4
    );
  }


  function isAnkiDone(
    dateKey
  ) {

    return (
      localStorage.getItem(
        ANKI_DONE_PREFIX +
        dateKey
      ) === "1"
    );
  }


  function markAnkiDone(
    dateKey
  ) {

    if (!dateKey) {

      return;
    }

    localStorage.setItem(
      ANKI_DONE_PREFIX +
      dateKey,
      "1"
    );
  }


  function isAnkiDismissedToday() {

    const todayKey =
      localDateKey();

    return (
      localStorage.getItem(
        ANKI_DISMISS_PREFIX +
        todayKey
      ) === "1"
    );
  }


  function dismissAnkiForToday() {

    const todayKey =
      localDateKey();

    localStorage.setItem(
      ANKI_DISMISS_PREFIX +
      todayKey,
      "1"
    );
  }


  function getOutstandingAnkiDays() {

    const today =
      new Date();

    today.setHours(
      12,
      0,
      0,
      0
    );


    const monday =
      new Date(
        today
      );


    const currentDay =
      today.getDay();


    const daysSinceMonday =
      currentDay === 0
        ? 6
        : currentDay - 1;


    monday.setDate(
      today.getDate() -
      daysSinceMonday
    );


    const outstanding =
      [];


    const cursor =
      new Date(
        monday
      );


    while (
      cursor <= today
    ) {

      if (
        isAnkiDay(
          cursor
        )
      ) {

        const key =
          localDateKey(
            cursor
          );


        if (
          !isAnkiDone(
            key
          )
        ) {

          outstanding.push({

            date:
              new Date(
                cursor
              ),

            dateKey:
              key
          });
        }
      }


      cursor.setDate(
        cursor.getDate() +
        1
      );
    }


    return outstanding;
  }


  function completeAnkiRequirement() {

    const outstanding =
      getOutstandingAnkiDays();


    if (
      outstanding.length === 0
    ) {

      return;
    }


    /*
      One completed Anki session clears
      one outstanding required session.

      Oldest requirement clears first.
    */

    markAnkiDone(
      outstanding[0]
        .dateKey
    );
  }


  function getDayName(date) {

    return date.toLocaleDateString(
      undefined,
      {
        weekday:
          "long"
      }
    );
  }


  // ==========================================
  // ANKI REMINDER UI
  // Created automatically so index.html
  // does not need to be changed.
  // ==========================================

  function createAnkiReminderCard() {

    if (
      document.getElementById(
        "ankiReminderCard"
      )
    ) {

      return;
    }


    const card =
      document.createElement(
        "div"
      );


    card.id =
      "ankiReminderCard";

    card.className =
      "card hidden";

    card.style.marginBottom =
      "16px";


    const label =
      document.createElement(
        "div"
      );

    label.textContent =
      "ANKI REMINDER";

    label.style.fontSize =
      "0.8rem";

    label.style.fontWeight =
      "700";

    label.style.opacity =
      "0.7";

    label.style.marginBottom =
      "6px";


    const title =
      document.createElement(
        "h2"
      );

    title.id =
      "ankiReminderTitle";


    const text =
      document.createElement(
        "p"
      );

    text.id =
      "ankiReminderText";


    const buttonRow =
      document.createElement(
        "div"
      );

    buttonRow.style.display =
      "flex";

    buttonRow.style.flexWrap =
      "wrap";

    buttonRow.style.gap =
      "10px";


    const startButton =
      document.createElement(
        "button"
      );

    startButton.id =
      "ankiReminderStartBtn";

    startButton.type =
      "button";

    startButton.className =
      "primary";

    startButton.textContent =
      "Start Anki Session";


    const dismissButton =
      document.createElement(
        "button"
      );

    dismissButton.id =
      "ankiReminderDismissBtn";

    dismissButton.type =
      "button";

    dismissButton.className =
      "secondary";

    dismissButton.textContent =
      "Hide for Today";


    buttonRow.appendChild(
      startButton
    );

    buttonRow.appendChild(
      dismissButton
    );


    card.appendChild(
      label
    );

    card.appendChild(
      title
    );

    card.appendChild(
      text
    );

    card.appendChild(
      buttonRow
    );


    /*
      Put reminder directly above
      the saved-class choices.
    */

    if (
      studyClassPanel &&
      studyClassPanel.parentNode
    ) {

      studyClassPanel.parentNode.insertBefore(
        card,
        studyClassPanel
      );

    } else {

      studyScreen.prepend(
        card
      );
    }


    startButton.addEventListener(
      "click",
      () => {

        /*
          Student must still choose one
          of the classes they previously saved.
        */

        pendingAnkiLaunch =
          true;

        selectedClass =
          null;

        selectedStage =
          null;

        selectedMethod =
          "";

        stagePanel.classList.add(
          "hidden"
        );

        methodPanel.classList.add(
          "hidden"
        );

        studyClassPanel.classList.remove(
          "hidden"
        );

        renderStudyClassButtons();

        message.textContent =
          "Choose the class for your Anki session.";
      }
    );


    dismissButton.addEventListener(
      "click",
      () => {

        dismissAnkiForToday();

        card.classList.add(
          "hidden"
        );
      }
    );
  }


  function renderAnkiReminder() {

    const card =
      document.getElementById(
        "ankiReminderCard"
      );

    const title =
      document.getElementById(
        "ankiReminderTitle"
      );

    const text =
      document.getElementById(
        "ankiReminderText"
      );


    if (
      !card ||
      !title ||
      !text
    ) {

      return;
    }


    card.classList.add(
      "hidden"
    );


    /*
      Never show reminder before
      student has set up classes.
    */

    if (
      getSavedClasses()
        .length === 0
    ) {

      return;
    }


    if (
      isAnkiDismissedToday()
    ) {

      return;
    }


    const outstanding =
      getOutstandingAnkiDays();


    if (
      outstanding.length === 0
    ) {

      return;
    }


    const requirement =
      outstanding[0];


    const todayKey =
      localDateKey();


    if (
      requirement.dateKey ===
      todayKey
    ) {

      title.textContent =
        "Anki due today";


      text.textContent =
        "Today is " +
        getDayName(
          requirement.date
        ) +
        ". Complete one Anki session.";

    } else {

      title.textContent =
        "Anki make-up session due";


      text.textContent =
        "You missed your " +
        getDayName(
          requirement.date
        ) +
        " Anki session. Complete one session when you can.";
    }


    card.classList.remove(
      "hidden"
    );
  }


  // ==========================================
  // CLASS SETUP
  // ==========================================

  subjectSelect.addEventListener(
    "change",
    () => {

      populateCourses(
        subjectSelect.value
      );
    }
  );


  function populateCourses(subject) {

    courseSelect.innerHTML =
      '<option value="">Select class</option>';

    customCourse.value =
      "";

    customCourseWrap.classList.add(
      "hidden"
    );

    addClassBtn.classList.add(
      "hidden"
    );

    if (!subject) {

      courseSelectWrap.classList.add(
        "hidden"
      );

      return;
    }

    const courses =
      courseCatalog[subject] || [];

    courses.forEach(
      course => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          course;

        option.textContent =
          course;

        courseSelect.appendChild(
          option
        );
      }
    );

    courseSelectWrap.classList.remove(
      "hidden"
    );
  }


  courseSelect.addEventListener(
    "change",
    () => {

      const selected =
        courseSelect.value;

      if (!selected) {

        customCourseWrap.classList.add(
          "hidden"
        );

        addClassBtn.classList.add(
          "hidden"
        );

        return;
      }

      if (
        selected.startsWith(
          "Other"
        )
      ) {

        customCourseWrap.classList.remove(
          "hidden"
        );

      } else {

        customCourseWrap.classList.add(
          "hidden"
        );
      }

      addClassBtn.classList.remove(
        "hidden"
      );
    }
  );


  addClassBtn.addEventListener(
    "click",
    () => {

      const subject =
        subjectSelect.value;

      let className =
        courseSelect.value;

      if (
        className.startsWith(
          "Other"
        )
      ) {

        className =
          customCourse.value.trim();
      }

      if (
        !subject ||
        !className
      ) {

        message.textContent =
          "Choose a subject and class.";

        return;
      }

      const classes =
        getSavedClasses();

      const exists =
        classes.some(
          course =>
            course.name
              .toLowerCase() ===
            className
              .toLowerCase()
        );

      if (!exists) {

        classes.push({
          name:
            className,

          subject:
            subject
        });

        saveClassList(
          classes
        );
      }

      renderSavedClasses();

      savedClassesPanel.classList.remove(
        "hidden"
      );

      resetClassForm();

      message.textContent =
        "";
    }
  );


  function resetClassForm() {

    subjectSelect.value =
      "";

    courseSelect.innerHTML =
      '<option value="">Select class</option>';

    courseSelectWrap.classList.add(
      "hidden"
    );

    customCourseWrap.classList.add(
      "hidden"
    );

    customCourse.value =
      "";

    addClassBtn.classList.add(
      "hidden"
    );
  }


  function renderSavedClasses() {

    const classes =
      getSavedClasses();

    savedClassesList.innerHTML =
      "";

    if (
      classes.length === 0
    ) {

      savedClassesPanel.classList.add(
        "hidden"
      );

      return;
    }

    savedClassesPanel.classList.remove(
      "hidden"
    );

    classes.forEach(
      (course, index) => {

        const row =
          document.createElement(
            "div"
          );

        row.className =
          "saved-class-row";

        const info =
          document.createElement(
            "div"
          );

        info.className =
          "saved-class-info";

        const name =
          document.createElement(
            "span"
          );

        name.className =
          "saved-class-name";

        name.textContent =
          course.name;

        const subject =
          document.createElement(
            "span"
          );

        subject.className =
          "saved-class-subject";

        subject.textContent =
          course.subject;

        info.appendChild(
          name
        );

        info.appendChild(
          subject
        );

        const removeButton =
          document.createElement(
            "button"
          );

        removeButton.type =
          "button";

        removeButton.className =
          "secondary";

        removeButton.textContent =
          "Remove";

        removeButton.addEventListener(
          "click",
          () => {

            removeClass(
              index
            );
          }
        );

        row.appendChild(
          info
        );

        row.appendChild(
          removeButton
        );

        savedClassesList.appendChild(
          row
        );
      }
    );
  }


  function removeClass(index) {

    const classes =
      getSavedClasses();

    classes.splice(
      index,
      1
    );

    saveClassList(
      classes
    );

    renderSavedClasses();

    renderStudyClassButtons();
  }


  addAnotherClassBtn.addEventListener(
    "click",
    () => {

      resetClassForm();

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  );


  doneAddingClassesBtn.addEventListener(
    "click",
    () => {

      if (
        getSavedClasses()
          .length === 0
      ) {

        message.textContent =
          "Add at least one class first.";

        return;
      }

      showStudyHome();
    }
  );


  editClassesBtn.addEventListener(
    "click",
    () => {

      showClassManager();
    }
  );


  // ==========================================
  // CLASS SELECTION FOR STUDY
  // ==========================================

  function renderStudyClassButtons() {

    const classes =
      getSavedClasses();

    studyClassButtons.innerHTML =
      "";

    classes.forEach(
      course => {

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "class-button";

        const name =
          document.createElement(
            "strong"
          );

        name.textContent =
          course.name;

        const subject =
          document.createElement(
            "span"
          );

        subject.textContent =
          course.subject;

        button.appendChild(
          name
        );

        button.appendChild(
          subject
        );


        button.addEventListener(
          "click",
          () => {

            selectedClass =
              course;


            /*
              If student arrived here from
              the Anki reminder, selecting
              their class immediately opens
              Stage 3 → Anki.
            */

            if (
              pendingAnkiLaunch
            ) {

              pendingAnkiLaunch =
                false;

              selectedStage =
                3;

              openTimer(
                "Anki"
              );

              return;
            }


            openStageSelection();
          }
        );


        studyClassButtons.appendChild(
          button
        );
      }
    );
  }


  function openStageSelection() {

    studyClassPanel.classList.add(
      "hidden"
    );

    stagePanel.classList.remove(
      "hidden"
    );

    selectedClassName.textContent =
      selectedClass.name;

    methodPanel.classList.add(
      "hidden"
    );

    selectedStage =
      null;

    document
      .querySelectorAll(
        ".stage-card"
      )
      .forEach(
        card =>
          card.classList.remove(
            "selected"
          )
      );
  }


  changeClassBtn.addEventListener(
    "click",
    () => {

      selectedClass =
        null;

      selectedStage =
        null;

      pendingAnkiLaunch =
        false;

      stagePanel.classList.add(
        "hidden"
      );

      methodPanel.classList.add(
        "hidden"
      );

      studyClassPanel.classList.remove(
        "hidden"
      );

      renderAnkiReminder();
    }
  );


  // ==========================================
  // STAGE SELECTION
  // ==========================================

  document
    .querySelectorAll(
      ".stage-card"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            selectedStage =
              Number(
                button.dataset.stage
              );

            document
              .querySelectorAll(
                ".stage-card"
              )
              .forEach(
                card =>
                  card.classList.remove(
                    "selected"
                  )
              );

            button.classList.add(
              "selected"
            );

            renderMethods(
              selectedStage
            );
          }
        );
      }
    );


  function renderMethods(
    stageNumber
  ) {

    const stage =
      stages[
        stageNumber
      ];

    methodTitle.textContent =
      "Stage " +
      stageNumber +
      " — " +
      stage.name;

    methodPurpose.textContent =
      stage.purpose;

    methodButtons.innerHTML =
      "";

    stage.methods.forEach(
      method => {

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.textContent =
          method;

        button.addEventListener(
          "click",
          () => {

            openTimer(
              method
            );
          }
        );

        methodButtons.appendChild(
          button
        );
      }
    );

    methodPanel.classList.remove(
      "hidden"
    );
  }


  // ==========================================
  // MAIN TIMER
  // ==========================================

  function openTimer(
    method
  ) {

    selectedMethod =
      method;

    elapsedSeconds =
      0;

    timerStartedAt =
      null;

    timerDisplay.textContent =
      "00:00";

    timerClass.textContent =
      selectedClass.name;

    timerStage.textContent =
      "Stage " +
      selectedStage +
      " — " +
      stages[
        selectedStage
      ].name;

    timerMethod.textContent =
      method;

    timerInstruction.textContent =
      stages[
        selectedStage
      ].instruction;

    startBtn.classList.remove(
      "hidden"
    );

    pauseBtn.classList.add(
      "hidden"
    );

    finishBtn.classList.add(
      "hidden"
    );

    pauseBtn.textContent =
      "Pause";

    studyClassPanel.classList.add(
      "hidden"
    );

    stagePanel.classList.add(
      "hidden"
    );

    methodPanel.classList.add(
      "hidden"
    );

    timerPanel.classList.remove(
      "hidden"
    );


    const ankiReminderCard =
      document.getElementById(
        "ankiReminderCard"
      );


    if (
      ankiReminderCard
    ) {

      ankiReminderCard.classList.add(
        "hidden"
      );
    }
  }


  function updateTimer() {

    let total =
      elapsedSeconds;

    if (
      timerStartedAt
    ) {

      total +=
        (
          Date.now() -
          timerStartedAt
        ) / 1000;
    }

    timerDisplay.textContent =
      formatTimer(
        total
      );
  }


  function stopTimer() {

    if (
      timerStartedAt
    ) {

      elapsedSeconds +=
        (
          Date.now() -
          timerStartedAt
        ) / 1000;

      timerStartedAt =
        null;
    }

    if (
      timerInterval
    ) {

      clearInterval(
        timerInterval
      );

      timerInterval =
        null;
    }

    updateTimer();
  }


  startBtn.addEventListener(
    "click",
    () => {

      timerStartedAt =
        Date.now();

      timerInterval =
        setInterval(
          updateTimer,
          250
        );

      startBtn.classList.add(
        "hidden"
      );

      pauseBtn.classList.remove(
        "hidden"
      );

      finishBtn.classList.remove(
        "hidden"
      );
    }
  );


  pauseBtn.addEventListener(
    "click",
    () => {

      if (
        timerStartedAt
      ) {

        stopTimer();

        pauseBtn.textContent =
          "Resume";

      } else {

        timerStartedAt =
          Date.now();

        timerInterval =
          setInterval(
            updateTimer,
            250
          );

        pauseBtn.textContent =
          "Pause";
      }
    }
  );


  finishBtn.addEventListener(
    "click",
    () => {

      stopTimer();

      completedStudySeconds =
        Math.floor(
          elapsedSeconds
        );

      timerPanel.classList.add(
        "hidden"
      );

      if (
        selectedStage === 2
      ) {

        prepareCrosscheck();

      } else {

        completedCrosscheckSeconds =
          0;

        saveCompletedStage();
      }
    }
  );


  // ==========================================
  // CROSSCHECK
  // ==========================================

  function prepareCrosscheck() {

    crosscheckElapsed =
      0;

    crosscheckStartedAt =
      null;

    crosscheckDisplay.textContent =
      "00:00";

    crosscheckStartBtn.classList.remove(
      "hidden"
    );

    crosscheckPauseBtn.classList.add(
      "hidden"
    );

    crosscheckFinishBtn.classList.add(
      "hidden"
    );

    crosscheckPauseBtn.textContent =
      "Pause";

    crosscheckPanel.classList.remove(
      "hidden"
    );
  }


  function updateCrosscheckTimer() {

    let total =
      crosscheckElapsed;

    if (
      crosscheckStartedAt
    ) {

      total +=
        (
          Date.now() -
          crosscheckStartedAt
        ) / 1000;
    }

    crosscheckDisplay.textContent =
      formatTimer(
        total
      );
  }


  function stopCrosscheckTimer() {

    if (
      crosscheckStartedAt
    ) {

      crosscheckElapsed +=
        (
          Date.now() -
          crosscheckStartedAt
        ) / 1000;

      crosscheckStartedAt =
        null;
    }

    if (
      crosscheckInterval
    ) {

      clearInterval(
        crosscheckInterval
      );

      crosscheckInterval =
        null;
    }

    updateCrosscheckTimer();
  }


  crosscheckStartBtn.addEventListener(
    "click",
    () => {

      crosscheckStartedAt =
        Date.now();

      crosscheckInterval =
        setInterval(
          updateCrosscheckTimer,
          250
        );

      crosscheckStartBtn.classList.add(
        "hidden"
      );

      crosscheckPauseBtn.classList.remove(
        "hidden"
      );

      crosscheckFinishBtn.classList.remove(
        "hidden"
      );
    }
  );


  crosscheckPauseBtn.addEventListener(
    "click",
    () => {

      if (
        crosscheckStartedAt
      ) {

        stopCrosscheckTimer();

        crosscheckPauseBtn.textContent =
          "Resume";

      } else {

        crosscheckStartedAt =
          Date.now();

        crosscheckInterval =
          setInterval(
            updateCrosscheckTimer,
            250
          );

        crosscheckPauseBtn.textContent =
          "Pause";
      }
    }
  );


  crosscheckFinishBtn.addEventListener(
    "click",
    () => {

      stopCrosscheckTimer();

      completedCrosscheckSeconds =
        Math.floor(
          crosscheckElapsed
        );

      crosscheckPanel.classList.add(
        "hidden"
      );

      saveCompletedStage();
    }
  );


  // ==========================================
  // SAVE COMPLETED STAGE
  // ==========================================

  function saveCompletedStage() {

    const record = {

      timestamp:
        new Date()
          .toISOString(),

      className:
        selectedClass.name,

      subject:
        selectedClass.subject,

      stage:
        selectedStage,

      stageName:
        stages[
          selectedStage
        ].name,

      method:
        selectedMethod,

      studySeconds:
        completedStudySeconds,

      crosscheckSeconds:
        completedCrosscheckSeconds,

      totalSeconds:
        completedStudySeconds +
        completedCrosscheckSeconds
    };


    const rows =
      getSessions();

    rows.push(
      record
    );

    saveSessions(
      rows
    );


    /*
      IMPORTANT:

      Completing Stage 3 → Anki clears
      one outstanding Monday/Thursday
      Anki requirement.

      This works whether Anki was started
      from the reminder OR selected manually
      through the normal Stage 3 menu.
    */

    if (
      selectedStage === 3 &&
      selectedMethod === "Anki"
    ) {

      completeAnkiRequirement();
    }


    completeTitle.textContent =
      "Stage " +
      selectedStage +
      " — " +
      stages[
        selectedStage
      ].name +
      " complete";


    completeDetails.textContent =
      selectedMethod +
      ": " +
      formatTimer(
        completedStudySeconds
      ) +
      (
        completedCrosscheckSeconds
          ? " · Crosscheck: " +
            formatTimer(
              completedCrosscheckSeconds
            )
          : ""
      );


    completePanel.classList.remove(
      "hidden"
    );
  }


  // ==========================================
  // AFTER STAGE
  // ==========================================

  anotherStageBtn.addEventListener(
    "click",
    () => {

      completePanel.classList.add(
        "hidden"
      );

      openStageSelection();
    }
  );


  finishStudyingBtn.addEventListener(
    "click",
    () => {

      completePanel.classList.add(
        "hidden"
      );

      selectedClass =
        null;

      selectedStage =
        null;

      selectedMethod =
        "";

      pendingAnkiLaunch =
        false;

      stagePanel.classList.add(
        "hidden"
      );

      methodPanel.classList.add(
        "hidden"
      );

      studyClassPanel.classList.remove(
        "hidden"
      );

      renderStudyClassButtons();

      renderAnkiReminder();

      message.textContent =
        "Study session saved.";
    }
  );


  // ==========================================
  // TIME HELPERS
  // ==========================================

  function formatTimer(
    seconds
  ) {

    const total =
      Math.max(
        0,
        Math.floor(
          seconds || 0
        )
      );

    const minutes =
      Math.floor(
        total / 60
      );

    const secs =
      total % 60;

    return (
      String(
        minutes
      ).padStart(
        2,
        "0"
      ) +
      ":" +
      String(
        secs
      ).padStart(
        2,
        "0"
      )
    );
  }


  function humanTime(
    seconds
  ) {

    const minutes =
      Math.round(
        (
          seconds || 0
        ) / 60
      );

    if (
      minutes < 60
    ) {

      return (
        minutes +
        " min"
      );
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    const remaining =
      minutes % 60;

    if (
      remaining === 0
    ) {

      return (
        hours +
        " hr"
      );
    }

    return (
      hours +
      " hr " +
      remaining +
      " min"
    );
  }


  // ==========================================
  // WEEK HELPERS
  // ==========================================

  function getMonday(
    date = new Date()
  ) {

    const result =
      new Date(
        date
      );

    const day =
      (
        result.getDay() +
        6
      ) % 7;

    result.setDate(
      result.getDate() -
      day
    );

    result.setHours(
      0,
      0,
      0,
      0
    );

    return result;
  }


  function weekKey(
    date
  ) {

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() +
        1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        date.getDate()
      ).padStart(
        2,
        "0"
      );

    return (
      year +
      "-" +
      month +
      "-" +
      day
    );
  }


  // ==========================================
  // WEEKLY SUMMARY
  // ==========================================

  function createWeeklySummary() {

    const start =
      getMonday();

    const end =
      new Date(
        start
      );

    end.setDate(
      end.getDate() +
      7
    );


    const rows =
      getSessions()
        .filter(
          row => {

            const timestamp =
              new Date(
                row.timestamp
              );

            return (
              timestamp >= start &&
              timestamp < end
            );
          }
        );


    const summary = {

      weekStart:
        weekKey(
          start
        ),

      totalSeconds:
        0,

      stageCount:
        rows.length,

      studyDays:
        new Set(),

      stage1Seconds:
        0,

      stage2Seconds:
        0,

      stage3Seconds:
        0,

      crosscheckSeconds:
        0,

      classes:
        {},

      methods:
        {},

      methodCounts:
        {}
    };


    rows.forEach(
      row => {

        summary.totalSeconds +=
          row.totalSeconds || 0;

        summary.studyDays.add(
          row.timestamp.slice(
            0,
            10
          )
        );


        if (
          row.stage === 1
        ) {

          summary.stage1Seconds +=
            row.studySeconds || 0;
        }


        if (
          row.stage === 2
        ) {

          summary.stage2Seconds +=
            row.studySeconds || 0;
        }


        if (
          row.stage === 3
        ) {

          summary.stage3Seconds +=
            row.studySeconds || 0;
        }


        summary.crosscheckSeconds +=
          row.crosscheckSeconds || 0;


        summary.classes[
          row.className
        ] =
          (
            summary.classes[
              row.className
            ] || 0
          ) +
          (
            row.totalSeconds || 0
          );


        summary.methods[
          row.method
        ] =
          (
            summary.methods[
              row.method
            ] || 0
          ) +
          (
            row.studySeconds || 0
          );


        summary.methodCounts[
          row.method
        ] =
          (
            summary.methodCounts[
              row.method
            ] || 0
          ) + 1;
      }
    );


    summary.studyDays =
      summary.studyDays.size;


    return summary;
  }


  // ==========================================
  // WEEKLY PROGRESS
  // ==========================================

  progressBtn.addEventListener(
    "click",
    () => {

      showWeeklyProgress();
    }
  );


  backBtn.addEventListener(
    "click",
    () => {

      progressScreen.classList.add(
        "hidden"
      );

      if (
        getSavedClasses()
          .length === 0
      ) {

        showClassManager();

      } else {

        showStudyHome();
      }
    }
  );


  function showWeeklyProgress() {

    const summary =
      createWeeklySummary();


    classManagerScreen.classList.add(
      "hidden"
    );

    studyScreen.classList.add(
      "hidden"
    );

    progressScreen.classList.remove(
      "hidden"
    );


    weeklyTotal.textContent =
      humanTime(
        summary.totalSeconds
      );

    weeklyStages.textContent =
      summary.stageCount;

    weeklyDays.textContent =
      summary.studyDays;


    renderStageBreakdown(
      summary
    );


    renderRanking(
      classBreakdown,
      summary.classes,
      true
    );


    renderRanking(
      methodBreakdown,
      summary.methods,
      true
    );


    updateSubmissionStatus(
      summary.weekStart
    );
  }


  function renderStageBreakdown(
    summary
  ) {

    stageBreakdown.innerHTML =
      "";


    const rows = [

      {
        name:
          "Learn",

        seconds:
          summary.stage1Seconds,

        css:
          "learn"
      },

      {
        name:
          "Verify",

        seconds:
          summary.stage2Seconds,

        css:
          "verify"
      },

      {
        name:
          "Assess",

        seconds:
          summary.stage3Seconds,

        css:
          "assess"
      },

      {
        name:
          "Crosscheck",

        seconds:
          summary.crosscheckSeconds,

        css:
          "crosscheck"
      }

    ];


    rows.forEach(
      item => {

        const percent =
          summary.totalSeconds
            ? Math.round(
                (
                  item.seconds /
                  summary.totalSeconds
                ) *
                100
              )
            : 0;


        const row =
          document.createElement(
            "div"
          );


        row.className =
          "bar-row";


        row.innerHTML = `

          <span>
            ${item.name}
          </span>

          <div class="bar-track">

            <div
              class="bar-fill ${item.css}"
              style="width:${percent}%"
            ></div>

          </div>

          <strong>
            ${percent}%
          </strong>
        `;


        stageBreakdown.appendChild(
          row
        );
      }
    );
  }


  function renderRanking(
    element,
    data,
    showTime
  ) {

    element.innerHTML =
      "";


    const entries =
      Object.entries(
        data
      )
      .sort(
        (
          a,
          b
        ) =>
          b[1] -
          a[1]
      );


    if (
      entries.length === 0
    ) {

      element.innerHTML =
        '<span class="muted">No activity yet this week.</span>';

      return;
    }


    entries.forEach(
      (
        [
          name,
          value
        ]
      ) => {

        const row =
          document.createElement(
            "div"
          );

        row.className =
          "list-row";


        const left =
          document.createElement(
            "span"
          );

        left.textContent =
          name;


        const right =
          document.createElement(
            "strong"
          );

        right.textContent =
          showTime
            ? humanTime(
                value
              )
            : value;


        row.appendChild(
          left
        );

        row.appendChild(
          right
        );


        element.appendChild(
          row
        );
      }
    );
  }


  // ==========================================
  // WEEKLY SUBMISSION
  // ==========================================

  function updateSubmissionStatus(
    week
  ) {

    const history =
      getSubmissionHistory();


    if (
      history[
        week
      ]
    ) {

      submissionStatus.textContent =
        "This week's summary was last shared on " +
        new Date(
          history[
            week
          ]
        ).toLocaleString() +
        ".";

      submitWeekBtn.textContent =
        "Update Weekly Summary";

    } else {

      submissionStatus.textContent =
        "This week has not been shared yet.";

      submitWeekBtn.textContent =
        "Share Weekly Summary";
    }
  }


  submitWeekBtn.addEventListener(
    "click",
    () => {

      submitWeeklySummary();
    }
  );


  function submitWeeklySummary() {

    const endpoint =
      window
        .STUDY_TRACKER_WEEKLY_ENDPOINT;


    if (
      !endpoint
    ) {

      submissionStatus.textContent =
        "Weekly reporting has not been configured yet.";

      return;
    }


    const summary =
      createWeeklySummary();


    if (
      summary.stageCount === 0
    ) {

      submissionStatus.textContent =
        "There is no study activity to share yet.";

      return;
    }


    const form =
      document.createElement(
        "form"
      );


    form.method =
      "POST";

    form.action =
      endpoint;

    form.target =
      "submissionFrame";

    form.className =
      "hidden";


    const payload = {

      action:
        "submitWeekly",

      deviceId:
        getDeviceId(),

      weekStart:
        summary.weekStart,

      totalSeconds:
        summary.totalSeconds,

      studyDays:
        summary.studyDays,

      stage1Seconds:
        summary.stage1Seconds,

      stage2Seconds:
        summary.stage2Seconds,

      stage3Seconds:
        summary.stage3Seconds,

      crosscheckSeconds:
        summary.crosscheckSeconds,

      stageCount:
        summary.stageCount,

      classesJson:
        JSON.stringify(
          summary.classes
        ),

      methodCountsJson:
        JSON.stringify(
          summary.methodCounts
        )
    };


    Object.entries(
      payload
    )
    .forEach(
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
          value;

        form.appendChild(
          input
        );
      }
    );


    document.body.appendChild(
      form
    );


    form.submit();


    form.remove();


    const history =
      getSubmissionHistory();


    history[
      summary.weekStart
    ] =
      new Date()
        .toISOString();


    saveSubmissionHistory(
      history
    );


    submissionStatus.textContent =
      "Weekly summary sent anonymously.";


    submitWeekBtn.textContent =
      "Update Weekly Summary";
  }


  // ==========================================
  // SCREEN HELPERS
  // ==========================================

  function showClassManager() {

    pendingAnkiLaunch =
      false;

    progressScreen.classList.add(
      "hidden"
    );

    studyScreen.classList.add(
      "hidden"
    );

    classManagerScreen.classList.remove(
      "hidden"
    );


    renderSavedClasses();

    resetClassForm();
  }


  function showStudyHome() {

    classManagerScreen.classList.add(
      "hidden"
    );

    progressScreen.classList.add(
      "hidden"
    );

    studyScreen.classList.remove(
      "hidden"
    );

    studyClassPanel.classList.remove(
      "hidden"
    );

    stagePanel.classList.add(
      "hidden"
    );

    methodPanel.classList.add(
      "hidden"
    );

    timerPanel.classList.add(
      "hidden"
    );

    crosscheckPanel.classList.add(
      "hidden"
    );

    completePanel.classList.add(
      "hidden"
    );


    selectedClass =
      null;

    selectedStage =
      null;

    selectedMethod =
      "";


    renderStudyClassButtons();

    renderAnkiReminder();
  }


  // ==========================================
  // INITIALIZE
  // ==========================================

  function initialize() {

    createAnkiReminderCard();


    const classes =
      getSavedClasses();


    /*
      FIRST VISIT:

      No saved classes means student
      MUST set up classes first.

      FUTURE VISITS:

      Saved classes exist, so app
      goes directly to Study Home.
    */

    if (
      classes.length === 0
    ) {

      showClassManager();

    } else {

      showStudyHome();
    }
  }


  initialize();


})();
