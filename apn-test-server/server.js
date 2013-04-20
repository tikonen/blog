// Dummy test sink for APN Push proxy testing

var net = require('net');
    tls = require('tls'),
    fs = require('fs'),
    util = require('util'),
    binary = require('binary'),
    hexy = require('./hexy'),
    hex = require('./hex');

// Sends push feedback service messages
function feedBackDummyServer(stream) {

    // Some tokens to send
    var tokens = [
        '7518b1c2c7686d3b5dcac8232313d5d0047cf0dc0ed5d753c017ffb64ad25b60',
        '7518b1c2c7686d3b5dcac8232313d5d0047cf0dc0ed5d753c017ffb64ad25b60',
        '7518b1c2c7686d3b5dcac8232313d5d0047cf0dc0ed5d753c017ffb64ad25b60'
    ]

    function _getPDU( token ) {
        // Timestamp is 12 h ago
        var timeStamp = parseInt(+new Date() - 12*60*60*1000);

        // Some dummy token
       token = hex.hextobin(token);

        // Build the PDU
        var idx = 0;
        var buf = Buffer(4+2+32);
        buf.writeUInt32BE(~~new Date(), idx);
        idx += 4;
        buf.writeUInt16BE(token.length, idx);
        idx += 2;
        token.copy(buf, idx, 0, token.length);

        console.log('SEND: ' + hex.bintohex(buf))

        return buf;
    }

     // Write the pdu's
     tokens.forEach(function(token) {
       stream.write(_getPDU(token));
    });

    setTimeout(function() {
        stream.end();
    }, 60*1000)

    stream.on('data', function (data) {
        console.log(data);
    });
    stream.on('end', function () {
        stream.end();
    });
}


function pushDummyServer(stream) {

    stream.on('connect', function () {
    });
    stream.on('data', function (data) {
        console.log('=== RECEIVED DATA ('+stream._cid+') ====')
		console.log(hexy.hexy(data));
        console.log('=== PDU ====');

        var vars = binary.parse(data)
                .word8('command')
                .word32bu('pduid')
                .word32bu('expiry')
                .word16bu('tokenlength')
                .buffer('token', 'tokenlength')
                .word16bu('payloadlength')
                .buffer('payload', 'payloadlength')
                .vars;
        vars.expiry = new Date(vars.expiry * 1000);
        vars.token = hex.bintohex(vars.token);
        try {
            vars.payload = JSON.parse(vars.payload.toString('utf8'));
        } catch(e) {
           vars.payload = 'ERROR: INVALID JSON PAYLOAD ' + util.inspect(e);
        }
        console.log(vars);

        if ( vars.command != 1 ) {
            // Send error pdu back and close connection
            var errorpdu = new Buffer(1 + 1 + 4);
            var command = 8; // error command
            var statuscode = 1; // Just some code
            var pduid = vars.pduid;

            errorpdu.writeUInt8(command, 0);
            errorpdu.writeUInt8(statuscode, 1);
            errorpdu.writeUInt32BE(pduid, 2);
            console.log('=== SEND ERROR: ' + hex.bintohex(errorpdu))
            stream.write(errorpdu);
            stream.end();
        }
    });
    stream.on('end', function () {
        console.log('Connection terminated', stream._cid);
        stream.end();
    });
}

var feedbackPlainPort = 2296
var feedbackSecurePort = 2196

var pushPlainPort = 2295
var pushSecurePort = 2195
var cid = 0; // for debugging connections
var options = {
    key: fs.readFileSync('server_key.pem', encoding="ascii"),
    cert: fs.readFileSync('server_cert.pem', encoding="ascii"),

    requestCert: false
}

function createServer( port, secure, handler, debug ) {
    function _handler(stream) {
        cid++;
        console.log('Accepted',debug,'connection', port, cid, secure ? 'SSL' : '');
        stream._cid = cid;
        handler(stream);
    }
    if ( secure ) {
        tls.createServer(options, _handler).listen(port);
    } else {
        net.createServer(_handler).listen(port);
    }
    console.log('Listening', debug, 'port', port, secure ? 'SSL' : '')
}

console.log('Waiting for connections in ports');
createServer( feedbackPlainPort,false, feedBackDummyServer, 'feedback');
createServer( feedbackSecurePort, true, feedBackDummyServer, 'feedback');
createServer( pushPlainPort, false, pushDummyServer, 'push');
createServer( pushSecurePort, true, pushDummyServer, 'push');


