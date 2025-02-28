import * as THREE from 'three';
import { Building } from './entities/Building.js';

/**
 * Manages building creation and behavior
 */
export class BuildingManager {
    /**
     * Create a new BuildingManager
     * @param {Object} game - Reference to the main game
     */
    constructor(game) {
        this.game = game;
        this.buildings = [];

        // Building type definitions
        this.buildingTypes = {
            construction_yard: {
                name: 'Construction Yard',
                model: 'box',
                width: 3,
                depth: 3,
                height: 1.5,
                health: 1000,
                cost: 2000,
                buildTime: 0, // Cannot be built, deployed from MCV
                powerConsumed: 15,
                powerProduced: 0,
                isConstructionYard: true,
                buildOptions: ['power_plant', 'barracks', 'refinery', 'war_factory', 'defensive_turret']
            },
            power_plant: {
                name: 'Power Plant',
                model: 'box',
                width: 2,
                depth: 2,
                height: 2,
                health: 600,
                cost: 300,
                buildTime: 10,
                powerConsumed: 0,
                powerProduced: 100,
                buildOptions: []
            },
            barracks: {
                name: 'Barracks',
                model: 'box',
                width: 2,
                depth: 2,
                height: 1.5,
                health: 800,
                cost: 400,
                buildTime: 12,
                powerConsumed: 20,
                powerProduced: 0,
                buildOptions: ['soldier', 'engineer', 'dog']
            },
            refinery: {
                name: 'Refinery',
                model: 'box',
                width: 3,
                depth: 3,
                height: 2,
                health: 900,
                cost: 2000,
                buildTime: 15,
                powerConsumed: 40,
                powerProduced: 0,
                harvestStorage: 2000,
                buildOptions: [],
                providesUnit: 'harvester'
            },
            war_factory: {
                name: 'War Factory',
                model: 'box',
                width: 3,
                depth: 3,
                height: 2,
                health: 1000,
                cost: 2000,
                buildTime: 20,
                powerConsumed: 30,
                powerProduced: 0,
                buildOptions: ['tank', 'apc', 'mcv']
            },
            defensive_turret: {
                name: 'Defensive Turret',
                model: 'box',
                width: 1,
                depth: 1,
                height: 1.5,
                health: 600,
                cost: 600,
                buildTime: 8,
                powerConsumed: 10,
                powerProduced: 0,
                canAttack: true,
                attackRange: 7,
                damage: 40,
                reloadTime: 2.5,
                buildOptions: []
            }
        };
    }

    /**
     * Create a new building
     * @param {string} type - Building type
     * @param {THREE.Vector3} position - Initial position
     * @param {Object} player - Owning player
     * @returns {Object} The created building
     */
    createBuilding(type, position, player) {
        const buildingType = this.buildingTypes[type];
        if (!buildingType) {
            console.error(`Unknown building type: ${type}`);
            return null;
        }

        // Check if the position is valid
        const isValid = this.isValidBuildLocation(type, position, player);
        if (!isValid) {
            console.error(`Invalid build location for ${type}`);
            return null;
        }

        // Create the building
        const building = new Building(this.game, type, position, player);

        // Register building
        this.buildings.push(building);
        player.addBuilding(building);

        // Update grid occupation
        this.updateGridOccupation(building);

        // If this is a refinery, create a harvester
        if (buildingType.providesUnit === 'harvester') {
            const harvesterPosition = new THREE.Vector3(
                position.x,
                0,
                position.z - buildingType.depth
            );

            this.game.unitManager.createUnit('harvester', harvesterPosition, player);
        }

        return building;
    }

    /**
     * Update grid occupation for a building
     * @param {Object} building - Building to update
     */
    updateGridOccupation(building) {
        const gridPos = this.game.mapManager.worldToGrid(building.position);
        const buildingType = this.buildingTypes[building.type];

        const halfWidth = Math.floor(buildingType.width / 2);
        const halfDepth = Math.floor(buildingType.depth / 2);

        // Mark cells as occupied
        for (let x = gridPos.x - halfWidth; x <= gridPos.x + halfWidth; x++) {
            for (let z = gridPos.z - halfDepth; z <= gridPos.z + halfDepth; z++) {
                // Make sure we're in bounds
                if (x >= 0 && x < this.game.mapManager.gridWidth &&
                    z >= 0 && z < this.game.mapManager.gridHeight) {
                    this.game.mapManager.mapData[x][z].buildable = false;
                    this.game.mapManager.mapData[x][z].walkable = false;
                    this.game.mapManager.mapData[x][z].entity = building;
                }
            }
        }
    }

