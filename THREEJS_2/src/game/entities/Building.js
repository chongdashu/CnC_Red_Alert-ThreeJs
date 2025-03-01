import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Represents a building in the game
 */
export class Building {
    /**
     * Create a new building
     * @param {Object} game - Reference to the main game
     * @param {string} type - Building type
     * @param {THREE.Vector3} position - Initial position
     * @param {Object} player - Owning player
     */
    constructor(game, type, position, player) {
        this.game = game;
        this.type = type;
        this.player = player;
        this.position = position.clone();

        // Get building type data
        this.buildingData = this.game.buildingManager.buildingTypes[type];

        // Building properties
        this.health = this.buildingData.health;
        this.maxHealth = this.buildingData.health;
        this.isSelected = false;
        this.isUnderConstruction = true;
        this.constructionProgress = 0;
        this.powerProduced = this.buildingData.powerProduced || 0;
        this.powerConsumed = this.buildingData.powerConsumed || 0;

        // Production properties
        this.isProducing = false;
        this.productionQueue = [];
        this.currentProduction = null;
        this.productionProgress = 0;

        // Combat properties
        this.target = null;
        this.attackCooldown = 0;

        // Building options
        this.buildOptions = this.buildingData.buildOptions || [];

        // Create mesh
        this.createMesh();

        // Selection indicator
        this.createSelectionIndicator();
    }

