'use strict';

/*global THREE*/

if (!Detector.webgl) {
  Detector.addGetWebGLMessage();
}

var SCREEN_WIDTH = window.innerWidth;

var SCREEN_HEIGHT = window.innerHeight;

var renderer, container, stats;

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

  cameraOrtho = new THREE.OrthographicCamera(SCREEN_WIDTH / -2, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, SCREEN_HEIGHT / -2, -10000, 10000);

  //cameraOrtho.position.z = 100;

  //cameraOrtho.rotation.set(-2.360, 1.285,2.380);

  sceneRenderTarget.add(cameraOrtho);

  // CAMERA

  camera = new THREE.PerspectiveCamera(40, SCREEN_WIDTH / SCREEN_HEIGHT, 2, 10000);

  camera.position.set(-1200, 200 , -700);

  camera.rotation.set(-3, -1, -3);

  controls = new THREE.OrbitControls(camera);

  //controls.target.set(0, 0, 0);

  //controls.rotateSpeed = 1.0;

  //controls.zoomSpeed = 1.2;

  //controls.panSpeed = 0.8;

  //controls.noZoom = false;

  //controls.noPan = false;

  //controls.keys = [65, 83, 68];

  // SCENE (FINAL)

  scene = new THREE.Scene();

  scene.fog = new THREE.Fog(0x000000, 450, 3200);

  // LIGHTS

  scene.add(new THREE.AmbientLight(0xffffff));

  directionalLight = new THREE.DirectionalLight(0xffffff, 1.15);

  directionalLight.position.set(500, 2000, 0);

  scene.add(directionalLight);

  //pointLight = new THREE.PointLight(0xffffff, 1.5);

  //pointLight2 = new THREE.PointLight(0xffffff, 1.5);

  //pointLight.position.set(0, 0, 0);

  //pointLight2.position.set(1000, 1000, 0);

  //scene.add(pointLight);

  //scene.add(pointLight2);

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

  // TEXTURES

  var specularMap = new THREE.WebGLRenderTarget(2048, 2048, pars);
  //specularMap.generateMipmaps = false;

  // var diffuseTexture1 = THREE.ImageUtils.loadTexture('textures/terrain/grasslight-big.jpg', null, function () {

  //   loadTextures();
  //   applyShader(THREE.LuminosityShader, diffuseTexture1, specularMap);

  // });

 // var diffuseTexture2 = THREE.ImageUtils.loadTexture('textures/terrain/backgrounddetailed6.jpg', null, loadTextures);
 //var detailTexture = THREE.ImageUtils.loadTexture('textures/terrain/grasslight-big-nm.jpg', null, loadTextures);

  // TERRAIN SHADER

  var terrainShader = THREE.ShaderTerrain['terrain'];

  uniformsTerrain = THREE.UniformsUtils.clone(terrainShader.uniforms);

  // uniformsTerrain['tNormal'].value = normalMap;

  //uniformsTerrain['uNormalScale'].value = 0.5;

  uniformsTerrain['tDisplacement'].value = heightMap;

  uniformsTerrain['diffuse'].value.setHex (0xffffff);

  uniformsTerrain['uDisplacementScale'].value = 600;

  //uniformsTerrain[ "specular" ].value.setHex( 0xff1100 );

  uniformsTerrain[ "shininess" ].value = 20;

  // uniformsTerrain[ "uDisplacementScale" ].value = 375;

  //uniformsTerrain[ "uRepeatOverlay" ].value.set( 6, 6 );

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

  //quadTarget.position.z = -500;

  sceneRenderTarget.add(quadTarget);

  // TERRAIN MESH

  var geometryTerrain = new THREE.PlaneBufferGeometry(4000, 4000, rx, ry);

  geometryTerrain.computeTangents();

  mlib['terrain'].wireframe = true;

  terrain = new THREE.Mesh(geometryTerrain, mlib['terrain']);

  terrain.position.set(0, 100, 0);

  terrain.rotation.x = -Math.PI / 2 ;
  terrain.rotation.y =  Math.PI ;

  //terrain.visible = false;

  //terrain.wireframe = true;

  scene.add(terrain);

  // RENDERER

  renderer = new THREE.WebGLRenderer ({ alpha: true, antialias: true});
  //renderer.setClearColor(scene.fog.color);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  container.appendChild(renderer.domElement);

  //

  //renderer.gammaInput = true;
  //renderer.gammaOutput = true;

  // STATS

  stats = new Stats();
  //container.appendChild(stats.domElement);

  // EVENTS

  onWindowResize();

  window.addEventListener('resize', onWindowResize, false);

  document.addEventListener('keydown', onKeyDown, false);

  // COMPOSER

  renderer.autoClear = true;

  var renderTargetParameters = {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false, antialias: true};

  var renderTarget = new THREE.WebGLRenderTarget(SCREEN_WIDTH, SCREEN_HEIGHT, renderTargetParameters);

  renderTarget.generateMipmaps = false;

  var vblur = new THREE.ShaderPass(THREE.VerticalTiltShiftShader);

  var bluriness = 3;

  vblur.uniforms['v'].value = bluriness / SCREEN_HEIGHT;

  composer = new THREE.EffectComposer(renderer, renderTarget);

  var renderModel = new THREE.RenderPass(scene, camera);

  vblur.renderToScreen = true;

  //composer = new THREE.EffectComposer(renderer, renderTarget);

  composer.addPass(renderModel);

  composer.addPass(vblur);

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

