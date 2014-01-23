/* ======================================================================== *\
   Application server for node.js and PHP

   A small and fast event driven application engine for a standalone server
   utilizing PHP and websocket 

   Developed for the Raspberry PI linux platform.

   By Simon Rigét 2013 (c) MIT License 

  Design bias:
  This implementation runs mostly silently and without logging, since there is
  no one to read then in a household appliance.
  When ever possible, unexpected parameters or lack off, are threaded as if its 
  on purpose by the programmer and interpreted as best possible. 
  The number of error messages are kept on a minimum.
  if you add logging etc. please make it easy to turn it completely off.

todo:
  -file upload temp file clean up + php move tmp file accept (rename to php...)
  -PHP headers not quiet right yet
  -apply spare workers for PHP to speed up response time.
  -Try using express view engine instead og middleware for PHP scripts. Find a
    way around require file.
  -Make a library out of script support + add other scripting languages
  -Make a library out of websocket event handeling

\* ======================================================================== */
var version='0.1.0 - Proof of concept';

/* ======================================================================== *\
   Debug functions (to be removed)
\* ======================================================================== */
function debug(obj,max_depth) {
  console.log("Debug: ",debug.prints(obj,max_depth));
}  

debug.depth=0; // Keep track og object depth
debug.path=[];

debug.prints = function (obj,max_depth) {
  if(typeof(obj)!='object') return obj;
  var result='';
  var tab='';
  if(!max_depth) max_depth=0;
  for(i=0;i<debug.depth;i++) tab+='--';
  for(var i in obj){
    // Mozilla bug when accessing document.domConfig
    if(i=='domConfig') continue;
    if(typeof(obj[i]) == "object"){
	    result+=tab+'['+i+']=>(object)('+debug.depth+','+max_depth+')\r\n';
	    if(debug.depth<max_depth) {
		    debug.depth++;
		    result+=debug.prints(obj[i],max_depth);
		    debug.depth--;
	    }
    }else if(typeof(obj[i]) == "function")
	    result+=tab+'['+i+']=>(Function)\r\n';
    else{
	    str=''+obj[i];
	    result+=tab+'['+i+']=>'+str.replace(/\</g,'&lt;')+"\r\n";
    }
  }
  return result;
}

debug.finds = function (obj,needle,max_depth){
  if(!(obj instanceof Object || obj instanceof Function)) return;
  var result='';
  if(!max_depth) max_depth=0;
  if(debug.depth==0) path=[];
  for(var i in obj){
    if(i==needle){
      for(var p in debug.path) result+=debug.path[p]+'.';
      result+=i+'*\r\n';
    }
    // Mozilla bug when accessing document.domConfig
    if(i=='domConfig') continue;
    // Go deeper
    if((obj[i] instanceof Object || obj[i] instanceof Function) && debug.depth<max_depth) {
	    debug.depth++;
      debug.path.push(i);
	    result+=debug.finds(obj[i],needle,max_depth);
	    debug.depth--;
      debug.path.pop();
    }
  }
  if(debug.depth==0 && result=='') result="not found";
  return result;
}

debug.find = function(obj,needle,max_depth){
  console.log("Debug: ",debug.finds(obj,needle,max_depth));
}


/* ======================================================================== *\
   Load modules
\* ======================================================================== */
var http = require("http");
//var https = require('https');
var url = require("url");
var path = require("path");
var fs = require("fs");
var qs = require('querystring');

// External modules
var ini = require('ini');
var express = require('express');
//var formidable = require('formidable');
var WebSocketServer = require('ws').Server;

/* ======================================================================== *\
   Read configuration
\* ======================================================================== */
var config = ini.parse(fs.readFileSync('node-was.conf', 'utf-8'))
// Sainitize and validate
if(config.ip == undefined)
// Set lisner ip option
if(config.external_access.toLowerCase() == 'yes')
  config.ip='0.0.0.0';
else
  config.ip='127.0.0.1';
// Set lisner port
if(config.port == undefined) config.port=8080;
if(config.maxReqBodySize == undefined) config.maxReqBodySize=1000;
if(config.docRoot == undefined) config.docRoot="public";
var mumble=(config.debug_mode.toLowerCase()[0]=='y'); // make the server to output samples of whats going on
// Resolve path 
config.docRoot=path.normalize(config.docRoot);
if(config.docRoot.charAt(0) != '/') config.docRoot = __dirname + "/" + config.docRoot;
if(path.length == 1) {
  console.log("Can't serve files at: " + path);
  process.exit(1);
}

