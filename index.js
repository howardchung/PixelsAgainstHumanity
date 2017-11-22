var path = require('path');
var async = require('async');
var express = require('express');
var cards = require('./cards.json');
var app = express();
const WebSocket = require('ws');
const http = require('http');

app.use(express.static(path.resolve(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

server.listen(process.env.PORT || 6000, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('[WEB] listening at http://%s:%s', host, port);
});
//user joins, gets list of rooms
//user can change name at any time
//user joins a room by default as spectator
//user clicks button to join game
//inside room, any player can start game
//new game automatically called on room creation
//TODO implement multiple rooms
//TODO allow spectating
var black;
var white;
var players = [];
var tempWhites;
var board;
newGame();
wss.on('connection', function(socket) {
  //new player joined
  console.log("%s joined", socket.id);
  socket.on('message', function incoming(data) {
    const message = JSON.parse(data);
    if (message.type === 'disconnect') {
      players.splice(players.indexOf(socket), 1);
      console.log("%s left", socket.id);
      //TODO handle czar leaving game
      //TODO handle player leaving game
      updateRoster();
    }
    else if (message.type === 'start') {
      //only allow czar to advance turn, unless starting new game?
      //or only allow creator to start new game
      if (socket.status === "czar" || board.czar === -1 || true) {
        runTurn();
        updateRoster();
      }
    }
    else if (message.type === 'play') {
      let index = message.index;
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
    }
    else if (message.type === 'select') {
      let index = message.index;
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
    }
    else if (message.type === 'name') {
      //player changing name
      socket.name = String(message.name);
      updateRoster();
    }
  });
  socket.score = 0;
  socket.hand = [];
  players.push(socket);
  updateRoster();
});

function newGame() {
  //TODO support deck selection
  var deck = cards["Base"];
  black = deck.black.map(function(c) {
    return cards.blackCards[c];
  });
  white = deck.white.map(function(c) {
    return cards.whiteCards[c];
  });
  shuffle(black);
  shuffle(white);
  //players = [];
  board = {
    black: {},
    whites: {},
    czar: -1,
    turn: 0,
    black_remaining: null,
    white_remaining: null,
    selected: false
  };
  tempWhites = {};
}

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
}

function updateRoster() {
  //iterate through each connected client and get their name, then broadcast the roster to everyone
  async.map(players, function(p, cb) {
    //notify each player of their hand
    console.log(p.hand);
    p.write('hand', JSON.stringify(p.hand));
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
    wss.broadcast('roster', names);
    wss.broadcast('board', board);
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
