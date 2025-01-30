import React from "react";
import "../css/HomeworkTable.css";
import "boxicons/css/boxicons.min.css";
interface HomeworkEntry {
    id: string;
    name: string;
    dueDate: string;
    status: string;
    year: number;
    semester: string;
    course: string;
}
interface HomeworkTableProps {
    tasks: HomeworkEntry[];
    onAddTask: () => void;
}
declare const HomeworkTable: React.FC<HomeworkTableProps>;
export default HomeworkTable;
