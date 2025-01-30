import React from "react";
import "../css/Sidebar.css";
import "boxicons/css/boxicons.min.css";
interface SidebarProps {
    onCourseOrSemesterSelect: (year: number, semester: string, course?: string) => void;
}
declare const Sidebar: React.FC<SidebarProps>;
export default Sidebar;
