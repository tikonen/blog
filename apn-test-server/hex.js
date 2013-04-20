/*****************************************************************************
* Hex there and back
*****************************************************************************/

exports.bintohex = function(buf) {
	var hexbuf = new Buffer(buf.length * 2);
	function nibble(b) {
	    if (b <= 0x09) return 0x30 + b;
	    return 0x41 + (b - 10);
	}
	for(var i=0; i < buf.length; i++) {
	    hexbuf[i*2] = nibble(buf[i] >> 4);
	    hexbuf[i*2+1] = nibble(buf[i] & 0x0F);
	}
	return hexbuf.toString('ascii', 0, hexbuf.length);
}

exports.hextobin = function(hexstr) {
	buf = new Buffer(hexstr.length / 2);

	for(var i = 0; i < hexstr.length/2 ; i++) {
	    buf[i] = (parseInt(hexstr[i * 2], 16) << 4) + (parseInt(hexstr[i * 2 + 1], 16));
	}
	return buf;
}
