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

const Roster = ({ roster }) => {
  return roster.map(p => (
    <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between'}}>
    <div>{`${p.name} (${p.status})`}</div>
    <div>{p.score + ' points'}</div>
    {/*<div>{p.status}</div>*/}
  </div>));
};

//TODO gray out the hand when player isn't czar
const Hand = ({ hand, playFn }) => {
  return (<div>
    {hand.map((card, index) => (<Card key={card} text={card} id={index} onClick={playFn} style={{ background: '#FFF', cursor: 'pointer' }} />))}
  </div>);
};

const Board = ({ roster, board, selectFn }) => {
  return (<div>
      {board.black && board.black.text && <Card text={board.black.text} pick={board.black.pick} style={{ background: '#000', color: "#FFF" }} />}
      {board.whites.map((white, i) => (<Card id={i} text={white.cards ? white.cards.join(' / ') : `Card hidden`} owner={roster[white.playerIndex] && roster[white.playerIndex].name} onClick={selectFn} style={{ background: '#FFF', cursor: 'pointer' }} />))}
      </div>);
};

const Deck = ({ board }) => {
  return (<div>
    <Card text={board.black_remaining} style={{ background: '#000', color: "#FFF" }} />
    <Card text={board.white_remaining} style={{ background: '#FFF' }} />
  </div>);
};

class App extends Component {
  constructor() {
    super();
    const socket = new WebSocket(process.env.REACT_APP_SERVER_HOST);
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
    }.bind(this);
    this.state = {
      roster: [],
      hand: [],
      board: {
        black: {},
        whites: [],
      },
      socket,
      isInGame: false,
    };
  }
  componentDidMount() {}
  handleJoin = (e) => {
    if (e.key === 'Enter') {
      this.setState({ isInGame: true });
      this.state.socket.send(JSON.stringify({ type: 'join', name: e.target.value }));
    }
  }
  handlePlay = (id) => {
    this.state.socket.send(JSON.stringify({ type: "play", data: id }));
  }
  handleSelect = (id) => {
    this.state.socket.send(JSON.stringify({ type: "select", data: id }));
  }
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Hypertext Versus Society</h1>
        </header>
        <div style={{ textAlign: 'left', padding: '20px' }}>
          <div style={{ textAlign: 'center' }}>
          {!this.state.isInGame && (
          <input 
            style={{ width: '500px', textAlign: 'center', height: '40px', borderRadius: '5px', fontSize: '24px', filter: 'drop-shadow(5px 5px 5px #000)' }} 
            placeholder="Type a name to join the game" 
            onKeyPress={this.handleJoin} 
          />)}
          </div>
          <div style={{ display: 'flex', height: '250px' }}>
            <div style={{ width: '10%', marginRight: '10px' }}>
              <h3>Players</h3>
              <div>
              <Roster roster={this.state.roster} />
            </div>
            </div>
            <div style={{ width: '60%', marginRight: '10px' }}>
              <h3>Board</h3>
              <Board roster={this.state.roster} board={this.state.board} selectFn={this.handleSelect} />
            </div>
            <div style={{ width: '25%'}}>
              <h3>Deck</h3>
              <Deck board={this.state.board} />
            </div>
          </div>
          <h3>Hand</h3>
          <Hand hand={this.state.hand} playFn={this.handlePlay} />
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
