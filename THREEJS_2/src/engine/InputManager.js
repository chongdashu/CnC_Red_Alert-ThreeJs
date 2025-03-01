import * as THREE from 'three';

/**
 * Manages user input for the game
 */
export class InputManager {
    /**
     * Create a new InputManager
     * @param {Object} game - Reference to the main game
     */
    constructor(game) {
        this.game = game;

        // Input state
        this.mousePosition = new THREE.Vector2();
        this.isMouseDown = false;
        this.isDragging = false;
        this.dragStart = new THREE.Vector2();
        this.dragEnd = new THREE.Vector2();
        this.selectionBox = null;
        this.controlsEnabled = true;
        
        // Hover state
        this.hoveredEntity = null;
        this.actionIndicator = null;

        // Debug settings
        this.debugMode = {
            fastConstruction: false,
            speedMultiplier: 50 // Construction will be 10x faster when enabled
        };

        // Raycaster for picking objects
        this.raycaster = new THREE.Raycaster();

        // Bind event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onRightClick = this.onRightClick.bind(this);

        // Add event listeners
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('contextmenu', this.onRightClick);

        // Create selection box
        this.createSelectionBox();
    }

    /**
     * Create selection box visual
     */
    createSelectionBox() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));

        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 1
        });

        this.selectionBox = new THREE.Line(geometry, material);
        this.selectionBox.visible = false;
        this.game.scene.add(this.selectionBox);
    }

    /**
     * Clear all UI elements and deselect entities
     */
    clearSelectionAndUI() {
        // Deselect all entities
        this.game.selectEntity(null);
        this.game.uiManager.updateSelection(null);

        // Hide all production buttons
        const unitButtons = document.querySelectorAll('.unit-button');
        unitButtons.forEach(button => {
            button.style.display = 'none';
        });

        const buildingButtons = document.querySelectorAll('.building-button');
        buildingButtons.forEach(button => {
            button.style.display = 'none';
        });

        // Hide action buttons
        if (this.game.uiManager.actionButtons) {
            this.game.uiManager.actionButtons.style.display = 'none';
        }

        // Reset status display
        if (this.game.uiManager.statusDisplay) {
            this.game.uiManager.statusDisplay.textContent = 'Ready';
        }
    }

    /**
     * Handle mouse down event
     * @param {MouseEvent} event - Mouse event
     */
    onMouseDown(event) {
        // Only handle left mouse button
        if (event.button !== 0) return;

        // Don't handle if clicking on UI
        if (event.target.closest('#ui') || event.target.closest('#minimap') ||
            event.target.closest('#resources')) {
            return;
        }

        this.isMouseDown = true;
        this.isDragging = false;

        // Disable camera controls during selection
        this.controlsEnabled = false;
        this.game.controls.enabled = false;

        // Record start position
        this.dragStart.x = event.clientX;
        this.dragStart.y = event.clientY;
        this.dragEnd.copy(this.dragStart);

        // Try to select object at cursor
        this.updateMousePosition(event);
        const intersect = this.getIntersectedObject();

        if (intersect) {
            const entity = intersect.object.userData.entity;
            if (entity && entity.player === this.game.currentPlayer) {
                this.game.selectEntity(entity);
            } else {
                // Clicked on enemy or non-entity object, deselect
                this.clearSelectionAndUI();
            }
        } else {
            // Clicked on empty terrain, deselect
            this.clearSelectionAndUI();
        }
    }

    /**
     * Handle mouse move event
     * @param {MouseEvent} event - Mouse event
     */
    onMouseMove(event) {
        // Update mouse position
        this.updateMousePosition(event);

        // Update selection box if dragging
        if (this.isMouseDown) {
            this.isDragging = true;
            this.dragEnd.x = event.clientX;
            this.dragEnd.y = event.clientY;

            this.updateSelectionBox();
        } else {
            // Check for entities under cursor for hover effects
            this.updateHoverState();
        }
    }

    /**
     * Handle mouse up event
     * @param {MouseEvent} event - Mouse event
     */
    onMouseUp(event) {
        // Only handle left mouse button
        if (event.button !== 0) return;

        if (this.isMouseDown) {
            // Finalize drag selection if we were dragging
            if (this.isDragging) {
                this.finalizeSelection();
            }

            this.isMouseDown = false;
            this.isDragging = false;
            this.selectionBox.visible = false;

            // Re-enable camera controls
            this.controlsEnabled = true;
            this.game.controls.enabled = true;
        }
    }

    /**
     * Handle right click event
     * @param {MouseEvent} event - Mouse event
     */
    onRightClick(event) {
        event.preventDefault();

        // Don't handle if clicking on UI
        if (event.target.closest('#ui') || event.target.closest('#minimap') ||
            event.target.closest('#resources')) {
            return;
        }

        // Update mouse position
        this.updateMousePosition(event);

        // Check what's under the cursor
        const intersect = this.getIntersectedObject();

        // If we have selected units, issue orders
        if (this.game.selectedEntities.length > 0) {
            // Check if we're clicking on an entity
            if (intersect && intersect.object.userData.entity) {
                const targetEntity = intersect.object.userData.entity;
                
                // If it's an enemy entity
                if (targetEntity.player !== this.game.currentPlayer) {
                    // Check if we have engineers selected
                    const engineers = this.game.selectedEntities.filter(
                        entity => entity.type === 'engineer' && entity.unitData.canCapture
                    );
                    
                    // If we have engineers and the target is a building, try to capture it
                    if (engineers.length > 0 && targetEntity.buildingData) {
                        for (const engineer of engineers) {
                            engineer.captureBuilding(targetEntity);
                        }
                    } 
                    // Otherwise issue attack orders for combat units
                    else {
                        for (const entity of this.game.selectedEntities) {
                            if (entity.attackTarget) {
                                entity.attackTarget(targetEntity);
                            }
                        }
                    }
                } 
                // If it's a friendly entity, just move to it
                else {
                    const targetPoint = targetEntity.position.clone();
                    for (const entity of this.game.selectedEntities) {
                        if (entity.moveTo) {
                            entity.moveTo(targetPoint);
                        }
                    }
                }
            } else {
                // Move order to empty ground
                const targetPoint = this.getGroundPosition(this.mousePosition);
                if (targetPoint) {
                    for (const entity of this.game.selectedEntities) {
                        if (entity.moveTo) {
                            entity.moveTo(targetPoint);
                        }
                    }
                }
            }
        }
    }

    /**
     * Handle key down event
     * @param {KeyboardEvent} event - Keyboard event
     */
    onKeyDown(event) {
        // Handle keyboard shortcuts
        switch (event.key) {
            case 'Escape':
                // Deselect everything and clear UI
                this.clearSelectionAndUI();
                break;

            case 'Delete':
                // Sell/destroy selected entity
                if (this.game.selectedEntities.length > 0) {
                    for (const entity of this.game.selectedEntities) {
                        if (entity.destroy) {
                            entity.destroy();
                        }
                    }
                    this.game.selectedEntities = [];
                    this.game.uiManager.updateSelection(null);
                }
                break;

            case 'F':
            case 'f':
                // Toggle fast construction mode
                this.debugMode.fastConstruction = !this.debugMode.fastConstruction;
                const status = this.debugMode.fastConstruction ? 'ENABLED' : 'DISABLED';
                const multiplier = this.debugMode.fastConstruction ? `(${this.debugMode.speedMultiplier}x)` : '';
                this.game.uiManager.statusDisplay.textContent = `Fast construction mode ${status} ${multiplier}`;

                // Flash the status message to make it more noticeable
                this.game.uiManager.flashStatusMessage();

                console.log(`Fast construction mode ${status} - Speed multiplier: ${this.debugMode.speedMultiplier}x`);
                break;

            // Add more shortcuts as needed
        }
    }

    /**
     * Update mouse position in normalized device coordinates
     * @param {MouseEvent} event - Mouse event
     */
    updateMousePosition(event) {
        this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    /**
     * Get object under the cursor
     * @returns {Object|null} Intersection or null if none
     */
    getIntersectedObject() {
        this.raycaster.setFromCamera(this.mousePosition, this.game.camera);

        // Get all interactive objects (units, buildings)
        const interactiveObjects = [];

        // Add units with their selection helpers
        this.game.unitManager.units.forEach(unit => {
            if (unit.mesh) {
                // If the unit doesn't have a selection helper, create one
                if (!unit.selectionHelper) {
                    // Create a slightly larger invisible box for easier selection
                    const helperSize = Math.max(unit.unitData.width, unit.unitData.depth) * 1.5;
                    const helperGeometry = new THREE.BoxGeometry(
                        helperSize,
                        unit.unitData.height * 1.5,
                        helperSize
                    );
                    const helperMaterial = new THREE.MeshBasicMaterial({
                        visible: false,
                        transparent: true,
                        opacity: 0
                    });
                    
                    unit.selectionHelper = new THREE.Mesh(helperGeometry, helperMaterial);
                    unit.selectionHelper.position.y = unit.unitData.height / 2;
                    unit.mesh.add(unit.selectionHelper);
                    
                    // Link the helper to the unit for identification
                    unit.selectionHelper.userData.entity = unit;
                }
                
                // Add both the unit mesh and its selection helper
                interactiveObjects.push(unit.mesh);
                interactiveObjects.push(unit.selectionHelper);
            }
        });

        // Add buildings
        this.game.buildingManager.buildings.forEach(building => {
            if (building.mesh) {
                // Add the main building mesh
                interactiveObjects.push(building.mesh);
                
                // For buildings under construction, also add the scaffolding and ghost mesh
                // to make them selectable even when the main mesh is not visible
                if (building.isUnderConstruction) {
                    if (building.scaffolding) {
                        building.scaffolding.userData.entity = building;
                        interactiveObjects.push(building.scaffolding);
                    }
                    if (building.ghostMesh) {
                        building.ghostMesh.userData.entity = building;
                        interactiveObjects.push(building.ghostMesh);
                    }
                }
            }
        });

        const intersects = this.raycaster.intersectObjects(interactiveObjects, true);

        return intersects.length > 0 ? intersects[0] : null;
    }

    /**
     * Get ground position under the cursor
     * @param {THREE.Vector2} screenPosition - Normalized screen position
     * @returns {THREE.Vector3|null} Ground position or null if none
     */
    getGroundPosition(screenPosition) {
        this.raycaster.setFromCamera(screenPosition, this.game.camera);

        // Create an invisible plane at y=0 to intersect with
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();

        // Find the intersection point
        const intersects = this.raycaster.ray.intersectPlane(groundPlane, target);

        return intersects ? target : null;
    }

    /**
     * Update selection box visuals
     */
    updateSelectionBox() {
        if (!this.isDragging) return;

        // Calculate box corners in 3D space
        const startPos = this.getGroundPosition(new THREE.Vector2(
            (this.dragStart.x / window.innerWidth) * 2 - 1,
            -(this.dragStart.y / window.innerHeight) * 2 + 1
        ));

        const endPos = this.getGroundPosition(new THREE.Vector2(
            (this.dragEnd.x / window.innerWidth) * 2 - 1,
            -(this.dragEnd.y / window.innerHeight) * 2 + 1
        ));

        if (!startPos || !endPos) return;

        // Create box vertices
        const minX = Math.min(startPos.x, endPos.x);
        const maxX = Math.max(startPos.x, endPos.x);
        const minZ = Math.min(startPos.z, endPos.z);
        const maxZ = Math.max(startPos.z, endPos.z);

        const vertices = [
            minX, 0.1, minZ,
            maxX, 0.1, minZ,
            maxX, 0.1, maxZ,
            minX, 0.1, maxZ,
            minX, 0.1, minZ
        ];

        // Update geometry
        this.selectionBox.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(vertices, 3)
        );
        this.selectionBox.geometry.attributes.position.needsUpdate = true;
        this.selectionBox.visible = true;
    }

    /**
     * Finalize box selection
     */
    finalizeSelection() {
        if (!this.isDragging) return;

        // Calculate selection box in 3D space
        const startPos = this.getGroundPosition(new THREE.Vector2(
            (this.dragStart.x / window.innerWidth) * 2 - 1,
            -(this.dragStart.y / window.innerHeight) * 2 + 1
        ));

        const endPos = this.getGroundPosition(new THREE.Vector2(
            (this.dragEnd.x / window.innerWidth) * 2 - 1,
            -(this.dragEnd.y / window.innerHeight) * 2 + 1
        ));

        if (!startPos || !endPos) return;

        // Find units within selection box
        const minX = Math.min(startPos.x, endPos.x);
        const maxX = Math.max(startPos.x, endPos.x);
        const minZ = Math.min(startPos.z, endPos.z);
        const maxZ = Math.max(startPos.z, endPos.z);

        const selectedEntities = [];

        // Check units
        for (const unit of this.game.unitManager.units) {
            if (unit.player === this.game.currentPlayer &&
                unit.position.x >= minX && unit.position.x <= maxX &&
                unit.position.z >= minZ && unit.position.z <= maxZ) {
                selectedEntities.push(unit);
            }
        }

        // Check buildings
        for (const building of this.game.buildingManager.buildings) {
            if (building.player === this.game.currentPlayer &&
                building.position.x >= minX && building.position.x <= maxX &&
                building.position.z >= minZ && building.position.z <= maxZ) {
                selectedEntities.push(building);
            }
        }

        // Select all found entities
        if (selectedEntities.length > 0) {
            // Deselect current selection
            this.game.selectedEntities.forEach(e => e.setSelected(false));
            this.game.selectedEntities = [];

            // Select new entities
            selectedEntities.forEach(e => {
                e.setSelected(true);
                this.game.selectedEntities.push(e);
            });

            // Update UI
            if (selectedEntities.length === 1) {
                this.game.uiManager.updateSelection(selectedEntities[0]);
            } else {
                this.game.uiManager.updateSelection(null, selectedEntities);
            }
        }
    }

    /**
     * Update hover state and action indicators
     */
    updateHoverState() {
        // Only show action indicators if we have selected units
        if (this.game.selectedEntities.length === 0) {
            this.clearActionIndicator();
            document.body.style.cursor = 'default';
            return;
        }

        // Check what's under the cursor
        const intersect = this.getIntersectedObject();
        
        // If we're hovering over an entity
        if (intersect && intersect.object.userData.entity) {
            const targetEntity = intersect.object.userData.entity;
            
            // If it's an enemy entity
            if (targetEntity.player !== this.game.currentPlayer) {
                // Check if we have engineers selected and the target is a building
                const hasEngineers = this.game.selectedEntities.some(
                    entity => entity.type === 'engineer' && entity.unitData && entity.unitData.canCapture
                );
                
                const isTargetBuilding = targetEntity.buildingData !== undefined;
                
                // Check if we have combat units selected
                const hasCombatUnits = this.game.selectedEntities.some(
                    entity => entity.attackTarget !== undefined
                );
                
                // Show appropriate action indicator
                if (hasEngineers && isTargetBuilding) {
                    this.showActionIndicator(targetEntity, 'capture');
                    document.body.style.cursor = 'crosshair';
                    return;
                } else if (hasCombatUnits) {
                    this.showActionIndicator(targetEntity, 'attack');
                    document.body.style.cursor = 'crosshair';
                    return;
                }
            }
        }
        
        // If we get here, no action is possible
        this.clearActionIndicator();
        document.body.style.cursor = 'default';
    }
    
    /**
     * Show an action indicator for the target entity
     * @param {Object} targetEntity - The entity to show the indicator for
     * @param {string} actionType - The type of action ('attack' or 'capture')
     */
    showActionIndicator(targetEntity, actionType) {
        // If we're already showing an indicator for this entity, don't recreate it
        if (this.hoveredEntity === targetEntity && this.actionIndicator) {
            return;
        }
        
        // Clear any existing indicator
        this.clearActionIndicator();
        
        // Set the new hovered entity
        this.hoveredEntity = targetEntity;
        
        // Create a ring indicator
        const size = Math.max(
            targetEntity.buildingData ? targetEntity.buildingData.width : targetEntity.unitData.width,
            targetEntity.buildingData ? targetEntity.buildingData.depth : targetEntity.unitData.depth
        ) + 0.5;
        
        const geometry = new THREE.RingGeometry(size, size + 0.3, 32);
        geometry.rotateX(-Math.PI / 2); // Make it flat and horizontal
        
        // Red for attack, blue for capture
        const color = actionType === 'capture' ? 0x00aaff : 0xff0000;
        
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        this.actionIndicator = new THREE.Mesh(geometry, material);
        this.actionIndicator.position.copy(targetEntity.position);
        this.actionIndicator.position.y = 0.2; // Slightly above ground
        
        // Add to scene
        this.game.scene.add(this.actionIndicator);
        
        // Add pulsing animation
        this.actionIndicator.userData.pulseTime = 0;
        this.actionIndicator.userData.actionType = actionType;
    }
    
    /**
     * Clear the action indicator
     */
    clearActionIndicator() {
        if (this.actionIndicator) {
            this.game.scene.remove(this.actionIndicator);
            this.actionIndicator = null;
        }
        this.hoveredEntity = null;
        document.body.style.cursor = 'default';
    }

    /**
     * Update the input manager
     * @param {number} delta - Time delta
     */
    update(delta) {
        // Update action indicator animation if it exists
        if (this.actionIndicator) {
            this.actionIndicator.userData.pulseTime += delta;
            
            // Pulse the opacity based on time
            const pulseSpeed = 5;
            const opacity = 0.4 + 0.3 * Math.sin(this.actionIndicator.userData.pulseTime * pulseSpeed);
            this.actionIndicator.material.opacity = opacity;
            
            // For attack indicators, also pulse the size
            if (this.actionIndicator.userData.actionType === 'attack') {
                const scale = 1 + 0.1 * Math.sin(this.actionIndicator.userData.pulseTime * pulseSpeed);
                this.actionIndicator.scale.set(scale, scale, scale);
            }
        }
    }

    /**
     * Clean up resources when the manager is destroyed
     */
    cleanup() {
        // Remove event listeners
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('contextmenu', this.onRightClick);

        // Remove selection box
        if (this.selectionBox) {
            this.game.scene.remove(this.selectionBox);
        }
        
        // Remove action indicator
        this.clearActionIndicator();
    }
} 