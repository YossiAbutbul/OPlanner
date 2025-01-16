import React from 'react';

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="profile-section">
        <img src="./public/user-svgrepo-com.svg" alt="Profile" className="profile-pic" />
        <label>My Semesters</label>
      </div>
      <ul className="semester-list">
        <li>2024 A</li>
        <li>2024 B</li>
        <li>2025 A</li>
      </ul>
    </aside>
  );
}

export default Sidebar;
