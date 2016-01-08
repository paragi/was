#Websocket Application Server (WAS)#
###using node.JS and PHP###

WAS is a webserver with support of websockets and a mature scripting language.
Currently it supports PHP. There is also rudimentry support for Perl, Ruby and Python, but as yet without POST support.
  
The general idear is that all should be run on the same server and from one port (80 /443)

Install it, run the server and browse the example application.  

###This stack consists of:###

* node.js: An event-based experimental server written in JavaScript and using googles V8 engine.
* express module: HTML static file server module for node
* WS websocket module for node
* PHP (so far. You can adapt it to a number of mature scripting language that can be run as CGI)
* Add a database of your choice.  

Tested on Wheezy linux as used on the Raspberry PI, which is a Debian warranty. You can easily adapt it to other platforms. 

##Installation##
  
2014.01.23: For Raspberry PI you have to install nodejs ver 0.10.2 manually
  
Install node JS on your system. On Derbian/Ubuntu:  

    $ sudo apt-get install npm php5-cgi php5-json

Make sure you get a fairly recent version for your distribution. At least ver 0.10.X
Test with:

    $nodejs -v

Create a project directory.
  
    $ mkdir yourdir
    $ cd yourdir
  
Node JS contains the nice node package manager npm. Use it to install 4 modules: 

    $ npm install express ws ini cron wildcard

Get the WAS application:  
  
    $ wget https://github.com/paragi/was/archive/master.zip
    $ unzip master.zip
    $ mv was-master/* ./
    $ rm -r was-master
    $ rm master.zip

Run the server:  
  
    $ nodejs server.js

Use a browser to access the server on port 8080 eg. 127.0.0.1:8080  

Change settings in node-was.conf

To start and monitor the server, install and use the upstart package 

##PHP##

PHP support is achieved using php-cgi and by transfering request data to a script called PHP-burner, that presents the appropriate superglobals to make it look much like its running in an Apache module.

##Status##
This is Proof of concept.  
I have written another module specificially for PHP integration in node. Please see: https://github.com/paragi/sphp


