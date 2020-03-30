import React, { Component } from 'react';
import querystring from 'querystring';
import logo from './logo.svg';
import './App.css';

const Card = ({ socket, text, type, id, playable, onClick, style, pick, owner, winner, pickable }) => {
  return (<div key={id}
    style={style}
    className={[winner ? 'winner' : '', pickable ? 'pickable' : '', 'cards'].filter(Boolean).join(' ')}
    onClick={() => { 
      if (onClick) {
        onClick(id);
      }
    }
    }
  >
  {text.map(t => (<div style={{ padding: '4px 0px' }}>{decodeEntities(t)}</div>))}
  {pick && <div className="alignBottom">Pick {pick}</div>}
  {owner && <div className="alignBottom">{owner}</div>}
  </div>);
};

const Roster = ({ roster, self, board }) => {
  return (<div className="section info" style={{ flexGrow: 1 }}>
    <h3>Players</h3>
    <div>
      {roster.map(p => (
      <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', height: '30px', fontWeight: p.id === self.id ? 700 : 400 }}>
        <div>
          <span className={[board.judge === p.id ? 'winner' : 'standard', 'filled-circle'].filter(Boolean).join(' ')} style={{ background: p.readyState === 1 ? '#00ff00' : '#ff0000' }} />
          {`${p.name}`}
        </div>
        <div>{p.score + 'p'}</div>
        {/*<div>{p.status}</div>*/}
      </div>))}
    </div>
  </div>);
};

const Hand = ({ hand, self, board, playFn }) => {
  return (<div className="section dark">
    <h3>Hand</h3>
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px', margin: '0 auto', opacity: self.id === board.judge ? 0.5 : 1 }}>
      {hand.map((card, index) => (<Card key={card} text={[card]} id={index} onClick={playFn} pickable={self.id !== board.judge} style={{ background: '#FFF', color: '#000', cursor: 'pointer' }} />))}
    </div>
  </div>);
};

const Board = ({ roster, board, self, selectFn }) => {
  return (
    <div className="section success" style={{ flexGrow: 1, width: '75%' }}>
      <h3>
      Board
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {board.black && board.black.text && <Card text={[board.black.text]} pick={board.black.pick} style={{ background: '#000', color: "#FFF" }} />}
        {board.whites.map((white, i) => (
          <Card
            id={i} 
            text={white.cards || []} 
            owner={roster[white.playerIndex] && roster[white.playerIndex].name} 
            onClick={selectFn} 
            style={{ background: '#FFF', color: '#000', cursor: 'pointer' }}
            winner={white.winner}
            pickable={self.id === board.judge}
          />))}
      </div>
    </div>);
};

const Deck = ({ board }) => {
  return (
    <div className="section light" style={{ textAlign: 'left', flex: 1 }}>
    <h3>Deck</h3>
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between'}}>
        <div>Black cards</div>
        <div>{board.blackRemaining}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between'}}>
        <div>White cards</div>
        <div>{board.whiteRemaining}</div>
      </div>
      {/*<Card text={board.black_remaining} style={{ background: '#000', color: "#FFF" }} />*/}
      {/*<Card text={board.white_remaining} style={{ background: '#FFF' }} />*/}
    </div>
  </div>);
};

const GameStatus = ({ self, roster, board, handleAdvance }) => {
  const judge = roster.find(p => p.id === board.judge);
  return (
  <div className="section dark" style={{ flex: 1}}>
    <div style={{ textAlign: 'left' }}>
      <h3>Status</h3>
      {board.judge === 0 && <span>Waiting for game start (3 players minimum)...</span>}
      {board.gameOver && <span>Game over.</span>}
      {!board.gameOver && judge && board.selected && <span>{judge.name} picked the winner! Waiting for {judge.name} to advance to the next turn...</span>}
      {!board.gameOver && judge && !board.selected && !board.allPlayersReady && <span>{judge.name} is judge. Waiting for players to play cards...</span>}
      {!board.gameOver && judge && !board.selected && board.allPlayersReady && <span>All players played! Waiting for {judge.name} to pick the winner...</span>}
    </div>
  </div>);
};

const NameInput = ({ self, updateName, handleJoin }) => (
  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
    {self && self.msg && (<div className="section warning">{self && self.msg}</div>)}
    <input
      style={{ width: '20em', textAlign: 'center', height: '60px', borderRadius: '8px', fontSize: '18px' }} 
      placeholder="Type a name to start/join the game"
      onChange={updateName}
      onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
    />
    <button className="button" style={{ width: '23em', marginTop: '1em' }} onClick={handleJoin}>Join</button>
  </div>);

