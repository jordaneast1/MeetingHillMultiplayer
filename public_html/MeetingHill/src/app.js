//import initThreeCanvas from "./mainCanvas";
import "./app.scss";
import * as THREE from "three";
import Game from "./game.js";

const initAll = async () => {
  var chat = document.getElementById("chat");
  var blocker = document.getElementById("blocker");
  var instructions = document.getElementById("instructions");

  blocker.style.display = "none";

  var game;

  document.addEventListener("DOMContentLoaded", function () {
    game = new Game();

    function init() {
      blocker.style.display = "none";
      game.initJoystick();
      game.initSfx();
      var joystick = document.getElementById("joystick");
    }

    instructions.addEventListener("click", init);
  });
  //initThreeCanvas();
};

initAll();
