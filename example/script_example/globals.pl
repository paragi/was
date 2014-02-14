#!/usr/bin/perl
;#============================================================================*\
;#  Show global variables
;#============================================================================*/
 
print "Content-type: text/html\r\n\r\n";

print <<HTML;
<!DOCTYPE html>
<html>
<head> 
<meta charset="utf-8" /> 
<title>Perl enviroment</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">	
<link rel="stylesheet" href="/css/site.css" media="screen" />
<link rel="shortcut icon" href="/favicon.ico">
</head>
<body>
<header class="clearfix">
<a href="/" id="logo"><span>Websocket Application Server</span></a>
<nav>
<h1 style="text-align:center">Perl</h1>
</nav>
</header>
<section>
HTML

print "<h1>Enviroment variables:</h1>\n";
print "<ul>";
foreach $key (keys %ENV) {
  print "<li>$key = $ENV{$key}</li>\n";
}
print "</ul>";

print "<h1>Arguments:</h1>\n";
print "<ol>";
foreach $word (@ARGV) {
  print "<li> $word </li>";
}
print "</ol>";

print <<HTML;
</section>
<footer>
(c) Simon Rigét 2013 / Paragi MIT License
</footer>
</body>
</html>
HTML
exit; 

