var STATE_SPINNING = 1;
var STATE_SLOT1_STOP = 2;
var STATE_SLOT2_STOP = 3;
var STATE_SLOT3_STOP = 4;
var STATE_STOPPED = 5;
var STATE_RESULTS = 6;
var STATE_END = 7;

var progressCount = 0; // current progress count
var progressTotalCount = 0; // total count
function updateProgress(inc) {
    progressCount += (inc || 1);
    if (progressCount >= progressTotalCount) {
        // done, complete progress bar and hide loading screen
        $('#progress').css('width', '100%');
        $('#loading').slideUp(600);
    } else {
        // Update progress bar
        $('#progress').css('width', parseInt(100 * progressCount / progressTotalCount) + '%');
    }
}

// Generic preloader handler, it calls preloadFunction for each item and
// passes function to it that it must call when done.
function preloader(items, preloadFunction, callback) {

    var itemc = 0;
    var loadc = 0;

    // called by preloadFunction to notify result
    function _check(err, id) {
        updateProgress(1);
        if (err) {
            alert('Failed to load ' + id + ': ' + err);
        }
        loadc++;
        if (itemc == loadc) callback();
    }

    if (items.constructor == Array) {
        itemc = items.length;
        loadc = 0;
        progressTotalCount += items.length;
        // queue each item for fetching
        items.forEach(function (item) {
            preloadFunction(item, _check);
        });
    } else {
        // object
        for (var key in items) {
            itemc++;
            progressTotalCount++;
            preloadFunction(items[key], _check);
        }
    }
}

// Images must be preloaded before they are used to draw into canvas
function preloadImages(images, callback) {

    preloader(images, _preload, callback);

    function _preload(asset, doneCallback) {
        asset.img = new Image();
        asset.img.src = 'img/' + asset.path + '.png';

        asset.img.addEventListener("load", function () {
            doneCallback();
        }, false);

        asset.img.addEventListener("error", function (err) {
            doneCallback(err, asset.path);
        }, false);
    }
}

function _initWebAudio(AudioContext, format, audios, callback) {
    // See more details in http://www.html5rocks.com/en/tutorials/webaudio/intro/

    var context = new AudioContext();

    preloader(audios, _preload, callback);

    function _preload(asset, doneCallback) {
        var request = new XMLHttpRequest();
        request.open('GET', 'audio/' + asset.path + '.' + format, true);
        request.responseType = 'arraybuffer';

        request.onload = function () {
            context.decodeAudioData(request.response, function (buffer) {

                asset.play = function () {
                    var source = context.createBufferSource(); // creates a sound source
                    source.buffer = buffer;                    // tell the source which sound to play
                    source.connect(context.destination);       // connect the source to the context's destination (the speakers)

                    // play the source now
                    // support both webkitAudioContext or standard AudioContext
                    source.noteOn ? source.noteOn(0) : source.start(0);
                };
                // default volume
                // support both webkitAudioContext or standard AudioContext
                asset.gain = context.createGain ? context.createGain() : context.createGainNode();
                asset.gain.connect(context.destination);
                asset.gain.gain.value = 0.5;

                doneCallback();

            }, function (err) {
                asset.play = function () {
                };
                doneCallback(err, asset.path);
            });
        };
        request.onerror = function (err) {
            console.log(err);
            asset.play = function () {
            };
            doneCallback(err, asset.path);
        };
        // kick off load
        request.send();
    }
}

function _initHTML5Audio(format, audios, callback) {

    preloader(audios, _preload, callback);

    function _preload(asset, doneCallback) {
        asset.audio = new Audio('audio/' + asset.path + '.' + format);
        asset.audio.preload = 'auto';
        asset.audio.addEventListener("loadeddata", function () {
            // Loaded ok, set play function in object and set default volume
            asset.play = function () {
                asset.audio.play();
            };
            asset.audio.volume = 0.6;

            doneCallback();
        }, false);

        asset.audio.addEventListener("error", function (err) {
            // Failed to load, set dummy play function
            asset.play = function () {
            }; // dummy

            doneCallback(err, asset.path);
        }, false);

    }
}

