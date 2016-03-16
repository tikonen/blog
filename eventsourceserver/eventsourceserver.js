var express = require('express'),
    path = require('path'),
    url = require('url'),
    fs = require('fs'),
    async = require('async'),
    send = require('send'),
    morgan = require('morgan');
   // bodyparser = require('body-parser');

var mainapp = express();

// Logger for requests
mainapp.use(morgan("combined"));

// Serve either current or directory given as argument
//var dir = process.argv[2] || process.cwd();
//dir = path.resolve( dir );
//mainapp.use(express.static( dir ));

mainapp.all('/es', function(req, res) {

    console.log('NEW CONNECTION ' + req.socket.remoteAddress);

    var trid = parseInt(req.header('Last-Event-ID')) || 0;

    function _writeEvent( resp, trid ) {
        // event format is
        // data: <data>\n
        // id: <id>\n
        // \n

        var s = "event: test" + '\n';
        s += 'data: ' + JSON.stringify(resp) + '\n';
        s += 'id: ' + trid + '\n';
        s += '\n';

        var data = new Buffer(s);
        res.write(data)
    }

    res.contentType('text/event-stream; charset=utf-8')
    res.header('Cache-Control', 'no-cache');
    res.header('Connection', 'close');
    // Tell Nginx and other proxies not to buffer this stream
    res.header('X-Accel-Buffering', 'no');
    res.header("Transfer-Encoding", ''); // Disable chunked

    res.write(': ok\n\n');

    var c = 0;
    var timerId = setInterval(function() {
        trid++;
        c++;
        _writeEvent("foo"+trid, trid );

        if( c > 5 ) res.end();
    }, 5000);

    res.socket.on('close', function () {
        clearInterval(timerId);
    });
});


// Fire up server
mainapp.listen(8000);
console.log('Listening port 8000' );
