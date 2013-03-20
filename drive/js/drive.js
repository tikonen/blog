
// Images must be preloaded before they are used to draw into canvas
function preloadImages( images, callback ) {

    function _preload( asset ) {
        asset.img = new Image();
        asset.img.src = 'img/' + asset.id+'.png';

        asset.img.addEventListener("load", function() {
            _check();
        }, false);

        asset.img.addEventListener("error", function(err) {
            _check(err, asset.id);
        }, false);
    }

    var loadc = 0;
    function _check( err, id ) {
        if ( err ) {
            alert('Failed to load ' + id );
        }
        loadc++;
        if ( images.length == loadc )
            return callback()
    }

    images.forEach(function(asset) {
        _preload( asset );
    });
}

var requestAnimFrame = (function(){
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function(/* function */ callback, /* DOMElement */ element){
            window.setTimeout(callback, 1000 / 60);
        };
})();


window.DriveGame = function() {
	
    var game = new Game();

	// load assets and set the draw canvas sizes

	var canvas = $('#canvas1');
	var area = $('#area');
	canvas.attr('width', area.width());
	canvas.attr('height', area.height());

    var car1img = {id:'car1'};
    var car2img = {id:'car2'};
    var smokeimg = {id:'smoke'};

    preloadImages([car1img, car2img, smokeimg], function() {
		game.carAssets = [
			{
				img:car1img.img,
				w: 38,
				h: 64,
				count: 4
			},
			{
				img: car2img.img,
				w: 36,
				h: 62,
				count: 3
			}
		]
		game.smoke = smokeimg;
		game.start();
		setTimeout(function() {
			window.scrollTo(0, 1);
		}, 500);
	});

    $('#area').click( function( e ){
		var p = $('#canvas1').offset();        
		game.clickAt( parseInt(e.pageX-p.left), parseInt(e.pageY-p.top));
    });
}

var BLURB_TBL = [
	'@##!',
	'Dummkopf!',
	'Fou!',
	'Kena hit!',
	'???',
	'saudumm!'
];

function Game() {
	this.state = 1;
    this.click   = null;
	this.lanes = [
		{
			offset: 15,
			objects: []
		},
		{
			offset: 80,
			objects: []
		},
		{
			offset: 150,
			objects: []
		},
		{
			offset: 220,
			objects: []
		}
	]

	this.roadView = $('#road');
	this.finishoffset = -300;
	this.offset = 0;
	this.speed = 5.1;
	this.trip = 0;
	this.totaltrip = 100;
	this.carpos = {
		yspeed: 0,		
		xspeed: 0,
		framex: 0,
		x: 100,
		y: 200,
		width: 38,
		height: 64
	}
	this.lastUpdate = +(new Date());
	this.startTime = this.lastUpdate;

	this.canvas = $('#canvas1')[0] 
	this.ctx = this.canvas.getContext('2d');

    // Needed for CSS translates
    this.vendor =
        (/webkit/i).test(navigator.appVersion) ? '-webkit' :
        (/firefox/i).test(navigator.userAgent) ? '-moz' :
        (/msie/i).test(navigator.userAgent) ? 'ms' :
        'opera' in window ? '-o' : '';

    this.cssTransform = this.vendor + '-transform';
    this.has3d = ('WebKitCSSMatrix' in window && 'm11' in new WebKitCSSMatrix())
    this.trnOpen       = 'translate' + (this.has3d ? '3d(' : '(');
    this.trnClose      = this.has3d ? ',0)' : ')';
    this.scaleOpen     = 'scale' + (this.has3d ? '3d(' : '(');
    this.scaleClose    = this.has3d ? ',0)' : ')';
}

Game.prototype.reset = function() {
	this.state = 1;
	this.lastUpdate = +(new Date());
}

// Add car in game
function _build_object( game, x, y, speed ) {	

	var car_asset = game.carAssets[parseInt(Math.random()*game.carAssets.length)]
	var framex = car_asset.w * parseInt(Math.random() * car_asset.count);
	
	return {
		collided: 0,
		width: car_asset.w,
		height: car_asset.h,
		img: car_asset.img,
		framex: framex,
		pos: {
			x: x,
			y: y
		},
		speed: speed,
		cleanup: function() {
			if (this.bubble) {
				this.bubble.remove();
			}
		},
		update: function( t ) {
			if (this.collided > 2  && !this.bubble) {
				this.collided = 0;
				this.bubble = $('<div class="bubble">'+BLURB_TBL[parseInt(Math.random()*BLURB_TBL.length)]+'</div>').appendTo('#area');
				this.bubble.css({
					left: this.pos.x - 30,
					top: this.pos.y - 20
				})
				this.bubbleEnd = t + 1000;
			} else if (this.bubbleEnd < t) {
				this.bubble.remove();
			} else if (this.bubble) {
				this.bubble.css({
					left: this.pos.x - 30,
					top: this.pos.y - 20
				})
			}
		},
		clear: function( ctx ) {
			ctx.clearRect( this.pos.x - 1, this.pos.y - 1, this.width + 1 , this.height + 1 );
		},
		draw: function( ctx ) {
			ctx.drawImage( this.img, this.framex, 0, this.width, this.height,
						   this.pos.x, this.pos.y, this.width, this.height );
		}
	}
}

