// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startScanning") {
    chrome.storage.local.set({ scriptStarted: true }, () => {
      startScanning();
    });
  }
});

async function startScanning() {
  // Start the scanning process
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
    ],
    async (data) => {
      let courses = data.coursesWithPeopleTab || [];
      let currentIndex = data.currentIndex || 0;
      let stopScript = data.stopScript || false;
      let totalPeopleScanned = data.totalPeopleScanned || 0;
      let userCourseMap = data.userCourseMap || {};
      let scriptStarted = data.scriptStarted || false;

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
        console.log(`Navigating to: ${course.link}`);

        // Update the index before navigating
        await chrome.storage.local.set({ currentIndex: currentIndex + 1 });

        // Navigate to the next course's "People" tab
        window.location.href = course.link;
      } else {
        await chrome.storage.local.set({ processingComplete: true });
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
  chrome.runtime.sendMessage({
    action: "updateStatus",
    status: status,
    coursesProcessed: coursesProcessed,
    totalPeopleScanned: totalPeopleScanned,
  });
}

async function extractAndProceed() {
  try {
    // Wait for the user list to be present on the page
    await waitForElement("tr.rosterUser", 10000);
    console.log("User list detected, proceeding with extraction.");

    let users = extractUsers(document);
    console.log("Users extracted:", users);

    chrome.storage.local.get(
      ["userCourseMap", "totalPeopleScanned"],
      async (data) => {
        let userCourseMap = data.userCourseMap || {};
        let totalPeopleScanned = data.totalPeopleScanned || 0;

        // Safely get the course name
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

        // Update the popup with the current progress
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
}

function identifyAndStoreDuplicates(userCourseMap) {
  const duplicates = {};

  for (const [name, courses] of Object.entries(userCourseMap)) {
    if (courses.length > 1) {
      duplicates[name] = courses;
    }
  }

  chrome.storage.local.set({ duplicateUsers: duplicates }, () => {
    console.log("Duplicate users identified:", duplicates);
    // Notify the popup that duplicates have been identified
    chrome.runtime.sendMessage({
      action: "duplicatesIdentified",
      duplicates: duplicates,
    });
  });
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

// Run the extractAndProceed function only if we're on a /users page and the script has started
chrome.storage.local.get("scriptStarted", (data) => {
  if (data.scriptStarted && window.location.href.includes("/users")) {
    extractAndProceed();
  }
});
