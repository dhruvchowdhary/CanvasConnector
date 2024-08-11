chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startScanning") {
    chrome.storage.local.set({ scriptStarted: true }, () => {
      startScanning();
    });
  }
});

async function startScanning() {
  console.log("Scanning started...");
  await processNextCourse();
}

async function processNextCourse() {
  chrome.storage.local.get(
    [
      "coursesWithPeopleTab",
      "currentIndex",
      "stopScript",
      "totalPeopleScanned",
      "userCourseMap",
      "scriptStarted",
      "selectedCourses",
    ],
    async (data) => {
      let courses = data.coursesWithPeopleTab || [];
      let selectedCourses = (data.selectedCourses || []).map((id) =>
        parseInt(id)
      );
      let currentIndex = data.currentIndex || 0;
      let stopScript = data.stopScript || false;
      let totalPeopleScanned = data.totalPeopleScanned || 0;
      let userCourseMap = data.userCourseMap || {};
      let scriptStarted = data.scriptStarted || false;

      console.log("Script started: ", scriptStarted);
      console.log("Selected Courses: ", selectedCourses);
      console.log("Available Courses with People Tab: ", courses);

      courses = courses.filter((course) => selectedCourses.includes(course.id));

      console.log("Courses to process after filtering: ", courses);

      if (!scriptStarted || stopScript) {
        updatePopupStatus(
          scriptStarted ? "Stopped by user." : "Waiting for start command...",
          currentIndex,
          totalPeopleScanned
        );
        return;
      }

      if (currentIndex < courses.length) {
        let course = courses[currentIndex];
        console.log(`Navigating to course: ${course.name} (${course.id})`);

        if (!course || !course.link) {
          console.error("Invalid course or missing People link:", course);
          await processNextCourse();
          return;
        }

        await chrome.storage.local.set({ currentIndex: currentIndex + 1 });

        window.location.href = course.link;
      } else {
        await chrome.storage.local.set({
          processingComplete: true,
          scriptStarted: false,
        });
        identifyAndStoreDuplicates(userCourseMap);
        updatePopupStatus(
          "Complete. All courses processed.",
          currentIndex,
          totalPeopleScanned
        );
      }
    }
  );
}

function updatePopupStatus(status, coursesProcessed, totalPeopleScanned) {
  console.log("Updating status: ", status);
  chrome.runtime.sendMessage({
    action: "updateStatus",
    status: status,
    coursesProcessed: coursesProcessed,
    totalPeopleScanned: totalPeopleScanned,
  });
}

async function extractAndProceed() {
  chrome.storage.local.get("scriptStarted", async (data) => {
    const scriptStarted = data.scriptStarted || false;

    if (!scriptStarted) {
      console.log("Script is not started. Skipping extraction.");
      return;
    }

    try {
      await waitForElement("tr.rosterUser", 10000);
      console.log("User list detected, proceeding with extraction.");

      await scrollAndLoadAllUsers();

      let users = extractUsers(document);
      console.log("Users extracted:", users);

      chrome.storage.local.get(
        ["userCourseMap", "totalPeopleScanned"],
        async (data) => {
          let userCourseMap = data.userCourseMap || {};
          let totalPeopleScanned = data.totalPeopleScanned || 0;

          let courseNameElement =
            document.querySelector("h1.course-title") ||
            document.querySelector(
              "#breadcrumbs ul li:nth-last-child(2) span.ellipsible"
            );
          let courseName = courseNameElement
            ? courseNameElement.innerText.trim()
            : "Unknown Course";

          users.forEach((user) => {
            if (!userCourseMap[user.name]) {
              userCourseMap[user.name] = [];
            }
            userCourseMap[user.name].push(courseName);
          });

          totalPeopleScanned += users.length;

          await chrome.storage.local.set({
            userCourseMap: userCourseMap,
            totalPeopleScanned: totalPeopleScanned,
          });
          console.log(`Stored users for ${courseName}.`);

          chrome.storage.local.get("currentIndex", async (data) => {
            let currentIndex = data.currentIndex || 0;
            updatePopupStatus(
              "Scanning in progress...",
              currentIndex,
              totalPeopleScanned
            );
            await processNextCourse();
          });
        }
      );
    } catch (error) {
      console.error("Error during extraction or timeout occurred:", error);
      await processNextCourse();
    }
  });
}

async function scrollAndLoadAllUsers() {
  let lastHeight = document.body.scrollHeight;
  while (true) {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    let newHeight = document.body.scrollHeight;
    if (newHeight === lastHeight) {
      break;
    }
    lastHeight = newHeight;
  }
}

function extractUsers(doc) {
  let users = [];

  const userRows = doc.querySelectorAll("tr.rosterUser");

  userRows.forEach((row) => {
    const nameElement = row.querySelector("td a.roster_user_name");
    const name = nameElement ? nameElement.innerText.trim() : "";

    users.push({ name });
  });

  return users;
}

function identifyAndStoreDuplicates(userCourseMap) {
  const duplicates = {};

  for (const [name, courses] of Object.entries(userCourseMap)) {
    if (courses.length > 1) {
      const courseLink = `https://bcourses.berkeley.edu/courses/${courses[0]}/users`;
      duplicates[name] = { courses, link: courseLink };
    }
  }

  chrome.storage.local.set({ duplicateUsers: duplicates }, () => {
    console.log("Duplicate users identified:", duplicates);
    chrome.runtime.sendMessage({
      action: "duplicatesIdentified",
      duplicates: duplicates,
    });
  });
}

async function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver((mutations, observer) => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error("Timeout waiting for element"));
    }, timeout);
  });
}

chrome.storage.local.get("scriptStarted", (data) => {
  console.log("Script started check on page load: ", data.scriptStarted);
  if (data.scriptStarted && window.location.href.includes("/users")) {
    extractAndProceed();
  }
});
