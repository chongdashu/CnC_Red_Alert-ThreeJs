import * as THREE from 'three';

/**
 * Represents a unit in the game
 */
export class Unit {
    /**
     * Create a new unit
     * @param {Object} game - Reference to the main game
     * @param {string} type - Unit type
     * @param {THREE.Vector3} position - Initial position
     * @param {Object} player - Owning player
     */
    constructor(game, type, position, player) {
        this.game = game;
        this.type = type;
        this.player = player;
        this.position = position.clone();

        // Get unit type data
        this.unitData = this.game.unitManager.unitTypes[type];

        // Unit properties
        this.health = this.unitData.health;
        this.maxHealth = this.unitData.health;
        this.speed = this.unitData.speed;
        this.turnSpeed = this.unitData.turnSpeed;
        this.isSelected = false;
        this.isMoving = false;
        this.isAttacking = false;
        this.isHarvesting = false;

        // Movement properties
        this.targetPosition = null;
        this.pathToTarget = [];
        this.currentRotation = 0;
        this.targetRotation = 0;

        // Combat properties
        this.target = null;
        this.attackCooldown = 0;

        // Harvester properties
        this.cargo = 0;
        this.maxCargo = this.unitData.cargoCapacity || 0;

        // Create mesh
        this.createMesh();

        // Selection indicator
        this.createSelectionIndicator();
    }

    /**
     * Create the unit's 3D mesh
     */
    createMesh() {
        // Create a simple box geometry for now
        const geometry = new THREE.BoxGeometry(
            this.unitData.width,
            this.unitData.height,
            this.unitData.depth
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
        this.mesh.position.y = this.unitData.height / 2;
        this.mesh.name = `unit_${this.type}_${this.player.id}`;

        // Add custom properties
        this.mesh.userData.entity = this;

        // Add to scene
        this.game.scene.add(this.mesh);

        // For units with turrets, create a separate turret mesh
        if (this.unitData.canAttack) {
            this.createTurret();
        }
    }

    /**
     * Create a turret for attackable units
     */
    createTurret() {
        const turretGeometry = new THREE.BoxGeometry(0.5, 0.25, 0.8);
        const turretMaterial = new THREE.MeshStandardMaterial({
            color: this.player.getColor(),
            roughness: 0.6,
            metalness: 0.5
        });

        this.turret = new THREE.Mesh(turretGeometry, turretMaterial);
        this.turret.castShadow = true;
        this.turret.position.y = 0.15;
        this.turret.name = `turret_${this.type}_${this.player.id}`;

        // Create gun barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
        barrelGeometry.rotateZ(Math.PI / 2);
        const barrelMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.8,
            metalness: 0.6
        });

        this.barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        this.barrel.position.z = 0.3;
        this.barrel.position.y = 0;

