<!DOCTYPE html>
<html>
<head> 
<meta charset="utf-8" /> 
<title>PHP Application Server</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">	
<link rel="stylesheet" href="css/site.css" media="screen" />
<link rel="shortcut icon" href="/favicon.ico">
</head>
<body>

<header class="clearfix">
<a href="" id="logo"><span>Websocket Application Server</span></a>

<?php
  // Pages
  $page=array(
     "Welcome"=>"welcome.html"
    ,"Websocket examples"=>"websocket.html"
    ,"PHP globals"=>"php_globals.php"
    ,"PHP information"=>"php_info.php"
  //  ,"Tests"=>"tests.php"
    ,"Server status"=>"server_status.html"
  //  ,"Documentation"=>"doc.html"
    ,"Style overwiev"=>"style_overwiev.html"
    ,"History"=>"history.html"
    ,"License"=>"license.html"

  );

  // Navigation
  echo "<nav><ul>\n";
  foreach($page as $name=> $file){
    // Default to the first page
    if(!@$_REQUEST['page']) $_REQUEST['page']=$name;

    // Mark current page
    if($name==$_REQUEST['page'])
      echo "<li><a href=\"/?page=$name\" class=\"selected\">$name</a></li>\n";

    else
      echo "<li><a href=\"/?page=$name\" >$name</a></li>\n";
  }
  echo "</ul></nav>\n";
  echo "</header>";

  // get page
  if(file_exists($_SERVER['DOCUMENT_ROOT']."/".$page[$_REQUEST['page']]))
    if(pathinfo($page[$_REQUEST['page']], PATHINFO_EXTENSION) == 'php')
      include $page[$_REQUEST['page']];
    else
      readfile($_SERVER['DOCUMENT_ROOT']."/".$page[$_REQUEST['page']]);
  else{
    echo "<section>";
    echo "<div class=\"Message_Error\">Sorry, this page is not available at the moment. Please try again at a later time</div>";
    echo "</section>";

  }
?>

<style> body {background:#456;} </style>

<footer>
Version 0.1.0 - Proff of concept<br>
(c) Simon Rigét 2013 MIT License
</footer>

</body>
</html>

