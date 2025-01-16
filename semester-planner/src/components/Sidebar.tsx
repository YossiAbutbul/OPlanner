import React from 'react';

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="profile-section">
        <img src="/profile-placeholder.jpg" alt="Profile" className="profile-pic" />
        <p>MY SEMESTERS</p>
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
