/**
 * @fileoverview ConnectionSystem - Manages Connection lifecycle on the investigation board.
 * Handles drag-to-connect, rendering, tooltips, editing, and context menus.
 */

import { CONNECTION_TYPES, MODULE_ID } from "./constants.js";
import { Connection } from "./data-model.js";
import { ConnectionDialog } from "./dialogs/connection-dialog.js";
import { ConnectionTooltip } from "./tooltips/connection-tooltip.js";

/**
 * Manages all connection operations on the board.
 */
export class ConnectionSystem {
  /**
   * @param {BoardCanvas} canvas - Reference to the board canvas instance.
   */
  constructor(canvas) {
    this.canvas = canvas;
    this._connections = new Map();  // connId -> Connection data
    this._tooltip = null;           // Current ConnectionTooltip instance
    this._pinnedTooltip = null;     // The currently pinned tooltip
    this._dragState = null;         // Active drag-to-connect state
    this._contextMenu = null;       // Current context menu element
  }

  /* -------------------------------------------- */
  /*  Drag-to-Connect                             */
  /* -------------------------------------------- */

  /**
   * Begin a drag-to-connect operation from a source item.
   * Creates a temporary SVG line following the mouse.
   * @param {string} fromItemId - Source item ID.
   * @param {MouseEvent} mouseEvent - The initiating mouse event.
   */
  startConnection(fromItemId, mouseEvent) {
    const fromItem = this.canvas.itemSystem?.getItem(fromItemId);
    if (!fromItem) return;

    this._dragState = {
      fromItemId,
      fromX: fromItem.x + (fromItem.width / 2),
      fromY: fromItem.y + (fromItem.height / 2),
      currentX: mouseEvent.clientX,
      currentY: mouseEvent.clientY
    };

    // Create temporary SVG line on the drag layer
    this.canvas.showDragLine(this._dragState.fromX, this._dragState.fromY);

    // Set up mouse move/up handlers on document
    this._boundOnMouseMove = this._onDragMouseMove.bind(this);
    this._boundOnMouseUp = this._onDragMouseUp.bind(this);
    document.addEventListener("mousemove", this._boundOnMouseMove);
    document.addEventListener("mouseup", this._boundOnMouseUp);
  }

  /**
   * Update the temporary line endpoint during drag.
   * @param {MouseEvent} mouseEvent
   */
  updateConnectionDrag(mouseEvent) {
    if (!this._dragState) return;

    this._dragState.currentX = mouseEvent.clientX;
    this._dragState.currentY = mouseEvent.clientY;

    const canvasCoords = this.canvas.screenToCanvas(mouseEvent.clientX, mouseEvent.clientY);
    this.canvas.updateDragLine(canvasCoords.x, canvasCoords.y);
  }

  /**
   * Complete the drag-to-connect operation.
   * If a valid target item is provided, opens ConnectionDialog.
   * If null or invalid, cancels the operation.
   * @param {string|null} toItemId - Target item ID, or null to cancel.
   */
  async completeConnection(toItemId) {
    // Clean up drag handlers and temp line
    this._cleanupDrag();

    if (!toItemId || toItemId === this._dragState?.fromItemId) {
      this._dragState = null;
      return;
    }

    const fromItem = this.canvas.itemSystem?.getItem(this._dragState.fromItemId);
    const toItem = this.canvas.itemSystem?.getItem(toItemId);

    if (!fromItem || !toItem) {
      this._dragState = null;
      return;
    }

    // Open connection creation dialog
    const connectionData = await ConnectionDialog.create(null, fromItem.toObject(), toItem.toObject());

    this._dragState = null;

    if (connectionData) {
      await this.createConnection({
        ...connectionData,
        fromId: fromItem.id,
        toId: toItem.id
      });
    }
  }

  /**
   * Cancel the current drag-to-connect operation.
   */
  cancelConnection() {
    this._cleanupDrag();
    this._dragState = null;
  }

  /**
   * Clean up drag event listeners and temporary line.
   * @private
   */
  _cleanupDrag() {
    if (this._boundOnMouseMove) {
      document.removeEventListener("mousemove", this._boundOnMouseMove);
      this._boundOnMouseMove = null;
    }
    if (this._boundOnMouseUp) {
      document.removeEventListener("mouseup", this._boundOnMouseUp);
      this._boundOnMouseUp = null;
    }
    this.canvas.hideDragLine();
  }

  /**
   * Handle mouse move during drag.
   * @private
   */
  _onDragMouseMove(event) {
    this.updateConnectionDrag(event);
  }