// console.log("Configuration:\n" + JSON.stringify(config,null,1));
console.log("========================================================================");
console.log("PHP-burner version: " + version);

// Catch errors
if(config.debug_mode.toLowerCase()[0]=='y'){
  process.on('uncaughtException', function (err) {
      console.error('An uncaughtException:');
      console.error(err);
      // process.exit(1);
  });
}

/* ======================================================================== *\
   Configure express 

   NB: The order of applying attributes will in some cases be reflected in 
   the order off its execution.
\* ======================================================================== */
var app = express();

app.disable('x-powered-by');
// By default, Express will use a generic HTML wrapper (a layout)
// to render all your pages. If you don't need that, turn it off.
// app.set('view options', {layout: false});

// Add support for GET, POST
app.use(express.json());
app.use(express.urlencoded());
// Enable file upload
// app.use(express.multipart()); 
// simulate DELETE and PUT with POST
app.use(express.methodOverride());

// Choose error handler
if(config.mode == 'debug')
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
else
  // Production 
  app.use(express.errorHandler());

/* ======================================================================== *\
   Set up routing serviceses (Middle ware)
\* ======================================================================== */
// Add websockets 
var server = http.createServer(app);
var wss = new WebSocketServer({server: server});
//var server = https.createServer(options, app);

// Middleware
app.use(app.router); 
// Check that file are on the allowed list
app.all(/./, function(request, response, next) {
  if(mumble) 
    console.log(request.client.remoteAddress 
      + " Request page: " + JSON.stringify(request.url) 
      + ((request.body != undefined && request.body.length>0) ? " With body ("+ request.body.length + ")":"")
    );
  // Allow all if undefined
  if(config.allowed != undefined
  && config.allowed[request._parsedUrl.pathname]== undefined){
    response.send(404);
    if(mumble) console.log(" Denied! Not on my list");
    return 0;
  }
  next('route');
})
 
// Catch root document
if(config.defaultRootDocument != undefined){
  app.all(/^\/$/, function(request, response, next) {
    request.url=config.defaultRootDocument;
    if(mumble) console.log(" Using root document default: " + config.defaultRootDocument);
    next('route');
  });
}

// Add PHP support
app.all(/\.php/, function(request, response, next) {
  // Check if resuested file exists
  fs.exists(config.docRoot + request._parsedUrl.pathname, function(exists){
    if (exists) {
      response.status(200);
      // Send response header

      // set content type text/html ?
      response.setHeader("Content-Type", "text/html");
   
      // Compose client information
      var connection = {};
      connection.header = request.headers;
      connection.pathname = request._parsedUrl.pathname;
      connection.query = request.query
      connection.remoteaddress = request.client.remoteAddress;
      connection.remoteport = request.client.remotePort;
      connection.url=request.url;
      connection.method=request.method;
      connection.httpversion=request.httpVersion
      connection.docroot=config.docRoot;

      connection.body=request.body;
      connection.files={};
      for(var f in request.files){
        connection.files[f]={};
        connection.files[f].name=request.files[f].name;
        connection.files[f].size=request.files[f].size;
        connection.files[f].tmp_name=request.files[f].path;
        connection.files[f].type=request.files[f].type;
      }
      // console.log("connection :");
      // console.log(connection);

      // Start PHP process
      var spawn = require("child_process").spawn;
      var arg=['php_burner.php'];
      php = spawn('php-cgi',['php_burner.php']);

      //Transfer header to php stdin
      php.stdin.write(JSON.stringify(connection));
      php.stdin.end();

      // Catch output from PHP scrit and send it to client
      // NB: Can't use send with streams. Must use write. (express will autoend)
      php.stdout.on('data', function (data) {
        // Add headers from PHP  
        if(!response.headersSent){
          // Assume PHP always send at least one header
          var header=true; 
          var line = data.toString().split("\r\n");
          for(var i in line){
            if(header && !response.headersSent){
              if(line[i].length >0){
                // Split header into name and value
                var split = line[i].indexOf(":");
                response.setHeader(line[i].substr(0,split),line[i].substr(split+2));
              }else if(i>0) 
                header=false;
            }else
              // End header and send body
              response.write(line[i]);
          }
        }else
          response.write(data);

      });

      // On the last output, end request
      php.stdout.on('end', function () {
        //console.log('PHP child process ended');
        response.end();
      });

      // Catch error output from PHP scrit and send it to client
      php.stderr.on('data', function (data) {
        // Error messages might come before the header is set.
        if(!response.headersSent){
          response.header('Content-Type', 'text/plain');
        }
        response.write(data.toString());
      });

    } else {
      // File not found
      if(mumble) console.log("  I don't know that file");
      response.send(404);
    }
  });

})

