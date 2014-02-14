<?php
/* ======================================================================== *\

   Pre burner for PHP script execution with note.js

* Set up the predefined global variables for the PHP script.
* Limit access to predefined list of scripts

This is a close aproximation to the population of globals done by mod_php in Apache

Version 0.1:  Simon Rigét - Basic funtionalaty in place. 

todo: 
      fake header()
   set ini open_basedir
      remove $_ENV (programds can use getenv();

See copyrights notes in licese.txt (MIT licence)
\* ======================================================================== */
// Configuration
$sw_name="PHP Burner 0.1";

// Set max execution time (since we use the php CLI we need a web setting)
set_time_limit(30);

/* ======================================================================== *\
    Get client request and server information
    Data passed throug stdin
    including all http headers 
\* ======================================================================== */
$request=json_decode(file_get_contents("php://stdin"),true);

/* ======================================================================== *\
    Populate predefined global variables
\* ======================================================================== */

// _ENV
// All enviroment variables are now in the _SERVER array
// $_ENV=$_SERVER;
// _SERVER
$path=$_SERVER['PATH'];
// Clear array
unset($_SERVER);
$argc=0;

// Add HTTP headers
if(@is_array($request['header'])) foreach($request['header'] as $key=>$val)
  $_SERVER['HTTP_'.strtoupper($key)]=$val;

$_SERVER['HTTP_COOKIE_PARSE_RAW']=@$request['header']['cookie'];
if(@$request['httpversion']) $_SERVER['SERVER_PROTOCOL'] = "HTTP/" . $request['httpversion'];
$_SERVER['REQUEST_METHOD']=@$request['method'];

// Add query information
if(@$request['url']){
  $_SERVER['QUERY_STRING']=substr($request['url'],strpos($request['url'],"?")+1);
  $_SERVER['REQUEST_URI']=$request['url'];
}
$_SERVER['REMOTE_ADDR']=@$request['remoteaddress'];
$_SERVER['REMOTE_HOST']=@$request['header']['host'];
$_SERVER['REMOTE_PORT']=@$request['remoteport'];

// Split address and port
if(@$_SERVER['HTTP_REFERER']){
  $url=parse_url($_SERVER['HTTP_REFERER']);
  if(@$url['port']) 
    $_SERVER['SERVER_PORT'] = ($url['port']);
  else
    $_SERVER['SERVER_PORT'] = 80;
  $_SERVER['SERVER_ADDR'] =$url['host'];
}
// Add script name and paths
if(@$request['pathname'][0]!='/') $request['pathname'] = '/' . $request['pathname'];
$_SERVER['SCRIPT_NAME']=$request['pathname'];
$_SERVER['DOCUMENT_ROOT']=@$request['docroot'];
$_SERVER['PHP_SELF']=$request['pathname'];
$_SERVER['SCRIPT_FILENAME']=$_SERVER['DOCUMENT_ROOT'] . $_SERVER['SCRIPT_NAME'];
$_SERVER['PATH']=$path;

// Add some predefined settings
$_SERVER['GATEWAY_INTERFACE']=$sw_name;
$_SERVER['SERVER_SOFTWARE'] = "PHP Appilation Server using Node.js and WS Websockets";

// Generate a signature
$_SERVER['SERVER_SIGNATURE']="$_SERVER[SERVER_SOFTWARE] Server with $_SERVER[GATEWAY_INTERFACE] at ". @$request['header']['host'];

// _GET
$_GET=@$request['query'];

// Process body data 
$_POST=@$request['body'];

// _FILES
$_FILES=@$request['files'];
// Delete file on exit;
// register_shutdown_function(create_function('', "unlink('{$file['tmp_name']}');")); 
//process_body($request['body'],$_SERVER['HTTP_CONTENT-TYPE']);

// _COOKIE
if($_SERVER['HTTP_COOKIE_PARSE_RAW']) 
  foreach(explode(";",$_SERVER['HTTP_COOKIE_PARSE_RAW']) as $line){
    list($key,$val) = explode("=",$line);
    $_COOKIE[trim($key)]=urldecode(trim($val));
  }

// _REQUEST
$_REQUEST=(array)$_GET + (array)$_POST + (array)$_COOKIE;

/* ======================================================================== *\
    Go
\* ======================================================================== */
// Clean up
unset($key,$val,$line,$request,$sw_name,$default_script,$path);

// Run script
if(realpath($_SERVER['SCRIPT_FILENAME'])){
  require $_SERVER['SCRIPT_FILENAME'];
}else{
  // Websocket responce
  echo '{"error":"File '.$_SERVER['SCRIPT_FILENAME'].' Missing"}';
}
?>
