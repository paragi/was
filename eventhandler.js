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


  SSL: var server = https.createServer(options, app);
      
\*============================================================================*/

// Include modules
var WebSocketServer = require('ws').Server;
var nscript = require('./nscript');

// Set version
process.versions.event_handler='0.1.0 - Getting started';

// Define event handler
var eventHandler = {};
module.exports = exports = eventHandler;

eventHandler.watchList={};       // List of event names and who to tell
eventHandler.triggerList={};     // List of event triggers

// Attach websocket to server
eventHandler.attachServer = function(server){
  wss = new WebSocketServer({server: server});

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
      if(logMode>=mumble) console.log('Websocket received: %s', request);
      // See if request is a legal JSON
      try{
        var req=JSON.parse(request);
      }catch(e){
        if(logMode>=mumble) console.log('Websocket parse Error: %s', e);
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
        if(logMode>=mumble) console.log('Undefined websocket operation: ' + req.opr);
      }
    });
                        
    // Handle disconnections
    socket.on('close', function() {
      // Remove the watch
      eventHandler.unwatch({"socket":this});
    });

    // Report errors
    socket.onerror= function(error){
      if(logMode>=mumble) console.log('Socket error: %s', error);
    };
  });

  wss.on('error', function(error) {
    if(logMode>=mumble) console.log("Websocket error: " + error);
  });
}

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

  if(logMode>=verbose) var txt=''; 

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
      // add origin  (Find better id: page name, IP, device name etc.)   
      if(!!req.socket) 
        req.res.origin='User #' + req.socket.fd; 
      // Tell listners
      eventHandler.watchList[name][i].socket.send(JSON.stringify(req.res));
      if(logMode>=verbose) txt += eventHandler.watchList[name][i].socket.fd + ',';
    }
  }

  if(logMode>=verbose && req.event!='time') console.log('Event: %s Sent to socket: %s', req.event,txt); 

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
    msg.res.data="joined the chat room";
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
            req.res.data="Has left the chat room";
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
eventHandler.exec = function(req,callback){
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
  (function(req) {
    nscript.launch('php',nscriptReq,function(event,data,param){
      switch (event){
      case 'status':
        req.res.status=data;
        if(logMode>=verbose) console.log("Status: %s",data);
        break;
      case 'header': // Buffer headers
        req.res.headers[data]=param;
        if(logMode>=verbose) console.log("Header: '%s: %s'",data,param);
        break;
      case 'data': // Buffer data
        req.res.html += data;
        if(verbose){ 
          if(data.toString().length<100)
            console.log("Data: '%s'",data);
          else
            console.log("Data: *** length: ",data.length);
        }
        break;
      case 'end': // Send responce to client
        if(req.socket.readyState==1) req.socket.send(JSON.stringify(req.res));          
        if(verbose) console.log("End of request");
        // Call back
        if(callback instanceof Function) callback(req);        
        break;
      case 'error':
        if(logMode>=mumble) console.log('Nscript error: %s',data);
        break;
      default:
        if(verbose) console.log("Unknown event: '%s'",event);
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
          + global.config.version +'</th></tr></table>';
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
        if( GLOBAL.config != undefined){ 
          var config=GLOBAL.config;
          for (var i in config) {
            html += '<tr><td>' + i + '</td><td>';
            if(config[i].constructor === Object || config[i].constructor === Array)
              html += '<pre>' + JSON.stringify(config[i], null, 2) +'</pre></td></tr>';
            else
              html += config[i] + '</td></tr>';
          }
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

