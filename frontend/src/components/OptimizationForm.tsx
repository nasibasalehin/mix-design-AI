import React, { useState } from "react";
import type { OptimizeRequest, OptimizeResponse } from "../types";

const EXPOSURE_CLASSES = [
  { value: "",    label: "None (no exposure constraint)" },
  { value: "XC1", label: "XC1 — Dry or permanently wet" },
  { value: "XC2", label: "XC2 — Wet, rarely dry" },
  { value: "XC3", label: "XC3 — Moderate humidity" },
  { value: "XC4", label: "XC4 — Cyclic wet and dry" },
  { value: "XD1", label: "XD1 — Moderate humidity (chloride)" },
  { value: "XD2", label: "XD2 — Wet, rarely dry (chloride)" },
  { value: "XD3", label: "XD3 — Cyclic wet/dry (chloride)" },
  { value: "XS1", label: "XS1 — Sea air, no direct contact" },
  { value: "XS2", label: "XS2 — Permanently submerged (sea)" },
  { value: "XS3", label: "XS3 — Tidal/splash/spray zone (sea)" },
  { value: "XF1", label: "XF1 — Moderate saturation, no de-icing" },
  { value: "XF2", label: "XF2 — Moderate saturation, with de-icing" },
  { value: "XF3", label: "XF3 — High saturation, no de-icing" },
  { value: "XF4", label: "XF4 — High saturation, with de-icing (Norwegian roads)" },
];

const STRENGTH_PRESETS = [
  { label: "C20/25", mpa: 20 },
  { label: "C25/30", mpa: 25 },
  { label: "C30/37", mpa: 30 },
  { label: "C35/45", mpa: 35 },
  { label: "C40/50", mpa: 40 },
  { label: "C45/55", mpa: 45 },
  { label: "C50/60", mpa: 50 },
  { label: "C60/75", mpa: 60 },
];

