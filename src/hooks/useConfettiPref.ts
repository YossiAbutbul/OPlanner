import { useCallback, useState } from "react";
import { isConfettiEnabled, setConfettiEnabled } from "../utility/celebrate";

// React-bound view of the confetti preference. Single source of truth lives
// in localStorage so a reload doesn't lose the choice and so the celebrate()
// call sites (which aren't React components) read the same value.
export function useConfettiPref(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(isConfettiEnabled);
  const update = useCallback((next: boolean) => {
    setConfettiEnabled(next);
    setEnabled(next);
  }, []);
  return [enabled, update];
}