Game.prototype.start = function() {

    var that = this;
	that.running = true;
	that.lastupdate = +(new Date());
    (function gameLoop() {
		that.clear(); // clear canvas objects
		that.update(); // update game state
		that.draw(); // draw game
		if (that.running) {
			requestAnimFrame( gameLoop );
		}
    })();
}

Game.prototype.update = function() {
	
	var now = +new Date();

	if (this.click && this.speed) {
		// clicked

        // If not collision, keep accelerating
		if ( ! this.collision ) this.speed += 0.05;
		if (this.speed > 5.1) {
			this.speed = 5.1;
		}
		
		var x = this.click.x - this.carpos.x;
		var y = this.click.y - this.carpos.y;
		var distance = parseInt(Math.sqrt( x*x + y*y ));
		if ( distance ) {
            // Car moves from a to b
			this.moveStart = +now;
			this.moveEnd = this.moveStart + distance * 8;

			this.startPoint = { 
				x: this.carpos.x,
				y: this.carpos.y 
			}
			this.endPoint = {
				x: this.click.x - 15,
				y: this.click.y
			}
		}
	}
	if ( this.moveEnd ) {
		if ( now > this.moveEnd ) {
			this.moveStart = null;
			this.moveEnd = null;
			this.startPoint = null;			
			this.endPoint = null;
			this.carpos.xspeed = this.carpos.yspeed = 0;
		} else {			
			var t = (now - this.moveStart)/(this.moveEnd - this.moveStart);
			var pos = _bezier_quad( t, this.startPoint, 
									{x: this.endPoint.x, y:this.startPoint.y },
									this.endPoint )
			this.carpos.xspeed = (pos.x - this.carpos.x) / (now - this.lastupdate) * 1000;
			this.carpos.yspeed = (this.carpos.y - pos.y) / (now - this.lastupdate) * 1000;
			this.carpos.x = pos.x;
			this.carpos.y = pos.y;
		}
	}

	// add cars in lines
	// lane offsets
	if (this.state == 1 && Math.random() > 0.98) {
		var laneidx = parseInt(Math.random() * this.lanes.length)
		var placed = false;
		var yoffset = 100;
		while ( ! placed ) {			
			// try until we find next free
			var lanecount = this.lanes.length;
			while (lanecount > 0) {
				lanecount--;
				var lane = this.lanes[laneidx]
				var canuse = true;
				for (var k = 0; k < lane.objects.length; k++ ) {
					if ( lane.objects[k].pos.y < -(yoffset - 100) ) {
						canuse = false;
						break;
					}
				}
				if ( canuse ) {
					var xoffset = parseInt(lane.offset + (Math.random() * 10 - 5))
					lane.objects.push( _build_object( this, xoffset, -parseInt(yoffset + Math.random() * 10), 4.85 ) )
					placed = true;
					break;
				} else {
					lanexid = laneidx + 1 % this.lanes.length;
				}
			}
			yoffset += 100;
		}
	}
	
	this.collision = null;
	for (var k = 0 ; k < this.lanes.length; k++ ) {
		var objects = this.lanes[k].objects;
		for (var i = 0 ; i < objects.length ; i++ ) {
			var object = objects[i];
			if ( object.pos.y > this.canvas.height ) {
				// object out of screen
				object.cleanup();
				objects.splice(i, 1);
				i--;
				continue;
			}
			// update object position
			if ( object.speed ) {
				object.pos.y += (now - this.lastupdate) * (this.speed - object.speed);
			}
			if (this.state == 2 && object.speed > 0) {
				object.speed -= 0.01;
			} 
			if (object.speed < 0 ) {
				object.speed = 0;
			}

			object.update( now );

			// collision detection
			if ( object.pos.x + object.width > this.carpos.x &&
				 object.pos.x < this.carpos.x + this.carpos.width &&
				 object.pos.y + object.height > this.carpos.y &&
				 object.pos.y < this.carpos.y + this.carpos.height ) {
				object.collided++;
				this.collision = object;			
			} 
		}
	}
	if ( this.collision ) {
        // Collision handling

		// resolve vector
		var cy = this.collision.pos.y + this.collision.height / 2;
		var cx = this.collision.pos.x + this.collision.width / 2;
		var ox = this.carpos.x + this.carpos.width / 2;
		var oy = this.carpos.y + this.carpos.height / 2;		
		var vx = cx - ox;
		var vy = oy - cy;
		
		if (oy > cy && Math.abs(vx) < this.carpos.width/2 - 5) {
			this.speed = this.collision.speed;
			this.carpos.y = this.collision.pos.y + this.collision.height + 5;
			if (this.endPoint) { 
				this.startPoint.y = this.carpos.y;
				this.startPoint.x = this.carpos.x;
				this.endPoint.y = this.carpos.y + 5; 
				this.endPoint.x = this.carpos.x;
				this.moveStart = now;
				this.moveEnd = now + 100;
			}
		} else if (oy > cy && Math.abs(vx) < this.carpos.width - 5) {
			this.carpos.y = this.collision.pos.y + this.collision.height + 5;
			this.speed = this.collision.speed;
			if (this.endPoint) { 
				this.startPoint.y = this.carpos.y;
				this.startPoint.x = this.carpos.x;
				this.endPoint.y = this.carpos.y + 5; 
				this.endPoint.x = this.carpos.x;
				this.moveStart = now;
				this.moveEnd = now + 100;
			}
		} else {
			this.collision.pos.x += vx > 0 ? 1 : -1;
			this.carpos.x += vx > 0 ? -1 : 1;
			this.carpos.y += vy > 0 ? 2 : -2; 
			this.moveEnd = null;
		}
	} 

	this.trip += this.speed * (now - this.lastupdate) / 1000;
		
	if (this.state == 1 && this.totaltrip - this.trip < 50) {
        // if travelled long enough, change state
		this.state = 2;
	}

	if (this.state == 2) {
		this.speed -= 0.01;
		
		if (this.speed <= 0) {
            // The end!
			this.speed = 0;
			$('#continue').show();			
			this.state = 3;
		}
	}

	this.lastupdate = now;
	this.click = null;
}


