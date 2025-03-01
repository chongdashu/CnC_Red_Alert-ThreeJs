import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
        this.canDeploy = this.unitData.canDeploy || false;
        this.deployedBuilding = this.unitData.deployedBuilding || null;

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
        
        // Animation properties
        this.animationState = 'idle';
        this.animationTime = 0;
        this.animationSpeed = 1.5; // Animation cycles per second
        this.walkCyclePhase = 0;
        this.limbParts = {}; // Store references to limbs for animation

        // Create mesh
        this.createMesh();

        // Add selection hitbox
        this.createSelectionHitbox();

        // Selection indicator
        this.createSelectionIndicator();
    }

    /**
     * Create the unit's 3D mesh
     */
    createMesh() {
        console.log(`Creating mesh for unit: ${this.type}`);
        
        // Create a geometry based on unit type
        let geometry;
        
        // Define common materials
        const darkMetal = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.7,
            metalness: 0.8
        });
        
        const lightMetal = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.6,
            metalness: 0.7
        });
        
        const trackMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.9,
            metalness: 0.3
        });
        
        // Team color material
        const teamMaterial = new THREE.MeshStandardMaterial({
            color: this.player.getColor(),
            roughness: 0.7,
            metalness: 0.3
        });
        
        switch (this.type) {
            case 'soldier':
                this.createSoldierMeshWithParts();
                return;
            case 'engineer':
                this.createEngineerMeshWithParts();
                return;
            case 'dog':
                this.createDogMeshWithParts();
                return;
            case 'tank':
                geometry = this.createTankMesh();
                this.mesh = new THREE.Mesh(geometry, [teamMaterial, darkMetal, trackMaterial]);
                break;
            case 'harvester':
                geometry = this.createHarvesterMesh();
                this.mesh = new THREE.Mesh(geometry, [teamMaterial, lightMetal, trackMaterial, darkMetal]);
                break;
            case 'mcv':
                geometry = this.createMCVMesh();
                this.mesh = new THREE.Mesh(geometry, [teamMaterial, lightMetal, trackMaterial, darkMetal]);
                break;
            case 'apc':
                geometry = this.createAPCMesh();
                this.mesh = new THREE.Mesh(geometry, [teamMaterial, darkMetal, trackMaterial]);
                break;
            default:
                geometry = new THREE.BoxGeometry(
                    this.unitData.width,
                    this.unitData.height,
                    this.unitData.depth
                );
                this.mesh = new THREE.Mesh(geometry, teamMaterial);
        }

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.copy(this.position);
        this.mesh.position.y = this.unitData.height / 2;
        this.mesh.name = `unit_${this.type}_${this.player.id}`;
        this.mesh.userData.entity = this;
        this.game.scene.add(this.mesh);
        
        // For units with turrets, create a separate turret mesh
        if (this.unitData.canAttack && ['tank', 'apc'].includes(this.type)) {
            this.createTurret();
        }
    }

    /**
     * Create a soldier mesh with separate parts for animation
     */
    createSoldierMeshWithParts() {
        const width = this.unitData.width;
        const height = this.unitData.height;
        const depth = this.unitData.depth;
        
        // Create a main group to hold all parts
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);
        this.mesh.position.y = this.unitData.height / 2;
        this.mesh.name = `unit_${this.type}_${this.player.id}`;
        this.mesh.userData.entity = this;
        
        // Use different materials
        const uniformMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333, // Dark grey for uniform
            roughness: 0.8,
            metalness: 0.2
        });
        
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xdeb887, // Skin tone
            roughness: 0.9,
            metalness: 0.1
        });
        
        const equipmentMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111, // Dark for equipment
            roughness: 0.7,
            metalness: 0.6
        });
        
        // Team color for certain parts
        const teamMaterial = new THREE.MeshStandardMaterial({
            color: this.player.getColor(),
            roughness: 0.7,
            metalness: 0.3
        });
        
        // Body (torso) - team color
        const bodyGeometry = new THREE.BoxGeometry(width * 0.6, height * 0.4, depth * 0.4);
        const bodyMesh = new THREE.Mesh(bodyGeometry, teamMaterial);
        bodyMesh.position.y = height * 0.2;
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        this.mesh.add(bodyMesh);
        
        // Head - skin tone
        const headGeometry = new THREE.SphereGeometry(width * 0.3, 8, 8);
        const headMesh = new THREE.Mesh(headGeometry, skinMaterial);
        headMesh.position.y = height * 0.55;
        headMesh.castShadow = true;
        headMesh.receiveShadow = true;
        this.mesh.add(headMesh);
        
        // Legs - uniform color
        const legGeometry = new THREE.BoxGeometry(width * 0.2, height * 0.4, depth * 0.2);
        
        const leftLegMesh = new THREE.Mesh(legGeometry, uniformMaterial);
        leftLegMesh.position.set(width * 0.2, -height * 0.2, 0);
        leftLegMesh.castShadow = true;
        leftLegMesh.receiveShadow = true;
        this.mesh.add(leftLegMesh);
        this.limbParts.leftLeg = leftLegMesh;
        
        const rightLegMesh = new THREE.Mesh(legGeometry, uniformMaterial);
        rightLegMesh.position.set(-width * 0.2, -height * 0.2, 0);
        rightLegMesh.castShadow = true;
        rightLegMesh.receiveShadow = true;
        this.mesh.add(rightLegMesh);
        this.limbParts.rightLeg = rightLegMesh;
        
        // Arms - uniform color
        const armGeometry = new THREE.BoxGeometry(width * 0.2, height * 0.35, depth * 0.2);
        
        const leftArmMesh = new THREE.Mesh(armGeometry, uniformMaterial);
        leftArmMesh.position.set(width * 0.4, height * 0.15, 0);
        leftArmMesh.castShadow = true;
        leftArmMesh.receiveShadow = true;
        this.mesh.add(leftArmMesh);
        this.limbParts.leftArm = leftArmMesh;
        
        const rightArmMesh = new THREE.Mesh(armGeometry, uniformMaterial);
        rightArmMesh.position.set(-width * 0.4, height * 0.15, 0);
        rightArmMesh.castShadow = true;
        rightArmMesh.receiveShadow = true;
        this.mesh.add(rightArmMesh);
        this.limbParts.rightArm = rightArmMesh;
        
        // Rifle - equipment color
        const rifleGeometry = new THREE.BoxGeometry(width * 0.1, width * 0.1, depth * 0.8);
        const rifleMesh = new THREE.Mesh(rifleGeometry, equipmentMaterial);
        rifleMesh.position.set(0, 0, depth * 0.4);
        rifleMesh.castShadow = true;
        rifleMesh.receiveShadow = true;
        leftArmMesh.add(rifleMesh); // Attach rifle to left arm
        
        // Add to scene
        this.game.scene.add(this.mesh);
        console.log(`Added soldier mesh with animated parts to scene: ${this.mesh.name}`);
    }

    /**
     * Create an engineer mesh with separate parts for animation
     */
    createEngineerMeshWithParts() {
        const width = this.unitData.width;
        const height = this.unitData.height;
        const depth = this.unitData.depth;
        
        // Create a main group to hold all parts
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);
        this.mesh.position.y = this.unitData.height / 2;
        this.mesh.name = `unit_${this.type}_${this.player.id}`;
        this.mesh.userData.entity = this;
        
        // Use different materials
        const uniformMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666, // Light grey for uniform
            roughness: 0.8,
            metalness: 0.2
        });
        
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xdeb887, // Skin tone
            roughness: 0.9,
            metalness: 0.1
        });
        
        const equipmentMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888, // Grey for equipment
            roughness: 0.3,
            metalness: 0.8
        });
        
        // Team color for certain parts
        const teamMaterial = new THREE.MeshStandardMaterial({
            color: this.player.getColor(),
            roughness: 0.7,
            metalness: 0.3
        });
        
        // Body (torso) - team color
        const bodyGeometry = new THREE.BoxGeometry(width * 0.6, height * 0.4, depth * 0.4);
        const bodyMesh = new THREE.Mesh(bodyGeometry, teamMaterial);
        bodyMesh.position.y = height * 0.2;
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        this.mesh.add(bodyMesh);
        
        // Head - skin tone
        const headGeometry = new THREE.SphereGeometry(width * 0.3, 8, 8);
        const headMesh = new THREE.Mesh(headGeometry, skinMaterial);
        headMesh.position.y = height * 0.55;
        headMesh.castShadow = true;
        headMesh.receiveShadow = true;
        this.mesh.add(headMesh);
        
        // Helmet - equipment color
        const helmetGeometry = new THREE.CylinderGeometry(width * 0.32, width * 0.32, height * 0.15, 8);
        const helmetMesh = new THREE.Mesh(helmetGeometry, equipmentMaterial);
        helmetMesh.position.y = height * 0.6;
        helmetMesh.castShadow = true;
        helmetMesh.receiveShadow = true;
        this.mesh.add(helmetMesh);
        
        // Legs - uniform color
        const legGeometry = new THREE.BoxGeometry(width * 0.2, height * 0.4, depth * 0.2);
        
        const leftLegMesh = new THREE.Mesh(legGeometry, uniformMaterial);
        leftLegMesh.position.set(width * 0.2, -height * 0.2, 0);
        leftLegMesh.castShadow = true;
        leftLegMesh.receiveShadow = true;
        this.mesh.add(leftLegMesh);
        this.limbParts.leftLeg = leftLegMesh;
        
        const rightLegMesh = new THREE.Mesh(legGeometry, uniformMaterial);
        rightLegMesh.position.set(-width * 0.2, -height * 0.2, 0);
        rightLegMesh.castShadow = true;
        rightLegMesh.receiveShadow = true;
        this.mesh.add(rightLegMesh);
        this.limbParts.rightLeg = rightLegMesh;
        
        // Arms - uniform color
        const armGeometry = new THREE.BoxGeometry(width * 0.2, height * 0.35, depth * 0.2);
        
        const leftArmMesh = new THREE.Mesh(armGeometry, uniformMaterial);
        leftArmMesh.position.set(width * 0.4, height * 0.15, 0);
        leftArmMesh.castShadow = true;
        leftArmMesh.receiveShadow = true;
        this.mesh.add(leftArmMesh);
        this.limbParts.leftArm = leftArmMesh;
        
        const rightArmMesh = new THREE.Mesh(armGeometry, uniformMaterial);
        rightArmMesh.position.set(-width * 0.4, height * 0.15, 0);
        rightArmMesh.castShadow = true;
        rightArmMesh.receiveShadow = true;
        this.mesh.add(rightArmMesh);
        this.limbParts.rightArm = rightArmMesh;
        
        // Tool - equipment color
        const toolGeometry = new THREE.BoxGeometry(width * 0.15, width * 0.15, depth * 0.5);
        const toolMesh = new THREE.Mesh(toolGeometry, equipmentMaterial);
        toolMesh.position.set(0, 0, depth * 0.3);
        toolMesh.castShadow = true;
        toolMesh.receiveShadow = true;
        rightArmMesh.add(toolMesh); // Attach tool to right arm
        
        // Add to scene
        this.game.scene.add(this.mesh);
        console.log(`Added engineer mesh with animated parts to scene: ${this.mesh.name}`);
    }

    /**
     * Create a dog mesh with separate parts for animation
     */
    createDogMeshWithParts() {
        const width = this.unitData.width;
        const height = this.unitData.height;
        const depth = this.unitData.depth;
        
        // Create a main group to hold all parts
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);
        this.mesh.position.y = this.unitData.height / 2;
        this.mesh.name = `unit_${this.type}_${this.player.id}`;
        this.mesh.userData.entity = this;
        
        // Use different materials
        const furMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444, // Dark grey for fur
            roughness: 0.9,
            metalness: 0.1
        });
        
        // Team color for collar
        const teamMaterial = new THREE.MeshStandardMaterial({
            color: this.player.getColor(),
            roughness: 0.7,
            metalness: 0.3
        });
        
        // Body and head - fur color
        const bodyGeometry = new THREE.BoxGeometry(width * 0.6, height * 0.5, depth * 0.8);
        const bodyMesh = new THREE.Mesh(bodyGeometry, furMaterial);
        bodyMesh.position.y = height * 0.25;
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        this.mesh.add(bodyMesh);
        
        // Head - fur color
        const headGeometry = new THREE.BoxGeometry(width * 0.4, height * 0.4, depth * 0.5);
        const headMesh = new THREE.Mesh(headGeometry, furMaterial);
        headMesh.position.set(0, height * 0.4, depth * 0.5);
        headMesh.castShadow = true;
        headMesh.receiveShadow = true;
        this.mesh.add(headMesh);
        
        // Legs - fur color
        const legGeometry = new THREE.BoxGeometry(width * 0.15, height * 0.4, width * 0.15);
        
        // Front legs - fur color
        const frontLeftLegMesh = new THREE.Mesh(legGeometry, furMaterial);
        frontLeftLegMesh.position.set(width * 0.2, -height * 0.05, depth * 0.3);
        frontLeftLegMesh.castShadow = true;
        frontLeftLegMesh.receiveShadow = true;
        this.mesh.add(frontLeftLegMesh);
        this.limbParts.frontLeftLeg = frontLeftLegMesh;
        
        const frontRightLegMesh = new THREE.Mesh(legGeometry, furMaterial);
        frontRightLegMesh.position.set(-width * 0.2, -height * 0.05, depth * 0.3);
        frontRightLegMesh.castShadow = true;
        frontRightLegMesh.receiveShadow = true;
        this.mesh.add(frontRightLegMesh);
        this.limbParts.frontRightLeg = frontRightLegMesh;
        
        // Back legs - fur color
        const backLeftLegMesh = new THREE.Mesh(legGeometry, furMaterial);
        backLeftLegMesh.position.set(width * 0.2, -height * 0.05, -depth * 0.3);
        backLeftLegMesh.castShadow = true;
        backLeftLegMesh.receiveShadow = true;
        this.mesh.add(backLeftLegMesh);
        this.limbParts.backLeftLeg = backLeftLegMesh;
        
        const backRightLegMesh = new THREE.Mesh(legGeometry, furMaterial);
        backRightLegMesh.position.set(-width * 0.2, -height * 0.05, -depth * 0.3);
        backRightLegMesh.castShadow = true;
        backRightLegMesh.receiveShadow = true;
        this.mesh.add(backRightLegMesh);
        this.limbParts.backRightLeg = backRightLegMesh;
        
        // Tail - fur color
        const tailGeometry = new THREE.BoxGeometry(width * 0.1, height * 0.1, depth * 0.4);
        const tailMesh = new THREE.Mesh(tailGeometry, furMaterial);
        tailMesh.position.set(0, height * 0.4, -depth * 0.5);
        tailMesh.castShadow = true;
        tailMesh.receiveShadow = true;
        this.mesh.add(tailMesh);
        this.limbParts.tail = tailMesh;
        
        // Add a collar with team color
        const collarGeometry = new THREE.TorusGeometry(width * 0.25, width * 0.05, 8, 16);
        const collarMesh = new THREE.Mesh(collarGeometry, teamMaterial);
        collarMesh.position.set(0, height * 0.4, depth * 0.4);
        collarMesh.rotation.x = Math.PI / 2;
        this.mesh.add(collarMesh);
        
        // Add to scene
        this.game.scene.add(this.mesh);
        console.log(`Added dog mesh with animated parts to scene: ${this.mesh.name}`);
    }

    /**
     * Create a tank mesh
     * @returns {THREE.BufferGeometry} Combined geometry for the tank
     */
    createTankMesh() {
        const width = this.unitData.width;
        const height = this.unitData.height;
        const depth = this.unitData.depth;
        
        // Create geometries for different parts
        const hullGeometry = new THREE.BoxGeometry(width, height * 0.6, depth);
        
        // Create tracks
        const trackWidth = width * 0.3;
        const trackHeight = height * 0.3;
        const trackDepth = depth;
        
        const leftTrackGeometry = new THREE.BoxGeometry(trackWidth, trackHeight, trackDepth);
        leftTrackGeometry.translate(width * 0.4, -height * 0.15, 0);
        
        const rightTrackGeometry = new THREE.BoxGeometry(trackWidth, trackHeight, trackDepth);
        rightTrackGeometry.translate(-width * 0.4, -height * 0.15, 0);
        
        // Add material index attributes for each geometry
        hullGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(hullGeometry.attributes.position.count).fill(0), 1));
        leftTrackGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(leftTrackGeometry.attributes.position.count).fill(2), 1));
        rightTrackGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(rightTrackGeometry.attributes.position.count).fill(2), 1));
        
        // Merge geometries
        return BufferGeometryUtils.mergeBufferGeometries([
            hullGeometry,
            leftTrackGeometry,
            rightTrackGeometry
        ], true);
    }
    
    /**
     * Create a harvester mesh
     * @returns {THREE.BufferGeometry} Combined geometry for the harvester
     */
    createHarvesterMesh() {
        const width = this.unitData.width;
        const height = this.unitData.height;
        const depth = this.unitData.depth;
        
        // Base vehicle
        const baseGeometry = new THREE.BoxGeometry(width, height * 0.5, depth * 0.8);
        baseGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(baseGeometry.attributes.position.count).fill(0), 1));
        
        // Tracks
        const trackWidth = width * 0.3;
        const trackHeight = height * 0.3;
        const trackDepth = depth * 0.8;
        
        const leftTrackGeometry = new THREE.BoxGeometry(trackWidth, trackHeight, trackDepth);
        leftTrackGeometry.translate(width * 0.4, -height * 0.1, 0);
        leftTrackGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(leftTrackGeometry.attributes.position.count).fill(2), 1));
        
        const rightTrackGeometry = new THREE.BoxGeometry(trackWidth, trackHeight, trackDepth);
        rightTrackGeometry.translate(-width * 0.4, -height * 0.1, 0);
        rightTrackGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(rightTrackGeometry.attributes.position.count).fill(2), 1));
        
        // Cabin
        const cabinGeometry = new THREE.BoxGeometry(width * 0.6, height * 0.4, depth * 0.4);
        cabinGeometry.translate(0, height * 0.3, -depth * 0.2);
        cabinGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(cabinGeometry.attributes.position.count).fill(1), 1));
        
        // Harvester arm
        const armGeometry = new THREE.BoxGeometry(width * 0.2, height * 0.2, depth * 0.6);
        armGeometry.translate(0, height * 0.1, depth * 0.5);
        armGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(armGeometry.attributes.position.count).fill(3), 1));
        
        // Harvester scoop
        const scoopGeometry = new THREE.CylinderGeometry(height * 0.3, height * 0.3, width * 0.8, 8);
        scoopGeometry.rotateZ(Math.PI / 2);
        scoopGeometry.translate(0, height * 0.1, depth * 0.8);
        scoopGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(scoopGeometry.attributes.position.count).fill(3), 1));
        
        // Merge geometries
        return BufferGeometryUtils.mergeBufferGeometries([
            baseGeometry,
            leftTrackGeometry,
            rightTrackGeometry,
            cabinGeometry,
            armGeometry,
            scoopGeometry
        ], true);
    }
    
    /**
     * Create an MCV (Mobile Construction Vehicle) mesh
     * @returns {THREE.BufferGeometry} Combined geometry for the MCV
     */
    createMCVMesh() {
        const width = this.unitData.width;
        const height = this.unitData.height;
        const depth = this.unitData.depth;
        
        // Base vehicle
        const baseGeometry = new THREE.BoxGeometry(width, height * 0.5, depth);
        baseGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(baseGeometry.attributes.position.count).fill(0), 1));
        
        // Tracks
        const trackWidth = width * 0.3;
        const trackHeight = height * 0.3;
        const trackDepth = depth;
        
        const leftTrackGeometry = new THREE.BoxGeometry(trackWidth, trackHeight, trackDepth);
        leftTrackGeometry.translate(width * 0.4, -height * 0.1, 0);
        leftTrackGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(leftTrackGeometry.attributes.position.count).fill(2), 1));
        
        const rightTrackGeometry = new THREE.BoxGeometry(trackWidth, trackHeight, trackDepth);
        rightTrackGeometry.translate(-width * 0.4, -height * 0.1, 0);
        rightTrackGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(rightTrackGeometry.attributes.position.count).fill(2), 1));
        
        // Cabin
        const cabinGeometry = new THREE.BoxGeometry(width * 0.7, height * 0.4, depth * 0.5);
        cabinGeometry.translate(0, height * 0.3, -depth * 0.2);
        cabinGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(cabinGeometry.attributes.position.count).fill(1), 1));
        
        // Crane arm
        const armBaseGeometry = new THREE.BoxGeometry(width * 0.2, height * 0.6, width * 0.2);
        armBaseGeometry.translate(0, height * 0.5, 0);
        armBaseGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(armBaseGeometry.attributes.position.count).fill(3), 1));
        
        const armExtensionGeometry = new THREE.BoxGeometry(width * 0.6, height * 0.1, width * 0.1);
        armExtensionGeometry.translate(width * 0.3, height * 0.8, 0);
        armExtensionGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(armExtensionGeometry.attributes.position.count).fill(3), 1));
        
        // Merge geometries
        return BufferGeometryUtils.mergeBufferGeometries([
            baseGeometry,
            leftTrackGeometry,
            rightTrackGeometry,
            cabinGeometry,
            armBaseGeometry,
            armExtensionGeometry
        ], true);
    }
    
    /**
     * Create an APC (Armored Personnel Carrier) mesh
     * @returns {THREE.BufferGeometry} Combined geometry for the APC
     */
    createAPCMesh() {
        const width = this.unitData.width;
        const height = this.unitData.height;
        const depth = this.unitData.depth;
        
        // Base vehicle
        const baseGeometry = new THREE.BoxGeometry(width, height * 0.6, depth);
        baseGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(baseGeometry.attributes.position.count).fill(0), 1));
        
        // Tracks
        const trackWidth = width * 0.3;
        const trackHeight = height * 0.3;
        const trackDepth = depth;
        
        const leftTrackGeometry = new THREE.BoxGeometry(trackWidth, trackHeight, trackDepth);
        leftTrackGeometry.translate(width * 0.4, -height * 0.15, 0);
        leftTrackGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(leftTrackGeometry.attributes.position.count).fill(2), 1));
        
        const rightTrackGeometry = new THREE.BoxGeometry(trackWidth, trackHeight, trackDepth);
        rightTrackGeometry.translate(-width * 0.4, -height * 0.15, 0);
        rightTrackGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(rightTrackGeometry.attributes.position.count).fill(2), 1));
        
        // Sloped front
        const frontGeometry = new THREE.BoxGeometry(width, height * 0.4, depth * 0.3);
        const frontMatrix = new THREE.Matrix4();
        frontMatrix.makeRotationX(Math.PI / 6);
        frontMatrix.setPosition(0, height * 0.1, depth * 0.35);
        frontGeometry.applyMatrix4(frontMatrix);
        frontGeometry.setAttribute('materialIndex', new THREE.Float32BufferAttribute(new Array(frontGeometry.attributes.position.count).fill(1), 1));
        
        // Merge geometries
        return BufferGeometryUtils.mergeBufferGeometries([
            baseGeometry,
            leftTrackGeometry,
            rightTrackGeometry,
            frontGeometry
        ], true);
    }

    /**
     * Create a turret for attackable units
     */
    createTurret() {
        let turretGeometry, barrelGeometry;
        
        if (this.type === 'tank') {
            // Tank turret
            turretGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
            barrelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8);
        } else if (this.type === 'apc') {
            // APC turret (smaller)
            turretGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.4);
            barrelGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
        } else {
            // Default turret
            turretGeometry = new THREE.BoxGeometry(0.5, 0.25, 0.8);
            barrelGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
        }
        
        // Rotate barrel to point forward
        barrelGeometry.rotateZ(Math.PI / 2);
        
        const turretMaterial = new THREE.MeshStandardMaterial({
            color: this.player.getColor(),
            roughness: 0.6,
            metalness: 0.5
        });

        this.turret = new THREE.Mesh(turretGeometry, turretMaterial);
        this.turret.castShadow = true;
        this.turret.position.y = 0.25;
        this.turret.name = `turret_${this.type}_${this.player.id}`;

        const barrelMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.8,
            metalness: 0.6
        });

        this.barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        
        // Position barrel based on unit type
        if (this.type === 'tank') {
            this.barrel.position.z = 0.5;
        } else {
            this.barrel.position.z = 0.3;
        }
        
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
     * Create a selection hitbox for easier unit selection
     */
    createSelectionHitbox() {
        // Create a slightly larger invisible box for selection
        const hitboxWidth = this.unitData.width * 1.2;
        const hitboxHeight = this.unitData.height * 1.2;
        const hitboxDepth = this.unitData.depth * 1.2;

        const hitboxGeometry = new THREE.BoxGeometry(hitboxWidth, hitboxHeight, hitboxDepth);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            transparent: true,
            opacity: 0
        });

        this.selectionHitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        this.selectionHitbox.name = `hitbox_${this.type}_${this.player.id}`;
        this.selectionHitbox.userData.entity = this;
        this.mesh.add(this.selectionHitbox);
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
     * Update unit animations
     * @param {number} delta - Time delta
     */
    updateAnimation(delta) {
        // Only animate infantry units and dogs
        if (!['soldier', 'engineer', 'dog'].includes(this.type) || !this.limbParts) {
            return;
        }
        
        // Update animation time
        this.animationTime += delta * this.animationSpeed;
        
        // Determine animation state
        if (this.isMoving) {
            this.animationState = 'walk';
        } else {
            this.animationState = 'idle';
        }
        
        // Apply animations based on state
        if (this.animationState === 'walk') {
            this.applyWalkAnimation();
        } else {
            this.applyIdleAnimation();
        }
    }
    
    /**
     * Apply walk animation to limbs
     */
    applyWalkAnimation() {
        const walkCycle = Math.sin(this.animationTime * Math.PI * 2);
        const amplitude = 0.25; // How much the limbs move
        
        if (this.type === 'dog') {
            // Dog walk animation
            if (this.limbParts.frontLeftLeg) {
                this.limbParts.frontLeftLeg.rotation.x = walkCycle * amplitude;
            }
            if (this.limbParts.backRightLeg) {
                this.limbParts.backRightLeg.rotation.x = walkCycle * amplitude;
            }
            if (this.limbParts.frontRightLeg) {
                this.limbParts.frontRightLeg.rotation.x = -walkCycle * amplitude;
            }
            if (this.limbParts.backLeftLeg) {
                this.limbParts.backLeftLeg.rotation.x = -walkCycle * amplitude;
            }
            if (this.limbParts.tail) {
                this.limbParts.tail.rotation.y = Math.sin(this.animationTime * Math.PI * 4) * 0.2;
            }
        } else {
            // Human walk animation
            if (this.limbParts.leftLeg) {
                this.limbParts.leftLeg.rotation.x = walkCycle * amplitude;
            }
            if (this.limbParts.rightLeg) {
                this.limbParts.rightLeg.rotation.x = -walkCycle * amplitude;
            }
            if (this.limbParts.leftArm) {
                this.limbParts.leftArm.rotation.x = -walkCycle * amplitude * 0.5;
            }
            if (this.limbParts.rightArm) {
                this.limbParts.rightArm.rotation.x = walkCycle * amplitude * 0.5;
            }
        }
    }
    
    /**
     * Apply idle animation to limbs
     */
    applyIdleAnimation() {
        const idleCycle = Math.sin(this.animationTime * Math.PI);
        const amplitude = 0.05; // Subtle movement for idle
        
        if (this.type === 'dog') {
            // Dog idle animation - subtle breathing and tail wagging
            if (this.limbParts.tail) {
                this.limbParts.tail.rotation.y = Math.sin(this.animationTime * Math.PI * 2) * 0.15;
            }
        } else {
            // Human idle animation - subtle breathing
            if (this.limbParts.leftArm) {
                this.limbParts.leftArm.rotation.x = idleCycle * amplitude;
            }
            if (this.limbParts.rightArm) {
                this.limbParts.rightArm.rotation.x = idleCycle * amplitude;
            }
        }
        
        // Reset leg rotations for both types
        if (this.limbParts.leftLeg) {
            this.limbParts.leftLeg.rotation.x = 0;
        }
        if (this.limbParts.rightLeg) {
            this.limbParts.rightLeg.rotation.x = 0;
        }
        if (this.limbParts.frontLeftLeg) {
            this.limbParts.frontLeftLeg.rotation.x = 0;
        }
        if (this.limbParts.frontRightLeg) {
            this.limbParts.frontRightLeg.rotation.x = 0;
        }
        if (this.limbParts.backLeftLeg) {
            this.limbParts.backLeftLeg.rotation.x = 0;
        }
        if (this.limbParts.backRightLeg) {
            this.limbParts.backRightLeg.rotation.x = 0;
        }
    }

    /**
     * Update the unit
     * @param {number} delta - Time delta
     */
    update(delta) {
        // Update movement
        if (this.isMoving) {
            this.updateMovement(delta);
        }

        // Update combat
        if (this.isAttacking && this.target) {
            this.updateAttack(delta);
        }

        // Update harvesting
        if (this.isHarvesting) {
            this.updateHarvesting(delta);
        }

        // Update selection indicator
        if (this.selectionRing) {
            this.selectionRing.rotation.y += delta;
        }
        
        // Update animations
        this.updateAnimation(delta);
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
     * Deploy the unit (for MCV)
     * @returns {boolean} True if deployment was successful
     */
    deploy() {
        if (!this.canDeploy || !this.deployedBuilding) {
            return false;
        }

        // Check if the current position is valid for building
        const isValid = this.game.buildingManager.isValidBuildLocation(
            this.deployedBuilding,
            this.position,
            this.player
        );

        if (!isValid) {
            console.log('Cannot deploy here - invalid location');
            return false;
        }

        // Create the building
        const building = this.game.buildingManager.createBuilding(
            this.deployedBuilding,
            this.position,
            this.player
        );

        if (building) {
            // Remove this unit
            this.game.unitManager.removeUnit(this);
            return true;
        }

        return false;
    }

    /**
     * Clean up resources when unit is removed
     */
    cleanup() {
        // Remove selection helper if it exists
        if (this.selectionHelper) {
            this.mesh.remove(this.selectionHelper);
            this.selectionHelper = null;
        }

        // Remove selection hitbox if it exists
        if (this.selectionHitbox) {
            this.mesh.remove(this.selectionHitbox);
            this.selectionHitbox = null;
        }
        
        // Remove any event listeners, timers, etc.
    }

    /**
     * Capture an enemy building (for engineers)
     * @param {Object} building - Building to capture
     * @returns {boolean} True if capture was successful
     */
    captureBuilding(building) {
        // Only engineers can capture buildings
        if (this.type !== 'engineer' || !this.unitData.canCapture) {
            return false;
        }

        // Check if building is in range
        const distance = this.position.distanceTo(building.position);
        if (distance > this.unitData.captureRange + building.buildingData.width / 2) {
            // Move closer to the building first
            this.moveTo(building.position);
            return false;
        }

        // Can only capture enemy buildings
        if (building.player === this.player) {
            return false;
        }

        // Transfer ownership
        const oldPlayer = building.player;
        building.player = this.player;
        
        // Update building color to match new owner
        if (building.mesh) {
            building.mesh.material.color.set(this.player.getColor());
            
            // Update turret color if it exists
            if (building.turret) {
                building.turret.material.color.set(this.player.getColor());
            }
        }
        
        // Remove from old player's buildings list and add to new player's list
        oldPlayer.removeBuilding(building);
        this.player.addBuilding(building);
        
        // Engineer is consumed in the process
        this.game.unitManager.removeUnit(this);
        
        // Update UI if this building is selected
        if (building.isSelected) {
            this.game.uiManager.updateSelection(building);
        }
        
        return true;
    }
} 