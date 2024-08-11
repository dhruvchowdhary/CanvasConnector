console.log("Content script running");

function getCourses() {
  console.log("getCourses function executed");

  let courses = [];
  const rows = document.querySelectorAll("#my_courses_table tbody tr");

  rows.forEach((row) => {
    let courseNameElement = row.querySelector(
      ".course-list-course-title-column .name"
    );
    let courseLinkElement = row.querySelector(
      ".course-list-course-title-column a"
    );

    // Only proceed if both the course name and course link elements exist
    if (courseNameElement && courseLinkElement) {
      let courseName = courseNameElement.textContent.trim();
      let courseLink = courseLinkElement.href;
      let courseId = courseLink.split("/courses/")[1];
      courses.push({ name: courseName, link: courseLink, id: courseId });
    } else {
      console.warn("Course name or link is missing in this row:", row);
    }
  });

  console.log("Courses found:", courses);

  // For debugging: Display the courses in the console
  courses.forEach((course) => {
    console.log(
      `Course Name: ${course.name}, Course ID: ${course.id}, Course Link: ${course.link}`
    );
  });

  return courses;
}

// Immediately run the function to see if the content script works
getCourses();
