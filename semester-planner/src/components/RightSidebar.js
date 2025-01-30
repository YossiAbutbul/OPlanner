import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import NotificationList from "./NotificationList";
import "../css/RightSidebar.css";
const RightSidebar = () => {
    return (_jsxs("aside", { className: "right-sidebar", children: [_jsx("h2", { children: "Upcoming Deadlines" }), _jsx(NotificationList, {})] }));
};
export default RightSidebar;
