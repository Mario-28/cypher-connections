/**
 * Data model classes for Cypher Connections.
 * Provides Board, BoardItem, and Connection with serialization support.
 *
 * @module data-model
 */

import { MODULE_ID, ITEM_SIZE } from "./constants.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a UUIDv4 string.
 * @returns {string} A randomly-generated UUID.
 */
function generateUUID() {
  return foundry.utils.randomID(16);
}

/**
 * Current Unix timestamp in milliseconds.
 * @returns {number}
 */
function now() {
  return Date.now();
}

// ---------------------------------------------------------------------------
// BoardItem
// ---------------------------------------------------------------------------

/**
 * Represents a single item (node) on an investigation board.
 */
export class BoardItem {
  /**
   * @param {Object} data
   * @param {string} [data.id]            - Unique identifier (auto-generated if omitted)
   * @param {string} data.boardId         - Parent board ID
   * @param {string} [data.type="placeholder"] - Item type key
   * @param {string} [data.name=""]       - Display name
   * @param {string} [data.img=""]        - Image path or icon identifier
   * @param {string} [data.description=""] - Description text
   * @param {number} [data.x=0]           - Canvas X position
   * @param {number} [data.y=0]           - Canvas Y position
   * @param {number} [data.width=ITEM_SIZE]  - Render width
   * @param {number} [data.height=ITEM_SIZE] - Render height
   * @param {number} [data.created]       - Creation timestamp
   */
  constructor(data) {
    this.id = data.id ?? generateUUID();
    this.boardId = data.boardId;
    this.type = data.type ?? "placeholder";
    this.name = data.name ?? "";
    this.img = data.img ?? "";
    this.description = data.description ?? "";
    this.x = data.x ?? 0;
    this.y = data.y ?? 0;
    this.width = data.width ?? ITEM_SIZE;
    this.height = data.height ?? ITEM_SIZE;
    this.created = data.created ?? now();
    // Appearance
    this.borderColor = data.borderColor ?? "";
    this.bgColor = data.bgColor ?? "";
    this.shape = data.shape ?? "rect";
    this.imgTransparency = data.imgTransparency ?? 1;
    this.imgFit = data.imgFit ?? "default";
    this.imgPosition = data.imgPosition ?? "center";
  }

  /**
   * Serialize to a plain object.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      boardId: this.boardId,
      type: this.type,
      name: this.name,
      img: this.img,
      description: this.description,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      created: this.created,
      borderColor: this.borderColor,
      bgColor: this.bgColor,
      shape: this.shape,
      imgTransparency: this.imgTransparency,
      imgFit: this.imgFit,
      imgPosition: this.imgPosition
    };
  }

  /**
   * Alias for toJSON() — called by item-system.js and connection-system.js.
   * @returns {Object}
   */
  toObject() {
    return this.toJSON();
  }

  /**
   * Rehydrate a BoardItem from a plain object.
   * @param {Object} data
   * @returns {BoardItem}
   */
  static fromJSON(data) {
    return new BoardItem(data);
  }
}

// ---------------------------------------------------------------------------
// ConnectionEvent
// ---------------------------------------------------------------------------

/**
 * Represents a dated event attached to a connection.
 */
export class ConnectionEvent {
  /**
   * @param {Object} data
   * @param {string} [data.id]       - Unique identifier (auto-generated if omitted)
   * @param {string} [data.name=""]  - Event name
   * @param {string} [data.date=""]  - ISO date string
   * @param {string} [data.description=""] - Event description
   */
  constructor(data) {
    this.id = data.id ?? generateUUID();
    this.name = data.name ?? "";
    this.date = data.date ?? "";
    this.description = data.description ?? "";
  }

  /**
   * Serialize to a plain object.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      date: this.date,
      description: this.description
    };
  }

  /**
   * Alias for toJSON() — consistency with other data model classes.
   * @returns {Object}
   */
  toObject() {
    return this.toJSON();
  }

