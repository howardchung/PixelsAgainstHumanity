const WebSocket = require('ws');
const cards = require('../data/cards.json');
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
    judge: 0,
    turn: 0,
    black_remaining: black.length,
    white_remaining: white.length,
    selected: false,
    allPlayersReady: false,
  };
  shuffle(black);
  shuffle(white);
  wss.on('connection', function(socket) {
    socket.on('close', function() {
      updateRoster();
    });
    socket.on('message', function incoming(data) {
      const message = JSON.parse(data);
      console.log('[RECEIVED]', message);
      if (message.type === 'play') {
        const cardIndex = message.data;
        const playerIndex = players.indexOf(socket);
        if (socket.id !== board.judge) {
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
            updateHand();
            updateRoster();
            updateBoard();
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
        if (socket.id === board.judge && checkAllPlayersReady(players) && !board.selected && player && card) {
          player.score += 1;
          card.winner = true;
          board.selected = true;
          updateBoard();
          updateRoster();
        }
      }
      else if (message.type === 'advance') {
        if ((board.judge === 0 && players.length >= 3) || (socket.id === board.judge && board.selected)) {
          runTurn();
        }
      }
      else if (message.type === 'join') {
        // check if there's already a player with this name in the room
        const existingIndex = players.findIndex(p => p.name === message.name);
        const existingPlayer = players[existingIndex];
        if (existingPlayer && existingPlayer.readyState === WebSocket.OPEN) {
          // refuse the join attempt
          return wss.send(socket, JSON.stringify({ type: 'join_refuse' }));
        }
        else if (existingPlayer && existingPlayer.connectionState !== WebSocket.OPEN) {
          // reconnect this player
          socket.name = existingPlayer.name;
          socket.score = existingPlayer.score;
          socket.hand = existingPlayer.hand;
          socket.id = existingPlayer.id;
          players[existingIndex] = socket;
        }
        else if (!existingPlayer) {
          // new player
          socket.name = String(message.name);
          socket.score = 0;
          socket.hand = [];
          players.push(socket);
          socket.id = players.length;
        }
        wss.send(socket, JSON.stringify({ type: 'join_ack', data: { id: socket.id, name: socket.name } }));
        updateRoster();
        updateBoard(socket);
      }
    });
  });

  function runTurn() {
    // restore cards to hands
    replenish();
    board = {
      selected: false,
      allPlayersReady: false,
      black: black.pop(),
      whites: [],
      _whiteMappings: {},
      //judge becomes next player
      judge: (board.judge + 1) % (players.length + 1),
      //increment turn number
      turn: board.turn + 1,
      //count number of cards remaining in play
      black_remaining: black.length,
      white_remaining: white.length,
    };
    players.forEach(p => {
      if (p.id === board.judge) {
        p.status = 'played';
      } else {
        p.status = null;
      }
    });
    updateHand();
    updateRoster();
    updateBoard();
  }

  function updateRoster() {
    const names = players.map(p => ({
      name: p.name,
      score: p.score,
      winner: p.winner,
      readyState: p.readyState,
      id: p.id,
    }));
    wss.broadcast(JSON.stringify({ type: 'roster', data: names }));
  }
  
  function updateHand() {
    players.forEach(p => {
      //notify each player of their hand
      wss.send(p, JSON.stringify({ type: 'hand', data: p.hand }));
    });
  }
  
  function updateBoard(socket) {
    let newBoard = { ...board, _whiteMappings: undefined };
    if (board.selected) {
      // Do nothing to the data
    }
    else if (checkAllPlayersReady(players)) {
      // Hide the identities, but show the cards so the judge can pick (scramble the cards)
      shuffle(board.whites);
      // Map the scrambled IDs to the player indexes so we can look up who won later
      board.whites.forEach((w, i) => {
        board._whiteMappings[i] = w.playerIndex;
      });
      const hiddenWhites = board.whites.map(w => ({ cards: w.cards }));
      newBoard = { ...board, allPlayersReady: true, whites: hiddenWhites };
    }
    else {
      // Hide the cards, but show the identities so we know who moved
      newBoard = { ...board, whites: board.whites.map(w => ({ playerIndex: w.playerIndex })) };
    }
    const boardMsg = JSON.stringify({ type: 'board', data: newBoard });
    if (socket) {
      // Send to just this player
      wss.send(socket, boardMsg);
    } else {
      wss.broadcast(boardMsg);
    }
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

function checkAllPlayersReady(players) {
  for (let i = 0; i < players.length; i++) {
    if (players[i].status !== 'played') {
      return false;
    }
  }
  return true;
}

function shuffle(o) {
  for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}

module.exports = {
  newGame,
};
