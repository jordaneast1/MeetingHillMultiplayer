//import initThreeCanvas from "./mainCanvas";
import "./app.scss";
import Game from "./game.js";
import NchanSubscriber from "nchan";

const initAll = async () => {
  var chat = document.getElementById("chat");
  var blocker = document.getElementById("blocker");
  var instructions = document.getElementById("instructions");
  var info = document.getElementById("azura-info");

  blocker.style.display = "none";
  chat.style.display = "none";
  info.style.display = "none";

  var game;

  document.addEventListener("DOMContentLoaded", function () {
    game = new Game();
    var azura = document.getElementById("azuracast");
    azura.volume = 0;

    instructions.addEventListener("click", init);
    var gameInit = false;
    var blocked = true;
    var joystick;

    function init() {
      if (!gameInit) {
        blocker.style.display = "none";
        game.initJoystick();
        game.initSfx();
        //azura = document.getElementById("azuracast");
        joystick = document.getElementById("joystick");
        gameInit = true;
        azura.volume = 1;
        blocked = false;
        chat.style.display = "block";
        info.style.display = "block";
        
      } else {
        blocker.style.display = "none";
        joystick.style.display = "block";
        info.style.display = "block";
        azura.volume = 1;
      }
    }

    document.addEventListener("keyup", (e) => {
      if (e.code === "Escape") {
        if (gameInit) {
          if (!blocked) {
            joystick.style.display = "none";
            blocker.style.display = "block";
            azura.volume = 0;
            blocked = true;
            chat.style.display = "none";
            info.style.display = "none";
          } else {
            blocker.style.display = "none";
            joystick.style.display = "block";
            chat.style.display = "block";
            info.style.display = "block";
            azura.volume = 1;
            blocked = false;
          }
        }
      } else {
      }
    });
  });

  //NChan subscribe
  var nowPlaying;
  // var name = document.getElementById("stream-name");
  // var description = document.getElementById("stream-description");
  var sub = new NchanSubscriber(
    "http://meetinghill.tildevisual.tv/api/live/nowplaying/meeting_hill"
  );
  var nowPlaying;

  sub.on("message", function (message, message_metadata) {
    // Do something with the Now Playing data.
    nowPlaying = JSON.parse(message);
    console.log(nowPlaying);
    $("#stream-name").text(nowPlaying.live.streamer_name);
    $("#stream-description").text(nowPlaying.station.description);
  });
  sub.start();

  //slider
  var slider = document.getElementById("streamVolume");
  var volume = slider.value;
  slider.oninput = function () {
    var volume = slider.value;
    azura.volume = volume/100;
    game.setVolume(volume/100);
  };

  // var hillslider = document.getElementById("hillVolume");
  // hillslider.oninput = function () {
  //   var volume = hillslider.value;
  //   game.setVolume(volume/100);
  // };

  var un_mute = document.getElementById("un-mute");
  var muted = false;
  var azura = document.getElementById("azuracast");

  un_mute.onclick = function () {
    muted = !muted;
    if (muted){
      console.log("mute");
      azura.volume = 0;
      game.setMute(muted);

    } else {
      console.log("unmute");
      azura.volume = volume/100;
      game.setMute(muted);
    }
  };

  //initThreeCanvas();
};

initAll();
