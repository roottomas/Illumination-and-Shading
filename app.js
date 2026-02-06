/**
 * Authors:
 * Ricardo Laur 68342 r.laur@campus.fct.unl.pt
 * Tomás Silvestre 68594 tm.silvestre@campus.fct.unl.pt
 * AI Disclaimer: We used ChatGPT to correct some syntax/logic errors
 * that we came upon throughout the making of the project,
 * as well as to help us with some questions we had, related to 
 * specifying the lights in the world coordinate system
 * instead of the camera coordinate system.
 */

import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from '../../libs/utils.js';
import { length, flatten, mult, normalMatrix, perspective, lookAt, vec4, vec3, subtract, scalem, rotate, normalize, translate } from '../../libs/MV.js';

import * as dat from '../../libs/dat.gui.module.js';

import * as CUBE from '../../libs/objects/cube.js';
import * as SPHERE from '../../libs/objects/sphere.js';
import * as BUNNY from '../../libs/objects/bunny.js';
import * as TORUS from '../../libs/objects/torus.js';
import * as COW from '../../libs/objects/cow.js';

import { loadMatrix, pushMatrix, popMatrix, multMatrix, modelView } from '../../libs/stack.js';

const MAX_LIGHTS = 8;

// Global state variables
let mView, mProjection;
let gl, canvas, program, programPhong, programGouraud;
let camera, initialCamera, options, material, initialMaterial, lights;
let platform;
let materialControllers = [];

// Platform creation function
function createPlatform(gl) {
    const vertices = [
        vec3(-5.0, -0.5, -5.0),  
        vec3(5.0, -0.5, -5.0),   
        vec3(5.0, -0.5, 5.0),    
        vec3(-5.0, -0.5, 5.0),  
        vec3(-5.0, 0.0, -5.0),   
        vec3(5.0, 0.0, -5.0),    
        vec3(5.0, 0.0, 5.0),    
        vec3(-5.0, 0.0, 5.0)
    ];

    const points = [];
    const normals = [];
    const faces = [];

    function addFace(a, b, c, d, n) {
        let offset = points.length;
        points.push(vertices[a]);
        points.push(vertices[b]);
        points.push(vertices[c]);
        points.push(vertices[d]);
        for (let i = 0; i < 4; i++) {
            normals.push(n);
        }
        faces.push(offset, offset + 1, offset + 2);
        faces.push(offset, offset + 2, offset + 3);
    }

    // Top face 
    addFace(4, 5, 6, 7, vec3(0, 1, 0));
    // Bottom face
    addFace(0, 3, 2, 1, vec3(0, -1, 0));
    // Front face
    addFace(0, 1, 5, 4, vec3(0, 0, -1));
    // Back face
    addFace(2, 3, 7, 6, vec3(0, 0, 1));
    // Right face
    addFace(1, 2, 6, 5, vec3(1, 0, 0));
    // Left face
    addFace(3, 0, 4, 7, vec3(-1, 0, 0));

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const points_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, points_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    const a_position = 0;
    gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_position);

    const normals_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normals_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
    const a_normal = 1;
    gl.vertexAttribPointer(a_normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_normal);

    gl.bindVertexArray(null);

    const faces_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faces_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(faces), gl.STATIC_DRAW);

    return {
        vao: vao,
        faces_buffer: faces_buffer,
        numFaces: faces.length
    };
}

// Initialize WebGL context and objects
function initializeWebGL() {
    canvas = document.getElementById('gl-canvas');
    gl = setupWebGL(canvas);
    
    CUBE.init(gl);
    SPHERE.init(gl);
    BUNNY.init(gl);
    TORUS.init(gl);
    COW.init(gl);
    
    platform = createPlatform(gl);
}

// Build shader programs
function buildShaders(shaders) {
    programPhong = buildProgramFromSources(gl, shaders['shader1.vert'], shaders['shader1.frag']);
    programGouraud = buildProgramFromSources(gl, shaders['shader2.vert'], shaders['shader2.frag']);
    program = programPhong;
}

// Initialize camera state
function initializeCamera() {
    camera = {
        eye: vec3(0, 3, 8),
        at: vec3(0, 0, 0),
        up: vec3(0, 1, 0),
        fovy: 45,
        aspect: 1,
        near: 0.1,
        far: 40
    };
    
    initialCamera = {
        eye: vec3(camera.eye[0], camera.eye[1], camera.eye[2]),
        at: vec3(camera.at[0], camera.at[1], camera.at[2]),
        up: vec3(camera.up[0], camera.up[1], camera.up[2])
    };
}

