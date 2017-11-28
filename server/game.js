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

class Game {
  constructor(wss, gameId) {
    const deck = cards['Base'];
    this.black = deck.black.map(index => cards.blackCards[index]).filter(card => card.pick > 0);
    this.white = deck.white.map(index => cards.whiteCards[index]);
    this.players = [];
    this.wss = wss;
    this.dateCreated = new Date();
    this.board = {
      gameId,
      black: {},
      whites: [],
      _whiteMappings: {},
      judge: 0,
      turn: 0,
      black_remaining: this.black.length,
      white_remaining: this.white.length,
      selected: false,
      allPlayersReady: false,
    };
    this.runTurn = this.runTurn.bind(this);
    this.updateBoard = this.updateBoard.bind(this);
    this.updateHand = this.updateHand.bind(this);
    this.updateRoster = this.updateRoster.bind(this);
    this.join = this.join.bind(this);
    this.handlePlay = this.handlePlay.bind(this);

    const { black, white } = this;
    shuffle(black);
    shuffle(white);
  }

  join(ws) {
    const { players, wss, updateRoster, updateBoard, updateHand } = this;
    // check if there's already a player with this name in the room
    const existingIndex = players.findIndex(p => p.name === ws.name);
    const existingPlayer = players[existingIndex];
    if (existingPlayer && existingPlayer.readyState === WebSocket.OPEN) {
      // refuse the join attempt
      return wss.send(ws, JSON.stringify({ type: 'join_refuse' }));
    }
    else if (existingPlayer && existingPlayer.connectionState !== WebSocket.OPEN) {
      // reconnect this player
      ws.name = existingPlayer.name;
      ws.score = existingPlayer.score;
      ws.hand = existingPlayer.hand;
      ws.id = existingPlayer.id;
      ws.status = existingPlayer.status;
      players[existingIndex] = ws;
    }
    else if (!existingPlayer) {
      // new player
      ws.name = String(ws.name);
      ws.score = 0;
      ws.hand = [];
      ws.id = players.length + 1;
      ws.status = null;
      players.push(ws);
    }
    wss.send(ws, JSON.stringify({ type: 'join_ack', data: { id: ws.id, name: ws.name } }));
    updateRoster();
    updateBoard(ws);
    updateHand(ws);
    ws.once('close', function() {
      updateRoster();
    });
  }

  handlePlay(ws, json) {
    const { players, board, updateHand, updateRoster, updateBoard } = this;
    const cardIndex = json.data;
    const playerIndex = players.indexOf(ws);
    if (ws.id !== board.judge) {
      let playerWhites = board.whites.find(w => w.playerIndex === playerIndex);
      if (!playerWhites) {
        playerWhites = { playerIndex, cards: [] };
        board.whites.push(playerWhites);
      }
      //ensure the player has cards left to play
      if (playerWhites.cards.length < board.black.pick) {
        playerWhites.cards.push(ws.hand[cardIndex]);
        //remove card from player's hand
        ws.hand.splice(cardIndex, 1);
        //if player has no cards left to play
        if (playerWhites.cards.length >= board.black.pick) {
          //notify all players that this player moved
          ws.status = 'played';
        }
        updateHand(ws);
        updateRoster();
        updateBoard();
      }
    }
  }

  handleSelect(ws, json) {
    const { board, players, updateBoard, updateRoster } = this;
    const index = json.data;
    const mappedIndex = board._whiteMappings[index];
    const player = players[mappedIndex];
    const card = board.whites[index];
    //check that there hasn't been a winner selected this turn
    //make sure this player is judge
    if (ws.id === board.judge && checkAllPlayersReady(players) && !board.selected && player && card) {
      player.score += 1;
      card.winner = true;
      board.selected = true;
      updateBoard();
      updateRoster();
    }
  }

  handleAdvance(ws, json) {
    const { board, players, runTurn } = this;
    if ((board.judge === 0 && players.length >= 3) || (ws.id === board.judge && board.selected)) {
      runTurn();
    }
  }

  runTurn() {
    console.log('advancing turn in room %s', this.board.gameId);
    const { players, white, black, updateHand, updateRoster, updateBoard } = this;
    // restore cards to hands
    replenish(players, white);
    this.board = {
      ...this.board,
      selected: false,
      allPlayersReady: false,
      black: black.pop(),
      whites: [],
      _whiteMappings: {},
      //judge becomes next player
      judge: (this.board.judge + 1) % (players.length + 1),
      //increment turn number
      turn: this.board.turn + 1,
      //count number of cards remaining in play
      black_remaining: black.length,
      white_remaining: white.length,
    };
    players.forEach(p => {
      if (p.id === this.board.judge) {
        p.status = 'played';
      }
      else {
        p.status = null;
      }
    });
    updateHand();
    updateRoster();
    updateBoard();
  }

  updateRoster() {
    const { players, wss } = this;
    const names = players.map(p => ({
      name: p.name,
      score: p.score,
      id: p.id,
      status: p.status,
      readyState: p.readyState,
    }));
    players.forEach(p => {
      wss.send(p, JSON.stringify({ type: 'roster', data: names }));
    });
  }

  updateHand(socket) {
    const { players, wss } = this;
    if (socket) {
      wss.send(socket, JSON.stringify({ type: 'hand', data: socket.hand }));
    }
    else {
      players.forEach(p => {
        //notify each player of their hand
        wss.send(p, JSON.stringify({ type: 'hand', data: p.hand }));
      });
    }
  }

  updateBoard(socket) {
    const { board, players, wss } = this;
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
    }
    else {
      players.forEach(p => {
        wss.send(p, boardMsg);
      });
    }
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

function replenish(players, white) {
  //server deals hand to all players from white deck
  players.forEach(function(p) {
    const hand_max = 10;
    while (p.hand.length < hand_max) {
      p.hand.push(white.pop());
    }
  });
}

function shuffle(o) {
  for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}

module.exports = Game;
