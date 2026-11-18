# AI-Assisted Architecture Planning System – Web App

React web app for the AI-Assisted Architecture Planning System for Jaffna District.
The user picks a plot on a map, enters land details, and gets a feasibility result, a floor plan blueprint, and a plain-language explanation.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Features

- Pick the plot location with a drag-map (fixed centre pin)
- Address lookup with Nominatim / OpenStreetMap
- Land details form (land size, road frontage, land shape, layout mode: same / almost / custom)
- Corner plot support (second road side and type)
- Results page with:
  - Feasibility, design type, and structure type
  - UDA zone details and rule warnings
  - "Try this" suggestions when a rule blocks the plan
  - Generated floor plan blueprint
  - English explanation written by Gemini
- Blueprint edit box (room counts, room size, square rooms, extra doors, new arrangement)
- Regenerate button and previous blueprint button
- PDF report download
- Location history saved in the browser (localStorage)

## Project Structure

```
ai-architecture-web/
├── public/
└── src/
    ├── components/
    │   ├── BlueprintSection.jsx
    │   └── MapPicker.jsx
    ├── pages/
    │   ├── Home.jsx
    │   ├── LandDetailsForm.jsx
    │   └── ResultsPage.jsx
    ├── services/
    │   ├── api.js          # calls the backend (/predict, /edit-blueprint, /download-pdf)
    │   └── nominatim.js    # address lookup (OpenStreetMap, 1 request/sec, cached)
    ├── App.js
    ├── App.css
    └── index.js
```

## Requirements

- Node.js (LTS version)
- npm
- The backend must be running (see the `backend` folder README)

## Getting Started

1. Open a terminal in the `ai-architecture-web` folder.
2. Install packages:
   ```
   npm install
   ```
3. Start the backend first (see the backend README).
4. Start the web app:
   ```
   npm start
   ```
5. Open http://localhost:3000 in your browser.

## Available Scripts

### `npm start`

Runs the app in development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page reloads when you make changes.\
You may also see lint errors in the console.

### `npm test`

Launches the test runner in interactive watch mode.\
See [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production into the `build` folder.\
It bundles React in production mode and optimizes the build for best performance.

The build is minified and the filenames include the hashes.\
See [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

This removes the single build dependency and copies all config files (webpack, Babel, ESLint, etc.) into your project. You do not need to use it.

## Notes

- The model and zone map only cover **Jaffna District**. A location outside Jaffna returns a "no zone polygon" error.
- Nominatim is limited to 1 request per second. The app already throttles requests and caches results.

## Known Issues / To Do

- Address sometimes shows as "Fetching address..." when the location is confirmed
- Friendlier message for locations outside Jaffna
- Road width layers (Nominatim / Overpass)
- Custom door adding after the blueprint is shown
- Mobile app (React Native Expo) not started yet

## Learn More

- [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [React documentation](https://reactjs.org/)