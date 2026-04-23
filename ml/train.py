"""
Train a Random Forest regressor on the UCI Concrete Compressive Strength dataset.
Uses all 8 input features including Blast Furnace Slag and Fly Ash.
Follows NS-EN 206 / Norwegian civil engineering practice.

Outputs:
  - concrete_model.pkl  (scikit-learn Pipeline: scaler + Random Forest)
  - metrics.json
"""

import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = [
    "cement",
    "slag",
    "fly_ash",
    "water",
    "superplasticizer",
    "coarse_aggregate",
    "fine_aggregate",
    "age",
]
TARGET = "compressive_strength"

UCI_PATH = Path(__file__).parent.parent / "uci_dataset" / "Concrete_Data.xls"
MODEL_PATH = Path(__file__).parent / "concrete_model.pkl"
METRICS_PATH = Path(__file__).parent / "metrics.json"


def load_data():
    df = pd.read_excel(UCI_PATH)

    # Rename verbose UCI columns to clean internal names
    df.columns = [
        "cement",
        "slag",
        "fly_ash",
        "water",
        "superplasticizer",
        "coarse_aggregate",
        "fine_aggregate",
        "age",
        "compressive_strength",
    ]

    print(f"Loaded {len(df)} rows from UCI dataset.")
    print(df[FEATURES + [TARGET]].describe().round(2))

    X = df[FEATURES].values
    y = df[TARGET].values
    return X, y


def build_pipeline():
    return Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "rf",
                RandomForestRegressor(
                    n_estimators=500,
                    max_depth=None,
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )


def main():
    print("Loading UCI dataset …")
    X, y = load_data()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )
    print(f"\nTrain size: {len(X_train)}  |  Test size: {len(X_test)}")

    pipeline = build_pipeline()

    print("Training Random Forest (n_estimators=500) …")
    pipeline.fit(X_train, y_train)

    # --- Evaluate -----------------------------------------------------------
    y_pred = pipeline.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    cv_scores = cross_val_score(
        pipeline, X_train, y_train, cv=5, scoring="neg_mean_absolute_error"
    )
    cv_mae = -cv_scores.mean()

    print(f"\n=== Evaluation (UCI dataset, NS-EN 206 context) ===")
    print(f"Test MAE  : {mae:.2f} MPa")
    print(f"Test R²   : {r2:.4f}")
    print(f"CV MAE    : {cv_mae:.2f} MPa  (5-fold on train set)")

    # Feature importance
    rf = pipeline.named_steps["rf"]
    importances = dict(zip(FEATURES, rf.feature_importances_.round(4)))
    print("\nFeature importances:")
    for feat, imp in sorted(importances.items(), key=lambda x: -x[1]):
        print(f"  {feat:<22} {imp:.4f}")

    # --- Persist ------------------------------------------------------------
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(pipeline, f)
    print(f"\nModel saved → {MODEL_PATH}")

    metrics = {
        "test_mae": round(mae, 4),
        "test_r2": round(r2, 4),
        "cv_mae": round(cv_mae, 4),
        "feature_importances": importances,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "features": FEATURES,
        "dataset": "UCI Concrete Compressive Strength (Yeh, 1998) — 1030 real lab measurements",
    }
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Metrics saved → {METRICS_PATH}")

    # --- Example predictions ------------------------------------------------
    print("\n=== Example predictions (NS-EN 206 strength classes) ===")
    examples = [
        # Pure cement, C25/30
        {"cement": 280, "slag": 0,   "fly_ash": 0,   "water": 180, "sp": 0.0, "ca": 970,  "fa": 780, "age": 28,  "label": "C25/30 — plain cement (XC1)"},
        # Slag mix, C35/45
        {"cement": 260, "slag": 100, "fly_ash": 0,   "water": 170, "sp": 5.0, "ca": 960,  "fa": 770, "age": 28,  "label": "C35/45 — slag mix (XC3)"},
        # Fly ash mix, C30/37
        {"cement": 280, "slag": 0,   "fly_ash": 80,  "water": 170, "sp": 4.0, "ca": 950,  "fa": 760, "age": 28,  "label": "C30/37 — fly ash mix (XF1)"},
        # High strength, C50/60
        {"cement": 450, "slag": 0,   "fly_ash": 0,   "water": 155, "sp": 12.0,"ca": 950,  "fa": 730, "age": 28,  "label": "C50/60 — high strength (XC4)"},
        # 7-day early strength
        {"cement": 380, "slag": 0,   "fly_ash": 0,   "water": 160, "sp": 6.0, "ca": 970,  "fa": 750, "age": 7,   "label": "Early strength at 7 days"},
        # Norwegian road bridge (XF4), 56 days
        {"cement": 400, "slag": 50,  "fly_ash": 0,   "water": 155, "sp": 8.0, "ca": 980,  "fa": 760, "age": 56,  "label": "Bridge deck (XF4) — 56 days"},
    ]
    for ex in examples:
        row = np.array([[ex["cement"], ex["slag"], ex["fly_ash"], ex["water"],
                         ex["sp"], ex["ca"], ex["fa"], ex["age"]]])
        pred = pipeline.predict(row)[0]
        binder = ex["cement"] + 0.9 * ex["slag"] + 0.4 * ex["fly_ash"]
        wc_eq = ex["water"] / binder if binder > 0 else 0
        print(f"  {ex['label']:<40}  → {pred:.1f} MPa  (w/c_eq={wc_eq:.2f})")


if __name__ == "__main__":
    main()
