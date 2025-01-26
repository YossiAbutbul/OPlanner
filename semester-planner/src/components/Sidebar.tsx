import React, { useState, useEffect } from "react";
import "../css/Sidebar.css";
import "boxicons/css/boxicons.min.css";
import { getAllYearsAndSemesters, initializeYear, addCourse } from "../utility/initializeDatabase";

interface YearData {
  year: number;
  semesters: {
    name: string;
    courses: { name: string }[];
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
  const [newCourseName, setNewCourseName] = useState("");

  const fetchYearsAndSemesters = async () => {
    console.log("Fetching years and semesters...");
    try {
      const existingYears = await getAllYearsAndSemesters();
      console.log("Raw Years Data from Firestore:", existingYears);

      const formattedYears = existingYears.map((year) => {
        const processedSemesters = year.semesters.map((semester) => ({
          ...semester,
          expanded: false, // Initially collapsed
          courses: semester.courses || [],
        }));
        return {
          ...year,
          expanded: false, // Initially collapsed
          semesters: processedSemesters,
        };
      });

      setYears(formattedYears);
    } catch (error) {
      console.error("Error in fetchYearsAndSemesters:", error);
    }
  };

  useEffect(() => {
    fetchYearsAndSemesters();
  }, []);

  const toggleExpand = (yearIndex: number, semesterIndex?: number) => {
    setYears((prevYears) =>
      prevYears.map((year, yIndex) => {
        if (yIndex === yearIndex) {
          return {
            ...year,
            expanded: semesterIndex === undefined ? !year.expanded : year.expanded,
            semesters: semesterIndex !== undefined
              ? year.semesters.map((semester, sIndex) => ({
                  ...semester,
                  expanded: sIndex === semesterIndex ? !semester.expanded : semester.expanded,
                }))
              : year.semesters,
          };
        }
        return year;
      })
    );
  };

  const openAddCourseModal = (year: number, semester: string) => {
    setModalData({ year, semester });
    setModalOpen(true);
  };

  const handleAddCourse = async () => {
    if (modalData && newCourseName.trim() !== "") {
      await addCourse(modalData.year, modalData.semester, newCourseName);
      fetchYearsAndSemesters();
      setModalOpen(false);
      setNewCourseName("");
    } else {
      alert("Please enter a valid course name.");
    }
  };

  const addYear = async () => {
    const currentYears = years.map((y) => y.year);
    const nextYear = Math.max(...currentYears) + 1;

    const yearAdded = await initializeYear(nextYear);
    if (yearAdded) {
      fetchYearsAndSemesters();
    } else {
      alert(`Failed to add year ${nextYear}.`);
    }
  };

  return (
    <aside className="sidebar">
      <div className="profile-section">
        <img
          src="./user-svgrepo-com.svg"
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
            {year.expanded && (
              <ul className="semester-list">
                {year.semesters.map((semester, semesterIndex) => (
                  <li
                    key={semester.name}
                    className={`semester-item ${semester.expanded ? "expanded" : ""}`}
                  >
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
                    {semester.expanded && (
                      <ul className="course-list">
                        {semester.courses.map((course) => (
                          <li
                            key={course.name}
                            className="course-item"
                            onClick={() =>
                              onCourseOrSemesterSelect(year.year, semester.name, course.name)
                            }
                          >
                            {course.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Add New Course</h2>
            <input
              type="text"
              placeholder="Enter Course Name"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
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
