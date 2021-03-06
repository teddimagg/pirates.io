'use strict';
// ------------------------------------------------------------------------------------- //
    //  ENGINE VARIABLES
// ------------------------------------------------------------------------------------- //
var interval, canvas, ctx, height, width;
var tile = {
    width: 95,  //px
    height: 95  //px
}

var debugMode = false;
var range, offset;

// ------------------------------------------------------------------------------------- //
    //  GAME VARIABLES
// ------------------------------------------------------------------------------------- //
var playerlist;
var golds;
var player;
var plane = null;
var explotions = [];
var guistruct = {hitmark: null};

var scoreboardtick = 60;
// ------------------------------------------------------------------------------------- //
    //  GAME VARIABLES
// ------------------------------------------------------------------------------------- //

var server;

// ------------------------------------------------------------------------------------- //
    //  GRAPHICAL PRELOAD
// ------------------------------------------------------------------------------------- //
//Graphics variables
var playerImg = new Image(), wreckImg = new Image();
playerImg.src = 'img/ships.png';
wreckImg.src = 'img/shipwreck.png';
playerImg.onload = function() {console.log('ship built')};
wreckImg.onload = function() {console.log('wreckage found')};
var playerAnim = {
    i: 0,
    stage: 0
}

//Islands
var islandImg = new Image(), islandImg2 = new Image(), islandImg3 = new Image(), islandImg4 = new Image();
islandImg.src = 'img/island.png';
islandImg2.src = 'img/island2.png';
islandImg3.src = 'img/island3.png';
islandImg4.src = 'img/island4.png';
islandImg.onload = function() {console.log('island1 loaded')};
islandImg2.onload = function() {console.log('island2 loaded')};
islandImg3.onload = function() {console.log('island3 loaded')};
islandImg4.onload = function() {console.log('island4 loaded')};

//Collectables
var explotionImg = new Image();
explotionImg.src = 'img/fire.png';
explotionImg.onload = function() {console.log('explotions loaded')};

//Debug
var debugImg = new Image();
debugImg.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Square_with_corners.svg/2000px-Square_with_corners.svg.png';
debugImg.onload = function() {console.log('debug loaded')};

//LOADING HELPER
var loading = false;


// ------------------------------------------------------------------------------------- //
    //  LISTENERS AND INITIATORS
// ------------------------------------------------------------------------------------- //
document.addEventListener('DOMContentLoaded', init, false);
document.addEventListener('keydown', keyController, false);

// document.addEventListener('keydown', startSprint, false);
// document.addEventListener('keyup', stopSprint, false);


//Cookie for menu name
$(document).ready(function(){
    if(document.cookie !== undefined){
        var name = getCookie('cachedUsername');
        if(name){
            console.log(decodeURI(name));
            $('#name').val(decodeURI(name));
        }
        //should fetch the username
    }
});

function getCookie(name) {
  var value = "; " + document.cookie;
  var parts = value.split("; " + name + "=");
  if (parts.length == 2) return parts.pop().split(";").shift();
}

//Start game
$('#play').submit(function(event){
    event.preventDefault();
    player.name = $('#name').val();
    if(player.name){
        const data = {
            "name": player.name
        };
        console.log(document.cookie);
        $.ajax({
            type: "POST",
            url: '/addusername',
            data: JSON.stringify(data),
            contentType: "application/json",
            success: function(){
                console.log("ajax success");
            }
        });
        playerinit(player.name);
    }
});


//Dyynamically alter canvas size
$( window ).resize(function() {
    canvas.height = height = document.body.clientHeight;
    canvas.width = width = document.body.clientWidth;
});

var socket;

function playerinit(name){
    $('.gameitem').show();
    if(!player.alive){
        socket.emit('add user', name);
    }

    $('.menuitem').hide();
    $('.play').prop('disabled', true);
}

