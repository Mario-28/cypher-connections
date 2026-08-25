/**
 * @fileoverview ItemSystem - Manages BoardItem lifecycle on the investigation board.
 * Handles creation, editing, deletion, movement, tooltips, drag-drop, and context menus.
 */

import { ITEM_TYPES, MODULE_ID } from "./constants.js";
import { BoardItem } from "./data-model.js";
import { ItemDialog } from "./dialogs/item-dialog.js";
import { ItemTooltip } from "./tooltips/item-tooltip.js";

/**
 * Manages all board item operations.
 */
export class ItemSystem {
  /**
   * @param {BoardCanvas} canvas - Reference to the board canvas instance.
   */
  constructor(canvas) {
    this.canvas = canvas;
    this._items = new Map();       // itemId -> BoardItem data
    this._tooltip = null;          // Current ItemTooltip instance
    this._contextMenu = null;      // Current context menu element
  }

  /* -------------------------------------------- */
  /*  Item CRUD                                   */
  /* -------------------------------------------- */

  /**
   * Create a new board item.
   * If data is incomplete (no name/type), opens the ItemDialog first.
   * @param {Object} data - Partial item data. May include name, type, img, description.
   * @param {number} x - Canvas X position.
   * @param {number} y - Canvas Y position.
   * @returns {Promise<Object|null>} The created item data or null if cancelled.
   */
  async createItem(data = {}, x, y) {
    const isIncomplete = !data.name || !data.type;

    if (isIncomplete) {
      const dialogData = await ItemDialog.create(null);
      if (!dialogData) return null; // User cancelled

      data = foundry.utils.mergeObject(data, dialogData);
    }

    const typeData = ITEM_TYPES[data.type] || ITEM_TYPES.placeholder;

    const item = new BoardItem({
      id: foundry.utils.randomID(),
      name: data.name || game.i18n.localize("CYPHERCONNECTIONS.UnnamedItem"),
      type: data.type || "placeholder",
      img: data.img || "",
      description: data.description || "",
      x: x ?? 0,
      y: y ?? 0,
      width: 80,
      height: 80
    });

    this._items.set(item.id, item);

    // Render on canvas
    this.canvas.renderItem(item);

    // Emit creation event for socket sync
    this._emit("item.create", item.toObject());

    return item.toObject();
  }

  /**
   * Edit an existing item by opening the ItemDialog.
   * @param {string} itemId - The item ID to edit.
   * @returns {Promise<Object|null>} Updated item data or null if cancelled.
   */
  async editItem(itemId) {
    const item = this._items.get(itemId);
    if (!item) {
      ui.notifications.warn(game.i18n.localize("CYPHERCONNECTIONS.ErrorItemNotFound"));
      return null;
    }

    const itemData = item.toObject();
    const updatedData = await ItemDialog.create(itemData);

    if (!updatedData) return null; // User cancelled

    // Apply updates
    item.update(updatedData);

    // Re-render on canvas
    this.canvas.renderItem(item);

    // Emit update event for socket sync
    this._emit("item.update", { id: itemId, ...updatedData });

    return item.toObject();
  }

  /**
   * Delete an item and all its associated connections.
   * @param {string} itemId - The item ID to delete.
   */
  async deleteItem(itemId) {
    const item = this._items.get(itemId);
    if (!item) return;

    // Confirm deletion
    const confirmed = await Dialog.confirm({
      title: game.i18n.localize("CYPHERCONNECTIONS.ConfirmDeleteTitle"),
      content: `<p>${game.i18n.format("CYPHERCONNECTIONS.ConfirmDeleteItem", { name: item.name })}</p>`,
      defaultYes: false
    });

    if (!confirmed) return;

    // Remove associated connections
    this.canvas.connectionSystem?.deleteConnectionsForItem(itemId);

    // Remove from local store
    this._items.delete(itemId);

    // Remove from canvas
    this.canvas.removeItem(itemId);

    // Hide any active tooltip
    this.hideTooltip();

    // Emit deletion event for socket sync
    this._emit("item.delete", { id: itemId });
  }

