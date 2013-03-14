
var fs = require('fs'),
    util = require('util'),
    spawn = require('child_process').spawn;

function package_image( path, next ) {

    var tmpfile = path + '.tmp';

    var cmd = 'convert';
    // executes command 'convert path -type Palette png8:path.tmp'
    convert = spawn(cmd, [
        path,
        '-type', 'Palette',
		'png8:' + tmpfile ]);

    // capture stdout and stderr. convert does not have any output on success
    convert.stdout.setEncoding('utf8');
    convert.stdout.on('data', function (data) {
        console.log( cmd + ': stdout '+ path + ' ' + data.trim() );
    });

    convert.stderr.setEncoding('utf8');
    convert.stderr.on('data', function (data) {
        if (/^execvp\(\)/.test(data)) {
            // we get here if 'convert' command was not found or could
            // not be executed
			console.log( cmd + ': failed to start: ' + data );
		} else {
			console.log( cmd + ': stderr '+ path + ' ' + data.trim() );
		}
    });

    convert.on('exit', function( code ) {
        if ( code ) {
			// 127 means spawn error
			console.log(cmd + ': error '+ path + ' ' + code );
			return next(code);
		}
        fs.stat( tmpfile, function(err, info) {
			if ( err ) {
				// no file found? something went wrong. Just ignore
				console.log( cmd + ': output file not found ' + util.inspect(err));
				return next( err );
			}
			// check file size
			if ( !info.size || !info.isFile() ) {
				console.log( cmd + ': out file 0 size or not a file '+ tmpfile);
				fs.unlink( tmpfile ); // remove output file
				return next( true );
			}

			// rename temporary file over old one
			fs.rename( tmpfile, path, function(err) {
				if ( err ) {
					fs.unlink( tmpfile );
					console.log( cmd + ': can not rename '+ tmpfile + ' ' + util.inspect(err));
				}
				return next( err );
			});
		});
	});
}