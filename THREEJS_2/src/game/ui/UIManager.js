import * as THREE from 'three';

/**
 * Manages UI elements and updates
 */
export class UIManager {
    /**
     * Create a new UIManager
     * @param {Object} game - Reference to the main game
     */
    constructor(game) {
        this.game = game;

        // UI elements references
        this.resourcesDisplay = null;
        this.statusDisplay = null;
        this.minimapDisplay = null;
        this.unitProduction = null;
        this.actionButtons = null;
        this.deployButton = null;

        // Current selection info
        this.selectedEntity = null;
        this.selectedEntities = [];

        // Minimap data
        this.minimapContext = null;
        this.minimapScale = 0;
        this.minimapOffsetX = 0;
        this.minimapOffsetZ = 0;
    }

    /**
     * Initialize the UI
     */
    init() {
        // Get references to UI elements
        this.resourcesDisplay = document.getElementById('resources');
        this.statusDisplay = document.getElementById('status');
        this.minimapDisplay = document.getElementById('minimap');
        this.unitProduction = document.getElementById('unit-production');
        this.actionButtons = document.getElementById('action-buttons');
        this.deployButton = document.getElementById('deploy-button');

        // Hide all production buttons by default
        const unitButtons = document.querySelectorAll('.unit-button');
        unitButtons.forEach(button => {
            button.style.display = 'none';
        });

        // Hide all building buttons by default
        const buildingButtons = document.querySelectorAll('.building-button');
        buildingButtons.forEach(button => {
            button.style.display = 'none';
        });

        // Initialize minimap
        this.initMinimap();

        // Set up action button handlers
        this.setupActionButtons();

        // Set up building button handlers
        this.setupBuildingButtons();
    }

    /**
     * Set up action button event handlers
     */
    setupActionButtons() {
        if (this.deployButton) {
            this.deployButton.addEventListener('click', () => {
                if (this.selectedEntity && this.selectedEntity.type === 'mcv') {
                    this.deployMCV(this.selectedEntity);
                }
            });
        }
    }

    /**
     * Set up building button event handlers
     */
    setupBuildingButtons() {
        const buildingButtons = document.querySelectorAll('.building-button');
        buildingButtons.forEach(button => {
            button.addEventListener('click', () => {
                const buildingType = button.dataset.building;
                if (this.selectedEntity && this.selectedEntity.buildOptions &&
                    this.selectedEntity.buildOptions.includes(buildingType)) {
                    this.handleBuildingConstruction(buildingType);
                }
            });
        });
    }

    /**
     * Deploy an MCV to create a construction yard
     * @param {Object} mcv - The MCV unit to deploy
     */
    deployMCV(mcv) {
        // Use the unit's deploy method
        const success = mcv.deploy();

        if (success) {
            // Update status
            this.statusDisplay.textContent = 'Construction Yard deployed';
        } else {
            // Update status with error
            this.statusDisplay.textContent = 'Cannot deploy here - invalid location';
        }
    }

