import React from "react";
import "../css/MainContent.css";
interface MainContentProps {
    selectedCourseData: {
        year: number;
        semester: string;
        course?: string;
    } | null;
}
declare const MainContent: React.FC<MainContentProps>;
export default MainContent;
