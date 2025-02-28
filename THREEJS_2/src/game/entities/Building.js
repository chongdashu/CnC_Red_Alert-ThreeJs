import * as THREE from 'three';

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
        // Create a simple box geometry for now
        const geometry = new THREE.BoxGeometry(
            this.buildingData.width,
            this.buildingData.height,
            this.buildingData.depth
        );

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
        this.mesh.position.y = this.buildingData.height / 2;
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
     * Create construction scaffolding
     */
    createScaffolding() {
        // Create a wireframe version of the building that's slightly larger
        const scaffoldingGeometry = new THREE.BoxGeometry(
            this.buildingData.width + 0.2,
            this.buildingData.height + 0.2,
            this.buildingData.depth + 0.2
        );

        const scaffoldingMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true
        });

        this.scaffolding = new THREE.Mesh(scaffoldingGeometry, scaffoldingMaterial);
        this.scaffolding.position.y = this.buildingData.height / 2;

        // Add the scaffolding to the main mesh
        this.mesh.add(this.scaffolding);

        // Hide the main mesh during construction
        this.mesh.visible = false;
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
        const size = Math.max(this.buildingData.width, this.buildingData.depth) + 0.2;
        const geometry = new THREE.RingGeometry(size, size + 0.1, 16);
        geometry.rotateX(-Math.PI / 2); // Make it flat and horizontal

        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });

        this.selectionRing = new THREE.Mesh(geometry, material);
        this.selectionRing.position.y = 0.05; // Slightly above ground
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
        const productionRate = hasPower ? 1 : 0.5;

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
                }
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
        // Try positions around the building
        const directions = [
            { x: 0, z: -1 }, // North
            { x: 1, z: 0 },  // East
            { x: 0, z: 1 },  // South
            { x: -1, z: 0 }  // West
        ];

        const buildingWidth = this.buildingData.width;
        const buildingDepth = this.buildingData.depth;
        const halfWidth = Math.floor(buildingWidth / 2);
        const halfDepth = Math.floor(buildingDepth / 2);

        // Try each direction
        for (const dir of directions) {
            const tryPos = new THREE.Vector3(
                this.position.x + dir.x * (halfWidth + 1),
                0,
                this.position.z + dir.z * (halfDepth + 1)
            );

            // Check if position is valid
            const gridPos = this.game.mapManager.worldToGrid(tryPos);
            if (this.game.mapManager.isWalkable(gridPos.x, gridPos.z)) {
                return tryPos;
            }
        }

        // If no direct position works, try diagonal positions
        const diagonals = [
            { x: 1, z: -1 },  // Northeast
            { x: 1, z: 1 },   // Southeast
            { x: -1, z: 1 },  // Southwest
            { x: -1, z: -1 }  // Northwest
        ];

        for (const dir of diagonals) {
            const tryPos = new THREE.Vector3(
                this.position.x + dir.x * (halfWidth + 1),
                0,
                this.position.z + dir.z * (halfDepth + 1)
            );

            // Check if position is valid
            const gridPos = this.game.mapManager.worldToGrid(tryPos);
            if (this.game.mapManager.isWalkable(gridPos.x, gridPos.z)) {
                return tryPos;
            }
        }

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
        const constructionRate = hasPower ? 0.2 : 0.1;

        // Update progress
        this.constructionProgress += delta * constructionRate;

        // Update scaffolding scale based on progress
        if (this.scaffolding) {
            const progressPercent = this.constructionProgress / this.buildingData.buildTime;

            // When construction is 50% complete, show the building underneath
            if (progressPercent >= 0.5 && !this.mesh.visible) {
                this.mesh.visible = true;
            }

            // Fade out scaffolding as construction completes
            if (progressPercent > 0.5) {
                this.scaffolding.material.opacity = 1 - ((progressPercent - 0.5) * 2);
                this.scaffolding.material.transparent = true;
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
        this.mesh.visible = true;

        // Remove scaffolding
        if (this.scaffolding) {
            this.mesh.remove(this.scaffolding);
            this.scaffolding = null;
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