  /**
   * Handle mouse up during drag.
   * @private
   */
  async _onDragMouseUp(event) {
    // Determine if mouse is over a valid target item
    const targetEl = event.target.closest("[data-item-id]");
    const toItemId = targetEl?.dataset?.itemId || null;

    await this.completeConnection(toItemId);
  }

  /* -------------------------------------------- */
  /*  Connection CRUD                             */
  /* -------------------------------------------- */

  /**
   * Create a new connection.
   * @param {Object} data - Connection data including fromId, toId, and dialog results.
   * @returns {Object} The created connection data.
   */
  async createConnection(data) {
    const connection = new Connection({
      id: foundry.utils.randomID(),
      fromId: data.fromId,
      toId: data.toId,
      name: data.name || "",
      type: data.type || "unknown",
      icon: data.icon || "fa-link",
      iconSize: data.iconSize || 24,
      iconColor: data.iconColor || "#c9a227",
      tags: data.tags || [],
      description: data.description || "",
      events: data.events || []
    });

    this._connections.set(connection.id, connection);

    // Render on canvas
    this.canvas.renderConnection(connection);

    // Emit creation event for socket sync
    this._emit("connection.create", connection.toObject());

    return connection.toObject();
  }

  /**
   * Edit an existing connection.
   * @param {string} connId - The connection ID.
   */
  async editConnection(connId) {
    const connection = this._connections.get(connId);
    if (!connection) {
      ui.notifications.warn(game.i18n.localize("CYPHERCONNECTIONS.ErrorConnectionNotFound"));
      return;
    }

    const fromItem = this.canvas.itemSystem?.getItem(connection.fromId);
    const toItem = this.canvas.itemSystem?.getItem(connection.toId);

    if (!fromItem || !toItem) {
      ui.notifications.warn(game.i18n.localize("CYPHERCONNECTIONS.ErrorMissingItems"));
      return;
    }

    const result = await ConnectionDialog.create(
      connection.toObject(),
      fromItem.toObject(),
      toItem.toObject()
    );

    if (!result) return; // Cancelled

    // Handle deletion
    if (result.deleted) {
      await this.deleteConnection(connId);
      return;
    }

    // Apply updates
    connection.update({
      name: result.name,
      type: result.type,
      icon: result.icon,
      iconSize: result.iconSize,
      iconColor: result.iconColor,
      tags: result.tags,
      description: result.description,
      events: result.events
    });

    // Re-render on canvas
    this.canvas.renderConnection(connection);

    // Emit update event
    this._emit("connection.update", { id: connId, ...result });
  }

  /**
   * Delete a connection.
   * @param {string} connId - The connection ID.
   */
  async deleteConnection(connId) {
    const connection = this._connections.get(connId);
    if (!connection) return;

    // Hide any tooltip for this connection
    if (this._tooltip?.connectionData?.id === connId) {
      this.hideTooltip();
    }
    if (this._pinnedTooltip?.connectionData?.id === connId) {
      this._pinnedTooltip.destroy();
      this._pinnedTooltip = null;
    }

    // Remove from store
    this._connections.delete(connId);

    // Remove from canvas
    this.canvas.removeConnection(connId);

    // Emit deletion event
    this._emit("connection.delete", { id: connId });
  }

  /**
   * Delete all connections associated with a given item.
   * Called when an item is deleted.
   * @param {string} itemId - The item ID whose connections should be removed.
   */
  async deleteConnectionsForItem(itemId) {
    const toDelete = [];
    for (const [connId, connection] of this._connections) {
      if (connection.fromId === itemId || connection.toId === itemId) {
        toDelete.push(connId);
      }
    }
    for (const connId of toDelete) {
      await this.deleteConnection(connId);
    }
  }

  /* -------------------------------------------- */
  /*  Tooltip Management                          */
  /* -------------------------------------------- */

  /**
   * Show a connection tooltip in hover mode.
   * @param {string} connId - The connection ID.
   * @param {HTMLElement} anchor - The connection icon element.
   */
  async showTooltip(connId, anchor) {
    // Don't show hover tooltip if one is pinned
    if (this._pinnedTooltip) return;

    const connection = this._connections.get(connId);
    if (!connection) return;

    const fromItem = this.canvas.itemSystem?.getItem(connection.fromId);
    const toItem = this.canvas.itemSystem?.getItem(connection.toId);
    if (!fromItem || !toItem) return;

    // Hide any existing hover tooltip
    this.hideTooltip();

    this._tooltip = new ConnectionTooltip(connection.toObject(), fromItem.toObject(), toItem.toObject());
    await this._tooltip.show(anchor);
  }

