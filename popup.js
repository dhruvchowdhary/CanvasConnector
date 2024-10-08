document.getElementById("start-scanning").addEventListener("click", () => {
  // Get the selected courses
  const selectedCourses = [];
  document.querySelectorAll(".course-checkbox").forEach((checkbox) => {
    if (checkbox.checked) {
      selectedCourses.push(checkbox.dataset.courseId);
    }
  });

  // Debug: Log the selected courses
  console.log("Selected Courses: ", selectedCourses);

  // Save the selected courses to local storage
  chrome.storage.local.set({ selectedCourses: selectedCourses }, () => {
    // Reset the necessary variables and clear the storage
    chrome.storage.local.set(
      {
        stopScript: false,
        currentIndex: 0,
        processingComplete: false,
        totalPeopleScanned: 0, // Reset the total people scanned counter
        duplicateUsers: {}, // Reset duplicates
        userCourseMap: {}, // Reset user course map
        scriptStarted: true, // Set the script started flag to true
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
              chrome.tabs.sendMessage(tabs[0].id, { action: "startScanning" }); // Send a message to start scanning
            }
          );
        });
      }
    );
  });
});

document.getElementById("toggleCourses").addEventListener("click", () => {
  const courseList = document.getElementById("courseList");
  courseList.classList.toggle("show");
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
  } else if (message.action === "duplicatesIdentified") {
    displayDuplicates(message.duplicates);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Load courses and status when the popup is opened
  chrome.storage.local.get(
    ["coursesWithPeopleTab", "duplicateUsers", "courseCheckboxStates"],
    (data) => {
      const coursesWithPeopleTab = data.coursesWithPeopleTab || [];
      const courseCheckboxStates = data.courseCheckboxStates || {};

      updateCourseList(coursesWithPeopleTab, courseCheckboxStates);

      if (data.duplicateUsers) {
        displayDuplicates(data.duplicateUsers);
      }

      updateStatus(""); // Clear status on load
    }
  );
});

function updateCourseList(coursesWithPeopleTab, courseCheckboxStates) {
  const courseList = document.getElementById("courseList");
  courseList.innerHTML = "";

  coursesWithPeopleTab.forEach((course) => {
    const courseDiv = document.createElement("div");
    courseDiv.className = "course-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "course-checkbox";
    checkbox.checked =
      courseCheckboxStates[course.id] !== undefined
        ? courseCheckboxStates[course.id]
        : true;
    checkbox.dataset.courseId = course.id;

    // Save the checkbox state whenever it is toggled
    checkbox.addEventListener("change", () => {
      courseCheckboxStates[course.id] = checkbox.checked;
      chrome.storage.local.set({ courseCheckboxStates: courseCheckboxStates });
    });

    const label = document.createElement("label");
    label.textContent = course.name;

    courseDiv.appendChild(checkbox);
    courseDiv.appendChild(label);
    courseList.appendChild(courseDiv);
  });
}

function displayDuplicates(duplicates) {
  const duplicatesDiv = document.getElementById("duplicates");
  duplicatesDiv.innerHTML = "";

  if (Object.keys(duplicates).length === 0) {
    duplicatesDiv.textContent = "No duplicates found.";
    return;
  }

  for (const [name, data] of Object.entries(duplicates)) {
    const userLink = `<a href="${data.link}" target="_blank">${name}</a>`;
    const duplicateDiv = document.createElement("div");
    duplicateDiv.innerHTML = `${userLink} is in: ${data.courses.join(", ")}`;
    duplicatesDiv.appendChild(duplicateDiv);
  }
}
