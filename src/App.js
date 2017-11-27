import React, { Component } from 'react';
import querystring from 'querystring';
import logo from './logo.svg';
import './App.css';

const Card = ({ socket, text, type, id, playable, onClick, style, pick, owner }) => {
  return (<div key={id}
    style={style}
    className={"cards"}
    onClick={() => onClick(id)}
  >
  <div>{decodeEntities(text)}</div>
  {pick && <div className="alignBottom">Pick {pick}</div>}
  {owner && <div className="alignBottom">{owner}</div>}
  </div>);
};

const Roster = ({ roster, self }) => {
  return (<div className="section info" style={{ width: '20%' }}>
    <h3>Players</h3>
    <div>
      {roster.map(p => (
      <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', height: '30px', fontWeight: p.id === self.id ? 700 : 400 }}>
        <div>
          <span className="filled-circle" style={{ background: p.readyState === 1 ? '#00ff00' : '#ff0000' }} />
          {`${p.name}`}
        </div>
        <div>{p.score + ' points'}</div>
        {/*<div>{p.status}</div>*/}
      </div>))}
    </div>
  </div>);
};

//TODO optimize for mobile
//TODO fix vertical overflow
//TODO hover effect on hand
//TODO invite friends link
//TODO github link
const Hand = ({ hand, self, board, playFn }) => {
  return (<div className="section dark">
    <h3>Hand</h3>
    <div style={{ maxWidth: '700px', margin: '0 auto', opacity: self.id === board.judge ? 0.5 : 1 }}>
      {hand.map((card, index) => (<Card key={card} text={card} id={index} onClick={playFn} style={{ background: '#FFF', color: '#000', cursor: 'pointer' }} />))}
    </div>
  </div>);
};

//TODO glow effect on the winner
const Board = ({ roster, board, selectFn }) => {
  return (
    <div className="section success" style={{ width: '80%' }}>
      <h3>
      Board
      </h3>
      <div style={{ display: 'flex' }}>
        {board.black && board.black.text && <Card text={board.black.text} pick={board.black.pick} style={{ background: '#000', color: "#FFF" }} />}
        {board.whites.map((white, i) => (
          <Card
            id={i} 
            text={white.cards ? white.cards.join('\n\n') : ''} 
            owner={roster[white.playerIndex] && roster[white.playerIndex].name} 
            onClick={selectFn} 
            style={{ background: '#FFF', color: '#000', cursor: 'pointer' }} 
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
        <div>{board.black_remaining}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between'}}>
        <div>White cards</div>
        <div>{board.white_remaining}</div>
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
      {judge && board.selected && <span>{judge.name} picked the winner! Waiting for {judge.name} to advance to the next turn...</span>}
      {judge && !board.selected && !board.allPlayersReady && <span>{judge.name} is judge. Waiting for players to play cards...</span>}
      {judge && !board.selected && board.allPlayersReady && <span>All players played! Waiting for {judge.name} to pick the winner...</span>}
    </div>
  </div>);
};

const NameInput = ({ self, handleJoin }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
    <div>
    <input
      style={{ width: '600px', maxWidth: '600px', textAlign: 'center', height: '60px', borderRadius: '8px', fontSize: '24px' }} 
      placeholder="Type a name to join the game" 
      onKeyPress={handleJoin}
    />
    {self && self.msg && (<div className="section warning">{self && self.msg}</div>)}
    </div>
  </div>);

class App extends Component {
  constructor() {
    super();
    const socket = new WebSocket(process.env.REACT_APP_SERVER_HOST || 'wss://' + window.location.host);
    socket.onopen = function() {
      const urlState = querystring.parse(window.location.search.substring(1));
      if (urlState.name) {
        this.handleJoin({ key: 'Enter', target: { value: urlState.name } });
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
  handleJoin = (e) => {
    if (e.key === 'Enter') {
      this.state.socket.send(JSON.stringify({ type: 'join', name: e.target.value }));
    }
  }
  handlePlay = (id) => {
    this.state.socket.send(JSON.stringify({ type: 'play', data: id }));
  }
  handleSelect = (id) => {
    this.state.socket.send(JSON.stringify({ type: 'select', data: id }));
  }
  handleAdvance = () => {
    this.state.socket.send(JSON.stringify({ type: 'advance' }));
  }
  render() {
    const { self, board, roster, hand } = this.state;
    console.log(this.state);
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <div className="title">Pixels Versus Society</div>
          <div className="subtitle">A Cards Against Humanity clone.</div>
        </header>
        <div className="Game">
          {self && self.id ? (<div>
            {(<div style={{ display: 'flex', justifyContent: 'center'}}>
              <button className="button" onClick={this.handleAdvance} disabled={!((board.judge === 0 && roster.length >= 3) || (self.id === board.judge && board.selected))}>
                {board.judge === 0 ? 'Start Game' : 'Next Turn'}
                </button>
             </div>)}
            <div style={{ display: 'flex' }}>
              <GameStatus roster={roster} board={board} handleAdvance={this.handleAdvance} self={self} />
              <Deck board={board} />
            </div>
            <div style={{ display: 'flex' }}>
              <Roster roster={roster} self={self} />
              <Board roster={roster} board={this.state.board} selectFn={this.handleSelect} />
            </div>
            <Hand hand={hand} self={self} board={board} playFn={this.handlePlay} />
          </div>) : <NameInput self={self} handleJoin={this.handleJoin} />}
        </div>
      </div>
    );
  }
}

export default App;

function decodeEntities(s) {
  var str;
  var temp = document.createElement('p');
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
