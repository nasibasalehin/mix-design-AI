"""
FastAPI backend for AI Concrete Mix Design Predictor
Based on Norwegian NS-EN 206 standard
Uses all 8 UCI features: cement, slag, fly_ash, water, SP, coarse_agg, fine_agg, age

Endpoints:
  POST /predict   — Mode A: predict compressive strength from mix proportions
  POST /optimize  — Mode B: suggest mix for a target strength
  GET  /standards — NS-EN 206 exposure class reference data
  GET  /health    — Liveness check
"""

import json
import pickle
import sys
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

MODEL_PATH = Path(__file__).parent.parent / "ml" / "concrete_model.pkl"
METRICS_PATH = Path(__file__).parent.parent / "ml" / "metrics.json"

try:
    with open(MODEL_PATH, "rb") as f:
        MODEL = pickle.load(f)
    print(f"Model loaded from {MODEL_PATH}", file=sys.stderr)
except FileNotFoundError:
    print(f"ERROR: Model not found at {MODEL_PATH}. Run ml/train.py first.", file=sys.stderr)
    MODEL = None

# ---------------------------------------------------------------------------
# NS-EN 206 reference data
# ---------------------------------------------------------------------------
NS_EN_206_EXPOSURE = {
    "XC1": {"description": "Dry or permanently wet",                       "max_wc": 0.65, "min_cement": 260, "min_strength_class": "C20/25"},
    "XC2": {"description": "Wet, rarely dry",                              "max_wc": 0.60, "min_cement": 280, "min_strength_class": "C25/30"},
    "XC3": {"description": "Moderate humidity",                            "max_wc": 0.55, "min_cement": 280, "min_strength_class": "C30/37"},
    "XC4": {"description": "Cyclic wet and dry",                           "max_wc": 0.50, "min_cement": 300, "min_strength_class": "C30/37"},
    "XD1": {"description": "Moderate humidity (chloride)",                 "max_wc": 0.55, "min_cement": 300, "min_strength_class": "C35/45"},
    "XD2": {"description": "Wet, rarely dry (chloride)",                   "max_wc": 0.50, "min_cement": 320, "min_strength_class": "C35/45"},
    "XD3": {"description": "Cyclic wet/dry (chloride)",                    "max_wc": 0.45, "min_cement": 340, "min_strength_class": "C40/50"},
    "XS1": {"description": "Sea air, no direct contact",                   "max_wc": 0.50, "min_cement": 300, "min_strength_class": "C35/45"},
    "XS2": {"description": "Permanently submerged (sea)",                  "max_wc": 0.45, "min_cement": 320, "min_strength_class": "C35/45"},
    "XS3": {"description": "Tidal/splash/spray zone (sea)",                "max_wc": 0.45, "min_cement": 340, "min_strength_class": "C40/50"},
    "XF1": {"description": "Moderate water saturation, no de-icing",       "max_wc": 0.55, "min_cement": 300, "min_strength_class": "C30/37"},
    "XF2": {"description": "Moderate water saturation, with de-icing",     "max_wc": 0.50, "min_cement": 300, "min_strength_class": "C25/30"},
    "XF3": {"description": "High water saturation, no de-icing",           "max_wc": 0.50, "min_cement": 320, "min_strength_class": "C30/37"},
    "XF4": {"description": "High water saturation, with de-icing (Norwegian roads)", "max_wc": 0.45, "min_cement": 340, "min_strength_class": "C35/45"},
}

NS_EN_STRENGTH_CLASSES = {
    "C20/25": 20, "C25/30": 25, "C30/37": 30, "C35/45": 35,
    "C40/50": 40, "C45/55": 45, "C50/60": 50, "C55/67": 55,
    "C60/75": 60, "C70/85": 70, "C80/95": 80, "C90/105": 90,
}

# NS-EN 206 efficiency factors for supplementary cementitious materials
K_SLAG = 0.9     # Blast furnace slag (§ 5.2.5 NS-EN 206)
K_FLY_ASH = 0.4  # Fly ash (§ 5.2.5 NS-EN 206)


def classify_strength(fck: float) -> str:
    for cls_name, cls_val in sorted(NS_EN_STRENGTH_CLASSES.items(), key=lambda x: x[1]):
        if fck <= cls_val + 5:
            return cls_name
    return "C90/105+"


