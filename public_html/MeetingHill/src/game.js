import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import * as THREE from 'three';
import io from "socket.io-client";
import Stats from "stats.js";
import { SFX, Preloader, JoyStick } from "../libs/toon3d.js";
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from "postprocessing";
// import BloomEffect from "./node_modules/three/examples/jsm/postprocessing/BloomPass.js";
// import RenderPass  from "./node_modules/three/examples/jsm/postprocessing/RenderPass.js";

// import EffectComposer from "./node_modules/three/examples/jsm/postprocessing/EffectComposer.js";

// import EffectPass from "./node_modules/three/examples/jsm/postprocessing/EffectPass.js";


export default class Game {
  constructor() {
    // if (!Detector.webgl) Detector.addGetWebGLMessage();

    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.stats.dom);

    this.modes = Object.freeze({
      NONE: Symbol("none"),
      PRELOAD: Symbol("preload"),
      INITIALISING: Symbol("initialising"),
      CREATING_LEVEL: Symbol("creating_level"),
      ACTIVE: Symbol("active"),
      GAMEOVER: Symbol("gameover"),
    });
    this.mode = this.modes.NONE;

    this.container;
    this.player;
    this.cameras;
    this.camera;
    this.scene;
    this.renderer;
    this.animations = {};
    this.assetsPath = "assets/";

    //jordan stuff
    this.ring;
    this.ringCanvas;
    this.ringContext;

    this.remotePlayers = [];
    this.remoteColliders = [];
    this.initialisingPlayers = [];
    this.remoteData = [];

    this.messages = {
      text: ["Welcome to Meeting Hill"],
      index: 0,
    };

    this.container = document.createElement("div");
    this.container.style.height = "100%";
    document.body.appendChild(this.container);

    const sfxExt = SFX.supportsAudioType("mp3") ? "mp3" : "ogg";

    const game = this;
    this.anims = [
      //"Idle",
      "Walking",
      "WalkingBackwards",
      "Turn",
      "Running",
    ];

    const options = {
      assets: [
        `${this.assetsPath}images/nx.jpg`,
        `${this.assetsPath}images/px.jpg`,
        `${this.assetsPath}images/ny.jpg`,
        `${this.assetsPath}images/py.jpg`,
        `${this.assetsPath}images/nz.jpg`,
        `${this.assetsPath}images/pz.jpg`,
      ],
      oncomplete: function () {
        game.init();
      },
    };

    this.anims.forEach(function (anim) {
      options.assets.push(`${game.assetsPath}fbx/anims/${anim}.fbx`);
    });
    options.assets.push(`${game.assetsPath}fbx/people/Idle.fbx`);

    options.assets.push(`${game.assetsPath}TerrainOBJ/TerrainWCollider2.obj`);
    options.assets.push(`${game.assetsPath}TerrainOBJ/TerrainTextureBaked.jpg`);
    options.assets.push(`${game.assetsPath}TerrainOBJ/WoodAlbedo2.jpg`);
    options.assets.push(`${game.assetsPath}TerrainOBJ/WoodRoughness.jpg`);
    options.assets.push(`${game.assetsPath}TerrainOBJ/rug.jpg`);
    options.assets.push(`${game.assetsPath}TerrainOBJ/rugAlpha.jpg`);
    options.assets.push(`${game.assetsPath}images/OrbBump.jpg`);
    options.assets.push(`${game.assetsPath}images/orbEnviromap.jpg`);

    options.assets.push(`${game.assetsPath}sfx/birds_short.mp3`);
    options.assets.push(`${game.assetsPath}sfx/808_t1.mp3`);
    options.assets.push(`${game.assetsPath}sfx/Clouds_1_pad.mp3`);
    options.assets.push(`${game.assetsPath}sfx/cold_stormy_wind.mp3`);


    // options.assets.push(`${this.assetsPath}/HDRITerrain.json`);
    //options.assets.push(`${this.assetsPath}TerrainOBJ/cloudHemi.obj`);
    //options.assets.push(`${this.assetsPath}TerrainOBJ/cloudAlpha.jpg`);

    this.mode = this.modes.PRELOAD;

    this.clock = new THREE.Clock();

    const preloader = new Preloader(options);

    this.manager = new THREE.LoadingManager();
    this.manager.onLoad = function () {
      console.log("Loading complete!");
      preloader.managerDone = true;
      var joystick = document.getElementById("joystick");
      var blocker = document.getElementById("blocker");
      blocker.style.display = "block";
    };

