import React, { useState } from "react";
import PredictionForm from "./components/PredictionForm";
import OptimizationForm from "./components/OptimizationForm";
import StandardsPanel from "./components/StandardsPanel";

type Tab = "predict" | "optimize" | "standards";

export default function App() {
  const [tab, setTab] = useState<Tab>("predict");

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoArea}>
            <div style={styles.logo}>
              <span style={styles.logoIcon}>⬡</span>
              <div>
                <div style={styles.logoTitle}>MixDesign AI</div>
                <div style={styles.logoSub}>Betongblandingsdesign — NS-EN 206</div>
              </div>
            </div>
          </div>
          <nav style={styles.nav}>
            <TabButton active={tab === "predict"} onClick={() => setTab("predict")}>
              Strength Prediction
            </TabButton>
            <TabButton active={tab === "optimize"} onClick={() => setTab("optimize")}>
              Mix Optimisation
            </TabButton>
            <TabButton active={tab === "standards"} onClick={() => setTab("standards")}>
              NS-EN 206 Reference
            </TabButton>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.content}>
          {/* Page heading */}
          <div style={styles.pageHead}>
            {tab === "predict" && (
              <>
                <h1 style={styles.h1}>Strength Prediction</h1>
                <p style={styles.desc}>
                  Provide mix proportions to predict compressive strength (f<sub>ck</sub>).
                  Model trained on data calibrated to Norwegian cement practice (NS-EN 197-1, NS-EN 206).
                </p>
              </>
            )}
            {tab === "optimize" && (
              <>
                <h1 style={styles.h1}>Mix Optimisation</h1>
                <p style={styles.desc}>
                  Enter a target strength and optional NS-EN 206 exposure class. The optimiser searches
                  5000 candidate mixes and returns the one closest to your target, respecting durability
                  constraints from NS-EN 206 Table 1.
                </p>
              </>
            )}
            {tab === "standards" && (
              <>
                <h1 style={styles.h1}>NS-EN 206 Reference</h1>
                <p style={styles.desc}>
                  Norwegian concrete standard — exposure classes, strength classes, and model
                  performance metrics.
                </p>
              </>
            )}
          </div>

          {tab === "predict" && <PredictionForm />}
          {tab === "optimize" && <OptimizationForm />}
          {tab === "standards" && <StandardsPanel />}
        </div>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        NS-EN 206:2013+A2:2021 &nbsp;·&nbsp; NS-EN 197-1 &nbsp;·&nbsp; NS-EN 12620 &nbsp;·&nbsp;
        NS-EN 934-2 &nbsp;·&nbsp; NS-EN 12390-3 &nbsp;·&nbsp; Random Forest ML model
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tabBtn,
        ...(active
          ? { color: "var(--text)", borderBottomColor: "var(--accent)" }
          : {}),
      }}
    >
      {children}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },
  header: {
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    maxWidth: "1080px",
    margin: "0 auto",
    padding: "0 1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "2rem",
    height: "60px",
  },
  logoArea: { flexShrink: 0 },
  logo: { display: "flex", alignItems: "center", gap: "0.75rem" },
  logoIcon: {
    fontSize: "1.6rem",
    color: "var(--accent)",
    lineHeight: 1,
  },
  logoTitle: { fontWeight: 700, fontSize: "1rem", color: "var(--text)" },
  logoSub: { fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "1px" },
  nav: { display: "flex", gap: "0", marginLeft: "auto" },
  tabBtn: {
    padding: "0 1.1rem",
    height: "60px",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text-muted)",
    fontSize: "0.88rem",
    fontWeight: 500,
    transition: "color 0.15s, border-color 0.15s",
    whiteSpace: "nowrap",
  },
  main: { flex: 1, padding: "2rem 1.5rem" },
  content: { maxWidth: "900px", margin: "0 auto" },
  pageHead: { marginBottom: "1.75rem" },
  h1: { fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" },
  desc: { fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.6, maxWidth: "680px" },
  footer: {
    padding: "1rem 1.5rem",
    borderTop: "1px solid var(--border)",
    textAlign: "center",
    fontSize: "0.72rem",
    color: "var(--text-dim)",
  },
};