// Apply static page server for the rest
app.use(express.static(config.docRoot));
app.use(express.favicon(config.docRoot + '/favicon.ico')); 
console.log("Serving static files at: " + config.docRoot);

/* ======================================================================== *\
   Start listening
\* ======================================================================== */
// Listen on PORT and call function on incomming requests
server.listen(config.port,config.ip);
console.log("Server listening at: " + config.ip + ":" + config.port );
console.log("========================================================================");


/*======================================================================== *\
  Websocket event handler

  In this websocket implementation all actions and responces are treated as 
  event.

  Any process can initiate an action and any process can set up a watch to 
  listen for a certain event. When/if it occures a record of it will be send 
  to the requesting socket, with the optionally supplyed reveiver_id.
  The receiving script is the responsible for updating the proper HTML element 
  or what ever the page needs to do.

  A request is in the form of a json string.
  
  For this event handler to take any action the request must at leest specify 
  a request operation (opr) that coorsponds to an event handler function.
  Optionally with request data as parameter(s)
  Other element may be present or required. The describet element here must 
  all be of type string. But other object might be used and parsed to scripts 
  etc.

  Predefined event handler functions:

    watch:   .param contains event name to watch for   
             .reveiver_id optionally contains element indetifier
    unwatch: .param contains event name to delete from watch list. (No error 
             given if it does not exists)   
    php:     .param contains script name. All request elements are parsed as 
             $_REQUEST. Output of the script are send to the client (with 
             headers striped) in the html element.
             .reveiver_id (optionally) are returned
    serverGet: .param specify which data or special function are requested.
             .reveiver_id (optionally) are returned


    (timer:   perform a timer request.... ? on at every )


req
  opr
  param 
  receiver_id
  event
  socket
  req
  res
    

      
\*======================================================================== */
// Define event handler
var eventHandler = {};
eventHandler.watchList={};       // List of event names and who to tell
eventHandler.triggerList={};     // List of event triggers

// Receive connections
wss.on('connection', function(socket) {
  // Register time
  socket.opened = new Date().getTime();
  // Store unique identifier
  socket.fd=socket._socket._handle.fd;
  // Establish origin 
  // Authenticate
  // Emit event
  eventHandler.event({"socket":socket,"event":"new connection"});  
  
  // Set up incomming message handler
  socket.on('message', function(request) {
    if(mumble) console.log('Websocket received: %s', request);
    // See if request is a legal JSON
    try{
      var req=JSON.parse(request);
    }catch(e){
      if(mumble) console.log('Websocket parse Error: %s', e);
      return;
    }

    // Prepare responce
    req.socket=socket;
    req.res={};  
    req.res.receiver_id=req.receiver_id;
    // Performe operation
    if(eventHandler[req.opr] instanceof Function){
      // Execute the function of the operation 
      eventHandler[req.opr](req,function(req){
        // Emit event
        eventHandler.event(req);
      });  
    }else{
      if(mumble) console.log('Undefined websocket operation: ' + req.opr);
    }
  });
                      
  // Handle disconnections
  socket.on('close', function() {
    // Remove the watch
    eventHandler.unwatch({"socket":this});
  });

  // Report errors
  socket.onerror= function(error){
    if(mumble) console.log('Socket error: %s', error);
  };
});

wss.on('error', function(error) {
  if(mumble) console.log("Websocket error: " + error);
});