class App extends Component {
  constructor() {
    super();
    const urlState = querystring.parse(window.location.search.substring(1));
    const urlName = urlState && urlState.name;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(process.env.REACT_APP_SERVER_HOST || protocol + '//' + window.location.host);
    socket.onopen = function() {
      if (urlName) {
        this.updateName({ target: { value: urlName }}, this.handleJoin);
      }
    }.bind(this);
    socket.onmessage = function(msg) {
      const json = JSON.parse(msg.data);
      if (json.type === 'roster') {
        this.setState({ roster: json.data });
      }
      else if (json.type === 'hand') {
        this.setState({ hand: json.data });
      }
      else if (json.type === 'board') {
        this.setState({ board: json.data });
        window.history.replaceState('', '', `?room=${json.data && json.data.gameId}${urlName ? `&name=${urlName}` : ''}`);
      }
      else if (json.type === 'join_ack') {
        this.setState({ self: json.data });
      } else if (json.type === 'join_refuse') {
        this.setState({ self: { msg: 'A player with this name is already connected, please choose another' }});
      }
    }.bind(this);
    this.state = {
      roster: [],
      self: {},
      hand: [],
      board: {
        black: {},
        whites: [],
      },
      socket,
    };
  }
  updateName = (e) => {
      this.setState({ currentName: e.target.value });
  }
  handleJoin = () => {
    const urlState = querystring.parse(window.location.search.substring(1));
    this.state.socket.send(JSON.stringify({ type: 'join', room: urlState.room, name: this.state.currentName, gameType: 'Base' }));
  }
  handlePlay = (id) => {
    this.state.socket.send(JSON.stringify({ type: 'play', room: this.state.board.gameId, data: id }));
  }
  handleSelect = (id) => {
    this.state.socket.send(JSON.stringify({ type: 'select', room: this.state.board.gameId, data: id }));
  }
  handleAdvance = () => {
    this.state.socket.send(JSON.stringify({ type: 'advance', room: this.state.board.gameId }));
  }
  render() {
    const urlState = querystring.parse(window.location.search.substring(1));
    // const urlName = urlState && urlState.name;
    const urlRoom = urlState && urlState.room;
    const inviteUrl = window.location.origin + "?room=" + urlRoom;
    const { self, board, roster, hand } = this.state;
    return (
      <div className="App">
        <a style={{ textDecoration: 'none' }} href="/">
          <header className="App-header">
            <div className="title">Pixels Against Humanity</div>
          </header>
        </a>
        <div className="Game">
          {self && self.id ? (<div>
            {(<div style={{ display: 'flex', justifyContent: 'center'}}>
              {/*
              <a style={{ textDecoration: 'none' }} className="button" href="/">
                {'Create New Game'}
              </a>
              */}
              <button className="button" onClick={this.handleAdvance} disabled={!((board.judge === 0 && roster.length >= 3) || (self.id === board.judge && board.selected))}>
                {board.judge === 0 ? 'Start Game' : 'Next Turn'}
              </button>
             </div>)}
            {board.judge === 0 && <div className="section primary">
              <h3>Invite your friends!</h3>
              <a href={inviteUrl} target="_blank">{inviteUrl}</a>
            </div>}
            <div style={{ display: 'flex' }}>
              <GameStatus roster={roster} board={board} handleAdvance={this.handleAdvance} self={self} />
              <Deck board={board} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <Roster roster={roster} self={self} board={board} />
              <Board roster={roster} board={board} self={self} selectFn={this.handleSelect} />
            </div>
            <Hand hand={hand} self={self} board={board} playFn={this.handlePlay} />
          </div>) : <NameInput self={self} updateName={this.updateName} handleJoin={this.handleJoin} />}
        <div className="section warning">An <a href="https://github.com/howardchung/pixelsagainsthumanity">open source</a> project.</div>
        </div>
      </div>
    );
  }
}

export default App;

function decodeEntities(s) {
  var str;
  var temp = document.createElement('pre');
  temp.innerHTML = s;
  str = temp.textContent || temp.innerText;
  temp = null;
  return str;
}

/*
function speak(text) {
  var msg = new window.SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(msg);
}

function replace(black, whites) {
  //black: single black card
  //whites: array of white cards
  //if no _, append to end
  if (black.text.indexOf("_") === -1) {
    return black.text + " " + whites[0];
  } else {
    var replace = black.text;
    whites.forEach(function(w) {
      //replace _ with white cards
      //remove punctuation from white card
      replace = replace.replace("_", w.slice(0, -1));
    });
    //capitalize resulting string
    return replace.slice(0, 1).toUpperCase() + replace.slice(1);
  }
}
*/
