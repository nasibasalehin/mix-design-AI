import React, { useEffect, useState } from "react";
import type { StandardsResponse } from "../types";

export default function StandardsPanel() {
  const [data, setData] = useState<StandardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/standards")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Could not load standards data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.loading}>Loading NS-EN 206 reference data…</div>;
  if (error || !data) return <div style={styles.err}>{error}</div>;

  return (
    <div style={styles.wrapper}>
      {/* Model metrics */}
      {data.model_metrics?.test_mae != null && (
        <div style={styles.metrics}>
          <div style={styles.sectionTitle}>ML Model Performance</div>
          <div style={styles.metricsGrid}>
            <MetricCard label="Test MAE" value={`${data.model_metrics.test_mae?.toFixed(2)} MPa`} />
            <MetricCard label="Test R²" value={(data.model_metrics.test_r2 ?? 0).toFixed(4)} />
            <MetricCard label="CV MAE (5-fold)" value={`${data.model_metrics.cv_mae?.toFixed(2)} MPa`} />
          </div>
          <p style={styles.metricsNote}>
            Random Forest Regressor trained on the UCI Concrete Compressive Strength dataset
            (Yeh, 1998), aligned with NS-EN 206 interpretation in this application.
          </p>
        </div>
      )}

      {/* Exposure classes */}
      <div>
        <div style={styles.sectionTitle}>NS-EN 206 Exposure Classes</div>
        <div style={styles.tableHead}>
          <span>Class</span>
          <span>Description</span>
          <span>Max w/c</span>
          <span>Min cement</span>
          <span>Min strength</span>
        </div>
        {Object.entries(data.exposure_classes).map(([cls, info]) => (
          <div key={cls} style={styles.tableRow}>
            <span style={styles.classTag}>{cls}</span>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{info.description}</span>
            <span style={styles.val}>{info.max_wc}</span>
            <span style={styles.val}>{info.min_cement} kg/m³</span>
            <span style={{ ...styles.val, color: "var(--accent)" }}>{info.min_strength_class}</span>
          </div>
        ))}
      </div>

      {/* Strength classes */}
      <div>
        <div style={styles.sectionTitle}>NS-EN 206 Strength Classes</div>
        <div style={styles.strengthGrid}>
          {Object.entries(data.strength_classes).map(([cls, fck]) => (
            <div key={cls} style={styles.strengthCard}>
              <div style={styles.strengthCls}>{cls}</div>
              <div style={styles.strengthFck}>f<sub>ck</sub> = {fck} MPa</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: "2rem" },
  loading: { color: "var(--text-muted)", padding: "1rem" },
  err: { color: "var(--error)", padding: "1rem" },
  sectionTitle: {
    fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.07em", color: "var(--text-dim)", marginBottom: "0.75rem",
  },
  metrics: {
    padding: "1rem",
    background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
  },
  metricsGrid: { display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" },
  metricCard: {
    padding: "0.6rem 0.9rem",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
  },
  metricLabel: { fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" },
  metricValue: { fontWeight: 700, fontSize: "1.1rem", color: "var(--success)", marginTop: "0.1rem" },
  metricsNote: { fontSize: "0.78rem", color: "var(--text-dim)", lineHeight: 1.5 },
  tableHead: {
    display: "grid", gridTemplateColumns: "70px 1fr 80px 120px 120px",
    gap: "1rem", padding: "0.35rem 0.7rem",
    color: "var(--text-dim)", fontSize: "0.72rem", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.05em",
  },
  tableRow: {
    display: "grid", gridTemplateColumns: "70px 1fr 80px 120px 120px",
    gap: "1rem", alignItems: "center",
    padding: "0.55rem 0.7rem",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", marginBottom: "2px",
  },
  classTag: {
    fontFamily: "monospace", fontWeight: 700, fontSize: "0.85rem",
    color: "var(--accent)", padding: "0.1rem 0.3rem",
    background: "var(--accent-soft)", borderRadius: "3px",
    width: "fit-content",
  },
  val: { fontWeight: 500, fontSize: "0.85rem", color: "var(--text)" },
  strengthGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.5rem" },
  strengthCard: {
    padding: "0.65rem 0.8rem",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", textAlign: "center",
  },
  strengthCls: { fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" },
  strengthFck: { fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" },
};
