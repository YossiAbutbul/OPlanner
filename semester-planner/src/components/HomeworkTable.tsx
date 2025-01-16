import React from 'react';
import { useHomework } from '../context/HomeworkContext';

const HomeworkTable: React.FC = () => {
  const { homework, addHomework, removeHomework, updateHomework } = useHomework();

  return (
    <div>
      <table className="homework-table">
        <thead>
          <tr>
            <th>H.W.</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {homework.map(entry => (
            <tr key={entry.id}>
              <td
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => updateHomework(entry.id, 'name', e.currentTarget.textContent || '')}
              >
                {entry.name}
              </td>
              <td
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateHomework(entry.id, 'dueDate', e.currentTarget.textContent || '')
                }
              >
                {entry.dueDate}
              </td>
              <td
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateHomework(entry.id, 'status', e.currentTarget.textContent || '')
                }
              >
                {entry.status}
              </td>
              <td>
                <button onClick={() => removeHomework(entry.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={addHomework}>Add Homework</button>
    </div>
  );
};

export default HomeworkTable;
