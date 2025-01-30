import React from "react";
import "../css/HomeworkModal.css";
interface HomeworkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string | null, name: string, dueDate: string, status: string, year: number, semester: string, course: string) => void;
    editHomework?: {
        id: string;
        name: string;
        dueDate: string;
        status: string;
        year: number;
        semester: string;
        course: string;
    } | null;
    selectedCourseData: {
        year: number;
        semester: string;
        course?: string;
    } | null;
    isLoading: boolean;
}
declare const HomeworkModal: React.FC<HomeworkModalProps>;
export default HomeworkModal;
