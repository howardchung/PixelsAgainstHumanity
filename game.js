const async = require('async');
const cards = require('./data/cards.json');
// TODO implement multiple games
// TODO allow spectating
// TODO shareable urls
// TODO support deck selection
// TODO customizable room size

function newGame(wss) {
  const deck = cards["Base"];
  const black = deck.black.map(index => cards.blackCards[index]);
  const white = deck.white.map(index => cards.whiteCards[index]);
  const players = [];
  let board = {
    black: {},
    whites: [],
    whiteMappings: {},
    czar: -1,
    turn: 0,
    black_remaining: black.length,
    white_remaining: white.length,
    selected: false
  };
  shuffle(black);
  shuffle(white);
  wss.on('connection', function(socket) {
    socket.on('close', function() {
      players.splice(players.indexOf(socket), 1);
      updateRoster();
    });
    socket.on('message', function incoming(data) {
      const message = JSON.parse(data);
      if (message.type === 'play') {
        const cardIndex = message.data;
        const playerIndex = players.indexOf(socket);
        if (socket.status !== "czar") {
          let playerWhites = board.whites.find(w => w.playerIndex === playerIndex);
          if (!playerWhites) {
            playerWhites = { playerIndex, cards: [] };
            board.whites.push(playerWhites);
          }
          //ensure the player has cards left to play
          if (playerWhites.cards.length < board.black.pick) {
            playerWhites.cards.push(socket.hand[cardIndex]);
            //remove card from player's hand
            socket.hand.splice(cardIndex, 1);
            //if player has no cards left to play
            if (playerWhites.cards.length >= board.black.pick) {
              //notify all players that this player moved
              socket.status = 'played';
            }
            updateRoster();
          }
        }
      }
      else if (message.type === 'select') {
        const index = message.data;
        const mappedIndex = board.whiteMappings[index];
        const player = players[mappedIndex];
        const card = board.whites[index];
        //check that there hasn't been a winner selected this turn
        //make sure this player is czar
        if (socket.status === "czar" && checkAllPlayersReady() && !board.selected && player && card) {
          player.score += 1;
          player.winner = true;
          card.winner = true;
          board.selected = true;
          updateRoster();
          // TODO make this a button click to advance?
          setTimeout(runTurn, 1000);
        }
      }
      else if (message.type === 'join') {
        // TODO reject if there's already a player with this name in the room
        socket.name = String(message.name);
        socket.score = 0;
        socket.hand = [];
        players.push(socket);
        updateRoster();
        if (board.czar === -1 && players.length >= 3) {
          runTurn();
        }
      }
    });
  });

  function runTurn() {
    console.log('starting turn');
    // TODO check for out of cards (end game)
    // restore cards to hands
    replenish();
    board = {
      selected: false,
      black: black.pop(),
      whites: [],
      whiteMappings: {},
      //czar becomes next player
      czar: (board.czar + 1) % players.length,
      //increment turn number
      turn: board.turn + 1,
      //count number of cards remaining in play
      black_remaining: black.length,
      white_remaining: white.length,
    };
    players.forEach(function(p, i) {
      if (i === board.czar) {
        p.status = "czar";
      }
      else {
        p.status = "waiting";
      }
      p.winner = false;
    });
    updateRoster();
  }

  function updateRoster() {
    //iterate through each connected client and get their name, then broadcast the roster to everyone
    async.map(players, function(p, cb) {
      //notify each player of their hand
      p.send(JSON.stringify({ type: 'hand', data: p.hand }));
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
      wss.broadcast(JSON.stringify({ type: 'roster', data: names }));
      let newBoard = board;
      if (board.selected) {
        // Do nothing to the data
      }
      else if (checkAllPlayersReady()) {
        // Hide the identities, but show the cards so the czar can pick (scramble the cards)
        shuffle(board.whites);
        // Map the scrambled IDs to the player indexes so we can look up who won later
        board.whites.forEach((w, i) => {
          board.whiteMappings[i] = w.playerIndex;
        });
        const hiddenWhites = board.whites.map(w => ({ cards: w.cards }));
        newBoard = { ...board, whites: hiddenWhites };
      }
      else {
        // Hide the cards, but show the identities so we know who moved
        newBoard = { ...board, whites: board.whites.map(w => ({ playerIndex: w.playerIndex })) };
      }
      wss.broadcast(JSON.stringify({ type: 'board', data: newBoard }));
    });
  }

  function checkAllPlayersReady() {
    for (let i = 0; i < players.length; i++) {
      if (players[i].status !== 'played' && players[i].status !== 'czar') {
        return false;
      }
    }
    return true;
  }

  function replenish() {
    //server deals hand to all players from white deck
    players.forEach(function(p) {
      const hand_max = 10;
      while (p.hand.length < hand_max) {
        p.hand.push(white.pop());
      }
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