    /**
     * Create the building's 3D mesh
     */
    createMesh() {
        // Create a geometry based on building type
        let geometry;
        
        switch (this.type) {
            case 'construction_yard':
                geometry = this.createConstructionYardMesh();
                break;
            case 'power_plant':
                geometry = this.createPowerPlantMesh();
                break;
            case 'barracks':
                geometry = this.createBarracksMesh();
                break;
            case 'refinery':
                geometry = this.createRefineryMesh();
                break;
            case 'war_factory':
                geometry = this.createWarFactoryMesh();
                break;
            case 'defensive_turret':
                geometry = this.createDefensiveTurretMesh();
                break;
            default:
                // Fallback to simple box geometry
                geometry = new THREE.BoxGeometry(
                    this.buildingData.width,
                    this.buildingData.height,
                    this.buildingData.depth
                );
        }

        // Use the player's color
        const material = new THREE.MeshStandardMaterial({
            color: this.player.getColor(),
            roughness: 0.7,
            metalness: 0.3
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.copy(this.position);
        this.mesh.position.y = this.buildingData.height / 2 + 0.1; // Raise slightly above terrain
        this.mesh.name = `building_${this.type}_${this.player.id}`;

        // Add custom properties
        this.mesh.userData.entity = this;

        // Add to scene
        this.game.scene.add(this.mesh);

        // For buildings with turrets, create a separate turret mesh
        if (this.buildingData.canAttack) {
            this.createTurret();
        }

        // Create construction scaffolding
        if (this.isUnderConstruction) {
            this.createScaffolding();
        }
    }

    /**
     * Create Construction Yard mesh
     * @returns {THREE.BufferGeometry} The geometry for the construction yard
     */
    createConstructionYardMesh() {
        const width = this.buildingData.width;
        const height = this.buildingData.height;
        const depth = this.buildingData.depth;
        
        // Create a group to hold all the parts
        const group = new THREE.Group();
        
        // Base platform
        const baseGeometry = new THREE.BoxGeometry(width, height * 0.3, depth);
        const baseMesh = new THREE.Mesh(baseGeometry);
        baseMesh.position.y = -height * 0.35;
        group.add(baseMesh);
        
        // Main structure
        const mainGeometry = new THREE.BoxGeometry(width * 0.8, height * 0.5, depth * 0.8);
        const mainMesh = new THREE.Mesh(mainGeometry);
        mainMesh.position.y = height * 0.1;
        group.add(mainMesh);
        
        // Crane arm
        const craneBaseGeometry = new THREE.BoxGeometry(width * 0.2, height * 0.7, width * 0.2);
        const craneBaseMesh = new THREE.Mesh(craneBaseGeometry);
        craneBaseMesh.position.set(width * 0.3, height * 0.2, 0);
        group.add(craneBaseMesh);
        
        const craneArmGeometry = new THREE.BoxGeometry(width * 0.1, width * 0.1, depth * 0.6);
        const craneArmMesh = new THREE.Mesh(craneArmGeometry);
        craneArmMesh.position.set(width * 0.3, height * 0.6, depth * 0.2);
        group.add(craneArmMesh);
        
        // Convert the group to a buffer geometry
        const bufferGeometry = new THREE.BufferGeometry();
        const meshes = [];
        
        group.traverse((child) => {
            if (child.isMesh) {
                child.updateMatrix();
                const childGeometry = child.geometry.clone();
                childGeometry.applyMatrix4(child.matrix);
                meshes.push(childGeometry);
            }
        });
        
        // Merge all geometries
        const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(meshes);
        return mergedGeometry || baseGeometry; // Fallback if merge fails
    }

    /**
     * Create Power Plant mesh
     * @returns {THREE.BufferGeometry} The geometry for the power plant
     */
    createPowerPlantMesh() {
        const width = this.buildingData.width;
        const height = this.buildingData.height;
        const depth = this.buildingData.depth;
        
        // Create a composite geometry for the power plant
        const group = new THREE.Group();
        
        // Base
        const baseGeometry = new THREE.BoxGeometry(width, height * 0.3, depth);
        const baseMesh = new THREE.Mesh(baseGeometry);
        baseMesh.position.y = -height * 0.35;
        group.add(baseMesh);
        
        // Main building
        const mainGeometry = new THREE.BoxGeometry(width * 0.8, height * 0.6, depth * 0.8);
        const mainMesh = new THREE.Mesh(mainGeometry);
        mainMesh.position.y = height * 0.15;
        group.add(mainMesh);
        
        // Cooling towers (cylinders)
        const tower1Geometry = new THREE.CylinderGeometry(width * 0.2, width * 0.25, height * 0.8, 16);
        const tower1Mesh = new THREE.Mesh(tower1Geometry);
        tower1Mesh.position.set(width * 0.25, height * 0.4, depth * 0.25);
        group.add(tower1Mesh);
        
        const tower2Geometry = new THREE.CylinderGeometry(width * 0.2, width * 0.25, height * 0.8, 16);
        const tower2Mesh = new THREE.Mesh(tower2Geometry);
        tower2Mesh.position.set(-width * 0.25, height * 0.4, -depth * 0.25);
        group.add(tower2Mesh);
        
        // Convert the group to a buffer geometry
        const bufferGeometry = new THREE.BufferGeometry();
        const meshes = [];
        
        group.traverse((child) => {
            if (child.isMesh) {
                child.updateMatrix();
                const childGeometry = child.geometry.clone();
                childGeometry.applyMatrix4(child.matrix);
                meshes.push(childGeometry);
            }
        });
        
        // Merge all geometries
        const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(meshes);
        return mergedGeometry || baseGeometry; // Fallback if merge fails
    }

    /**
     * Create Barracks mesh
     * @returns {THREE.BufferGeometry} The geometry for the barracks
     */
    createBarracksMesh() {
        const width = this.buildingData.width;
        const height = this.buildingData.height;
        const depth = this.buildingData.depth;
        
        // Create a composite geometry for the barracks
        const group = new THREE.Group();
        
        // Base platform
        const baseGeometry = new THREE.BoxGeometry(width, height * 0.1, depth);
        const baseMesh = new THREE.Mesh(baseGeometry);
        baseMesh.position.y = -height * 0.45;
        group.add(baseMesh);
        
        // Main building
        const mainGeometry = new THREE.BoxGeometry(width, height * 0.8, depth);
        const mainMesh = new THREE.Mesh(mainGeometry);
        mainMesh.position.y = 0;
        group.add(mainMesh);
        
        // Roof (sloped)
        const roofGeometry = new THREE.BoxGeometry(width * 1.1, height * 0.2, depth * 1.1);
        const roofMesh = new THREE.Mesh(roofGeometry);
        roofMesh.position.y = height * 0.5;
        group.add(roofMesh);
        
        // Entrance
        const entranceGeometry = new THREE.BoxGeometry(width * 0.3, height * 0.4, depth * 0.1);
        const entranceMesh = new THREE.Mesh(entranceGeometry);
        entranceMesh.position.set(0, -height * 0.2, depth * 0.55);
        group.add(entranceMesh);
        
        // Windows
        const window1Geometry = new THREE.BoxGeometry(width * 0.1, height * 0.2, depth * 0.1);
        const window1Mesh = new THREE.Mesh(window1Geometry);
        window1Mesh.position.set(width * 0.3, 0, depth * 0.45);
        group.add(window1Mesh);
        
        const window2Geometry = new THREE.BoxGeometry(width * 0.1, height * 0.2, depth * 0.1);
        const window2Mesh = new THREE.Mesh(window2Geometry);
        window2Mesh.position.set(-width * 0.3, 0, depth * 0.45);
        group.add(window2Mesh);
        
        // Convert the group to a buffer geometry
        const bufferGeometry = new THREE.BufferGeometry();
        const meshes = [];
        
        group.traverse((child) => {
            if (child.isMesh) {
                child.updateMatrix();
                const childGeometry = child.geometry.clone();
                childGeometry.applyMatrix4(child.matrix);
                meshes.push(childGeometry);
            }
        });
        
        // Merge all geometries
        const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(meshes);
        return mergedGeometry || mainGeometry; // Fallback if merge fails
    }

    /**
     * Create Refinery mesh
     * @returns {THREE.BufferGeometry} The geometry for the refinery
     */
    createRefineryMesh() {
        const width = this.buildingData.width;
        const height = this.buildingData.height;
        const depth = this.buildingData.depth;
        
        // Create a composite geometry for the refinery
        const group = new THREE.Group();
        
        // Base platform
        const baseGeometry = new THREE.BoxGeometry(width, height * 0.1, depth);
        const baseMesh = new THREE.Mesh(baseGeometry);
        baseMesh.position.y = -height * 0.45;
        group.add(baseMesh);
        
        // Main building
        const mainGeometry = new THREE.BoxGeometry(width * 0.8, height * 0.7, depth * 0.8);
        const mainMesh = new THREE.Mesh(mainGeometry);
        mainMesh.position.y = -height * 0.05;
        group.add(mainMesh);
        
        // Silos (cylinders)
        const silo1Geometry = new THREE.CylinderGeometry(width * 0.15, width * 0.15, height * 1.2, 16);
        const silo1Mesh = new THREE.Mesh(silo1Geometry);
        silo1Mesh.position.set(width * 0.3, height * 0.25, depth * 0.3);
        group.add(silo1Mesh);
        
        const silo2Geometry = new THREE.CylinderGeometry(width * 0.15, width * 0.15, height * 1.2, 16);
        const silo2Mesh = new THREE.Mesh(silo2Geometry);
        silo2Mesh.position.set(-width * 0.3, height * 0.25, -depth * 0.3);
        group.add(silo2Mesh);
        
        // Processing unit
        const processorGeometry = new THREE.BoxGeometry(width * 0.5, height * 0.4, depth * 0.5);
        const processorMesh = new THREE.Mesh(processorGeometry);
        processorMesh.position.set(0, height * 0.35, 0);
        group.add(processorMesh);
        
        // Unloading bay
        const bayGeometry = new THREE.BoxGeometry(width * 0.4, height * 0.2, depth * 0.6);
        const bayMesh = new THREE.Mesh(bayGeometry);
        bayMesh.position.set(0, -height * 0.3, -depth * 0.4);
        group.add(bayMesh);
        
        // Convert the group to a buffer geometry
        const bufferGeometry = new THREE.BufferGeometry();
        const meshes = [];
        
        group.traverse((child) => {
            if (child.isMesh) {
                child.updateMatrix();
                const childGeometry = child.geometry.clone();
                childGeometry.applyMatrix4(child.matrix);
                meshes.push(childGeometry);
            }
        });
        
        // Merge all geometries
        const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(meshes);
        return mergedGeometry || mainGeometry; // Fallback if merge fails
    }

    /**
     * Create War Factory mesh
     * @returns {THREE.BufferGeometry} The geometry for the war factory
     */
    createWarFactoryMesh() {
        const width = this.buildingData.width;
        const height = this.buildingData.height;
        const depth = this.buildingData.depth;
        
        // Create a composite geometry for the war factory
        const group = new THREE.Group();
        
        // Base platform
        const baseGeometry = new THREE.BoxGeometry(width, height * 0.1, depth);
        const baseMesh = new THREE.Mesh(baseGeometry);
        baseMesh.position.y = -height * 0.45;
        group.add(baseMesh);
        
        // Main building (factory floor)
        const mainGeometry = new THREE.BoxGeometry(width, height * 0.6, depth);
        const mainMesh = new THREE.Mesh(mainGeometry);
        mainMesh.position.y = -height * 0.1;
        group.add(mainMesh);
        
        // Factory roof (angled)
        const roofGeometry = new THREE.BoxGeometry(width, height * 0.3, depth);
        const roofMesh = new THREE.Mesh(roofGeometry);
        roofMesh.position.y = height * 0.35;
        group.add(roofMesh);
        
        // Smokestacks
        const stack1Geometry = new THREE.CylinderGeometry(width * 0.08, width * 0.1, height * 0.6, 8);
        const stack1Mesh = new THREE.Mesh(stack1Geometry);
        stack1Mesh.position.set(width * 0.35, height * 0.3, depth * 0.35);
        group.add(stack1Mesh);
        
        const stack2Geometry = new THREE.CylinderGeometry(width * 0.08, width * 0.1, height * 0.6, 8);
        const stack2Mesh = new THREE.Mesh(stack2Geometry);
        stack2Mesh.position.set(width * 0.35, height * 0.3, -depth * 0.35);
        group.add(stack2Mesh);
        
        // Vehicle exit
        const exitGeometry = new THREE.BoxGeometry(width * 0.5, height * 0.4, depth * 0.1);
        const exitMesh = new THREE.Mesh(exitGeometry);
        exitMesh.position.set(0, -height * 0.2, depth * 0.55);
        group.add(exitMesh);
        
        // Convert the group to a buffer geometry
        const bufferGeometry = new THREE.BufferGeometry();
        const meshes = [];
        
        group.traverse((child) => {
            if (child.isMesh) {
                child.updateMatrix();
                const childGeometry = child.geometry.clone();
                childGeometry.applyMatrix4(child.matrix);
                meshes.push(childGeometry);
            }
        });
        
        // Merge all geometries
        const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(meshes);
        return mergedGeometry || mainGeometry; // Fallback if merge fails
    }

    /**
     * Create Defensive Turret mesh
     * @returns {THREE.BufferGeometry} The geometry for the defensive turret
     */
    createDefensiveTurretMesh() {
        const width = this.buildingData.width;
        const height = this.buildingData.height;
        const depth = this.buildingData.depth;
        
        // For the defensive turret, we'll create a simple base
        // The actual turret will be created in the createTurret method
        const baseGeometry = new THREE.CylinderGeometry(width * 0.5, width * 0.6, height * 0.5, 16);
        
        return baseGeometry;
    }

    /**
     * Create construction scaffolding
     */
    createScaffolding() {
        // Create a wireframe version of the building that's slightly larger
        const scaffoldingGeometry = new THREE.BoxGeometry(
            this.buildingData.width + 0.4,
            this.buildingData.height + 0.4,
            this.buildingData.depth + 0.4
        );

        const scaffoldingMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            linewidth: 2
        });

        this.scaffolding = new THREE.Mesh(scaffoldingGeometry, scaffoldingMaterial);
        this.scaffolding.position.y = this.buildingData.height / 2;
        
        // Add entity reference to scaffolding for selection
        this.scaffolding.userData.entity = this;

        // Add the scaffolding to the main mesh
        this.mesh.add(this.scaffolding);

        // Create a transparent version of the building to show its footprint
        const ghostGeometry = new THREE.BoxGeometry(
            this.buildingData.width,
            this.buildingData.height,
            this.buildingData.depth
        );

        const ghostMaterial = new THREE.MeshStandardMaterial({
            color: this.player.getColor(),
            transparent: true,
            opacity: 0.3,
            roughness: 0.7,
            metalness: 0.3
        });

        this.ghostMesh = new THREE.Mesh(ghostGeometry, ghostMaterial);
        this.ghostMesh.position.y = this.buildingData.height / 2;
        
        // Add entity reference to ghost mesh for selection
        this.ghostMesh.userData.entity = this;
        
        this.mesh.add(this.ghostMesh);

        // Hide only the solid mesh during construction, but show the ghost
        this.mesh.visible = true;
        this.mesh.material.visible = false;
    }

