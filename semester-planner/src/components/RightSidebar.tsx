import React from 'react';

function RightSidebar() {
  return (
    <aside className="right-sidebar">
      <h2>Homework</h2>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Due Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>hw1</td>
            <td>2025-02-24</td>
            <td>DONE</td>
          </tr>
        </tbody>
      </table>
    </aside>
  );
}

export default RightSidebar;