  /**
   * Move an item to a new position.
   * @param {string} itemId - The item ID.
   * @param {number} x - New canvas X position.
   * @param {number} y - New canvas Y position.
   */
  moveItem(itemId, x, y) {
    const item = this._items.get(itemId);
    if (!item) return;

    item.x = x;
    item.y = y;

    // Update canvas rendering
    this.canvas.moveItem(itemId, x, y);

    // Emit position update for socket sync
    this._emit("item.update", { id: itemId, x, y });
  }

  /* -------------------------------------------- */
  /*  Tooltip Management                          */
  /* -------------------------------------------- */

  /**
   * Show an item tooltip near the given anchor element.
   * @param {string} itemId - The item ID.
   * @param {HTMLElement} anchor - The element to position the tooltip near.
   */
  async showTooltip(itemId, anchor) {
    const item = this._items.get(itemId);
    if (!item) return;

    // Hide any existing tooltip
    this.hideTooltip();

    this._tooltip = new ItemTooltip(item.toObject());
    await this._tooltip.show(anchor);
  }

  /**
   * Hide the current tooltip.
   */
  hideTooltip() {
    if (this._tooltip) {
      this._tooltip.destroy();
      this._tooltip = null;
    }
  }

  /* -------------------------------------------- */
  /*  Drag-Drop Handling                          */
  /* -------------------------------------------- */

  /**
   * Handle drops from the Foundry sidebar (Actors, Items, Journal Entries).
   * @param {DragEvent} event - The drop event.
   * @returns {Promise<Object|null>} The created item data or null.
   */
  async handleDrop(event) {
    event.preventDefault();

    const data = TextEditor.getDragEventData(event);
    if (!data) return null;

    // Get drop position in canvas coordinates
    const canvasCoords = this.canvas.screenToCanvas(event.clientX, event.clientY);

    switch (data.type) {
      case "Actor":
        return this._createItemFromActor(data, canvasCoords.x, canvasCoords.y);
      case "Item":
        return this._createItemFromItem(data, canvasCoords.x, canvasCoords.y);
      case "JournalEntry":
      case "JournalEntryPage":
        return this._createItemFromJournal(data, canvasCoords.x, canvasCoords.y);
      default:
        // Unsupported drop type
        return null;
    }
  }

  /**
   * Create a board item from a dropped Actor.
   * @private
   */
  async _createItemFromActor(data, x, y) {
    const actor = fromUuidSync(data.uuid);
    if (!actor) return null;

    const itemType = this._inferItemTypeFromActor(actor);

    return this.createItem({
      name: actor.name || game.i18n.localize("CYPHERCONNECTIONS.UnnamedItem"),
      type: itemType,
      img: actor.img || "",
      description: (actor.system?.biography || "").substring(0, 500)
    }, x, y);
  }

  /**
   * Create a board item from a dropped Item.
   * @private
   */
  async _createItemFromItem(data, x, y) {
    const item = fromUuidSync(data.uuid);
    if (!item) return null;

    return this.createItem({
      name: item.name || game.i18n.localize("CYPHERCONNECTIONS.UnnamedItem"),
      type: "item",
      img: item.img || "",
      description: (item.system?.description || "").substring(0, 500)
    }, x, y);
  }

  /**
   * Create a board item from a dropped Journal Entry.
   * @private
   */
  async _createItemFromJournal(data, x, y) {
    const entry = fromUuidSync(data.uuid);
    if (!entry) return null;

    return this.createItem({
      name: entry.name || game.i18n.localize("CYPHERCONNECTIONS.UnnamedItem"),
      type: "journal",
      img: entry.img || "",
      description: (entry.pages?.contents[0]?.text?.content || "").substring(0, 500)
    }, x, y);
  }

  /**
   * Infer item type from Actor data.
   * @private
   */
  _inferItemTypeFromActor(actor) {
    const types = actor.type?.toLowerCase() || "";
    if (types.includes("npc") || types.includes("character")) return "person";
    if (types.includes("place") || types.includes("scene")) return "place";
    if (types.includes("container") || types.includes("item")) return "item";
    return "person";
  }