// Add a watch for event to watch list
eventHandler.watch=function(req,callback){
  
  // Handle a catch all request
  if(!req.param || req.param=='all' || req.param=='*'){ 
    req.param=='all';
  
  // Special treatment of the chat watch
  }else if(req.param=='chat'){
    // Send a frendly message
    req.res.origin="Server";
    req.res.data = "Hello. your ID is #"+req.socket.fd +" on my list.\n";
    req.res.data +="There are " + wss.clients.length + " clients on my list:\n"
    // List clients already on-line
    for(i in wss.clients)
      req.res.data += "User #" + wss.clients[i]._socket._handle.fd + "\n";
    if(req.socket.readyState==1) req.socket.send(JSON.stringify(req.res));
    // Tell others that a client joined 
    msg={};
    msg.res={};
    msg.socket=req.socket;
    msg.res.data="User #" + req.socket.fd + " joined the chat room";
    msg.event="chat";
    eventHandler.event(msg);
  }

  // Initialize first use of watch name by making it an array
  if(!eventHandler.watchList[req.param]) eventHandler.watchList[req.param] =[];  
  // Add socket and optionally reveiver_id to array
  eventHandler.watchList[req.param].push({"socket":req.socket,"receiver_id":req.receiver_id});
//debug(eventHandler.watchList[req.param][eventHandler.watchList[req.param].length-1],1 );
  // Call back
  if(callback instanceof Function) callback(req);

}


// Remove a watch or all watches for a socket
eventHandler.unwatch=function(req,callback){

  // Delete one instance
  if(!!req && !!req.param){
    // Find event name
    for(var i in eventHandler.watchList[req.param])
      // Find entry for this socket
      if(eventHandler.watchList[req.param][i].socket==req.socket 
        && ( !id || eventHandler.watchList[req.param][i].id==id))
        delete eventHandler.watchList[req.param][i];

  // Delete all instances to a socket
  }else if(!!req.socket){
    for(var i in eventHandler.watchList)
      for(var ii in eventHandler.watchList[i])
        if(eventHandler.watchList[i][ii].socket==req.socket){
          delete eventHandler.watchList[i][ii];
          // Handle special cases
          if(i=="chat"){
            req.event="chat";
            req.res={};
            req.res.data="User #" + req.socket.fd + " Has left the chat room";
            // Tell the other chatters
            eventHandler.event(req);
          }
        }
  }
  // Call back
  if(callback instanceof Function) callback(req);
}

// Emit event
eventHandler.event=function(req,callback){

  if(!req) return;
  // Determin event name
  if(!req.event){
    if(req.opr=='event'){
      if(!!req.param){
        req.event=req.param;
      }else{
        req.event='all';
      }
    }else if(!!req.opr){
      req.event=req.opr;
    }else if(!!req.receiver_id){
      req.event=req.receiver_id;
    }else{ 
      return;
    }
  }

  // add origin  (Find better id: page name, IP, device name etc.)   
  if(!!req.socket) req.origin=req.socket.fd;

  // Find name of event in watch list
  for(var name in eventHandler.watchList) {
    // Skip all that dosen't match event name    
    if(name!=req.event && name!='all') continue;
    // Find listners for this event
    for(var i in eventHandler.watchList[name] ){
      // Exclude current client as it already got the message
      if(eventHandler.watchList[name][i].socket==req.socket) continue;
      // See if client are on-line
      if(eventHandler.watchList[name][i].socket.readyState!=1) continue;
      //Compose message
      if(!req.res) req.res={};
      req.res.receiver_id=eventHandler.watchList[name][i].receiver_id;
      // Tell listners
      eventHandler.watchList[name][i].socket.send(JSON.stringify(req.res));
// console.log({"Send event to":eventHandler.watchList[name][i].socket._socket._handle.fd },req);
    }
  }

  // Activate triggers
  for(var name in eventHandler.triggerList) {
    // Check for loop
    // ...
  }
  // Call back
  if(callback instanceof Function) callback(req);
}

// Execute timer command
eventHandler.setTimer=function(req,callback){

 // ...
  // Call back
  if(callback instanceof Function) callback(req);

};


