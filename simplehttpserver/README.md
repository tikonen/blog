# simplehttpserver: Simple HTTP Server

'simpehttpserver' is an simple imitation of Python's SimpleHTTPServer and is intended for testing, development and debugging purposes

# Install globally

Install using `npm`

      npm install simplehttpserver -g

# Usage

Run simplehttpserver by a command

     simplehttpserver [directory]

`[directory]` is used as a web root. Default is the current working directory.
Server listens the port 8000. Open browser to http://localhost:8000 to view.

**Security Consideration**. simplehttpserver does not care if symbolic links point outside the web root directory.

# Run locally

     node simplehttpserver.js

You must have all the dependencies installed

# Custom MIME types

Additional MIME types can be defined by command line arguments.

     simplehttpserver --mime.text/mytype=my,my2 --mime.font/woff2=woff2 .
     Custom mime types
     *.my,my2 mime type text/mytype
     *.woff2 mime type font/woff2
     Listening 0.0.0.0:8000 web root dir /Users/teemu.ikonen/work/blog/simplehttpserver
