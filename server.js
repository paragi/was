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
var version='0.1.2 - Spawn in 3';

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
    if(typeof(obj[i]) === "object" && obj[i] !== undefined){
	    result+=tab+'['+i+']=>\r\n';
	    if(debug.depth<max_depth) {
		    debug.depth++;
		    result+=debug.prints(obj[i],max_depth);
		    debug.depth--;
	    }
    }else if(typeof(obj[i]) == "function")
	    result+=tab+'['+i+']=>(Function)\r\n';
    else{
	    if(obj[i] !== undefined) str=''+obj[i];
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
//var https = require('https');var url = require("url");
var path = require("path");
var fs = require("fs");
var qs = require('querystring');

// External modules
var ini = require('ini');
var express = require('express');
var wildcard = require('wildcard');
var nscript = require('./nscript');
var eventHandler = require('./eventhandler.js');


/*============================================================================*\
  Read configuration
\*============================================================================*/
//Make sure its global (no var)
// module.exports = exports = S
global.config = ini.parse(fs.readFileSync('node-was.conf', 'utf-8'));
// Sainitize and validate
config.version = version;
// Set lisner ip option
if(config.externalAccess.toLowerCase().charAt(0) == 'y')
  config.ip='0.0.0.0';
else
  config.ip='127.0.0.1';
// Set lisner port
if(config.port == undefined) config.port=8080;
if(config.maxReqBodySize == undefined) config.maxReqBodySize=1000;
if(config.docRoot == undefined) config.docRoot="public";
// Log modes
off=0;
errors=1;
notes=2;
mumble=3;
verbose=4;
// Log mode given as a number
if(config.logMode >=1 && config.logMode <=4)
  logMode=config.logMode;
// Log mode given as a word
else
  logMode=['','errors','notes','mumble','verbose'].indexOf(config.logMode.toLowerCase());
if(logMode<0) logMode=0;
// Disable logging
if(!!config.logging && config.logging.toLowerCase() != 'on') logMode=0;
// Resolve path 
config.docRoot=path.normalize(config.docRoot);
if(config.docRoot.charAt(0) != '/') config.docRoot = __dirname + "/" + config.docRoot;
if(path.length == 1) {
  console.log("Can't serve files at: " + path);
  process.exit(1);
}
// Move filenames containing wildcards to an array. wildcards: * and ? 

// Use wildcard('foo.*', 'foo.bar'); // true
if(!!config.allowed){
  config.allowedWildcard=[];
  for(var i in config.allowed){
    if(i.length<1) continue;
    // test if filename contains wildcards
    if(i.indexOf("*")>=0 || i.indexOf("?")>=0){
      config.allowedWildcard.push(i);
      delete config.allowed[i];
    }
  }
}

console.log("========================================================================");
console.log("WAS version: " + version);
console.log("Logging mode: %s (%s)",['off','errors','notes','mumble','verbose'][logMode],logMode);
console.log("Configuration:\n" + JSON.stringify(config,null,1));
console.log("Testing \\ test");
/*============================================================================*\
  Configure express 

  NB: The order of applying attributes will in some cases be reflected in 
  the order off its execution.
\*============================================================================*/
var app = express();
var server = http.createServer(app);

// Add websockets event handler
eventHandler.attachServer(server);

// Handle startup errors
server.on('error',function(err){
  console.log ( 'Server error:', err.message);
  process.exit(1);
});

// Change user ID
//  Only root can listen on ports under 1024. But we don't want to run the server
//  as root. 
server.on('listening',function(){
  if (!!config.userid && process.getuid && process.setuid) {
    var uID = process.getuid();
    try {
      process.setuid(config.userid);
      console.log('Changing user ID from: %s to: %s',uID,config.userid);
    }
    catch (err) {
      console.log('Unable to change user ID: ' + err);
    }
  }

  var uID = process.getuid();
  if(uID === 0) 
    console.log('NB: Server is running as root. !!!!');
  else
    console.log('Server is now running as user ID: ' + process.getuid());

  console.log("========================================================================");
});


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
if(config.debugMode.toLowerCase().charAt(0)=='y'){
  // app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
}else{
  // Production 
  //app.use(express.errorHandler());
}
/*============================================================================*\ 
  Set up routing serviceses (Middle ware)
\*============================================================================*/

// Middleware
app.use(app.router); 

// Convert a string with wilecards (* and ?) into a regex string
// It was hard to make, so it should be even harder to understand :o)
// RegExp((str + '').replace(RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g'), '\\$&')

// .replace(/\\\*/g, '.*').replace(/\\\?/g, '.')
function globStringToRegex(str) {
  return (str + '').replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
}

// Check that file are on the allowed list
app.all(/./, function(request, response, next) {

  if(logMode>=mumble) 
    console.log(request.client.remoteAddress 
      + " Request page: " + JSON.stringify(request.url) 
      + ((request.body != undefined && request.body.length>0) ? " With body ("+ request.body.length + ")":"")
    );
 
  // Test if file are allowed
  var allowed=false;
  if(!config.allowed[request._parsedUrl.pathname]){
    // Test if it matches wildcard expression
    for(var i in config.allowedWildcard){
      if(wildcard(config.allowedWildcard[i],request._parsedUrl.pathname))
        allowed=true;
    }
  }else
    allowed=true;
        

  // reject 
  if(!allowed){
    response.send(404);
    if(logMode>=mumble) console.log(" Denied! " +request._parsedUrl.pathname + " Not on my list");
    return 0;

  }

  next('route');
})
 
// Catch root document
if(config.defaultRootDocument != undefined){
  app.all(/^\/$/, function(request, response, next) {
    request.url=config.defaultRootDocument;
    if(logMode>=mumble) console.log(" Using root document default: " + config.defaultRootDocument);
    next('route');
  });
}

// Add Dynamic script support
nscript.docRoot = config.docRoot;
nscript.defaultRootDocument = config.defaultRootDocument;
nscript.cgiEngine = config.cgiEngine;
app.all(/./,nscript.expressLaunch);

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

/*============================================================================*\
  Error handler 
\*============================================================================*/
// Catch errors
if(config.debugMode.toLowerCase().charAt(0)!='y'){
  process.on('uncaughtException', function (err) {
      console.error('An uncaughtException:');
      console.error(err);
      // process.exit(1);
  });
}