function init(){
    socket = io();

    //Set socket listeners
    socket.on('players', function(data){
        console.log('playerlist updated')
        playerlist = data;
    });

    socket.on('playerInfo', function(p){
        if(!p.alive){
            gameReset();
        }
        player = p;
    });

    socket.on('hit', function(loc){
        loc.cooldown = 250;
        guistruct.hitmark = loc;
    });

    socket.on('gameinit', function(data){
        plane = data.plane;
        server = data.conf;
        player = {
            //init only for lobby purposes
            x: Math.ceil(Math.random() * (server.map.x - 2*server.map.buffer - Math.ceil(width / tile.width))) + server.map.buffer + Math.ceil(width / tile.width / 2),
            y: Math.ceil(Math.random() * (server.map.y - 2*server.map.buffer - Math.ceil(height / tile.height))) + server.map.buffer + Math.ceil(height / tile.height / 2)
        }
    });

    socket.on('shipfleet', function(players){
        playerlist = players;
    });

    socket.on('disconnect', gameReset);

    canvas = document.querySelector('canvas');
    canvas.addEventListener('mousemove', mouseController, false);

    ctx = canvas.getContext('2d');

    canvas.height = height = document.body.clientHeight;
    canvas.width = width = document.body.clientWidth;

    interval = window.setInterval(tick, 1000 / 60);
}

// ------------------------------------------------------------------------------------- //
    //  GAME ENGINE HANDLERS
// ------------------------------------------------------------------------------------- //


function tick(){
    console.log(player.dir);
    if(plane && player){ //loading
        ctx.clearRect(0, 0, width, height);
        drawBackground();
        draw();
        if(playerlist){
            if(playerlist.length > 0){ drawPlayers(); }
            // if(golds.length > 0){ drawGolds(); }
        }
        if(player.alive){
            drawPlayer();
            updateMovements();
            updateLeaderboard();
        }
    }
}

// tengist socket
function mouseController(event){
    if(player.alive){
        var mouse = {x: event.clientX, y: event.clientY};
        var rad = Math.atan2(mouse.y - height / 2, mouse.x - width / 2) * 180 / Math.PI + 90;
        player.dir = rad.toFixed(2);
    }
}

//zoom in controller
$(document).bind('mousewheel', function(e){
    //TODO: limit zoom
    if(e.originalEvent.wheelDelta /120 > 0) {
        if(tile.width < 150 && tile.height < 150){
            tile.width++;
            tile.height++;
        }
    }
    else{
        if(tile.width > 50 && tile.height > 50){
            tile.width--;
            tile.height--;
        }
    }
});

var sprintbtn = false;
$(document).keydown(function(e) {
  if(!sprintbtn && e.keyCode == 16){
    socket.emit('sprint', true);
    sprintbtn = true;
  }
});

$(document).keyup(function(e) {
  if(sprintbtn && e.keyCode == 16){
    socket.emit('sprint', false);
    sprintbtn = false;
  }
});

// ------------------------------------------------------------------------------------- //
    //  GRAPHICS ENGINE
// ------------------------------------------------------------------------------------- //
var once = true;