    /**
     * Handle building construction request
     * @param {string} buildingType - Type of building to construct
     */
    handleBuildingConstruction(buildingType) {
        if (!this.selectedEntity || !this.selectedEntity.buildOptions) return;

        // Check if player has enough credits
        const buildingData = this.game.buildingManager.buildingTypes[buildingType];
        if (!buildingData) return;

        const cost = buildingData.cost;
        if (this.game.currentPlayer.credits < cost) {
            this.statusDisplay.textContent = `Not enough credits to build ${buildingData.name}`;
            return;
        }

        // Disable the button temporarily to prevent multiple clicks
        const button = document.querySelector(`.building-button[data-building="${buildingType}"]`);
        if (button) {
            button.disabled = true;
            button.style.opacity = '0.5';

            // Re-enable after a short delay
            setTimeout(() => {
                button.disabled = false;
                button.style.opacity = '1';
            }, 2000);
        }

        // Start building placement mode
        this.statusDisplay.textContent = `Placing ${buildingData.name}...`;

        // Try to find a valid position for the building
        let building = null;
        const basePosition = this.selectedEntity.position.clone();

        // Define possible offsets to try (in a more comprehensive pattern around the construction yard)
        // Create a wider range of offsets with smaller increments
        const offsets = [];

        // Add cardinal directions at various distances
        for (let distance = 4; distance <= 12; distance += 2) {
            offsets.push({ x: distance, z: 0 });     // Right
            offsets.push({ x: 0, z: distance });     // Down
            offsets.push({ x: -distance, z: 0 });    // Left
            offsets.push({ x: 0, z: -distance });    // Up
        }

        // Add diagonal directions at various distances
        for (let distance = 4; distance <= 10; distance += 2) {
            offsets.push({ x: distance, z: distance });       // Down-Right
            offsets.push({ x: -distance, z: distance });      // Down-Left
            offsets.push({ x: -distance, z: -distance });     // Up-Left
            offsets.push({ x: distance, z: -distance });      // Up-Right
        }

        // Add some offset variations
        offsets.push({ x: 6, z: 3 });
        offsets.push({ x: 3, z: 6 });
        offsets.push({ x: -6, z: 3 });
        offsets.push({ x: -3, z: 6 });
        offsets.push({ x: -6, z: -3 });
        offsets.push({ x: -3, z: -6 });
        offsets.push({ x: 6, z: -3 });
        offsets.push({ x: 3, z: -6 });

        console.log(`Attempting to place ${buildingType} - trying ${offsets.length} different positions`);

        // Try each position until we find a valid one
        for (const offset of offsets) {
            const position = basePosition.clone();
            position.x += offset.x;
            position.z += offset.z;

            // Log the attempt
            console.log(`Trying to place ${buildingType} at position: x=${position.x.toFixed(1)}, z=${position.z.toFixed(1)}`);

            // Try to create the building at this position
            building = this.game.buildingManager.createBuilding(buildingType, position, this.game.currentPlayer);

            if (building) {
                console.log(`Successfully placed ${buildingType} at position: x=${position.x.toFixed(1)}, z=${position.z.toFixed(1)}`);
                break; // We found a valid position, stop trying
            }
        }

        if (building) {
            // Deduct cost
            this.game.currentPlayer.removeCredits(cost);

            // Update status with success message
            this.statusDisplay.textContent = `Building ${buildingData.name} - Construction started`;

            // Flash the status message to make it more noticeable
            this.flashStatusMessage();

            // Select the new building
            this.game.selectEntity(building);
        } else {
            this.statusDisplay.textContent = `Cannot build ${buildingData.name} - No valid location found. Try clearing more space around the Construction Yard.`;
            console.error(`Failed to place ${buildingType} - tried ${offsets.length} different positions`);
        }
    }

    /**
     * Flash the status message to make it more noticeable
     */
    flashStatusMessage() {
        const originalColor = this.statusDisplay.style.color || 'white';

        // Flash yellow
        this.statusDisplay.style.color = 'yellow';

        // Return to original color after a delay
        setTimeout(() => {
            this.statusDisplay.style.color = originalColor;
        }, 1000);
    }

    /**
     * Initialize the minimap
     */
    initMinimap() {
        // Create canvas for minimap
        const canvas = document.createElement('canvas');
        canvas.width = this.minimapDisplay.clientWidth;
        canvas.height = this.minimapDisplay.clientHeight;
        this.minimapDisplay.appendChild(canvas);

        // Get context
        this.minimapContext = canvas.getContext('2d');

        // Calculate scale and offset
        const mapWidth = this.game.mapManager.gridWidth * this.game.mapManager.cellSize;
        const mapHeight = this.game.mapManager.gridHeight * this.game.mapManager.cellSize;

        this.minimapScale = Math.min(
            canvas.width / mapWidth,
            canvas.height / mapHeight
        );

        this.minimapOffsetX = (canvas.width - (mapWidth * this.minimapScale)) / 2;
        this.minimapOffsetZ = (canvas.height - (mapHeight * this.minimapScale)) / 2;

        // Add click handler
        canvas.addEventListener('click', this.onMinimapClick.bind(this));
    }

    /**
     * Handle minimap click
     * @param {MouseEvent} event - Mouse event
     */
    onMinimapClick(event) {
        // Calculate map position
        const rect = event.target.getBoundingClientRect();
        const x = event.clientX - rect.left - this.minimapOffsetX;
        const z = event.clientY - rect.top - this.minimapOffsetZ;

        // Convert to world position
        const worldX = x / this.minimapScale;
        const worldZ = z / this.minimapScale;

        // Move camera to look at this position
        this.game.camera.position.set(
            worldX + 40,
            this.game.camera.position.y,
            worldZ + 40
        );

        this.game.camera.lookAt(worldX, 0, worldZ);
        this.game.controls.target.set(worldX, 0, worldZ);
    }

