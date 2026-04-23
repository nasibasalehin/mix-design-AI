import React, { useState } from "react";
import type { PredictRequest, PredictResponse } from "../types";

const DEFAULTS: PredictRequest = {
  cement: 280,
  slag: 100,
  fly_ash: 0,
  water: 180,
  superplasticizer: 6.0,
  coarse_aggregate: 970,
  fine_aggregate: 780,
  age: 28,
};

interface Field {
  key: keyof PredictRequest;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  hint: string;
  group?: string;
}

const FIELDS: Field[] = [
  // Binders
  { key: "cement",           label: "Cement",             unit: "kg/m³", min: 100, max: 600,  step: 5,   hint: "CEM I / CEM II (NS-EN 197-1)",              group: "Binders" },
  { key: "slag",             label: "Blast Furnace Slag", unit: "kg/m³", min: 0,   max: 400,  step: 5,   hint: "GGBS — k=0.90 in NS-EN 206 §5.2.5",         group: "Binders" },
  { key: "fly_ash",          label: "Fly Ash",            unit: "kg/m³", min: 0,   max: 220,  step: 5,   hint: "PFA — k=0.40 in NS-EN 206 §5.2.5",          group: "Binders" },
  // Water & admixtures
  { key: "water",            label: "Water",              unit: "kg/m³", min: 100, max: 280,  step: 1,   hint: "Mixing water (NS-EN 1008)",                  group: "Water & Admixtures" },
  { key: "superplasticizer", label: "Superplasticizer",   unit: "kg/m³", min: 0,   max: 35,   step: 0.5, hint: "PCE-based SP (NS-EN 934-2)",                 group: "Water & Admixtures" },
  // Aggregates
  { key: "coarse_aggregate", label: "Coarse Aggregate",   unit: "kg/m³", min: 700, max: 1200, step: 10,  hint: "Crushed stone 4–22 mm (NS-EN 12620)",        group: "Aggregates" },
  { key: "fine_aggregate",   label: "Fine Aggregate",     unit: "kg/m³", min: 500, max: 1000, step: 10,  hint: "Sand 0–4 mm (NS-EN 12620)",                  group: "Aggregates" },
  // Curing
  { key: "age",              label: "Curing Age",         unit: "days",  min: 1,   max: 365,  step: 1,   hint: "Standard test at 28 days (NS-EN 12390-3)",   group: "Curing" },
];

const GROUPS = ["Binders", "Water & Admixtures", "Aggregates", "Curing"];