function onKeyDown (event) {

  switch (event.keyCode) {

    case 78: /*N*/  lightDir *= -1; break;
    case 77: /*M*/  animDeltaDir *= -1; break;

  }

}

//

function applyShader(shader, texture, target) {

  var shaderMaterial = new THREE.ShaderMaterial({

    fragmentShader: shader.fragmentShader,
    vertexShader: shader.vertexShader,
    uniforms: THREE.UniformsUtils.clone(shader.uniforms)

  });

  shaderMaterial.uniforms['tDiffuse'].value = texture;

  var sceneTmp = new THREE.Scene();

  var meshTmp = new THREE.Mesh(new THREE.PlaneBufferGeometry(SCREEN_WIDTH, SCREEN_HEIGHT), shaderMaterial);

  meshTmp.position.z = -500;

  sceneTmp.add(meshTmp);

  renderer.render(sceneTmp, cameraOrtho, target, true);

}

//

function loadTextures() {

  textureCounter += 1;

  if (textureCounter == 3)  {

    terrain.visible = true;

  }

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
    //console.log(camera.rotation);
    //console.log(camera.position);

    //scene.fog.color.setHSL(0.1, 0.5, lightVal);

    //scene.fog.color.setHSL(0, 0, 0 );
    scene.fog.color = new THREE.Color("rgb(30,30,30)");

    //renderer.setClearColor(0x000000, 0);
   // renderer.setClearColor(scene.fog.color);;

    directionalLight.intensity = THREE.Math.mapLinear(valNorm, 0, 1, 0.1, 1.15);

    //pointLight.intensity = THREE.Math.mapLinear(valNorm, 0, 1, 0.9, 1.5);

    uniformsTerrain['uNormalScale'].value = THREE.Math.mapLinear(valNorm, 0, 1, 0.6, 3.5);

    if (updateNoise) {

      animDelta = THREE.Math.clamp(animDelta + 0.00075 * animDeltaDir, 0, 0.05);

      uniformsNoise['time'].value += delta * animDelta;

      uniformsNoise['offset'].value.x -= delta * 0.1;

      //uniformsTerrain['uOffset'].value.x = 1 * uniformsNoise['offset'].value.x;

      //uniformsTerrain['tDisplacement'].value.y = uniformsTerrain['tDisplacement'].value.y < 1 ? 0 : uniformsTerrain['tDisplacement'].value.y;

      quadTarget.material = mlib['heightmap'];

      renderer.render(sceneRenderTarget, cameraOrtho, heightMap, true);

      quadTarget.material = mlib['normal'];

      renderer.render(sceneRenderTarget, cameraOrtho, normalMap, true);

    }

    composer.render(0.1);

  }

}
