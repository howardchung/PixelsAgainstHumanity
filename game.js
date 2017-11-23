const async = require('async');
const cards = require('./data/cards.json');
//user enters a name to join the game
//start game when capacity is reached
//TODO implement multiple games
//TODO allow spectating
//TODO shareable urls

function newGame(wss) {
  // TODO support deck selection
  const deck = cards["Base"];
  const black = deck.black.map(index => cards.blackCards[index]);
  const white = deck.white.map(index => cards.whiteCards[index]);
  const players = [];
  let tempWhites = {};
  const board = {
    black: {},
    whites: {},
    czar: -1,
    turn: 0,
    black_remaining: null,
    white_remaining: null,
    selected: false
  };
  shuffle(black);
  shuffle(white);
  wss.on('connection', function(socket) {
    socket.on('message', function incoming(data) {
      const message = JSON.parse(data);
      if (message.type === 'disconnect') {
        players.splice(players.indexOf(socket), 1);
        console.log("%s left", socket.id);
        //TODO handle player leaving game
        updateRoster();
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
          setTimeout(runTurn, 1000);
        }
      }
      else if (message.type === 'join') {
        //player joining the game
        socket.name = String(message.name);
        socket.score = 0;
        socket.hand = [];
        players.push(socket);
        updateRoster();
        if (board.czar === -1 && players >= 2) {
          runTurn();
          updateRoster();
        }
      }
    });
  });

  function runTurn() {
    //TODO scramble indices to hide player identities
    //restore cards to hands
    replenish();
    //TODO check for out of cards (end game)
    //clear temp
    tempWhites = {};
    board = Object.assign({}, board, { 
      selected: false, 
      whites: {}, 
      black: black.pop(),
      //czar becomes next player
      czar: (board.czar + 1) % players.length,
      //increment turn number
      turn: board.turn + 1,
      //count number of cards remaining in play
      black_remaining: black.length,
      white_remaining: white.length,
    });
    players.forEach(function(p, i) {
      if (i === board.czar) {
        p.status = "czar";
      }
      else {
        p.status = "waiting";
      }
      p.winner = false;
    });
  }

  function updateRoster() {
    //iterate through each connected client and get their name, then broadcast the roster to everyone
    async.map(players, function(p, cb) {
      //notify each player of their hand
      // console.log(p.hand);
      p.send(JSON.stringify({type: 'hand', data: JSON.stringify(p.hand)}));
      cb(null, {
        name: p.name,
        score: p.score,
        status: p.status,
        winner: p.winner,
      });
    }, function(err, names) {
      if (err) {
        console.error(err);
      }
      //notify every player of roster/board state
      wss.broadcast('roster', names);
      wss.broadcast('board', board);
    });
  }

  function checkReady() {
    for (var i = 0; i < players.length; i++) {
      if (players[i].status !== 'ready' && players[i].status !== 'czar') {
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
      // console.log(p.hand);
    });
  }

}

function shuffle(o) {
  for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}

module.exports = {
  newGame,
};