export default function OptimizationForm() {
  const [target, setTarget]       = useState(35);
  const [exposure, setExposure]   = useState("");
  const [maxCement, setMaxCement] = useState("");
  const [minWc, setMinWc]         = useState("0.30");
  const [maxWc, setMaxWc]         = useState("0.65");
  const [age, setAge]             = useState(28);
  const [useSlag, setUseSlag]     = useState(true);
  const [useFlyAsh, setUseFlyAsh] = useState(true);

  const [result, setResult]   = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const req: OptimizeRequest = {
      target_strength: target,
      age,
      use_slag: useSlag,
      use_fly_ash: useFlyAsh,
      ...(exposure   && { exposure_class: exposure }),
      ...(maxCement  && { max_cement: parseFloat(maxCement) }),
      ...(minWc      && { min_wc: parseFloat(minWc) }),
      ...(maxWc      && { max_wc: parseFloat(maxWc) }),
    };

    try {
      const res = await fetch("/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
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

        {/* Strength class presets */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>NS-EN 206 Strength Class Presets</div>
          <div style={styles.presets}>
            {STRENGTH_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setTarget(p.mpa)}
                style={{ ...styles.preset, ...(target === p.mpa ? styles.presetActive : {}) }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target strength */}
        <div style={styles.field}>
          <label style={styles.label}>Target Characteristic Strength f<sub>ck</sub></label>
          <div style={styles.inputRow}>
            <input
              type="number" min={10} max={120} step={1}
              value={target}
              onChange={(e) => setTarget(parseFloat(e.target.value) || 0)}
              style={styles.input} required
            />
            <span style={styles.unit}>MPa</span>
            <span style={styles.hint}>10–120 MPa</span>
          </div>
        </div>

        {/* Exposure class */}
        <div style={styles.field}>
          <label style={styles.label}>Exposure Class (NS-EN 206 Table 1)</label>
          <select value={exposure} onChange={(e) => setExposure(e.target.value)} style={styles.select}>
            {EXPOSURE_CLASSES.map((ec) => (
              <option key={ec.value} value={ec.value}>{ec.label}</option>
            ))}
          </select>
        </div>

        {/* SCM toggles */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Supplementary Cementitious Materials (SCM)</div>
          <div style={styles.toggleRow}>
            <label style={styles.toggle}>
              <input
                type="checkbox" checked={useSlag}
                onChange={(e) => setUseSlag(e.target.checked)}
                style={{ marginRight: "0.5rem" }}
              />
              Allow Blast Furnace Slag
              <span style={styles.toggleHint}> k = 0.90 (NS-EN 206 §5.2.5)</span>
            </label>
            <label style={styles.toggle}>
              <input
                type="checkbox" checked={useFlyAsh}
                onChange={(e) => setUseFlyAsh(e.target.checked)}
                style={{ marginRight: "0.5rem" }}
              />
              Allow Fly Ash
              <span style={styles.toggleHint}> k = 0.40 (NS-EN 206 §5.2.5)</span>
            </label>
          </div>
        </div>

        {/* Optional constraints */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Optional Constraints</div>
          <div style={styles.constraintGrid}>
            <div style={styles.field}>
              <label style={styles.label}>Design Age</label>
              <div style={styles.inputRow}>
                <input type="number" min={1} max={365} value={age}
                  onChange={(e) => setAge(parseInt(e.target.value) || 28)}
                  style={{ ...styles.input, width: "80px" }} />
                <span style={styles.unit}>days</span>
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Max Cement</label>
              <div style={styles.inputRow}>
                <input type="number" min={150} max={600} step={10} placeholder="550"
                  value={maxCement} onChange={(e) => setMaxCement(e.target.value)}
                  style={{ ...styles.input, width: "80px" }} />
                <span style={styles.unit}>kg/m³</span>
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Min w/b</label>
              <input type="number" min={0.20} max={0.80} step={0.01}
                value={minWc} onChange={(e) => setMinWc(e.target.value)}
                style={{ ...styles.input, width: "80px" }} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Max w/b</label>
              <input type="number" min={0.20} max={0.80} step={0.01}
                value={maxWc} onChange={(e) => setMaxWc(e.target.value)}
                style={{ ...styles.input, width: "80px" }} />
            </div>
          </div>
        </div>

        <button type="submit" style={styles.btn} disabled={loading}>
          {loading ? "Optimising mix…" : "Optimise Mix Design"}
        </button>
      </form>

      {error && <div style={styles.error}>{error}</div>}
      {result && <OptimizeResult result={result} target={target} />}
    </div>
  );
}

function OptimizeResult({ result, target }: { result: OptimizeResponse; target: number }) {
  const delta = result.predicted_strength - target;
  const mix   = result.mix;

  const mixRows = [
    { label: "Cement",           key: "cement",           unit: "kg/m³", note: "CEM I / CEM II (NS-EN 197-1)",    decimals: 1 },
    { label: "Blast Furnace Slag", key: "slag",           unit: "kg/m³", note: "GGBS k=0.90 (NS-EN 206 §5.2.5)", decimals: 1 },
    { label: "Fly Ash",          key: "fly_ash",          unit: "kg/m³", note: "PFA k=0.40 (NS-EN 206 §5.2.5)",  decimals: 1 },
    { label: "Water",            key: "water",            unit: "kg/m³", note: "NS-EN 1008",                      decimals: 1 },
    { label: "Superplasticizer", key: "superplasticizer", unit: "kg/m³", note: "PCE-based (NS-EN 934-2)",         decimals: 2 },
    { label: "Coarse Aggregate", key: "coarse_aggregate", unit: "kg/m³", note: "4–22 mm (NS-EN 12620)",           decimals: 1 },
    { label: "Fine Aggregate",   key: "fine_aggregate",   unit: "kg/m³", note: "0–4 mm (NS-EN 12620)",            decimals: 1 },
  ] as const;

  return (
    <div style={styles.resultBox}>
      <div style={styles.resultHeader}>Optimised Mix Design</div>

      {/* Strength summary */}
      <div style={styles.strengthRow}>
        <div style={styles.strengthBlock}>
          <div style={styles.strengthVal}>{result.predicted_strength.toFixed(1)}</div>
          <div style={styles.strengthLbl}>MPa predicted</div>
        </div>
        <div style={styles.strengthBlock}>
          <div style={{ ...styles.strengthVal, color: "var(--text-muted)" }}>{target}</div>
          <div style={styles.strengthLbl}>MPa target</div>
        </div>
        <div style={styles.strengthBlock}>
          <div style={{ ...styles.strengthVal, color: Math.abs(delta) <= 3 ? "var(--success)" : "var(--warn)" }}>
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}
          </div>
          <div style={styles.strengthLbl}>MPa difference</div>
        </div>
        <div style={styles.classBadge}>{result.strength_class}</div>
      </div>

      {/* Mix table */}
      <div style={styles.mixTable}>
        <div style={styles.mixHead}>
          <span>Component</span><span>Quantity</span><span>Reference</span>
        </div>
        {mixRows.map((r) => {
          const val = mix[r.key] as number;
          const isZero = val === 0;
          return (
            <div key={r.key} style={{ ...styles.mixRow, opacity: isZero ? 0.4 : 1 }}>
              <span style={{ fontWeight: 500 }}>{r.label}</span>
              <span style={styles.mixVal}>
                {val.toFixed(r.decimals)}{" "}
                <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{r.unit}</span>
              </span>
              <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>{r.note}</span>
            </div>
          );
        })}
        {/* Ratio rows */}
        <div style={{ ...styles.mixRow, background: "var(--surface2)", borderColor: "var(--border)" }}>
          <span style={{ fontWeight: 600 }}>w/c (simple)</span>
          <span style={styles.mixVal}>{result.water_cement_ratio.toFixed(3)}</span>
          <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>water / cement</span>
        </div>
        <div style={{ ...styles.mixRow, background: "var(--surface2)", borderColor: "var(--accent)" }}>
          <span style={{ fontWeight: 600, color: "var(--accent)" }}>w/b equivalent</span>
          <span style={{ ...styles.mixVal, color: "var(--accent)" }}>{result.equivalent_water_binder_ratio.toFixed(3)}</span>
          <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>NS-EN 206 §5.2.5</span>
        </div>
      </div>

      {/* Exposure compliance */}
      {result.exposure_compliance && (
        <div style={styles.complianceBox}>
          <div style={styles.complianceTitle}>
            NS-EN 206 Compliance — {result.exposure_compliance.class}
          </div>
          <div style={styles.complianceGrid}>
            <CItem label="Description"         value={result.exposure_compliance.description} />
            <CItem label="Applied max w/b"     value={result.exposure_compliance.applied_max_wc.toString()} />
            <CItem label="Applied min cement"  value={`${result.exposure_compliance.applied_min_cement} kg/m³`} />
            <CItem label="Min strength class"  value={result.exposure_compliance.required_min_strength_class} />
          </div>
        </div>
      )}

      <div style={styles.noteBox}>{result.ns_en_note}</div>
    </div>
  );
}

function CItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontWeight: 500, fontSize: "0.87rem", color: "var(--text)", marginTop: "0.15rem" }}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: "1.5rem" },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  section: {
    padding: "0.9rem 1rem",
    background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
  },
  sectionLabel: { fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)", marginBottom: "0.7rem" },
  presets: { display: "flex", flexWrap: "wrap", gap: "0.5rem" },
  preset: {
    padding: "0.35rem 0.75rem", fontSize: "0.82rem", fontWeight: 500,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", color: "var(--text-muted)", transition: "all 0.15s",
  },
  presetActive: { background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--accent)" },
  field: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  label: { fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted)" },
  inputRow: { display: "flex", alignItems: "center", gap: "0.5rem" },
  input: {
    width: "120px", padding: "0.45rem 0.6rem",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: "0.9rem", outline: "none",
  },
  select: {
    padding: "0.45rem 0.6rem", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: "0.88rem", outline: "none", width: "100%",
  },
  unit: { color: "var(--text-muted)", fontSize: "0.82rem" },
  hint: { color: "var(--text-dim)", fontSize: "0.78rem" },
  toggleRow: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  toggle: { display: "flex", alignItems: "center", fontSize: "0.88rem", color: "var(--text)", cursor: "pointer" },
  toggleHint: { color: "var(--text-dim)", fontSize: "0.75rem", marginLeft: "0.3rem" },
  constraintGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "1rem" },
  btn: {
    padding: "0.8rem 1.5rem", background: "var(--accent)", color: "#fff",
    border: "none", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: "0.95rem", alignSelf: "flex-start",
  },
  error: {
    padding: "0.8rem 1rem", background: "rgba(239,68,68,0.1)", border: "1px solid var(--error)",
    borderRadius: "var(--radius-sm)", color: "#f87171", fontSize: "0.88rem",
  },
  resultBox: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem",
  },
  resultHeader: { fontWeight: 600, fontSize: "0.82rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" },
  strengthRow: { display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" },
  strengthBlock: { display: "flex", flexDirection: "column", gap: "0.2rem" },
  strengthVal: { fontSize: "1.8rem", fontWeight: 700, color: "var(--text)", lineHeight: 1 },
  strengthLbl: { fontSize: "0.73rem", color: "var(--text-dim)" },
  classBadge: {
    marginLeft: "auto", padding: "0.4rem 1rem",
    background: "var(--accent-soft)", border: "1px solid var(--accent)",
    borderRadius: "var(--radius-sm)", color: "var(--accent)", fontWeight: 700, fontSize: "1rem",
  },
  mixTable: { display: "flex", flexDirection: "column", gap: "2px" },
  mixHead: {
    display: "grid", gridTemplateColumns: "1fr 130px 1fr",
    gap: "1rem", padding: "0.3rem 0.7rem",
    color: "var(--text-dim)", fontSize: "0.7rem", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.05em",
  },
  mixRow: {
    display: "grid", gridTemplateColumns: "1fr 130px 1fr",
    gap: "1rem", alignItems: "center",
    padding: "0.55rem 0.7rem",
    background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
  },
  mixVal: { fontWeight: 600, fontSize: "0.93rem" },
  complianceBox: {
    padding: "1rem", background: "var(--success-soft)",
    border: "1px solid rgba(34,197,94,0.3)", borderRadius: "var(--radius-sm)",
  },
  complianceTitle: { fontWeight: 600, fontSize: "0.82rem", color: "var(--success)", marginBottom: "0.7rem" },
  complianceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem" },
  noteBox: {
    padding: "0.7rem 0.9rem", background: "var(--accent-soft)",
    border: "1px solid rgba(79,124,255,0.25)", borderRadius: "var(--radius-sm)",
    fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.5,
  },
};