// Execute script to handle PHP request
eventHandler.php = function(req,callback){

  // Compose request information
  var connection = {};
  connection.pathname = req.param;
  connection.wsquery = req.req;
  connection.remoteaddress = req.socket._socket.remoteAddress;
  connection.remoteport = req.socket._socket.remotePort;
  connection.url=req.socket.upgradeReq.url;
  connection.method='websocket';
  connection.docroot=config.docRoot;
  connection.header =req.socket.upgradeReq.headers;
  connection.httpversion=req.socket.httpVersion

  //console.log({"connection":connection});

  // Start PHP process
  var spawn = require("child_process").spawn;
  php = spawn('php-cgi',['php_burner.php']);

  //Transfer request to php stdin
  php.stdin.write(JSON.stringify(connection));
  php.stdin.end();

  req.header=true; 
  req.res={};
  req.res.html='';
  
  // Catch output from PHP scrit 
  php.stdout.on('data', function (data) {
// console.log(data.toString());
    // Assume PHP always send at least one header: header ends with empty line
    if(req.header){
      var line = data.toString().split("\r\n\r\n");
      if(line.length>1){
        req.header=false;
        req.res.html+=line[1];
      }
    }else
       req.res.html += data.toString();
  });

  // Catch error output from PHP scrit and send it to client
  php.stderr.on('data', function (data) {
//console.log(data.toString());
    req.res.html += data.toString();
  });

  // On the last output, end request
  php.stdout.on('end', function () {
    // Compose reply
    if(!!req.receiver_id) req.res.receiver_id=req.receiver_id;
    req.res.origin="Client"; // we can do better!
    // If out5put is a json, convert it to an object
    try{
      req.res.json=JSON.parse(req.res.html);
      req.res.html='';
    }catch (e){
    }
    // Send responce to client
    if(req.socket.readyState==1) req.socket.send(JSON.stringify(req.res));          
//console.log('PHP child process ended' + JSON.stringify(req.res));
    // Call back
    if(callback instanceof Function) callback(req);
  });
}

// Chat 
eventHandler.chat=function(req){
  // Compose reply
  req.res.data=req.param;
  req.res.receiver_id=req.receiver_id;
  req.res.origin=req.socket.fd; // we can do better!
  // Send responce to client
  if(req.socket.readyState==1) req.socket.send(JSON.stringify(req.res));          
}

// Start a clock event that sends the time every second
eventHandler.clock = setInterval(function() {
	var t = Date().toString();
  var req = {};
  req.res={};
  req.event="time";
  req.res.origin="Server";
  req.res.data = t.substr(16,8);
  eventHandler.event(req);
}, 1000);


