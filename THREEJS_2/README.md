# Command & Conquer: Red Alert Three.js Recreation

This is a minimal Three.js recreation of the classic Command & Conquer: Red Alert RTS game, based on the original C++ codebase.

## Features

- 3D terrain with resources
- Unit creation and movement
- Building construction and production
- Basic combat mechanics
- Resource harvesting
- Simple AI opponent
- Minimap navigation
- Unit selection and orders

## Technologies Used

- Three.js for 3D rendering
- Vite for development and building

## Installation

1. Make sure you have Node.js installed
2. Clone this repository
3. Install dependencies:

```bash
npm install
```

## Running the Project

Start the development server:

```bash
npm start
```

Then open your browser to `http://localhost:5173/` to play the game.

## Game Controls

- **Left Mouse Button**: Select units/buildings
- **Right Mouse Button**: Move selected units or attack targets
- **Click + Drag**: Box select multiple units
- **ESC**: Deselect all
- **DELETE**: Sell/destroy selected building or unit

## Game Mechanics

### Units

- **MCV (Mobile Construction Vehicle)**: Deploy to create a Construction Yard
- **Harvester**: Collects ore and returns it to refineries for credits
- **Tank**: Combat unit for attacking enemies
- **APC**: Transport unit that can carry infantry

### Buildings

- **Construction Yard**: Allows building other structures
- **Power Plant**: Provides power for your base
- **Barracks**: Produces infantry units
- **Refinery**: Processes ore into credits
- **War Factory**: Produces vehicles
- **Defensive Turret**: Automatically attacks nearby enemies

## Development

### Project Structure

- `/src`: Source code
  - `/engine`: Core game engine functionality
  - `/game`: Game-specific logic
    - `/entities`: Unit and building classes
    - `/ui`: User interface components
  - `/assets`: Game assets

### Implementation Details

This implementation focuses on recreating the core mechanics of the original game:

1. **Entity System**: Units and buildings inherit from a common entity model, similar to the original game's TechnoClass hierarchy.
2. **Grid-Based Map**: The game uses a cell-based map system similar to the original.
3. **Player Management**: Handles resources, power, and unit ownership.
4. **Resource System**: Ore collection and processing for credits.

## License

This project is for educational purposes only.

## Acknowledgements

Based on the original Command & Conquer: Red Alert codebase by Westwood Studios.
