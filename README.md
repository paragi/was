#Websocket Application Server (WAS) using node and PHP#

WAS is a websocket-able stack for a mature scripting language.
In this case PHP, running on linux. With a database of your choice.

Install it, run the server and browse the example application.
This example is intended for a small stand alone web application. 

The nice part of this is that all can be served on  port 80 or 443. 
You don't need to run two servers.

This stack consists of:

    -node.js: An event-based experimental server written in JavaScript and using googles V8 engine.
    -express module: HTML static file server module for node
    -WS websocket module for node
    -PHP (so far. You can adapt it to a number of mature scripting language that can be run as CGI)
    -a database of your choice. I experiment with the nonsql database ArangoDB (Not included this example)
    -Tested on Wheezy linux as used on the Raspberry PI, which is a Debian warranty. You can easily adapt it to other platforms. 

##Background##

The reason for the project it that I needed a fast and small stack for the Raspberry PI device, using a mature language for the business logic.
I have been looking for a reason to start using node in a project, and this seem a suitable one. 
I am thrilled by the while concept of an event driven server and programming in general. It feels right. Its on the track to the next level of programming. 
Node.js is a very convincing proof of concept. It feels very much like the days before OO programming was concretized into an actual language. (C++) Before that, the techniques was more or less successfully implemented with structures and function pointers. But in the end, the cost of the intricacy and knowledge required to develop and maintain the applications, outweighed the benefits. 
I feel the same applies here. Its simply too intricate for a junior programmer to work effectively on application development. Whenever it takes senior programmers to do common business logic, its too costly to use and maintain. 
I feel the need of a new language to effectively implement event based programming.
 While we are waiting, this is a fun project.
  
How ever, if you can separate the business logic from the server, it can be used as a powerful server engine for stand alone units. But with great care! There are ample opportunities for security holes, compared with more mature engines like apache2. The prospects for much better security are here.
 
By coupling node, websockets, express webserver and PHP there are potential for a powerful cocktail for easy application development, using HTML5 as a front-end, in almost any available browser.

##Status##

This is Proof of concept. 
  -There will be issues it you try to make it a production platform as is.
  -If you want to run large off the shelf applications there will be issues as well.
  -There are both security and performance issues.
  -If this project turn out to be useful and people wish to join the project, all that will    eventually be ironed out

##PHP##

PHP support is achieved using php-cgi and by transfering request data to a script called PHP-burner, that presents the appropriate superglobals to make it look much like its running in an Apache module.

##Installation##

Require node.js >ver 10  with the modules express, ws and ini installed.