  /**
   * Pin a connection tooltip (click-to-pin behavior).
   * @param {string} connId - The connection ID.
   * @param {HTMLElement} anchor - The connection icon element.
   */
  async pinTooltip(connId, anchor) {
    const connection = this._connections.get(connId);
    if (!connection) return;

    const fromItem = this.canvas.itemSystem?.getItem(connection.fromId);
    const toItem = this.canvas.itemSystem?.getItem(connection.toId);
    if (!fromItem || !toItem) return;

    // If clicking same pinned tooltip, unpin/hide it
    if (this._pinnedTooltip?.connectionData?.id === connId) {
      this._pinnedTooltip.hide();
      this._pinnedTooltip = null;
      return;
    }

    // Hide existing pinned tooltip
    if (this._pinnedTooltip) {
      this._pinnedTooltip.destroy();
      this._pinnedTooltip = null;
    }

    // Hide hover tooltip
    this.hideTooltip();

    // Create and pin new tooltip
    this._pinnedTooltip = new ConnectionTooltip(connection.toObject(), fromItem.toObject(), toItem.toObject());
    await this._pinnedTooltip.show(anchor);
    this._pinnedTooltip.pin();
  }

  /**
   * Hide the current hover tooltip.
   */
  hideTooltip() {
    if (this._tooltip) {
      this._tooltip.destroy();
      this._tooltip = null;
    }
  }

  /**
   * Hide the pinned tooltip.
   */
  hidePinnedTooltip() {
    if (this._pinnedTooltip) {
      this._pinnedTooltip.destroy();
      this._pinnedTooltip = null;
    }
  }

  /* -------------------------------------------- */
  /*  Icon Click Handlers                         */
  /* -------------------------------------------- */

  /**
   * Handle left-click on a connection icon.
   * Toggles pin state for the tooltip.
   * @param {string} connId - The connection ID.
   */
  async handleIconClick(connId, anchor) {
    await this.pinTooltip(connId, anchor);
  }

  /**
   * Handle right-click on a connection icon.
   * Opens the edit dialog.
   * @param {string} connId - The connection ID.
   */
  async handleIconRightClick(connId) {
    // Hide any pinned tooltip
    if (this._pinnedTooltip) {
      this._pinnedTooltip.destroy();
      this._pinnedTooltip = null;
    }

    await this.editConnection(connId);
  }

  /* -------------------------------------------- */
  /*  Context Menu                                */
  /* -------------------------------------------- */

  /**
   * Show a context menu for a connection.
   * @param {PointerEvent} event - The right-click event.
   * @param {string} connId - The connection ID.
   */
  showContextMenu(event, connId) {
    event.preventDefault();
    event.stopPropagation();

    this._hideContextMenu();

    const connection = this._connections.get(connId);
    if (!connection) return;

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
        <li class="context-divider"></li>
        <li class="context-item danger" data-action="delete">
          <i class="fas fa-trash"></i>
          <span>${game.i18n.localize("CYPHERCONNECTIONS.Delete")}</span>
        </li>
      </ul>
    `;

    document.body.appendChild(menu);
    this._contextMenu = menu;

    menu.addEventListener("click", (evt) => {
      const itemEl = evt.target.closest("[data-action]");
      if (!itemEl) return;

      const action = itemEl.dataset.action;
      this._hideContextMenu();

      switch (action) {
        case "edit":
          this.editConnection(connId);
          break;
        case "delete":
          this.deleteConnection(connId);
          break;
      }
    });

    const closeHandler = (evt) => {
      if (!menu.contains(evt.target)) {
        this._hideContextMenu();
        document.removeEventListener("click", closeHandler);
      }
    };
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
   * Get a connection by ID.
   * @param {string} connId
   * @returns {Connection|null}
   */
  getConnection(connId) {
    return this._connections.get(connId) || null;
  }

  /**
   * Get all connections.
   * @returns {Connection[]}
   */
  getAllConnections() {
    return Array.from(this._connections.values());
  }

  /**
   * Get connections involving a specific item.
   * @param {string} itemId
   * @returns {Connection[]}
   */
  getConnectionsForItem(itemId) {
    return this.getAllConnections().filter(
      conn => conn.fromId === itemId || conn.toId === itemId
    );
  }

  /**
   * Load connections from board data.
   * @param {Object[]} connectionsData - Array of Connection plain objects.
   */
  loadConnections(connectionsData) {
    this._connections.clear();
    for (const data of connectionsData) {
      const connection = new Connection(data);
      this._connections.set(connection.id, connection);
      this.canvas.renderConnection(connection);
    }
  }

  /**
   * Get plain object representation of all connections.
   * @returns {Object[]}
   */
  toObject() {
    return Array.from(this._connections.values()).map(conn => conn.toObject());
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
