# 800m-calculator Backend

This is the **backend API** for the 800m-calculator project. It predicts 800m race and training times using results from specific workouts or races.

## Features

- Predict 800m performance from various types of workout results
- Calculate recommended split times for workouts based on a goal time
- REST API built with FastAPI
- Ready to connect to a frontend or use programmatically

## Endpoints

### `GET /`
Returns API status message.

### `GET /get-training-types`
Lists supported training types and required input formats.

### `POST /predict`
Predicts an 800m time from training or race inputs.

**Request example:**
```json
{
  "training_type": "600m_x3",
  "input_values": ["1:32.5", "1:33.0", "1:34.2"]
}
```

### `POST /reverse-predict`
Calculates recommended splits for a workout based on a goal 800m time.

**Request example:**
```json
{
  "training_type": "600m_x3",
  "goal_time": "2:05.0"
}
```

## Setup

1. **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

2. **Run the API:**
    ```bash
    uvicorn main:app --reload
    ```

3. **Models and tables:**  
   Place the trained model `.pkl` files in the `models/` folder and the CSV tables in the `tables/` folder.

## Notes

- CORS is enabled for all origins by default (for development).  
  For production, set `allow_origins` in `main.py` to your frontend’s URL.
- Requires Python 3.8+