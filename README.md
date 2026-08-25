# Cypher Connections

A visual investigation board module for Foundry VTT 14+. Create relationship maps, investigation cork boards, and connection webs with drag-and-drop items and customizable connections.

## Features

- **Visual Investigation Boards** — Create per-actor boards to track people, places, clues, and relationships
- **7 Item Types** — Person, Place, Item, Mystery, Journal, Image, and Placeholder
- **15 Connection Types** — Friendly, Hostile, Romantic, Family, Professional, Mysterious, and more
- **50 Connection Icons** — Font Awesome icons organized by category (Navigation, People, Objects, Nature, Magic, Danger, Knowledge, Symbols)
- **Drag & Drop** — Drag items to move them, drag between items to create connections
- **Pan & Zoom** — Navigate large boards with mouse wheel zoom and middle-click pan
- **Real-Time Sync** — Board changes synchronize between all connected users (toggleable)
- **Cypher Taskbar Integration** — Registers as a panel in the Cypher Taskbar system
- **Import / Export** — Share boards as JSON files
- **Connection Events** — Track dated events on each connection (e.g., "First met on 2024-01-15")
- **Dark Theme** — Matches the Cypher Taskbar visual style

## Installation

1. Copy the `cypher-connections` folder into your Foundry VTT `Data/modules/` directory.
2. Restart Foundry VTT.
3. Enable **Cypher Connections** in the Module Management screen.
4. Requires the **Cypher Taskbar** module for panel integration (optional — panel can be opened via API).

## Usage

### Opening a Board
- Via Cypher Taskbar: Click the **Connections** icon in the taskbar.
- Via API macro: `CypherConnections.openBoard(actorId)`

### Creating Items
- Click the **+** button to add an item.
- Drag from the Foundry sidebar (Actors, Items, Journals) onto the canvas.

### Creating Connections
- Left-click and hold on an item, drag to another item, then release.
- The connection dialog will open to customize the relationship.

### Canvas Controls
- **Mouse wheel**: Zoom in/out (centered on cursor)
- **Middle-click + drag**: Pan the canvas
- **Right-click**: Context menu

### API

```javascript
// Open the connections panel for an actor
await CypherConnections.openBoard(actorId);

// Get all boards for an actor
const boards = CypherConnections.getBoards(actorId);

// Create a new board
const board = await CypherConnections.createBoard(actorId, "My Board");

// Delete a board
await CypherConnections.deleteBoard(boardId);

// Export a board to JSON
const json = CypherConnections.exportBoard(boardId);

// Import a board from JSON
const imported = await CypherConnections.importBoard(jsonString, actorId);
```

## Module Settings

| Setting | Scope | Default | Description |
|---|---|---|---|
| Default Board Name | Client | Investigation Board | Default name for new boards |
| Show Grid | Client | true | Display a dot grid on the canvas |
| Snap to Grid | Client | false | Snap items to grid points |
| Connection Icon Size | Client | 24 | Default icon size for connections |
| Maximum Boards | World | 10 | Max boards per actor |
| Enable Real-Time Sync | Client | true | Broadcast changes to other users |

## Compatibility

- **Foundry VTT**: v14+
- **Required System**: Any (designed for Cypher System but works universally)
- **Dependencies**: `cypher-taskbar` (for panel integration)
- **Socket**: Required for real-time synchronization

## License

MIT License. See LICENSE file for details.
