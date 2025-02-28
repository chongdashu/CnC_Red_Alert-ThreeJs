import * as THREE from 'three';
import { Unit } from './entities/Unit.js';

/**
 * Manages unit creation and behavior
 */
export class UnitManager {
    /**
     * Create a new UnitManager
     * @param {Object} game - Reference to the main game
     */
    constructor(game) {
        this.game = game;
        this.units = [];

        // Unit type definitions
        this.unitTypes = {
            mcv: {
                name: 'Mobile Construction Vehicle',
                model: 'box',
                width: 1,
                height: 1,
                depth: 1.5,
                health: 600,
                speed: 0.5,
                turnSpeed: 1.5,
                cost: 2000,
                buildTime: 20,
                canHarvest: false,
                canAttack: false,
                canDeploy: true,
                deployedBuilding: 'construction_yard'
            },
            harvester: {
                name: 'Ore Harvester',
                model: 'box',
                width: 1,
                height: 0.8,
                depth: 1.5,
                health: 600,
                speed: 0.6,
                turnSpeed: 1.5,
                cost: 1400,
                buildTime: 15,
                canHarvest: true,
                canAttack: false,
                harvestAmount: 100,
                harvestSpeed: 5,
                cargoCapacity: 1000
            },
            tank: {
                name: 'Medium Tank',
                model: 'box',
                width: 0.8,
                height: 0.5,
                depth: 1.2,
                health: 400,
                speed: 0.8,
                turnSpeed: 2.0,
                cost: 800,
                buildTime: 10,
                canAttack: true,
                attackRange: 5.5,
                damage: 30,
                reloadTime: 2.0,
                turretRotationSpeed: 2.5
            },
            apc: {
                name: 'Armored Personnel Carrier',
                model: 'box',
                width: 0.8,
                height: 0.6,
                depth: 1.2,
                health: 300,
                speed: 1.0,
                turnSpeed: 2.5,
                cost: 700,
                buildTime: 8,
                canAttack: true,
                attackRange: 4,
                damage: 15,
                reloadTime: 1.5,
                cargoCapacity: 5
            }
        };
    }

    /**
     * Create a new unit
     * @param {string} type - Unit type
     * @param {THREE.Vector3} position - Initial position
     * @param {Object} player - Owning player
     * @returns {Object} The created unit
     */
    createUnit(type, position, player) {
        const unitType = this.unitTypes[type];
        if (!unitType) {
            console.error(`Unknown unit type: ${type}`);
            return null;
        }

        // Create the unit
        const unit = new Unit(this.game, type, position, player);

        // Register unit
        this.units.push(unit);
        player.addUnit(unit);

        return unit;
    }

    /**
     * Remove a unit from the game
     * @param {Object} unit - Unit to remove
     */
    removeUnit(unit) {
        // Remove from arrays
        const index = this.units.indexOf(unit);
        if (index !== -1) {
            this.units.splice(index, 1);
        }

        // Remove from player
        unit.player.removeUnit(unit);

        // Remove from scene
        if (unit.mesh) {
            this.game.scene.remove(unit.mesh);
            unit.cleanup();
        }
    }

    /**
     * Find all units in a given radius
     * @param {THREE.Vector3} position - Center position
     * @param {number} radius - Search radius
     * @param {Object} [player] - Only return units belonging to this player
     * @returns {Array} Array of units
     */
    getUnitsInRadius(position, radius, player = null) {
        const result = [];
        const radiusSquared = radius * radius;

        for (const unit of this.units) {
            if (player && unit.player !== player) continue;

            const distanceSquared = position.distanceToSquared(unit.position);
            if (distanceSquared <= radiusSquared) {
                result.push(unit);
            }
        }

        return result;
    }

    /**
     * Update all units
     * @param {number} delta - Time delta
     */
    update(delta) {
        for (const unit of this.units) {
            unit.update(delta);
        }
    }
} 