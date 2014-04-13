

// Biased random entry selection
function select(elems) {
	var r = Math.random();
	var ref = 0;

	for(var i=0; i < elems.length; i++) {
		var elem= elems[i];
		ref += elem[1];
		if (r < ref) return elem[0];
	}

	// This happens only if probabilities don't add up to 1
	return null;
}

var elems = [
	['a', 0.12],
	['b', 0.33],
	['c', 0.05],
	['d', 0.5]
];

var s = '';
for(var i=0; i < 100; i++) {
	s += select(elems);
}
console.log(s);
