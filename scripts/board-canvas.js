/**
 * @fileoverview BoardCanvas - SVG-based interactive canvas for Cypher Connections.
 * Handles rendering of items, connections, pan/zoom, drag-to-connect,
 * and all canvas-level interactions.
 */

import { MODULE_ID, ITEM_TYPES, CONNECTION_TYPES, ITEM_SIZE } from "./constants.js";
import { Connection } from "./data-model.js";

/**
 * SVG canvas component for rendering and interacting with investigation boards.
 */
export class BoardCanvas {
  /**
   * @param {BoardPanel} panel - The parent BoardPanel instance
   * @param {HTMLElement} containerElement - DOM element to mount the SVG into
   */
  constructor(panel, containerElement) {
    this.panel = panel;
    this.containerElement = containerElement;

    /** @type {SVGSVGElement|null} */
    this.svg = null;

    /** @type {SVGGElement|null} */
    this.gridLayer = null;

    /** @type {SVGGElement|null} */
    this.connectionsLayer = null;

    /** @type {SVGGElement|null} */
    this.itemsLayer = null;

    /** @type {SVGGElement|null} */
    this.dragLayer = null;

    /** @type {SVGRectElement|null} */
    this.captureRect = null;

    /** @type {Board|null} */
    this.currentBoard = null;

    // Pan/Zoom state
    this.viewBox = { x: -400, y: -300, width: 800, height: 600, zoom: 1 };

    // Drag state
    this._dragState = {
      isDragging: false,
      isPanning: false,
      isConnecting: false,
      dragItemId: null,
      dragStartX: 0,
      dragStartY: 0,
      lastX: 0,
      lastY: 0,
      connectFromId: null,
      tempLine: null
    };

    // Selection state
    this._selectedItems = new Set();

    // Bound event handlers (for proper cleanup)
    this._boundOnWheel = this._onWheel.bind(this);
    this._boundOnCanvasMouseDown = this._onCanvasMouseDown.bind(this);
    this._boundOnCanvasMouseMove = this._onCanvasMouseMove.bind(this);
    this._boundOnCanvasMouseUp = this._onCanvasMouseUp.bind(this);
    this._boundOnContextMenu = this._onContextMenu.bind(this);
    this._boundOnItemMouseDown = this._onItemMouseDown.bind(this);
    this._boundOnItemDblClick = this._onItemDblClick.bind(this);
    this._boundOnItemMouseEnter = this._onItemMouseEnter.bind(this);
    this._boundOnItemMouseLeave = this._onItemMouseLeave.bind(this);
  }

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /**
   * Initialize the SVG canvas, set up event listeners, and render initial state.
   */
  async init() {
    await this._createSVGElement();
    this._setupEventListeners();
  }

  /**
   * Create the SVG element and structure.
   * @private
   */
  async _createSVGElement() {
    // Get the current board data for viewBox initialization
    // Data model stores viewBox as {x, y, zoom} — derive width/height from zoom
    const board = this.panel.getCurrentBoard();
    const boardId = board?.id || "default";

    if (board?.viewBox) {
      const zoom = board.viewBox.zoom || 1;
      this.viewBox = {
        x: board.viewBox.x ?? -400,
        y: board.viewBox.y ?? -300,
        width: 800 / zoom,
        height: 600 / zoom,
        zoom: zoom
      };
    }

    // Build SVG HTML using template data
    const templateData = {
      board: {
        id: boardId,
        viewBox: this.viewBox
      },
      showGrid: this.panel.showGrid
    };

    // Render template safely via Foundry's renderTemplate
    const template = "modules/cypher-connections/templates/board-canvas.hbs";
    const html = await renderTemplate(template, templateData);

    this.containerElement.innerHTML = html;

    // Cache references to SVG elements
    this.svg = this.containerElement.querySelector(".board-canvas-svg");
    this.gridLayer = this.svg.querySelector("[data-grid-layer]");
    this.connectionsLayer = this.svg.querySelector("[data-connections-layer]");
    this.itemsLayer = this.svg.querySelector("[data-items-layer]");
    this.dragLayer = this.svg.querySelector("[data-drag-layer]");
    this.captureRect = this.svg.querySelector("[data-canvas-capture]");

    // Set initial viewBox
    this._updateViewBox();
  }

