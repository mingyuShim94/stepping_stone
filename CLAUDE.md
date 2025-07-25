# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a 3D browser-based game called "Stepping Stone" built with Three.js and Vite. The game features a character walking on a narrow bridge with physics-based falling mechanics, background music, and 3D animations.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production 
- `npm run preview` - Preview production build locally

### Development Workflow
- The project uses Vite as the build tool with ES modules
- No test framework is currently configured
- No linting tools are configured

## Architecture Overview

### Core Structure
- **Entry Point**: `src/main.js` - Initializes the game on DOM load
- **Game Engine**: `src/game/StackGame.js` - Main game class containing all Three.js logic
- **Styling**: `src/style.css` - Global styles and UI overlays
- **Assets**: 
  - `public/models/` - 3D GLTF models with animations
  - `public/music/` - Audio files (background music and sound effects)

### Game Architecture (StackGame.js)
The main game class follows a component-based structure:

**Core Systems**:
- **Scene Management**: Three.js scene, camera, renderer setup with shadows
- **Player System**: GLTF model loading with walking animations via AnimationMixer
- **Physics Engine**: Custom gravity, collision detection, and falling mechanics
- **Audio System**: HTML5 Audio with user interaction-based playback
- **Input Handling**: Keyboard controls (arrow keys + spacebar) with event listeners

**Key Components**:
- `init()` - Scene setup, lighting, and environment creation
- `createPlayer()` - GLTF model loading with fallback cube geometry
- `updatePlayerMovement()` - Character movement and collision detection
- `checkBridgeCollision()` - Physics-based bridge boundary checking
- `updateJump()` - Gravity simulation and landing detection
- `animate()` - Main game loop with requestAnimationFrame

### File Organization
```
src/
├── main.js              # Application entry point
├── style.css            # Global styles and UI
├── game/
│   └── StackGame.js     # Main game engine class
└── flutter/             # Flutter bridge (unused in current implementation)
    └── FlutterBridge.js
```

## Technical Details

### Dependencies
- **Three.js**: 3D graphics engine for WebGL rendering
- **Vite**: Build tool and development server
- **GLTF Loader**: Three.js addon for 3D model loading

### Game Mechanics
- **Movement**: Arrow keys control character direction with automatic rotation
- **Jumping**: Spacebar triggers jump with gravity physics
- **Bridge Physics**: Character falls if outside bridge boundaries (X: ±1.5, Z: -35 to 15)
- **Audio**: Background music starts on first user interaction, scream sound on falling
- **Respawn**: Character respawns at origin if falling below Y: -20

### Performance Considerations
- Uses PCF soft shadows for realistic lighting
- Fog effect for atmospheric depth
- Fallback geometry if GLTF model fails to load
- Animation mixer updates tied to delta time for smooth performance

## Development Notes

### Asset Loading
- GLTF models must include skinned animations for character movement
- Audio files require user interaction before playback (browser autoplay policy)
- All assets served from `public/` directory via Vite static serving

### Browser Compatibility
- Requires WebGL support for Three.js rendering
- Uses ES6 modules (modern browsers only)
- HTML5 Audio API for sound effects

### Future Considerations
- No state management system currently implemented
- No multiplayer networking
- Flutter bridge exists but is not integrated
- No persistent game data or scoring system