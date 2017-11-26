const async = require('async');
const WebSocket = require('ws');
const cards = require('./data/cards.json');
// TODO implement multiple games
// TODO allow spectating
// TODO shareable urls to join rooms
// TODO support deck selection
// TODO handle disconnects, don't wait for DC'd players and don't pick them as judge
// TODO handle players connecting after game start (reject or deal them in?)
// TODO handle game end (track winners?)
// TODO track card stats
// TODO clean up finished games

function newGame(wss) {
  const deck = cards['Base'];
  const black = deck.black.map(index => cards.blackCards[index]);
  const white = deck.white.map(index => cards.whiteCards[index]);
  const players = [];
  let board = {
    black: {},
    whites: [],
    _whiteMappings: {},
    judge: -1,
    turn: 0,
    black_remaining: black.length,
    white_remaining: white.length,
    selected: false
  };
  shuffle(black);
  shuffle(white);
  wss.on('connection', function(socket) {
    socket.on('close', function() {
      updateRoster();
    });
    socket.on('message', function incoming(data) {
      const message = JSON.parse(data);
      if (message.type === 'play') {
        const cardIndex = message.data;
        const playerIndex = players.indexOf(socket);
        if (socket.status !== 'judge') {
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
        const mappedIndex = board._whiteMappings[index];
        const player = players[mappedIndex];
        const card = board.whites[index];
        //check that there hasn't been a winner selected this turn
        //make sure this player is judge
        if (socket.status === 'judge' && checkAllPlayersReady() && !board.selected && player && card) {
          player.score += 1;
          player.winner = true;
          card.winner = true;
          board.selected = true;
          updateRoster();
        }
      }
      else if (message.type === 'advance') {
        if ((board.judge === -1 && players.length >= 3) || (socket.status === 'judge' && board.selected)) {
          runTurn();
        }
      }
      else if (message.type === 'join') {
        // check if there's already a player with this name in the room
        const existingIndex = players.findIndex(p => p.name === message.name);
        const existingPlayer = players[existingIndex];
        if (existingPlayer && existingPlayer.readyState === WebSocket.OPEN) {
          // refuse the join attempt
          return socket.send(JSON.stringify({type: 'join_refuse'}));
        } else if (existingPlayer && existingPlayer.connectionState !== WebSocket.OPEN) {
          // reconnect this player
          socket.name = existingPlayer.name;
          socket.score = existingPlayer.score;
          socket.hand = existingPlayer.hand;
          socket.id = existingPlayer.id;
          players[existingIndex] = socket;
        } else if (!existingPlayer) {
          // new player
          socket.name = String(message.name);
          socket.score = 0;
          socket.hand = [];
          players.push(socket);
          socket.id = players.length;
        }
        socket.send(JSON.stringify({type: 'join_ack', data: { id: socket.id, name: socket.name }}));
        updateRoster();
      }
    });
  });

  function runTurn() {
    console.log('starting turn');
    // restore cards to hands
    replenish();
    board = {
      selected: false,
      black: black.pop(),
      whites: [],
      _whiteMappings: {},
      //judge becomes next player
      judge: (board.judge + 1) % players.length,
      //increment turn number
      turn: board.turn + 1,
      //count number of cards remaining in play
      black_remaining: black.length,
      white_remaining: white.length,
    };
    players.forEach(function(p, i) {
      if (i === board.judge) {
        p.status = 'judge';
      }
      else {
        p.status = 'waiting';
      }
      p.winner = false;
    });
    updateRoster();
  }

  function updateRoster() {
    //iterate through each connected client and get their name, then broadcast the roster to everyone
    async.map(players, function(p, cb) {
      //notify each player of their hand
      if (p.readyState === WebSocket.OPEN) {
        p.send(JSON.stringify({ type: 'hand', data: p.hand }));
      }
      cb(null, {
        name: p.name,
        score: p.score,
        status: p.status,
        winner: p.winner,
        readyState: p.readyState,
      });
    }, function(err, names) {
      if (err) {
        console.error(err);
      }
      //notify every player of roster/board state
      wss.broadcast(JSON.stringify({ type: 'roster', data: names }));
      let newBoard = {...board, _whiteMappings: undefined };
      if (board.selected) {
        // Do nothing to the data
      }
      else if (checkAllPlayersReady()) {
        // Hide the identities, but show the cards so the judge can pick (scramble the cards)
        shuffle(board.whites);
        // Map the scrambled IDs to the player indexes so we can look up who won later
        board.whites.forEach((w, i) => {
          board._whiteMappings[i] = w.playerIndex;
        });
        const hiddenWhites = board.whites.map(w => ({ cards: w.cards }));
        newBoard = { ...board, whites: hiddenWhites };
      }
      else {
        // Hide the cards, but show the identities so we know who moved
        newBoard = { ...board, whites: board.whites.map(w => ({ playerIndex: w.playerIndex })) };
      }
      // TODO resending the board to everyone is unnecessary (e.g. if a player joins only they need a board update)
      wss.broadcast(JSON.stringify({ type: 'board', data: newBoard }));
    });
  }

  function checkAllPlayersReady() {
    for (let i = 0; i < players.length; i++) {
      if (players[i].status !== 'played' && players[i].status !== 'judge') {
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