function draw(){
    //Number of tiles from center to sides
    var viewport = {width: Math.ceil(width / tile.width), height: Math.ceil(height / tile.height)}
    range = {
        x: {
            min: Math.floor(player.x - viewport.width / 2),
            max: Math.floor(player.x + viewport.width / 2)
        },
        y: {
            min: Math.floor(player.y - viewport.height / 2),
            max: Math.floor(player.y + viewport.height / 2)
        }
    }

    //Positional offset and centering
    offset = {
        player: {x: (player.x % 1) * tile.width, y: (player.y % 1) * tile.height },
        center: {}
    }

    //Odd vs even viewport corrections
    if(viewport.width % 2 == 1){
        offset.center.x = width % tile.width / 2;
        if((player.x % 1) > 0.5){ range.x.min--; } //Odd number correction
    } else {
        offset.center.x = (width / 2) % tile.width;
    }

    if(viewport.height % 2 == 1){
        offset.center.y = height % tile.height / 2;
        if((player.y % 1) > 0.5){ range.y.min--; } //Odd number correction
    } else {
        offset.center.y = (height / 2) % tile.height;
    }

    //Converting rational offset to pixels dynamically
    if(offset.center.x){ offset.center.x = tile.width - offset.center.x; }
    if(offset.center.y){ offset.center.y = tile.height - offset.center.y; }

    //Debug menu
    if(once && debugMode){
        console.log(width, height);
        console.log(viewport);
        console.log(range);
        console.log(offset);
        once = false;
    }

    //Secondary iterators
    var i = {
        x: 0,
        y: 0
    }

    //The screen loop
    for(var x = range.x.min; x <= range.x.max; x++){
        for(var y = range.y.min; y <= range.y.max; y++){
            //Out of boundaries printing
            if(plane[x][y] >= 0){
                if(x < server.map.buffer || y < server.map.buffer || x > server.map.x - server.map.buffer || y > server.map.y - server.map.buffer){
                    ctx.fillStyle = '#00007f';
                    ctx.fillRect(
                        i.x * tile.width  - offset.center.x - offset.player.x, //xpos
                        i.y * tile.height - offset.center.y - offset.player.y, //ypos
                        tile.width, tile.height //x,y size
                    );
                } else {
                    if(plane[x][y] < 5){
                        ctx.save();
                        ctx.translate(
                            i.x * tile.width  - offset.center.x - offset.player.x + tile.width/2, //x
                            i.y * tile.height - offset.center.y - offset.player.y + tile.height/2 //y
                        );
                        ctx.rotate(random(x + y) * 180 * Math.PI / 180);
                        switch(plane[x][y]){
                            case 0: ctx.drawImage(islandImg,  -tile.width/2, -tile.height/2, tile.width, tile.height); break;
                            case 1: ctx.drawImage(islandImg,  -tile.width/2, -tile.height/2, tile.width, tile.height); break;
                            case 2: ctx.drawImage(islandImg2, -tile.width/2, -tile.height/2, tile.width, tile.height); break;
                            case 3: ctx.drawImage(islandImg3, -tile.width/2, -tile.height/2, tile.width, tile.height); break;
                            case 4: ctx.drawImage(islandImg4, -tile.width/2, -tile.height/2, tile.width, tile.height); break;
                        }
                        ctx.restore();
                    }
                }

                if(debugMode){
                    ctx.fillStyle = '#ffffff';
                    ctx.drawImage(debugImg    , i.x * tile.width - offset.center.x - offset.player.x    , i.y * tile.height - offset.center.y - offset.player.y     , tile.width, tile.height);
                    ctx.fillText(x + " - " + y, i.x * tile.width - offset.center.x - offset.player.x + 5, i.y * tile.height - offset.center.y - offset.player.y + 15, tile.width, tile.height);
                }
                i.y++;
            }
        }
        i.y = 0;
        i.x++;
    }
    if(!loading){ unLoad() };
}

