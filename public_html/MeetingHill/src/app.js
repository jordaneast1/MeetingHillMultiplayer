//import initThreeCanvas from "./mainCanvas";
import "./app.scss";
import Game from "./game.js";

const initAll = async () => {
  var chat = document.getElementById("chat");
  var blocker = document.getElementById("blocker");
  var instructions = document.getElementById("instructions");

  blocker.style.display = "none";
  chat.style.display = "none";

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
      } else {
        blocker.style.display = "none";
        joystick.style.display = 'block';
        azura.volume = 1;
      }
    }

    document.addEventListener("keyup", (e) => {
      if (e.code === "Escape") {
        if (gameInit){
        if (!blocked){
          joystick.style.display = "none";
          blocker.style.display = "block";
          azura.volume = 0;
          blocked = true;
          chat.style.display = "none";
        } else {
          blocker.style.display = "none";
          joystick.style.display = 'block';
          chat.style.display = "block";
          azura.volume = 1;
          blocked = false;
        }
      }

      } else {
      }
    });
  });
  //initThreeCanvas();
};

initAll();