// Initializes audio and loads audio files
function initAudio(audios, callback) {

    var format = 'mp3';
    var elem = document.createElement('audio');
    if (elem) {
        // Check if we can play mp3, if not then fall back to ogg
        if (!elem.canPlayType('audio/mpeg;') && elem.canPlayType('audio/ogg;')) format = 'ogg';
    }

    var AudioContext = window.webkitAudioContext || window.mozAudioContext || window.MSAudioContext || window.AudioContext;

    if (AudioContext) {
        $('#audio_debug').text('WebAudio Supported');
        // Browser supports webaudio
        // https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html
        return _initWebAudio(AudioContext, format, audios, callback);
    } else if (elem) {
        $('#audio_debug').text('HTML5 Audio Supported');
        // HTML5 Audio
        // http://www.whatwg.org/specs/web-apps/current-work/multipage/the-video-element.html#the-audio-element
        return _initHTML5Audio(format, audios, callback);
    } else {
        $('#audio_debug').text('Audio NOT Supported');
        // audio not supported
        for (var key in audios) {
            audios[key].play = function () {
            }; // dummy play
        }
        callback();
    }
}

var IMAGE_HEIGHT = 64;
var IMAGE_TOP_MARGIN = 5;
var IMAGE_BOTTOM_MARGIN = 5;
var SLOT_SEPARATOR_HEIGHT = 2;
var SLOT_HEIGHT = IMAGE_HEIGHT + IMAGE_TOP_MARGIN + IMAGE_BOTTOM_MARGIN + SLOT_SEPARATOR_HEIGHT; // how many pixels one slot image takes
var RUNTIME = 3000; // how long all slots spin before starting countdown
var SPINTIME = 1000; // how long each slot spins at minimum
var ITEM_COUNT = 6; // item count in slots
var SLOT_SPEED = 15; // how many pixels per second slots roll
var DRAW_OFFSET = 45; // how much draw offset in slot display from top

var BLURB_TBL = [
    'No win!',
    'Good!',
    'Excellent!',
    'JACKPOT!'
];

function copyArray(array) {
    var copy = [];
    for (var i = 0; i < array.length; i++) {
        copy.push(array[i]);
    }
    return copy;
}

function shuffleArray(array) {
    var i;

    for (i = array.length - 1; i > 0; i--) {
        var j = parseInt(Math.random() * i);
        var tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
    }
}

function SlotGame() {

    var game = new Game();

    var items = [
        {path: 'reel-icon-1', id: 'reel1'},
        {path: 'reel-icon-2', id: 'reel2'},
        {path: 'reel-icon-3', id: 'reel3'},
        {path: 'reel-icon-4', id: 'reel4'},
        {path: 'reel-icon-5', id: 'reel5'},
        {path: 'reel-icon-6', id: 'reel6'}
    ];
    // Audio file names
    var audios = {
        'roll': {path: 'roll'}, // Played on roll start
        'reel1': {path: 'reels/reel-icon-1'}, // Played when reel stops on this icon
        'reel2': {path: 'reels/reel-icon-2'}, // Played when reel stops on this icon
        'reel3': {path: 'reels/reel-icon-3'}, // Played when reel stops on this icon
        'reel4': {path: 'reels/reel-icon-4'}, // Played when reel stops on this icon
        'reel5': {path: 'reels/reel-icon-5'}, // Played when reel stops on this icon
        'reel6': {path: 'reels/reel-icon-6'}, // Played when reel stops on this icon
        'win2': {path: '2ofaKind'}, // Played on 2 of a kind
        'win3': {path: '3ofaKind'}, // Played on 3 of a kind
        'nowin': {path: '1TryAgain'}  // Played on loss
    };

    $('canvas').attr('height', IMAGE_HEIGHT * ITEM_COUNT * 2);
    $('canvas').css('height', IMAGE_HEIGHT * ITEM_COUNT * 2);

    game.items = items;
    game.audios = audios;

    var imagesLoaded = false;
    var audioLoaded = false;

    // load assets and predraw the reel canvases

    initAudio(audios, function () {
        // audio is initialized and loaded
        audioLoaded = true;
        checkLoad();
    });

    preloadImages(items, function () {
        // images are preloaded
        imagesLoaded = true;
        checkLoad();
    });

    function checkLoad() {
        if (!audioLoaded || !imagesLoaded) {
            return; // not yet ready
        }

        // all loaded

        // draws canvas strip
        function _fill_canvas(canvas, items) {
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ddd';

            for (var i = 0; i < ITEM_COUNT; i++) {
                var asset = items[i];
                ctx.save();
                ctx.shadowColor = "rgba(0,0,0,0.5)";
                ctx.shadowOffsetX = 5;
                ctx.shadowOffsetY = 5;
                ctx.shadowBlur = 5;
                ctx.drawImage(asset.img, 3, i * SLOT_HEIGHT + IMAGE_TOP_MARGIN);
                ctx.drawImage(asset.img, 3, (i + ITEM_COUNT) * SLOT_HEIGHT + IMAGE_TOP_MARGIN);
                ctx.restore();
                ctx.fillRect(0, i * SLOT_HEIGHT, 70, SLOT_SEPARATOR_HEIGHT);
                ctx.fillRect(0, (i + ITEM_COUNT) * SLOT_HEIGHT, 70, SLOT_SEPARATOR_HEIGHT);
            }
        }

        // Draw the canvases with shuffled arrays
        game.items1 = copyArray(items);
        shuffleArray(game.items1);
        _fill_canvas(game.c1[0], game.items1);
        game.items2 = copyArray(items);
        shuffleArray(game.items2);
        _fill_canvas(game.c2[0], game.items2);
        game.items3 = copyArray(items);
        shuffleArray(game.items3);
        _fill_canvas(game.c3[0], game.items3);
        game.resetOffset = (ITEM_COUNT + 3) * SLOT_HEIGHT;

        // Start game loop
        game.loop();

        $('#play').click(function (e) {
            // start game on play button click
            $('h1').text('Rolling!');
            game.audios.roll.play();
            game.restart();
        });
    }


    // Show reels for debugging
    var toggleReels = 1;
    $('#debug').click(function () {
        toggleReels = 1 - toggleReels;
        if (toggleReels) {
            $('#reels').css('overflow', 'hidden');
        } else {
            $('#reels').css('overflow', 'visible');
        }
    });
}