def equivalent_wc(water: float, cement: float, slag: float, fly_ash: float) -> float:
    """NS-EN 206 equivalent water/binder ratio using k-value concept."""
    effective_binder = cement + K_SLAG * slag + K_FLY_ASH * fly_ash
    return water / effective_binder if effective_binder > 0 else 999.0


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class PredictRequest(BaseModel):
    cement: float          = Field(..., ge=100, le=600,  description="Cement (kg/m³)")
    slag: float            = Field(0.0, ge=0,   le=400,  description="Blast Furnace Slag (kg/m³)")
    fly_ash: float         = Field(0.0, ge=0,   le=220,  description="Fly Ash (kg/m³)")
    water: float           = Field(..., ge=100, le=280,  description="Water (kg/m³)")
    superplasticizer: float= Field(0.0, ge=0,   le=35,   description="Superplasticizer (kg/m³)")
    coarse_aggregate: float= Field(..., ge=700, le=1200, description="Coarse Aggregate (kg/m³)")
    fine_aggregate: float  = Field(..., ge=500, le=1000, description="Fine Aggregate (kg/m³)")
    age: int               = Field(..., ge=1,   le=365,  description="Curing age (days)")

    @model_validator(mode="after")
    def check_binder(self):
        total_binder = self.cement + self.slag + self.fly_ash
        if total_binder < 100:
            raise ValueError("Total binder (cement + slag + fly ash) must be at least 100 kg/m³")
        wc_eq = equivalent_wc(self.water, self.cement, self.slag, self.fly_ash)
        if wc_eq < 0.20 or wc_eq > 0.90:
            raise ValueError(f"Equivalent w/c ratio {wc_eq:.2f} is outside practical range 0.20–0.90")
        return self


class PredictResponse(BaseModel):
    predicted_strength: float
    strength_class: str
    water_cement_ratio: float          # simple w/c
    equivalent_water_binder_ratio: float  # NS-EN 206 w/(c + k·slag + k·fly_ash)
    confidence_interval: dict
    ns_en_note: str


class OptimizeRequest(BaseModel):
    target_strength: float  = Field(..., ge=10, le=120)
    exposure_class: Optional[str] = None
    max_cement: Optional[float]   = Field(None, ge=100, le=600)
    use_slag: bool                = Field(True,  description="Allow slag in the mix")
    use_fly_ash: bool             = Field(True,  description="Allow fly ash in the mix")
    min_wc: Optional[float]       = Field(0.30, ge=0.20, le=0.80)
    max_wc: Optional[float]       = Field(0.65, ge=0.20, le=0.80)
    age: int                      = Field(28, ge=1, le=365)


class MixResult(BaseModel):
    cement: float
    slag: float
    fly_ash: float
    water: float
    superplasticizer: float
    coarse_aggregate: float
    fine_aggregate: float


class OptimizeResponse(BaseModel):
    mix: MixResult
    predicted_strength: float
    strength_class: str
    water_cement_ratio: float
    equivalent_water_binder_ratio: float
    exposure_compliance: Optional[dict]
    ns_en_note: str


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AI Concrete Mix Design API",
    description="Concrete mix design predictor and optimizer per NS-EN 206. "
                "Model trained on UCI Concrete Compressive Strength dataset (Yeh, 1998).",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _check_model():
    if MODEL is None:
        raise HTTPException(status_code=503, detail="ML model not loaded. Run `python ml/train.py` first.")


def _get_mae() -> float:
    if METRICS_PATH.exists():
        with open(METRICS_PATH) as f:
            return json.load(f).get("test_mae", 2.0)
    return 2.0


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": MODEL is not None}