// Initialize application options
function initializeOptions() {
    options = {
        backfaceCulling: true,
        depthTest: true,
        shadingMode: "Phong",
        lightSpace: "World"
    };
}

// Initialize material properties
function initializeMaterial() {
    material = {
        Ka: [150, 150, 150],
        Kd: [150, 150, 150],
        Ks: [200, 200, 200],
        shininess: 100
    };

    initialMaterial = {
        Ka: [...material.Ka],
        Kd: [...material.Kd],
        Ks: [...material.Ks],
        shininess: material.shininess
    };
}

// Initialize lights array (1-3 lights as per requirements)
function initializeLights() {
    lights = [];
    // Initialize 3 lights (user can enable/disable them)
    for (let i = 0; i < 3; i++) {
        lights.push({
            enabled: i === 0,  // Only first light enabled by default
            type: i === 0 ? 2 : 0,  // First is spotlight, others are point 
            position: vec4(i === 0 ? 0 : (i === 1 ? 5 : -5), i === 0 ? 5 : 4, i === 0 ? 10 : 6, 1),
            ambient: [150, 150, 150],
            diffuse: [255, 255, 255],
            specular: [255, 255, 255],
            axis: vec3(0, -1, -1),
            aperture: 30.0,
            cutoff: 10.0
        });
    }
}

// Setup GUI for options
function setupOptionsGUI(gui) {
    const optionsGui = gui.addFolder("options");
    optionsGui.add(options, "backfaceCulling").onChange(function(value) {
        if (value) {
            gl.enable(gl.CULL_FACE);
        } else {
            gl.disable(gl.CULL_FACE);
        }
    });
    optionsGui.add(options, "depthTest").onChange(function(value) {
        if (value) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
    });
    optionsGui.add(options, "shadingMode", ["Phong", "Gouraud"]).name("Shading Mode").onChange(function(value) {
        program = (value === "Gouraud") ? programGouraud : programPhong;
    });
    optionsGui.add(options, "lightSpace", ["World", "Camera"]).name("Light Space");
    optionsGui.open();
}

// Setup GUI for camera controls
function setupCameraGUI(gui) {
    const cameraGui = gui.addFolder("camera");
    cameraGui.add(camera, "fovy").min(1).max(100).step(1);
    cameraGui.add(camera, "near").min(0.1).max(40).step(0.01).onChange(function (v) {
        camera.near = Math.min(camera.far - 0.5, v);
    });
    cameraGui.add(camera, "far").min(0.1).max(40).step(0.01).onChange(function (v) {
        camera.far = Math.max(camera.near + 0.5, v);
    });

    const eyeGui = cameraGui.addFolder("eye");
    eyeGui.add(camera.eye, 0).step(0.1).name("x");
    eyeGui.add(camera.eye, 1).step(0.1).name("y");
    eyeGui.add(camera.eye, 2).step(0.1).name("z");

    const atGui = cameraGui.addFolder("at");
    atGui.add(camera.at, 0).step(0.1).name("x");
    atGui.add(camera.at, 1).step(0.1).name("y");
    atGui.add(camera.at, 2).step(0.1).name("z");

    const upGui = cameraGui.addFolder("up");
    upGui.add(camera.up, 0).step(0.1).name("x");
    upGui.add(camera.up, 1).step(0.1).name("y");
    upGui.add(camera.up, 2).step(0.1).name("z");
}

// Setup GUI for material properties
function setupMaterialGUI(gui) {
    const materialGui = gui.addFolder("material");
    materialControllers = [];

    materialControllers.push(
        materialGui.add(material.Ka, 0).min(0).max(255).step(1).name("Ka R").listen()
    );
    materialControllers.push(
        materialGui.add(material.Ka, 1).min(0).max(255).step(1).name("Ka G").listen()
    );
    materialControllers.push(
        materialGui.add(material.Ka, 2).min(0).max(255).step(1).name("Ka B").listen()
    );

    materialControllers.push(
        materialGui.add(material.Kd, 0).min(0).max(255).step(1).name("Kd R").listen()
    );
    materialControllers.push(
        materialGui.add(material.Kd, 1).min(0).max(255).step(1).name("Kd G").listen()
    );
    materialControllers.push(
        materialGui.add(material.Kd, 2).min(0).max(255).step(1).name("Kd B").listen()
    );

    materialControllers.push(
        materialGui.add(material.Ks, 0).min(0).max(255).step(1).name("Ks R").listen()
    );
    materialControllers.push(
        materialGui.add(material.Ks, 1).min(0).max(255).step(1).name("Ks G").listen()
    );
    materialControllers.push(
        materialGui.add(material.Ks, 2).min(0).max(255).step(1).name("Ks B").listen()
    );

    materialControllers.push(
        materialGui.add(material, "shininess").min(1).max(200).step(1).listen()
    );
}