  /**
   * Set up all event listeners on the SVG canvas.
   * @private
   */
  _setupEventListeners() {
    if (!this.svg) return;

    // Canvas-level events (use capture rect for pointer events)
    this.captureRect?.addEventListener("mousedown", this._boundOnCanvasMouseDown);
    this.captureRect?.addEventListener("wheel", this._boundOnWheel, { passive: false });
    this.captureRect?.addEventListener("contextmenu", this._boundOnContextMenu);

    // Global mouse move/up for drag operations that go outside SVG
    document.addEventListener("mousemove", this._boundOnCanvasMouseMove);
    document.addEventListener("mouseup", this._boundOnCanvasMouseUp);

    // Item events (delegated through items-layer)
    this.itemsLayer?.addEventListener("mousedown", this._boundOnItemMouseDown);
    this.itemsLayer?.addEventListener("dblclick", this._boundOnItemDblClick);
  }

  /**
   * Remove all event listeners.
   * @private
   */
  _removeEventListeners() {
    this.captureRect?.removeEventListener("mousedown", this._boundOnCanvasMouseDown);
    this.captureRect?.removeEventListener("wheel", this._boundOnWheel);
    this.captureRect?.removeEventListener("contextmenu", this._boundOnContextMenu);

    document.removeEventListener("mousemove", this._boundOnCanvasMouseMove);
    document.removeEventListener("mouseup", this._boundOnCanvasMouseUp);

    this.itemsLayer?.removeEventListener("mousedown", this._boundOnItemMouseDown);
    this.itemsLayer?.removeEventListener("dblclick", this._boundOnItemDblClick);
  }

  /* -------------------------------------------- */
  /*  Board Rendering                             */
  /* -------------------------------------------- */

  /**
   * Render a full board: clear existing content and render all items and connections.
   * @param {Board} boardData - The board data to render
   */
  async renderBoard(boardData) {
    this.currentBoard = boardData;

    // Update viewBox from board data — data model stores {x, y, zoom}
    if (boardData.viewBox) {
      const zoom = boardData.viewBox.zoom || 1;
      this.viewBox = {
        x: boardData.viewBox.x ?? -400,
        y: boardData.viewBox.y ?? -300,
        width: 800 / zoom,
        height: 600 / zoom,
        zoom: zoom
      };
      this._updateViewBox();
    }

    // Clear all layers
    this.clear();

    // Update grid visibility
    this.toggleGrid(this.panel.showGrid);

    // Render all connections first (so they appear behind items)
    if (boardData.connections) {
      for (const conn of boardData.connections) {
        await this._renderConnectionElement(conn);
      }
    }

    // Render all items
    if (boardData.items) {
      for (const item of boardData.items) {
        await this._renderItemElement(item);
      }
    }
  }

  /**
   * Clear all rendered content from the canvas.
   */
  clear() {
    if (this.connectionsLayer) {
      this.connectionsLayer.innerHTML = "";
    }
    if (this.itemsLayer) {
      this.itemsLayer.innerHTML = "";
    }
    if (this.dragLayer) {
      this.dragLayer.innerHTML = "";
    }
    this._selectedItems.clear();
  }

  /* -------------------------------------------- */
  /*  Item Rendering                              */
  /* -------------------------------------------- */

  /**
   * Render or update an item node on the canvas.
   * @param {BoardItem} item - The item data
   */
  async renderItem(item) {
    // Remove existing element if present
    const existing = this.itemsLayer?.querySelector(`[data-item-id="${item.id}"]`);
    if (existing) {
      existing.remove();
    }

    await this._renderItemElement(item);
  }

