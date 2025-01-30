import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import "./css/App.css";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightSidebar from "./components/RightSidebar";
const App = () => {
    const [selectedCourseData, setSelectedCourseData] = useState(null);
    const onCourseOrSemesterSelect = (year, semester, course) => {
        console.log("Course selected:", { year, semester, course });
        setSelectedCourseData({ year, semester, course });
    };
    return (_jsxs("div", { className: "app-container", children: [_jsx(Sidebar, { onCourseOrSemesterSelect: onCourseOrSemesterSelect }), _jsx(MainContent, { selectedCourseData: selectedCourseData }), _jsx(RightSidebar, {})] }));
};
export default App;