/* ======================================================================== *\
   serverGet 

   Present assortment of information available to the server, in HTML format
   receiver_id are used as id when createing a div element to replace the 
   existing one. 
\* ======================================================================== */
eventHandler.serverGet=function(req,callback){

  // Make wrapping
  req.res.html = '<div id="'+req.receiver_id+'">'
  // Get content acording to request
  if(req.param=='all'){
    service = [
       'version'
      ,'memory'
      ,'privileges'
      ,'modules'
      ,'platform'
      ,'configuration'
      ,'websockets'
      ,'watch_list'
      ,'timers'
      ,'triggers'
    ]
    for(var i in service ){
      req.res.html += getInfo(service[i]) + '<br>';
    }
  }else{
    req.res.html += getInfo(req.param);
  }  

  // Wrap up and send
  req.res.html += '</div>';
  if(req.socket.readyState==1) req.socket.send(JSON.stringify(req.res)); 
  return;

  // Return a table of a specific piece information
  function getInfo(info){
    var html = '';
    switch(info){
      case 'version':
        html = '<table class="_info"><tr><th colspan="2">Websocket Application Server<br>version: '
          + version +'</th></tr></table>';
        break;

      case 'memory':
        html ='<table class="_info"><tr><th colspan="2">Memory usages</th></tr>'
          + '<tr><td>In RAM memory:</td><td>' + process.memoryUsage().rss +'</td></tr>'
          + '<tr><td>V8 Heap total:</td><td>' + process.memoryUsage().heapTotal +'</td></tr>'
          + '<tr><td>V8 Heap used:</td><td>' + process.memoryUsage().heapUsed +'</td></tr>'
          + '</table>';
        break;

      case 'privileges':
        html ='<table class="_info"><tr><th colspan="2">Privileges</th></tr>'
          + '<tr><td>User ID:</td><td>' +  process.getuid() + '</td></tr>'
          + '<tr><td>Group ID:</td><td>' + process.getgid() + '</td></tr>'
          + '<tr><td>File create mask:</td><td>' + ('000' + process.umask().toString(8)).substr(-3)
          + '</td></tr>'
          + '</table>';
        break;

      case 'modules':
        html = '<table class="_info"><tr><th colspan="2">Modules versions</th></tr>';
        for (var i in process.versions) 
          html += '<tr><td>' + i + '</td><td>' + process.versions[i] +'</td></tr>';
        html += '</table>';
        break;

      case 'platform':
        html = '<table class="_info"><tr><th colspan="2">Platform</th></tr>'
          + '<tr><td>architecture:</td><td>' +  process.arch + '</td></tr>'
          + '<tr><td>Operating system:</td><td>' + process.platform + '</td></tr>'
          + '<tr><td>Up time:</td><td>' + process.uptime() + '</td></tr>'
          + '</table>';
        break;

      case 'configuration':
        html = '<table class="_info"><tr><th colspan="2">Configuration</th></tr>';
        for (var i in config) {
          html += '<tr><td>' + i + '</td><td>';
          if(config[i].constructor === Object || config[i].constructor === Array)
            html += '<pre>' + JSON.stringify(config[i], null, 2) +'</pre></td></tr>';
          else
            html += config[i] + '</td></tr>';
        }
        html += '</table>';
        break;

      case 'websockets':
        html = '<table class="_info"><tr><th colspan="3">Websocket clients</th></tr>';
        for(i in wss.clients){
          html += '<tr><td>fd #' + wss.clients[i]._socket._handle.fd;
          if(wss.clients[i]._socket._handle.fd == req.socket.fd)
            html += ' *You* ';
          html += '</td><td> IP:' + wss.clients[i]._socket.remoteAddress 
            + ":" +  + wss.clients[i]._socket.remotePort 
            + '</td><td>'+ (new Date().getTime() - wss.clients[i].opened) + '</td></tr>';
        }
        html += '</table>';
        break;
      
      case 'watch_list':
        html = '<table class="_info"><tr><th colspan="2">Watch list</th></tr>';
        for (var i in eventHandler.watchList) {
          html += '<tr><td>' + i + '</td><td>';
          for(var ii in eventHandler.watchList[i]){
            if(eventHandler.watchList[i][ii].socket.readyState==1)
              html += '#' + eventHandler.watchList[i][ii].socket._socket._handle.fd 
                + ' -> '+ eventHandler.watchList[i][ii].receiver_id + '<br>';
            else
              html +='closed<br>';  
          }
          html += '</td></tr>'
        }
        html += '</table>';
        break;

      case 'timers':
/*
        html = '<table class="_info"><tr><th colspan="2">Timer events</th></tr>';
        for (var i in eventHandler.timerList) {
          html += '<tr><td>' + i + '</td><td>';
          for(var ii in eventHandler.timerList[i]){
            html += '#' + eventHandler.timerList[i][ii].socket._socket._handle.fd 
              + ' -> '+ eventHandler.timerList[i][ii].id + '<br>';
          }
          html += '</td></tr>'
        }
        html += '</table>';
*/
        break;

      case 'triggers':
/*
        html = '<table class="_info"><tr><th colspan="2">Event triggers</th></tr>';
        for (var i in eventHandler.timerList) {
          html += '<tr><td>' + i + '</td><td>';
          for(var ii in eventHandler.timerList[i]){
            html += '#' + eventHandler.timerList[i][ii].socket._socket._handle.fd 
              + ' -> '+ eventHandler.timerList[i][ii].id + '<br>';
          }
          html += '</td></tr>'
        }
        html += '</table>';
*/
        break;
      default:
        html='Unknown server information:' + info;
    }

    return html;
  }

  // Call back
  if(callback instanceof Function) callback(req);
}


// Static function demo (server internal function)
eventHandler.staticFunc=function(req,callback){
  req.res={};  
  // Handle demo switches
  switch(req.param){
  // Toggle switch demo
  case 'on':
    req.res.html='<div id="'+req.receiver_id+'" class="on" onclick="cmdjs(this.id,\'off\');">ON</div>';
    req.res.receiver_id=req.receiver_id;
    if(!req.event) req.event=req.receiver_id;
    break;

  case 'off':
    req.res.html='<div id="'+req.receiver_id+'" class="off" onclick="cmdjs(this.id,\'on\');">OFF</div>';
    req.res.receiver_id=req.receiver_id;
    if(!req.event) req.event=req.receiver_id;
    break;
  default:
    return;
  }  
  // Send responce  
  if(req.socket.readyState==1) req.socket.send(JSON.stringify(req.res)); 
  // Call back
  if(callback instanceof Function) callback(req);
}

