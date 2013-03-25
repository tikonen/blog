window.requestAnimFrame = (function(){
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function(/* function */ callback, /* DOMElement */ element){
            window.setTimeout(callback, 1000 / 60);
        };
    })();
var game, tile;
$(document).ready( function(){
    $('#container').click( function( e ){
		var p = $('#canvas').offset();        
		game.click = {x:parseInt((e.pageX-p.left)/game.resolution),y:parseInt((e.pageY-p.top)/game.resolution)};
    });
    game = new Game();

    // Preload image and start game
    tile = new Image();
    tile.src = 'img/apple.png';
    tile.addEventListener("load", function() {
        // Loaded, start game
        game.start();
    }, false);

    // ok button restarts the game
	$("#score .button").click(function(e) {
		e.stopPropagation();
		$("#hud").show();
		$("#score").hide();
        $('#number').text(0);
		game.start();
	});
});

var SLAB_MASK = Math.pow(2, 16);
var APPLE_MASK = Math.pow(2, 15);

var BLURB_TBL = [
	'Bummer!',
	'Very Good!',
	'Excellent!',
	'Suberb!',
	'Flawless!'
];

var GRID_RESOLUTION = 30;
var GRID_W = 12;
var GRID_H = 12;

var width  = window.innerWidth;
var height = window.innerHeight;

// Define grid width based on screen size
GRID_W = Math.min( GRID_W, ~~(width / GRID_RESOLUTION));
GRID_H = Math.min( GRID_H, ~~(height / GRID_RESOLUTION)) - 1;
var APPLE_COUNT = ~~((GRID_W * GRID_H) / 8);


function Game() {
    // The canvas where game is drawn
    var canvas   = document.getElementById('canvas');
    this.ctx     = canvas.getContext('2d');
    this.click   = null;

    this.score = 0;

    this.resolution = GRID_RESOLUTION;

    // Update the area size
    this.width   = GRID_W;
    this.height  = GRID_H;

	$(canvas).css({width: this.width * this.resolution + 1,
				   height: this.height * this.resolution + 1} );
	$('#canvas').attr('width', this.width * this.resolution + 1);
	$('#canvas').attr('height', this.height * this.resolution + 1);
	$('#container').css({width: this.width * this.resolution + 10,
						 height: this.height * this.resolution + 10} );

    // Build the slab image
	this.slab = document.createElement('canvas');
	var ctx = this.slab.getContext('2d');
	this.slab.width = this.resolution;
	this.slab.height = this.resolution;

    // base color is dull grey
	ctx.fillStyle = 'grey';
	ctx.fillRect(0, 0, this.resolution, this.resolution);

    // white highlight around tile
	ctx.beginPath();
	ctx.fillStyle = 'white'
	ctx.moveTo(0, 0);
	ctx.lineTo(this.resolution, 0);
	ctx.lineTo(this.resolution, this.resolution);
	ctx.lineTo(0, 0);
	ctx.closePath();
	ctx.fill();

    // draw smaller grey area on top
	ctx.fillStyle = 'lightgrey';
	ctx.fillRect(4, 4, this.resolution-8, this.resolution-8);
}
Game.prototype.reset = function() {
	this.click = null;
	this.score = 0;
	this.apples = APPLE_COUNT;

    // We keep only one grid, the apples and count are stored in using bitmasks, so
    // full state of tile can be stored in one integer.

	this.grid = []
	for (var i = 0 ; i < this.width * this.height; i++) {
		this.grid[i] = SLAB_MASK;
	}

    // Iterative function to update neighbour numbers in each tile
	var that = this;
	function _inc_pos( x, y ) {
        if ( x < 0 || x >= that.width || y < 0 || y >= that.height ) return;
        var pos = that.pos(x,y);
		that.grid[pos]++;
	}
	for (var i = 0; i < this.apples; i++) {
		var pos = parseInt(Math.random() * (this.width * this.height))
        var loc = this.xy(pos);
        var x = loc.x;
        var y = loc.y;
		if (this.grid[pos] & APPLE_MASK) {
			i--;
			continue
		}
		this.grid[pos] |= APPLE_MASK;
		_inc_pos(x, y-1);
        _inc_pos(x, y+1);
        _inc_pos(x - 1, y - 1);
        _inc_pos(x - 1, y);
        _inc_pos(x - 1, y + 1);
        _inc_pos(x + 1, y - 1);
        _inc_pos(x + 1, y);
        _inc_pos(x + 1, y + 1);
	}	
}

