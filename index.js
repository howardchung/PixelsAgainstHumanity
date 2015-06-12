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
var deck = cards["Base"];
var black = deck.black.map(function(c) {
  return cards.blackCards[c];
});
var white = deck.white.map(function(c) {
  return cards.whiteCards[c];
});
//TODO implement multiple rooms
var players = [];
//published state
var board = {
  black: null,
  whites: [],
  czar: -1,
  turn: 0,
  black_remaining: null,
  white_remaining: null
};
shuffle(black);
shuffle(white);
io.on('connection', function(socket) {
  //new player joined
  console.log("%s joined", socket.id);
  socket.score = 0;
  socket.hand = [];
  players.push(socket);
  updateRoster();
  //set up handler for player disconnect
  socket.on('disconnect', function() {
    players.splice(players.indexOf(socket), 1);
    console.log("%s left", socket.id);
    updateRoster();
  });
  socket.on('start', function() {
    //TODO disable start after game already started
    replenish();
    runTurn();
  });
  socket.on('play', function(msg) {
    //index of card in hand played
    //notify all players that this player moved
    //each turn, keep track of how many players still need to move
    //WHEN ALL PLAYERS MOVED
    //emit event to all players
    //reveal all played cards
    //czar selects winner
    //TODO implement
  });
  socket.on('select', function(msg) {
    //ensure the select comes from the current czar
    //czar selects a winning card
    //reveal winner, increment score
    //start the next turn
    //TODO implement
  });
  socket.on('name', function(name) {
    //player changing name
    socket.name = String(name);
    updateRoster();
  });
});

function runTurn() {
  //restore cards to hands
  replenish();
  //server draws top black card
  board.black = black.pop();
  //czar becomes next player
  board.czar = (board.czar + 1) % players.length;
  //increment turn number
  board.turn += 1;
  //count number of cards remaining in play
  board.black_remaining = black.length;
  board.white_remaining = white.length;
  //notify players of board state
  io.emit('board', board);
  //notify players of player list/hand
  updateRoster();
}

function updateRoster() {
  //iterate through each connected client and get their name, then broadcast the roster to everyone
  async.map(players, function(p, cb) {
    //notify each player of their hand
    console.log(p.hand);
    p.emit('hand', p.hand);
    cb(null, {
      name: p.name,
      score: p.score
    });
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