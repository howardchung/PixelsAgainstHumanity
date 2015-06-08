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
//TODO implement multiple rooms
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
shuffle(black);
shuffle(white);
//
//EACH TURN
//restore cards to hands
replenish();
//server draws top black card
board.black = black.pop();
//czar becomes next player
//increment turn number
//count number of cards remaining in play
//notify players of board state
io.emit('board', board);
//notify players of player list/board state
updateRoster();
//each turn, keep track of whether each player has moved
//ALL PLAYERS MOVED
//emit event to all players
//reveal all played cards
//czar selects winner
//loop next turn
//
//io.emit broadcasts to all clients
//socket.emit messages only the particular socket
io.on('connection', function(socket) {
  //new player joined
  console.log("%s joined", socket.id);
  socket.score = 0;
  socket.hand = [];
  players.push(socket);
  replenish();
  updateRoster();
  //set up handler for player disconnect
  socket.on('disconnect', function() {
    players.splice(players.indexOf(socket), 1);
    console.log("%s left", socket.id);
    updateRoster();
  });
  socket.on('play', function(msg) {
    //message/event passed from a player
    //index of card in hand played
    //notify all players that this player moved
    //TODO implement
  });
  socket.on('select', function(msg) {
    //ensure the select comes from the current czar
    //czar selects a winning card
  });
  socket.on('name', function(name) {
    //player changing name
    socket.name = String(name);
    updateRoster();
  });
});

function updateRoster() {
  //iterate through each connected client and get their name, then broadcast the roster to everyone
  async.map(players, function(p, cb) {
    //notify each player of their hand
    console.log(p.hand);
    p.emit('hand', p.hand);
    cb(null, p.name);
  }, function(err, names) {
    if (err) {
      console.log(err);
    }
    //notify everyone of current players list
    io.emit('roster', names);
  });
}

function replenish() {
  //server deals hand to all players from white
  players.forEach(function(p) {
    var hand_max = 10;
    while (p.hand.length < hand_max) {
      p.hand.push(white.pop());
    }
    console.log(p.hand);
  });
}

function shuffle(o) {
  for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}