    window.onError = function (error) {
      console.error(JSON.stringify(error));
    };
  }

  set activeCamera(object) {
    this.cameras.active = object;
  }

  init() {
    this.mode = this.modes.INITIALISING;
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      10,
      8000
    );

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x00a0f0);
    //this.scene.fog = new THREE.FogExp2(0xfffaaa, 0.0001);
    //this.scene.fog = new THREE.FogExp2(0xffffff, 0.0001);


    const hemiLight = new THREE.HemisphereLight(0xffeeb1, 0x061A31, 0.5);
    this.scene.add(hemiLight);



    //const ambient = new THREE.AmbientLight(0x647687, 0);
    //this.scene.add(ambient);
    //ambient.castShadow = false;

    const light = new THREE.DirectionalLight(0xffeeb1, 0.8);
    light.position.set(30, 100, 40);
    light.target.position.set(0, 0, 0);
    //light.castShadow = false;

    light.castShadow = true;

    const lightSize = 400;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 700;
    light.shadow.camera.left = light.shadow.camera.bottom = -lightSize;
    light.shadow.camera.right = light.shadow.camera.top = lightSize;

    light.shadow.bias = 0.0039;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;

    this.sun = light;
    this.scene.add(light);

    // model
    const loader = new FBXLoader(this.manager);
    const game = this;

    this.player = new PlayerLocal(this);

    this.loadEnvironment(loader);

    this.createTextRing();
    this.initChat();

    //this.speechBubble = new SpeechBubble(this, "", 150);
    //this.speechBubble.mesh.position.set(0, 350, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.initPostProcessing();


    if ("ontouchstart" in window) {
      window.addEventListener(
        "touchdown",
        (event) => game.onMouseDown(event),
        false
      );
    } else {
      window.addEventListener(
        "mousedown",
        (event) => game.onMouseDown(event),
        false
      );
    }

    window.addEventListener("resize", () => game.onWindowResize(), false);
  }

  initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new EffectPass(this.camera, new BloomEffect()));
  }

  //sound
  initSfx() {
    // this.sfx = {};
    // this.sfx.context = new (window.AudioContext || window.webkitAudioContext)();
    // this.sfx.wind = new SFX({
    //   context: this.sfx.context,
    //   src: { mp3: `${this.assetsPath}sfx/cold_stormy_wind.mp3` },
    //   loop: true,
    //   autoplay: true,
    //   volume: 0.1,
    // });


    this.ears = new THREE.Object3D();
    this.ears.rotation.Y = 90;
    this.player.object.add(this.ears);
    
    this.listener = new THREE.AudioListener();
    this.ears.add(this.listener);

    this.radioElement = document.getElementById("azuracast");
    this.radioElement.volume = 0;
    this.radioElement.play();

    this.initSpeakers();
  }

  initSpeakers() {
    //this.sounds = {};


    //AZURACAST
    var geometry = new THREE.BoxGeometry(10, 10, 10);
    var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    var cube = new THREE.Mesh(geometry, material);
    cube.position.set(630, -50, 450);
    cube.visible = false;

    if (this.radioElement != null) {
      console.log("found elem");
      var positionalAudio = new THREE.PositionalAudio(this.listener);
      positionalAudio.setMediaElementSource(this.radioElement);
      positionalAudio.setRolloffFactor(1);
      positionalAudio.setDistanceModel("inverse");
      positionalAudio.setRefDistance(30);
      positionalAudio.setDirectionalCone(180, 180, 1);
      positionalAudio.setVolume( 7 );

      cube.add(positionalAudio);
      // var helper = new PositionalAudioHelper(positionalAudio);
      // positionalAudio.add(helper);

    } else {
      console.log("no azura cast DOM element");
    }
    this.scene.add(cube);
    this.radioElement.volume = 1;
    //this.sounds.push(positionalAudio);

    //SOUND 1
    var cube1 = new THREE.Mesh(geometry, material);
    var sound1 = new THREE.PositionalAudio(this.listener);
    var audioLoader1 = new THREE.AudioLoader();
    audioLoader1.load(`${this.assetsPath}sfx/birds_short.mp3`, function (buffer) {
      sound1.setBuffer(buffer);
      sound1.setRolloffFactor(1);
      sound1.setDistanceModel("exponential");
      sound1.setRefDistance(10);
      sound1.setDirectionalCone(180, 180, 1);
      sound1.play();
      sound1.setLoop( true );   
      sound1.setVolume( 9 );

     });
    var material1 = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    var cube1 = new THREE.Mesh(geometry, material1);
    cube1.position.set(-860, -170, -90);
    cube1.add(sound1);
    this.scene.add(cube1);
    cube1.visible = false;
    //var helper1 = new PositionalAudioHelper(positionalAudio);
    //sound1.add(helper1);
    //this.sounds.push(sound1);


    //SOUND 2
    var cube2 = new THREE.Mesh(geometry, material);
    var sound2 = new THREE.PositionalAudio(this.listener);
    var audioLoader2 = new THREE.AudioLoader();
    audioLoader2.load(`${this.assetsPath}sfx/Clouds_1_pad.mp3`, function (
      buffer
    ) {
      sound2.setBuffer(buffer);
      sound2.setRolloffFactor(.9);
      sound2.setRefDistance(5);
      sound2.setDirectionalCone(180, 180, 1);
      sound2.play();
      sound2.setLoop( true );
      sound2.setVolume( 3 );

    });
    var material2 = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    var cube2 = new THREE.Mesh(geometry, material2);
    cube2.position.set(-455, -140, 381);
    cube2.add(sound2);
    this.scene.add(cube2);
    cube2.visible = false;
    // var helper2 = new PositionalAudioHelper(positionalAudio);
    // sound2.add(helper2);
    //this.sounds.push(sound2);


    //SOUND 3
    var cube3 = new THREE.Mesh(geometry, material);
    var sound3 = new THREE.PositionalAudio(this.listener);
    var audioLoader3 = new THREE.AudioLoader();
    audioLoader3.load(`${this.assetsPath}sfx/808_t1.mp3`, function (
      buffer
    ) {
      sound3.setBuffer(buffer);
      sound3.setRolloffFactor(1);
      sound3.setRefDistance(15);
      sound3.setDirectionalCone(180, 180, 1);
      sound3.play();
      sound3.setLoop( true );
      sound3.setVolume( 1 );

    });
    var soundWind = new THREE.PositionalAudio(this.listener);
    var audioLoaderWind = new THREE.AudioLoader();
    audioLoaderWind.load(`${this.assetsPath}sfx/cold_stormy_wind.mp3`, function (
      buffer
    ) {
      soundWind.setBuffer(buffer);
      soundWind.setRolloffFactor(1);
      soundWind.setRefDistance(300);
      soundWind.setDirectionalCone(180, 180, 1);
      soundWind.play();
      soundWind.setLoop( true );
      soundWind.setVolume( .5 );

    });
    var material3 = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    var cube3 = new THREE.Mesh(geometry, material3);
    cube3.position.set(-597, 138, -887);
    cube3.add(sound3);
    cube3.add(soundWind);
    this.scene.add(cube3);
    cube3.visible = false;
    // var helper3 = new PositionalAudioHelper(positionalAudio);
    // sound3.add(helper3);
    //this.sounds.push(soundWind);
    //this.sounds.push(sound3);


  }

  initJoystick() {
    this.joystick = new JoyStick({
      onMove: this.playerControl,
      game: this,
    });
  }

  loadEnvironment(loader) {
    const game = this;
    //const jsonloader = new THREE.ObjectLoader();

    /*loader.load(`${this.assetsPath}fbx/town.fbx`, function(object){
			game.environment = object;
			game.colliders = [];
			game.scene.add(object);
			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					if (child.name.startsWith("proxy")){
						game.colliders.push(child);
						child.material.visible = false;
					}else{
						child.castShadow = true;
						child.receiveShadow = true;
					}
				}
			} );*/

    game.colliders = [];

    const objLoader = new OBJLoader(this.manager);

    objLoader.load('assets/TerrainOBJ/TerrainWCollider2.obj', function (object) {
      object.scale.set(2, 2, 2);
      object.position.set(0, 0, 0);
      object.rotation.set(0, 160, 0);
      game.environment = object;
      game.scene.add(object);
      // object.materials = materials;

      object.traverse(function (child) {
        if (child.isMesh) {
          if (child.name.startsWith("proxy")) {
            game.colliders.push(child);
            // console.log(child.material.visible)
            child.material.visible = false;

          } else {
            if (child.name.startsWith("Polygon_Reduction")) {
              console.log(child.name);
              var texture = new THREE.TextureLoader().load("assets/TerrainOBJ/TerrainTextureBaked.jpg");

              child.material = new THREE.MeshStandardMaterial();
              //child.material.colour = '#000000',
              child.material.roughness = 0;
              child.material.map = texture;
            } else {
              //Speakers
              if (child.name.startsWith("MainSpeaker")) {
                var woodDiffuse = new THREE.TextureLoader().load("assets/TerrainOBJ/WoodAlbedo2.jpg");
                var woodRoughness = new THREE.TextureLoader().load("assets/TerrainOBJ/WoodRoughness.jpg");

                child.material = new THREE.MeshBasicMaterial();
                child.material.map = woodDiffuse;
                child.material.roughnessMap = woodRoughness;
                child.material.roughness = 1;

              } else {
                if (child.name.startsWith("Cable")) {
                  child.material = new THREE.MeshBasicMaterial();
                  child.material.color = 0x000000;
                  child.material.transparent = true;
                  child.material.opacity = 1;
                  child.receiveShadow = false;
                }
                else {
                  if (child.name.startsWith("rug")) {
                    var rugDiffuse = new THREE.TextureLoader().load("assets/TerrainOBJ/rug.jpg");
                    var rugAlpha = new THREE.TextureLoader().load("assets/TerrainOBJ/rugAlpha.jpg");
                    child.material = new THREE.MeshBasicMaterial();
                    child.material.map = rugDiffuse;
                    child.material.transparent = true;
                    child.material.alphaMap = rugAlpha;
                  }
                }
              }



            }
            child.receiveShadow = true;
          }
          child.receiveShadow = true;
        }

      });
    });

    const tloader = new THREE.CubeTextureLoader(this.manager);
    tloader.setPath(`${game.assetsPath}/images/`);

    var textureCube = tloader.load([
      "px.jpg",
      "nx.jpg",
      "py.jpg",
      "ny.jpg",
      "pz.jpg",
      "nz.jpg",
    ]);

    game.scene.background = textureCube;

    game.loadNextAnim(loader);

    //  jsonloader.load(`${this.assetsPath}/HDRITerrain.json`, function (object) {
    //     object.scale.set(200000, 200000, 200000);
    //     object.position.set(-20,2000,-20);
    //     game.scene.add(object);
    //   });

    // jsonloader.load(`${this.assetsPath}/CloudHemisphere.json`, function (object) {
    //  // object.add(pivotPoint)
    //   object.scale.set(300, 300, 300);
    //   game.scene.add(object);

    //   var RotationSpeed = 5;
    //   function cloudRotator() {

    //     object.rotation.y -= RotationSpeed *10;

    //   }
    // });

    /*
    function cloudRotator() {
      var time = Date.now() *0.0005;

      
      object.rotation.y = Math.cos( time * 7 ) * 3;

  }

    cloudRotator()
*/
  }

  loadNextAnim(loader) {
    let anim = this.anims.pop();
    const game = this;
    loader.load(`${this.assetsPath}fbx/anims/${anim}.fbx`, function (object) {
      game.player.animations[anim] = object.animations[0];
      if (game.anims.length > 0) {
        game.loadNextAnim(loader);
      } else {
        delete game.anims;
        game.action = "Idle";
        game.mode = game.modes.ACTIVE;
        game.animate();
      }
    });
  }

  createTextRing() {
    const game = this;
    var geometry = new THREE.CylinderGeometry(
      512 * 1,
      512 * 1,
      256 * 1,
      100,
      1,
      1,
      true
    );


    var orbTexture = new THREE.TextureLoader().load("assets/images/OrbBump.jpg");

    const assetsUrl = "assets/images/";
    const urls = [
      assetsUrl + "px.jpg",
      assetsUrl + "nx.jpg",
      assetsUrl + "py.jpg",
      assetsUrl + "ny.jpg",
      assetsUrl + "pz.jpg",
      assetsUrl + "nz.jpg",
    ];
    const envMap = new THREE.CubeTextureLoader().load(urls);

    var staticmaterial = new THREE.MeshPhysicalMaterial({
      color: "#FFFFFF",
      metalness: 1,
      side: THREE.DoubleSide,
      bumpScale: 0.1,
      bumpMap: orbTexture,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      roughnessMap: orbTexture,
      roughness: 0,
      envMap: envMap,
      envMapIntensity: 0.8,
      premultipliedAlpha: true,
      opacity: 0.2,
      transparent: true,
      depthWrite: false,
      //receiveShadow: false,
    });

    // var staticmaterial = new THREE.MeshBasicMaterial({
    //   color: 0xffffff,
    //   side: THREE.DoubleSide,
    //   transparent: true,
    //   opacity: 0.1,
    //   depthWrite: false,
    // });


    var staticRing = new THREE.Mesh(geometry, staticmaterial);
    staticRing.position.set(500, 250, 300);

    var textmat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
      fog: false,
      depthWrite: false,
    });
    game.ring = new THREE.Mesh(geometry, textmat);
    game.ring.position.set(500, 250, 300);
    game.ring.rotation.y = 45 + 180;
    game.scene.add(staticRing);
    game.scene.add(game.ring);

    this.config = {
      font: "Roboto Mono",
      size: 15,
      padding: 15,
      colour: "#0xffffff",
      width: 2048,
      height: 128,
    };

    this.ringCanvas = this.createRingCanvas(
      this.config.width,
      this.config.height
    );
    this.ringContext = this.ringCanvas.getContext("2d");
    this.tempCanvas = this.createRingCanvas(
      this.config.width,
      this.config.height
    );
    this.tempContext = this.tempCanvas.getContext("2d");

    var mat = new THREE.CanvasTexture(this.ringCanvas);
    this.ring.material.map = mat;
    //game.ring.material.alphaMap = mat;
    this.initRing("Meeting Hill");
  }
  initRing(msg) {
    this.ringContext.font = `${this.config.size}pt ${this.config.font}`;

    //this.ringContext.fillStyle = "black";
    //this.ringContext.fillRect(0, 0, this.config.width, this.config.height);
    //this.wrapText(msg, g, this.config);
    this.ringContext.textAlign = "centre";
    //g.fillStyle = 'white';
    //g.fillText(msg, 512/2, 128);
    this.ring.material.map.needsUpdate = true;
  }

  createRingCanvas(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  map_range(value, low1, high1, low2, high2) {
    return low2 + ((high2 - low2) * (value - low1)) / (high1 - low1);
  }

  quatToEuler(q1) {
    var pitchYawRoll = new THREE.Vector3();
    var sqw = q1.w * q1.w;
    var sqx = q1.x * q1.x;
    var sqy = q1.y * q1.y;
    var sqz = q1.z * q1.z;
    var unit = sqx + sqy + sqz + sqw; // if normalised is one, otherwise is correction factor
    var test = q1.x * q1.y + q1.z * q1.w;
    var heading;
    var attitude;
    var bank;
    if (test > 0.499 * unit) {
      // singularity at north pole
      heading = 2 * Math.atan2(q1.x, q1.w);
      attitude = Math.PI / 2;
      bank = 0;
      return;
    }
    if (test < -0.499 * unit) {
      // singularity at south pole
      heading = -2 * Math.atan2(q1.x, q1.w);
      attitude = -Math.PI / 2;
      bank = 0;
      return;
    } else {
      heading = Math.atan2(
        2 * q1.y * q1.w - 2 * q1.x * q1.z,
        sqx - sqy - sqz + sqw
      );
      attitude = Math.asin((2 * test) / unit);
      bank = Math.atan2(
        2 * q1.x * q1.w - 2 * q1.y * q1.z,
        -sqx + sqy - sqz + sqw
      );
    }
    pitchYawRoll.z = Math.floor(attitude * 1000) / 1000;
    pitchYawRoll.y = Math.floor(heading * 1000) / 1000;
    pitchYawRoll.x = Math.floor(bank * 1000) / 1000;

    return pitchYawRoll;
  }
  eulerToAngle(rot) {
    var ca = 0;
    if (rot > 0) {
      ca = Math.PI * 2 - rot;
    } else {
      ca = -rot;
    }

    return ca / ((Math.PI * 2) / 360); // camera angle radians converted to degrees
  }

  updateRingText(msg, id) {
    var erot = this.quatToEuler(this.player.object.quaternion);
    var rot = this.eulerToAngle(erot.y);
    rot = (rot + 180) % 360;
    var rotRemapped = this.map_range(rot, 0, 360, this.config.width - 50, 0);
    // console.log( rot, rotRemapped)

    this.ringContext.font = `${this.config.size}pt ${this.config.font}`;
    this.ringContext.textAlign = "left";
    this.ringContext.fillStyle = "white";
    this.ringContext.fillText(msg, rotRemapped, this.config.height - 5);
    this.ring.material.map.needsUpdate = true;
  }

  updateRing() {
    this.tempContext.drawImage(this.ringCanvas, 0, 0);
    //this.tempContext.fillStyle = "rgb(0,0,0,1)";
    //this.tempContext.fillRect(0, 0, this.config.width, this.config.height);

    this.ringContext.clearRect(0, 0, this.config.width, this.config.height);

    this.ringContext.drawImage(this.tempCanvas, 0, -1);

    this.tempContext.clearRect(0, 0, this.config.width, this.config.height);

    this.ring.material.map.needsUpdate = true;
  }

  playerControl(forward, turn) {
    turn = -turn;

    if (forward > 0.3) {
      if (this.player.action != "Walking" && this.player.action != "Running")
        this.player.action = "Walking";
    } else if (forward < -0.3) {
      if (this.player.action != "WalkingBackwards")
        this.player.action = "WalkingBackwards";
    } else {
      forward = 0;
      if (Math.abs(turn) > 0.15) {
        this.updateRingText(".", this.player.id);
        if (this.player.action != "Turn") this.player.action = "Turn";
      } else if (this.player.action != "Idle") {
        this.player.action = "Idle";
      }
    }

    if (forward == 0 && turn == 0) {
      delete this.player.motion;
    } else {
      this.player.motion = { forward, turn };
    }

    this.player.updateSocket();
  }

  createCameras() {
    const front = new THREE.Object3D();
    front.position.set(112, 100, 600);
    front.parent = this.player.object;
    const back = new THREE.Object3D();
    back.position.set(0, 600, -1050);
    back.parent = this.player.object;
    const chat = new THREE.Object3D();
    chat.position.set(0, 50, -45);
    chat.parent = this.player.object;

    const globalchat = new THREE.Object3D();
    globalchat.position.set(25, 2000, -15550);
    globalchat.parent = this.player.object;

    const wide = new THREE.Object3D();
    wide.position.set(17, 83, 166);
    wide.parent = this.player.object;
    const overhead = new THREE.Object3D();
    overhead.position.set(0, 500, 0);
    overhead.parent = this.player.object;
    const collect = new THREE.Object3D();
    collect.position.set(40, 82, 94);
    collect.parent = this.player.object;
    this.cameras = { front, back, wide, overhead, collect, chat, globalchat };
    this.activeCamera = this.cameras.back;
  }

  showMessage(msg, fontSize = 20, onOK = null) {
    const txt = document.getElementById("message_text");
    txt.innerHTML = msg;
    txt.style.fontSize = fontSize + "px";
    const btn = document.getElementById("message_ok");
    const panel = document.getElementById("message");
    const game = this;
    if (onOK != null) {
      btn.onclick = function () {
        panel.style.display = "none";
        onOK.call(game);
      };
    } else {
      btn.onclick = function () {
        panel.style.display = "none";
      };
    }
    panel.style.display = "flex";
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateRemotePlayers(dt) {
    if (
      this.remoteData === undefined ||
      this.remoteData.length == 0 ||
      this.player === undefined ||
      this.player.id === undefined
    )
      return;

    const newPlayers = [];
    const game = this;
    //Get all remotePlayers from remoteData array
    const remotePlayers = [];
    const remoteColliders = [];

    this.remoteData.forEach(function (data) {
      if (game.player.id != data.id) {
        //Is this player being initialised?
        let iplayer;
        game.initialisingPlayers.forEach(function (player) {
          if (player.id == data.id) iplayer = player;
        });
        //If not being initialised check the remotePlayers array
        if (iplayer === undefined) {
          let rplayer;
          game.remotePlayers.forEach(function (player) {
            if (player.id == data.id) rplayer = player;
          });
          if (rplayer === undefined) {
            //Initialise player
            game.initialisingPlayers.push(new Player(game, data));
          } else {
            //Player exists
            remotePlayers.push(rplayer);
            remoteColliders.push(rplayer.collider);
          }
        }
      }
    });

    this.scene.children.forEach(function (object) {
      if (
        object.userData.remotePlayer &&
        game.getRemotePlayerById(object.userData.id) == undefined
      ) {
        game.scene.remove(object);
      }
    });

    this.remotePlayers = remotePlayers;
    this.remoteColliders = remoteColliders;
    this.remotePlayers.forEach(function (player) {
      player.update(dt);
    });
  }

  initChat() {
    this.chat = document.getElementById("chat");
    this.chatOn = false;
  }

  onMouseDown(event) {
    if (
      this.remoteColliders === undefined ||
      this.remoteColliders.length == 0
      // this.speechBubble === undefined ||
      // this.speechBubble.mesh === undefined
    )
      return;

    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObjects(this.remoteColliders);
    const chat = this.chat;

    if (intersects.length > 0) {
      const object = intersects[0].object;
      const players = this.remotePlayers.filter(function (player) {
        if (player.collider !== undefined && player.collider == object) {
          return true;
        }
      });
      if (players.length > 0) {
        const player = players[0];
        console.log(`onMouseDown: player ${player.id}`);
        // this.speechBubble.player = player;
        // this.speechBubble.update("");
        // this.scene.add(this.speechBubble.mesh);
        // this.chatSocketId = player.id;
        // chat.style.bottom = "0px";
        // this.activeCamera = this.cameras.chat;
      }
    } else {
      //Is the chat panel visible?
      if (
        chat.style.bottom == "0px" &&
        window.innerHeight - event.clientY > 40
      ) {
        console.log("onMouseDown: No player found");
        /*if (this.speechBubble.mesh.parent !== null)
          this.speechBubble.mesh.parent.remove(this.speechBubble.mesh);
        delete this.speechBubble.player;
        delete this.chatSocketId;
        chat.style.bottom = "-50px";
        this.activeCamera = this.cameras.back;*/
      } else {
        console.log("onMouseDown: typing");
      }
    }
  }

  setGlobalChat(isOn) {
    const chat = this.chat;
    if (isOn != this.chatOn) {
      if (isOn) {
        //console.log(`set global chat on`);
        //this.chatSocketId = player.id;
        chat.style.bottom = "0px";
        this.activeCamera = this.cameras.globalchat;
      } else {
        //console.log(`set global chat off`);
        chat.style.bottom = "-50px";
        this.activeCamera = this.cameras.back;
      }
      this.chatOn = isOn;
    }
  }

  getRemotePlayerById(id) {
    if (this.remotePlayers === undefined || this.remotePlayers.length == 0)
      return;

    const players = this.remotePlayers.filter(function (player) {
      if (player.id == id) return true;
    });

    if (players.length == 0) return;

    return players[0];
  }

  animate() {
    const game = this;
    const dt = this.clock.getDelta();

    requestAnimationFrame(function () {
      game.animate();
    });
    //this.composer.render(clock.getDelta());
    this.stats.begin();


    this.updateRemotePlayers(dt);

    if (this.player.mixer != undefined && this.mode == this.modes.ACTIVE)
      this.player.mixer.update(dt);

    if (this.player.action == "Walking") {
      const elapsedTime = Date.now() - this.player.actionTime;
      if (elapsedTime > 1000 && this.player.motion.forward > 0) {
        this.player.action = "Running";
      }
    }

    if (this.player.motion !== undefined) this.player.move(dt);

    if (
      this.cameras != undefined &&
      this.cameras.active != undefined &&
      this.player !== undefined &&
      this.player.object !== undefined
    ) {
      this.camera.position.lerp(
        this.cameras.active.getWorldPosition(new THREE.Vector3()),
        0.05
      );
      //player position
      const pos = this.player.object.position.clone();
      if (this.cameras.active == this.cameras.chat) {
        pos.y += 70;
      } else if (this.cameras.active == this.cameras.globalchat) {
        pos.y += 100;
      } else {
        pos.y += 50;
      }
      this.camera.lookAt(pos);
    }

    if (this.sun !== undefined) {
      this.sun.position.copy(this.camera.position);
      this.sun.position.y += 10;
      this.sun.position.z += 120;
      this.sun.position.x += -10;
    }

    //hBubble !== undefined)
    //  this.speechBubble.show(this.camera.position);

    this.updateRing();

    this.composer.render(this.clock.getDelta());

    //this.renderer.render(this.scene, this.camera);

    this.stats.end();
    //console.log(this.object.mixer);
  }
}

class Player {
  constructor(game, options) {
    this.local = true;
    let model, colour;

    const colours = ["Orange", "Pink", "Green", "Blue", "Red"];
    colour = colours[Math.floor(Math.random() * colours.length)];

    if (options === undefined) {
      const people = ["Idle"]; // ['FireFighter'];
      //model = people[Math.floor(Math.random() * people.length)];
      model = people[0];
    } else if (typeof options == "object") {
      this.local = false;
      this.options = options;
      this.id = options.id;
      model = options.model;
      colour = options.colour;
    } else {
      model = options;
    }
    this.model = model;
    this.colour = colour;
    this.game = game;
    this.animations = this.game.animations;

    const loader = new FBXLoader();
    const player = this;

    player.object = new THREE.Object3D();
    player.object.position.set(-1247, -309.6, -6.8);
    player.object.rotation.set(0, 1.2, 0);
    player.object.scale.set(0.1, 0.1, 0.1);

    loader.load(`${game.assetsPath}fbx/anims/${model}.fbx`, function (object) {
      object.mixer = new THREE.AnimationMixer(object);
      player.root = object;
      player.mixer = object.mixer;

      object.name = "Person";

      //-------------------------------------------------------------------
      //Pats Orb Textures
      //Orb Outer
      //Sphere_2_2

      //var orbTexture = new THREE.TextureLoader().load `./assets/images/OrbBump.jpg`;
      //var orbEnviromap = new THREE.TextureLoader().load("assets/images/orbEnviromap.jpg");

      var orbTexture = new THREE.TextureLoader().load(
        "assets/images/OrbBump.jpg"
      );

      const assetsUrl = "assets/images/";
      const urls = [
        assetsUrl + "px.jpg",
        assetsUrl + "nx.jpg",
        assetsUrl + "py.jpg",
        assetsUrl + "ny.jpg",
        assetsUrl + "pz.jpg",
        assetsUrl + "nz.jpg",
      ];
      const envMap = new THREE.CubeTextureLoader().load(urls);

      // var shader = THREE.FresnelShader;
      // var uniforms = THREE.UniformsUtils.clone(shader.uniforms);

      // uniforms["tCube"].value = envMap;

      // var outerOrb = new THREE.ShaderMaterial({
      //   uniforms: uniforms,
      //   vertexShader: shader.vertexShader,
      //   fragmentShader: shader.fragmentShader,
      //   opacity: 0.5,
      //   transparent: true,
      // });

      var outerOrb = new THREE.MeshPhysicalMaterial({
        color: "#FFFFFF",
        metalness: 1,

        bumpScale: 1,
        bumpMap: orbTexture,
        clearcoat: 1,
        clearcoatRoughness: 0.32,
        // roughnessMap: orbTexture,
        roughness: 0,
        envMap: envMap,
        envMapIntensity: 1,
        premultipliedAlpha: true,
        opacity: 0.5,
        transparent: true,
      });

      //RED COLOUR PLAYER
      //Inner Sphere
      //Sphere_4
      var innerRed = new THREE.MeshPhysicalMaterial({
        name: "Red",
        color: 16711680,
        roughness: 0.52,
        metalness: 0,
        emissive: 16711680,
        clearcoat: 0,
        clearcoatRoughness: 0,
      });
      //Sphere_3
      var sphere3Red = new THREE.MeshStandardMaterial({
        name: "Red",
        color: 16598295,
        roughness: 0.46,
        metalness: 0,
        emissive: 14360832,
      });
      //Sphere_2
      var sphere2Red = new THREE.MeshStandardMaterial({
        name: "Red",
        color: 16718362,
        roughness: 0.46,
        metalness: 0,
        emissive: 6356992,
      });
      //Sphere_1
      var sphere1Red = new THREE.MeshStandardMaterial({
        name: "Red",
        color: 16734464,
        roughness: 0.46,
        metalness: 0,
        emissive: 14363648,
      });
      //Sphere
      var sphereRed = new THREE.MeshStandardMaterial({
        name: "Red",
        color: 16732754,
        roughness: 0.46,
        metalness: 0,
        emissive: 12386304,
      });

      //Blue COLOUR PLAYER
      //Inner Sphere
      //Sphere_4
      var innerBlue = new THREE.MeshPhysicalMaterial({
        name: "Blue",
        color: "#0088ff",
        roughness: 0.52,
        metalness: 0,
        emissive: "#0088ff",
        clearcoat: 0,
        clearcoatRoughness: 0,
      });
      //Sphere_3
      var sphere3Blue = new THREE.MeshStandardMaterial({
        name: "Blue",
        color: "#006EFF",
        roughness: 0.46,
        metalness: 0,
        emissive: "#0062FF",
      });
      //Sphere_2
      var sphere2Blue = new THREE.MeshStandardMaterial({
        name: "Blue",
        color: "#3118F2",
        roughness: 0.46,
        metalness: 0,
        emissive: "#1310C6",
      });
      //Sphere_1
      var sphere1Blue = new THREE.MeshStandardMaterial({
        name: "Blue",
        color: "#006DCC",
        roughness: 0.46,
        metalness: 0,
        emissive: "#0025DB",
      });
      //Sphere
      var sphereBlue = new THREE.MeshStandardMaterial({
        name: "Blue",
        color: "#11C06E",
        roughness: 0.46,
        metalness: 0,
        emissive: "#03C924",
      });

      //Green COLOUR PLAYER
      //Inner Sphere
      //Sphere_4
      var innerGreen = new THREE.MeshPhysicalMaterial({
        name: "Green",
        color: "#00FF33",
        roughness: 0.52,
        metalness: 0,
        emissive: "#04FF00",
        clearcoat: 0,
        clearcoatRoughness: 0,
      });
      //Sphere_3
      var sphere3Green = new THREE.MeshStandardMaterial({
        name: "Green",
        color: "#00FF1E",
        roughness: 0.46,
        metalness: 0,
        emissive: "1AFF34",
      });
      //Sphere_2
      var sphere2Green = new THREE.MeshStandardMaterial({
        name: "Green",
        color: "#F2B718",
        roughness: 0.46,
        metalness: 0,
        emissive: "#C6C010",
      });
      //Sphere_1
      var sphere1Green = new THREE.MeshStandardMaterial({
        name: "Green",
        color: "#02DE4C",
        roughness: 0.46,
        metalness: 0,
        emissive: "#00B850",
      });
      //Sphere
      var sphereGreen = new THREE.MeshStandardMaterial({
        name: "Green",
        color: "#437A00",
        roughness: 0.46,
        metalness: 0,
        emissive: "#31B800",
      });

      //Pink COLOUR PLAYER
      //Inner Sphere
      //Sphere_4
      var innerPink = new THREE.MeshPhysicalMaterial({
        name: "Pink",
        color: "#FF0040",
        roughness: 0.52,
        metalness: 0,
        emissive: "#FF0019",
        clearcoat: 0,
        clearcoatRoughness: 0,
      });
      //Sphere_3
      var sphere3Pink = new THREE.MeshStandardMaterial({
        name: "Pink",
        color: "#FF24CF",
        roughness: 0.46,
        metalness: 0,
        emissive: "#FE58D2",
      });
      //Sphere_2
      var sphere2Pink = new THREE.MeshStandardMaterial({
        name: "Pink",
        color: "#F21818",
        roughness: 0.46,
        metalness: 0,
        emissive: "#C61010",
      });
      //Sphere_1
      var sphere1Pink = new THREE.MeshStandardMaterial({
        name: "Pink",
        color: "#DE0265",
        roughness: 0.46,
        metalness: 0,
        emissive: "#DB0000",
      });
      //Sphere
      var spherePink = new THREE.MeshStandardMaterial({
        name: "Pink",
        color: "#9F00F5",
        roughness: 0.46,
        metalness: 0,
        emissive: "#4900B8",
      });

      //Orange COLOUR PLAYER
      //Inner Sphere
      //Sphere_4
      var innerOrange = new THREE.MeshPhysicalMaterial({
        name: "Orange",
        color: "#FF8800",
        roughness: 0.52,
        metalness: 0,
        emissive: "#D60000",
        clearcoat: 0,
        clearcoatRoughness: 0,
      });
      //Sphere_3
      var sphere3Orange = new THREE.MeshStandardMaterial({
        name: "Orange",
        color: "#FFD500",
        roughness: 0.46,
        metalness: 0,
        emissive: "#D67D00",
      });
      //Sphere_2
      var sphere2Orange = new THREE.MeshStandardMaterial({
        name: "Orange",
        color: "#FF0000",
        roughness: 0.46,
        metalness: 0,
        emissive: "#FA0000",
      });
      //Sphere_1
      var sphere1Orange = new THREE.MeshStandardMaterial({
        name: "Orange",
        color: "#F01000",
        roughness: 0.46,
        metalness: 0,
        emissive: "#DB2100",
      });
      //Sphere
      var sphereOrange = new THREE.MeshStandardMaterial({
        name: "Orange",
        color: "#FF8800",
        roughness: 0.46,
        metalness: 0,
        emissive: "#D60000",
      });
      //------------------------------------------------------------

      var innerMaterialList = [
        innerRed,
        innerBlue,
        innerOrange,
        innerGreen,
        innerPink,
      ];
      var Sphere3MaterialList = [
        sphere3Red,
        sphere3Blue,
        sphere3Orange,
        sphere3Green,
        sphere3Pink,
      ];
      var Sphere2MaterialList = [
        sphere2Red,
        sphere2Blue,
        sphere2Orange,
        sphere2Green,
        sphere2Pink,
      ];
      var Sphere1MaterialList = [
        sphere1Red,
        sphere1Blue,
        sphere1Orange,
        sphere1Green,
        sphere1Pink,
      ];
      var SphereMaterialList = [
        sphereRed,
        sphereBlue,
        sphereOrange,
        sphereGreen,
        spherePink,
      ];

      function getMaterial(mat) {
        return mat.name == colour;
      }
      var innerChecker = innerMaterialList.filter(getMaterial);
      var Sphere3Checker = Sphere3MaterialList.filter(getMaterial);
      var Sphere2Checker = Sphere2MaterialList.filter(getMaterial);
      var Sphere1Checker = Sphere1MaterialList.filter(getMaterial);
      var SphereChecker = SphereMaterialList.filter(getMaterial);

      object.traverse(function (child) {
        if (child.isMesh) {
          if (child.name == "Sphere_2_2") {
            child.material = outerOrb;
          }
          child.castShadow = true;
          child.receiveShadow = true;
        }

        if (child.name == "Sphere_4") {
          if (innerChecker.length > 0) {
            child.material = innerChecker[0];
          }
        }

        if (child.name == "Sphere_3") {
          if (Sphere3Checker.length > 0) {
            child.material = Sphere3Checker[0];
          }
        }

        if (child.name == "Sphere_2") {
          if (Sphere2Checker.length > 0) {
            child.material = Sphere2Checker[0];
          }
        }

        if (child.name == "Sphere_1") {
          if (Sphere1Checker.length > 0) {
            child.material = Sphere1Checker[0];
          }
        }

        if (child.name == "Sphere") {
          if (SphereChecker.length > 0) {
            child.material = SphereChecker[0];
          }
        }
      });

      // const textureLoader = new THREE.TextureLoader();

      // textureLoader.load(
      //   `${game.assetsPath}images/SimplePeople_${model}_${colour}.png`,
      //   function (texture) {
      //     object.traverse(function (child) {
      //       if (child.isMesh) {
      //         child.material.map = texture;
      //       }
      //     });
      //   }
      // );

      player.object.add(object);
      if (player.deleted === undefined) game.scene.add(player.object);

      if (player.local) {
        game.createCameras();
        game.sun.target = game.player.object;
        game.animations.Idle = object.animations[0];
        if (player.initSocket !== undefined) player.initSocket();
      } else {
        const geometry = new THREE.BoxGeometry(10, 30, 10);
        const material = new THREE.MeshBasicMaterial({ visible: true });
        const box = new THREE.Mesh(geometry, material);
        box.name = "Collider";
        box.position.set(0, 15, 0);
        player.object.add(box);
        player.collider = box;
        player.object.userData.id = player.id;
        player.object.userData.remotePlayer = true;
        const players = game.initialisingPlayers.splice(
          game.initialisingPlayers.indexOf(this),
          1
        );
        game.remotePlayers.push(players[0]);
      }

      if (game.animations.Idle !== undefined) player.action = "Idle";
    });
  }

  set action(name) {
    //Make a copy of the clip if this is a remote player
    if (this.actionName == name) return;
    const clip = this.local
      ? this.animations[name]
      : THREE.AnimationClip.parse(
        THREE.AnimationClip.toJSON(this.animations[name])
      );
    const action = this.mixer.clipAction(clip);
    action.time = 0;
    this.mixer.stopAllAction();
    this.actionName = name;
    this.actionTime = Date.now();
    
    action.fadeIn(0.5);
    action.play();
    //console.log(this.mixer.actionName);
  }

  get action() {
    return this.actionName;
  }

  update(dt) {
    this.mixer.update(dt);

    if (this.game.remoteData.length > 0) {
      let found = false;
      for (let data of this.game.remoteData) {
        if (data.id != this.id) continue;
        //Found the player
        this.object.position.set(data.x, data.y, data.z);
        const euler = new THREE.Euler(data.pb, data.heading, data.pb);
        this.object.quaternion.setFromEuler(euler);
        this.action = data.action;
        found = true;
      }
      if (!found) {
        console.log("remove player ", this.game.remoteData.id);
        this.game.removePlayer(this);
      }
    }
  }
}

class PlayerLocal extends Player {
  constructor(game, model) {
    super(game, model);

    const player = this;

    let inRing;
    player.inRing = false;

    const socket = io.connect();
    socket.on("setId", function (data) {
      player.id = data.id;
    });
    socket.on("remoteData", function (data) {
      game.remoteData = data;
    });
    socket.on("deletePlayer", function (data) {
      const players = game.remotePlayers.filter(function (player) {
        if (player.id == data.id) {
          return player;
        }
      });
      if (players.length > 0) {
        let index = game.remotePlayers.indexOf(players[0]);
        if (index != -1) {
          game.remotePlayers.splice(index, 1);
          game.scene.remove(players[0].object);
        }
      } else {
        index = game.initialisingPlayers.indexOf(data.id);
        if (index != -1) {
          const player = game.initialisingPlayers[index];
          player.deleted = true;
          game.initialisingPlayers.splice(index, 1);
        }
      }
    });

    /*socket.on("chat message", function (data) {
      document.getElementById("chat").style.bottom = "0px";
      const player = game.getRemotePlayerById(data.id);
      game.speechBubble.player = player;
      game.chatSocketId = player.id;
      game.activeCamera = game.cameras.chat;
      game.speechBubble.update(data.message);
    });*/

    socket.on("global message", function (data) {
      document.getElementById("chat").style.bottom = "0px";
      //const player = game.getRemotePlayerById(data.id);
      //console.log("global msg received from", data.id, ": ", data.message);

      //game.chatSocketId = player.id;
      game.updateRingText(data.message, data.id);
    });

    $("#msg-form").submit(function (e) {
      //socket.emit('chat message', { id:game.chatSocketId, message:$('#m').val() });
      //console.log("send global message: ", $("#m").val());
      socket.emit("global message", {
        id: game.chatSocketId,
        message: $("#m").val(),
      });
      $("#m").val("");

      return false;
    });

    this.socket = socket;
  }

  initSocket() {
    //console.log("PlayerLocal.initSocket");
    this.socket.emit("init", {
      model: this.model,
      colour: this.colour,
      x: this.object.position.x,
      y: this.object.position.y,
      z: this.object.position.z,
      h: this.object.rotation.y,
      pb: this.object.rotation.x,
    });
  }

  updateSocket() {
    if (this.socket !== undefined) {
      //console.log(`PlayerLocal.updateSocket - rotation(${this.object.rotation.x.toFixed(1)},${this.object.rotation.y.toFixed(1)},${this.object.rotation.z.toFixed(1)})`);
      this.socket.emit("update", {
        x: this.object.position.x,
        y: this.object.position.y,
        z: this.object.position.z,
        h: this.object.rotation.y,
        pb: this.object.rotation.x,
        action: this.action,
      });
    }
  }

  move(dt) {
    const pos = this.object.position.clone();
    pos.y += 6;
    let dir = new THREE.Vector3();
    this.object.getWorldDirection(dir);
    if (this.motion.forward < 0) dir.negate();
    let raycaster = new THREE.Raycaster(pos, dir);
    let blocked = false;
    const colliders = this.game.colliders;

    if (colliders !== undefined) {
      const intersect = raycaster.intersectObjects(colliders);
      if (intersect.length > 0) {
        if (intersect[0].distance < 5) blocked = true;
      }
    }

    if (!blocked) {
      if (this.motion.forward > 0) {
        const speed = this.action == "Running" ? 200 : 50;
        this.object.translateZ(dt * speed);
      } else {
        this.object.translateZ(-dt * 3);
      }
    }

    if (colliders !== undefined) {
      //cast left
      dir.set(-1, 0, 0);
      dir.applyMatrix4(this.object.matrix);
      dir.normalize();
      raycaster = new THREE.Raycaster(pos, dir);

      let intersect = raycaster.intersectObjects(colliders);
      if (intersect.length > 0) {
        if (intersect[0].distance < 5)
          this.object.translateX(10 - intersect[0].distance);
      }

      //cast right
      dir.set(1, 0, 0);
      dir.applyMatrix4(this.object.matrix);
      dir.normalize();
      raycaster = new THREE.Raycaster(pos, dir);

      intersect = raycaster.intersectObjects(colliders);
      if (intersect.length > 0) {
        if (intersect[0].distance < 5)
          this.object.translateX(intersect[0].distance - 10);
      }

      //cast down
      dir.set(0, -1, 0);
      pos.y += 20;
      raycaster = new THREE.Raycaster(pos, dir);
      const gravity = 9.8;

      intersect = raycaster.intersectObjects(colliders);
      if (intersect.length > 0) {
        const targetY = pos.y - intersect[0].distance;
        if (targetY > this.object.position.y) {
          //Going up
          this.object.position.y = 0.8 * this.object.position.y + 0.2 * targetY;
          this.velocityY = 0;
        } else if (targetY < this.object.position.y) {
          //Falling
          if (this.velocityY == undefined) this.velocityY = 0;
          this.velocityY += dt * gravity;
          this.object.position.y -= this.velocityY;
          if (this.object.position.y < targetY) {
            this.velocityY = 0;
            this.object.position.y = targetY;
          }
        }
      }
    }

    this.object.rotateY(this.motion.turn * dt);

    //check if inside chat ring
    if (this.object.position.distanceTo(this.game.ring.position) < 500) {
      this.inRing = true;
    } else {
      this.inRing = false;
    }
    this.game.setGlobalChat(this.inRing);

    this.updateSocket();
  }
}

/*

class SpeechBubble {
  constructor(game, msg, size = 1) {
    this.config = {
      font: "Calibri",
      size: 24,
      padding: 10,
      colour: "#222",
      width: 256,
      height: 256,
    };

    const planeGeometry = new THREE.PlaneGeometry(size, size);
    const planeMaterial = new THREE.MeshBasicMaterial();
    this.mesh = new THREE.Mesh(planeGeometry, planeMaterial);
    game.scene.add(this.mesh);

    const self = this;
    const loader = new THREE.TextureLoader();
    loader.load(
      // resource URL
      `${game.assetsPath}images/speech.png`,

      // onLoad callback
      function (texture) {
        // in this example we create the material when the texture is loaded
        self.img = texture.image;
        self.mesh.material.map = texture;
        self.mesh.material.transparent = true;
        self.mesh.material.needsUpdate = true;
        if (msg !== undefined) self.update(msg);
      },

      // onProgress callback currently not supported
      undefined,

      // onError callback
      function (err) {
        console.error("An error happened.");
      }
    );
  }

  update(msg) {
    if (this.mesh === undefined) return;

    let context = this.context;

    if (this.mesh.userData.context === undefined) {
      const canvas = this.createOffscreenCanvas(
        this.config.width,
        this.config.height
      );
      this.context = canvas.getContext("2d");
      context = this.context;
      context.font = `${this.config.size}pt ${this.config.font}`;
      context.fillStyle = this.config.colour;
      context.textAlign = "center";
      this.mesh.material.map = new THREE.CanvasTexture(canvas);
    }

    const bg = this.img;
    context.clearRect(0, 0, this.config.width, this.config.height);
    context.drawImage(
      bg,
      0,
      0,
      bg.width,
      bg.height,
      0,
      0,
      this.config.width,
      this.config.height
    );
    this.wrapText(msg, context);

    this.mesh.material.map.needsUpdate = true;
  }

  createOffscreenCanvas(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  wrapText(text, context) {
    const words = text.split(" ");
    let line = "";
    const lines = [];
    const maxWidth = this.config.width - 2 * this.config.padding;
    const lineHeight = this.config.size + 8;

    words.forEach(function (word) {
      const testLine = `${line}${word} `;
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth) {
        lines.push(line);
        line = `${word} `;
      } else {
        line = testLine;
      }
    });

    if (line != "") lines.push(line);

    let y = (this.config.height - lines.length * lineHeight) / 2;

    lines.forEach(function (line) {
      context.fillText(line, 128, y);
      y += lineHeight;
    });
  }

  show(pos) {
    if (this.mesh !== undefined && this.player !== undefined) {
      this.mesh.position.set(
        this.player.object.position.x,
        this.player.object.position.y + 38,
        this.player.object.position.z
      );
      this.mesh.lookAt(pos);
    }
  }
}*/
