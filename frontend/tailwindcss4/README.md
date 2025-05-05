# 800m-calculator Frontend

This is the **frontend** for the 800m-calculator project. It provides an interface for predicting 800m race times based on training results and for calculating recommended splits for a target 800m time.

## Features

- Select from several supported training types
- Predict your 800m time by entering workout results
- Get recommended workout splits based on a goal 800m race time
- Clean, responsive interface built with React and Tailwind CSS
- Connects to the backend FastAPI service

## Getting Started

1. **Install dependencies:**
    ```bash
    npm install
    ```

2. **Start the development server:**
    ```bash
    npm start
    ```

    The app will be available at [https://seanfontaine.dev/](https://seanfontaine.dev/) by default.

3. **Configure API endpoint (if needed):**
    - The backend API URL is set in `App.jsx` as the `API_URL` constant.
    - Update this value if your backend is running on a different URL.

## Project Structure

- `src/App.jsx` - Main React application
- `src/App.css` - Styles for the app
- Other files are standard Create React App files

## Notes

- Requires Node.js and npm.
- Make sure your backend is running and accessible to the frontend.