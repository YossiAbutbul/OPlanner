import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "../css/Login.css";

const Login: React.FC = () => {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="./Logo.svg" alt="OPlanner" className="login-logo" />
        <h1>OPlanner</h1>
        <p>Sign in to continue</p>
        <button className="login-btn" onClick={handleSignIn} disabled={busy}>
          {busy ? "Signing in..." : "Sign in with Google"}
        </button>
        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
};

export default Login;
