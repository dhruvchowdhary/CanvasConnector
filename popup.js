document.getElementById("start-scanning").addEventListener("click", () => {
  // Reset the necessary variables and clear the storage
  chrome.storage.local.set(
    {
      stopScript: false,
      currentIndex: 0,
      processingComplete: false,
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
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateStatus") {
    updateStatus(message.status);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Load courses and status when the popup is opened
  chrome.storage.local.get(
    ["coursesWithPeopleTab", "DASHBOARD_COURSES"],
    (data) => {
      const courses = data.DASHBOARD_COURSES || [];
      const coursesWithPeopleTab = data.coursesWithPeopleTab || [];
      updateCourseList(courses, coursesWithPeopleTab);
    }
  );
});

function updateCourseList(courses, coursesWithPeopleTab) {
  const coursesDiv = document.getElementById("courses");
  coursesDiv.innerHTML = "";

  const coursesWithPeopleIds = coursesWithPeopleTab.map((course) => course.id);

  courses.forEach((course) => {
    const courseDiv = document.createElement("div");
    courseDiv.textContent = course.originalName;

    if (!coursesWithPeopleIds.includes(course.id)) {
      courseDiv.style.color = "grey";
    }

    coursesDiv.appendChild(courseDiv);
  });
}
