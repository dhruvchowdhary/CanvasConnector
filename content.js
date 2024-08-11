console.log("Canvas User Finder content script running");

function fetchCoursesFromLocalStorage() {
  // Retrieve DASHBOARD_COURSES from local storage
  const courses = JSON.parse(localStorage.getItem("DASHBOARD_COURSES") || "[]");

  if (courses.length === 0) {
    console.warn("No courses found in local storage.");
    return;
  }

  // Store DASHBOARD_COURSES in chrome.storage.local
  chrome.storage.local.set({ DASHBOARD_COURSES: courses }, () => {
    console.log("Stored DASHBOARD_COURSES.");
  });

  let coursesWithPeopleTab = [];
  let processedCourses = 0;

  courses.forEach((course, index) => {
    fetch(course.href)
      .then((response) => response.text())
      .then((pageHTML) => {
        let parser = new DOMParser();
        let doc = parser.parseFromString(pageHTML, "text/html");
        let peopleTab = doc.querySelector("a.people");

        if (peopleTab) {
          console.log(`Found People tab for course: ${course.originalName}`);
          coursesWithPeopleTab.push({
            name: course.originalName,
            link: peopleTab.href,
            id: course.id,
          });
        }

        processedCourses++;

        // After all courses have been processed, update storage and popup
        if (processedCourses === courses.length) {
          updatePopupWithCourses(courses, coursesWithPeopleTab);
          storeCoursesWithPeopleTab(coursesWithPeopleTab);
        }
      })
      .catch((error) => {
        console.error(`Error processing course ${course.originalName}:`, error);
        processedCourses++;

        // Ensure that we still update storage and popup even if there's an error
        if (processedCourses === courses.length) {
          updatePopupWithCourses(courses, coursesWithPeopleTab);
          storeCoursesWithPeopleTab(coursesWithPeopleTab);
        }
      });
  });
}

function storeCoursesWithPeopleTab(coursesWithPeopleTab) {
  chrome.storage.local.set({ coursesWithPeopleTab }, () => {
    console.log("Stored courses with People tab.");
  });
}

function updatePopupWithCourses(courses, coursesWithPeopleTab) {
  chrome.runtime.sendMessage({
    action: "updateCourses",
    courses: courses,
    coursesWithPeopleTab: coursesWithPeopleTab,
  });
}

function extractAndProceed() {
  // Extract users from the current page
  setTimeout(() => {
    let users = extractUsers(document);
    console.log("Users extracted:", users);

    // Store the users in local storage
    chrome.storage.local.get("extractedUsers", (data) => {
      let allUsers = data.extractedUsers || {};
      let courseName = document
        .querySelector("h1.course-title")
        .innerText.trim();
      allUsers[courseName] = users;

      chrome.storage.local.set({ extractedUsers: allUsers }, () => {
        console.log(`Stored users for ${courseName}.`);

        // Proceed to the next course
        navigateToNextCourse();
      });
    });
  }, 5000); // Wait 5 seconds for the page to load fully
}

function navigateToNextCourse() {
  chrome.storage.local.get(["coursesWithPeopleTab", "currentIndex"], (data) => {
    let courses = data.coursesWithPeopleTab || [];
    let currentIndex = data.currentIndex || 0;

    if (currentIndex < courses.length) {
      let nextCourse = courses[currentIndex];
      console.log(`Navigating to: ${nextCourse.link}`);

      // Update the index
      chrome.storage.local.set({ currentIndex: currentIndex + 1 }, () => {
        window.location.href = nextCourse.link;
      });
    } else {
      console.log("All courses processed.");
      // Reset the index after processing all courses
      chrome.storage.local.set({ currentIndex: 0 });
    }
  });
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

// Fetch and process courses on page load
fetchCoursesFromLocalStorage();
