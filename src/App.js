import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

/*
<style>
  body {
    background: #777;
    color: #000;
    font-size: 16pt;
    font-weight: 500;
    text-align: center;
  }
  
  .cards {
    background: #FFF;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, .5);
    margin: 10px auto;
    padding: 1em;
    text-align: left;
  }
  
  .black {
    background: #000;
    color: #FFF;
  }
  
  .hidden {
    display: none;
  }
  
  .glyphicon {
    padding: 0.2em;
  }
</style>
*/

const Card = ({ socket, text, type, id, playable, selectable, handleClick }) => {
  return (<div key={id} className={"cards"} onClick={() => {
      if (playable) {
        socket.write(JSON.stringify({type: "play", data: id }));
        //TODO display played cards "on deck"
      }
      if (selectable) {
        socket.write(JSON.stringify({type: "select", data: id }));
      }
    }} 
  >
  {text}
  </div>);
};

const Hand = ({ hand }) => {
  return (<div>
    {hand.map((card, index) => <Card text={card} id={index} playable />)}
  </div>);
};

const Roster = ({ roster }) => {
  return roster.map(p => (
    <div>
    <span>{p.name}</span>
    <span>{p.score}</span>
    <span>{p.status}</span>
  </div>));
};

const Board = ({ board }) => {
  return (<div>
      <Card text={board.black.text} selectable style={{ background: '#000' }} />
      {Object.values(board.whites).map(white => <Card text={white.text} style={{ background: '#FFF' }} />)}
      </div>);
};

class App extends Component {
  constructor() {
    super();
    let newUri;
    const loc = window.location;
    if (loc.protocol === "https:") {
      newUri = "wss:";
    } else {
      newUri = "ws:";
    }
    newUri += "//" + loc.host + ':3002';
    newUri += loc.pathname;
    const socket = new WebSocket(newUri);
    socket.onmessage = function(msg) {
      const json = JSON.parse(msg);
      if (json.type === 'roster') {
        this.setState({ roster: msg.data });
      } else if (json.type === 'hand') {
        this.setState({ hand: msg.data });
      } else if (json.type === 'board') {
        this.setState({ board: msg.data });
      }
    };
    this.state = {
      roster: [],
      hand: [],
      board: {
        black: {},
        whites: {}
      },
      socket,
    };
  }
  componentDidMount() {}
  handleJoin(e) {
    // TODO call when player joins
    this.state.socket.write(JSON.stringify({ type: 'join', name: e.target.value }));
  }
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Hypertext Versus Society</h1>
        </header>
        <p>
          <input placeholder="Type a name" />
          <Roster roster={this.state.roster} />
          <Board board={this.state.board} />
          <Hand hand={this.state.hand} />
        </p>
      </div>
    );
  }
}

export default App;

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