        this.turret.add(this.barrel);
        this.mesh.add(this.turret);
    }

    /**
     * Create selection indicator
     */
    createSelectionIndicator() {
        const size = Math.max(this.unitData.width, this.unitData.depth) + 0.2;
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
     * Set the unit's selected state
     * @param {boolean} selected - Whether the unit is selected
     */
    setSelected(selected) {
        this.isSelected = selected;
        if (this.selectionRing) {
            this.selectionRing.visible = selected;
        }
    }

    /**
     * Command the unit to move to a position
     * @param {THREE.Vector3} position - Target position
     */
    moveTo(position) {
        // Clear previous targets
        this.target = null;
        this.isAttacking = false;
        this.isHarvesting = false;

        // Set target position
        this.targetPosition = position.clone();
        this.isMoving = true;

        // Calculate rotation to target
        this.calculateTargetRotation();

        // TODO: Path finding
        this.pathToTarget = [this.targetPosition];
    }

    /**
     * Command the unit to attack a target
     * @param {Object} target - Target entity
     */
    attackTarget(target) {
        if (!this.unitData.canAttack) return;

        this.target = target;
        this.isAttacking = true;
        this.targetPosition = target.position.clone();
        this.isMoving = true;

        // Calculate rotation to target
        this.calculateTargetRotation();
    }

    /**
     * Command the unit to harvest resources
     * @param {Object} resource - Resource to harvest
     */
    harvestResource(resource) {
        if (!this.unitData.canHarvest) return;

        this.targetResource = resource;
        this.isHarvesting = true;
        this.targetPosition = resource.position.clone();
        this.isMoving = true;

        // Calculate rotation to target
        this.calculateTargetRotation();
    }

    /**
     * Calculate rotation to face target
     */
    calculateTargetRotation() {
        if (!this.targetPosition) return;

        const direction = new THREE.Vector2(
            this.targetPosition.x - this.position.x,
            this.targetPosition.z - this.position.z
        );

        // Calculate angle in radians
        this.targetRotation = Math.atan2(direction.x, direction.y);
    }

    /**
     * Update unit position
     * @param {number} delta - Time delta
     */
    updateMovement(delta) {
        if (!this.isMoving) return;

        // Rotate towards target rotation
        const rotationDifference = this.targetRotation - this.currentRotation;

        // Normalize the difference to -PI to PI
        let normalizedDifference = rotationDifference;
        while (normalizedDifference > Math.PI) normalizedDifference -= Math.PI * 2;
        while (normalizedDifference < -Math.PI) normalizedDifference += Math.PI * 2;

        // Calculate rotation step
        const rotationStep = this.turnSpeed * delta;

        // Apply rotation
        if (Math.abs(normalizedDifference) < rotationStep) {
            this.currentRotation = this.targetRotation;
        } else if (normalizedDifference > 0) {
            this.currentRotation += rotationStep;
        } else {
            this.currentRotation -= rotationStep;
        }

        // Apply rotation to mesh
        this.mesh.rotation.y = this.currentRotation;

        // Check if we're facing the right direction
        const isFacingTarget = Math.abs(normalizedDifference) < 0.1;

        // Move towards target if facing the right direction
        if (isFacingTarget && this.targetPosition) {
            const distance = this.position.distanceTo(this.targetPosition);

            // Check if we've reached the target
            if (distance < 0.1) {
                this.isMoving = false;
                return;
            }

            // Move towards target
            const moveDirection = new THREE.Vector3(
                this.targetPosition.x - this.position.x,
                0,
                this.targetPosition.z - this.position.z
            ).normalize();

            // Calculate move distance
            const moveDistance = Math.min(this.speed * delta, distance);

            // Apply movement
            const movement = moveDirection.multiplyScalar(moveDistance);
            this.position.add(movement);

            // Update mesh position
            this.mesh.position.copy(this.position);
            this.mesh.position.y = this.unitData.height / 2;
        }
    }

    /**
     * Update attacking behavior
     * @param {number} delta - Time delta
     */
    updateAttack(delta) {
        if (!this.isAttacking || !this.target) return;

        // Check if target is in range
        const distance = this.position.distanceTo(this.target.position);

        // If not in range, approach target
        if (distance > this.unitData.attackRange) {
            this.targetPosition = this.target.position.clone();
            this.calculateTargetRotation();
            this.isMoving = true;
            return;
        }

        // If in range, stop and attack
        this.isMoving = false;

        // Update turret rotation to face target
        if (this.turret) {
            const targetDirection = new THREE.Vector3()
                .subVectors(this.target.position, this.position)
                .normalize();

            const turretAngle = Math.atan2(targetDirection.x, targetDirection.z);
            this.turret.rotation.y = turretAngle - this.currentRotation;
        }

        // Fire if cooldown is ready
        if (this.attackCooldown <= 0) {
            this.fireAt(this.target);
            this.attackCooldown = this.unitData.reloadTime;
        } else {
            this.attackCooldown -= delta;
        }
    }

    /**
     * Fire at a target
     * @param {Object} target - Target to fire at
     */
    fireAt(target) {
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
            target.takeDamage(this.unitData.damage, this);
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
     * Destroy the unit
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

        // Remove unit
        this.game.unitManager.removeUnit(this);
    }

    /**
     * Update unit
     * @param {number} delta - Time delta
     */
    update(delta) {
        // Update movement
        this.updateMovement(delta);

        // Update attack behavior
        this.updateAttack(delta);

        // Update harvesting (if applicable)
        if (this.isHarvesting) {
            this.updateHarvesting(delta);
        }
    }

    /**
     * Update harvesting behavior
     * @param {number} delta - Time delta
     */
    updateHarvesting(delta) {
        if (!this.unitData.canHarvest || !this.targetResource) return;

        // Check if we've reached the resource
        const distance = this.position.distanceTo(this.targetResource.position);

        // If close enough to harvest
        if (distance < 1.5 && this.cargo < this.maxCargo) {
            // Extract resources
            const gridCoords = this.game.mapManager.worldToGrid(this.targetResource.position);
            const extracted = this.game.mapManager.extractResource(
                gridCoords.x,
                gridCoords.z,
                this.unitData.harvestAmount * delta
            );

            // Add to cargo
            this.cargo += extracted.amount;

            // Update visual indicator of cargo
            if (this.cargo > 0) {
                if (!this.cargoMesh) {
                    const geometry = new THREE.BoxGeometry(0.6, 0.3, 0.6);
                    const material = new THREE.MeshStandardMaterial({ color: 0xffd700 });
                    this.cargoMesh = new THREE.Mesh(geometry, material);
                    this.cargoMesh.position.y = this.unitData.height;
                    this.mesh.add(this.cargoMesh);
                }

                // Scale cargo mesh based on cargo level
                const scale = this.cargo / this.maxCargo;
                this.cargoMesh.scale.set(scale, scale, scale);
            }

            // If full, find a refinery
            if (this.cargo >= this.maxCargo) {
                this.returnToRefinery();
            }

            // If resource depleted, find another
            if (extracted.amount === 0) {
                this.findNearestResource();
            }
        }
    }

    /**
     * Return to nearest refinery
     */
    returnToRefinery() {
        // TODO: Implement refinery return logic
        console.log("Harvester returning to refinery with cargo:", this.cargo);

        // For demo, just convert cargo to credits directly
        this.player.addCredits(this.cargo);
        this.cargo = 0;

        // Remove cargo visual
        if (this.cargoMesh) {
            this.mesh.remove(this.cargoMesh);
            this.cargoMesh = null;
        }

        // Find a new resource
        this.findNearestResource();
    }

    /**
     * Find nearest resource
     */
    findNearestResource() {
        // Find nearest resource
        let nearestResource = null;
        let nearestDistance = Infinity;

        for (const resource of this.game.mapManager.resources) {
            const distance = this.position.distanceTo(
                this.game.mapManager.gridToWorld(resource.x, resource.z)
            );

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestResource = resource;
            }
        }

        if (nearestResource) {
            this.targetResource = nearestResource;
            this.targetPosition = this.game.mapManager.gridToWorld(
                nearestResource.x,
                nearestResource.z
            );
            this.calculateTargetRotation();
            this.isMoving = true;
        } else {
            this.isHarvesting = false;
        }
    }

    /**
     * Clean up resources when unit is removed
     */
    cleanup() {
        // Remove any event listeners, timers, etc.
    }
} 