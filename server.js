/*============================================================================*\
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

\*============================================================================*/
var version='0.1.0 - Proof of concept';

/*============================================================================*\
  Debug functions (to be removed)
\*============================================================================*/
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
    if(typeof(obj[i]) === "object"){
	    result+=tab+'['+i+']=>\r\n';
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
  if(typeof(obj) !=="object") return "Not an object\n";
  var result='';
  if(!max_depth) max_depth=0;
  if(debug.depth==0) path=[];
  for(var i in obj){
    // Match
    if(i.toLowerCase()==needle.toLowerCase()){
      for(var p in debug.path) result+=debug.path[p]+'.';
      result+= i+'\r\n';
    }
    // Mozilla bug when accessing document.domConfig
    if(i=='domConfig') continue;
    // Go deeper
    if(typeof(obj[i])==="object" && debug.depth<max_depth) {
	    debug.depth++;
      debug.path.push(i);
	    result+=debug.finds(obj[i],needle,max_depth);
	    debug.depth--;
      debug.path.pop();
    }
  }
  if(debug.depth==0 && !result) result="not found";
  return result;
}

debug.find = function(obj,needle,max_depth){
  console.log("Find: ",debug.finds(obj,needle,max_depth));
}


/*============================================================================*\
  Load modules
\*============================================================================*/
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

/*============================================================================*\
  Read configuration
\*============================================================================*/
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
console.log("WAS version: " + version);

// Catch errors
if(config.debug_mode.toLowerCase().charAt(0)!='y'){
  process.on('uncaughtException', function (err) {
      console.error('An uncaughtException:');
      console.error(err);
      // process.exit(1);
  });
}

/*============================================================================*\
  Configure express 

  NB: The order of applying attributes will in some cases be reflected in 
  the order off its execution.
\*============================================================================*/
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
if(config.debug_mode.toLowerCase().charAt(0)=='y'){
//  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
}else{
  // Production 
  //app.use(express.errorHandler());
}
/*============================================================================*\
  Set up routing serviceses (Middle ware)
\*============================================================================*/
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
  var debug=true;

  // Save responce in scope with a closure function
  (function(res) {
    nscript.launch('php',request,function(event,data,param){
      switch (event){
      case 'status':
        res.status(data);
        if(debug) console.log("Status: %s",data);
        break;
      case 'header':
        res.setHeader(data,param);
        if(debug) console.log("Header: '%s: %s'",data,param);
        break;
      case 'data':
        res.write(data);
        if(debug){ 
          if(data.toString().length<100)
            console.log("Data: '%s'",data);
          else
            console.log("Data: *** length: ",data.length);
        }
        break;
      case 'end':
        res.end();
        if(debug) console.log("End of request");
        break;
      case 'error':
        if(mumble) console.log('Node Scripting launcher error: %s',data);
        nreak;
      default:
        if(debug) console.log("Unknown event: '%s'",event);
      }
    });
  })(response);
});


// Apply static page server for the rest
app.use(express.static(config.docRoot));
app.use(express.favicon(config.docRoot + '/favicon.ico')); 
console.log("Serving static files at: " + config.docRoot);

/*============================================================================*\
  Start listening
\*============================================================================*/
// Listen on PORT and call function on incomming requests
server.listen(config.port,config.ip);
console.log("Server listening at: " + config.ip + ":" + config.port );
console.log("========================================================================");


/*============================================================================*\
   Node Script launcher

   Library to launch script languages

   Callbacks
     on status 
     on header
     on data including error (Make a config parameter to exclude stderr)
     on end
     on error ?

   Make sure on header can't be called after on data (Scrap headers or put them in data)

   have separate support for websockets and static
     
   Treat static and websocket requests differantly:
     ws has no headers 
     ws has a differant request structure   
    

\*============================================================================*/
var nscript={};
nscript.launcher={};
nscript.docRoot = config.docRoot || './';
nscript.defaultRootDocument = config.defaultRootDocument;