  /**
   * Create an SVG element for an item.
   * @param {BoardItem} item
   * @private
   */
  async _renderItemElement(item) {
    if (!this.itemsLayer) return;

    const itemType = ITEM_TYPES[item.type] || ITEM_TYPES.placeholder;
    const hasValidImage = item.img && !item.img.startsWith("fa-");
    const defaultIcon = itemType.defaultIcon;
    const itemColor = itemType.color;
    const board = this.panel.getCurrentBoard();

    // Build template data
    const templateData = {
      item,
      itemType,
      hasValidImage,
      defaultIcon,
      itemColor,
      boardId: board?.id || "default"
    };

    // Render template safely via Foundry's renderTemplate
    const template = "modules/cypher-connections/templates/item-node.hbs";
    const html = await renderTemplate(template, templateData);

    // Parse SVG string to DOM element
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<svg>${html}</svg>`, "image/svg+xml");
    const itemGroup = doc.querySelector(".item-node");

    if (itemGroup) {
      // Import into current document
      const imported = document.importNode(itemGroup, true);
      this.itemsLayer.appendChild(imported);

      // Re-apply transform since it may not carry over
      imported.setAttribute("transform", `translate(${item.x}, ${item.y})`);
    }
  }

  /**
   * Remove an item SVG element and all its connected connections.
   * @param {string} id - Item ID to remove
   */
  removeItem(id) {
    // Remove item element
    const itemEl = this.itemsLayer?.querySelector(`[data-item-id="${id}"]`);
    if (itemEl) {
      itemEl.remove();
    }

    // Remove all connections involving this item
    const connEls = this.connectionsLayer?.querySelectorAll(
      `[data-from-id="${id}"], [data-to-id="${id}"]`
    );
    connEls?.forEach(el => el.remove());

    this._selectedItems.delete(id);
  }

  /* -------------------------------------------- */
  /*  Connection Rendering                        */
  /* -------------------------------------------- */

  /**
   * Render or update a connection on the canvas.
   * @param {Connection} conn - The connection data
   */
  async renderConnection(conn) {
    // Remove existing element if present
    const existing = this.connectionsLayer?.querySelector(`[data-conn-id="${conn.id}"]`);
    if (existing) {
      existing.remove();
    }

    await this._renderConnectionElement(conn);
  }

  /**
   * Create an SVG element for a connection.
   * @param {Connection} conn
   * @private
   */
  async _renderConnectionElement(conn) {
    if (!this.connectionsLayer) return;

    const board = this.panel.getCurrentBoard();
    if (!board?.items) return;

    // Find source and target items
    const fromItem = board.items.find(i => i.id === conn.fromId);
    const toItem = board.items.find(i => i.id === conn.toId);
    if (!fromItem || !toItem) return;

    // Calculate path
    const fromCenter = this._getItemCenter(fromItem);
    const toCenter = this._getItemCenter(toItem);
    const pathD = this._calculateBezierPath(fromCenter, toCenter);

    // Calculate midpoint
    const midpoint = this._calculateMidpoint(fromCenter, toCenter);

    // Get connection styling
    const connType = CONNECTION_TYPES.find(t => t.id === conn.type);
    const connColor = connType?.color || "#9e9e9e";
    const iconSize = conn.iconSize || 24;
    const iconColor = conn.iconColor || "#c9a227";

    // Map icon identifier to Font Awesome unicode
    const connectionIcon = this._resolveIcon(conn.icon);

    // Build template data
    const templateData = {
      connection: conn,
      pathD,
      midpoint,
      connColor,
      iconSize,
      iconColor,
      connectionIcon,
      boardId: board?.id || "default"
    };

    // Render template safely via Foundry's renderTemplate
    const template = "modules/cypher-connections/templates/connection-line.hbs";
    const html = await renderTemplate(template, templateData);

    // Parse SVG string to DOM element
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<svg>${html}</svg>`, "image/svg+xml");
    const connGroup = doc.querySelector(".connection-group");