// Update GUI for a specific light
function updateLightGUI(lightsGui, lightGuis, i) {
    if (lightGuis[i]) {
        lightsGui.removeFolder(lightGuis[i]);
    }

    if (i >= lights.length) return;

    const light = lights[i];
    const lightGui = lightsGui.addFolder("Light" + (i + 1));
    lightGuis[i] = lightGui;

    lightGui.add(light, "enabled");
    const typeController = lightGui.add(light, "type", { "Point": 0, "Directional": 1, "Spotlight": 2 });
    typeController.onChange(function(value) {
        light.position[3] = (value === 1) ? 0.0 : 1.0;
    });

    const positionGui = lightGui.addFolder("position");
    positionGui.add(light.position, 0).step(0.1).name("x");
    positionGui.add(light.position, 1).step(0.1).name("y");
    positionGui.add(light.position, 2).step(0.1).name("z");
    positionGui.add(light.position, 3).step(0.1).name("w");

    const intensitiesGui = lightGui.addFolder("intensities");
    intensitiesGui.add(light.ambient, 0).min(0).max(255).step(1).name("ambient R");
    intensitiesGui.add(light.ambient, 1).min(0).max(255).step(1).name("ambient G");
    intensitiesGui.add(light.ambient, 2).min(0).max(255).step(1).name("ambient B");
    intensitiesGui.add(light.diffuse, 0).min(0).max(255).step(1).name("diffuse R");
    intensitiesGui.add(light.diffuse, 1).min(0).max(255).step(1).name("diffuse G");
    intensitiesGui.add(light.diffuse, 2).min(0).max(255).step(1).name("diffuse B");
    intensitiesGui.add(light.specular, 0).min(0).max(255).step(1).name("specular R");
    intensitiesGui.add(light.specular, 1).min(0).max(255).step(1).name("specular G");
    intensitiesGui.add(light.specular, 2).min(0).max(255).step(1).name("specular B");

    const axisGui = lightGui.addFolder("axis");
    axisGui.add(light.axis, 0).step(0.1).name("x");
    axisGui.add(light.axis, 1).step(0.1).name("y");
    axisGui.add(light.axis, 2).step(0.1).name("z");

    lightGui.add(light, "aperture").min(0).max(180).step(0.1);
    lightGui.add(light, "cutoff").min(0).max(180).step(0.1);
}

// Setup GUI for lights
function setupLightsGUI(gui) {
    const lightsGui = gui.addFolder("lights");
    const lightGuis = [];
    
    for (let i = 0; i < 3; i++) {
        updateLightGUI(lightsGui, lightGuis, i);
    }
}

// Setup all GUI components
function setupGUI() {
    const gui = new dat.GUI();
    setupOptionsGUI(gui);
    setupCameraGUI(gui);
    setupMaterialGUI(gui);
    setupLightsGUI(gui);
}

// Initialize OpenGL state
function initializeOpenGLState() {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    if (options.depthTest) gl.enable(gl.DEPTH_TEST);
    if (options.backfaceCulling) gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    resizeCanvasToFullWindow();
}

// Resize canvas to fill window
function resizeCanvasToFullWindow() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.aspect = canvas.width / canvas.height;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

// Cross product helper
function cross(a, b) {
    return vec3(
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    );
}

// Keyboard controls state
const keys = {};
const moveSpeed = 0.1;

