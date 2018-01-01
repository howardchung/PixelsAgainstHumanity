const path = require('path');
const express = require('express');
const app = express();
const WebSocket = require('ws');
const http = require('http');
const uuidv1 = require('uuid/v1');
const Moniker = require('moniker');
const names = Moniker.generator([Moniker.adjective, Moniker.noun, Moniker.verb]);
const Game = require('./game');

app.use(express.static('build'));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = new Map();
// keys are room ids
// values are objects with game instances

// Send to one connected client
wss.send = function send(socket, data) {
  if (socket.readyState === WebSocket.OPEN) {
    console.log('[SENT]', `[id: ${socket.id}]`, data);
    socket.send(data);
  }
};

// Send to all connected clients
wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    wss.send(client, data);
  });
};

// Handle disconnected clients
function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', function connection(ws) {
  if (ws.isAlive === false) {
    return ws.terminate();
  }
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  ws.on('message', message => {
    try {
      console.log('[RECV]', `[id: ${ws.id}]`, message);
      const json = JSON.parse(message);
      const existingRoom = json.room && rooms.get(json.room); 
      if (json.type === 'join') {
        ws.name = String(json.name);
        if (existingRoom) {
          console.log('joining game room %s', json.room);
          // Join an existing room
          existingRoom.join(ws);
        }
        else {
          // Create a new game room and join it
          let gameId;
          while (!gameId || rooms.get(gameId)) {
            gameId = json.room || names.choose();
          }
          console.log('creating new game room %s', gameId);
          rooms.set(gameId, new Game(wss, gameId, json.gameType));
          rooms.get(gameId).join(ws);
          // Clean up this room after 6 hours
          setTimeout(() => rooms.delete(gameId), 1000 * 60 * 60 * 6);
        }
      } else if (existingRoom && json.type === 'play') {
        existingRoom.handlePlay(ws, json);
      } else if (existingRoom && json.type === 'advance') {
        existingRoom.handleAdvance(ws, json);
      } else if (existingRoom && json.type === 'select') {
        existingRoom.handleSelect(ws, json);
      }
    }
    catch (e) {
      console.error(e);
    }
  });
});

setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    ws.isAlive = false;
    ws.ping('', false, true);
  });
}, 10000);

server.listen(process.env.PORT || 3002, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('[WEB] listening at http://%s:%s', host, port);
});