    /**
     * Update UI for a selected entity
     * @param {Object} entity - Selected entity
     * @param {Array} [entities] - Multiple selected entities
     */
    updateSelection(entity, entities = []) {
        // Clear previous selection
        this.selectedEntity = null;
        this.selectedEntities = [];

        // Update status display
        this.statusDisplay.textContent = 'Ready';

        // Hide all production buttons by default
        const unitButtons = document.querySelectorAll('.unit-button');
        unitButtons.forEach(button => {
            button.style.display = 'none';
        });

        // Hide all building buttons by default
        const buildingButtons = document.querySelectorAll('.building-button');
        buildingButtons.forEach(button => {
            button.style.display = 'none';
        });

        // Hide action buttons by default
        if (this.actionButtons) {
            this.actionButtons.style.display = 'none';
        }

        // Single entity selection
        if (entity) {
            this.selectedEntity = entity;
            this.updateEntityInfo(entity);
        }
        // Multiple entities selection
        else if (entities && entities.length > 0) {
            this.selectedEntities = entities;

            // Show generic info for multiple units
            const unitCount = entities.filter(e => e.unitData).length;
            const buildingCount = entities.filter(e => e.buildingData).length;

            let statusText = '';
            if (unitCount > 0) {
                statusText += `${unitCount} units `;
            }
            if (buildingCount > 0) {
                statusText += `${buildingCount} buildings `;
            }
            statusText += 'selected';

            this.statusDisplay.textContent = statusText;
        }
    }

    /**
     * Update UI for a specific entity
     * @param {Object} entity - Entity to show info for
     */
    updateEntityInfo(entity) {
        if (!entity) return;

        let infoText = '';

        // Check if it's a unit or building
        if (entity.unitData) {
            infoText = `${entity.unitData.name} (${Math.floor(entity.health)}/${entity.maxHealth})`;

            // Show relevant command buttons
            if (entity.type === 'mcv' && entity.unitData.canDeploy) {
                this.statusDisplay.textContent = `${infoText} - Ready to deploy`;

                // Show deploy button
                if (this.actionButtons && this.deployButton) {
                    this.actionButtons.style.display = 'block';
                }
            } else if (entity.type === 'harvester') {
                this.statusDisplay.textContent = `${infoText} - Cargo: ${Math.floor(entity.cargo)}/${entity.maxCargo}`;
            } else {
                this.statusDisplay.textContent = infoText;
            }
        }
        // It's a building
        else if (entity.buildingData) {
            infoText = `${entity.buildingData.name} (${Math.floor(entity.health)}/${entity.maxHealth})`;

            // Check if building is under construction
            if (entity.isUnderConstruction) {
                const progress = Math.floor((entity.constructionProgress / entity.buildingData.buildTime) * 100);
                this.statusDisplay.textContent = `${infoText} - Under construction ${progress}%`;
            }
            // Check if building is producing something
            else if (entity.isProducing && entity.currentProduction) {
                const progress = Math.floor((entity.productionProgress / entity.currentProduction.total) * 100);
                this.statusDisplay.textContent = `${infoText} - Producing ${entity.currentProduction.type} ${progress}%`;
            }
            // Show build options if available
            else if (entity.buildOptions && entity.buildOptions.length > 0) {
                this.statusDisplay.textContent = infoText;

                console.log("Building has build options:", entity.buildOptions);

                // Show relevant build buttons
                entity.buildOptions.forEach(option => {
                    // Check if it's a unit or building option
                    const unitButton = document.querySelector(`.unit-button[data-unit="${option}"]`);
                    const buildingButton = document.querySelector(`.building-button[data-building="${option}"]`);

                    if (unitButton) {
                        unitButton.style.display = 'inline-block';
                    } else if (buildingButton) {
                        buildingButton.style.display = 'inline-block';
                    } else {
                        console.log(`Button for ${option} not found`);
                    }
                });
            } else {
                this.statusDisplay.textContent = infoText;
            }
        }
    }

