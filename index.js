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
//TODO implement multiple rooms
//TODO support deck selection
var deck = cards["Base"];
var black = deck.black.map(function(c) {
  return cards.blackCards[c];
});
var white = deck.white.map(function(c) {
  return cards.whiteCards[c];
});
var players = [];
//published state
var board = {
  black: {},
  whites: {},
  czar: -1,
  turn: 0,
  black_remaining: null,
  white_remaining: null,
  selected: false
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
    //TODO new game function
    //TODO only allow czar to advance turn?
    runTurn();
  });
  socket.on('play', function(index) {
    var whites = tempWhites;
    var playerIndex = players.indexOf(socket);
    //ensure the player has cards left to play and is not czar
    if ((!whites[playerIndex] || whites[playerIndex].length < board.black.pick) && socket.status !== "czar") {
      index = Number(index);
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
    }
  });
  socket.on('select', function(index) {
    index = Number(index);
    //TODO use scrambled indices
    //check that there hasn't been a winner selected this turn
    //make sure this player is czar
    if (socket.status === "czar" && !board.selected) {
      players[index].score += 1;
      players[index].winner = true;
      //reveal winner, increment score
      //remove all from board except winner
      board.whites = [board.whites[index]];
      board.selected = true;
      updateRoster();
    }
  });
  socket.on('name', function(name) {
    //player changing name
    socket.name = String(name);
    updateRoster();
  });
  //TODO allow players to join as spectators
  //TODO handle czar leaving game
  //TODO handle player leaving game
});

function runTurn() {
  //TODO scramble indices to hide player identities
  //restore cards to hands
  replenish();
  //TODO check for out of cards (end game)
  //clear temp
  tempWhites = {};
  board.selected = false;
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
