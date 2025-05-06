from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import pickle
import math
import os
from typing import List, Union
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, specify your frontend URL(s) instead of "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Helper Functions ===

def convert_to_seconds(time_str: str) -> float:
    try:
        if not any(c.isdigit() for c in time_str):
            raise ValueError("Invalid input: Only numbers, colons, and periods are allowed. Please do not use words or letters.")
        if ":" not in time_str and "." not in time_str:
            return float(time_str)
        if ":" in time_str:
            parts = time_str.split(":")
            if len(parts) == 2:
                minutes = int(parts[0])
                if len(parts[1]) < 2:
                    parts[1] += "0"
                seconds = float(parts[1])
                return minutes * 60 + seconds
            elif len(parts) > 2:
                raise ValueError("Too many colons.")
        if "." in time_str:
            parts = time_str.split(".")
            if len(parts) == 2:
                if len(parts[0]) == 1:
                    minutes = int(parts[0])
                else:
                    return float(time_str)
                if len(parts[1]) < 2:
                    parts[1] += "0"
                seconds = int(parts[1])
                return minutes * 60 + seconds
            elif len(parts) == 3:
                minutes = int(parts[0])
                seconds = int(parts[1])
                fractional_seconds = float("0." + parts[2])
                return minutes * 60 + seconds + fractional_seconds
            else:
                raise ValueError("Too many dots.")
        raise ValueError("Could not parse input.")
    except ValueError:
        raise ValueError("Invalid input: Only numbers, colons, and periods are allowed. Please do not use words or letters.")

def seconds_to_minutes(seconds: float) -> str:
    minutes = int(seconds // 60)
    remaining_seconds = seconds % 60
    if minutes == 0:
        return f"{remaining_seconds:05.2f}"
    else:
        return f"{minutes}:{remaining_seconds:05.2f}"

def predict_800m(model, feature_cols, input_values):
    processed = []
    for val in input_values:
        if isinstance(val, list):
            avg = sum(convert_to_seconds(x) for x in val) / len(val)
            processed.append(avg)
        else:
            processed.append(convert_to_seconds(val))
    X = pd.DataFrame([processed], columns=feature_cols)
    prediction = model.predict(X)[0]
    # Out-of-range handling
    if prediction < 96:
        raise ValueError("Predicted time is too fast to be realistic (less than 1:36). Please check your inputs.")
    if prediction > 240:
        raise ValueError("Predicted time is too slow (over 4:00). Please check your inputs.")
    return {
        "predicted_seconds": float(prediction),
        "predicted_formatted": seconds_to_minutes(prediction)
    }

def reverse_predict(df, target_col, goal_time, interval_cols, rounding=None):
    val = convert_to_seconds(goal_time)
    upper = math.ceil(val)
    frac, lower = math.modf(val)
    upper_row = df[df[target_col] == upper]
    lower_row = df[df[target_col] == lower]
    if upper_row.empty or lower_row.empty:
        raise ValueError("Goal time is out of range.")
    if rounding is None:
        rounding = [0.5] * len(interval_cols)
    elif isinstance(rounding, (float, int)):
        rounding = [rounding] * len(interval_cols)
    splits = []
    for idx, col in enumerate(interval_cols):
        interp = (
            upper_row[col].values[0] * frac +
            lower_row[col].values[0] * (1 - frac)
        )
        rounded = round(interp / rounding[idx]) * rounding[idx]
        splits.append({
            "interval": col,
            "seconds": float(rounded),
            "formatted": seconds_to_minutes(rounded),
        })
    return splits

# === Paths ===

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
TABLES_DIR = os.path.join(BASE_DIR, "tables")

# === Training Configurations ===

TRAINING_CONFIG = {
    "600m_x3": {
        "model_file": os.path.join(MODELS_DIR, "model_600.pkl"),
        "feature_cols": ["First 600m", "Second 600m", "Third 600m"],
        "table_file": os.path.join(TABLES_DIR, "600.csv"),
        "interval_cols": ["First 600m", "Second 600m", "Third 600m"]
    },
    "600m_400m_x3": {
        "model_file": os.path.join(MODELS_DIR, "model_600_400.pkl"),
        "feature_cols": ["600m", "3x400m average"],
        "table_file": os.path.join(TABLES_DIR, "600_400.csv"),
        "interval_cols": ["600m", "3x400m average"]
    },
    "600m_300m_x4": {
        "model_file": os.path.join(MODELS_DIR, "model_600_300.pkl"),
        "feature_cols": ["600m", "4x300m average"],
        "table_file": os.path.join(TABLES_DIR, "600_300.csv"),
        "interval_cols": ["600m", "4x300m average"]
    },
    "500m_x3": {
        "model_file": os.path.join(MODELS_DIR, "model_500.pkl"),
        "feature_cols": ["First 500m", "Second 500m", "Third 500m"],
        "table_file": os.path.join(TABLES_DIR, "500.csv"),
        "interval_cols": ["First 500m", "Second 500m", "Third 500m"]
    },
    "300m_x3x2": {
        "model_file": os.path.join(MODELS_DIR, "model_300.pkl"),
        "feature_cols": ["Set 1 3x300m average", "Set 2 3x300m average"],
        "table_file": os.path.join(TABLES_DIR, "300.csv"),
        "interval_cols": ["Set 1 3x300m average", "Set 2 3x300m average"]
    }
}

# === Load Models and Tables at Startup ===

MODELS = {}
TABLES = {}

for key, cfg in TRAINING_CONFIG.items():
    # Load model
    with open(cfg["model_file"], "rb") as f:
        MODELS[key] = pickle.load(f)
    # Load table
    TABLES[key] = pd.read_csv(cfg["table_file"])

# === Request Models ===

class PredictRequest(BaseModel):
    training_type: str
    input_values: List[Union[str, List[str]]]

class ReversePredictRequest(BaseModel):
    training_type: str
    goal_time: str

# === API Endpoints ===

@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"message": "800m Calculator API is up."}

@app.get("/get-training-types")
def get_training_types():
    return [
        {
            "key": k,
            "features": v["feature_cols"],
            "intervals": v["interval_cols"]
        }
        for k, v in TRAINING_CONFIG.items()
    ]

@app.post("/predict")
def predict_endpoint(req: PredictRequest):
    try:
        config = TRAINING_CONFIG[req.training_type]
        model = MODELS[req.training_type]
        result = predict_800m(model, config["feature_cols"], req.input_values)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/reverse-predict")
def reverse_predict_endpoint(req: ReversePredictRequest):
    try:
        config = TRAINING_CONFIG[req.training_type]
        df = TABLES[req.training_type]
        result = reverse_predict(df, "TARGET", req.goal_time, config["interval_cols"])
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
