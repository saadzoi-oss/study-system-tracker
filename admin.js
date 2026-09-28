(() => {

  const $ = id =>
    document.getElementById(id);

  const weekStart =
    $("weekStart");

  const loadBtn =
    $("loadBtn");

  const exportBtn =
    $("exportBtn");

  const studentCount =
    $("studentCount");

  const averageTime =
    $("averageTime");

  const averageDays =
    $("averageDays");

  const stageAverages =
    $("stageAverages");

  const classAverages =
    $("classAverages");

  const methodUsage =
    $("methodUsage");

  const summaryText =
    $("summaryText");

  const adminMessage =
    $("adminMessage");

  let currentData =
    null;


  function getMonday() {

    const date =
      new Date();

    const day =
      (date.getDay() + 6) % 7;

    date.setDate(
      date.getDate() - day
    );

    return date;
  }


  function dateString(date) {

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return (
      year +
      "-" +
      month +
      "-" +
      day
    );
  }


  weekStart.value =
    dateString(
      getMonday()
    );


  function humanTime(seconds) {

    const minutes =
      Math.round(
        (seconds || 0) / 60
      );

    if (minutes < 60) {

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

    if (remaining === 0) {

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


  function getAggregate(selectedWeek) {

    return new Promise(
      (resolve, reject) => {

        const endpoint =
          window
            .STUDY_TRACKER_WEEKLY_ENDPOINT;

        if (!endpoint) {

          reject(
            new Error(
              "Add the Apps Script URL to admin-config.js."
            )
          );

          return;
        }

        const callbackName =
          "studyDashboardCallback_" +
          Date.now();

        const script =
          document.createElement(
            "script"
          );

        function cleanup() {

          delete window[
            callbackName
          ];

          script.remove();
        }

        window[
          callbackName
        ] =
          data => {

            cleanup();

            resolve(
              data
            );
          };

        script.onerror =
          () => {

            cleanup();

            reject(
              new Error(
                "Could not connect to the reporting service."
              )
            );
          };

        script.src =
          endpoint +
          "?action=aggregate" +
          "&weekStart=" +
          encodeURIComponent(
            selectedWeek
          ) +
          "&callback=" +
          encodeURIComponent(
            callbackName
          ) +
          "&_=" +
          Date.now();

        document.body.appendChild(
          script
        );
      }
    );
  }


  loadBtn.addEventListener(
    "click",
    loadWeek
  );


  async function loadWeek() {

    adminMessage.textContent =
      "Loading...";

    try {

      const data =
        await getAggregate(
          weekStart.value
        );

      if (!data.ok) {

        throw new Error(
          data.error ||
          "Could not load data."
        );
      }

      currentData =
        data;

      renderDashboard(
        data
      );

      adminMessage.textContent =
        "";

    } catch (error) {

      adminMessage.textContent =
        error.message;
    }
  }


  function renderDashboard(data) {

    studentCount.textContent =
      data.studentCount || 0;

    averageTime.textContent =
      humanTime(
        data.avgTotalSeconds
      );

    averageDays.textContent =
      Number(
        data.avgStudyDays || 0
      ).toFixed(1);

    renderStageAverages(
      data
    );

    renderList(
      classAverages,
      data.avgClassSeconds || {},
      true
    );

    renderList(
      methodUsage,
      data.methodUsagePercent || {},
      false
    );

    summaryText.innerHTML = `

      <p>
        <strong>
          ${data.studentCount || 0}
        </strong>

        anonymous devices submitted
        a weekly summary.
      </p>

      <p>
        Average study time:

        <strong>
          ${humanTime(
            data.avgTotalSeconds
          )}
        </strong>
      </p>

      <p>
        Average study days:

        <strong>
          ${Number(
            data.avgStudyDays || 0
          ).toFixed(1)}
        </strong>
      </p>

      <p>
        Learn:

        <strong>
          ${humanTime(
            data.avgStage1Seconds
          )}
        </strong>

        <br>

        Verify:

        <strong>
          ${humanTime(
            data.avgStage2Seconds
          )}
        </strong>

        <br>

        Assess:

        <strong>
          ${humanTime(
            data.avgStage3Seconds
          )}
        </strong>

        <br>

        Crosscheck:

        <strong>
          ${humanTime(
            data.avgCrosscheckSeconds
          )}
        </strong>
      </p>
    `;
  }


  function renderStageAverages(data) {

    stageAverages.innerHTML =
      "";

    const values = [

      [
        "Learn",
        data.avgStage1Seconds
      ],

      [
        "Verify",
        data.avgStage2Seconds
      ],

      [
        "Assess",
        data.avgStage3Seconds
      ],

      [
        "Crosscheck",
        data.avgCrosscheckSeconds
      ]
    ];

    values.forEach(
      ([name, seconds]) => {

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
          humanTime(
            seconds
          );

        row.appendChild(
          left
        );

        row.appendChild(
          right
        );

        stageAverages.appendChild(
          row
        );
      }
    );
  }


  function renderList(
    element,
    data,
    timeValues
  ) {

    element.innerHTML =
      "";

    const entries =
      Object.entries(data)
        .sort(
          (a, b) =>
            b[1] - a[1]
        );

    if (entries.length === 0) {

      element.innerHTML =
        '<span class="muted">No data yet.</span>';

      return;
    }

    entries.forEach(
      ([name, value]) => {

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
          timeValues
            ? humanTime(value)
            : Math.round(value) + "%";

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


  exportBtn.addEventListener(
    "click",
    exportCSV
  );


  function exportCSV() {

    if (!currentData) {

      adminMessage.textContent =
        "Load a week first.";

      return;
    }

    const data =
      currentData;

    const rows = [

      [
        "Week Start",
        data.weekStart
      ],

      [
        "Students Represented",
        data.studentCount
      ],

      [
        "Average Total Seconds",
        data.avgTotalSeconds
      ],

      [
        "Average Study Days",
        data.avgStudyDays
      ],

      [
        "Average Learn Seconds",
        data.avgStage1Seconds
      ],

      [
        "Average Verify Seconds",
        data.avgStage2Seconds
      ],

      [
        "Average Assess Seconds",
        data.avgStage3Seconds
      ],

      [
        "Average Crosscheck Seconds",
        data.avgCrosscheckSeconds
      ],

      [],

      [
        "Class",
        "Average Seconds"
      ],

      ...Object.entries(
        data.avgClassSeconds || {}
      ),

      [],

      [
        "Method",
        "Percent Using Method"
      ],

      ...Object.entries(
        data.methodUsagePercent || {}
      )
    ];

    const csv =
      rows
        .map(
          row =>
            row
              .map(csvCell)
              .join(",")
        )
        .join("\n");

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      url;

    link.download =
      "study-system-" +
      data.weekStart +
      ".csv";

    link.click();

    URL.revokeObjectURL(
      url
    );
  }


  function csvCell(value) {

    const string =
      String(
        value ?? ""
      );

    if (
      /[",\n]/.test(
        string
      )
    ) {

      return (
        '"' +
        string.replaceAll(
          '"',
          '""'
        ) +
        '"'
      );
    }

    return string;
  }


  loadWeek();

})();