// Update camera movement based on keyboard input
function updateCameraMovement() {
    const currentTime = performance.now();

    const forward = normalize(subtract(camera.at, camera.eye));
    const right = normalize(cross(forward, camera.up));
    const worldUp = vec3(0, 1, 0);

    const move = vec3(0, 0, 0);
    if (keys['w']) {
        move[0] += forward[0] * moveSpeed;
        move[1] += forward[1] * moveSpeed;
        move[2] += forward[2] * moveSpeed;
    }
    if (keys['s']) {
        move[0] -= forward[0] * moveSpeed;
        move[1] -= forward[1] * moveSpeed;
        move[2] -= forward[2] * moveSpeed;
    }
    if (keys['a']) {
        move[0] -= right[0] * moveSpeed;
        move[1] -= right[1] * moveSpeed;
        move[2] -= right[2] * moveSpeed;
    }
    if (keys['d']) {
        move[0] += right[0] * moveSpeed;
        move[1] += right[1] * moveSpeed;
        move[2] += right[2] * moveSpeed;
    }

    if (keys['arrowup']) {
        move[0] += worldUp[0] * moveSpeed;
        move[1] += worldUp[1] * moveSpeed;
        move[2] += worldUp[2] * moveSpeed;
    }
    if (keys['arrowdown']) {
        move[0] -= worldUp[0] * moveSpeed;
        move[1] -= worldUp[1] * moveSpeed;
        move[2] -= worldUp[2] * moveSpeed;
    }

    if (length(move) > 0) {
        camera.eye[0] += move[0];
        camera.eye[1] += move[1];
        camera.eye[2] += move[2];
        camera.at[0] += move[0];
        camera.at[1] += move[1];
        camera.at[2] += move[2];
    }
}

// Setup keyboard event listeners
function setupKeyboardControls() {
    window.addEventListener('keydown', function(event) {
        const key = event.key.toLowerCase();
        keys[key] = true;
        
        if (key === 'r') {
            event.preventDefault();
            camera.eye[0] = initialCamera.eye[0];
            camera.eye[1] = initialCamera.eye[1];
            camera.eye[2] = initialCamera.eye[2];
            camera.at[0] = initialCamera.at[0];
            camera.at[1] = initialCamera.at[1];
            camera.at[2] = initialCamera.at[2];
            camera.up[0] = initialCamera.up[0];
            camera.up[1] = initialCamera.up[1];
            camera.up[2] = initialCamera.up[2];

            if (initialMaterial && material) {
                for (let i = 0; i < 3; i++) {
                    material.Ka[i] = initialMaterial.Ka[i];
                    material.Kd[i] = initialMaterial.Kd[i];
                    material.Ks[i] = initialMaterial.Ks[i];
                }
                material.shininess = initialMaterial.shininess;

                if (materialControllers && materialControllers.length > 0) {
                    materialControllers.forEach(ctrl => ctrl.updateDisplay && ctrl.updateDisplay());
                }
            }
        }
        
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown'].includes(key)) {
            event.preventDefault();
        }
    });
    
    window.addEventListener('keyup', function(event) {
        keys[event.key.toLowerCase()] = false;
    });
}

// Mouse controls state
let mouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
const mouseSensitivity = 2;

// Setup mouse event listeners
function setupMouseControls() {
    canvas.addEventListener('mousemove', function (event) {
        if (mouseDown) {
            const dx = (event.offsetX - lastMouseX) * mouseSensitivity;
            const dy = (event.offsetY - lastMouseY) * mouseSensitivity;

            if (dx !== 0 || dy !== 0) {
                const forward = normalize(subtract(camera.at, camera.eye));
                const right = normalize(cross(forward, camera.up));;

                const pitchAngle = dy * Math.PI / 180;
                const pitchAxis = right;
                const pitchRotation = rotate(pitchAngle, pitchAxis);
                
                const yawAngle = dx * Math.PI / 180;
                const yawAxis = vec3(0, 1, 0);
                const yawRotation = rotate(yawAngle, yawAxis);

                let eyeToAt = subtract(camera.eye, camera.at);
                eyeToAt = vec4(eyeToAt[0], eyeToAt[1], eyeToAt[2], 0);
                eyeToAt = mult(pitchRotation, eyeToAt);
                eyeToAt = mult(yawRotation, eyeToAt);

                camera.eye[0] = camera.at[0] + eyeToAt[0];
                camera.eye[1] = camera.at[1] + eyeToAt[1];
                camera.eye[2] = camera.at[2] + eyeToAt[2];

                let newUp = vec4(camera.up[0], camera.up[1], camera.up[2], 0);
                newUp = mult(pitchRotation, newUp);
                newUp = mult(yawRotation, newUp);
                camera.up[0] = newUp[0];
                camera.up[1] = newUp[1];
                camera.up[2] = newUp[2];
                camera.up = normalize(camera.up);
            }

            lastMouseX = event.offsetX;
            lastMouseY = event.offsetY;
        }
    });

    canvas.addEventListener('mousedown', function (event) {
        mouseDown = true;
        lastMouseX = event.offsetX;
        lastMouseY = event.offsetY;
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mouseup', function (event) {
        mouseDown = false;
        canvas.style.cursor = 'default';
    });

    canvas.addEventListener('mouseleave', function (event) {
        mouseDown = false;
        canvas.style.cursor = 'default';
    });
}

