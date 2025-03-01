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
            0.1, // Higher above ground to avoid intersection with terrain
            ((this.gridHeight * this.cellSize) / 2) - (this.cellSize / 2)
        );
        
        // Make grid lines more visible
        const material = gridHelper.material;
        material.opacity = 0.8;
        material.transparent = true;
        
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
            geometry = new THREE.CylinderGeometry(0.3, 0.5, 0.3, 6);
            material = this.terrainMaterials.ore;
        } else {
            // Default resource visual
            geometry = new THREE.BoxGeometry(0.5, 0.3, 0.5);
            material = this.terrainMaterials.rock;
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            x * this.cellSize,
            0.25, // Higher above ground to avoid terrain intersection
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
        // Create water group to hold all water-related meshes
        const waterGroup = new THREE.Group();
        waterGroup.name = 'water';
        
        // Create water surface geometry
        const surfaceGeometry = new THREE.PlaneGeometry(size * this.cellSize, size * this.cellSize);
        surfaceGeometry.rotateX(-Math.PI / 2);
        
        // Create water surface material with transparency
        const waterSurfaceMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a85bf,
            roughness: 0.1,
            metalness: 0.8,
            transparent: true,
            opacity: 0.8
        });
        
        // Add some gentle waves to the water surface
        const vertices = surfaceGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            // Skip edges to keep them flat for better blending
            const xIndex = Math.floor((i / 3) % (size + 1));
            const zIndex = Math.floor((i / 3) / (size + 1));
            
            if (xIndex > 0 && xIndex < size && zIndex > 0 && zIndex < size) {
                // Add subtle height variation for wave effect
                vertices[i + 1] = Math.sin(xIndex * 0.5) * 0.05 + Math.cos(zIndex * 0.5) * 0.05;
            }
        }
        
        // Update normals after modifying vertices
        surfaceGeometry.computeVertexNormals();
        
        const waterSurface = new THREE.Mesh(surfaceGeometry, waterSurfaceMaterial);
        waterSurface.position.y = 0.15; // Slightly above ground
        waterSurface.receiveShadow = true;
        waterGroup.add(waterSurface);
        
        // Create water bottom (depth)
        const bottomGeometry = new THREE.PlaneGeometry(size * this.cellSize, size * this.cellSize);
        bottomGeometry.rotateX(-Math.PI / 2);
        
        // Darker blue for the bottom
        const waterBottomMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a4570, // Darker blue
            roughness: 0.5,
            metalness: 0.3
        });
        
        // Add some variation to the bottom for a more natural look
        const bottomVertices = bottomGeometry.attributes.position.array;
        for (let i = 0; i < bottomVertices.length; i += 3) {
            // Create a depression in the middle that gets deeper
            const xIndex = Math.floor((i / 3) % (size + 1));
            const zIndex = Math.floor((i / 3) / (size + 1));
            
            // Calculate distance from center
            const centerX = size / 2;
            const centerZ = size / 2;
            const distFromCenter = Math.sqrt(
                Math.pow(xIndex - centerX, 2) + 
                Math.pow(zIndex - centerZ, 2)
            );
            
            // Deeper in the middle, shallower at edges
            const maxDepth = 0.8; // Maximum depth
            const depthFactor = Math.max(0, 1 - (distFromCenter / (size / 2)));
            bottomVertices[i + 1] = -maxDepth * Math.pow(depthFactor, 2);
        }
        
        // Update normals after modifying vertices
        bottomGeometry.computeVertexNormals();
        
        const waterBottom = new THREE.Mesh(bottomGeometry, waterBottomMaterial);
        waterBottom.position.y = 0.1; // Slightly above ground but below surface
        waterBottom.receiveShadow = true;
        waterGroup.add(waterBottom);
        
        // Create water sides to give depth appearance
        const waterDepth = 0.8; // Maximum water depth
        const sidesMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a6590, // Medium blue for sides
            roughness: 0.5,
            metalness: 0.5
        });
        
        // Create sides for the water body (north, east, south, west)
        const sideWidth = size * this.cellSize;
        const sideHeight = waterDepth;
        
        // North side
        const northGeometry = new THREE.PlaneGeometry(sideWidth, sideHeight);
        const northSide = new THREE.Mesh(northGeometry, sidesMaterial);
        northSide.position.set(0, sideHeight/2, -sideWidth/2);
        northSide.rotation.y = Math.PI;
        waterGroup.add(northSide);
        
        // South side
        const southGeometry = new THREE.PlaneGeometry(sideWidth, sideHeight);
        const southSide = new THREE.Mesh(southGeometry, sidesMaterial);
        southSide.position.set(0, sideHeight/2, sideWidth/2);
        waterGroup.add(southSide);
        
        // East side
        const eastGeometry = new THREE.PlaneGeometry(sideWidth, sideHeight);
        const eastSide = new THREE.Mesh(eastGeometry, sidesMaterial);
        eastSide.position.set(sideWidth/2, sideHeight/2, 0);
        eastSide.rotation.y = -Math.PI/2;
        waterGroup.add(eastSide);
        
        // West side
        const westGeometry = new THREE.PlaneGeometry(sideWidth, sideHeight);
        const westSide = new THREE.Mesh(westGeometry, sidesMaterial);
        westSide.position.set(-sideWidth/2, sideHeight/2, 0);
        westSide.rotation.y = Math.PI/2;
        waterGroup.add(westSide);
        
        // Position the entire water group
        waterGroup.position.set(
            x * this.cellSize,
            0, // At ground level
            z * this.cellSize
        );
        
        this.game.scene.add(waterGroup);
        
        // Add animation for water
        this.waterGroup = waterGroup;
        this.waterSurface = waterSurface;
        this.waterAnimTime = 0;

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

    /**
     * Update the map (animations, etc.)
     * @param {number} delta - Time delta
     */
    update(delta) {
        // Animate water if it exists
        if (this.waterSurface) {
            this.waterAnimTime += delta;
            
            // Update water surface vertices for wave animation
            const geometry = this.waterSurface.geometry;
            const vertices = geometry.attributes.position.array;
            
            for (let i = 0; i < vertices.length; i += 3) {
                const x = Math.floor((i / 3) % (geometry.parameters.widthSegments + 1));
                const z = Math.floor((i / 3) / (geometry.parameters.widthSegments + 1));
                
                // Skip edges to keep them flat for better blending
                if (x > 0 && x < geometry.parameters.widthSegments && 
                    z > 0 && z < geometry.parameters.heightSegments) {
                    // Create gentle wave motion
                    vertices[i + 1] = 
                        Math.sin(x * 0.5 + this.waterAnimTime * 1.5) * 0.05 + 
                        Math.cos(z * 0.5 + this.waterAnimTime) * 0.05;
                }
            }
            
            // Mark vertices for update
            geometry.attributes.position.needsUpdate = true;
            
            // Update normals for proper lighting
            geometry.computeVertexNormals();
        }
    }
} 