var path = require('path');
var async = require('async');
var express = require('express');
var app = express();
var server = app.listen(process.env.PORT || 5000, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('[WEB] listening at http://%s:%s', host, port);
});
var io = require('socket.io')(server);
app.use(express.static(path.resolve(__dirname, 'public')));
var messages = [];
var sockets = [];
//io.emit broadcasts to all clients
io.on('connection', function(socket) {
  //within this, emits only to the connecting socket
  messages.forEach(function(data) {
    socket.emit('message', data);
  });
  sockets.push(socket);
  socket.on('disconnect', function() {
    sockets.splice(sockets.indexOf(socket), 1);
    updateRoster();
  });
  socket.on('message', function(msg) {
    //message passed from a player
    var text = String(msg || '');
    if (!text) return;
    var data = {
      name: socket.name,
      text: text
    };
    io.emit('message', data);
    messages.push(data);
  });
  socket.on('identify', function(name) {
    //new player joined game!
    socket.name = String(name || 'Anonymous');
    updateRoster();
  });
});

function updateRoster() {
  //iterate through each connected client and get their name, then broadcast the roster to everyone
  async.map(sockets, function(socket, callback) {
    callback(null, socket.name);
  }, function(err, names) {
    io.emit('roster', names);
  });
}