@app.get("/standards")
def get_standards():
    metrics = {}
    if METRICS_PATH.exists():
        with open(METRICS_PATH) as f:
            metrics = json.load(f)
    return {
        "exposure_classes": NS_EN_206_EXPOSURE,
        "strength_classes": NS_EN_STRENGTH_CLASSES,
        "model_metrics": metrics,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    _check_model()

    row = np.array([[
        req.cement, req.slag, req.fly_ash, req.water,
        req.superplasticizer, req.coarse_aggregate, req.fine_aggregate, req.age,
    ]])
    pred = float(MODEL.predict(row)[0])

    mae = _get_mae()
    wc = req.water / req.cement
    wc_eq = equivalent_wc(req.water, req.cement, req.slag, req.fly_ash)
    cls = classify_strength(pred)

    notes = [f"Prediction based on UCI dataset model (NS-EN 206)."]
    if req.slag > 0:
        notes.append(f"Slag {req.slag} kg/m³ (k={K_SLAG}, NS-EN 206 §5.2.5).")
    if req.fly_ash > 0:
        notes.append(f"Fly ash {req.fly_ash} kg/m³ (k={K_FLY_ASH}, NS-EN 206 §5.2.5).")
    if wc_eq > 0.60:
        notes.append(f"Warning: equivalent w/c {wc_eq:.2f} exceeds 0.60 — check durability class.")
    if req.age < 28:
        notes.append(f"Note: result at {req.age}d. Standard NS-EN test is 28 days.")

    return PredictResponse(
        predicted_strength=round(pred, 1),
        strength_class=cls,
        water_cement_ratio=round(wc, 3),
        equivalent_water_binder_ratio=round(wc_eq, 3),
        confidence_interval={"lower": round(pred - mae, 1), "upper": round(pred + mae, 1)},
        ns_en_note=" ".join(notes),
    )


@app.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    _check_model()

    # Defaults
    min_wc = req.min_wc or 0.30
    max_wc = req.max_wc or 0.65
    max_cement = req.max_cement or 550.0
    min_cement = 150.0

    exposure_note = None
    if req.exposure_class:
        key = req.exposure_class.upper()
        if key not in NS_EN_206_EXPOSURE:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown exposure class '{req.exposure_class}'. Valid: {list(NS_EN_206_EXPOSURE.keys())}",
            )
        exp = NS_EN_206_EXPOSURE[key]
        max_wc = min(max_wc, exp["max_wc"])
        min_cement = exp["min_cement"]
        exposure_note = {
            "class": key,
            "description": exp["description"],
            "applied_max_wc": max_wc,
            "applied_min_cement": min_cement,
            "required_min_strength_class": exp["min_strength_class"],
        }

    rng = np.random.default_rng(seed=0)
    N = 6000

    cement_arr = rng.uniform(min_cement, max_cement, N)

    # Slag: 0–360 (UCI range), zero if disabled
    slag_arr   = rng.uniform(0, 360, N) if req.use_slag    else np.zeros(N)
    fly_arr    = rng.uniform(0, 200, N) if req.use_fly_ash else np.zeros(N)

    # Draw w/c_eq, then back-calculate water from effective binder
    wc_eq_arr = rng.uniform(min_wc, max_wc, N)
    binder_arr = cement_arr + K_SLAG * slag_arr + K_FLY_ASH * fly_arr
    water_arr  = np.clip(wc_eq_arr * binder_arr, 120, 250)

    # Recompute actual w/c_eq after clipping
    wc_actual = water_arr / binder_arr
    valid = (wc_actual >= min_wc - 0.01) & (wc_actual <= max_wc + 0.01)

    if valid.sum() == 0:
        raise HTTPException(status_code=400, detail="No valid candidates after applying constraints.")

    c_v  = cement_arr[valid]
    sl_v = slag_arr[valid]
    fa_v = fly_arr[valid]
    w_v  = water_arr[valid]
    sp_v = rng.uniform(0, 20, valid.sum())
    ca_v = rng.uniform(800, 1150, valid.sum())
    fi_v = rng.uniform(620, 950, valid.sum())

    X = np.column_stack([c_v, sl_v, fa_v, w_v, sp_v, ca_v, fi_v, np.full(len(c_v), req.age)])
    preds = MODEL.predict(X)

    errors = np.abs(preds - req.target_strength)
    idx = int(np.argmin(errors))

    best_pred = float(preds[idx])
    best_wc   = round(float(w_v[idx]) / float(c_v[idx]), 3)
    best_wc_eq = round(float(w_v[idx]) / float(c_v[idx] + K_SLAG * sl_v[idx] + K_FLY_ASH * fa_v[idx]), 3)
    cls = classify_strength(best_pred)

    note = (
        f"Optimised for {req.target_strength} MPa at {req.age} days. "
        f"Predicted {best_pred:.1f} MPa (Δ = {abs(best_pred - req.target_strength):.1f} MPa). "
        f"w/c = {best_wc:.2f}, equivalent w/b = {best_wc_eq:.2f}."
    )
    if req.exposure_class:
        note += f" Constraints applied per NS-EN 206 class {req.exposure_class.upper()}."

    return OptimizeResponse(
        mix=MixResult(
            cement=round(float(c_v[idx]), 1),
            slag=round(float(sl_v[idx]), 1),
            fly_ash=round(float(fa_v[idx]), 1),
            water=round(float(w_v[idx]), 1),
            superplasticizer=round(float(sp_v[idx]), 2),
            coarse_aggregate=round(float(ca_v[idx]), 1),
            fine_aggregate=round(float(fi_v[idx]), 1),
        ),
        predicted_strength=round(best_pred, 1),
        strength_class=cls,
        water_cement_ratio=best_wc,
        equivalent_water_binder_ratio=best_wc_eq,
        exposure_compliance=exposure_note,
        ns_en_note=note,
    )
