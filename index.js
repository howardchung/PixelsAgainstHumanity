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
//private server state
var black = cards.filter(function(c) {
  return c.cardType === "Q";
});
var white = cards.filter(function(c) {
  return c.cardType === "A";
});
var messages = [];
var players = [];
//published state
var board = {
  black: null,
  czar: null,
  turn: 0,
  black_remaining: null,
  white_remaining: null
};
//GAME START
//shuffle decks
function shuffle(o) {
  for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}
shuffle(black);
shuffle(white);

function replenish() {
    //server deals hand to all players from white
    players.forEach(function(p) {
      var hand_max = 10;
      while (p.hand.length < hand_max) {
        p.hand.push(white.pop());
      }
    });
  }
  //EACH TURN
  //server draws top black card
board.black = black.pop();
//each turn, keep track of whether each player has moved
//each player has a hand, score
//game state
//server manages deck, hand state of all players
//server will inform players of their hand state+board state
//server replenishes player hands
//io.emit broadcasts to all clients
//socket.emit messages only the particular socket
io.on('connection', function(socket) {
  //new player joined
  console.log(socket.id);
  socket.score = 0;
  socket.hand = [];
  players.push(socket);
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