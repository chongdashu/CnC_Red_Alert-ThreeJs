import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MapManager } from './MapManager.js';
import { UnitManager } from './UnitManager.js';
import { BuildingManager } from './BuildingManager.js';
import { InputManager } from '../engine/InputManager.js';
import { UIManager } from './ui/UIManager.js';
import { Player } from './Player.js';

/**
 * Main Game class that initializes and manages the game systems
 */
export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Setup camera position and controls
        this.camera.position.set(40, 40, 40);
        this.camera.lookAt(0, 0, 0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI / 2.5;

        // Setup lighting
        this.setupLights();

        // Initialize managers
        this.inputManager = new InputManager(this);
        this.mapManager = new MapManager(this);
        this.unitManager = new UnitManager(this);
        this.buildingManager = new BuildingManager(this);
        this.uiManager = new UIManager(this);

        // Create players
        this.players = [
            new Player('player', 'red', 5000),
            new Player('enemy', 'blue', 5000)
        ];
        this.currentPlayer = this.players[0];

        // Game state
        this.selectedEntities = [];
        this.isRunning = false;
        this.clock = new THREE.Clock();

        // Initialize game
        this.init();
    }

    /**
     * Setup scene lighting
     */
    setupLights() {
        // Main directional light (sun)
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 500;
        dirLight.shadow.camera.left = -100;
        dirLight.shadow.camera.right = 100;
        dirLight.shadow.camera.top = 100;
        dirLight.shadow.camera.bottom = -100;
        this.scene.add(dirLight);

        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x333333, 1);
        this.scene.add(ambientLight);
    }

    /**
     * Initialize the game
     */
    init() {
        // Create a simple terrain
        this.mapManager.createMap(20, 20);

        // Add some resources
        this.mapManager.addResources();

        // Add a few initial units
        const playerStartPosition = new THREE.Vector3(5, 0, 5);
        this.unitManager.createUnit('mcv', playerStartPosition, this.currentPlayer);

        // Add enemy units
        const enemyStartPosition = new THREE.Vector3(15, 0, 15);
        this.unitManager.createUnit('tank', enemyStartPosition, this.players[1]);

        // Setup UI elements
        this.uiManager.init();

        console.log('Game initialized');
    }

    /**
     * Start the game loop
     */
    start() {
        this.isRunning = true;
        this.animate();
    }

    /**
     * Main animation/game loop
     */
    animate() {
        if (!this.isRunning) return;

        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Update managers
        this.controls.update();
        this.unitManager.update(delta);
        this.buildingManager.update(delta);
        this.uiManager.update(delta);

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Handle window resize
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Select an entity (unit or building)
     * @param {Object} entity - The entity to select
     */
    selectEntity(entity) {
        // Deselect current selection
        this.selectedEntities.forEach(e => e.setSelected(false));
        this.selectedEntities = [];

        if (entity) {
            entity.setSelected(true);
            this.selectedEntities.push(entity);
            this.uiManager.updateSelection(entity);
        }
    }

    /**
     * Clean up resources when the game is stopped
     */
    cleanup() {
        this.isRunning = false;
        this.renderer.dispose();
        this.scene.clear();
        document.body.removeChild(this.renderer.domElement);
    }
} 