// Setup all event listeners
function setupEventListeners() {
    window.addEventListener('resize', resizeCanvasToFullWindow);
    setupKeyboardControls();
    setupMouseControls();
}

// Function to set light uniforms
function setLightUniforms(gl, program, mView) {
        const nLights = Math.min(lights.length, MAX_LIGHTS);
        const u_n_lights_loc = gl.getUniformLocation(program, "u_n_lights");
        gl.uniform1i(u_n_lights_loc, nLights);

        const useWorldSpace = options && options.lightSpace === "World";

        for (let i = 0; i < MAX_LIGHTS; i++) {
            if (i >= lights.length) break;
            const light = lights[i];
            const prefix = "u_lights[" + i + "]";

            let basePos = vec4(
                light.position[0],
                light.position[1],
                light.position[2],
                (light.type === 1) ? 0.0 : 1.0
            );

            let lightPos = useWorldSpace ? mult(mView, basePos) : basePos;

            let baseAxis = vec4(light.axis[0], light.axis[1], light.axis[2], 0.0);
            let lightAxis = useWorldSpace ? mult(mView, baseAxis) : baseAxis;

            const loc_enabled = gl.getUniformLocation(program, prefix + ".enabled");
            const loc_type = gl.getUniformLocation(program, prefix + ".type");
            const loc_position = gl.getUniformLocation(program, prefix + ".position");
            const loc_ambient = gl.getUniformLocation(program, prefix + ".ambient");
            const loc_diffuse = gl.getUniformLocation(program, prefix + ".diffuse");
            const loc_specular = gl.getUniformLocation(program, prefix + ".specular");
            const loc_axis = gl.getUniformLocation(program, prefix + ".axis");
            const loc_aperture = gl.getUniformLocation(program, prefix + ".aperture");
            const loc_cutoff = gl.getUniformLocation(program, prefix + ".cutoff");

            gl.uniform1i(loc_enabled, light.enabled ? 1 : 0);
            gl.uniform1i(loc_type, light.type);
            gl.uniform4f(loc_position, lightPos[0], lightPos[1], lightPos[2], lightPos[3]);
            gl.uniform3f(loc_ambient, light.ambient[0], light.ambient[1], light.ambient[2]);
            gl.uniform3f(loc_diffuse, light.diffuse[0], light.diffuse[1], light.diffuse[2]);
            gl.uniform3f(loc_specular, light.specular[0], light.specular[1], light.specular[2]);
            gl.uniform3f(loc_axis, lightAxis[0], lightAxis[1], lightAxis[2]);
            gl.uniform1f(loc_aperture, light.aperture);
            gl.uniform1f(loc_cutoff, light.cutoff);
        }
    }

// Helper function to extract and flatten 3x3 normal matrix
function getNormalMatrix3x3(mv) {
        const nm = normalMatrix(mv);
        const nmArray = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                nmArray.push(nm[i][j]);
            }
        }
        return nmArray;
    }

// Function to set material uniforms
function setMaterialUniforms(gl, program, mat) {
        const loc_Ka = gl.getUniformLocation(program, "u_material.Ka");
        const loc_Kd = gl.getUniformLocation(program, "u_material.Kd");
        const loc_Ks = gl.getUniformLocation(program, "u_material.Ks");
        const loc_shininess = gl.getUniformLocation(program, "u_material.shininess");
        
        if (loc_Ka) gl.uniform3f(loc_Ka, mat.Ka[0], mat.Ka[1], mat.Ka[2]);
        if (loc_Kd) gl.uniform3f(loc_Kd, mat.Kd[0], mat.Kd[1], mat.Kd[2]);
        if (loc_Ks) gl.uniform3f(loc_Ks, mat.Ks[0], mat.Ks[1], mat.Ks[2]);
        if (loc_shininess) gl.uniform1f(loc_shininess, mat.shininess);
    }

