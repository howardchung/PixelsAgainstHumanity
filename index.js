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
  black: {},
  whites: {},
  czar: -1,
  turn: 0,
  black_remaining: null,
  white_remaining: null
};
var tempWhites = {};
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
    //TODO czar clicks to advance to next turn
    runTurn();
  });
  socket.on('play', function(index) {
    //TODO ensure the player is not czar
    //TODO ensure the player has cards left to play
    index = Number(index);
    var whites = tempWhites;
    var playerIndex = players.indexOf(socket);
    //TODO use scrambled indices
    if (!whites[playerIndex]) {
      whites[playerIndex] = [];
    }
    whites[playerIndex].push(socket.hand[index]);
    //remove card from player's hand
    socket.hand.splice(index, 1);
    //if player has no cards left to play
    if (whites[playerIndex].length >= board.black.pick) {
      //notify all players that this player moved
      socket.status = "ready";
      //if all active players have moved
      if (checkReady()) {
        //reveal all played cards
        board.whites = tempWhites;
      }
    }
    updateRoster();
  });
  socket.on('select', function(index) {
    index = Number(index);
    var playerIndex = players.indexOf(socket);
    //check index of this socket matches czar index
    //TODO check that there hasn't been a winner selected this turn
    if (playerIndex === board.czar) {
      players[index].score += 1;
      players[index].winner = true;
      //reveal winner, increment score
      //remove all from board except winner
      board.whites = [board.whites[index]];
      updateRoster();
    }
  });
  socket.on('name', function(name) {
    //player changing name
    socket.name = String(name);
    updateRoster();
  });
  //TODO players join as spectators, clicking button adds them to active player list so they need to be waited for, deals them a hand
});

function runTurn() {
  //TODO scramble indices to hide player identities
  //TODO check for out of cards (end game)
  //restore cards to hands
  replenish();
  //clear board
  board.whites = {};
  //server draws top black card
  board.black = black.pop();
  //czar becomes next player
  board.czar = (board.czar + 1) % players.length;
  players.forEach(function(p, i) {
    if (i === board.czar) {
      p.status = "czar";
    }
    else {
      p.status = "waiting";
    }
    p.winner = false;
  });
  //increment turn number
  board.turn += 1;
  //count number of cards remaining in play
  board.black_remaining = black.length;
  board.white_remaining = white.length;
  //notify players of player list/hand/board
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
      score: p.score,
      status: p.status,
      winner: p.winner
    });
  }, function(err, names) {
    if (err) {
      console.log(err);
    }
    //notify every player of roster/board state
    io.emit('roster', names);
    io.emit('board', board);
  });
}

function checkReady() {
  for (var i = 0; i < players.length; i++) {
    if (players[i].status !== "ready" && players[i].status !== "czar") {
      return false;
    }
  }
  return true;
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
//TODO handle czar leaving game