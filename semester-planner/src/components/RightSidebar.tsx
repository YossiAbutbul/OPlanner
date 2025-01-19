import React from "react";
import NotificationList from "./NotificationList";
import "../css/RightSidebar.css";

const RightSidebar: React.FC = () => {
  return (
    <aside className="right-sidebar">
      <h2>Notifications</h2>
      <NotificationList />
    </aside>
  );
};

export default RightSidebar;
