const path = require('path');
const express = require('express');
const app = express();
const WebSocket = require('ws');
const http = require('http');
const game = require('./game');

app.use(express.static(path.resolve(__dirname, 'build')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.send = function send(socket, data) {
  if (socket.readyState === WebSocket.OPEN) {
    console.log('[SENT]', `[id: ${socket.id}]`, data);
    socket.send(data);
  }
};

wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    wss.send(client, data);
  });
};

server.listen(process.env.PORT || 3002, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('[WEB] listening at http://%s:%s', host, port);
});

game.newGame(wss);