function Game() {

    // reel canvases
    this.c1 = $('#canvas1');
    this.c2 = $('#canvas2');
    this.c3 = $('#canvas3');

    // set random canvas offsets
    this.offset1 = -parseInt(Math.random() * ITEM_COUNT) * SLOT_HEIGHT;
    this.offset2 = -parseInt(Math.random() * ITEM_COUNT) * SLOT_HEIGHT;
    this.offset3 = -parseInt(Math.random() * ITEM_COUNT) * SLOT_HEIGHT;
    this.speed1 = this.speed2 = this.speed3 = 0;
    this.lastUpdate = new Date();

    // Needed for CSS translates
    this.vendor =
        (/webkit/i).test(navigator.appVersion) ? '-webkit' :
            (/firefox/i).test(navigator.userAgent) ? '-moz' :
                (/msie/i).test(navigator.userAgent) ? 'ms' :
                    'opera' in window ? '-o' : '';

    this.cssTransform = this.vendor + '-transform';
    this.has3d = ('WebKitCSSMatrix' in window && 'm11' in new WebKitCSSMatrix())
    this.trnOpen = 'translate' + (this.has3d ? '3d(' : '(');
    this.trnClose = this.has3d ? ',0)' : ')';
    this.scaleOpen = 'scale' + (this.has3d ? '3d(' : '(');
    this.scaleClose = this.has3d ? ',0)' : ')';

    // draw the slots to initial locations
    this.draw(true);
}

Game.prototype.setRandomResult = function ()
{
    this.result1 = parseInt(Math.random() * this.items1.length);
    this.result2 = parseInt(Math.random() * this.items2.length);
    this.result3 = parseInt(Math.random() * this.items3.length);
};

Game.prototype.setJackpotResult = function ()
{
    // function locates id from items
    function _find( items, id ) {
        for ( var i=0; i < items.length; i++ ) {
            if (items[i].id == id) return i;
        }
    }
    // Jackpot
    this.result1 = _find( this.items1, 'reel4' );
    this.result2 = _find( this.items2, 'reel4' );
    this.result3 = _find( this.items3, 'reel4' );
};

// Restart the game and determine the stopping locations for reels
Game.prototype.restart = function () {
    this.lastUpdate = new Date();
    this.speed1 = this.speed2 = this.speed3 = SLOT_SPEED;

    // get random results
    this.setRandomResult();

    // uncomment to override results with jackpot
    //this.setJackpotResult();

    // Clear stop locations
    this.stopped1 = false;
    this.stopped2 = false;
    this.stopped3 = false;

    // randomize reel locations
    this.offset1 = -parseInt(Math.random(ITEM_COUNT)) * SLOT_HEIGHT;
    this.offset2 = -parseInt(Math.random(ITEM_COUNT)) * SLOT_HEIGHT;
    this.offset3 = -parseInt(Math.random(ITEM_COUNT)) * SLOT_HEIGHT;

    $('#results').hide();

    this.state = STATE_SPINNING;
};

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (/* function */ callback, /* DOMElement */ element) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

