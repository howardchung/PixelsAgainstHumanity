Pixels Against Humanity
====
An implementation of Cards Against Humanity in Node.js for online multiplayer.

Usage
====
* Development
  * Create `.env` file with the `REACT_APP_SERVER_HOST` environment variable for the WebSocket server, e.g. `REACT_APP_SERVER_HOST=ws://localhost:8081`
  * Start the UI on an open port: `PORT=8080 npm start`
  * Start the WebSocket server on the port you picked earlier for the server: `PORT=8081 npm run dev`
* Production
  * Build the UI and then start the server (which serves the built UI): `npm run build && npm run server`
