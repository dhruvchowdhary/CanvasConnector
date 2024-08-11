chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateCourses") {
    updateCourseList(message.courses, message.coursesWithPeopleTab);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Load courses from storage when the popup is opened
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

document.getElementById("start-scanning").addEventListener("click", () => {
  chrome.storage.local.get("coursesWithPeopleTab", (data) => {
    let coursesWithPeopleTab = data.coursesWithPeopleTab || [];

    if (coursesWithPeopleTab.length > 0) {
      chrome.storage.local.set({ currentIndex: 0 }, () => {
        window.location.href = coursesWithPeopleTab[0].link;
      });
    } else {
      console.log("No courses with People tab to scan.");
    }
  });
});
