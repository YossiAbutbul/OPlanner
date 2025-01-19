import React, { useState } from "react";
import "../css/Sidebar.css";

const Sidebar: React.FC = () => {
  const [years, setYears] = useState<{ year: number; expanded: boolean }[]>([
    { year: 2024, expanded: true },
    { year: 2025, expanded: true },
  ]);

  const addYear = () => {
    const lastYear = years[years.length - 1]?.year || new Date().getFullYear();
    const newYear = lastYear + 1;
    setYears([...years, { year: newYear, expanded: true }]);
  };

  const toggleYear = (year: number) => {
    setYears((prevYears) =>
      prevYears.map((y) =>
        y.year === year ? { ...y, expanded: !y.expanded } : y
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
        <label className="profile-label">My Semesters</label>
      </div>
      <ul className="year-list">
        {years.map(({ year, expanded }) => (
          <li key={year} className="year-item">
            <div className="year-header" onClick={() => toggleYear(year)}>
              {year}
              <span className="toggle-icon">{expanded ? "-" : "+"}</span>
            </div>
            {expanded && (
              <ul className="semester-list">
                <li className="semester-item">{year} A</li>
                <li className="semester-item">{year} B</li>
                <li className="semester-item">{year} C</li>
              </ul>
            )}
          </li>
        ))}
      </ul>
      <button className="add-year-btn" onClick={addYear}>
        Add Year
      </button>
    </aside>
  );
};

export default Sidebar;
