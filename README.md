Pixels Versus Society
====
An implementation of Cards Against Humanity in Node.js for online multiplayer.

Usage
====
* Development
  * Create `.env.` file with the `REACT_APP_SERVER_HOST` environment variable, e.g. `REACT_APP_SERVER_HOST=localhost:8081`
  * Start the UI: `npm start`
  * Start the server on the port you picked earlier: `PORT=8081 npm run dev`
* Production
  * Build the UI and then start the server (which serves the built UI): `npm run build && npm run server`