function random(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function drawPlayer(){
    ctx.save();
    ctx.translate((width / 2), (height / 2));
    ctx.rotate(player.curdir * Math.PI / 180);

    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.arc(
        0,
        0,
        server.firerange * tile.width,
        -0.125*Math.PI,
        0.125*Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(
        0,
        0,
        server.firerange * tile.width,
        0.875*Math.PI,
        1.125*Math.PI);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,0,0,0.09)';
    ctx.lineWidth=3;
    ctx.beginPath();
    var rcooldown = 0.125 - (player.attack.right.cooldown / 180 * 0.25);
    ctx.arc(
        0,
        0,
        server.firerange * tile.width,
        rcooldown*Math.PI,
        0.125*Math.PI);
    ctx.stroke();
    var lcooldown = 0.875 + (player.attack.left.cooldown / 180 * 0.25);
    ctx.beginPath();
    ctx.arc(
        0,
        0,
        server.firerange * tile.width,
        0.875*Math.PI,
        lcooldown*Math.PI);
    ctx.stroke();

    if(playerAnim.i == 10){
        playerAnim.stage++;
        playerAnim.i = 0;
    } else {
        playerAnim.i++;
    }
    if(playerAnim.stage == 10){
        playerAnim.stage = 0;
    }
    ctx.drawImage(playerImg, Math.ceil(playerAnim.stage * 211), 0, 211, 340, -(tile.width*0.62 / 2), -(tile.height / 2), (tile.width*0.62), tile.height);
    ctx.restore();

    if(player.killstream.length){
        for(var i in player.killstream){
            console.log(player.killstream[i]);
            ctx.save();
            ctx.translate((width / 2), (height / 2));
            var ratio = (player.killstream[i].cooldown / server.notificationtime);

            ctx.fillStyle = 'rgba(180,61,11,' + ratio + ')';
            ctx.font="bold 20px Sail";
            ctx.textAlign="center";

            var string;
            (player.killstream[i].type == 'kill') ? string = 'You killed ' : string = 'You assisted the death of ';
            ctx.fillText(string + player.killstream[i].player, 0, -ratio*(height/4) - (height/4));
            ctx.restore();
        }
    }

}

function drawPlayers(){
    //Positional offset and centering
    for(var i = 0; i < playerlist.length; i++){
        if(playerlist[i].id != player.id){
            //Checks if current ship is in render distance
            if(playerlist[i].x > range.x.min - 1 && playerlist[i].x < range.x.max + 1 && playerlist[i].y > range.y.min - 1 && playerlist[i].y < range.y.max + 1){
                ctx.save();
                ctx.translate(
                    (playerlist[i].x - range.x.min) * tile.width - offset.center.x - offset.player.x,   //X
                    (playerlist[i].y - range.y.min) * tile.height - offset.center.y - offset.player.y   //Y
                );
                ctx.rotate(playerlist[i].curdir * Math.PI / 180);
                if(playerlist[i].alive){
                    ctx.drawImage(playerImg, -(tile.width / 2), -(tile.height / 2), tile.width, tile.height);
                } else {
                    ctx.drawImage(wreckImg, -(tile.width / 2), -(tile.height / 2), tile.width, tile.height);
                }
                ctx.restore();
                if(playerlist[i].alive){
                    ctx.save();
                    ctx.translate(
                        (playerlist[i].x - range.x.min) * tile.width - offset.center.x - offset.player.x,   //X
                        (playerlist[i].y - range.y.min) * tile.height - offset.center.y - offset.player.y   //Y
                    );
                    //Drawing name and healthbar
                    ctx.fillStyle = 'rgba(180,61,11,0.8)';
                    ctx.fillRect(-(tile.height / 4), -(tile.height / 2), tile.width / 2, tile.height / 12);
                    ctx.fillStyle = '#32CD32';
                    ctx.fillRect(-(tile.height / 4), -(tile.height / 2), (tile.width / 2)*(playerlist[i].health / 100), tile.height / 12);
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign="center";
                    ctx.fillText(playerlist[i].name, 0, -(tile.height / 2));
                    ctx.fillStyle = '#ffffff';
                    ctx.restore();
                }
            }
        }
    }

    //projectiles
    for(var i = 0; i < playerlist.length; i++){
        //Checks if current ship is in render distance
        if(playerlist[i].x > range.x.min - 1 && playerlist[i].x < range.x.max + 1 && playerlist[i].y > range.y.min - 1 && playerlist[i].y < range.y.max + 1){
            if(playerlist[i].attack.left.progr && playerlist[i].attack.left.progr < 10){
                ctx.save();
                ctx.translate(
                    (playerlist[i].attack.left.x - range.x.min) * tile.width - offset.center.x - offset.player.x,   //X
                    (playerlist[i].attack.left.y - range.y.min) * tile.height - offset.center.y - offset.player.y   //Y
                );
                ctx.drawImage(explotionImg, (10 - Math.floor(playerlist[i].attack.left.progr)) * 128, 0, 128, 128, -(tile.width/2), -(tile.height/2), (tile.width), (tile.height));
                ctx.restore();
            } else if (playerlist[i].attack.left.progr && playerlist[i].attack.left.progr > 0){
                ctx.save();
                ctx.translate(
                    (playerlist[i].attack.left.origx - range.x.min) * tile.width - offset.center.x - offset.player.x,   //X
                    (playerlist[i].attack.left.origy - range.y.min) * tile.height - offset.center.y - offset.player.y
                );   //Y

                var travelx, travely;
                var perc = (1 - (playerlist[i].attack.left.progr - 10) / 12);

                if(playerlist[i].attack.left.x > playerlist[i].attack.left.origx){
                    travelx = playerlist[i].attack.left.origx - playerlist[i].attack.left.x;
                } else {
                    travelx = playerlist[i].attack.left.x - playerlist[i].attack.left.origx;
                }

                if(playerlist[i].attack.left.y > playerlist[i].attack.left.origy){
                    travely = playerlist[i].attack.left.origy - playerlist[i].attack.left.y;
                } else {
                    travely = playerlist[i].attack.left.y - playerlist[i].attack.left.origy;
                }

                if(player.dir > 90){ travelx = -travelx; }
                if(player.dir < 0 || player.dir > 180){ travely = -travely; }

                travelx *= perc * tile.width;
                travely *= perc * tile.height;

                ctx.beginPath();
                ctx.fillStyle = 'rgb(0,0,0)';
                ctx.arc(
                    travelx,
                    travely,
                    tile.width / 20,
                    0*Math.PI,
                    4*Math.PI);
                ctx.fill();
                ctx.restore();
            }

            if(playerlist[i].attack.right.progr && playerlist[i].attack.right.progr < 10){
                ctx.save();
                ctx.translate(
                    (playerlist[i].attack.right.x - range.x.min) * tile.width - offset.center.x - offset.player.x,   //X
                    (playerlist[i].attack.right.y - range.y.min) * tile.height - offset.center.y - offset.player.y   //Y
                );
                ctx.drawImage(explotionImg, (10 - Math.floor(playerlist[i].attack.right.progr)) * 128, 0, 128, 128, -(tile.width/2), -(tile.height/2), (tile.width), (tile.height));
                ctx.restore();
            } else if (playerlist[i].attack.right.progr && playerlist[i].attack.right.progr > 0){
                ctx.save();
                ctx.translate(
                    (playerlist[i].attack.right.origx - range.x.min) * tile.width - offset.center.x - offset.player.x,   //X
                    (playerlist[i].attack.right.origy - range.y.min) * tile.height - offset.center.y - offset.player.y
                );   //Y

                var travelx, travely;
                var perc = (1 - (playerlist[i].attack.right.progr - 10) / 12);

                if(playerlist[i].attack.right.x > playerlist[i].attack.right.origx){
                    travelx = playerlist[i].attack.right.origx - playerlist[i].attack.right.x;
                } else {
                    travelx = playerlist[i].attack.right.x - playerlist[i].attack.right.origx;
                }

                if(playerlist[i].attack.right.y > playerlist[i].attack.right.origy){
                    travely = playerlist[i].attack.right.origy - playerlist[i].attack.right.y;
                } else {
                    travely = playerlist[i].attack.right.y - playerlist[i].attack.right.origy;
                }

                if(player.dir < 90){ travelx = -travelx; }
                if(player.dir > 0 && player.dir < 180){ travely = -travely; }

                travelx *= perc * tile.width;
                travely *= perc * tile.height;

                ctx.beginPath();
                ctx.fillStyle = 'rgb(0,0,0)';
                ctx.arc(
                    travelx,
                    travely,
                    tile.width / 20,
                    0*Math.PI,
                    4*Math.PI);
                ctx.fill();
                ctx.restore();
            }

        }

        if(guistruct.hitmark){
            if(guistruct.hitmark.cooldown){
                ctx.save();
                ctx.translate(
                    (guistruct.hitmark.x - range.x.min) * tile.width - offset.center.x - offset.player.x,   //X
                    (guistruct.hitmark.y - range.y.min) * tile.height - offset.center.y - offset.player.y   //Y
                );
                ctx.fillStyle = 'rgba(180,61,11,1)';
                ctx.font="bold 28px Sail";
                ctx.textAlign="center";
                ctx.fillText(guistruct.hitmark.damage, 0, (guistruct.hitmark.cooldown / 250) * tile.height - tile.height);
                ctx.restore();
                guistruct.hitmark.cooldown--;
            }
        }
    }
}

function drawGolds(){
    //Positional offset and centering
    for(var i = 0; i < golds.length; i++){
        //Checks if current ship is in render distance
        if(golds[i].x > range.x.min - 1 && golds[i].x < range.x.max + 1 && golds[i].y > range.y.min - 1 && golds[i].y < range.y.max + 1){
            ctx.save();
            ctx.translate(
                (golds[i].x - range.x.min) * tile.width - offset.center.x - offset.player.x,   //X
                (golds[i].y - range.y.min) * tile.height - offset.center.y - offset.player.y   //Y
            );
            ctx.drawImage(goldImg, -(tile.width / 4), -(tile.height / 4), tile.width / 2, tile.height / 2);
            ctx.restore();
        }
    }
}

function drawBackground(){
    ctx.fillStyle = '#70b6eb';
    ctx.fillRect(0, 0, width, height);
}

// ------------------------------------------------------------------------------------- //
    //  LOGICAL
// ------------------------------------------------------------------------------------- //

function updateMovements(){
    if(player.last && player.last == player.dir) return;
    socket.emit('sailing', player.dir);
    player.last = player.dir;
}

function gameReset(){
    gameMessage('You were killed by ' + player.lasttouch);

    player = { x: 0, y: 0 };

    $('.play').prop('disabled', false);
    $('.menuitem').show();
    $('.gameitem').hide();
    $('.play').focus();
}

function keyController(event){
    //a 65
    //d 68
    //shift 16
    if(player.alive){
        if(event.keyCode == 65){ socket.emit('fire', 'left'); }
        if(event.keyCode == 68){ socket.emit('fire', 'right'); }
        if(event.keyCode == 16){ socket.emit('sprint', true); }
    }
}

// function startSprint(event){
//     if(player.alive){ if(event.keyCode == 16){ socket.emit('sprint', true); }}
// }

// function stopSprint(event){
//     if(player.alive){if(event.keyCode == 16){ socket.emit('sprint', false); }}
// }

// ------------------------------------------------------------------------------------- //
    //  GUI
// ------------------------------------------------------------------------------------- //

function updateLeaderboard(){
    scoreboardtick--;
    if(!scoreboardtick){
        scoreboardtick = 60;
        var html = '';
        playerlist.sort(function(a, b){
          return a.score < b.score;
        });

        for(var i = 0; i < 10; i++){
            if(playerlist[i]){
                if(playerlist[i].alive){
                    if(playerlist[i].id == player.id){
                        html += '<li class="self">' + playerlist[i].name + ' <b>' + playerlist[i].score.toFixed(0) +  '</b></li>'
                    } else {
                        html += '<li>' + playerlist[i].name + ' <b>' + playerlist[i].score.toFixed(0) +  '</b></li>'
                    }
                }
            }
        }

        $('.userlist').html(html);
        $('.health').css('width', player.health + '%');
    }
}

function gameMessage(text){
    $('.gameMessage h3').text(text);
    $('.gameMessage').show();
    setTimeout(function(){
        $('.gameMessage').hide();
        $('.gameMessage h3').text('');
    }, 5000);
}

function unLoad(){
    loading = true;
    $('.menuitem').show();
    $('canvas').show();
    $('#loader').hide();
}

