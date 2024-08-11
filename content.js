(async function () {
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

  async function processNextCourse() {
    chrome.storage.local.get(
      [
        "coursesWithPeopleTab",
        "currentIndex",
        "stopScript",
        "totalPeopleScanned",
      ],
      async (data) => {
        let courses = data.coursesWithPeopleTab || [];
        let currentIndex = data.currentIndex || 0;
        let stopScript = data.stopScript || false;
        let totalPeopleScanned = data.totalPeopleScanned || 0;

        if (stopScript) {
          updatePopupStatus(
            "Stopped by user.",
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
          updatePopupStatus(
            "Complete. All courses processed.",
            currentIndex,
            totalPeopleScanned
          );
          await chrome.storage.local.set({ processingComplete: true });

          // Log stored data
          chrome.storage.local.get("extractedUsers", (data) => {
            console.log("All extracted users:", data.extractedUsers);
          });
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
        ["extractedUsers", "totalPeopleScanned"],
        async (data) => {
          let allUsers = data.extractedUsers || {};
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

          allUsers[courseName] = users;
          totalPeopleScanned += users.length;

          await chrome.storage.local.set({
            extractedUsers: allUsers,
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

  // If we are on a /users page, process it
  if (window.location.href.includes("/users")) {
    await extractAndProceed();
  } else {
    await processNextCourse();
  }

  function extractUsers(doc) {
    let users = [];

    const userRows = doc.querySelectorAll("tr.rosterUser");

    userRows.forEach((row) => {
      const nameElement = row.querySelector("td a.roster_user_name");
      const name = nameElement ? nameElement.innerText.trim() : "";

      const sectionElements = row.querySelectorAll(
        'td[data-testid="section-column-cell"] .section'
      );
      const sections = Array.from(sectionElements).map((sectionElement) =>
        sectionElement.innerText.trim()
      );

      users.push({
        name: name,
        sections: sections,
      });
    });

    return users;
  }
})();
