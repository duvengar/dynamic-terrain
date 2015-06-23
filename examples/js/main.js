'use strict';

/*global THREE*/

if (!Detector.webgl) {
  Detector.addGetWebGLMessage();
}

var SCREEN_WIDTH = window.innerWidth;

var SCREEN_HEIGHT = window.innerHeight;

var renderer, container, noisebg, gradientbg, stats;

var camera, cameraOrtho , scene;

var controls;

var sceneRenderTarget;

var uniformsNoise, uniformsNormal, uniformsTerrain, heightMap, normalMap, quadTarget;

var directionalLight, pointLight, pointLight2;

var composer;

var terrain;

var textureCounter = 0;

var animDelta = 0, animDeltaDir = -1;

var lightVal = 0, lightDir = 1;

var clock = new THREE.Clock();

var updateNoise = true;

var animateTerrain = false;

var textMesh1;

var mlib = {};

init();
animate();

function init() {

  container = document.getElementById('container');

  // SCENE (RENDER TARGET)

  sceneRenderTarget = new THREE.Scene();
  cameraOrtho = new THREE.OrthographicCamera( SCREEN_WIDTH / - 2, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, SCREEN_HEIGHT / -2 , -10000, 10000 );
  cameraOrtho.position.set(0, 0 , -100);
  sceneRenderTarget.add(cameraOrtho);

  // CAMERA

  camera = new THREE.PerspectiveCamera(40, SCREEN_WIDTH / SCREEN_HEIGHT, 20, 10000);
  camera.position.set(-1200, 200 , -700);
  camera.rotation.set(-3, -1, -3);

  // CONTROLS

  controls = new THREE.OrbitControls(camera);
  controls.rotateSpeed = .2;
  controls.zoomSpeed = .2;

  // SCENE (FINAL)

  scene = new THREE.Scene();

  scene.fog = new THREE.Fog(0x000000, 450, 3200);

  // LIGHTS

  scene.add(new THREE.AmbientLight(0xffffff));

  directionalLight = new THREE.DirectionalLight(0xffffff, 1.15);

  directionalLight.position.set(500, 2000, 0);

  scene.add(directionalLight);

  // HEIGHT + NORMAL MAPS

  var normalShader = THREE.NormalMapShader;

  var rx = 128, ry = 128;

  var pars = {minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat};

  heightMap  = new THREE.WebGLRenderTarget(rx, ry, pars);

  heightMap.generateMipmaps = false;

  normalMap = new THREE.WebGLRenderTarget(rx, ry, pars);
  normalMap.generateMipmaps = false;

  uniformsNoise = {

    time:   {type: 'f', value: 1.0},
    scale:  {type: 'v2', value: new THREE.Vector2(2.5, 2.5)},
    offset: {type: 'v2', value: new THREE.Vector2(0, 0)}

  };

  uniformsNormal = THREE.UniformsUtils.clone(normalShader.uniforms);

  uniformsNormal.height.value = 0.5;
  uniformsNormal.resolution.value.set(rx, ry);
  uniformsNormal.heightMap.value = heightMap;

  var vertexShader = document.getElementById('vertexShader').textContent;

  // TERRAIN SHADER

  var terrainShader = THREE.ShaderTerrain['terrain'];

  uniformsTerrain = THREE.UniformsUtils.clone(terrainShader.uniforms);

  uniformsTerrain['tNormal'].value = normalMap;

  uniformsTerrain['uNormalScale'].value = 0.5;

  uniformsTerrain['tDisplacement'].value = heightMap;

  uniformsTerrain['diffuse'].value.setHex (0xffffff);

  uniformsTerrain['uDisplacementScale'].value = 500;

  var params = [

      ['heightmap',  document.getElementById('fragmentShaderNoise').textContent,   vertexShader, uniformsNoise, false],
      ['normal',     normalShader.fragmentShader,  normalShader.vertexShader, uniformsNormal, false],
      ['terrain',    terrainShader.fragmentShader, terrainShader.vertexShader, uniformsTerrain, true]
   ];

  var material;

  for (var i = 0; i < params.length; i ++) {

    material = new THREE.ShaderMaterial({

      uniforms:       params[ i ][ 3 ],
      vertexShader:   params[ i ][ 2 ],
      fragmentShader: params[ i ][ 1 ],
      lights:         params[ i ][ 4 ],
      fog:            true
    });

    mlib[ params[ i ][ 0 ] ] = material;

  }

  var plane = new THREE.PlaneBufferGeometry(SCREEN_WIDTH, SCREEN_HEIGHT);

  quadTarget = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({color: 0x000000}));

  quadTarget.position.z = -100;

  sceneRenderTarget.add(quadTarget);

  // TERRAIN MESH

  var geometryTerrain = new THREE.PlaneBufferGeometry(4000, 4000, rx, ry);

  geometryTerrain.computeTangents();

  mlib['terrain'].wireframe = true;

  terrain = new THREE.Mesh(geometryTerrain, mlib['terrain']);

  terrain.position.set(0, 100, 0);
  terrain.rotation.x = -Math.PI / 2 ;
  terrain.rotation.y =  Math.PI ;


  scene.add(terrain);

  // RENDERER

  renderer = new THREE.WebGLRenderer ({ alpha: true, antialias: true});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  container.appendChild(renderer.domElement);
  renderer.gammaInput = true;
  renderer.gammaOutput = true;

  // STATS

  stats = new Stats();

  container.appendChild(stats.domElement);

  // EVENTS

  onWindowResize();

  window.addEventListener('resize', onWindowResize, false);


}

//

function onWindowResize(event) {


  SCREEN_WIDTH = window.innerWidth;
  SCREEN_HEIGHT = window.innerHeight;
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
  camera.updateProjectionMatrix();

}

//

function animate() {

  requestAnimationFrame(animate);
  render();
  stats.update();

}

function render() {

  var delta = clock.getDelta();
  if (terrain.visible) {

    controls.update();
    var time = Date.now() * 0.001;
    var fLow = 0.1, fHigh = 0.8;
    lightVal = THREE.Math.clamp(lightVal + 0.5 * delta * lightDir, fLow, fHigh);
    var valNorm = (lightVal - fLow) / (fHigh - fLow);

    scene.fog.color = new THREE.Color("rgb(30,30,30)");

    renderer.setClearColor( scene.fog.color, 1);

    uniformsTerrain['uNormalScale'].value = THREE.Math.mapLinear(valNorm, 0, 1, 0.6, 3.5);

    if (updateNoise) {

      animDelta = THREE.Math.clamp(animDelta + 0.00075 * animDeltaDir, 0, 0.05);

      uniformsNoise['time'].value += delta * animDelta;

      uniformsNoise['offset'].value.x -= delta * 0.1;

      quadTarget.material = mlib['heightmap'];

      renderer.render(sceneRenderTarget, cameraOrtho, heightMap, true);

      quadTarget.material = mlib['normal'];

      renderer.render(sceneRenderTarget, cameraOrtho, normalMap, true);

    }
      renderer.render( scene, camera );
    //composer.render(0.1);

  }

}