Game.prototype.loop = function () {
    var that = this;
    that.running = true;
    (function gameLoop() {
        that.update();
        that.draw();
        if (that.running) {
            requestAnimFrame(gameLoop);
        }
    })();
};

Game.prototype.checkWinLine = function()
{
    var matchCount = 0;

    // currently win is given only from icon #4
    if (this.items1[this.result1].id == 'reel4') matchCount++;
    if (this.items2[this.result2].id == 'reel4') matchCount++;
    if (this.items3[this.result3].id == 'reel4') matchCount++;

    return matchCount;
};

Game.prototype.update = function () {

    var now = new Date();
    var that = this;

    // Check slot status and if spun long enough stop it on result
    function _check_slot(offset, result) {
        if (now - that.lastUpdate > SPINTIME) {
            var c = parseInt(Math.abs(offset / SLOT_HEIGHT)) % ITEM_COUNT;
            if (c == result) {
                if (result == 0) {
                    if (Math.abs(offset + (ITEM_COUNT * SLOT_HEIGHT)) < (SLOT_SPEED * 1.5)) {
                        return true; // done
                    }
                } else if (Math.abs(offset + (result * SLOT_HEIGHT)) < (SLOT_SPEED * 1.5)) {
                    return true; // done
                }
            }
        }
        return false;
    }

    switch (this.state) {
        case STATE_SPINNING: // all slots spinning
            if (now - this.lastUpdate > RUNTIME) {
                this.state = STATE_SLOT1_STOP;
                this.lastUpdate = now;
            }
            break;
        case STATE_SLOT1_STOP: // slot 1
            this.stopped1 = _check_slot(this.offset1, this.result1);
            if (this.stopped1) {
                this.speed1 = 0;
                this.state++; // advance to next slot
                this.lastUpdate = now;
                // play reel icon specific audio
                var id = this.items1[this.result1].id;
                this.audios[id].play();
            }
            break;
        case STATE_SLOT2_STOP: // slot 1 stopped, slot 2
            this.stopped2 = _check_slot(this.offset2, this.result2);
            if (this.stopped2) {
                this.speed2 = 0;
                this.state++; // advance to next slot
                this.lastUpdate = now;
                // play reel icon specific audio
                var id = this.items2[this.result2].id;
                this.audios[id].play();
            }
            break;
        case STATE_SLOT3_STOP: // slot 2 stopped, slot 3
            this.stopped3 = _check_slot(this.offset3, this.result3);
            if (this.stopped3) {
                this.speed3 = 0;
                this.state = STATE_STOPPED;
                // play reel icon specific audio
                var id = this.items3[this.result3].id;
                this.audios[id].play();
            }
            break;
        case STATE_STOPPED: // slots stopped, wait for 2 seconds
            if (now - this.lastUpdate > 2000) {
                this.state = STATE_RESULTS;
            }
            break;
        case STATE_RESULTS: // check results
            var matches = this.checkWinLine();
            $('#results').show();
            $('#multiplier').text(matches);
            $('#status').text(BLURB_TBL[matches]);

            if (matches == 3) {
                // Play win sound
                this.audios.win3.play();
            } else if (matches == 2) {
                this.audios.win2.play();
            } else {
                // Play no-win sound
                this.audios.nowin.play();
            }

            this.state = STATE_END;
            break;
        case STATE_END: // game ends
            break;
        default:
    }
};

Game.prototype.draw = function (force) {

    if (this.state >= STATE_RESULTS) return;

    // draw the spinning slots based on current state
    for (var i = 1; i <= 3; i++) {
        var resultp = 'result' + i;
        var stopped = 'stopped' + i;
        var speedp = 'speed' + i;
        var offsetp = 'offset' + i;
        var cp = 'c' + i;
        if (this[stopped] || this[speedp] || force) {
            if (this[stopped]) {
                this[speedp] = 0;
                var c = this[resultp]; // get stop location
                this[offsetp] = -(c * SLOT_HEIGHT);

                if (this[offsetp] + DRAW_OFFSET > 0) {
                    // reset back to beginning
                    this[offsetp] = -this.resetOffset + SLOT_HEIGHT * 3;
                }
            } else {
                this[offsetp] += this[speedp];
                if (this[offsetp] + DRAW_OFFSET > 0) {
                    // reset back to beginning
                    this[offsetp] = -this.resetOffset + SLOT_HEIGHT * 3 - DRAW_OFFSET;
                }
            }
            // translate canvas location
            this[cp].css(this.cssTransform, this.trnOpen + '0px, ' + (this[offsetp] + DRAW_OFFSET) + 'px' + this.trnClose);
        }
    }
};
