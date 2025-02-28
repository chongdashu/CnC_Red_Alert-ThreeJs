/**
 * Represents a player in the game (human or AI)
 */
export class Player {
    /**
     * Create a new player
     * @param {string} id - Player identifier
     * @param {string} color - Player color
     * @param {number} credits - Starting credits
     */
    constructor(id, color, credits = 5000) {
        this.id = id;
        this.color = color;
        this.credits = credits;
        this.isHuman = id === 'player';

        // Map unit hex color to THREE.Color
        this.colorMap = {
            'red': 0xff0000,
            'blue': 0x0000ff,
            'yellow': 0xffff00,
            'green': 0x00ff00,
        };

        this.units = [];
        this.buildings = [];
        this.power = {
            produced: 0,
            consumed: 0
        };
    }

    /**
     * Add credits to the player
     * @param {number} amount - Amount to add
     */
    addCredits(amount) {
        this.credits += amount;
        // Update UI if this is human player
        if (this.isHuman) {
            document.getElementById('resources').textContent = `Credits: ${this.credits}`;
        }
    }

    /**
     * Remove credits from the player
     * @param {number} amount - Amount to remove
     * @returns {boolean} True if the player had enough credits
     */
    removeCredits(amount) {
        if (this.credits >= amount) {
            this.credits -= amount;
            // Update UI if this is human player
            if (this.isHuman) {
                document.getElementById('resources').textContent = `Credits: ${this.credits}`;
            }
            return true;
        }
        return false;
    }

    /**
     * Get the THREE.Color for this player
     * @returns {number} THREE.Color hex value
     */
    getColor() {
        return this.colorMap[this.color] || 0xffffff;
    }

    /**
     * Add a unit to the player's army
     * @param {Object} unit - Unit to add
     */
    addUnit(unit) {
        this.units.push(unit);
    }

    /**
     * Remove a unit from the player's army
     * @param {Object} unit - Unit to remove
     */
    removeUnit(unit) {
        const index = this.units.indexOf(unit);
        if (index !== -1) {
            this.units.splice(index, 1);
        }
    }

    /**
     * Add a building to the player's structures
     * @param {Object} building - Building to add
     */
    addBuilding(building) {
        this.buildings.push(building);
        this.updatePower();
    }

    /**
     * Remove a building from the player's structures
     * @param {Object} building - Building to remove
     */
    removeBuilding(building) {
        const index = this.buildings.indexOf(building);
        if (index !== -1) {
            this.buildings.splice(index, 1);
            this.updatePower();
        }
    }

    /**
     * Update power levels
     */
    updatePower() {
        this.power.produced = 0;
        this.power.consumed = 0;

        this.buildings.forEach(building => {
            this.power.produced += building.powerProduced || 0;
            this.power.consumed += building.powerConsumed || 0;
        });
    }

    /**
     * Check if player has sufficient power
     * @returns {boolean} True if power is sufficient
     */
    hasSufficientPower() {
        return this.power.produced >= this.power.consumed;
    }
} 