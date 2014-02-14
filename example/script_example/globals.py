#!/usr/bin/env python
print "Content-Type: text/html"
print
print """\
<html>
<head> 
<meta charset="utf-8" /> 
<meta name="viewport" content="width=device-width, initial-scale=1.0">	
<link rel="stylesheet" href="/css/site.css" media="screen" />
<link rel="shortcut icon" href="/favicon.ico">
<title>Python globals</title>
</head>
<body>
<header class="clearfix">
<a href="/" id="logo"><span>Websocket Application Server</span></a>
<nav>
<h1 style="text-align:center">Python globals</h1>
</nav>
</header>
<section>
<div>
<pre>
"""
import cgi
print cgi.FieldStorage()

print """\
</pre></div>
</section>
<footer>
(c) Simon Riget 2013 / Paragi MIT License
</footer>
</body>
</html>
"""

