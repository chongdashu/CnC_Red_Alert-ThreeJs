import * as THREE from 'three';

/**
 * Manages the game map, terrain, and resources
 */
export class MapManager {
    /**
     * Create a new MapManager
     * @param {Object} game - Reference to the main game
     */
    constructor(game) {
        this.game = game;
        this.cellSize = 2;
        this.mapData = [];
        this.resources = [];
        this.gridWidth = 0;
        this.gridHeight = 0;

        // Material for grid and terrain
        this.gridMaterial = new THREE.LineBasicMaterial({ color: 0x444444 });
        this.terrainMaterials = {
            grass: new THREE.MeshStandardMaterial({
                color: 0x4a7c59,
                roughness: 0.8,
                metalness: 0.2
            }),
            water: new THREE.MeshStandardMaterial({
                color: 0x3a85bf,
                roughness: 0.3,
                metalness: 0.6
            }),
            rock: new THREE.MeshStandardMaterial({
                color: 0x7a7a7a,
                roughness: 0.9,
                metalness: 0.1
            }),
            ore: new THREE.MeshStandardMaterial({
                color: 0xffd700,
                roughness: 0.5,
                metalness: 0.8,
                emissive: 0x332200,
                emissiveIntensity: 0.2
            })
        };
    }

    /**
     * Create a new game map
     * @param {number} width - Width of the map in cells
     * @param {number} height - Height of the map in cells
     */
    createMap(width, height) {
        this.gridWidth = width;
        this.gridHeight = height;

        // Initialize map data
        this.mapData = [];
        for (let x = 0; x < width; x++) {
            this.mapData[x] = [];
            for (let z = 0; z < height; z++) {
                this.mapData[x][z] = {
                    type: 'grass',
                    walkable: true,
                    buildable: true,
                    resourceType: null,
                    resourceAmount: 0,
                    entity: null
                };
            }
        }

        // Create terrain
        this.createTerrain();

        // Create grid
        this.createGrid();
    }

    /**
     * Create terrain meshes
     */
    createTerrain() {
        // Create ground plane
        const geometry = new THREE.PlaneGeometry(
            this.gridWidth * this.cellSize,
            this.gridHeight * this.cellSize,
            this.gridWidth,
            this.gridHeight
        );
        geometry.rotateX(-Math.PI / 2);

        // Add some height variation
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            // Skip edges to keep them at zero height
            const x = Math.floor((i / 3) % (this.gridWidth + 1));
            const z = Math.floor((i / 3) / (this.gridWidth + 1));

            if (x > 0 && x < this.gridWidth && z > 0 && z < this.gridHeight) {
                vertices[i + 1] = Math.random() * 0.2; // Random height up to 0.2 units
            }
        }

        // Update vertex normals
        geometry.computeVertexNormals();

        // Create and add mesh
        const terrain = new THREE.Mesh(geometry, this.terrainMaterials.grass);
        terrain.receiveShadow = true;
        terrain.name = 'terrain';

        // Position to center the map at 0,0
        terrain.position.set(
            ((this.gridWidth * this.cellSize) / 2) - (this.cellSize / 2),
            0,
            ((this.gridHeight * this.cellSize) / 2) - (this.cellSize / 2)
        );