Game.prototype.start = function() {
	this.reset();
	$("#togo").text(this.apples);
    this.draw();
    var that = this;
	that.running = true;
    (function gameLoop() {
        that.update();
		if (that.running) {
			requestAnimFrame( gameLoop );
		}
    })();
}
Game.prototype.pos = function( x, y ) {
    return y*this.width+x;
}
Game.prototype.xy = function( pos ) {
    return {x:parseInt(pos%this.width),y:parseInt(pos/this.width)}
}
Game.prototype.updateScore = function( add ) {
	var that = this;
	var hudScore = $('#number');
	for (var i = 0 ; i < Math.abs(add/10); i++) {
		setTimeout(function() {
			that.score += add > 0 ? 10 : -10;
			$(hudScore).text(that.score);
		}, 100 + i);
	}
}
Game.prototype.update = function() {
	var that = this;
    if ( this.click != null ) {
        // Check where click hit

        // Recursive function to clear empty areas
        function _empty( x, y, force ) {
            if ( x < 0 || x >= that.width || y < 0 || y >= that.height ) return;

            var pos = that.pos(x, y);
            var d = that.grid[pos];

            if (d && (d & SLAB_MASK) && (force || !(d & APPLE_MASK))) {

                that.grid[pos] &= ~SLAB_MASK; // clear out slab

                // Clear next neighbor if this is empty tile
                if (that.grid[pos] == 0) {
                    _empty(x, y - 1) // north
                    _empty(x, y + 1) // south
                    _empty(x - 1, y) // west
                    _empty(x - 1, y - 1) // north west
                    _empty(x - 1, y + 1) // south east
                    _empty(x + 1, y) // east
                    _empty(x + 1, y - 1) // north east
                    _empty(x + 1, y + 1) // south east
                }
            }
        }

        var pos = this.pos( this.click.x, this.click.y );
        var d = that.grid[pos]
		if (d & SLAB_MASK) {
            console.log('CLICK', this.click.x, this.click.y)
            // Player hit non-cleared tile
			if ( d & APPLE_MASK ) {
                // Player uncovered apple!
				this.apples--;
				this.updateScore(1000);
				
				if (!this.apples) {
                    // All found
					this.running = false;
					var score = this.score + 1000;
					
					$("#finalscore").text(score);
					var ec = 0;
					if (score > 0) {
						ec = parseInt((this.score + 1000)/3000) + 1
					}
					$("#blurb").text(BLURB_TBL[ec] || 'Flawless Victory!');
					$("#score").show();
					$("#hud").hide();
				}

                // Update number of apples left
				$("#togo").text(this.apples);
			} else if( (d & ~SLAB_MASK) > 0) {
                // No apple here, decrease score based on neighbour count.
				this.updateScore( -(8 - (d & ~SLAB_MASK)) * 100 );
			}
		}
        // Clear the click location and around
		_empty( this.click.x, this.click.y, true );

		this.draw();
    }
    this.click = null;
}

Game.prototype.draw = function() {
    this.ctx.clearRect( 0,0, this.width * this.resolution, this.height * this.resolution);

    // For drawing numbers
    this.ctx.font = '20px Arial';
    this.ctx.fillStyle = 'white';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for ( var y=0; y < this.height; y++ ) {
        for ( var x=0; x < this.width; x++ ) {
            // Draw each tile
            var s = this.grid[this.pos(x,y)];

            if (s & SLAB_MASK) {
                // Still covered tile
                this.ctx.drawImage( this.slab, x * this.resolution, y * this.resolution )
            } else if (s & APPLE_MASK) {
                // Uncovered apple
                this.ctx.drawImage( tile, x * this.resolution + 2, y * this.resolution + 2 )

            } else if ((s & 0xFF) > 0) {
                // Neighbour number
                this.ctx.fillText( '' + (s & 0xFF) ,
                    x * this.resolution + this.resolution/2,
                    y * this.resolution + this.resolution/2)
            }
        }
    }
}
