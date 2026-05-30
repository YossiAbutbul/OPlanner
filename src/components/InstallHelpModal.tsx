import React from "react";
import { Share, Plus, MoreVertical, Download, Smartphone } from "lucide-react";
import Modal from "./Modal";
import { detectInstallPlatform, type InstallPlatform } from "../utility/installPlatform";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Platform-specific instructions. Each step pairs an icon with a short
// imperative line so it scans fast on a phone.
interface Step {
  icon: React.ReactNode;
  text: React.ReactNode;
}

const stepsFor = (platform: InstallPlatform): Step[] => {
  switch (platform) {
    case "ios-safari":
      return [
        { icon: <Share size={18} />, text: <>Tap the <strong>Share</strong> button at the bottom of Safari.</> },
        { icon: <Plus size={18} />, text: <>Scroll down and tap <strong>Add to Home Screen</strong>.</> },
        { icon: <Smartphone size={18} />, text: <>Tap <strong>Add</strong> in the top-right corner.</> },
      ];
    case "android-chrome":
      return [
        { icon: <MoreVertical size={18} />, text: <>Tap the <strong>⋮ menu</strong> in the top-right of Chrome.</> },
        { icon: <Download size={18} />, text: <>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</> },
        { icon: <Smartphone size={18} />, text: <>Confirm <strong>Install</strong>.</> },
      ];
    case "macos-safari":
      return [
        { icon: <Share size={18} />, text: <>Open the <strong>File</strong> menu in Safari.</> },
        { icon: <Plus size={18} />, text: <>Choose <strong>Add to Dock…</strong> (Safari 17+).</> },
        { icon: <Download size={18} />, text: <>Click <strong>Add</strong>.</> },
      ];
    case "desktop-chromium":
      return [
        { icon: <Download size={18} />, text: <>Click the <strong>install icon</strong> (⊕) at the right edge of the address bar.</> },
        { icon: <Plus size={18} />, text: <>Or open the <strong>⋮ menu → Install OPlanner…</strong></> },
        { icon: <Smartphone size={18} />, text: <>Click <strong>Install</strong>.</> },
      ];
    case "firefox":
      return [
        { icon: <Smartphone size={18} />, text: <>Firefox on desktop doesn't support installing PWAs. Try Chrome, Edge, or Brave to install OPlanner as an app.</> },
      ];
    case "unsupported":
    default:
      return [
        { icon: <Smartphone size={18} />, text: <>Your browser doesn't support installable apps. Try Chrome or Edge.</> },
      ];
  }
};

const titleFor = (platform: InstallPlatform): string => {
  switch (platform) {
    case "ios-safari": return "Install on iPhone or iPad";
    case "android-chrome": return "Install on Android";
    case "macos-safari": return "Add to Dock";
    case "desktop-chromium": return "Install OPlanner";
    case "firefox": return "Install not supported";
    default: return "Install OPlanner";
  }
};

const InstallHelpModal: React.FC<Props> = ({ isOpen, onClose }) => {
  // Detect lazily on first render so the modal works in any browser.
  const platform = detectInstallPlatform();
  const steps = stepsFor(platform);
  const title = titleFor(platform);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <button type="button" className="app-modal-btn-primary" onClick={onClose}>
          Got it
        </button>
      }
    >
      <ol className="install-steps">
        {steps.map((s, i) => (
          <li key={i} className="install-step">
            <span className="install-step-num">{i + 1}</span>
            <span className="install-step-icon">{s.icon}</span>
            <span className="install-step-text">{s.text}</span>
          </li>
        ))}
      </ol>
    </Modal>
  );
};

export default InstallHelpModal;