export default function PredictionForm() {
  const [form, setForm] = useState<PredictRequest>(DEFAULTS);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalBinder = form.cement + form.slag + form.fly_ash;
  const wc = form.cement > 0 ? form.water / form.cement : 0;
  const effectiveBinder = form.cement + 0.9 * form.slag + 0.4 * form.fly_ash;
  const wcEq = effectiveBinder > 0 ? form.water / effectiveBinder : 0;
  const wcEqOk = wcEq >= 0.25 && wcEq <= 0.65;

  function handleChange(key: keyof PredictRequest, val: string) {
    setForm((prev) => ({ ...prev, [key]: parseFloat(val) || 0 }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail ?? `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.form}>
        {GROUPS.map((group) => {
          const groupFields = FIELDS.filter((f) => f.group === group);
          return (
            <div key={group} style={styles.group}>
              <div style={styles.groupLabel}>{group}</div>
              <div style={styles.groupHead}>
                <span style={styles.colHead}>Parameter</span>
                <span style={styles.colHead}>Value</span>
                <span style={styles.colHead}>Range</span>
              </div>
              {groupFields.map((f) => (
                <div key={f.key} style={styles.row}>
                  <div>
                    <div style={styles.label}>{f.label}</div>
                    <div style={styles.hint}>{f.hint}</div>
                  </div>
                  <div style={styles.inputWrap}>
                    <input
                      type="number"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={form[f.key]}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                      style={styles.input}
                      required
                    />
                    <span style={styles.unit}>{f.unit}</span>
                  </div>
                  <div style={styles.range}>{f.min}–{f.max}</div>
                </div>
              ))}
            </div>
          );
        })}

        {/* Derived ratios */}
        <div style={styles.ratioBox}>
          <RatioItem
            label="Total Binder"
            value={`${totalBinder.toFixed(0)} kg/m³`}
            ok={totalBinder >= 100}
            hint="cement + slag + fly ash"
          />
          <RatioItem
            label="w/c (simple)"
            value={wc.toFixed(3)}
            ok={wc >= 0.25 && wc <= 0.80}
            hint="water / cement"
          />
          <RatioItem
            label="w/b equivalent"
            value={wcEq.toFixed(3)}
            ok={wcEqOk}
            hint="water / (c + 0.9·slag + 0.4·fa)  NS-EN 206"
          />
        </div>

        <button type="submit" style={styles.btn} disabled={loading}>
          {loading ? "Predicting…" : "Predict Compressive Strength"}
        </button>
      </form>

      {error && <div style={styles.error}>{error}</div>}
      {result && <PredictResult result={result} />}
    </div>
  );
}

function RatioItem({ label, value, ok, hint }: { label: string; value: string; ok: boolean; hint: string }) {
  return (
    <div style={{ ...styles.ratioItem, borderColor: ok ? "var(--border)" : "var(--warn)" }}>
      <div style={styles.ratioLabel}>{label}</div>
      <div style={{ ...styles.ratioValue, color: ok ? "var(--text)" : "var(--warn)" }}>{value}</div>
      <div style={styles.ratioHint}>{hint}</div>
    </div>
  );
}

function PredictResult({ result }: { result: PredictResponse }) {
  const strength = result.predicted_strength;
  const grade = getGradeColor(strength);

  return (
    <div style={styles.resultBox}>
      <div style={styles.resultHeader}>Prediction Result</div>

      <div style={styles.strengthRow}>
        <div style={{ ...styles.strengthBadge, background: grade.bg, color: grade.fg, borderColor: grade.border }}>
          <div style={styles.strengthValue}>{strength.toFixed(1)}</div>
          <div style={styles.strengthUnit}>MPa</div>
        </div>
        <div style={styles.strengthMeta}>
          <div style={styles.strengthClass}>{result.strength_class}</div>
          <div style={styles.strengthLabel}>NS-EN 206 Strength Class</div>
          <div style={styles.ciRow}>
            CI: {result.confidence_interval.lower.toFixed(1)} – {result.confidence_interval.upper.toFixed(1)} MPa
          </div>
        </div>
      </div>

      <div style={styles.metaGrid}>
        <MetaItem label="w/c (simple)" value={result.water_cement_ratio.toString()} />
        <MetaItem label="w/b equivalent" value={result.equivalent_water_binder_ratio.toString()} />
      </div>

      <div style={styles.noteBox}>{result.ns_en_note}</div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metaItem}>
      <div style={styles.metaLabel}>{label}</div>
      <div style={styles.metaValue}>{value}</div>
    </div>
  );
}

function getGradeColor(mpa: number) {
  if (mpa >= 60) return { bg: "rgba(168,85,247,0.15)", fg: "#c084fc", border: "#9333ea" };
  if (mpa >= 45) return { bg: "rgba(79,124,255,0.15)", fg: "#93b4ff", border: "var(--accent)" };
  if (mpa >= 30) return { bg: "var(--success-soft)",   fg: "#4ade80", border: "var(--success)" };
  if (mpa >= 20) return { bg: "var(--warn-soft)",      fg: "#fbbf24", border: "var(--warn)" };
  return             { bg: "rgba(239,68,68,0.12)",  fg: "#f87171", border: "var(--error)" };
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: "1.5rem" },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  group: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", overflow: "hidden",
  },
  groupLabel: {
    padding: "0.5rem 0.8rem", fontSize: "0.72rem", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.07em",
    color: "var(--accent)", background: "var(--accent-soft)",
    borderBottom: "1px solid var(--border)",
  },
  groupHead: {
    display: "grid", gridTemplateColumns: "1fr 180px 90px",
    gap: "1rem", padding: "0.3rem 0.8rem",
    color: "var(--text-dim)", fontSize: "0.7rem", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.05em",
    borderBottom: "1px solid var(--border)",
  },
  colHead: {},
  row: {
    display: "grid", gridTemplateColumns: "1fr 180px 90px",
    gap: "1rem", alignItems: "center",
    padding: "0.6rem 0.8rem",
    borderBottom: "1px solid var(--border)",
  },
  label: { fontWeight: 500, fontSize: "0.88rem", color: "var(--text)" },
  hint: { fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.1rem" },
  inputWrap: { display: "flex", alignItems: "center", gap: "0.4rem" },
  input: {
    width: "110px", padding: "0.4rem 0.55rem",
    background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: "0.88rem",
    outline: "none",
  },
  unit: { color: "var(--text-muted)", fontSize: "0.78rem", whiteSpace: "nowrap" },
  range: { color: "var(--text-dim)", fontSize: "0.75rem" },
  ratioBox: { display: "flex", gap: "0.75rem", flexWrap: "wrap" },
  ratioItem: {
    flex: 1, minWidth: "150px", padding: "0.65rem 0.8rem",
    background: "var(--surface)", border: "1px solid",
    borderRadius: "var(--radius-sm)",
  },
  ratioLabel: { fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" },
  ratioValue: { fontWeight: 700, fontSize: "1.15rem", marginTop: "0.15rem" },
  ratioHint: { fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "0.1rem" },
  btn: {
    padding: "0.8rem 1.5rem", background: "var(--accent)", color: "#fff",
    border: "none", borderRadius: "var(--radius-sm)",
    fontWeight: 600, fontSize: "0.95rem", alignSelf: "flex-start",
  },
  error: {
    padding: "0.8rem 1rem",
    background: "rgba(239,68,68,0.1)", border: "1px solid var(--error)",
    borderRadius: "var(--radius-sm)", color: "#f87171", fontSize: "0.88rem",
  },
  resultBox: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "1.5rem",
    display: "flex", flexDirection: "column", gap: "1rem",
  },
  resultHeader: { fontWeight: 600, fontSize: "0.82rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" },
  strengthRow: { display: "flex", gap: "1.5rem", alignItems: "center" },
  strengthBadge: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", width: "110px", height: "90px",
    borderRadius: "var(--radius)", border: "2px solid",
  },
  strengthValue: { fontSize: "2rem", fontWeight: 700, lineHeight: 1 },
  strengthUnit: { fontSize: "0.8rem", marginTop: "0.2rem", opacity: 0.8 },
  strengthMeta: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  strengthClass: { fontSize: "1.4rem", fontWeight: 700, color: "var(--text)" },
  strengthLabel: { fontSize: "0.8rem", color: "var(--text-muted)" },
  ciRow: { fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "0.2rem" },
  metaGrid: { display: "flex", gap: "0.75rem", flexWrap: "wrap" },
  metaItem: {
    padding: "0.5rem 0.8rem",
    background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", minWidth: "130px",
  },
  metaLabel: { fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" },
  metaValue: { fontWeight: 600, fontSize: "1rem", color: "var(--text)", marginTop: "0.15rem" },
  noteBox: {
    padding: "0.7rem 0.9rem",
    background: "var(--accent-soft)", border: "1px solid rgba(79,124,255,0.25)",
    borderRadius: "var(--radius-sm)", fontSize: "0.82rem", color: "var(--text-muted)",
    lineHeight: 1.5,
  },
};
