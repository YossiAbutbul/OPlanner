import React from "react";
export interface HomeworkEntry {
    id: string;
    name: string;
    dueDate: string;
    status: string;
    year: number;
    semester: string;
    course: string;
}
interface Notification {
    id: string;
    message: string;
    style: React.CSSProperties;
}
interface HomeworkContextProps {
    homework: HomeworkEntry[];
    notifications: Notification[];
    fetchHomework: (year: number, semester: string, course: string) => Promise<void>;
    addHomework: (id: string | null, name: string, dueDate: string, status: string, year: number, semester: string, course: string) => Promise<void>;
    removeHomework: (id: string, year: number, semester: string, course: string) => Promise<void>;
}
export declare const HomeworkProvider: React.FC<{
    children: React.ReactNode;
}>;
export declare const useHomework: () => HomeworkContextProps;
export {};