    /**
     * Check if a position is valid for building
     * @param {string} type - Building type
     * @param {THREE.Vector3} position - Position to check
     * @param {Object} player - Player attempting to build
     * @returns {boolean} True if the position is valid
     */
    isValidBuildLocation(type, position, player) {
        const buildingType = this.buildingTypes[type];
        if (!buildingType) return false;

        const gridPos = this.game.mapManager.worldToGrid(position);
        const halfWidth = Math.floor(buildingType.width / 2);
        const halfDepth = Math.floor(buildingType.depth / 2);

        // Check if all cells are buildable
        for (let x = gridPos.x - halfWidth; x <= gridPos.x + halfWidth; x++) {
            for (let z = gridPos.z - halfDepth; z <= gridPos.z + halfDepth; z++) {
                // Make sure we're in bounds
                if (x < 0 || x >= this.game.mapManager.gridWidth ||
                    z < 0 || z >= this.game.mapManager.gridHeight) {
                    return false;
                }

                // Check if cell is buildable
                if (!this.game.mapManager.isBuildable(x, z)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Remove a building from the game
     * @param {Object} building - Building to remove
     */
    removeBuilding(building) {
        // Remove from arrays
        const index = this.buildings.indexOf(building);
        if (index !== -1) {
            this.buildings.splice(index, 1);
        }

        // Remove from player
        building.player.removeBuilding(building);

        // Clear grid occupation
        const gridPos = this.game.mapManager.worldToGrid(building.position);
        const buildingType = this.buildingTypes[building.type];

        const halfWidth = Math.floor(buildingType.width / 2);
        const halfDepth = Math.floor(buildingType.depth / 2);

        // Mark cells as free
        for (let x = gridPos.x - halfWidth; x <= gridPos.x + halfWidth; x++) {
            for (let z = gridPos.z - halfDepth; z <= gridPos.z + halfDepth; z++) {
                // Make sure we're in bounds
                if (x >= 0 && x < this.game.mapManager.gridWidth &&
                    z >= 0 && z < this.game.mapManager.gridHeight) {
                    this.game.mapManager.mapData[x][z].buildable = true;
                    this.game.mapManager.mapData[x][z].walkable = true;
                    this.game.mapManager.mapData[x][z].entity = null;
                }
            }
        }

        // Remove from scene
        if (building.mesh) {
            this.game.scene.remove(building.mesh);
            building.cleanup();
        }
    }

    /**
     * Find all buildings in a given radius
     * @param {THREE.Vector3} position - Center position
     * @param {number} radius - Search radius
     * @param {Object} [player] - Only return buildings belonging to this player
     * @returns {Array} Array of buildings
     */
    getBuildingsInRadius(position, radius, player = null) {
        const result = [];
        const radiusSquared = radius * radius;

        for (const building of this.buildings) {
            if (player && building.player !== player) continue;

            const distanceSquared = position.distanceToSquared(building.position);
            if (distanceSquared <= radiusSquared) {
                result.push(building);
            }
        }

        return result;
    }

    /**
     * Find construction yard for a player
     * @param {Object} player - Player to check
     * @returns {Object|null} Construction yard or null if not found
     */
    getConstructionYard(player) {
        return this.buildings.find(
            building => building.player === player && building.type === 'construction_yard'
        ) || null;
    }

    /**
     * Check if player can build a building type
     * @param {string} type - Building type
     * @param {Object} player - Player to check
     * @returns {boolean} True if player can build the type
     */
    canBuild(type, player) {
        // Check if player has construction yard
        const constructionYard = this.getConstructionYard(player);
        if (!constructionYard) return false;

        // Check if building is in build options
        return constructionYard.buildOptions.includes(type);
    }

    /**
     * Update all buildings
     * @param {number} delta - Time delta
     */
    update(delta) {
        for (const building of this.buildings) {
            building.update(delta);
        }
    }
} 