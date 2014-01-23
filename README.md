# PHP-burner: Stand alone application engine using node express websockets (WS) and PHP #

Provide a fast, low foot print, HTML5 application platform for stand alone application server.

This is Proof of concept. I can be used as is, but there are issues if you want to run tnings like a big CMS.

It's originally made for and tested on the Raspberry PI linux platform.











In my opinion node is not suitable for application development. 
I am thrilled by the whole concept. It feels right. Its on the track to the next level of programming. Its a very convinsing proof of concept. It feels very much like the days before OO programming was criticized into an actual language. (C++) 
Before that, the techniques was more or less successfully implemented with structures and functionpointers. But in the end, the cost of the intricacy and knowledge required to develop and maintain the applications, outweighed the benefits. I feel the same applies here.
Its simply too intricate for a junior programmer to work effectively on application development. Whenever it takes senior programmers to do common business logic, its too costly to use and maintain. I feel the need of a new language to effectively implement event based programming. 

How ever, if you can separate the business logic from the server, it can be used as a powerful server engine for real-time application or in stand alone units. But with great care! There are ample opportunities for security holes, compared with more mature engines like apache2. But the prospects for much better security are there.


## Usage ##

### Installing ###

`npm install ws`

### Sending and receiving text data ###

```js
var WebSocket = require('ws');
var ws = new WebSocket('ws://www.host.com/path');
ws.on('open', function() {
    ws.send('something');
});
ws.on('message', function(data, flags) {
    // flags.binary will be set if a binary data is received
    // flags.masked will be set if the data was masked
});
```

### Sending binary data ###

```js
var WebSocket = require('ws');
var ws = new WebSocket('ws://www.host.com/path');
ws.on('open', function() {
    var array = new Float32Array(5);
    for (var i = 0; i < array.length; ++i) array[i] = i / 2;
    ws.send(array, {binary: true, mask: true});
});
```

Setting `mask`, as done for the send options above, will cause the data to be masked according to the websocket protocol. The same option applies for text data.

### Server example ###

```js
var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({port: 8080});
wss.on('connection', function(ws) {
    ws.on('message', function(message) {
        console.log('received: %s', message);
    });
    ws.send('something');
});
```

### Server sending broadcast data ###

```js
var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({port: 8080});
  
wss.broadcast = function(data) {
	for(var i in this.clients)
		this.clients[i].send(data);
};
```

### Error handling best practices ###

```js
// If the WebSocket is closed before the following send is attempted
ws.send('something');

// Errors (both immediate and async write errors) can be detected in an optional callback.
// The callback is also the only way of being notified that data has actually been sent.
ws.send('something', function(error) {
    // if error is null, the send has been completed,
    // otherwise the error object will indicate what failed.
});

// Immediate errors can also be handled with try/catch-blocks, but **note**
// that since sends are inherently asynchronous, socket write failures will *not*
// be captured when this technique is used.
try {
    ws.send('something');
}
catch (e) {
    // handle error
}
```

### echo.websocket.org demo ###

```js
var WebSocket = require('ws');
var ws = new WebSocket('ws://echo.websocket.org/', {protocolVersion: 8, origin: 'http://websocket.org'});
ws.on('open', function() {
    console.log('connected');
    ws.send(Date.now().toString(), {mask: true});
});
ws.on('close', function() {
    console.log('disconnected');
});
ws.on('message', function(data, flags) {
    console.log('Roundtrip time: ' + (Date.now() - parseInt(data)) + 'ms', flags);
    setTimeout(function() {
        ws.send(Date.now().toString(), {mask: true});
    }, 500);
});
```

### Other examples ###

For a full example with a browser client communicating with a ws server, see the examples folder.

Note that the usage together with Express 3.0 is quite different from Express 2.x. The difference is expressed in the two different serverstats-examples.

Otherwise, see the test cases.

### Running the tests ###

`make test`


## License ##

(The MIT License)

Copyright (c) 2013 Simon Rigét &lt;simon.riget at gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

