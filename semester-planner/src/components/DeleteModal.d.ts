import React from "react";
import "../css/DeleteModal.css";
interface DeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (adminPassword?: string) => void;
    title: string;
    message: string;
}
declare const DeleteModal: React.FC<DeleteModalProps>;
export default DeleteModal;
