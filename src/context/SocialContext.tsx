import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "./AuthContext";

export interface ProfileLite {
  uid: string;
  displayName: string;
  email: string;
}

export interface FriendRequest {
  fromUid: string;
  displayName: string;
  email: string;
  sentAt: number;
}

export interface Friend {
  uid: string;
  displayName: string;
  email: string;
  since: number;
}

export interface RaceParticipant {
  uid: string;
  name: string;
  joinedAt: number;
  focusMs: number;
  finishedAt: number | null;
}

export interface Race {
  code: string;
  hostUid: string;
  hostName: string;
  durationMin: number;
  startsAt: number | null;
  status: "lobby" | "running" | "finished";
  createdAt: number;
  participants: Record<string, RaceParticipant>;
}

interface SocialContextProps {
  profile: ProfileLite | null;
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  currentRace: Race | null;
  setDisplayName: (name: string) => Promise<void>;
  sendFriendRequest: (email: string) => Promise<string>;
  acceptRequest: (req: FriendRequest) => Promise<void>;
  declineRequest: (fromUid: string) => Promise<void>;
  removeFriend: (uid: string) => Promise<void>;
  createRace: (durationMin: number) => Promise<string>;
  joinRace: (code: string) => Promise<void>;
  leaveRace: () => Promise<void>;
  startRace: () => Promise<void>;
  reportFocusProgress: (focusMs: number) => Promise<void>;
  finishRace: () => Promise<void>;
}

const SocialContext = createContext<SocialContextProps | undefined>(undefined);

const SHORTCODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () =>
  Array.from({ length: 5 }, () =>
    SHORTCODE_CHARS[Math.floor(Math.random() * SHORTCODE_CHARS.length)]
  ).join("");