  /* -------------------------------------------- */
  /*  Context Menu                                */
  /* -------------------------------------------- */

  /**
   * Show a context menu for an item.
   * @param {PointerEvent} event - The right-click event.
   * @param {string} itemId - The item ID.
   */
  showContextMenu(event, itemId) {
    event.preventDefault();
    event.stopPropagation();

    // Hide any existing menu
    this._hideContextMenu();

    const item = this._items.get(itemId);
    if (!item) return;

    // Build context menu HTML
    const menu = document.createElement("div");
    menu.className = "cypher-connections context-menu";
    menu.style.position = "fixed";
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.style.zIndex = "var(--z-index-tooltip, 1000)";
    menu.innerHTML = `
      <ul class="context-menu-list">
        <li class="context-item" data-action="edit">
          <i class="fas fa-pen-to-square"></i>
          <span>${game.i18n.localize("CYPHERCONNECTIONS.Edit")}</span>
        </li>
        <li class="context-item" data-action="connect">
          <i class="fas fa-link"></i>
          <span>${game.i18n.localize("CYPHERCONNECTIONS.Connect")}</span>
        </li>
        <li class="context-divider"></li>
        <li class="context-item danger" data-action="delete">
          <i class="fas fa-trash"></i>
          <span>${game.i18n.localize("CYPHERCONNECTIONS.Delete")}</span>
        </li>
      </ul>
    `;

    document.body.appendChild(menu);
    this._contextMenu = menu;

    // Menu item click handler
    menu.addEventListener("click", (evt) => {
      const itemEl = evt.target.closest("[data-action]");
      if (!itemEl) return;

      const action = itemEl.dataset.action;
      this._hideContextMenu();

      switch (action) {
        case "edit":
          this.editItem(itemId);
          break;
        case "connect":
          this.canvas.startConnectionDrag(itemId, event);
          break;
        case "delete":
          this.deleteItem(itemId);
          break;
      }
    });

    // Close menu on click elsewhere
    const closeHandler = (evt) => {
      if (!menu.contains(evt.target)) {
        this._hideContextMenu();
        document.removeEventListener("click", closeHandler);
      }
    };
    // Delay to avoid immediate close from the right-click itself
    setTimeout(() => {
      document.addEventListener("click", closeHandler);
    }, 50);
  }

  /**
   * Hide and remove the context menu.
   * @private
   */
  _hideContextMenu() {
    if (this._contextMenu && this._contextMenu.parentNode) {
      this._contextMenu.parentNode.removeChild(this._contextMenu);
    }
    this._contextMenu = null;
  }

  /* -------------------------------------------- */
  /*  Data Access                                 */
  /* -------------------------------------------- */

  /**
   * Get an item by ID.
   * @param {string} itemId
   * @returns {BoardItem|null}
   */
  getItem(itemId) {
    return this._items.get(itemId) || null;
  }

  /**
   * Get all items.
   * @returns {BoardItem[]}
   */
  getAllItems() {
    return Array.from(this._items.values());
  }

  /**
   * Load items from board data.
   * @param {Object[]} itemsData - Array of BoardItem plain objects.
   */
  loadItems(itemsData) {
    this._items.clear();
    for (const data of itemsData) {
      const item = new BoardItem(data);
      this._items.set(item.id, item);
      this.canvas.renderItem(item);
    }
  }

  /**
   * Get plain object representation of all items for persistence.
   * @returns {Object[]}
   */
  toObject() {
    return Array.from(this._items.values()).map(item => item.toObject());
  }

  /* -------------------------------------------- */
  /*  Socket Emission                             */
  /* -------------------------------------------- */

  /**
   * Emit a socket event for multi-user sync.
   * @private
   */
  _emit(eventType, data) {
    if (!game.socket) return;
    const payload = {
      action: eventType,
      boardId: this.canvas?.boardId,
      data,
      userId: game.user?.id
    };
    game.socket.emit(`module.${MODULE_ID}`, payload);
  }
}
