# 800m-calculator

A web API to predict 800m race and training times from training or race results.

## Features

- Predicts 800m performance from various types of workout results
- Calculates recommended split times for workouts, based on a goal time
- REST API, ready to be connected to a frontend or used programmatically

## Endpoints

- `GET /`  
  API status message.

- `GET /get-training-types`  
  Lists supported training types and required input formats.

- `POST /predict`  
  Predicts an 800m time from training/race inputs.  
  **Request body:**  
  ```json
  {
    "training_type": "600m_x3", 
    "input_values": ["1:32.5", "1:33.0", "1:34.2"]
  }
