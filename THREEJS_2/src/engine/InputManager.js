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

        // UI event listeners
        this.setupUIListeners();

        // Create selection box
        this.createSelectionBox();
    }

    /**
     * Set up UI event listeners
     */
    setupUIListeners() {
        // Unit production buttons
        const unitButtons = document.querySelectorAll('.unit-button');
        unitButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const unitType = button.dataset.unit;
                this.handleUnitProduction(unitType);
            });
        });
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
                this.game.selectEntity(null);
            }
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
            // Check if we're clicking on an enemy
            if (intersect && intersect.object.userData.entity &&
                intersect.object.userData.entity.player !== this.game.currentPlayer) {
                // Attack order
                for (const entity of this.game.selectedEntities) {
                    if (entity.attackTarget) {
                        entity.attackTarget(intersect.object.userData.entity);
                    }
                }
            } else {
                // Move order
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
                // Deselect everything
                this.game.selectEntity(null);
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
                }
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

        // Add units
        this.game.unitManager.units.forEach(unit => {
            if (unit.mesh) interactiveObjects.push(unit.mesh);
        });

        // Add buildings
        this.game.buildingManager.buildings.forEach(building => {
            if (building.mesh) interactiveObjects.push(building.mesh);
        });

        const intersects = this.raycaster.intersectObjects(interactiveObjects);

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
     * Handle unit production request
     * @param {string} unitType - Type of unit to produce
     */
    handleUnitProduction(unitType) {
        // Check if we have a selected production building
        if (this.game.selectedEntities.length === 1) {
            const entity = this.game.selectedEntities[0];

            // Check if this is a building that can produce units
            if (entity.produceItem && entity.buildOptions && entity.buildOptions.includes(unitType)) {
                entity.produceItem(unitType);
                document.getElementById('status').textContent = `Producing ${unitType}...`;
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

        // Remove UI listeners
        const unitButtons = document.querySelectorAll('.unit-button');
        unitButtons.forEach(button => {
            button.removeEventListener('click', this.handleUnitProduction);
        });
    }
} 