    if (connGroup) {
      const imported = document.importNode(connGroup, true);
      this.connectionsLayer.appendChild(imported);

      // Set the stroke color on the visible path
      const path = imported.querySelector(".connection-path");
      if (path) {
        path.style.color = connColor;
      }

      // Add hover handlers for the connection group
      imported.addEventListener("mouseenter", () => {
        imported.classList.add("hover");
        const mp = imported.querySelector("[data-conn-midpoint]");
        if (mp) mp.style.transform = `translate(${midpoint.x}px, ${midpoint.y}px) scale(1.2)`;
      });
      imported.addEventListener("mouseleave", () => {
        imported.classList.remove("hover");
        const mp = imported.querySelector("[data-conn-midpoint]");
        if (mp) mp.style.transform = `translate(${midpoint.x}px, ${midpoint.y}px) scale(1)`;
      });
      imported.addEventListener("click", () => {
        this._onConnectionClick(conn);
      });
    }
  }

  /**
   * Remove a connection SVG element.
   * @param {string} id - Connection ID to remove
   */
  removeConnection(id) {
    const connEl = this.connectionsLayer?.querySelector(`[data-conn-id="${id}"]`);
    if (connEl) {
      connEl.remove();
    }
  }

  /* -------------------------------------------- */
  /*  Geometry Helpers                            */
  /* -------------------------------------------- */

  /**
   * Calculate the center point of an item node.
   * @param {BoardItem} item
   * @returns {{x: number, y: number}}
   */
  _getItemCenter(item) {
    const w = item.width || ITEM_SIZE;
    const h = item.height || ITEM_SIZE;
    return {
      x: item.x + w / 2,
      y: item.y + h / 2
    };
  }

  /**
   * Calculate a bezier curve path between two points.
   * @param {{x: number, y: number}} from
   * @param {{x: number, y: number}} to
   * @returns {string} SVG path d attribute
   */
  _calculateBezierPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Control point offset based on distance
    const offset = Math.min(dist * 0.4, 200);

    // Determine if connection is more horizontal or vertical
    const isHorizontal = Math.abs(dx) > Math.abs(dy);

    let c1x, c1y, c2x, c2y;
    if (isHorizontal) {
      c1x = from.x + offset;
      c1y = from.y;
      c2x = to.x - offset;
      c2y = to.y;
    } else {
      c1x = from.x;
      c1y = from.y + offset;
      c2x = to.x;
      c2y = to.y - offset;
    }

    return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
  }

  /**
   * Calculate the midpoint of a bezier curve between two items.
   * @param {{x: number, y: number}} from
   * @param {{x: number, y: number}} to
   * @returns {{x: number, y: number}}
   */
  _calculateMidpoint(from, to) {
    // Simple midpoint for straight line; bezier midpoint approximated
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return {
      x: from.x + dx * 0.5,
      y: from.y + dy * 0.5
    };
  }

  /**
   * Find an item at the given canvas coordinates.
   * @param {number} x - Canvas X coordinate
   * @param {number} y - Canvas Y coordinate
   * @returns {string|null} Item ID if found, null otherwise
   */
  _findItemAt(x, y) {
    if (!this.currentBoard?.items) return null;

    // Check in reverse order (topmost first)
    const items = [...this.currentBoard.items].reverse();
    for (const item of items) {
      const w = item.width || ITEM_SIZE;
      const h = item.height || ITEM_SIZE;
      if (x >= item.x && x <= item.x + w && y >= item.y && y <= item.y + h) {
        return item.id;
      }
    }
    return null;
  }

  /**
   * Convert screen coordinates to SVG canvas coordinates.
   * @param {number} sx - Screen X
   * @param {number} sy - Screen Y
   * @returns {{x: number, y: number}}
   */
  _screenToCanvas(sx, sy) {
    if (!this.svg) return { x: 0, y: 0 };

    const pt = this.svg.createSVGPoint();
    pt.x = sx;
    pt.y = sy;

    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };

    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
  }

  /**
   * Resolve an icon identifier to its display representation.
   * @param {string} iconId - Icon identifier
   * @returns {string}
   * @private
   */
  _resolveIcon(iconId) {
    // Return the icon identifier; Font Awesome classes are handled in rendering
    // For SVG text elements, we use Unicode characters or the identifier
    // This can be expanded to map icon IDs to specific Unicode codepoints
    return iconId || "\uf128"; // Default: fa-question
  }

  /* -------------------------------------------- */
  /*  Pan / Zoom                                  */
  /* -------------------------------------------- */

  /**
   * Update the SVG viewBox attribute from current state.
   * @private
   */
  _updateViewBox() {
    if (!this.svg) return;
    const { x, y, width, height } = this.viewBox;
    this.svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  }

  /**
   * Pan the canvas by the given delta.
   * @param {number} dx - Delta X in canvas coordinates
   * @param {number} dy - Delta Y in canvas coordinates
   */
  pan(dx, dy) {
    this.viewBox.x += dx;
    this.viewBox.y += dy;
    this._updateViewBox();
    this._updateGridPosition();
  }

  /**
   * Zoom by a factor, optionally centered on a point.
   * @param {number} factor - Zoom multiplier (e.g., 1.2 for zoom in, 0.8 for zoom out)
   * @param {{x: number, y: number}} [center] - Center point in canvas coordinates
   */
  zoom(factor, center) {
    const oldWidth = this.viewBox.width;
    const oldHeight = this.viewBox.height;

    // Calculate new dimensions
    const newWidth = oldWidth / factor;
    const newHeight = oldHeight / factor;

    // Calculate zoom center (default to center of current view)
    const cx = center ? center.x : this.viewBox.x + oldWidth / 2;
    const cy = center ? center.y : this.viewBox.y + oldHeight / 2;

    // Adjust viewBox to keep center point stable
    this.viewBox.x = cx - newWidth / 2;
    this.viewBox.y = cy - newHeight / 2;
    this.viewBox.width = newWidth;
    this.viewBox.height = newHeight;
    this.viewBox.zoom *= factor;

    this._updateViewBox();
    this._updateGridPosition();
  }

  /**
   * Reset zoom to default level.
   */
  resetZoom() {
    this.viewBox = { x: -400, y: -300, width: 800, height: 600, zoom: 1 };
    this._updateViewBox();
    this._updateGridPosition();
  }

  /**
   * Toggle grid visibility.
   * @param {boolean} show - Whether to show the grid
   */
  toggleGrid(show) {
    if (!this.gridLayer) return;

    const board = this.panel.getCurrentBoard();
    const boardId = board?.id || "default";

    if (show) {
      this.gridLayer.innerHTML = `
        <rect
          x="${this.viewBox.x}"
          y="${this.viewBox.y}"
          width="${this.viewBox.width}"
          height="${this.viewBox.height}"
          fill="url(#line-grid-pattern-${boardId})"
          pointer-events="none"
        />
      `;
    } else {
      this.gridLayer.innerHTML = "";
    }
  }

  /**
   * Update grid position to match current viewBox.
   * @private
   */
  _updateGridPosition() {
    if (!this.panel.showGrid || !this.gridLayer) return;

    const rect = this.gridLayer.querySelector("rect");
    if (rect) {
      rect.setAttribute("x", this.viewBox.x);
      rect.setAttribute("y", this.viewBox.y);
      rect.setAttribute("width", this.viewBox.width);
      rect.setAttribute("height", this.viewBox.height);
    }
  }

  /**
   * Get the current viewBox state in data-model format.
   * @returns {{x: number, y: number, zoom: number}}
   */
  getViewBox() {
    return {
      x: this.viewBox.x,
      y: this.viewBox.y,
      zoom: this.viewBox.zoom
    };
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle mouse wheel for zooming.
   * @param {WheelEvent} event
   */
  _onWheel(event) {
    event.preventDefault();

    const rect = this.svg.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const canvasPos = this._screenToCanvas(screenX, screenY);

    // Determine zoom direction
    const delta = event.deltaY;
    const factor = delta < 0 ? 1.15 : 0.87;

    this.zoom(factor, canvasPos);
  }

  /**
   * Handle mouse down on the canvas background.
   * @param {MouseEvent} event
   */
  _onCanvasMouseDown(event) {
    // Only handle events on the capture rect or items layer background
    if (event.target !== this.captureRect && !event.target.closest("[data-canvas-capture]")) {
      return;
    }

    // Middle mouse or Space+left = pan
    if (event.button === 1 || (event.button === 0 && event.ctrlKey)) {
      event.preventDefault();
      this._dragState.isPanning = true;
      this._dragState.lastX = event.clientX;
      this._dragState.lastY = event.clientY;
      this.svg.style.cursor = "grabbing";
      return;
    }

    // Left click on canvas = start selection box or deselect
    if (event.button === 0) {
      // Deselect all items
      this._selectedItems.clear();
      this._updateSelectionVisuals();
    }
  }

  /**
   * Handle mouse down on an item node.
   * @param {MouseEvent} event
   */
  _onItemMouseDown(event) {
    const itemNode = event.target.closest(".item-node");
    if (!itemNode) return;

    const itemId = itemNode.dataset.itemId;
    if (!itemId) return;

    // Don't interfere with tab close buttons or other controls
    if (event.target.closest(".tab-close")) return;

    event.preventDefault();
    event.stopPropagation();

    // Right-click = context menu (handled separately)
    if (event.button === 2) return;

    // Alt/Shift + click = start drag-to-connect
    if (event.altKey || event.shiftKey) {
      this._startDragConnection(itemId, event);
      return;
    }

    // Regular left-click = select and/or start drag
    const isSelected = this._selectedItems.has(itemId);

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+click = toggle selection
      if (isSelected) {
        this._selectedItems.delete(itemId);
      } else {
        this._selectedItems.add(itemId);
      }
    } else {
      // Regular click = select single, start drag
      if (!isSelected) {
        this._selectedItems.clear();
        this._selectedItems.add(itemId);
      }
    }

    this._updateSelectionVisuals();

    // Start dragging the item(s)
    this._dragState.isDragging = true;
    this._dragState.dragItemId = itemId;
    this._dragState.dragStartX = event.clientX;
    this._dragState.dragStartY = event.clientY;
  }

  /**
   * Handle double-click on an item node.
   * @param {MouseEvent} event
   */
  _onItemDblClick(event) {
    const itemNode = event.target.closest(".item-node");
    if (!itemNode) return;

    const itemId = itemNode.dataset.itemId;
    if (!itemId) return;

    event.preventDefault();
    event.stopPropagation();

    // Open item edit dialog
    const board = this.panel.getCurrentBoard();
    const item = board?.items?.find(i => i.id === itemId);
    if (item) {
      // Import and open the item dialog
      import("./dialogs/item-dialog.js").then(({ ItemDialog }) => {
        ItemDialog.create(item, this.panel);
      }).catch(err => {
        console.error("Failed to open ItemDialog:", err);
      });
    }
  }

  /**
   * Handle mouse enter on an item node.
   * @param {MouseEvent} event
   */
  _onItemMouseEnter(event) {
    const itemNode = event.target.closest(".item-node");
    if (itemNode) {
      itemNode.classList.add("hover");
    }
  }

  /**
   * Handle mouse leave on an item node.
   * @param {MouseEvent} event
   */
  _onItemMouseLeave(event) {
    const itemNode = event.target.closest(".item-node");
    if (itemNode) {
      itemNode.classList.remove("hover");
    }
  }

  /**
   * Handle mouse move (for drag, pan, and connect operations).
   * @param {MouseEvent} event
   */
  _onCanvasMouseMove(event) {
    // Handle panning
    if (this._dragState.isPanning) {
      const dxScreen = event.clientX - this._dragState.lastX;
      const dyScreen = event.clientY - this._dragState.lastY;

      // Convert screen delta to canvas delta
      const canvasDelta = this._screenDeltaToCanvasDelta(dxScreen, dyScreen);

      this.pan(-canvasDelta.x, -canvasDelta.y);
      this._dragState.lastX = event.clientX;
      this._dragState.lastY = event.clientY;
      return;
    }

    // Handle item dragging
    if (this._dragState.isDragging && this._dragState.dragItemId) {
      const dxScreen = event.clientX - this._dragState.dragStartX;
      const dyScreen = event.clientY - this._dragState.dragStartY;

      const canvasDelta = this._screenDeltaToCanvasDelta(dxScreen, dyScreen);

      // Update all selected items visually
      for (const selectedId of this._selectedItems) {
        const itemEl = this.itemsLayer?.querySelector(`[data-item-id="${selectedId}"]`);
        const item = this.currentBoard?.items?.find(i => i.id === selectedId);
        if (itemEl && item) {
          const newX = item.x + canvasDelta.x;
          const newY = item.y + canvasDelta.y;
          itemEl.setAttribute("transform", `translate(${newX}, ${newY})`);
        }
      }
      return;
    }

    // Handle drag-to-connect
    if (this._dragState.isConnecting) {
      this._updateDragLine(event);
    }
  }

  /**
   * Handle mouse up (end drag, pan, or connect operations).
   * @param {MouseEvent} event
   */
  _onCanvasMouseUp(event) {
    // End panning
    if (this._dragState.isPanning) {
      this._dragState.isPanning = false;
      this.svg.style.cursor = "";
      return;
    }

    // End item dragging
    if (this._dragState.isDragging && this._dragState.dragItemId) {
      const dxScreen = event.clientX - this._dragState.dragStartX;
      const dyScreen = event.clientY - this._dragState.dragStartY;
      const canvasDelta = this._screenDeltaToCanvasDelta(dxScreen, dyScreen);

      // Persist new positions for all selected items
      for (const selectedId of this._selectedItems) {
        const item = this.currentBoard?.items?.find(i => i.id === selectedId);
        if (item) {
          let newX = item.x + canvasDelta.x;
          let newY = item.y + canvasDelta.y;

          // Snap to grid if enabled
          if (this.panel.snapToGrid) {
            newX = Math.round(newX / 40) * 40;
            newY = Math.round(newY / 40) * 40;
          }

          this.panel.updateItem(selectedId, { x: newX, y: newY });
        }
      }

      this._dragState.isDragging = false;
      this._dragState.dragItemId = null;

      // Re-render to update connections
      this.panel._persistBoards().then(async () => {
        await this._refreshConnections();
      });
      return;
    }

    // End drag-to-connect
    if (this._dragState.isConnecting) {
      this._endDragConnection(event);
    }
  }

  /**
   * Handle right-click context menu.
   * @param {MouseEvent} event
   */
  _onContextMenu(event) {
    event.preventDefault();

    const canvasPos = this._screenToCanvas(
      event.offsetX,
      event.offsetY
    );

    // Check if clicking on an item
    const itemId = this._findItemAt(canvasPos.x, canvasPos.y);

    const menuItems = [];

    if (itemId) {
      const board = this.panel.getCurrentBoard();
      const item = board?.items?.find(i => i.id === itemId);

      menuItems.push(
        {
          name: game.i18n.localize("CYPHERCONNECTIONS.ITEM.editItem"),
          icon: '<i class="fas fa-edit"></i>',
          callback: () => {
            import("./dialogs/item-dialog.js").then(({ ItemDialog }) => {
              ItemDialog.create(item, this.panel);
            });
          }
        },
        {
          name: game.i18n.localize("CYPHERCONNECTIONS.ITEM.connectTo"),
          icon: '<i class="fas fa-link"></i>',
          callback: () => this._startDragConnection(itemId, event)
        },
        {
          name: game.i18n.localize("CYPHERCONNECTIONS.ITEM.deleteItem"),
          icon: '<i class="fas fa-trash"></i>',
          callback: () => this.panel.removeItem(itemId)
        }
      );
    } else {
      // Canvas context menu
      menuItems.push(
        {
          name: game.i18n.localize("CYPHERCONNECTIONS.ITEM.addItemHere"),
          icon: '<i class="fas fa-plus"></i>',
          callback: () => {
            this.panel.addItem({
              x: canvasPos.x - ITEM_SIZE / 2,
              y: canvasPos.y - ITEM_SIZE / 2,
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              type: "placeholder",
              name: game.i18n.localize("CYPHERCONNECTIONS.ITEM.newItem")
            });
          }
        }
      );
    }

    // Show context menu
    const menu = new foundry.applications.ux.ContextMenuV2({
      items: menuItems,
      x: event.clientX,
      y: event.clientY
    });
    menu.render();
  }

  /**
   * Handle click on a connection midpoint.
   * @param {Connection} conn
   * @private
   */
  _onConnectionClick(conn) {
    const board = this.panel.getCurrentBoard();
    if (!board) return;

    const fromItem = board.items?.find(i => i.id === conn.fromId);
    const toItem = board.items?.find(i => i.id === conn.toId);

    // Open connection dialog
    import("./dialogs/connection-dialog.js").then(({ ConnectionDialog }) => {
      ConnectionDialog.create(conn, fromItem, toItem, this.panel);
    }).catch(err => {
      console.error("Failed to open ConnectionDialog:", err);
    });
  }

  /* -------------------------------------------- */
  /*  Drag-to-Connect                             */
  /* -------------------------------------------- */

  /**
   * Start a drag-to-connect operation from an item.
   * @param {string} fromItemId - Source item ID
   * @param {MouseEvent} event - Mouse event
   */
  _startDragConnection(fromItemId, event) {
    const board = this.panel.getCurrentBoard();
    const fromItem = board?.items?.find(i => i.id === fromItemId);
    if (!fromItem) return;

    this._dragState.isConnecting = true;
    this._dragState.connectFromId = fromItemId;

    // Create temporary line in drag layer
    const fromCenter = this._getItemCenter(fromItem);
    const tempLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tempLine.setAttribute("class", "temp-connect-line");
    tempLine.setAttribute("fill", "none");
    tempLine.setAttribute("stroke", "#c9a227");
    tempLine.setAttribute("stroke-width", "2");
    tempLine.setAttribute("stroke-dasharray", "6 4");
    tempLine.setAttribute("pointer-events", "none");

    const mousePos = this._screenToCanvas(event.clientX, event.clientY);
    const d = `M ${fromCenter.x} ${fromCenter.y} L ${mousePos.x} ${mousePos.y}`;
    tempLine.setAttribute("d", d);

    this.dragLayer?.appendChild(tempLine);
    this._dragState.tempLine = tempLine;
  }

  /**
   * Update the temporary drag line during a connect operation.
   * @param {MouseEvent} event
   */
  _updateDragLine(event) {
    if (!this._dragState.tempLine) return;

    const board = this.panel.getCurrentBoard();
    const fromItem = board?.items?.find(i => i.id === this._dragState.connectFromId);
    if (!fromItem) return;

    const fromCenter = this._getItemCenter(fromItem);
    const mousePos = this._screenToCanvas(event.clientX, event.clientY);

    // Use bezier curve for the temp line
    const dx = mousePos.x - fromCenter.x;
    const dy = mousePos.y - fromCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const offset = Math.min(dist * 0.4, 200);
    const isHorizontal = Math.abs(dx) > Math.abs(dy);

    let c1x, c1y, c2x, c2y;
    if (isHorizontal) {
      c1x = fromCenter.x + offset;
      c1y = fromCenter.y;
      c2x = mousePos.x - offset;
      c2y = mousePos.y;
    } else {
      c1x = fromCenter.x;
      c1y = fromCenter.y + offset;
      c2x = mousePos.x;
      c2y = mousePos.y - offset;
    }

    const d = `M ${fromCenter.x} ${fromCenter.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${mousePos.x} ${mousePos.y}`;
    this._dragState.tempLine.setAttribute("d", d);
  }

  /**
   * End a drag-to-connect operation.
   * @param {MouseEvent} event
   */
  _endDragConnection(event) {
    // Clean up temp line
    if (this._dragState.tempLine) {
      this._dragState.tempLine.remove();
      this._dragState.tempLine = null;
    }

    const fromItemId = this._dragState.connectFromId;
    this._dragState.isConnecting = false;
    this._dragState.connectFromId = null;

    // Check if dropped on an item
    const canvasPos = this._screenToCanvas(event.clientX, event.clientY);
    const toItemId = this._findItemAt(canvasPos.x, canvasPos.y);

    if (!toItemId || toItemId === fromItemId) return;

    const board = this.panel.getCurrentBoard();
    const fromItem = board?.items?.find(i => i.id === fromItemId);
    const toItem = board?.items?.find(i => i.id === toItemId);

    if (!fromItem || !toItem) return;

    // Open connection dialog to configure the new connection
    import("./dialogs/connection-dialog.js").then(({ ConnectionDialog }) => {
      ConnectionDialog.create(
        { fromId: fromItemId, toId: toItemId },
        fromItem,
        toItem,
        this.panel
      );
    }).catch(err => {
      console.error("Failed to open ConnectionDialog:", err);
    });
  }

  /* -------------------------------------------- */
  /*  Selection Visuals                           */
  /* -------------------------------------------- */

  /**
   * Update the visual selection state of all items.
   * @private
   */
  _updateSelectionVisuals() {
    if (!this.itemsLayer) return;

    const allItems = this.itemsLayer.querySelectorAll(".item-node");
    allItems.forEach(el => {
      const itemId = el.dataset.itemId;
      const selectRect = el.querySelector("[data-node-select]");
      const bgRect = el.querySelector("[data-node-bg]");

      if (this._selectedItems.has(itemId)) {
        el.classList.add("selected");
        if (selectRect) selectRect.setAttribute("opacity", "0.7");
        if (bgRect) {
          const filterId = `url(#glow-strong-${this.currentBoard?.id || "default"})`;
          bgRect.setAttribute("filter", filterId);
        }
      } else {
        el.classList.remove("selected");
        if (selectRect) selectRect.setAttribute("opacity", "0");
        if (bgRect) {
          const filterId = `url(#node-shadow-${this.currentBoard?.id || "default"})`;
          bgRect.setAttribute("filter", filterId);
        }
      }
    });
  }

  /* -------------------------------------------- */
  /*  Refresh Helpers                             */
  /* -------------------------------------------- */

  /**
   * Refresh all connection rendering (after item moves).
   * @private
   */
  async _refreshConnections() {
    if (!this.currentBoard?.connections) return;

    this.connectionsLayer.innerHTML = "";
    for (const conn of this.currentBoard.connections) {
      await this._renderConnectionElement(conn);
    }
  }

  /**
   * Convert a screen delta to canvas delta.
   * @param {number} dxScreen
   * @param {number} dyScreen
   * @returns {{x: number, y: number}}
   * @private
   */
  _screenDeltaToCanvasDelta(dxScreen, dyScreen) {
    if (!this.svg) return { x: dxScreen, y: dyScreen };

    // Use the SVG CTM to convert screen deltas to canvas deltas
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: dxScreen, y: dyScreen };

    return {
      x: dxScreen / ctm.a,
      y: dyScreen / ctm.d
    };
  }

  /* -------------------------------------------- */
  /*  Cleanup                                     */
  /* -------------------------------------------- */

  /**
   * Destroy the canvas, clean up all event listeners and references.
   */
  destroy() {
    this._removeEventListeners();

    if (this.containerElement) {
      this.containerElement.innerHTML = "";
    }

    this.svg = null;
    this.gridLayer = null;
    this.connectionsLayer = null;
    this.itemsLayer = null;
    this.dragLayer = null;
    this.captureRect = null;
    this.currentBoard = null;
  }
}