nscript.launch = function(type,request,callback){

  //Check that callback are a function
  if(!(nscript.launcher[type] instanceof Function)){
    callback('error','NSL has no support for script of type: ' + type);
    return;
  }

  //Compose information on client request
  var connection = {};
  connection.files={};

  try{
    // support for express request
    if(!!request._parsedUrl){
      connection.header = request.headers || '';
      connection.pathname = request._parsedUrl.pathname || '';
      connection.query = request.query || ''
      connection.remoteaddress = request.client.remoteAddress || '';
      connection.remoteport = request.client.remotePort || '';
      connection.url=request.url || '';
      connection.method=request.method || '';
      connection.httpversion=request.httpVersion || '';
      connection.body=request.body || '';
      for(var f in request.files){
        connection.files[f]={};
        connection.files[f].name=request.files[f].name;
        connection.files[f].size=request.files[f].size;
        connection.files[f].tmp_name=request.files[f].path;
        connection.files[f].type=request.files[f].type;
      }

    // Support for WS (Websockets)
    }else if(!!request.socket.upgradeReq){
      connection.remoteaddress = request.socket._socket.remoteAddress || '';
      connection.remoteport = request.socket._socket.remotePort || '';
      connection.url=request.socket.upgradeReq.url || '';
      connection.header =request.socket.upgradeReq.headers || '';
      connection.httpversion=request.socket.upgradeReq.httpVersion || '';

      // WAS support
      connection.method='WS';
      connection.pathname = request.pathname;
      connection.query = request.query;
    // Unsupported resuest type
    }else{
      callback('error',"Unrecognized request type. Can't find client information");
      return;
    }

  }catch(e){
    callback('error',"Unrecognized request type: "+ e);
    return;
  }

  // Add basic information
  connection.docroot=nscript.docRoot;

  // Validate path name
  // Check/Make pathname a full path from from document root
  if(connection.pathname.charAt(0) !='/') connection.pathname = '/' + connection.pathname;
  // Use default script
  if(connection.pathname.length <2) connection.pathname = nscript.defaultRootDocument;
  // Check that script exists
  fs.exists(nscript.docRoot + connection.pathname, function(exists){
    if (exists) {
      // Send status OK
      callback('status',200);

      // Launch script
      nscript.launcher[type](connection,callback);
    }else{
      // Send status Not found
      callback('status',404);
    }
  });
}

 
/*============================================================================*\
  PHP cgi support

  Using the command php-cgi  
  Using the script php_burner.php as a launcher script
   

  Quirks:
    1. pgp-cgi might send error text formatted in HTML before the headers
      Fix: 1. set a default header Content-type: text/html and remove duplicates
           2. error messages must be stores until headers are send.
    2. php-cgi might send a header i one block and the line ending in another
      Fix: buffer all headers until end of header section are received
    3. the phpinfo() function requests pseudo pages for logo images.

    for strange 404 see http://woozle.org/~neale/papers/php-cgi.html

  Maximum header section length is hardcoded to 4K, to prevent unreasonable 
  memory usages. Are there any reason for a larger buffer size?
  Maximum error body length are hardcoded to 4K too
\*============================================================================*/
nscript.launcher.php = function(connection,callback) {
  // Start child process
  var proc = require("child_process").spawn('php-cgi',['php_burner.php']);

  //Transfer connection request informastion to stdin
  proc.stdin.write(JSON.stringify(connection));
  proc.stdin.end();

  // Get ready for output from the process
  function handleOutput(proc,callback){
    var buffer='';
    var bbuffer='';
    var eoh=-1;
    var headersSent=false;
    var end=false;
    var headers={'Content-type':'text/html'}; // Fix 1.1

    // Catch output from scrit and send it to client
    proc.stdout.on('data', function (data) {
      if(end) return;

      // Headers. Assume script always send at least one header
      if(!headersSent){
        // Store headers until a end of header is receiverd (\r\n\r\n) Strip \r
        buffer+=data.toString().replace(/\r/g,'');
        // Look for end of header section
        eoh=buffer.indexOf('\n\n');
        if(eoh>0 || buffer.length > 4096){
          // Separate headers from body parts
          bbuffer+=buffer.substr(eoh+2);
          buffer=buffer.substr(0,eoh+1);

          // Divide heades lines  
          var div =-1;
          var line=buffer.split('\n');
          for(var i in line){
            // Split header into key, value pairs
            div = line[i].indexOf(":");
            if(div>0)
              // remove dublicate headers so that last one counts
              headers[ line[i].substr(0,div) ] = line[i].substr(div+2);
          }

          // Send headers
          for(var i in headers)
            callback('header',i,headers[i]);
          headersSent=true;

          // Send body part if any
          if(bbuffer.length>0){
            callback('data',bbuffer);
            bbuffer='';
          }
        }
      
      // Body
      }else
        callback('data',data);
    });

    // Error. Catch standart error output from script
    proc.stderr.on('data', function (data) {
      if(end) return;
      // Fix 1.2 Store error messages until headers are sent
      if(!headersSent){
        if(bbuffer.length<4096)
          bbuffer+=data.toString();
      }else
        callback('data',data.toString());
    });

    // End request
    proc.stdout.on('end', function () {
      if(bbuffer.length>0)
        callback('data',bbuffer);
      end=true;
      callback('end');
    });
  }

  handleOutput(proc,callback);

}