  /**
   * Rehydrate a ConnectionEvent from a plain object.
   * @param {Object} data
   * @returns {ConnectionEvent}
   */
  static fromJSON(data) {
    return new ConnectionEvent(data);
  }
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

/**
 * Represents a relationship (edge) between two items on a board.
 */
export class Connection {
  /**
   * @param {Object} data
   * @param {string} [data.id]              - Unique identifier (auto-generated if omitted)
   * @param {string} data.boardId           - Parent board ID
   * @param {string} data.fromId            - Source item ID
   * @param {string} data.toId              - Target item ID
   * @param {string} [data.name=""]         - Connection name
   * @param {string} [data.type="unknown"]  - Connection type key
   * @param {string} [data.icon="fa-question-circle"] - Icon identifier
   * @param {number} [data.iconSize=24]     - Icon render size
   * @param {string} [data.iconColor="#c9a227"] - Icon color (hex)
   * @param {string[]} [data.tags=[]]       - Tag strings
   * @param {string} [data.description=""]  - Description text
   * @param {ConnectionEvent[]} [data.events=[]] - Attached events
   * @param {number} [data.created]         - Creation timestamp
   */
  constructor(data) {
    this.id = data.id ?? generateUUID();
    this.boardId = data.boardId;
    this.fromId = data.fromId;
    this.toId = data.toId;
    this.name = data.name ?? "";
    this.type = data.type ?? "unknown";
    this.icon = data.icon ?? "fa-question-circle";
    this.iconSize = data.iconSize ?? 24;
    this.iconColor = data.iconColor ?? "#c9a227";
    this.tags = data.tags ?? [];
    this.description = data.description ?? "";
    this.events = (data.events ?? []).map(e =>
      e instanceof ConnectionEvent ? e : ConnectionEvent.fromJSON(e)
    );
    this.created = data.created ?? now();
    // Line appearance
    this.lineColor = data.lineColor ?? "";
    this.lineStyle = data.lineStyle ?? "straight";
    this.lineWidth = data.lineWidth ?? 2;
    // Arrow heads
    this.arrowStyle = data.arrowStyle ?? "none";       // none | arrow | filled | diamond | circle
    this.arrowDirection = data.arrowDirection ?? "end"; // none | start | end | both
    this.arrowSize = data.arrowSize ?? 10;             // 4–24
  }

  /**
   * Serialize to a plain object.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      boardId: this.boardId,
      fromId: this.fromId,
      toId: this.toId,
      name: this.name,
      type: this.type,
      icon: this.icon,
      iconSize: this.iconSize,
      iconColor: this.iconColor,
      tags: foundry.utils.deepClone(this.tags),
      description: this.description,
      events: this.events.map(e => e.toJSON()),
      created: this.created,
      lineColor: this.lineColor,
      lineStyle: this.lineStyle,
      lineWidth: this.lineWidth,
      arrowStyle: this.arrowStyle,
      arrowDirection: this.arrowDirection,
      arrowSize: this.arrowSize
    };
  }

  /**
   * Alias for toJSON() — called by connection-system.js.
   * @returns {Object}
   */
  toObject() {
    return this.toJSON();
  }

  /**
   * Rehydrate a Connection from a plain object.
   * @param {Object} data
   * @returns {Connection}
   */
  static fromJSON(data) {
    return new Connection(data);
  }
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

/**
 * Represents an investigation board containing items and their connections.
 */
export class Board {
  /**
   * @param {Object} data
   * @param {string} [data.id]       - Unique identifier (auto-generated if omitted)
   * @param {string} [data.name=""]  - Board display name
   * @param {string} data.actorId    - Owning actor document ID
   * @param {string} [data.userId]   - Creator user ID (defaults to current user)
   * @param {BoardItem[]} [data.items=[]] - Items on the board
   * @param {Connection[]} [data.connections=[]] - Connections between items
   * @param {Object} [data.viewBox]  - Viewport transform
   * @param {number} [data.created]  - Creation timestamp
   * @param {number} [data.updated]  - Last-update timestamp
   */
  constructor(data) {
    this.id = data.id ?? generateUUID();
    this.name = data.name ?? "";
    this.actorId = data.actorId;
    this.userId = data.userId ?? game.userId;
    this.items = (data.items ?? []).map(i =>
      i instanceof BoardItem ? i : BoardItem.fromJSON(i)
    );
    this.connections = (data.connections ?? []).map(c =>
      c instanceof Connection ? c : Connection.fromJSON(c)
    );
    this.viewBox = {
      x: data.viewBox?.x ?? 0,
      y: data.viewBox?.y ?? 0,
      zoom: data.viewBox?.zoom ?? 1
    };
    this.created = data.created ?? now();
    this.updated = data.updated ?? now();
    // Board appearance
    this.bgColor = data.bgColor ?? "";
    this.bgImage = data.bgImage ?? "";
    this.bgImageTransparency = data.bgImageTransparency ?? 1;
    this.bgImagePosition = data.bgImagePosition ?? "center";
    this.bgImageFit = data.bgImageFit ?? "cover";
  }

