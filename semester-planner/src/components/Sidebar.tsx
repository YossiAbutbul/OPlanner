import React, { useState, useEffect } from "react";
import "../css/Sidebar.css";
import "boxicons/css/boxicons.min.css";
import { getAllYearsAndSemesters, addCourse, initializeYear } from "../utility/initializeDatabase";

interface YearData {
  year: number;
  semesters: {
    name: string;
    courses: { name: string; tasks: string[] }[];
    expanded: boolean;
  }[];
  expanded: boolean;
}

interface SidebarProps {
  onCourseOrSemesterSelect: (
    year: number,
    semester: string,
    course?: string
  ) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onCourseOrSemesterSelect }) => {
  const [years, setYears] = useState<YearData[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    year: number;
    semester: string;
  } | null>(null);
  const [courseName, setCourseName] = useState("");

  const fetchYearsAndSemesters = async () => {
    const existingYears = await getAllYearsAndSemesters();

    const formattedYears = existingYears.map((year) => ({
      ...year,
      expanded: false,
      semesters: year.semesters.map((semester) => ({
        ...semester,
        name: semester.name || "Unnamed Semester",
        courses: Object.entries(semester.courses || {}).map(([name, courseData]) => ({
          name,
          tasks: courseData.tasks || [],
        })),
        expanded: false,
      })),
    }));

    setYears(formattedYears);
  };

  useEffect(() => {
    fetchYearsAndSemesters();
  }, []);

  const addYear = async () => {
    const currentYears = years.map((y) => y.year); // Get all existing years
    const maxYear = Math.max(...currentYears); // Find the latest year
    const nextYear = maxYear + 1; // Calculate the next year

    const yearAdded = await initializeYear(nextYear); // Initialize the next year
    if (yearAdded) {
      fetchYearsAndSemesters(); // Refresh the sidebar if successful
    } else {
      alert(`Failed to add year ${nextYear}. Please try again.`);
    }
  };

  const toggleExpand = (yearIndex: number, semesterIndex?: number) => {
    setYears((prevYears) =>
      prevYears.map((year, yIndex) => {
        if (yIndex === yearIndex) {
          const updatedYear = {
            ...year,
            expanded: semesterIndex === undefined ? !year.expanded : year.expanded,
          };
          if (semesterIndex !== undefined) {
            updatedYear.semesters = updatedYear.semesters.map((semester, sIndex) => ({
              ...semester,
              expanded: sIndex === semesterIndex ? !semester.expanded : semester.expanded,
            }));
          }
          return updatedYear;
        }
        return { ...year, expanded: false };
      })
    );
  };

  const openAddCourseModal = (year: number, semester: string) => {
    setModalData({ year, semester });
    setModalOpen(true);
  };

  const handleAddCourse = async () => {
    if (modalData && courseName.trim() !== "") {
      await addCourse(modalData.year, modalData.semester, courseName);
      await fetchYearsAndSemesters();
      setModalOpen(false);
      setCourseName("");
    } else {
      alert("Please enter a valid course name.");
    }
  };

  return (
    <aside className="sidebar">
      <div className="profile-section">
        <img
          src="./public/user-svgrepo-com.svg"
          alt="Profile"
          className="profile-pic"
        />
        <div className="profile-header">
          <label className="profile-label">OPlanner</label>
          <button className="add-year-btn" onClick={addYear} title="Add Year">
            <i className="bx bx-plus"></i>
          </button>
        </div>
      </div>
      <ul className="year-list">
        {years.map((year, yearIndex) => (
          <li key={year.year} className={`year-item ${year.expanded ? "expanded" : ""}`}>
            <div className="year-header" onClick={() => toggleExpand(yearIndex)}>
              {year.year}
              <i
                className={`bx ${year.expanded ? "bx-chevron-up" : "bx-chevron-down"} toggle-icon`}
              ></i>
            </div>
            <ul
              className="semester-list"
              style={{
                maxHeight: year.expanded
                  ? `${year.semesters.reduce(
                      (acc, semester) =>
                        acc +
                        70 +
                        (semester.expanded ? semester.courses.length * 45 : 0),
                      0
                    )}px`
                  : "0",
                opacity: year.expanded ? 1 : 0,
                transition: "max-height 0.3s ease, opacity 0.3s ease",
                overflow: "hidden",
              }}
            >
              {year.semesters.map((semester, semesterIndex) => (
                <li key={semester.name} className="semester-item">
                  <div
                    className="semester-header"
                    onClick={() => toggleExpand(yearIndex, semesterIndex)}
                  >
                    {semester.name}
                    <i
                      className="bx bx-plus add-course-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddCourseModal(year.year, semester.name);
                      }}
                      title="Add New Course"
                    ></i>
                  </div>
                  <ul
                    className="course-list"
                    style={{
                      maxHeight: semester.expanded
                        ? `${semester.courses.length * 45}px`
                        : "0",
                      opacity: semester.expanded ? 1 : 0,
                      transition: "max-height 0.3s ease, opacity 0.3s ease",
                      overflow: "hidden",
                    }}
                  >
                    {semester.courses.map((course, index) => (
                      <li
                        key={`${semester.name}-${course.name}-${index}`}
                        className="course-item"
                        onClick={() =>
                          onCourseOrSemesterSelect(
                            year.year,
                            semester.name,
                            course.name
                          )
                        }
                      >
                        <i className="bx bxs-chevron-right"></i> {course.name}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Add New Course</h2>
            <input
              type="text"
              placeholder="Course Name"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
            />
            <div className="modal-actions">
              <button className="modal-btn" onClick={handleAddCourse}>
                Add Course
              </button>
              <button
                className="modal-btn cancel-btn"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