// Main render function
function render() {
    // schedule next frame
    window.requestAnimationFrame(render);

    updateCameraMovement();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    gl.useProgram(program);

    mView = lookAt(camera.eye, camera.at, camera.up);
    mProjection = perspective(camera.fovy, camera.aspect, camera.near, camera.far);

    // Set common uniforms
    const u_proj_loc = gl.getUniformLocation(program, "u_projection");
    if (u_proj_loc) {
        gl.uniformMatrix4fv(u_proj_loc, false, flatten(mProjection));
    }

    // Set light uniforms (needed for both Phong and Gouraud)
    setLightUniforms(gl, program, mView);

    // draw platform 
    loadMatrix(mView); // load camera view into stack
    pushMatrix(); // push top of stack

    // upload matrices
    const mv = modelView();
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_model_view"), false, flatten(mv));
    gl.uniformMatrix3fv(gl.getUniformLocation(program, "u_normals"), false, getNormalMatrix3x3(mv));

    // platform material
    const platformMaterial = {
        Ka: [100, 80, 60],
        Kd: [150, 120, 90],
        Ks: [50, 50, 50],
        shininess: 10
    };
    setMaterialUniforms(gl, program, platformMaterial);

    // draw platform
    gl.bindVertexArray(platform.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, platform.faces_buffer);
    gl.drawElements(gl.TRIANGLES, platform.numFaces, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    popMatrix(); // restore

    // Quadrant 1: Cube (front-left)
    pushMatrix();
    multMatrix(translate(-2.5, 1.003, -2.5));
    multMatrix(scalem(2, 2, 2));
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_model_view"), false, flatten(modelView()));
    gl.uniformMatrix3fv(gl.getUniformLocation(program, "u_normals"), false, getNormalMatrix3x3(modelView()));
    const cubeMaterial = {
        Ka: [200, 50, 50],
        Kd: [200, 50, 50],
        Ks: [200, 200, 200], 
        shininess: 80  
    };
    setMaterialUniforms(gl, program, cubeMaterial);
    CUBE.draw(gl, program, gl.TRIANGLES);
    popMatrix();

    // Quadrant 2: Cow (back-right)

    pushMatrix();
    multMatrix(translate(2.5, 1.003, -2.5));
    multMatrix(scalem(2, 2, 2));
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_model_view"), false, flatten(modelView()));
    gl.uniformMatrix3fv(gl.getUniformLocation(program, "u_normals"), false, getNormalMatrix3x3(modelView()));
    const cowMaterial = {
        Ka: [50, 200, 50],
        Kd: [50, 200, 50],
        Ks: [255, 255, 255],  
        shininess: 100  
    };
    setMaterialUniforms(gl, program, cowMaterial);
    COW.draw(gl, program, gl.TRIANGLES);
    popMatrix();

    // Quadrant 3: Torus (back-left)
    pushMatrix();
    multMatrix(translate(-2.5, 0.4, 2.5));
    multMatrix(scalem(2, 2, 2));
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_model_view"), false, flatten(modelView()));
    gl.uniformMatrix3fv(gl.getUniformLocation(program, "u_normals"), false, getNormalMatrix3x3(modelView()));
    const torusMaterial = {
        Ka: [50, 200, 50],
        Kd: [50, 200, 50],
        Ks: [255, 255, 255],  
        shininess: 120  
    };
    setMaterialUniforms(gl, program, torusMaterial);
    TORUS.draw(gl, program, gl.TRIANGLES);
    popMatrix();

    // Quadrant 4: Bunny (front-right) 
    pushMatrix();
    multMatrix(translate(2.5, 0.997, 2.5));
    multMatrix(scalem(2, 2, 2));
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_model_view"), false, flatten(modelView()));
    gl.uniformMatrix3fv(gl.getUniformLocation(program, "u_normals"), false, getNormalMatrix3x3(modelView()));
    setMaterialUniforms(gl, program, material);
    BUNNY.draw(gl, program, gl.TRIANGLES);
    popMatrix();
}

// Main setup function
function setup(shaders) {
    initializeWebGL();
    buildShaders(shaders);
    initializeCamera();
    initializeOptions();
    initializeMaterial();
    initializeLights();
    setupGUI();
    initializeOpenGLState();
    setupEventListeners();
    
    // Start the render loop
    window.requestAnimationFrame(render);
}

const urls = ['shader1.vert', 'shader1.frag', 'shader2.vert', 'shader2.frag'];

loadShadersFromURLS(urls).then(shaders => setup(shaders));