  // -- Item operations ------------------------------------------------------

  /**
   * Add a new item to the board.
   * @param {Object} data - Raw item data (see BoardItem constructor)
   * @returns {BoardItem} The created item
   */
  addItem(data) {
    const item = new BoardItem({ ...data, boardId: this.id });
    this.items.push(item);
    this._touch();
    return item;
  }

  /**
   * Remove an item by ID, also removing any connections attached to it.
   * @param {string} id
   * @returns {boolean} True if an item was removed
   */
  removeItem(id) {
    const initialLen = this.items.length;
    this.items = this.items.filter(i => i.id !== id);
    // Cascade: remove connections involving this item
    this.connections = this.connections.filter(
      c => c.fromId !== id && c.toId !== id
    );
    const removed = this.items.length < initialLen;
    if (removed) this._touch();
    return removed;
  }

  /**
   * Apply partial updates to an existing item.
   * @param {string} id
   * @param {Object} updates
   * @returns {BoardItem|null} The updated item, or null if not found
   */
  updateItem(id, updates) {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;
    Object.assign(item, updates);
    this._touch();
    return item;
  }

  // -- Connection operations ------------------------------------------------

  /**
   * Add a new connection between two items.
   * @param {Object} data - Raw connection data (see Connection constructor)
   * @returns {Connection} The created connection
   */
  addConnection(data) {
    const conn = new Connection({ ...data, boardId: this.id });
    this.connections.push(conn);
    this._touch();
    return conn;
  }

  /**
   * Remove a connection by ID.
   * @param {string} id
   * @returns {boolean} True if a connection was removed
   */
  removeConnection(id) {
    const initialLen = this.connections.length;
    this.connections = this.connections.filter(c => c.id !== id);
    const removed = this.connections.length < initialLen;
    if (removed) this._touch();
    return removed;
  }

  /**
   * Apply partial updates to an existing connection.
   * @param {string} id
   * @param {Object} updates
   * @returns {Connection|null} The updated connection, or null if not found
   */
  updateConnection(id, updates) {
    const conn = this.connections.find(c => c.id === id);
    if (!conn) return null;
    Object.assign(conn, updates);
    this._touch();
    return conn;
  }

  // -- Serialization --------------------------------------------------------

  /**
   * Serialize the board (including all items and connections) to a plain object.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      actorId: this.actorId,
      userId: this.userId,
      items: this.items.map(i => i.toJSON()),
      connections: this.connections.map(c => c.toJSON()),
      viewBox: { ...this.viewBox },
      created: this.created,
      updated: this.updated,
      bgColor: this.bgColor,
      bgImage: this.bgImage,
      bgImageTransparency: this.bgImageTransparency,
      bgImagePosition: this.bgImagePosition,
      bgImageFit: this.bgImageFit
    };
  }

  /**
   * Alias for toJSON() — consistency with other data model classes.
   * @returns {Object}
   */
  toObject() {
    return this.toJSON();
  }

  /**
   * Rehydrate a Board from a plain object.
   * @param {Object} data
   * @returns {Board}
   */
  static fromJSON(data) {
    return new Board(data);
  }

  // -- Internal --------------------------------------------------------------

  /**
   * Update the `updated` timestamp.
   * @private
   */
  _touch() {
    this.updated = now();
  }
}