        this.game.scene.add(terrain);
        this.terrain = terrain;
    }

    /**
     * Create grid visualization
     */
    createGrid() {
        const gridHelper = new THREE.GridHelper(
            Math.max(this.gridWidth, this.gridHeight) * this.cellSize,
            Math.max(this.gridWidth, this.gridHeight),
            0x444444,
            0x222222
        );
        gridHelper.position.set(
            ((this.gridWidth * this.cellSize) / 2) - (this.cellSize / 2),
            0.01, // Slightly above ground
            ((this.gridHeight * this.cellSize) / 2) - (this.cellSize / 2)
        );
        gridHelper.name = 'grid';
        this.game.scene.add(gridHelper);
        this.grid = gridHelper;
    }

    /**
     * Add resources to the map
     */
    addResources() {
        // Add some ore patches
        this.addResourcePatch(3, 3, 'ore', 3);
        this.addResourcePatch(15, 15, 'ore', 3);

        // Add water
        this.addWater(10, 10, 3);
    }

    /**
     * Add a resource patch to the map
     * @param {number} x - Center X coordinate
     * @param {number} z - Center Z coordinate
     * @param {string} type - Resource type ('ore', 'gems', etc)
     * @param {number} size - Size of the patch
     */
    addResourcePatch(x, z, type, size) {
        // Create a small group of resources
        for (let dx = -size / 2; dx < size / 2; dx++) {
            for (let dz = -size / 2; dz < size / 2; dz++) {
                const cellX = Math.floor(x + dx);
                const cellZ = Math.floor(z + dz);

                // Make sure we're in bounds
                if (cellX >= 0 && cellX < this.gridWidth && cellZ >= 0 && cellZ < this.gridHeight) {
                    // Skip some cells randomly to make organic patterns
                    if (Math.random() > 0.3) {
                        // Set cell properties
                        this.mapData[cellX][cellZ].resourceType = type;
                        this.mapData[cellX][cellZ].resourceAmount = 500 + Math.floor(Math.random() * 500);

                        // Create visual representation
                        this.createResourceVisual(cellX, cellZ, type);
                    }
                }
            }
        }
    }

    /**
     * Create visual representation of a resource
     * @param {number} x - Cell X coordinate
     * @param {number} z - Cell Z coordinate
     * @param {string} type - Resource type
     */
    createResourceVisual(x, z, type) {
        let geometry, material;

        if (type === 'ore') {
            // Create ore deposit geometry
            geometry = new THREE.CylinderGeometry(0.3, 0.5, 0.2, 6);
            material = this.terrainMaterials.ore;
        } else {
            // Default resource visual
            geometry = new THREE.BoxGeometry(0.5, 0.2, 0.5);
            material = this.terrainMaterials.rock;
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            x * this.cellSize,
            0.1, // Slightly above ground
            z * this.cellSize
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = `resource_${x}_${z}`;

        // Add some random rotation
        mesh.rotation.y = Math.random() * Math.PI;

        this.game.scene.add(mesh);

        // Store reference
        this.resources.push({
            mesh,
            x,
            z,
            type,
            amount: this.mapData[x][z].resourceAmount
        });
    }

    /**
     * Add water to the map
     * @param {number} x - Center X coordinate
     * @param {number} z - Center Z coordinate
     * @param {number} size - Size of the water body
     */
    addWater(x, z, size) {
        // Create water geometry
        const geometry = new THREE.PlaneGeometry(size * this.cellSize, size * this.cellSize);
        geometry.rotateX(-Math.PI / 2);

        const water = new THREE.Mesh(geometry, this.terrainMaterials.water);
        water.position.set(
            x * this.cellSize,
            0.05, // Slightly above ground
            z * this.cellSize
        );
        water.name = 'water';
        this.game.scene.add(water);

        // Make cells not buildable or walkable
        for (let dx = -size / 2; dx < size / 2; dx++) {
            for (let dz = -size / 2; dz < size / 2; dz++) {
                const cellX = Math.floor(x + dx);
                const cellZ = Math.floor(z + dz);

                // Make sure we're in bounds
                if (cellX >= 0 && cellX < this.gridWidth && cellZ >= 0 && cellZ < this.gridHeight) {
                    this.mapData[cellX][cellZ].type = 'water';
                    this.mapData[cellX][cellZ].walkable = false;
                    this.mapData[cellX][cellZ].buildable = false;
                }
            }
        }
    }

    /**
     * Check if a cell is walkable
     * @param {number} x - Cell X coordinate
     * @param {number} z - Cell Z coordinate
     * @returns {boolean} True if the cell is walkable
     */
    isWalkable(x, z) {
        // Check bounds
        if (x < 0 || x >= this.gridWidth || z < 0 || z >= this.gridHeight) {
            return false;
        }

        return this.mapData[x][z].walkable;
    }

    /**
     * Check if a cell is buildable
     * @param {number} x - Cell X coordinate
     * @param {number} z - Cell Z coordinate
     * @returns {boolean} True if the cell is buildable
     */
    isBuildable(x, z) {
        // Check bounds
        if (x < 0 || x >= this.gridWidth || z < 0 || z >= this.gridHeight) {
            return false;
        }

        return this.mapData[x][z].buildable;
    }

    /**
     * Convert world coordinates to grid coordinates
     * @param {THREE.Vector3} position - World position
     * @returns {Object} Grid coordinates {x, z}
     */
    worldToGrid(position) {
        return {
            x: Math.floor(position.x / this.cellSize),
            z: Math.floor(position.z / this.cellSize)
        };
    }

    /**
     * Convert grid coordinates to world coordinates
     * @param {number} x - Grid X coordinate
     * @param {number} z - Grid Z coordinate 
     * @returns {THREE.Vector3} World position
     */
    gridToWorld(x, z) {
        return new THREE.Vector3(
            x * this.cellSize + (this.cellSize / 2),
            0,
            z * this.cellSize + (this.cellSize / 2)
        );
    }

    /**
     * Find resource at a specific grid cell
     * @param {number} x - Grid X coordinate
     * @param {number} z - Grid Z coordinate
     * @returns {Object|null} Resource object or null if not found
     */
    getResourceAt(x, z) {
        return this.resources.find(resource => resource.x === x && resource.z === z) || null;
    }

    /**
     * Get the resource amount at a specific grid cell
     * @param {number} x - Grid X coordinate
     * @param {number} z - Grid Z coordinate
     * @returns {number} Resource amount (0 if none)
     */
    getResourceAmount(x, z) {
        const resource = this.getResourceAt(x, z);
        return resource ? resource.amount : 0;
    }

    /**
     * Extract resources from a cell
     * @param {number} x - Grid X coordinate
     * @param {number} z - Grid Z coordinate
     * @param {number} amount - Amount to extract
     * @returns {Object} Extracted resource {type, amount}
     */
    extractResource(x, z, amount) {
        const resource = this.getResourceAt(x, z);
        if (!resource || resource.amount <= 0) {
            return { type: null, amount: 0 };
        }

        const extractedAmount = Math.min(resource.amount, amount);
        resource.amount -= extractedAmount;
        this.mapData[x][z].resourceAmount -= extractedAmount;

        // Remove resource if depleted
        if (resource.amount <= 0) {
            this.mapData[x][z].resourceType = null;
            this.mapData[x][z].resourceAmount = 0;

            // Remove visual representation
            const index = this.resources.indexOf(resource);
            if (index !== -1) {
                this.game.scene.remove(resource.mesh);
                this.resources.splice(index, 1);
            }
        }

        return { type: resource.type, amount: extractedAmount };
    }
} 