const WebSocket = require('ws');
const cards = require('../data/cards.json');
// TODO track card stats

class Game {
  constructor(wss, gameId, type = 'Base') {
    let deck;
    if (type === 'Expansion') {
      deck = {
        black: cards['Base'].black.concat(cards['CAHe1'].black).concat(cards['CAHe2'].black).concat(cards['CAHe3'].black).concat(cards['CAHe4'].black).concat(cards['CAHe5'].black).concat(cards['CAHe6'].black),
        white: cards['Base'].white.concat(cards['CAHe1'].white).concat(cards['CAHe2'].white).concat(cards['CAHe3'].white).concat(cards['CAHe4'].white).concat(cards['CAHe5'].white).concat(cards['CAHe6'].white),
      };
    } else {
      deck = cards['Base'];
    }
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
      picking: false,
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
    const { players, wss, updateRoster, updateBoard, updateHand, runTurn } = this;
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
      // Rejoining players can't play until next round
      ws.status = 'played';
      players[existingIndex] = ws;
    }
    else if (!existingPlayer) {
      // new player
      ws.name = String(ws.name);
      ws.score = 0;
      ws.hand = [];
      ws.id = players.length + 1;
      ws.status = 'played';
      players.push(ws);
    }
    wss.send(ws, JSON.stringify({ type: 'join_ack', data: { id: ws.id, name: ws.name } }));
    updateRoster();
    updateBoard(ws);
    updateHand(ws);
    ws.once('close', function() {
      const { board } = this;
      // If judge, advance the turn
      if (board && ws.id === board.judge) {
        runTurn();
      }
      updateRoster();
      updateBoard();
    });
  }

  handlePlay(ws, json) {
    const { players, board, updateHand, updateRoster, updateBoard } = this;
    const cardIndex = json.data;
    const playerIndex = players.indexOf(ws);
    // Judge can't play
    // Don't allow cards to be played if we are in the selection stage already
    if (!this.gameOver && ws.id !== board.judge && !board.picking && ws.status !== 'played') {
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
    console.log(board._whiteMappings);
    console.log('isJudge: %s, allReady: %s, !selected: %s, player: %s, card: %s', ws.id === board.judge, checkAllPlayersReady(players), !board.selected, player, card);
    if (!this.gameOver && ws.id === board.judge && checkAllPlayersReady(players) && !board.selected && player && card) {
      player.score += 1;
      card.winner = true;
      board.selected = true;
      updateBoard();
      updateRoster();
    }
  }

  handleAdvance(ws, json) {
    const { board, players, runTurn } = this;
    if ((!this.gameOver && board.judge === 0 && players.length >= 3) || (ws.id === board.judge && board.selected)) {
      runTurn();
    }
  }

  runTurn() {
    console.log('advancing turn in room %s', this.board.gameId);
    const { players, white, black, updateHand, updateRoster, updateBoard } = this;
    
    // Game ended (no black or no white)
    if (white.length <= players.length || black.length < 1) {
      this.gameOver = true;
    }
    
    // restore cards to hands
    replenish(players, white);

    let nextJudge = this.board.judge;
    // Don't select a disconnected player as judge
    let nextJudgeCandidate = players.find(pl => pl.readyState === WebSocket.OPEN && pl.id > this.board.judge);
    if (!nextJudgeCandidate) {
      nextJudgeCandidate = players.find(pl => pl.readyState === WebSocket.OPEN && pl.id > 0);
    }
    // TODO what if there are no eligible players to judge? end the game, or try again whenever a player reconnects?
    nextJudge = nextJudgeCandidate.id;
    this.board = {
      ...this.board,
      selected: false,
      picking: false,
      black: black.pop(),
      whites: [],
      _whiteMappings: {},
      //judge becomes next player
      judge: nextJudge,
      //increment turn number
      turn: this.board.turn + 1,
      //count number of cards remaining in play
      blackRemaining: black.length,
      whiteRemaining: white.length,
      gameOver: this.gameOver,
    };
    players.forEach(p => {
      if (p.id === this.board.judge || p.readyState !== WebSocket.OPEN) {
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
      if (!board.picking) {
        board.picking = true;
        // Hide the identities, but show the cards so the judge can pick (scramble the cards)
        shuffle(board.whites);
        // Map the scrambled IDs to the player indexes so we can look up who won later
        board.whites.forEach((w, i) => {
          board._whiteMappings[i] = w.playerIndex;
        });
      }
      const hiddenWhites = board.whites.map(w => ({ cards: w.cards }));
      newBoard = { ...board, whites: hiddenWhites, _whiteMappings: undefined };
    } else {
      // Hide the cards, but show the identities so we know who moved
      newBoard = { ...board, _whiteMappings: undefined, whites: board.whites.map(w => ({ playerIndex: w.playerIndex })) };
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
    if (players[i].status !== 'played' && players[i].readyState === WebSocket.OPEN) {
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