function _bezier_quad(t, p0, p1, p2) {
	return {
		x: (1 - t)*( (1 -t) * p0.x + t*p1.x) + t * ( (1 - t) * p1.x + t * p2.x),
		y: (1 - t)*( (1 -t) * p0.y + t*p1.y) + t * ( (1 - t) * p1.y + t * p2.y)
	}
}

Game.prototype.clickAt = function(x, y) {
	this.click = { x:x, y:y }
}

Game.prototype.clear = function() {
	// clear previous car
	this.ctx.clearRect(this.carpos.x - 5, this.carpos.y - 1, 46, 100)	
	for (var k = 0 ; k < this.lanes.length; k++ ) {
		var objects = this.lanes[k].objects;
		for (var i = 0 ; i < objects.length ; i++ ) {
			var object = objects[i];
			object.clear( this.ctx );
		}
	}
}

Game.prototype.draw = function() {
	
	// roll the road
	this.offset += this.speed * 1.5
	if ( this.offset > 0 ) this.offset = -95;
	this.roadView.css(this.cssTransform, this.trnOpen + '0px, '+this.offset+'px' + this.trnClose);
	if (this.state == 2 && this.speed < 2) {
        // End of race, get finish line in screen
		this.finishoffset += this.speed * 1.5;
		$('#finish').css('top', this.finishoffset);
	}

	// draw car
	this.ctx.drawImage( this.carAssets[0].img, 
						this.carpos.framex, 0, this.carpos.width, this.carpos.height,
						this.carpos.x, this.carpos.y, this.carpos.width, this.carpos.height
					  );

	// draw objects
	for (var k = 0 ; k < this.lanes.length ; k++ ) {
		var objects = this.lanes[k].objects;
		for (var i = 0 ; i < objects.length ; i++ ) {
			var object = objects[i];
			object.draw( this.ctx );		
		}
	}
	
	// smoke, thickness depends on speed
	var size = this.carpos.yspeed > 0 ? 25 : (this.carpos.yspeed > 0 ? 0 : 10);
	var plumes = this.carpos.yspeed > 0 ? 4 : 2;

	for (var i = 0 ; i < plumes; i++) {
		this.ctx.drawImage( this.smoke.img, 
							this.carpos.x - Math.random() * 10 + 5, this.carpos.y + 70 - Math.random() * 20 + 5, size, size
						  );
	}
}