    /**
     * Update the minimap
     */
    updateMinimap() {
        if (!this.minimapContext) return;

        const ctx = this.minimapContext;
        const canvas = ctx.canvas;

        // Clear minimap
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw terrain
        ctx.fillStyle = '#4a7c59'; // Grass
        ctx.fillRect(
            this.minimapOffsetX,
            this.minimapOffsetZ,
            this.game.mapManager.gridWidth * this.game.mapManager.cellSize * this.minimapScale,
            this.game.mapManager.gridHeight * this.game.mapManager.cellSize * this.minimapScale
        );

        // Draw water
        ctx.fillStyle = '#3a85bf'; // Water
        for (let x = 0; x < this.game.mapManager.gridWidth; x++) {
            for (let z = 0; z < this.game.mapManager.gridHeight; z++) {
                if (this.game.mapManager.mapData[x][z].type === 'water') {
                    ctx.fillRect(
                        this.minimapOffsetX + x * this.game.mapManager.cellSize * this.minimapScale,
                        this.minimapOffsetZ + z * this.game.mapManager.cellSize * this.minimapScale,
                        this.game.mapManager.cellSize * this.minimapScale,
                        this.game.mapManager.cellSize * this.minimapScale
                    );
                }
            }
        }

        // Draw resources
        ctx.fillStyle = '#ffd700'; // Gold/ore
        for (const resource of this.game.mapManager.resources) {
            ctx.fillRect(
                this.minimapOffsetX + resource.x * this.game.mapManager.cellSize * this.minimapScale,
                this.minimapOffsetZ + resource.z * this.game.mapManager.cellSize * this.minimapScale,
                this.game.mapManager.cellSize * this.minimapScale,
                this.game.mapManager.cellSize * this.minimapScale
            );
        }

        // Draw buildings
        for (const building of this.game.buildingManager.buildings) {
            // Use player color
            if (building.player === this.game.currentPlayer) {
                ctx.fillStyle = '#ff0000'; // Red for player
            } else {
                ctx.fillStyle = '#0000ff'; // Blue for enemy
            }

            const buildingType = this.game.buildingManager.buildingTypes[building.type];
            const halfWidth = buildingType.width / 2;
            const halfDepth = buildingType.depth / 2;

            ctx.fillRect(
                this.minimapOffsetX + (building.position.x - halfWidth) * this.minimapScale,
                this.minimapOffsetZ + (building.position.z - halfDepth) * this.minimapScale,
                buildingType.width * this.minimapScale,
                buildingType.depth * this.minimapScale
            );
        }

        // Draw units as dots
        for (const unit of this.game.unitManager.units) {
            // Use player color
            if (unit.player === this.game.currentPlayer) {
                ctx.fillStyle = '#ff0000'; // Red for player
            } else {
                ctx.fillStyle = '#0000ff'; // Blue for enemy
            }

            ctx.beginPath();
            ctx.arc(
                this.minimapOffsetX + unit.position.x * this.minimapScale,
                this.minimapOffsetZ + unit.position.z * this.minimapScale,
                2, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // Draw camera viewport
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        // Calculate camera frustum corners in world space
        // This is a simplified approximation
        const cameraPos = this.game.camera.position;
        const target = this.game.controls.target;
        const direction = new THREE.Vector3()
            .subVectors(target, cameraPos)
            .normalize();

        // Draw camera position
        ctx.beginPath();
        ctx.arc(
            this.minimapOffsetX + cameraPos.x * this.minimapScale,
            this.minimapOffsetZ + cameraPos.z * this.minimapScale,
            3, 0, Math.PI * 2
        );
        ctx.stroke();

        // Draw camera view direction
        ctx.beginPath();
        ctx.moveTo(
            this.minimapOffsetX + cameraPos.x * this.minimapScale,
            this.minimapOffsetZ + cameraPos.z * this.minimapScale
        );
        ctx.lineTo(
            this.minimapOffsetX + (cameraPos.x + direction.x * 10) * this.minimapScale,
            this.minimapOffsetZ + (cameraPos.z + direction.z * 10) * this.minimapScale
        );
        ctx.stroke();
    }

    /**
     * Update the resource display
     */
    updateResourceDisplay() {
        if (!this.resourcesDisplay) return;

        const credits = this.game.currentPlayer.credits;
        const power = this.game.currentPlayer.power;

        // Show credits and power status
        this.resourcesDisplay.textContent = `Credits: ${credits} | Power: ${power.produced}/${power.consumed}`;
    }

    /**
     * Update all UI elements
     * @param {number} delta - Time delta
     */
    update(delta) {
        // Update selected entity info if any
        if (this.selectedEntity) {
            this.updateEntityInfo(this.selectedEntity);
        }

        // Update minimap every frame
        this.updateMinimap();

        // Update resource display
        this.updateResourceDisplay();
    }

    /**
     * Clean up resources when UI is destroyed
     */
    cleanup() {
        // Remove event listeners, etc.
        if (this.minimapDisplay && this.minimapDisplay.firstChild) {
            this.minimapDisplay.firstChild.removeEventListener('click', this.onMinimapClick);
        }
    }
} 