const normalizeTime = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v instanceof Timestamp) return v.toMillis();
  if (v && typeof (v as { toMillis?: () => number }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  return Date.now();
};

export const SocialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [currentRaceCode, setCurrentRaceCode] = useState<string | null>(() => {
    try {
      return localStorage.getItem("oplanner.race.code") || null;
    } catch {
      return null;
    }
  });
  const [currentRace, setCurrentRace] = useState<Race | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
      setCurrentRace(null);
      return;
    }
    const ensureProfile = async () => {
      const ref = doc(db, `users/${user.uid}/profile/info`);
      const snap = await getDoc(ref);
      const displayName =
        user.displayName ||
        (user.email ? user.email.split("@")[0] : "Anonymous");
      const email = user.email || "";
      const profileData: ProfileLite = { uid: user.uid, displayName, email };
      if (!snap.exists()) {
        await setDoc(ref, profileData);
      } else {
        const existing = snap.data() as ProfileLite;
        if (existing.email !== email || !existing.displayName) {
          await setDoc(ref, { ...existing, ...profileData }, { merge: true });
        }
      }
      if (email) {
        await setDoc(
          doc(db, `usersByEmail/${email.toLowerCase()}`),
          { uid: user.uid, displayName, email },
          { merge: true }
        );
      }
      setProfile(profileData);
    };
    ensureProfile().catch((e) => console.error("ensureProfile:", e));

    const unsubFriends = onSnapshot(
      collection(db, `users/${user.uid}/friends`),
      (snap) => {
        setFriends(
          snap.docs.map((d) => {
            const data = d.data() as Omit<Friend, "uid" | "since"> & { since?: unknown };
            return {
              uid: d.id,
              displayName: data.displayName,
              email: data.email,
              since: normalizeTime(data.since),
            };
          })
        );
      },
      (e) => console.error("friends onSnapshot:", e)
    );
    const unsubIncoming = onSnapshot(
      collection(db, `users/${user.uid}/incomingRequests`),
      (snap) => {
        setIncoming(
          snap.docs.map((d) => {
            const data = d.data() as Omit<FriendRequest, "fromUid" | "sentAt"> & { sentAt?: unknown };
            return {
              fromUid: d.id,
              displayName: data.displayName,
              email: data.email,
              sentAt: normalizeTime(data.sentAt),
            };
          })
        );
      },
      (e) => console.error("incoming onSnapshot:", e)
    );
    const unsubOutgoing = onSnapshot(
      collection(db, `users/${user.uid}/outgoingRequests`),
      (snap) => {
        setOutgoing(
          snap.docs.map((d) => {
            const data = d.data() as Omit<FriendRequest, "fromUid" | "sentAt"> & { sentAt?: unknown };
            return {
              fromUid: d.id,
              displayName: data.displayName,
              email: data.email,
              sentAt: normalizeTime(data.sentAt),
            };
          })
        );
      },
      (e) => console.error("outgoing onSnapshot:", e)
    );

    return () => {
      unsubFriends();
      unsubIncoming();
      unsubOutgoing();
    };
  }, [user]);

  useEffect(() => {
    if (!currentRaceCode) {
      setCurrentRace(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, `studyRaces/${currentRaceCode}`),
      (snap) => {
        if (!snap.exists()) {
          setCurrentRace(null);
          try {
            localStorage.removeItem("oplanner.race.code");
          } catch {
            /* ignore */
          }
          setCurrentRaceCode(null);
          return;
        }
        const data = snap.data() as Omit<Race, "code">;
        const startsAt = data.startsAt ? normalizeTime(data.startsAt as unknown) : null;
        setCurrentRace({
          code: snap.id,
          hostUid: data.hostUid,
          hostName: data.hostName,
          durationMin: data.durationMin,
          startsAt,
          status: data.status,
          createdAt: normalizeTime(data.createdAt as unknown),
          participants: data.participants || {},
        });
      },
      (e) => console.error("race onSnapshot:", e)
    );
    return unsub;
  }, [currentRaceCode]);

  const setDisplayName = useCallback(
    async (name: string) => {
      if (!user) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      await setDoc(
        doc(db, `users/${user.uid}/profile/info`),
        { displayName: trimmed },
        { merge: true }
      );
      const email = user.email || "";
      if (email) {
        await setDoc(
          doc(db, `usersByEmail/${email.toLowerCase()}`),
          { displayName: trimmed },
          { merge: true }
        );
      }
      setProfile((p) => (p ? { ...p, displayName: trimmed } : p));
    },
    [user]
  );

  const sendFriendRequest = useCallback(
    async (email: string): Promise<string> => {
      if (!user || !profile) throw new Error("Not signed in");
      const target = email.trim().toLowerCase();
      if (!target) throw new Error("Email required");
      if (target === (user.email || "").toLowerCase()) throw new Error("Cannot add yourself");
      const lookup = await getDoc(doc(db, `usersByEmail/${target}`));
      if (!lookup.exists()) throw new Error("No user with that email");
      const { uid: toUid, displayName: toName } = lookup.data() as {
        uid: string;
        displayName: string;
      };
      if (toUid === user.uid) throw new Error("Cannot add yourself");
      const existingFriend = await getDoc(doc(db, `users/${user.uid}/friends/${toUid}`));
      if (existingFriend.exists()) throw new Error("Already friends");
      await setDoc(doc(db, `users/${toUid}/incomingRequests/${user.uid}`), {
        displayName: profile.displayName,
        email: profile.email,
        sentAt: serverTimestamp(),
      });
      await setDoc(doc(db, `users/${user.uid}/outgoingRequests/${toUid}`), {
        displayName: toName,
        email: target,
        sentAt: serverTimestamp(),
      });
      return toName;
    },
    [user, profile]
  );

  const acceptRequest = useCallback(
    async (req: FriendRequest) => {
      if (!user || !profile) return;
      const now = serverTimestamp();
      await setDoc(doc(db, `users/${user.uid}/friends/${req.fromUid}`), {
        displayName: req.displayName,
        email: req.email,
        since: now,
      });
      await setDoc(doc(db, `users/${req.fromUid}/friends/${user.uid}`), {
        displayName: profile.displayName,
        email: profile.email,
        since: now,
      });
      await deleteDoc(doc(db, `users/${user.uid}/incomingRequests/${req.fromUid}`));
      await deleteDoc(doc(db, `users/${req.fromUid}/outgoingRequests/${user.uid}`));
    },
    [user, profile]
  );

  const declineRequest = useCallback(
    async (fromUid: string) => {
      if (!user) return;
      await deleteDoc(doc(db, `users/${user.uid}/incomingRequests/${fromUid}`));
      await deleteDoc(doc(db, `users/${fromUid}/outgoingRequests/${user.uid}`));
    },
    [user]
  );

  const removeFriend = useCallback(
    async (uid: string) => {
      if (!user) return;
      await deleteDoc(doc(db, `users/${user.uid}/friends/${uid}`));
      await deleteDoc(doc(db, `users/${uid}/friends/${user.uid}`));
    },
    [user]
  );

  const persistRaceCode = (code: string | null) => {
    try {
      if (code) localStorage.setItem("oplanner.race.code", code);
      else localStorage.removeItem("oplanner.race.code");
    } catch {
      /* ignore */
    }
    setCurrentRaceCode(code);
  };

  const createRace = useCallback(
    async (durationMin: number): Promise<string> => {
      if (!user || !profile) throw new Error("Not signed in");
      let code = genCode();
      // Light collision guard.
      for (let i = 0; i < 5; i++) {
        const ex = await getDoc(doc(db, `studyRaces/${code}`));
        if (!ex.exists()) break;
        code = genCode();
      }
      const data: Omit<Race, "code"> = {
        hostUid: user.uid,
        hostName: profile.displayName,
        durationMin,
        startsAt: null,
        status: "lobby",
        createdAt: Date.now(),
        participants: {
          [user.uid]: {
            uid: user.uid,
            name: profile.displayName,
            joinedAt: Date.now(),
            focusMs: 0,
            finishedAt: null,
          },
        },
      };
      await setDoc(doc(db, `studyRaces/${code}`), data);
      persistRaceCode(code);
      return code;
    },
    [user, profile]
  );

  const joinRace = useCallback(
    async (code: string) => {
      if (!user || !profile) throw new Error("Not signed in");
      const normalized = code.trim().toUpperCase();
      const ref = doc(db, `studyRaces/${normalized}`);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error("Race not found");
      await updateDoc(ref, {
        [`participants.${user.uid}`]: {
          uid: user.uid,
          name: profile.displayName,
          joinedAt: Date.now(),
          focusMs: 0,
          finishedAt: null,
        },
      });
      persistRaceCode(normalized);
    },
    [user, profile]
  );

  const leaveRace = useCallback(async () => {
    if (!user || !currentRace) return;
    const ref = doc(db, `studyRaces/${currentRace.code}`);
    if (currentRace.hostUid === user.uid) {
      await deleteDoc(ref);
    } else {
      const rest = { ...currentRace.participants };
      delete rest[user.uid];
      await updateDoc(ref, { participants: rest });
    }
    persistRaceCode(null);
  }, [user, currentRace]);

  const startRace = useCallback(async () => {
    if (!user || !currentRace) return;
    if (currentRace.hostUid !== user.uid) return;
    await updateDoc(doc(db, `studyRaces/${currentRace.code}`), {
      status: "running",
      startsAt: Date.now(),
    });
  }, [user, currentRace]);

  const reportFocusProgress = useCallback(
    async (focusMs: number) => {
      if (!user || !currentRace) return;
      await updateDoc(doc(db, `studyRaces/${currentRace.code}`), {
        [`participants.${user.uid}.focusMs`]: focusMs,
      });
    },
    [user, currentRace]
  );

  const finishRace = useCallback(async () => {
    if (!user || !currentRace) return;
    await updateDoc(doc(db, `studyRaces/${currentRace.code}`), {
      [`participants.${user.uid}.finishedAt`]: Date.now(),
    });
  }, [user, currentRace]);

  // Suppress unused warnings while keeping imports for future use.
  void query;
  void where;
  void getDocs;
  void auth;

  return (
    <SocialContext.Provider
      value={{
        profile,
        friends,
        incoming,
        outgoing,
        currentRace,
        setDisplayName,
        sendFriendRequest,
        acceptRequest,
        declineRequest,
        removeFriend,
        createRace,
        joinRace,
        leaveRace,
        startRace,
        reportFocusProgress,
        finishRace,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
};

export const useSocial = () => {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used within SocialProvider");
  return ctx;
};