    /**
     * Create a turret for defensive buildings
     */
    createTurret() {
        const turretGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 8);
        const turretMaterial = new THREE.MeshStandardMaterial({
            color: this.player.getColor(),
            roughness: 0.6,
            metalness: 0.5
        });

        this.turret = new THREE.Mesh(turretGeometry, turretMaterial);
        this.turret.castShadow = true;
        this.turret.position.y = this.buildingData.height / 2;
        this.turret.name = `turret_${this.type}_${this.player.id}`;

        // Create gun barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8);
        barrelGeometry.rotateX(Math.PI / 2);
        const barrelMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.8,
            metalness: 0.6
        });

        this.barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        this.barrel.position.z = 0.6;
        this.barrel.position.y = 0;

        this.turret.add(this.barrel);
        this.mesh.add(this.turret);
    }

    /**
     * Create selection indicator
     */
    createSelectionIndicator() {
        const size = Math.max(this.buildingData.width, this.buildingData.depth) + 0.4;
        const geometry = new THREE.RingGeometry(size, size + 0.3, 32);
        geometry.rotateX(-Math.PI / 2); // Make it flat and horizontal

        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        this.selectionRing = new THREE.Mesh(geometry, material);
        this.selectionRing.position.y = 0.15; // Higher above ground to avoid terrain occlusion
        this.selectionRing.visible = false;
        this.mesh.add(this.selectionRing);
    }

    /**
     * Set the building's selected state
     * @param {boolean} selected - Whether the building is selected
     */
    setSelected(selected) {
        this.isSelected = selected;
        if (this.selectionRing) {
            this.selectionRing.visible = selected;
        }
    }

    /**
     * Add an item to the production queue
     * @param {string} itemType - Type of item to produce
     * @returns {boolean} True if production was started
     */
    produceItem(itemType) {
        // Check if player has enough credits
        const cost = this.getItemCost(itemType);
        if (!this.player.removeCredits(cost)) {
            return false;
        }

        // Add to production queue
        this.productionQueue.push({
            type: itemType,
            progress: 0,
            total: this.getItemBuildTime(itemType)
        });

        // If not already producing something, start this immediately
        if (!this.isProducing) {
            this.startNextProduction();
        }

        return true;
    }

    /**
     * Start producing the next item in the queue
     */
    startNextProduction() {
        if (this.productionQueue.length === 0) {
            this.isProducing = false;
            this.currentProduction = null;
            return;
        }

        this.isProducing = true;
        this.currentProduction = this.productionQueue.shift();
        this.productionProgress = 0;
    }

    /**
     * Get the build time for an item
     * @param {string} itemType - Type of item
     * @returns {number} Build time in seconds
     */
    getItemBuildTime(itemType) {
        // Check if it's a building or unit
        if (this.game.buildingManager.buildingTypes[itemType]) {
            return this.game.buildingManager.buildingTypes[itemType].buildTime;
        } else if (this.game.unitManager.unitTypes[itemType]) {
            return this.game.unitManager.unitTypes[itemType].buildTime;
        }

        return 10; // Default build time
    }

    /**
     * Get the cost for an item
     * @param {string} itemType - Type of item
     * @returns {number} Cost in credits
     */
    getItemCost(itemType) {
        // Check if it's a building or unit
        if (this.game.buildingManager.buildingTypes[itemType]) {
            return this.game.buildingManager.buildingTypes[itemType].cost;
        } else if (this.game.unitManager.unitTypes[itemType]) {
            return this.game.unitManager.unitTypes[itemType].cost;
        }

        return 100; // Default cost
    }

    /**
     * Update production progress
     * @param {number} delta - Time delta
     */
    updateProduction(delta) {
        if (!this.isProducing || !this.currentProduction) return;

        // Check if we have enough power
        const hasPower = this.player.hasSufficientPower();

        // Slower production if low power
        let productionRate = hasPower ? 1 : 0.5;

        // Apply debug speed multiplier if fast construction mode is enabled
        if (this.game.inputManager.debugMode.fastConstruction) {
            productionRate *= this.game.inputManager.debugMode.speedMultiplier;
        }

        // Update progress
        this.productionProgress += delta * productionRate;

        // Check if production is complete
        if (this.productionProgress >= this.currentProduction.total) {
            this.completeProduction();
        }
    }

    /**
     * Complete the current production
     */
    completeProduction() {
        if (!this.currentProduction) return;

        const itemType = this.currentProduction.type;

        // Check if it's a building or unit
        if (this.game.buildingManager.buildingTypes[itemType]) {
            // TODO: Implement building placement logic
            console.log(`Building ${itemType} production complete`);
        } else if (this.game.unitManager.unitTypes[itemType]) {
            // Find a place to put the unit
            const spawnPoint = this.findUnitSpawnPoint();
            if (spawnPoint) {
                const unit = this.game.unitManager.createUnit(itemType, spawnPoint, this.player);
                if (unit) {
                    console.log(`Unit ${itemType} production complete`);
                    
                    // Update status display
                    if (this.game.uiManager.statusDisplay) {
                        const unitName = this.game.unitManager.unitTypes[itemType].name;
                        this.game.uiManager.statusDisplay.textContent = `${unitName} ready`;
                        this.game.uiManager.flashStatusMessage();
                    }
                }
            } else {
                // If no spawn point is available, refund the cost
                const cost = this.getItemCost(itemType);
                this.player.addCredits(cost);
                
                // Update status display
                if (this.game.uiManager.statusDisplay) {
                    this.game.uiManager.statusDisplay.textContent = `Cannot deploy unit - no space available`;
                }
                
                console.error(`No valid spawn point found for ${itemType}`);
            }
        }

        // Start next item in queue
        this.startNextProduction();
    }

    /**
     * Find a point to spawn a new unit
     * @returns {THREE.Vector3|null} Spawn position or null if no valid position
     */
    findUnitSpawnPoint() {
        console.log(`Finding spawn point for building at position: x=${this.position.x.toFixed(1)}, z=${this.position.z.toFixed(1)}`);
        
        const buildingWidth = this.buildingData.width;
        const buildingDepth = this.buildingData.depth;
        const halfWidth = Math.floor(buildingWidth / 2);
        const halfDepth = Math.floor(buildingDepth / 2);
        
        // Try positions around the building with increasing distance
        for (let distance = 1; distance <= 3; distance++) {
            // Try each direction at current distance
            const directions = [
                { x: 0, z: -distance },  // North
                { x: distance, z: 0 },   // East
                { x: 0, z: distance },   // South
                { x: -distance, z: 0 }   // West
            ];
            
            // Try each cardinal direction
            for (const dir of directions) {
                const tryPos = new THREE.Vector3(
                    this.position.x + dir.x * (halfWidth + 1),
                    0,
                    this.position.z + dir.z * (halfDepth + 1)
                );

                // Check if position is valid
                const gridPos = this.game.mapManager.worldToGrid(tryPos);
                console.log(`Trying position at distance ${distance}: x=${tryPos.x.toFixed(1)}, z=${tryPos.z.toFixed(1)} (grid: ${gridPos.x},${gridPos.z}) - walkable: ${this.game.mapManager.isWalkable(gridPos.x, gridPos.z)}`);
                
                if (this.game.mapManager.isWalkable(gridPos.x, gridPos.z)) {
                    console.log(`Found valid spawn point at: x=${tryPos.x.toFixed(1)}, z=${tryPos.z.toFixed(1)}`);
                    return tryPos;
                }
            }
            
            // Try diagonal positions at current distance
            const diagonals = [
                { x: distance, z: -distance },   // Northeast
                { x: distance, z: distance },    // Southeast
                { x: -distance, z: distance },   // Southwest
                { x: -distance, z: -distance }   // Northwest
            ];
            
            // Try each diagonal direction
            for (const dir of diagonals) {
                const tryPos = new THREE.Vector3(
                    this.position.x + dir.x * (halfWidth + 1),
                    0,
                    this.position.z + dir.z * (halfDepth + 1)
                );

                // Check if position is valid
                const gridPos = this.game.mapManager.worldToGrid(tryPos);
                console.log(`Trying diagonal position at distance ${distance}: x=${tryPos.x.toFixed(1)}, z=${tryPos.z.toFixed(1)} (grid: ${gridPos.x},${gridPos.z}) - walkable: ${this.game.mapManager.isWalkable(gridPos.x, gridPos.z)}`);
                
                if (this.game.mapManager.isWalkable(gridPos.x, gridPos.z)) {
                    console.log(`Found valid diagonal spawn point at: x=${tryPos.x.toFixed(1)}, z=${tryPos.z.toFixed(1)}`);
                    return tryPos;
                }
            }
        }

        console.log(`No valid spawn point found for building at position: x=${this.position.x.toFixed(1)}, z=${this.position.z.toFixed(1)}`);
        return null;
    }

    /**
     * Update construction progress
     * @param {number} delta - Time delta
     */
    updateConstruction(delta) {
        if (!this.isUnderConstruction) return;

        // Construction is faster with more power
        const hasPower = this.player.hasSufficientPower();
        let constructionRate = hasPower ? 0.2 : 0.1;

        // Apply debug speed multiplier if fast construction mode is enabled
        if (this.game.inputManager.debugMode.fastConstruction) {
            constructionRate *= this.game.inputManager.debugMode.speedMultiplier;
        }

        // Update progress
        this.constructionProgress += delta * constructionRate;

        // Update scaffolding and ghost mesh based on progress
        if (this.scaffolding) {
            const progressPercent = this.constructionProgress / this.buildingData.buildTime;

            // When construction is 50% complete, start showing the building underneath
            if (progressPercent >= 0.5 && !this.mesh.material.visible) {
                this.mesh.material.visible = true;
                
                // Fade in the main building
                this.mesh.material.opacity = 0;
                this.mesh.material.transparent = true;
            }
            
            // Gradually fade in the main building
            if (progressPercent > 0.5 && this.mesh.material.visible) {
                this.mesh.material.opacity = (progressPercent - 0.5) * 2;
            }

            // Fade out scaffolding as construction completes
            if (progressPercent > 0.5) {
                this.scaffolding.material.opacity = 1 - ((progressPercent - 0.5) * 2);
                this.scaffolding.material.transparent = true;
            }
            
            // Fade out ghost mesh as construction progresses
            if (this.ghostMesh) {
                this.ghostMesh.material.opacity = 0.3 * (1 - progressPercent);
            }
        }

        // Check if construction is complete
        if (this.constructionProgress >= this.buildingData.buildTime) {
            this.completeConstruction();
        }
    }

    /**
     * Complete construction
     */
    completeConstruction() {
        this.isUnderConstruction = false;
        
        // Show the main mesh
        this.mesh.visible = true;
        this.mesh.material.visible = true;

        // Remove scaffolding
        if (this.scaffolding) {
            this.mesh.remove(this.scaffolding);
            this.scaffolding = null;
        }
        
        // Remove ghost mesh
        if (this.ghostMesh) {
            this.mesh.remove(this.ghostMesh);
            this.ghostMesh = null;
        }

        // Add to player's power
        this.player.updatePower();

        console.log(`Building ${this.type} construction complete`);
    }

    /**
     * Update attacking behavior
     * @param {number} delta - Time delta
     */
    updateAttack(delta) {
        if (!this.buildingData.canAttack) return;

        // Find a target if we don't have one
        if (!this.target || this.target.health <= 0) {
            this.findTarget();
        }

        if (!this.target) return;

        // Check if target is in range
        const distance = this.position.distanceTo(this.target.position);
        if (distance > this.buildingData.attackRange) {
            this.target = null;
            return;
        }

        // Update turret rotation to face target
        if (this.turret) {
            const targetDirection = new THREE.Vector3()
                .subVectors(this.target.position, this.position)
                .normalize();

            const turretAngle = Math.atan2(targetDirection.x, targetDirection.z);
            this.turret.rotation.y = turretAngle;
        }

        // Fire if cooldown is ready
        if (this.attackCooldown <= 0) {
            this.fireAt(this.target);
            this.attackCooldown = this.buildingData.reloadTime;
        } else {
            this.attackCooldown -= delta;
        }
    }

    /**
     * Find a target to attack
     */
    findTarget() {
        // Find enemy units within range
        const enemies = this.game.unitManager.getUnitsInRadius(
            this.position,
            this.buildingData.attackRange
        ).filter(unit => unit.player !== this.player);

        if (enemies.length > 0) {
            // Target the closest enemy
            let closestEnemy = null;
            let closestDistance = Infinity;

            for (const enemy of enemies) {
                const distance = this.position.distanceTo(enemy.position);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestEnemy = enemy;
                }
            }

            this.target = closestEnemy;
        }
    }

    /**
     * Fire at a target
     * @param {Object} target - Target to fire at
     */
    fireAt(target) {
        if (!this.buildingData.canAttack) return;

        // Flash effect
        const flash = new THREE.PointLight(0xff7700, 5, 5);
        flash.position.copy(this.barrel.getWorldPosition(new THREE.Vector3()));
        this.game.scene.add(flash);

        // Remove flash after short delay
        setTimeout(() => {
            this.game.scene.remove(flash);
        }, 100);

        // Deal damage to target
        if (target.takeDamage) {
            target.takeDamage(this.buildingData.damage, this);
        }
    }

    /**
     * Take damage
     * @param {number} amount - Damage amount
     * @param {Object} source - Damage source
     */
    takeDamage(amount, source) {
        this.health -= amount;

        // Flash red
        if (this.mesh.material) {
            this.mesh.material.emissive = new THREE.Color(0xff0000);
            setTimeout(() => {
                this.mesh.material.emissive = new THREE.Color(0x000000);
            }, 200);
        }

        // Check for destruction
        if (this.health <= 0) {
            this.destroy();
        }
    }

    /**
     * Destroy the building
     */
    destroy() {
        // Explosion effect
        const explosion = new THREE.PointLight(0xff5500, 10, 8);
        explosion.position.copy(this.position);
        explosion.position.y = 1;
        this.game.scene.add(explosion);

        // Remove explosion after delay
        setTimeout(() => {
            this.game.scene.remove(explosion);
        }, 500);

        // Remove building
        this.game.buildingManager.removeBuilding(this);
    }

    /**
     * Update building
     * @param {number} delta - Time delta
     */
    update(delta) {
        // Update construction if still being built
        if (this.isUnderConstruction) {
            this.updateConstruction(delta);
        } else {
            // Update production
            this.updateProduction(delta);

            // Update attack behavior
            this.updateAttack(delta);
        }
    }

    /**
     * Clean up resources when building is removed
     */
    cleanup() {
        // Remove any event listeners, timers, etc.
    }
} 