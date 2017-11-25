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
  return (<div className="section">
    <h3>Players</h3>
      <div>
        {roster.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between'}}>
          <div>{`${p.name}`}</div>
          <div>{p.score + ' points'}</div>
          {/*<div>{p.status}</div>*/}
        </div>))}
      </div>
  </div>);
};

//TODO gray out the hand when player is judge
//TODO display "waiting for {name} to pick winner"
//TODO display "{name} picked {name} as the winner!"
//TODO glow effect on the winner
const Hand = ({ hand, playFn }) => {
  return (<div className="section">
    <h3>Hand</h3>
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {hand.map((card, index) => (<Card key={card} text={card} id={index} onClick={playFn} style={{ background: '#FFF', cursor: 'pointer' }} />))}
    </div>
  </div>);
};

const Board = ({ roster, board, selectFn }) => {
  return (
    <div className="section" style={{ width: '85%' }}>
      <h3>
      Board
      </h3>
      <div style={{ textAlign: 'left' }}>
        {board.black && board.black.text && <Card text={board.black.text} pick={board.black.pick} style={{ background: '#000', color: "#FFF" }} />}
        {board.whites.map((white, i) => (<Card id={i} text={white.cards ? white.cards.join(' / ') : `Card hidden`} owner={roster[white.playerIndex] && roster[white.playerIndex].name} onClick={selectFn} style={{ background: '#FFF', cursor: 'pointer' }} />))}
      </div>
    </div>);
};

const Deck = ({ board }) => {
  return (
  <div className="section">
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
    this.state.socket.send(JSON.stringify({ type: 'play', data: id }));
  }
  handleSelect = (id) => {
    this.state.socket.send(JSON.stringify({ type: 'select', data: id }));
  }
  handleAdvance = () => {
    this.state.socket.send(JSON.stringify({type: 'advance' }));
  }
  render() {
    const judge = this.state.roster.find(p => p.status === 'judge');
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Hypertext Versus Society</h1>
        </header>
        <div className="Game">
          <div className="section">
            {!this.state.isInGame ? (<input
              style={{ width: '500px', textAlign: 'center', height: '40px', borderRadius: '5px', fontSize: '24px' }} 
              placeholder="Type a name to join the game" 
              onKeyPress={this.handleJoin} 
            />) : <div style={{ textAlign: 'left' }}>
            {judge && <span>{judge.name} is judge.</span>}
            {this.state.board.selected && (<button onClick={this.handleAdvance}>Next Turn</button>)}
            </div>}
          </div>
          {this.state.isInGame && (<div>
            <div style={{ display: 'flex', height: '300px' }}>
              <div style={{ width: '15%' }}>
                <Roster roster={this.state.roster} />
                <Deck board={this.state.board} />
              </div>
              <Board roster={this.state.roster} board={this.state.board} selectFn={this.handleSelect} />
            </div>
            <Hand hand={this.state.hand} playFn={this.handlePlay} />
          </div>)}
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
