var path = require('path');
var async = require('async');
var express = require('express');
var cards = require('./cards.json');
var app = express();
var server = app.listen(process.env.PORT || 5000, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('[WEB] listening at http://%s:%s', host, port);
});
var io = require('socket.io')(server);
app.use(express.static(path.resolve(__dirname, 'public')));
var black = cards.filter(function(c) {
  return c.cardType === "Q"
});
var white = cards.filter(function(c) {
  return c.cardType === "A"
});
var messages = [];
var players = [];
var board = {
  black: null,
  czar: null,
  turn: 0
};

//GAME START
//shuffle decks
//server deals hand to all players
//EACH TURN
//server draws top black card
//each turn, keep track of whether player has moved
//each player has a hand, score
//game state
//server manages deck, hand state of all players
//server will inform players of their hand state+board state
//server replenishes player hands

//io.emit broadcasts to all clients
//socket.emit messages only the particular socket
io.on('connection', function(socket) {
  //new player joined
  players.push(socket);
  console.log(socket.id);
  updatePlayers();
  //set up handler for player disconnect
  socket.on('disconnect', function() {
    players.splice(players.indexOf(socket), 1);
    updatePlayers();
  });
  socket.on('message', function(msg) {
    //message/event passed from a player
    var text = String(msg || '');
    if (!text) return;
    var data = {
      name: socket.name,
      text: text
    };
    io.emit('message', data);
    messages.push(data);
  });
  socket.on('name', function(name) {
    //player changing name
    socket.name = String(name);
    updatePlayers();
  });
});

function updatePlayers() {
  //iterate through each connected client and get their name, then broadcast the roster to everyone
  async.map(players, function(socket, callback) {
    callback(null, socket.name);
  }, function(err, names) {
    if (err) {
      console.log(err);
    }
    io.emit('roster', names);
  });
}