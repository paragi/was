/*============================================================================*\
  Node Dynamic Script Launcher

  Callback on
    status 
    header
    data (including stderr) 
    end
    error 

  notes:
    Websockets has a differant request structure from staticpage requests  
    
  Make a config parameter to exclude stderr
  make express view engine compatible
\*============================================================================*/

var fs = require('fs');
var http = require("http");
//var https = require('https');
var url = require("url");
var path = require("path");
var qs = require('querystring');

// Set moduile version
process.versions.Nscript='0.1.1 - Proving a point';

// Define nscript object
var nscript = {};
module.exports = exports = nscript;

/*============================================================================*\
  Import configuration variables or if missing, set defaults
\*============================================================================*/
nscript.docRoot = nscript.docRoot || './';
nscript.defaultRootDocument = nscript.defaultRootDocument || '';
nscript.cgiEngine = nscript.cgiEngine || {};
/*
nscript.docRoot = config.docRoot || './';
nscript.defaultRootDocument = config.defaultRootDocument || '';
nscript.cgiEngine = config.cgiEngine || {};
*/

nscript.launcher={};

/*============================================================================*\
  Make array of file extentions that are supported with Launchers

to be removed

\*============================================================================*/
nscript.launchers= function (){
  var arr=[];

  for(var ext in nscript.cgiEngine) 
    arr.push(ext);

  return arr;
}

/*============================================================================*\
  Launch dynamic script 
   - prepare client information for the script to use
   - select the launcing method

  
child.stderr.setEncoding('utf8')
  child.stdout.setEncoding('utf8')

\*============================================================================*/
nscript.launch = function(type,request,callback){
  
  //Check that callback are a function
  if(!nscript.cgiEngine[type]){
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
,
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

    // Support for WS websockets
    }else if(!!request.socket.upgradeReq){
      connection.remoteaddress = request.socket._socket.remoteAddress || '';
      connection.remoteport = request.socket._socket.remotePort || '';
      connection.url=request.socket.upgradeReq.url || '';
      connection.header =request.socket.upgradeReq.headers || '';
      connection.httpversion=request.socket.upgradeReq.httpVersion || '';

      // event handler support
      connection.method='WS';
      connection.pathname = request.pathname;
      connection.query = request.query;

    // Unsupported resuest type
    }else{
      throw ("Unable to complie client request information");
    }

  }catch(e){
    callback('error',"Unrecognized request type: "+ e);
    return;
  }

  // Add some basic information
  connection.docroot=path.resolve(nscript.docRoot);

  // Validate path name
  // Check/Make pathname a full path from from document root
  connection.pathname = path.normalize('/' + connection.pathname);

  // Use default script name
  if(connection.pathname.length <2) 
    connection.pathname = nscript.defaultRootDocument;

  // Check that script exists
  fs.exists(nscript.docRoot + connection.pathname, function(exists){
    if (exists) {
      // Launch script
      if(type == 'php')
        nscript.launcher.php(nscript.cgiEngine[type],connection,callback);
      else
        nscript.launcher.cgi(nscript.cgiEngine[type],connection,callback);

    }else{
      // Send status Not found
      callback('status',"404 " +nscript.docRoot + connection.pathname +" not found");
    }
  });
}


/*============================================================================*\
  Functions for express middle ware


\*============================================================================*/
// Launch function for express middle ware
nscript.expressLaunch = function(request, response, next) {
  //Get extention
  var ext = path.extname(request._parsedUrl.pathname).substring(1);
  var headerSent=false;

  // Check that type are supported
  if(nscript.launchers().indexOf(ext) > -1){
    nscript.launch(ext,request,function(event,data,param){
      switch (event){
      case 'status':
        if(headerSent) break;
        response.status(data);
        if(logMode>=verbose) console.log("Status: %s",data);
        break;
      case 'header':
        if(headerSent) break;
        response.setHeader(data,param);
        if(logMode>=verbose) console.log("Header: '%s: %s'",data,param);
        break;
      case 'data':
        headerSent=true;
        response.write(data,'binary');
        if(logMode>=verbose){ 
          if(data.length<100)
            console.log("Data: '%s'",data);
          else
            console.log("Data: *** length: ",data.length);
        }
        break;
      case 'end':
        response.end();
        if(logMode>=verbose) console.log("End of request");
        break;
      case 'error':
        if(logMode>=mumble) console.log('Node Scripting launcher error: %s',data);
        break;
      default:
        if(logMode>=verbose) console.log("Unknown event: '%s'",event);
      }
    });
  }else{
    next('route');
  }
}