/*============================================================================*\
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
      
\*============================================================================*/
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
    req.res={};  
    req.res.receiver_id=req.receiver_id;
    req.socket=socket;

    // Performe operation
    if(eventHandler[req.opr] instanceof Function){

      // Preserve scope of request with a closure function
      (function (req){
        // Execute the function of the operation 
        eventHandler[req.opr](req,function(req){
          // Emit event
          eventHandler.event(req);
        });  
      })(req);

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

/*============================================================================*\
  Event functions
\*============================================================================*/
// Emit event
eventHandler.event=function(req,callback){

  if(!req) return;
  // Determin event name
  if(!req.event){
    // If operation is 'event' parameter are the event name
    if(req.opr=='event'){
      if(!!req.param){
        req.event=req.param;
      }else{
        req.event='all';
      }
    // Default to operation as event name
    }else if(!!req.opr){
      req.event=req.opr;
    // secondary default to receiver_id as event name
    }else if(!!req.receiver_id){
      req.event=req.receiver_id;
    }else{ 
      return;
    }
  }

  // add origin  (Find better id: page name, IP, device name etc.)   
  if(!!req.socket) req.origin=req.socket.fd;

  if(mumble) var txt=''; 

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
      if(mumble) txt += eventHandler.watchList[name][i].socket.fd + ',';
    }
  }

  if(mumble && req.event!='time') console.log('Event: %s Sent to socket: %s', req.event,txt); 

  // Activate triggers
  for(var name in eventHandler.triggerList) {
    // Check for loop
    // ...
  }
  // Call back
  if(callback instanceof Function) callback(req);
}


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


// Execute timer command
eventHandler.setTimer=function(req,callback){

 // ...
  // Call back
  if(callback instanceof Function) callback(req);

};


// PHP Execute script request
eventHandler.php = function(req,callback){
  var debug=true;

  // Make a NSL request
  var nscriptReq={};
  nscriptReq.pathname=req.param;
  nscriptReq.query=req.query;
  nscriptReq.socket=req.socket;    

  // Prepare responce
  req.res={};
  req.res.html='';
  req.res.headers={};
  req.res.receiver_id=req.receiver_id;

  // Save responce in scope with a closure function
  (function(res) {
    nscript.launch('php',nscriptReq,function(event,data,param){
      switch (event){
      case 'status':
        req.res.status=data;
        if(debug) console.log("Status: %s",data);
        break;
      case 'header': // Buffer headers
        req.res.headers[data]=param;
        if(debug) console.log("Header: '%s: %s'",data,param);
        break;
      case 'data': // Buffer data
        req.res.html += data;
        if(debug){ 
          if(data.toString().length<100)
            console.log("Data: '%s'",data);
          else
            console.log("Data: *** length: ",data.length);
        }
        break;
      case 'end': // Send responce to client
        if(req.socket.readyState==1) req.socket.send(JSON.stringify(req.res));          
        if(debug) console.log("End of request");
        break;
      case 'error':
        if(mumble) console.log('Nscript error: %s',data);
        nreak;
      default:
        if(debug) console.log("Unknown event: '%s'",event);
      }
    });
  })(req);
}

// Chat 
eventHandler.chat=function(req,callback){
  // Compose reply
  req.res.data=req.param;
  req.res.receiver_id=req.receiver_id;
  req.res.origin=req.socket.fd; // we can do better!
  // Send responce to client
  if(req.socket.readyState==1) req.socket.send(JSON.stringify(req.res));  
  // Call back
  if(callback instanceof Function) callback(req);        
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


/*============================================================================*\
  serverGet 

  Present assortment of information available to the server, in HTML format
  receiver_id are used as id when createing a div element to replace the 
  existing one. 
\*============================================================================*/
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
        break;

      case 'triggers':
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

