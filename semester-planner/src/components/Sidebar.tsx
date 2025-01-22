import React, { useState, useEffect } from "react";
import "../css/Sidebar.css";
import "boxicons/css/boxicons.min.css";
import { initializeYear, getAllYearsAndSemesters, addCourse } from "../utility/initializeDatabase";

interface YearData {
  year: number;
  semesters: { name: string; courses: string[]; expanded: boolean }[];
  expanded: boolean;
}

interface SidebarProps {
  onCourseOrSemesterSelect: (year: number, semester: string, course?: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onCourseOrSemesterSelect }) => {
  const [years, setYears] = useState<YearData[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ year: number; semester: string } | null>(null);
  const [courseName, setCourseName] = useState("");

  const fetchYearsAndSemesters = async () => {
    const existingYears = await getAllYearsAndSemesters();

    const formattedYears = existingYears.map((year) => ({
      ...year,
      expanded: false,
      semesters: year.semesters.map((semester) => ({
        ...semester,
        expanded: false,
      })),
    }));

    if (formattedYears.length === 0) {
      const currentYear = new Date().getFullYear();
      await initializeYear(currentYear);
      formattedYears.push({
        year: currentYear,
        semesters: [
          { name: "Semester A", courses: [], expanded: false },
          { name: "Semester B", courses: [], expanded: false },
          { name: "Semester C", courses: [], expanded: false },
        ],
        expanded: false,
      });
    }

    setYears(formattedYears);
  };

  useEffect(() => {
    fetchYearsAndSemesters();
  }, []);

  const addYear = async () => {
    const lastYear = years[years.length - 1]?.year || new Date().getFullYear();
    const newYear = lastYear + 1;

    const yearAdded = await initializeYear(newYear);
    if (yearAdded) {
      setYears((prevYears) => [
        ...prevYears.map((y) => ({ ...y, expanded: false })),
        {
          year: newYear,
          semesters: [
            { name: "Semester A", courses: [], expanded: false },
            { name: "Semester B", courses: [], expanded: false },
            { name: "Semester C", courses: [], expanded: false },
          ],
          expanded: true,
        },
      ]);
    }
  };

  const toggleYearExpand = (year: number) => {
    setYears((prevYears) =>
      prevYears.map((y) =>
        y.year === year
          ? { ...y, expanded: !y.expanded }
          : { ...y, expanded: false }
      )
    );
  };

  const toggleSemesterExpand = (year: number, semesterName: string) => {
    setYears((prevYears) =>
      prevYears.map((y) =>
        y.year === year
          ? {
              ...y,
              semesters: y.semesters.map((semester) =>
                semester.name === semesterName
                  ? { ...semester, expanded: !semester.expanded }
                  : semester
              ),
            }
          : y
      )
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
        {years.map(({ year, semesters, expanded }) => (
          <li key={year} className={`year-item ${expanded ? "expanded" : ""}`}>
            <div className="year-header" onClick={() => toggleYearExpand(year)}>
              {year}
              <i
                className={`bx ${expanded ? "bx-chevron-up" : "bx-chevron-down"} toggle-icon`}
              ></i>
            </div>
            <ul
              className="semester-list"
              style={{
                maxHeight: expanded
                  ? `${semesters.reduce(
                      (acc, semester) =>
                        acc +
                        70 +
                        (semester.expanded ? semester.courses.length * 45 : 0),
                      0
                    )}px`
                  : "0",
                opacity: expanded ? 1 : 0,
                transition: "max-height 0.3s ease, opacity 0.3s ease",
                overflow: "hidden",
              }}
            >
              {semesters.map((semester) => (
                <li key={semester.name} className="semester-item">
                  <div
                    className="semester-header"
                    onClick={() => toggleSemesterExpand(year, semester.name)}
                  >
                    {semester.name}
                    <i
                      className="bx bx-plus add-course-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddCourseModal(year, semester.name);
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
                    {semester.courses.map((course) => (
                      <li
                        key={course}
                        className="course-item"
                        onClick={() =>
                          onCourseOrSemesterSelect(year, semester.name, course)
                        }
                      >
                        {course}
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
