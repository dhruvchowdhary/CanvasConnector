document.getElementById("start-scanning").addEventListener("click", () => {
  // Reset the necessary variables and clear the storage
  chrome.storage.local.set(
    {
      stopScript: false,
      currentIndex: 0,
      processingComplete: false,
      totalPeopleScanned: 0, // Reset the total people scanned counter
    },
    () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            files: ["content.js"],
          },
          () => {
            updateStatus("Processing... Starting to scan courses.");
          }
        );
      });
    }
  );
});

function updateStatus(status) {
  const statusDiv = document.getElementById("status");
  statusDiv.textContent = status;

  // Retrieve the current progress
  chrome.storage.local.get(["currentIndex", "totalPeopleScanned"], (data) => {
    const coursesProcessed = data.currentIndex || 0;
    const totalPeopleScanned = data.totalPeopleScanned || 0;

    const coursesDiv = document.getElementById("coursesProcessed");
    const peopleDiv = document.getElementById("peopleScanned");

    coursesDiv.textContent = `Courses Processed: ${coursesProcessed}`;
    peopleDiv.textContent = `People Scanned: ${totalPeopleScanned}`;
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateStatus") {
    updateStatus(message.status);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Load courses and status when the popup is opened
  chrome.storage.local.get(["coursesWithPeopleTab"], (data) => {
    const coursesWithPeopleTab = data.coursesWithPeopleTab || [];
    updateCourseList(coursesWithPeopleTab);

    // Also update the initial status and progress in the popup
    updateStatus("Idle");
  });
});

function updateCourseList(coursesWithPeopleTab) {
  const coursesDiv = document.getElementById("courses");
  coursesDiv.innerHTML = "";

  coursesWithPeopleTab.forEach((course) => {
    const courseDiv = document.createElement("div");
    courseDiv.textContent = course.name;

    coursesDiv.appendChild(courseDiv);
  });
}
