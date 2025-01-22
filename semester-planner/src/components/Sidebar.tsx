import React, { useState, useEffect } from "react";
import "../css/Sidebar.css";
import "boxicons/css/boxicons.min.css";
import { initializeYear, getAllYearsAndSemesters } from "../utility/initializeDatabase";

interface YearData {
  year: number;
  semesters: { name: string }[];
  expanded: boolean;
}

interface SidebarProps {
  onSemesterSelect: (year: number, semester: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onSemesterSelect }) => {
  const [years, setYears] = useState<YearData[]>([]);

  const fetchYearsAndSemesters = async () => {
    const existingYears = await getAllYearsAndSemesters();

    const formattedYears = existingYears.map((year) => ({
      ...year,
      expanded: false, // Initialize as collapsed
    }));

    if (formattedYears.length === 0) {
      const currentYear = new Date().getFullYear();
      await initializeYear(currentYear);
      formattedYears.push({
        year: currentYear,
        semesters: [
          { name: "Semester A" },
          { name: "Semester B" },
          { name: "Semester C" },
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
        ...prevYears.map((y) => ({ ...y, expanded: false })), // Close all years
        {
          year: newYear,
          semesters: [
            { name: "Semester A" },
            { name: "Semester B" },
            { name: "Semester C" },
          ],
          expanded: true, // Automatically expand the new year
        },
      ]);
    }
  };

  const toggleExpand = (year: number) => {
    setYears((prevYears) =>
      prevYears.map((y) =>
        y.year === year
          ? { ...y, expanded: !y.expanded }
          : { ...y, expanded: false } // Collapse others
      )
    );
  };

  return (
    <aside className="sidebar">
      <div className="profile-section">
        <img
          src="./public/user-svgrepo-com.svg"
          alt="Profile"
          className="profile-pic"
        />
        <label className="profile-label">OPlanner</label>
      </div>
      <ul className="year-list">
        {years.map(({ year, semesters, expanded }) => (
          <li key={year} className={`year-item ${expanded ? "expanded" : ""}`}>
            <div className="year-header" onClick={() => toggleExpand(year)}>
              {year}
              <i
                className={`bx ${
                  expanded ? "bx-chevron-up" : "bx-chevron-down"
                } toggle-icon`}
              ></i>
            </div>
            <ul className="semester-list">
              {semesters.map((semester) => (
                <li
                  key={semester.name}
                  className="semester-item"
                  onClick={() => onSemesterSelect(year, semester.name)}
                >
                  {semester.name}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="add-year-container">
        <button className="add-year-btn" onClick={addYear}>
          Add Year
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
