import React, { useState } from "react";
import AuthModal from "./AuthModal";
import "../css/Login.css";

const Login: React.FC = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-brand">
          <img src="./Logo.svg" alt="" className="landing-logo" />
          <span>OPlanner</span>
        </div>
        <div className="landing-nav-right">
          <a
            className="landing-nav-link"
            href="https://github.com/YossiAbutbul/OPlanner"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <button
            className="landing-nav-btn"
            onClick={() => openAuth("signin")}
          >
            Sign in
          </button>
        </div>
      </nav>

      <main className="landing-main" id="top">
        <section className="landing-hero">
          <div className="landing-hero-text">
            <span className="landing-eyebrow">
              <span className="landing-eyebrow-dot" /> Built by a student, for students
            </span>
            <h1>
              Stop juggling tabs.<br />
              <span className="landing-hero-accent">Ship the semester.</span>
            </h1>
            <p className="landing-lead">
              Your courses, assignments and finals — one keyboard shortcut away.
              Drop your university .ics file in and you're set up in 30 seconds.
            </p>
            <div className="landing-cta-row">
              <button
                className="landing-cta"
                onClick={() => openAuth("signin")}
              >
                Get started — it's free
              </button>
              <span className="landing-cta-note">
                Free · 30 seconds · No setup
              </span>
            </div>
          </div>

          <div className="landing-hero-art" aria-hidden>
            <div className="landing-card landing-card-1">
              <div className="landing-card-head">
                <span className="landing-dot" style={{ background: "#1db954" }} />
                <span>Operating Systems</span>
                <span className="landing-pill">12d</span>
              </div>
              <div className="landing-bar">
                <div className="landing-bar-fill" style={{ width: "72%" }} />
              </div>
              <div className="landing-card-meta">7 / 10 tasks</div>
            </div>
            <div className="landing-card landing-card-2">
              <div className="landing-card-head">
                <span className="landing-dot" style={{ background: "#3498db" }} />
                <span>Linear Algebra</span>
                <span className="landing-pill landing-pill-amber">25d</span>
              </div>
              <div className="landing-bar">
                <div className="landing-bar-fill" style={{ width: "45%" }} />
              </div>
              <div className="landing-card-meta">3 / 7 tasks</div>
            </div>
            <div className="landing-card landing-card-3">
              <div className="landing-card-head">
                <span className="landing-dot" style={{ background: "#9b59b6" }} />
                <span>Algorithms</span>
                <span className="landing-pill landing-pill-red">3d</span>
              </div>
              <div className="landing-bar">
                <div className="landing-bar-fill" style={{ width: "90%" }} />
              </div>
              <div className="landing-card-meta">9 / 10 tasks</div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="landing-how">
          <span className="landing-section-tag">How it works</span>
          <h2>Three minutes from signup to "huh, that was easy."</h2>
          <ol className="landing-steps">
            <li>
              <span className="landing-step-num">1</span>
              <h3>Create your account</h3>
              <p>
                Sign up with email or Google in seconds. Your data is scoped to
                your account.
              </p>
            </li>
            <li>
              <span className="landing-step-num">2</span>
              <h3>Drop your .ics file</h3>
              <p>
                Export your semester calendar from your university portal and
                drag it in. Courses, lectures, all there.
              </p>
            </li>
            <li>
              <span className="landing-step-num">3</span>
              <h3>Track and finish</h3>
              <p>
                Add tasks, set finals, color-code semesters. The countdown does
                the worrying for you.
              </p>
            </li>
          </ol>
        </section>

        {/* Feature strip with mini visuals */}
        <section className="landing-features">
          <div className="landing-feature">
            <div className="landing-feature-vis landing-feature-vis-bars">
              <span style={{ height: "30%" }} />
              <span style={{ height: "60%" }} />
              <span style={{ height: "85%" }} />
              <span style={{ height: "45%" }} />
            </div>
            <h3>Per-course progress</h3>
            <p>See where you're crushing it and where you're slipping.</p>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-vis landing-feature-vis-cal">
              <span />
              <span />
              <span />
              <span className="hl" />
              <span />
              <span />
              <span />
            </div>
            <h3>Calendar-first</h3>
            <p>Pick a day, see what's due. Click empty days to add tasks.</p>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-vis landing-feature-vis-clock">
              <div className="landing-feature-clock-dot" />
              <div className="landing-feature-clock-hand" />
            </div>
            <h3>Finals countdown</h3>
            <p>One date per course. The clock starts the moment you set it.</p>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-vis landing-feature-vis-swatches">
              <span style={{ background: "#1db954" }} />
              <span style={{ background: "#3498db" }} />
              <span style={{ background: "#9b59b6" }} />
              <span style={{ background: "#e67e22" }} />
            </div>
            <h3>Color-coded</h3>
            <p>Right-click a tab. Pick a color. Forever know where you are.</p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="landing-cta-final">
          <h2>Your semester won't plan itself.</h2>
          <p>Open OPlanner once. Stop forgetting things forever.</p>
          <button
            className="landing-cta"
            onClick={() => openAuth("signin")}
          >
            Get started — it's free
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        <span>OPlanner · {new Date().getFullYear()}</span>
        <a
          href="https://github.com/YossiAbutbul/OPlanner"
          target="_blank"
          rel="noreferrer"
        >
          Source on GitHub
        </a>
      </footer>

      <AuthModal
        isOpen={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
      />
    </div>
  );
};

export default Login;
