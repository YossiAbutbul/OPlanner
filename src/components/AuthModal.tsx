import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "../css/AuthModal.css";

interface Props {
  isOpen: boolean;
  initialMode?: Mode;
  onClose: () => void;
}

type Mode = "signin" | "signup" | "reset";

const COPY: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  signin: {
    title: "Welcome back",
    subtitle: "Your semester is where you left it.",
    submit: "Sign in",
  },
  signup: {
    title: "Create your account",
    subtitle: "Free for students — set up in 30 seconds.",
    submit: "Create account",
  },
  reset: {
    title: "Reset password",
    subtitle: "We'll email you a reset link.",
    submit: "Send reset email",
  },
};

const AuthModal: React.FC<Props> = ({ isOpen, initialMode = "signin", onClose }) => {
  const { signIn, signInEmail, signUpEmail, resetPassword } = useAuth();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setInfo(null);
      setPassword("");
      setShowPassword(false);
      setTimeout(() => emailRef.current?.focus(), 80);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setShowPassword(false);
  };

  const handleGoogle = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await signIn();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInEmail(email, password);
        onClose();
      } else if (mode === "signup") {
        await signUpEmail(email, password, displayName);
        onClose();
      } else {
        await resetPassword(email);
        setInfo(
          "Password reset email sent. Check your inbox — and your spam folder, just in case."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <motion.div
      className="auth-overlay"
      onClick={onClose}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 26 }}
      >
        {mode !== "reset" && (
          <div className="auth-tabs" role="tablist">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`auth-tab ${mode === m ? "active" : ""}`}
                onClick={() => switchMode(m)}
              >
                {mode === m && (
                  <motion.span
                    className="auth-tab-pill"
                    layoutId="auth-tab-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="auth-tab-label">
                  {m === "signin" ? "Sign in" : "Sign up"}
                </span>
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <h2 className="auth-title">{COPY[mode].title}</h2>
            <p className="auth-subtitle">{COPY[mode].subtitle}</p>

            {mode !== "reset" && (
              <>
                <button
                  type="button"
                  className="auth-google"
                  onClick={handleGoogle}
                  disabled={busy}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41.4 35.6 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                  </svg>
                  Continue with Google
                </button>
                <div className="auth-divider"><span>or</span></div>
              </>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === "signup" && (
                <label className="auth-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </label>
              )}

              <label className="auth-field">
                <span>Email</span>
                <input
                  ref={emailRef}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              {mode !== "reset" && (
                <label className="auth-field">
                  <span>Password</span>
                  <span className="auth-password-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "At least 6 characters" : ""}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>
              )}

              {mode === "signin" && (
                <button
                  type="button"
                  className="auth-forgot"
                  onClick={() => switchMode("reset")}
                >
                  Forgot password?
                </button>
              )}

              <AnimatePresence>
                {error && (
                  <motion.p
                    className="auth-error"
                    initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0 }}
                  >
                    {error}
                  </motion.p>
                )}
                {info && (
                  <motion.p
                    className="auth-info"
                    initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0 }}
                  >
                    {info}
                  </motion.p>
                )}
              </AnimatePresence>

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy && <span className="auth-spinner" aria-hidden />}
                {busy ? "Please wait…" : COPY[mode].submit}
              </button>

              <button
                type="button"
                className="auth-cancel"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>

              {mode === "reset" && (
                <button
                  type="button"
                  className="auth-back"
                  onClick={() => switchMode("signin")}
                >
                  ← Back to sign in
                </button>
              )}
            </form>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default AuthModal;