/*============================================================================*\
  PHP cgi support

*  Prepared for fast responce workers
*  Fast responce are provided by prespawned workers, waiting for stdin to complete.
*  Not yet implemented

  Using the command php-cgi  
  Using the script php_burner.php as a launcher script
  
  request body part and other information are parsed through stdin, to the php 
  process. body including multipart are interpreted by the server, before parsing
  it to the cgi. 
  Node provides for the uploaded files to be stored. they only need to be renamed
  and information passed.

  Quirks:
    1. php-cgi might send error text formatted in HTML before the headers
      Fix: 1. set a default header Content-type: text/html and remove duplicates
           2. error messages must be stores until headers are send.
           3. location headers must have presedence
    2. php-cgi might send a header in one block and the line ending in another
      Fix: buffer all headers until end of header section are received
    3. the phpinfo() function requests pseudo pages for logo images.

    for strange 404 see http://woozle.org/~neale/papers/php-cgi.html

  Maximum header section length is hardcoded to about 4K, to prevent unreasonable 
  memory usages. Are there any reason for a larger buffer size?
  Maximum error body length are hardcoded to about 4K too
\*============================================================================*/
nscript.launcher.php = function(cmd,connection,callback) {
  // Start child process
  var proc = require("child_process").spawn('php-cgi',['php_burner.php']);
  proc.stderr.setEncoding('utf8');  
  proc.stdout.setEncoding('binary');
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
        buffer+=data;
        // Look for end of header section
        eoh=buffer.indexOf('\r\n\r\n');
        if(eoh<0) eoh=buffer.indexOf('\n\n');
        if(eoh<0 && buffer.length > 4096) eoh=buffer.length;
        if(eoh>0){
          // Separate headers from body parts
          bbuffer+=buffer.substr(eoh+4); 
          buffer=buffer.substr(0,eoh+1);

          // Divide heades lines  
          var div =-1;
          var line=buffer.split('\n');
          for(var i in line){
            // Split header into key, value pairs
            div = line[i].indexOf(":");
            if(div>0){
              // Fix 1.3 Handle redirect location header
              if(line[i].substr(0,div).toLowerCase()=='location'){
                callback('status',302);
                callback('header','Location',line[i].substr(div+2));
                end=true;
                callback('end');
                return;
              }

              // remove dublicate headers so that last one counts
              headers[ line[i].substr(0,div) ] = line[i].substr(div+2).replace(/\r/g,'');
            }
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

    proc.stdout.on('close', function () {
      if(end) return;

      if(!headersSent){
        for(var i in headers)
          callback('header',i,headers[i]);
        headersSent=true;
      }
      if(bbuffer.length>0)
        callback('data',bbuffer);
      end=true;
      callback('end');
    });
  }

  handleOutput(proc,callback);

}

/*============================================================================*\
  Basic CGI launcher
  (Use fast CGI in tyhe future)

  Parse parameters as arguments and body (POST) on stdin

  Maximum header section length is hardcoded to 4K, to prevent unreasonable 
  memory usages. Are there any reason for a larger buffer size?
  Maximum error body length are hardcoded to 4K too

  Quirks:
    1. Perl dose not have native hearder support. Headers are hand coded and will
    be bug riden.
      Fix: 1. Preset content_type to trext/html and be very tolerant
           Try to guess where the header section ends. 
           2. End header section if a HTML tag are encountered.
           3. End header section when there is no semicolon in a line

\*============================================================================*/
nscript.launcher.cgi = function(cmd,connection,callback) {
  var arg=[];
  var env={};

  // Prepare arguments
  // File to execute
  arg.push(connection.docroot + connection.pathname);

  // Prepare enviroment variables

  // Function to convert objectified query string back to its original 
  env['QUERY_STRING']= (function objToQueryString(obj){
    var k = Object.keys(obj);
    var s = "";
    for(var i=0;i<k.length;i++) {
        s += k[i] + "=" + encodeURIComponent(obj[k[i]]);
        if (i != k.length -1) s += "&";
    }
    return s;
  })(connection.query);

  for(var i in connection.header)
    env[i.toUpperCase() ]=connection.header[i];
  
  env['SCRIPT_NAME']=connection.pathname.substring(connection.pathname.lastIndexOf('/')+1);
  env['SCRIPT_FILENAME']=connection.docroot + connection.pathname;
  env['PATH_INFO']=env['SCRIPT_FILENAME'];
  env['DOCUMENT_URI']=connection.pathname;
  env['DOCUMENT_ROOT']=connection.docroot;

  env['REQUEST_METHOD']=connection.method;
  env['REQUEST_URI']=connection.url;
  env['REMOTE_ADDR']=connection.remoteaddress;

  env['SERVER_SOFTWARE']=process.version;
  env['SERVER_PROTOCOL']='HTTP/' + connection.httpversion;
  env['GATEWAY_INTERFACE']='Nscript ' + process.versions.Nscript;


  /* Unfinished busines
  for(var f in request.files){
    connection.files[f]={};
    connection.files[f].name=request.files[f].name;
    connection.files[f].size=request.files[f].size;
    connection.files[f].tmp_name=request.files[f].path;
    connection.files[f].type=request.files[f].type;
  }
  */

  // Start child process
  var opt={cwd:connection.docroot,env:env};
  var proc = require("child_process").spawn(cmd,arg,opt);

  // Catch bad command 
  proc.on('error', function (err) {
    console.error('CGI error: %s, shell command: %s', err,cmd);
  });

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
    var headers={'Content-type':'text/html'}; // Fix 1

    // Catch output from scrit and send it to client
    proc.stdout.on('data', function (data) {
      if(end) return;

      if(!headersSent){
        // Store headers until a end of header is receiverd (\r\n\r\n) Strip \r
        buffer+=data.toString().replace(/\r/g,'');
        // Look for end of header section
        eoh=buffer.indexOf('\n\n');
        // Look for a HTML tag
        var i=buffer.indexOf('<');
        if(i<eoh) eoh=i-2;
        if(eoh>0 || buffer.length< 4096){
          // Separate headers from body parts
          bbuffer+=buffer.substr(eoh+2);
          buffer=buffer.substr(0,eoh+1);

          // Divide heades lines  
          var div =-1;
          var line=buffer.split('\n');
          for(var i in line){
            if(!headersSent){
              // Split header into key, value pairs
              div = line[i].indexOf(":");
              if(div>0)
                // remove dublicate headers so that last one counts
                headers[ line[i].substr(0,div) ] = line[i].substr(div+2);
              else{
                // Fix 1.3
                headersSent=true;
                bbuffer+=line[i]+'\n';
              }
            }else              
              bbuffer+=line[i]+'\n';
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
      // Store error messages until headers are sent
      if(!headersSent){
        if(bbuffer.length<4096)
          bbuffer+=data.toString();
      }else
        callback('data',data.toString());
    });

    // End request
    proc.stdout.on('close', function () {
      if(!headersSent){
        for(var i in headers)
          callback('header',i,headers[i]);
        headersSent=true;
      }
      if(bbuffer.length>0)
        callback('data',bbuffer);
      end=true;
      callback('end');
    });
  }

  handleOutput(proc,callback);
}



