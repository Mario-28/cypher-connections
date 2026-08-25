/**
 * Cypher Connections — Board Panel (DOM-based, bulletproof)
 *
 * A plain-DOM floating panel. No ApplicationV2, no Handlebars, no mixins.
 * Just creates a div, positions it, and manages everything via DOM APIs.
 * This is the most reliable approach for Foundry V14+ modules.
 */

import { MODULE_ID, ITEM_TYPES, CONNECTION_TYPES, ITEM_SIZE, resolveIconUnicode } from "./constants.js";
import { Board, BoardItem, Connection } from "./data-model.js";
import { BoardSettingsDialog } from "./dialogs/board-settings-dialog.js";

// Track the one panel instance per actor
const _panels = new Map(); // actorId -> panel instance

/**
 * Simple DOM-based panel for Cypher Connections.
 * Creates a floating div on the page, no ApplicationV2 needed.
 */
export class BoardPanel {

  /**
   * Open or bring-to-front the panel for the given actor.
   * If panel is already open, close it (toggle behaviour).
   * @param {Actor} actor - Foundry Actor document
   * @param {{x:number,y:number}} [anchor] - Optional anchor point to open near
   * @returns {BoardPanel|null}
   */
  static async open(actor, anchor) {
    if (!actor) {
      ui.notifications.warn("No actor assigned. Please set a character in User Configuration.");
      return null;
    }

    // Check if panel already exists for this actor
    const existing = _panels.get(actor.id);
    if (existing) {
      if (existing._isVisible) {
        existing.close();
        return null;
      }
      existing.show();
      existing.bringToFront();
      return existing;
    }

    // Create new panel
    const panel = new BoardPanel(actor);
    _panels.set(actor.id, panel);
    await panel.render(anchor);
    return panel;
  }

  /**
   * Check if a panel is currently open for the given actor ID.
   * Used by module.js for toggle behaviour.
   * @param {string} actorId
   * @returns {BoardPanel|undefined}
   */
  static getOpenPanel(actorId) {
    const panel = _panels.get(actorId);
    return panel?._isVisible ? panel : undefined;
  }

  /* -------------------------------------------- */
  /*  Constructor                                 */
  /* -------------------------------------------- */

  constructor(actor) {
    this.actor = actor;
    this.boards = [];
    this.activeBoardId = null;
    this.element = null;      // Root panel DOM element
    this._isVisible = true;
    this._dragState = null;
    this._resizeState = null;
    this._connectMode = null;
    this._connectOnMouseMove = null;
    this._connectOnClick = null;
    this._connectOnKeyDown = null;
    this._dragTabState = null;  // Tab drag reorder state

    // Settings
    this.showGrid = game.settings.get(MODULE_ID, "showGrid") ?? true;
    this.snapToGrid = game.settings.get(MODULE_ID, "snapToGrid") ?? false;
  }

  /* -------------------------------------------- */
  /*  Render / DOM Creation                       */
  /* -------------------------------------------- */

  async render(anchor) {
    await this._loadBoards();
    this._loadSavedPosition();

    if (!this.element) {
      this._createDOM(anchor);
      this._attachEvents();
      document.body.appendChild(this.element);
    }

    this._renderTabs();
    this._renderContent();
    this.show();
  }

  /**
   * Create the full panel DOM tree from scratch.
   */
  _createDOM(anchor) {
    // Determine initial position and size: saved > anchor above > default
    let initialTop = 100, initialLeft = 100;
    let initialW = 800, initialH = 600;
    if (this._savedPosition) {
      initialTop = this._savedPosition.top;
      initialLeft = this._savedPosition.left;
      initialW = this._savedPosition.width;
      initialH = this._savedPosition.height;
    } else if (anchor) {
      // Position panel above the anchor (taskbar button)
      initialTop = Math.max(10, anchor.y - initialH - 10);
      initialLeft = Math.max(10, anchor.x - initialW / 2);
    }

    const el = document.createElement("div");
    el.className = "cc-panel";
    el.dataset.actorId = this.actor.id;
    el.style.cssText = `
      position: fixed;
      top: ${initialTop}px;
      left: ${initialLeft}px;
      width: ${initialW}px;
      height: ${initialH}px;
      background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid #2a2a4a;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      z-index: 50;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      overflow: hidden;
      font-family: var(--font-primary, "Signika", sans-serif);
      font-size: 13px;
      color: #e8e8e8;
    `;

    // === Header / Drag Handle ===
    const header = document.createElement("div");
    header.className = "cc-panel-header";
    header.style.cssText = `
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: linear-gradient(90deg, #0f3460, #1a1a2e);
      border-bottom: 1px solid #2a2a4a;
      cursor: grab;
      user-select: none;
      gap: 8px;
    `;

    const title = document.createElement("span");
    title.className = "cc-panel-title";
    title.textContent = `${this.actor.name} — Connections`;
    title.style.cssText = `flex:1;font-weight:600;color:#c9a227;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;

    const btnInfo = this._makeHeaderBtn("fa-info-circle", "Controls Help");
    btnInfo.style.color = "#3a8fd4";
    const btnClose = this._makeHeaderBtn("fa-times", "Close");
    btnClose.style.color = "#f44336";

    header.append(title, btnInfo, btnClose);
    this._headerEl = header;
    this._titleEl = title;

    // Resize handle (top-right corner grip)
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "cc-resize-handle";
    resizeHandle.title = "Resize";
    resizeHandle.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      z-index: 10;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      padding: 2px;
    `;
    resizeHandle.innerHTML = `<i class="fas fa-grip-lines" style="font-size:10px;color:#666;transform:rotate(45deg);"></i>`;
    el.appendChild(resizeHandle);
    this._resizeHandle = resizeHandle;

    // === Tab Bar ===
    const tabBar = document.createElement("div");
    tabBar.className = "cc-panel-tabs";
    tabBar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-bottom: 1px solid #2a2a4a;
      background: rgba(15,52,96,0.3);
      overflow-x: auto;
    `;
    this._tabBarEl = tabBar;

    // Add-tab button
    const addTabBtn = document.createElement("button");
    addTabBtn.className = "cc-tab cc-tab-add";
    addTabBtn.innerHTML = '<i class="fas fa-plus"></i>';
    addTabBtn.title = "Add Board";
    addTabBtn.style.cssText = `
      background: transparent;
      border: 1px dashed #3a3a5a;
      color: #c9a227;
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      flex-shrink: 0;
    `;
    addTabBtn.addEventListener("click", () => this._onAddBoard());
    this._addTabBtn = addTabBtn;

    // === Content Area ===
    const content = document.createElement("div");
    content.className = "cc-panel-content";
    content.style.cssText = `
      flex: 1;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;
    this._contentEl = content;

    // === Toolbar ===
    const toolbar = document.createElement("div");
    toolbar.className = "cc-panel-toolbar";
    toolbar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-top: 1px solid #2a2a4a;
      background: rgba(15,52,96,0.3);
    `;

    toolbar.innerHTML = `
      <button class="cc-tb-btn" data-action="zoom-in" title="Zoom In"><i class="fas fa-plus"></i></button>
      <button class="cc-tb-btn" data-action="zoom-reset" title="Reset Zoom"><i class="fas fa-compress"></i></button>
      <button class="cc-tb-btn" data-action="zoom-out" title="Zoom Out"><i class="fas fa-minus"></i></button>
      <span class="cc-tb-divider"></span>
      <button class="cc-tb-btn ${this.showGrid ? "active" : ""}" data-action="toggle-grid" title="Toggle Grid"><i class="fas fa-border-all"></i></button>
      <button class="cc-tb-btn ${this.snapToGrid ? "active" : ""}" data-action="snap-grid" title="Snap to Grid"><i class="fas fa-magnet"></i></button>
      <span class="cc-tb-divider"></span>
      <button class="cc-tb-btn" data-action="add-item" title="Add Item"><i class="fas fa-plus-circle"></i></button>
      <div style="flex:1"></div>
      <span class="cc-tb-info" style="color:#888;font-size:11px;"></span>
    `;
    this._toolbarEl = toolbar;

    // Wire toolbar buttons
    toolbar.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._onToolbarAction(btn.dataset.action, btn);
      });
    });

    // Header buttons
    btnInfo.addEventListener("click", () => this._showControlsHelp());
    btnClose.addEventListener("click", async () => await this.close());

    // Assemble
    el.append(header, tabBar, content, toolbar);
    this.element = el;
  }

  _makeHeaderBtn(icon, title) {
    const btn = document.createElement("button");
    btn.innerHTML = `<i class="fas ${icon}"></i>`;
    btn.title = title;
    btn.style.cssText = `
      background: none;
      border: none;
      color: #b0b0b0;
      cursor: pointer;
      padding: 2px 6px;
      font-size: 12px;
      border-radius: 3px;
      transition: color 0.15s;
    `;
    btn.addEventListener("mouseenter", () => btn.style.color = "#e8e8e8");
    btn.addEventListener("mouseleave", () => btn.style.color = "#b0b0b0");
    return btn;
  }

  /* -------------------------------------------- */
  /*  Tab Rendering                               */
  /* -------------------------------------------- */

  _renderTabs() {
    // Clear existing tabs (keep the add button)
    this._tabBarEl.innerHTML = "";

    for (const board of this.boards) {
      const tab = document.createElement("button");
      tab.className = `cc-tab ${board.id === this.activeBoardId ? "active" : ""}`;
      tab.dataset.boardId = board.id;
      tab.style.cssText = `
        background: ${board.id === this.activeBoardId ? "#0f3460" : "transparent"};
        border: 1px solid ${board.id === this.activeBoardId ? "#c9a227" : "#2a2a4a"};
        color: ${board.id === this.activeBoardId ? "#c9a227" : "#b0b0b0"};
        border-radius: 4px;
        padding: 4px 10px;
        cursor: pointer;
        font-size: 12px;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s;
        flex-shrink: 0;
      `;

      const nameSpan = document.createElement("span");
      nameSpan.textContent = board.name;
      nameSpan.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        this._onRenameBoard(board.id, nameSpan, tab);
      });

      const closeX = document.createElement("span");
      closeX.innerHTML = "&times;";
      closeX.style.cssText = "margin-left:4px;opacity:0.5;font-weight:bold;";
      closeX.addEventListener("mouseenter", () => closeX.style.opacity = "1");
      closeX.addEventListener("mouseleave", () => closeX.style.opacity = "0.5");
      closeX.addEventListener("click", (e) => {
        e.stopPropagation();
        this._onDeleteBoard(board.id);
      });

      tab.append(nameSpan, closeX);
      tab.addEventListener("click", () => this._onSwitchBoard(board.id));

      // Tab drag reorder
      tab.draggable = true;
      tab.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", board.id);
        e.dataTransfer.effectAllowed = "move";
        tab.style.opacity = "0.5";
      });
      tab.addEventListener("dragend", () => {
        tab.style.opacity = "";
        this._tabBarEl.querySelectorAll(".cc-tab").forEach(t => t.style.borderLeft = "");
      });
      tab.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      tab.addEventListener("drop", async (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === board.id) return;
        const draggedIdx = this.boards.findIndex(b => b.id === draggedId);
        const targetIdx = this.boards.findIndex(b => b.id === board.id);
        if (draggedIdx === -1 || targetIdx === -1) return;
        // Reorder: remove dragged, insert at target position
        const [draggedBoard] = this.boards.splice(draggedIdx, 1);
        this.boards.splice(targetIdx, 0, draggedBoard);
        await this._persistBoards();
        this._renderTabs();
      });

      // Right-click context menu on tab
      tab.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Remove any existing tab context menu
        document.querySelectorAll(".cc-tab-context-menu").forEach(m => m.remove());

        const menu = document.createElement("div");
        menu.className = "cc-tab-context-menu";
        menu.style.cssText = `
          position: fixed; z-index: 500; background: linear-gradient(180deg,#1a1a2e,#16213e);
          border: 1px solid #2a2a4a; border-radius: 6px; padding: 4px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5); min-width: 160px;
          font-family: var(--font-primary,'Signika',sans-serif); font-size: 13px;
        `;
        menu.innerHTML = `
          <div class="cc-ctx-item" data-action="settings" style="padding:6px 10px;cursor:pointer;color:#e8e8e8;border-radius:4px;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-cog" style="color:#c9a227;width:16px;"></i> Board Settings
          </div>
          <div style="border-top:1px solid #2a2a4a;margin:2px 0;"></div>
          <div class="cc-ctx-item" data-action="delete" style="padding:6px 10px;cursor:pointer;color:#f44336;border-radius:4px;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-trash" style="color:#f44336;width:16px;"></i> Delete
          </div>
        `;

        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;

        // Hover styles
        menu.querySelectorAll(".cc-ctx-item").forEach(el => {
          el.addEventListener("mouseenter", () => { el.style.background = "rgba(201,162,39,0.1)"; });
          el.addEventListener("mouseleave", () => { el.style.background = "transparent"; });
        });

        // Actions
        menu.querySelector('[data-action="settings"]')?.addEventListener("click", () => {
          menu.remove();
          this._onBoardSettings(board.id);
        });
        menu.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
          menu.remove();
          this._onDeleteBoard(board.id);
        });

        document.body.appendChild(menu);

        // Close on click elsewhere
        const closeMenu = (ev) => { if (!ev.target.closest(".cc-tab-context-menu")) { menu.remove(); document.removeEventListener("click", closeMenu); } };
        setTimeout(() => document.addEventListener("click", closeMenu), 10);
      });

      this._tabBarEl.appendChild(tab);
    }

    this._tabBarEl.appendChild(this._addTabBtn);
  }

  /* -------------------------------------------- */
  /*  Content Rendering (Canvas + Items)          */
  /* -------------------------------------------- */

  _renderContent() {
    this._contentEl.innerHTML = "";

    if (!this.boards.length) {
      this._renderEmptyState();
      return;
    }

    // Ensure we have an active board
    if (!this.activeBoardId || !this.boards.find(b => b.id === this.activeBoardId)) {
      this.activeBoardId = this.boards[0]?.id || null;
    }

    const board = this.getCurrentBoard();
    if (!board) {
      this._renderEmptyState();
      return;
    }

    // Layer 0: Background color on the content container itself
    this._contentEl.style.backgroundColor = board.bgColor || "transparent";

    // Layer 1: Background image — fixed position, does NOT pan/zoom with canvas
    if (board.bgImage) {
      const bgDiv = document.createElement("div");
      const bgSize = board.bgImageFit === "contain" ? "contain" : board.bgImageFit === "default" ? "auto" : "cover";
      const bgRepeat = board.bgImageFit === "default" ? "repeat" : "no-repeat";
      const bgPos = this._mapBgPosition(board.bgImagePosition);
      const bgOpacity = board.bgImageTransparency ?? 1;
      bgDiv.style.cssText = `
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        z-index: 1;
        background-image: url("${board.bgImage}");
        background-size: ${bgSize};
        background-position: ${bgPos};
        background-repeat: ${bgRepeat};
        opacity: ${bgOpacity};
        pointer-events: none;
      `;
      this._contentEl.appendChild(bgDiv);
    }

    // Layer 2: SVG canvas (items/connections on top of everything)
    this._renderSVGCanvas(board);
    if (this._svgEl) {
      this._svgEl.style.position = "relative";
      this._svgEl.style.zIndex = "2";
    }
    this._updateToolbarInfo(board);
  }

  _renderEmptyState() {
    const empty = document.createElement("div");
    empty.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #666;
    `;
    empty.innerHTML = `
      <i class="fas fa-project-diagram" style="font-size:48px;color:#2a2a4a;"></i>
      <h3 style="margin:0;color:#888;">No Boards Yet</h3>
      <p style="margin:0;font-size:12px;">Click + to create your first investigation board.</p>
      <button class="cc-btn-primary" id="cc-create-first">
        <i class="fas fa-plus"></i> Create Board
      </button>
    `;
    empty.querySelector("#cc-create-first")?.addEventListener("click", () => this._onAddBoard());
    this._contentEl.appendChild(empty);
  }

  _renderSVGCanvas(board) {
    const zoom = board.viewBox?.zoom || 1;
    const viewW = 800 / zoom;
    const viewH = 560 / zoom; // minus header/tab/toolbar
    const viewX = board.viewBox?.x ?? -(viewW / 2);
    const viewY = board.viewBox?.y ?? -(viewH / 2);

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `${viewX} ${viewY} ${viewW} ${viewH}`);
    svg.style.cssText = "flex:1;cursor:grab;";
    this._svgEl = svg;

    // Defs — arrow markers for connections
    const defs = document.createElementNS(svgNS, "defs");
    defs.innerHTML = `
      <filter id="cc-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <!-- Open arrow head -->
      <marker id="arr-arrow" viewBox="0 0 10 10" refX="9" refY="5"
        markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </marker>
      <!-- Filled arrow head -->
      <marker id="arr-filled" viewBox="0 0 10 10" refX="9" refY="5"
        markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" stroke="none"/>
      </marker>
      <!-- Diamond -->
      <marker id="arr-diamond" viewBox="0 0 10 10" refX="9" refY="5"
        markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="currentColor" stroke="none"/>
      </marker>
      <!-- Circle dot -->
      <marker id="arr-circle" viewBox="0 0 10 10" refX="9" refY="5"
        markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <circle cx="5" cy="5" r="4" fill="currentColor"/>
      </marker>
    `;
    svg.appendChild(defs);

    // Grid layer
    const gridLayer = document.createElementNS(svgNS, "g");
    gridLayer.style.display = this.showGrid ? "" : "none";
    this._gridLayer = gridLayer;
    if (this.showGrid) this._drawGrid(gridLayer, viewX, viewY, viewW, viewH);
    svg.appendChild(gridLayer);

    // Items layer — rendered first (bottom)
    const itemsLayer = document.createElementNS(svgNS, "g");
    this._itemsLayer = itemsLayer;
    svg.appendChild(itemsLayer);

    // Connections layer — ON TOP of items
    const connLayer = document.createElementNS(svgNS, "g");
    this._connLayer = connLayer;
    svg.appendChild(connLayer);

    // Arrow layer — ON TOP of connection lines
    const arrowLayer = document.createElementNS(svgNS, "g");
    this._arrowLayer = arrowLayer;
    svg.appendChild(arrowLayer);

    // Drag layer (for temp connection line) — topmost
    const dragLayer = document.createElementNS(svgNS, "g");
    this._dragLayer = dragLayer;
    svg.appendChild(dragLayer);

    // Background rect for events — captures all pointer events on empty canvas
    const bg = document.createElementNS(svgNS, "rect");
    bg.setAttribute("x", viewX);
    bg.setAttribute("y", viewY);
    bg.setAttribute("width", viewW);
    bg.setAttribute("height", viewH);
    bg.setAttribute("fill", "transparent");
    bg.setAttribute("pointer-events", "all");
    svg.insertBefore(bg, gridLayer);

    // Render connections
    if (board.connections) {
      for (const conn of board.connections) {
        this._renderConnection(conn, board);
      }
    }

    // Render items
    if (board.items) {
      for (const item of board.items) {
        this._renderItem(item);
      }
    }

    // Canvas event listeners
    this._attachCanvasEvents(svg);
    this._contentEl.appendChild(svg);
  }

  _drawGrid(layer, x, y, w, h) {
    // Clear previous grid dots
    layer.innerHTML = "";
    const spacing = 50;
    const startX = Math.floor(x / spacing) * spacing;
    const startY = Math.floor(y / spacing) * spacing;
    const endX = x + w;
    const endY = y + h;
    const svgNS = "http://www.w3.org/2000/svg";

    for (let gx = startX; gx <= endX; gx += spacing) {
      for (let gy = startY; gy <= endY; gy += spacing) {
        const dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("cx", gx);
        dot.setAttribute("cy", gy);
        dot.setAttribute("r", "1.5");
        dot.setAttribute("fill", "#5a5a7a");
        layer.appendChild(dot);
      }
    }
  }

  _renderItem(item) {
    const svgNS = "http://www.w3.org/2000/svg";
    const typeInfo = ITEM_TYPES[item.type] || ITEM_TYPES.placeholder;
    const size = item.width || ITEM_SIZE;
    const half = size / 2;
    const cx = item.x;
    const cy = item.y;
    const shape = item.shape || "rect";
    const borderColor = item.borderColor || typeInfo.color;
    const bgColor = item.bgColor || "#1a1a2e";
    const trans = item.imgTransparency ?? 1;

    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("transform", `translate(${cx}, ${cy})`);
    g.dataset.itemId = item.id;
    g.style.cursor = "pointer";

    // ---- Build shape path/points ----
    const clipId = `clip-${item.id}`;
    let shapeEl;

    switch (shape) {
      case "circle": {
        shapeEl = document.createElementNS(svgNS, "circle");
        shapeEl.setAttribute("r", half - 1);
        shapeEl.setAttribute("fill", bgColor);
        shapeEl.setAttribute("stroke", borderColor);
        shapeEl.setAttribute("stroke-width", "2");
        // Clip path for image
        const clip = document.createElementNS(svgNS, "clipPath");
        clip.id = clipId;
        const c = document.createElementNS(svgNS, "circle");
        c.setAttribute("r", half - 4);
        clip.appendChild(c);
        g.appendChild(clip);
        break;
      }
      case "square": {
        const s = size - 2;
        shapeEl = document.createElementNS(svgNS, "rect");
        shapeEl.setAttribute("x", -s / 2);
        shapeEl.setAttribute("y", -s / 2);
        shapeEl.setAttribute("width", s);
        shapeEl.setAttribute("height", s);
        shapeEl.setAttribute("fill", bgColor);
        shapeEl.setAttribute("stroke", borderColor);
        shapeEl.setAttribute("stroke-width", "2");
        const clip = document.createElementNS(svgNS, "clipPath");
        clip.id = clipId;
        const r = document.createElementNS(svgNS, "rect");
        r.setAttribute("x", -half + 4); r.setAttribute("y", -half + 4);
        r.setAttribute("width", size - 8); r.setAttribute("height", size - 8);
        clip.appendChild(r);
        g.appendChild(clip);
        break;
      }
      case "triangle": {
        const t = half - 2;
        const pts = `0,-${t} ${t * 0.866},${t * 0.5} -${t * 0.866},${t * 0.5}`;
        shapeEl = document.createElementNS(svgNS, "polygon");
        shapeEl.setAttribute("points", pts);
        shapeEl.setAttribute("fill", bgColor);
        shapeEl.setAttribute("stroke", borderColor);
        shapeEl.setAttribute("stroke-width", "2");
        const clip = document.createElementNS(svgNS, "clipPath");
        clip.id = clipId;
        const p = document.createElementNS(svgNS, "polygon");
        p.setAttribute("points", pts);
        clip.appendChild(p);
        g.appendChild(clip);
        break;
      }
      case "diamond": {
        const d = half - 2;
        const pts = `0,-${d} ${d},0 0,${d} -${d},0`;
        shapeEl = document.createElementNS(svgNS, "polygon");
        shapeEl.setAttribute("points", pts);
        shapeEl.setAttribute("fill", bgColor);
        shapeEl.setAttribute("stroke", borderColor);
        shapeEl.setAttribute("stroke-width", "2");
        const clip = document.createElementNS(svgNS, "clipPath");
        clip.id = clipId;
        const p = document.createElementNS(svgNS, "polygon");
        p.setAttribute("points", pts);
        clip.appendChild(p);
        g.appendChild(clip);
        break;
      }
      case "hexagon": {
        const h = half - 2;
        const pts = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          pts.push(`${(h * Math.cos(angle)).toFixed(2)},${(h * Math.sin(angle)).toFixed(2)}`);
        }
        shapeEl = document.createElementNS(svgNS, "polygon");
        shapeEl.setAttribute("points", pts.join(" "));
        shapeEl.setAttribute("fill", bgColor);
        shapeEl.setAttribute("stroke", borderColor);
        shapeEl.setAttribute("stroke-width", "2");
        const clip = document.createElementNS(svgNS, "clipPath");
        clip.id = clipId;
        const p = document.createElementNS(svgNS, "polygon");
        p.setAttribute("points", pts.join(" "));
        clip.appendChild(p);
        g.appendChild(clip);
        break;
      }
      default: // rect
        shapeEl = document.createElementNS(svgNS, "rect");
        shapeEl.setAttribute("x", -half);
        shapeEl.setAttribute("y", -half);
        shapeEl.setAttribute("width", size);
        shapeEl.setAttribute("height", size);
        shapeEl.setAttribute("rx", "8");
        shapeEl.setAttribute("fill", bgColor);
        shapeEl.setAttribute("stroke", borderColor);
        shapeEl.setAttribute("stroke-width", "2");
        const clip = document.createElementNS(svgNS, "clipPath");
        clip.id = clipId;
        const r = document.createElementNS(svgNS, "rect");
        r.setAttribute("x", -half + 4); r.setAttribute("y", -half + 4);
        r.setAttribute("width", size - 8); r.setAttribute("height", size - 8);
        r.setAttribute("rx", "4");
        clip.appendChild(r);
        g.appendChild(clip);
    }

    g.appendChild(shapeEl);

    // ---- Icon / Image ----
    const hasImage = item.img && item.img.trim() && !item.img.startsWith("fa-");
    if (hasImage) {
      // Image fit mode
      let par;
      switch (item.imgFit) {
        case "cover":   par = "xMidYMid slice"; break;
        case "contain": par = "xMidYMid meet"; break;
        default:        par = "none"; break;
      }

      // Image position offset
      let posX = 0, posY = 0;
      const offset = 8;
      switch (item.imgPosition) {
        case "top":    posY = -offset; break;
        case "bottom": posY = offset; break;
        case "left":   posX = -offset; break;
        case "right":  posX = offset; break;
      }

      // Padding around image inside shape
      const pad = shape === "circle" ? 6 : 4;
      const imgSize = size - pad * 2;

      const img = document.createElementNS(svgNS, "image");
      img.setAttribute("x", -imgSize / 2 + posX);
      img.setAttribute("y", -imgSize / 2 + posY);
      img.setAttribute("width", imgSize);
      img.setAttribute("height", imgSize);
      img.setAttribute("href", item.img);
      img.setAttribute("preserveAspectRatio", par);
      if (trans < 1) img.setAttribute("opacity", trans.toFixed(2));
      img.setAttribute("clip-path", `url(#${clipId})`);
      g.appendChild(img);
    } else {
      // Font Awesome icon
      const fo = document.createElementNS(svgNS, "foreignObject");
      fo.setAttribute("x", -half);
      fo.setAttribute("y", -half + 8);
      fo.setAttribute("width", size);
      fo.setAttribute("height", size - 16);
      const div = document.createElement("div");
      div.style.cssText = `display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:${borderColor};font-size:24px;`;
      div.innerHTML = `<i class="fas ${typeInfo.defaultIcon}"></i>`;
      fo.appendChild(div);
      g.appendChild(fo);
    }

    // ---- Label ----
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("y", half + 14);
    label.setAttribute("fill", "#e8e8e8");
    label.setAttribute("font-size", "10");
    label.setAttribute("font-family", "var(--font-primary, sans-serif)");
    label.textContent = item.name || "?";
    g.appendChild(label);

    // ---- Events ----
    g.addEventListener("mousedown", (e) => this._onItemMouseDown(e, item));
    g.addEventListener("dblclick", (e) => this._onItemDoubleClick(e, item));
    // Right-click opens edit dialog directly
    g.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); this._onItemRightClick(e, item); });
    g.addEventListener("mouseenter", () => this._showItemTooltip(item, g));
    g.addEventListener("mouseleave", () => this._hideTooltip());

    this._itemsLayer?.appendChild(g);
  }

  _renderConnection(conn, board) {
    const fromItem = board.items?.find(i => i.id === conn.fromId);
    const toItem = board.items?.find(i => i.id === conn.toId);
    if (!fromItem || !toItem) return;

    const svgNS = "http://www.w3.org/2000/svg";
    const cx1 = fromItem.x, cy1 = fromItem.y;
    const cx2 = toItem.x, cy2 = toItem.y;

    // Line appearance
    const lineColor = conn.lineColor || CONNECTION_TYPES.find(t => t.id === conn.type)?.color || "#c9a227";
    const lineWidth = conn.lineWidth || 2;
    const lineStyle = conn.lineStyle || "curved";

    // Clip line to item borders (don't draw inside items)
    const half = ITEM_SIZE / 2;
    const start = this._lineBoxIntersection(cx2, cy2, cx1, cy1, cx1, cy1, half);
    const end   = this._lineBoxIntersection(cx1, cy1, cx2, cy2, cx2, cy2, half);
    const x1 = start.x, y1 = start.y;
    const x2 = end.x,   y2 = end.y;

    // Build path d-string based on style
    let d;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    if (lineStyle === "straight") {
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else {
      // Curved — control point computed from centers for consistent curvature
      const cdx = cx2 - cx1, cdy = cy2 - cy1;
      const clen = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
      const offset = clen * 0.15;
      const cnx = -cdy / clen * offset;
      const cny = cdx / clen * offset;
      const cmx = (cx1 + cx2) / 2, cmy = (cy1 + cy2) / 2;
      d = `M ${x1} ${y1} Q ${cmx + cnx} ${cmy + cny} ${x2} ${y2}`;
    }

    // Stroke dasharray based on style
    let dash = "";
    switch (lineStyle) {
      case "dotted": dash = "3,6"; break;
      case "dashed": dash = "10,6"; break;
      case "dashdot": dash = "10,4,3,4"; break;
    }

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", lineColor);
    path.setAttribute("stroke-width", lineWidth);
    if (dash) path.setAttribute("stroke-dasharray", dash);
    path.setAttribute("stroke-linecap", "round");

    path.dataset.connId = conn.id;
    path.dataset.fromX = x1; path.dataset.fromY = y1;
    path.dataset.toX = x2; path.dataset.toY = y2;
    path.dataset.ctrlX = mx + (-dy / len * len * 0.15);
    path.dataset.ctrlY = my + (dx / len * len * 0.15);
    this._connLayer?.appendChild(path);

    // ---- Arrow heads at line endpoints (drawn as direct paths, not markers) ----
    const arrowStyle = conn.arrowStyle || "none";
    const arrowDir = conn.arrowDirection || "end";
    if (arrowStyle !== "none" && arrowDir !== "none") {
      const arrowSize = conn.arrowSize || 10;
      // Direction from original centers (not clipped line)
      const cdx = cx2 - cx1, cdy = cy2 - cy1;
      const cLen = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
      const dirX = cdx / cLen, dirY = cdy / cLen;
      // x1,y1 and x2,y2 are already clipped to item borders
      if (arrowDir === "end" || arrowDir === "both") {
        this._drawArrowHead(svgNS, x2, y2, dirX, dirY, arrowStyle, lineColor, lineWidth, arrowSize, conn.id, "end");
      }
      if (arrowDir === "start" || arrowDir === "both") {
        this._drawArrowHead(svgNS, x1, y1, dirX, dirY, arrowStyle, lineColor, lineWidth, arrowSize, conn.id, "start");
      }
    }

    // ---- Midpoint icon (pure SVG, sits ON the line — no background) ----
    const qx = lineStyle === "straight" ? mx : mx + (-dy / len * len * 0.15 * 0.3);
    const qy = lineStyle === "straight" ? my : my + (dx / len * len * 0.15 * 0.3);

    const iconG = document.createElementNS(svgNS, "g");
    iconG.setAttribute("transform", `translate(${qx}, ${qy})`);
    iconG.style.cursor = "pointer";

    const iconSize = Math.max(16, Math.min(64, (conn.iconSize || 24)));
    const iconColor = conn.iconColor || lineColor;
    const unicode = resolveIconUnicode(conn.icon);
    const fontSize = (iconSize * 0.55).toString();

    // Dark outline text (behind) for contrast against the line
    const outlineText = document.createElementNS(svgNS, "text");
    outlineText.setAttribute("text-anchor", "middle");
    outlineText.setAttribute("dy", "0.35em");
    outlineText.setAttribute("fill", "#1a1a2e");
    outlineText.setAttribute("font-size", fontSize);
    outlineText.setAttribute("font-family", "'Font Awesome 5 Free', 'FontAwesome', 'Font Awesome 5 Brands', sans-serif");
    outlineText.setAttribute("font-weight", "900");
    outlineText.setAttribute("stroke", "#1a1a2e");
    outlineText.setAttribute("stroke-width", "3");
    outlineText.setAttribute("stroke-linejoin", "round");
    outlineText.textContent = unicode;
    iconG.appendChild(outlineText);

    // Main icon text — centered on the line (dy=0.35em centers vertically)
    const iconText = document.createElementNS(svgNS, "text");
    iconText.setAttribute("text-anchor", "middle");
    iconText.setAttribute("dy", "0.35em");
    iconText.setAttribute("fill", iconColor);
    iconText.setAttribute("font-size", fontSize);
    iconText.setAttribute("font-family", "'Font Awesome 5 Free', 'FontAwesome', 'Font Awesome 5 Brands', sans-serif");
    iconText.setAttribute("font-weight", "900");
    iconText.textContent = unicode;
    iconG.appendChild(iconText);

    iconG.addEventListener("mouseenter", () => this._showConnectionTooltip(conn, fromItem, toItem, iconG));
    iconG.addEventListener("mouseleave", () => this._hideTooltip());
    // Left click does nothing on connection icons
    // Right-click opens the edit dialog
    iconG.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); this._onConnectionClick(conn); });

    this._connLayer?.appendChild(iconG);
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  _attachEvents() {
    // Dragging the panel by header
    this._headerEl.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
      this._dragState = { startX: e.clientX, startY: e.clientY, origLeft: this.element.offsetLeft, origTop: this.element.offsetTop };
      this._headerEl.style.cursor = "grabbing";
    });

    // Resize handle drag — top-right corner: dragging up = taller, down = shorter
    this._resizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._resizeState = {
        startX: e.clientX,
        startY: e.clientY,
        startW: this.element.offsetWidth,
        startH: this.element.offsetHeight,
        startTop: this.element.offsetTop
      };
      this._resizeHandle.style.cursor = "nwse-resize";
      document.body.style.cursor = "nwse-resize";
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
      // Handle panel drag
      if (this._dragState) {
        const dx = e.clientX - this._dragState.startX;
        const dy = e.clientY - this._dragState.startY;
        this.element.style.left = `${this._dragState.origLeft + dx}px`;
        this.element.style.top = `${this._dragState.origTop + dy}px`;
      }
      // Handle resize — top-right corner
      // Reversed: dragging UP increases height, DOWN decreases height
      if (this._resizeState) {
        const dx = e.clientX - this._resizeState.startX;
        const dy = e.clientY - this._resizeState.startY;
        const newW = Math.max(400, this._resizeState.startW + dx);
        const newH = Math.max(300, this._resizeState.startH - dy);
        // Adjust top so the bottom edge stays fixed (normal top-handle behaviour)
        const newTop = this._resizeState.startTop + (this._resizeState.startH - newH);
        this.element.style.width = `${newW}px`;
        this.element.style.height = `${newH}px`;
        this.element.style.top = `${newTop}px`;
      }
    });

    document.addEventListener("mouseup", () => {
      this._dragState = null;
      if (this._headerEl) this._headerEl.style.cursor = "grab";
      if (this._resizeState) {
        this._resizeState = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    });
  }

  _attachCanvasEvents(svg) {
    // Left-click + hold on empty canvas = pan
    svg.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't pan if clicking on an item (item's mousedown handler takes over)
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target?.closest("[data-item-id]")) return;
      if (target?.closest("[data-conn-id]")) return;

      e.preventDefault();
      this._panState = { startX: e.clientX, startY: e.clientY };
      svg.style.cursor = "grabbing";
    });

    svg.addEventListener("mousemove", (e) => {
      if (!this._panState) return;
      const dx = e.clientX - this._panState.startX;
      const dy = e.clientY - this._panState.startY;
      this._panState.startX = e.clientX;
      this._panState.startY = e.clientY;
      const vb = svg.getAttribute("viewBox").split(" ").map(Number);
      svg.setAttribute("viewBox", `${vb[0] - dx} ${vb[1] - dy} ${vb[2]} ${vb[3]}`);
    });

    svg.addEventListener("mouseup", () => {
      if (this._panState) this._saveCanvasView();
      this._panState = null;
      svg.style.cursor = "grab";
    });

    // Zoom via wheel
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const vb = svg.getAttribute("viewBox").split(" ").map(Number);
      const nw = vb[2] * factor;
      const nh = vb[3] * factor;
      const dx = vb[2] - nw;
      const dy = vb[3] - nh;
      svg.setAttribute("viewBox", `${vb[0] + dx / 2} ${vb[1] + dy / 2} ${nw} ${nh}`);
      this._saveCanvasView();
    }, { passive: false });

    // Right-click on empty canvas: prevent default context menu, do nothing
    svg.addEventListener("contextmenu", (e) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target?.closest("[data-item-id]")) return; // Item handles its own right-click
      if (target?.closest("[data-conn-id]")) return; // Connection handles its own right-click
      e.preventDefault(); // Prevent browser context menu, but do nothing
    });

    // ---- Drag-and-drop from Cypher Taskbar blue hand ----
    svg.addEventListener("dragover", (e) => {
      e.preventDefault(); // Required to allow dropping
      e.dataTransfer.dropEffect = "copy";
      svg.style.cursor = "copy";
    });

    svg.addEventListener("dragleave", () => {
      svg.style.cursor = "grab";
    });

    svg.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      svg.style.cursor = "grab";

      // Get drop position in SVG coordinates (always needed)
      const rect = svg.getBoundingClientRect();
      const pt = svg.createSVGPoint();
      pt.x = e.clientX - rect.left;
      pt.y = e.clientY - rect.top;
      const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

      // Try multiple data formats: JSON (blue hand) → URI list → raw URL → files
      let raw = e.dataTransfer.getData("text/plain");
      const uriList = e.dataTransfer.getData("text/uri-list");
      const files = e.dataTransfer.files;

      // Ensure a board exists
      const board = this.getCurrentBoard();
      if (!board) { ui.notifications.warn("Create a board first."); return; }

      const { BoardItem } = await import("./data-model.js");

      // ---- Case 1: OS file drop (images dragged from desktop) ----
      if (files && files.length > 0) {
        for (const file of files) {
          if (!file.type.startsWith("image/")) continue;
          const imgUrl = URL.createObjectURL(file);
          const item = new BoardItem({
            boardId: board.id, type: "image", name: file.name,
            img: imgUrl, x: svgP.x + (board.items.length * 20), y: svgP.y, width: ITEM_SIZE, height: ITEM_SIZE
          });
          board.items.push(item); this._renderItem(item);
        }
        await this._persistBoards();
        return;
      }

      // ---- Case 2: text/uri-list (lightbox/gallery image URLs) ----
      if (uriList) {
        const urls = uriList.split("\n").filter(l => l.trim() && !l.startsWith("#"));
        if (urls.length > 0) {
          const imgUrl = urls[0].trim();
          const name = imgUrl.split("/").pop()?.split("?")[0] || "Image";
          const item = new BoardItem({
            boardId: board.id, type: "image", name,
            img: imgUrl, x: svgP.x, y: svgP.y, width: ITEM_SIZE, height: ITEM_SIZE
          });
          board.items.push(item); board.updated = Date.now();
          await this._persistBoards(); this._renderItem(item);
          ui.notifications.info(`Added image to board.`);
          return;
        }
      }

      // ---- Case 3: text/plain — could be JSON (blue hand) or raw URL ----
      if (!raw) { console.log(`[${MODULE_ID}] Drop: no data in dataTransfer`); return; }

      // Is it a raw URL? (lightbox drag, image from journal, etc.)
      const trimmed = raw.trim();
      if (/^https?:\/\/|^\/[^\s]|\.(jpg|jpeg|png|gif|webp|svg|bmp|tga|avif)($|\?)/i.test(trimmed)) {
        const name = trimmed.split("/").pop()?.split("?")[0] || "Image";
        const item = new BoardItem({
          boardId: board.id, type: "image", name,
          img: trimmed, x: svgP.x, y: svgP.y, width: ITEM_SIZE, height: ITEM_SIZE
        });
        board.items.push(item); board.updated = Date.now();
        await this._persistBoards(); this._renderItem(item);
        ui.notifications.info(`Added image to board.`);
        return;
      }

      // Try parsing as JSON (Cypher Taskbar blue hand format)
      let data;
      try { data = JSON.parse(raw); } catch {
        console.log(`[${MODULE_ID}] Drop: unrecognised data format:`, trimmed.substring(0, 200));
        return;
      }
      console.log(`[${MODULE_ID}] Drop: received JSON data:`, data);

      // ---- Case 4: JSON with UUID (Cypher Taskbar blue hand) ----
      const uuid = data.uuid || data.id;
      if (!uuid) { console.log(`[${MODULE_ID}] Drop: no uuid in JSON data`); return; }

      try {
        const doc = await fromUuid(uuid);
        if (!doc) { ui.notifications.warn(`Document not found: ${uuid}`); return; }
        console.log(`[${MODULE_ID}] Drop: resolved doc:`, doc.name, "type:", doc.documentName);

        const typeMap = { Actor: "person", JournalEntry: "journal", Item: "item",
          Scene: "place", RollTable: "mystery", Macro: "item", Playlist: "item" };
        const docType = data.type || doc.documentName || "unknown";
        const itemType = typeMap[docType] || "placeholder";

        let img = data.img || doc.img || doc.texture?.src || doc.thumbnail || doc.portrait?.src || "";

        const item = new BoardItem({
          boardId: board.id, type: itemType,
          name: data.name || doc.name || "Dropped Item",
          img, description: doc.system?.description || doc.content || "",
          x: svgP.x, y: svgP.y, width: ITEM_SIZE, height: ITEM_SIZE
        });

        board.items.push(item); board.updated = Date.now();
        await this._persistBoards(); this._renderItem(item);
        ui.notifications.info(`Added "${item.name}" to board.`);
      } catch (err) {
        console.error(`[${MODULE_ID}] Drop handling error:`, err);
        ui.notifications.error("Failed to add dropped item: " + err.message);
      }
    });
  }

  _onItemMouseDown(event, item) {
    // Only left-click (button 0) initiates drag
    if (event.button !== 0) return;

    // During connect mode, don't interfere
    if (this._connectMode) return;

    event.preventDefault();
    event.stopPropagation();

    const svg = this._svgEl;
    const startX = event.clientX;
    const startY = event.clientY;
    let isDragging = false;
    const DRAG_THRESHOLD = 5; // pixels

    const onMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        isDragging = true;
      }
      if (!isDragging) return;

      // Convert screen coords to SVG coords
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
      item.x = svgP.x;
      item.y = svgP.y;

      // Snap to grid if enabled
      if (this.snapToGrid) {
        const gridSize = 50;
        item.x = Math.round(item.x / gridSize) * gridSize;
        item.y = Math.round(item.y / gridSize) * gridSize;
      }

      // Re-render the item
      const el = this._itemsLayer?.querySelector(`[data-item-id="${item.id}"]`);
      if (el) el.setAttribute("transform", `translate(${item.x}, ${item.y})`);
      // Re-render connections
      this._refreshConnections();
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      if (isDragging) {
        // Drag ended — persist position
        if (this.snapToGrid) {
          const gridSize = 50;
          item.x = Math.round(item.x / gridSize) * gridSize;
          item.y = Math.round(item.y / gridSize) * gridSize;
          const el = this._itemsLayer?.querySelector(`[data-item-id="${item.id}"]`);
          if (el) el.setAttribute("transform", `translate(${item.x}, ${item.y})`);
          this._refreshConnections();
        }
        this._persistBoards();
      }
      // Left-click without drag does nothing on items
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /**
   * Right-click an item to open the edit dialog directly.
   */
  async _onItemRightClick(event, item) {
    event.preventDefault();
    event.stopPropagation();

    const { ItemDialog } = await import("./dialogs/item-dialog.js");
    const data = await ItemDialog(item);
    if (data === false) {
      // Delete
      this._deleteItem(item.id);
    } else if (data) {
      // Update
      Object.assign(item, data);
      const oldG = this._itemsLayer?.querySelector(`[data-item-id="${item.id}"]`);
      if (oldG) oldG.remove();
      this._renderItem(item);
      this._refreshConnections();
      await this._persistBoards();
    }
  }

  /**
   * Double-click an item to enter "connect mode".
   * A dashed line follows the mouse from the source item.
   * Click another item to connect. Press Escape or click empty space to cancel.
   */
  _onItemDoubleClick(event, fromItem) {
    event.stopPropagation();
    event.preventDefault();
    this._enterConnectMode(fromItem);
  }

  /**
   * Enter connection-drag mode. A dashed line follows the mouse
   * from the given source item until the user clicks a target or cancels.
   */
  _enterConnectMode(fromItem) {
    if (this._connectMode) this._exitConnectMode();

    const svg = this._svgEl;
    const svgNS = "http://www.w3.org/2000/svg";

    // Highlight source item
    const sourceRect = this._itemsLayer?.querySelector(`[data-item-id="${fromItem.id}"] > rect`);
    if (sourceRect) {
      sourceRect.setAttribute("stroke-width", "4");
      sourceRect.setAttribute("filter", "url(#cc-glow)");
    }

    // --- Change cursor to link/alias cursor ---
    document.body.style.cursor = "alias";
    if (this._svgEl) this._svgEl.style.cursor = "alias";

    // --- Add hover highlight to all OTHER items (potential targets) ---
    this._itemsLayer?.querySelectorAll("[data-item-id]").forEach(g => {
      const itemId = g.dataset.itemId;
      if (itemId === fromItem.id) return; // Skip source
      const rect = g.querySelector("rect");
      if (!rect) return;

      const origStroke = rect.getAttribute("stroke");
      g.addEventListener("mouseenter", g._ccEnter = () => {
        rect.setAttribute("stroke-width", "4");
        rect.setAttribute("stroke", "#c9a227");
        rect.setAttribute("filter", "url(#cc-glow)");
      });
      g.addEventListener("mouseleave", g._ccLeave = () => {
        rect.setAttribute("stroke-width", "2");
        rect.setAttribute("stroke", origStroke);
        rect.removeAttribute("filter");
      });
    });

    // Toolbar info
    const infoEl = this._toolbarEl?.querySelector(".cc-tb-info");
    if (infoEl) {
      infoEl.innerHTML = `<i class="fas fa-link" style="color:#c9a227;"></i> Connect Mode — click a target or <kbd style="background:#2a2a4a;padding:1px 4px;border-radius:3px;">Esc</kbd> to cancel`;
    }

    // Dashed follow line
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", fromItem.x);
    line.setAttribute("y1", fromItem.y);
    line.setAttribute("x2", fromItem.x);
    line.setAttribute("y2", fromItem.y);
    line.setAttribute("stroke", "#c9a227");
    line.setAttribute("stroke-width", "2.5");
    line.setAttribute("stroke-dasharray", "6,4");
    line.setAttribute("pointer-events", "none"); // Let clicks pass through
    this._dragLayer.appendChild(line);

    // Pulsing dot at source
    const pulseDot = document.createElementNS(svgNS, "circle");
    pulseDot.setAttribute("cx", fromItem.x);
    pulseDot.setAttribute("cy", fromItem.y);
    pulseDot.setAttribute("r", "6");
    pulseDot.setAttribute("fill", "#c9a227");
    pulseDot.setAttribute("pointer-events", "none");
    this._dragLayer.appendChild(pulseDot);

    this._connectMode = { fromItem, line, pulseDot, sourceRect };

    // --- Mouse move: update line endpoint ---
    this._connectOnMouseMove = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
      line.setAttribute("x2", svgP.x);
      line.setAttribute("y2", svgP.y);
    };

    // --- Click ANYWHERE on document: use elementFromPoint to find target ---
    this._connectOnClick = (e) => {
      // Only left-click, ignore clicks on the panel header/toolbar
      if (e.button !== 0) return;
      if (e.target.closest(".cc-panel")) {
        // Check if click was inside the SVG canvas area (not header/tabs/toolbar)
        if (!e.target.closest(".cc-panel-content")) return; // Ignore clicks on panel chrome
      }

      // Find what's under the cursor using elementFromPoint
      // (bypasses all SVG event bubbling issues)
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) { this._exitConnectMode(); return; }

      // Walk up to find the item group
      const itemG = el.closest?.("[data-item-id]");
      if (itemG) {
        const targetId = itemG.dataset.itemId;
        if (targetId && targetId !== fromItem.id) {
          const board = this.getCurrentBoard();
          const targetItem = board?.items?.find(i => i.id === targetId);
          if (targetItem) {
            this._exitConnectMode();
            this._onCreateConnection(fromItem, targetItem);
            return;
          }
        }
        // Clicked source item itself — do nothing, stay in connect mode
        return;
      }

      // Clicked empty space — cancel
      this._exitConnectMode();
    };

    // --- Escape key: cancel ---
    this._connectOnKeyDown = (e) => {
      if (e.key === "Escape") this._exitConnectMode();
    };

    // Bind listeners (use capture for click to grab it before anything else)
    document.addEventListener("mousemove", this._connectOnMouseMove);
    document.addEventListener("click", this._connectOnClick, true); // CAPTURE phase
    document.addEventListener("keydown", this._connectOnKeyDown);
  }

  /**
   * Exit connect mode, clean up listeners and visual feedback.
   */
  _exitConnectMode() {
    if (!this._connectMode) return;

    const { fromItem, line, pulseDot, sourceRect } = this._connectMode;

    // Remove listeners
    document.removeEventListener("mousemove", this._connectOnMouseMove);
    document.removeEventListener("click", this._connectOnClick, true);
    document.removeEventListener("keydown", this._connectOnKeyDown);

    // Remove visual elements
    line?.remove();
    pulseDot?.remove();

    // Remove highlight from source item
    if (sourceRect) {
      sourceRect.setAttribute("stroke-width", "2");
      sourceRect.removeAttribute("filter");
    }

    // Remove hover listeners from target items
    this._itemsLayer?.querySelectorAll("[data-item-id]").forEach(g => {
      if (g._ccEnter) { g.removeEventListener("mouseenter", g._ccEnter); delete g._ccEnter; }
      if (g._ccLeave) { g.removeEventListener("mouseleave", g._ccLeave); delete g._ccLeave; }
      // Restore stroke
      const rect = g.querySelector("rect");
      if (rect) {
        const itemId = g.dataset.itemId;
        const board = this.getCurrentBoard();
        const item = board?.items?.find(i => i.id === itemId);
        if (item) {
          const typeInfo = ITEM_TYPES[item.type] || ITEM_TYPES.placeholder;
          rect.setAttribute("stroke", typeInfo.color);
        }
        rect.setAttribute("stroke-width", "2");
        rect.removeAttribute("filter");
      }
    });

    // Restore cursor
    document.body.style.cursor = "";
    if (this._svgEl) this._svgEl.style.cursor = "grab";

    // Restore toolbar info
    const board = this.getCurrentBoard();
    this._updateToolbarInfo(board);

    this._connectMode = null;
    this._connectOnMouseMove = null;
    this._connectOnClick = null;
    this._connectOnKeyDown = null;
  }

  /* -------------------------------------------- */
  /*  Tooltip (simple DOM-based)                  */
  /* -------------------------------------------- */

  _showItemTooltip(item, anchorEl) {
    this._hideTooltip();
    const typeInfo = ITEM_TYPES[item.type] || ITEM_TYPES.placeholder;

    const tip = document.createElement("div");
    tip.className = "cc-tooltip";
    tip.style.cssText = `
      position: fixed;
      background: linear-gradient(180deg, #1a1a2e, #16213e);
      border: 1px solid ${typeInfo.color};
      border-radius: 6px;
      padding: 8px 12px;
      z-index: 300;
      max-width: 220px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      pointer-events: none;
    `;
    tip.innerHTML = `
      <div style="font-weight:600;color:${typeInfo.color};margin-bottom:4px;font-size:13px;">${item.name || "Untitled"}</div>
      ${item.img ? `<img src="${item.img}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;margin-bottom:4px;">` : ""}
      <div style="font-size:11px;color:#b0b0b0;line-height:1.4;">${item.description || "No description."}</div>
    `;

    // Position near the anchor
    const rect = anchorEl.getBoundingClientRect();
    tip.style.left = `${rect.right + 10}px`;
    tip.style.top = `${rect.top}px`;

    document.body.appendChild(tip);
    this._tooltip = tip;
  }

  _showConnectionTooltip(conn, fromItem, toItem, anchorEl) {
    this._hideTooltip();
    const typeInfo = CONNECTION_TYPES.find(t => t.id === conn.type) || { color: "#c9a227", label: conn.type };

    const tip = document.createElement("div");
    tip.className = "cc-tooltip";
    tip.style.cssText = `
      position: fixed;
      background: linear-gradient(180deg, #1a1a2e, #16213e);
      border: 1px solid #c9a227;
      border-radius: 6px;
      padding: 10px 14px;
      z-index: 300;
      max-width: 260px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    `;

    const tagsHtml = (conn.tags || []).map(t => `<span style="background:#2a2a4a;color:#c9a227;padding:1px 6px;border-radius:3px;font-size:10px;margin:2px;">${t}</span>`).join("");

    // Build events HTML
    let eventsHtml = "";
    const events = conn.events || [];
    if (events.length > 0) {
      eventsHtml = `<div style="margin-top:8px;border-top:1px solid #2a2a4a;padding-top:6px;">
        <div style="font-size:10px;color:#c9a227;margin-bottom:4px;font-weight:600;"><i class="fas fa-calendar-alt" style="margin-right:4px;"></i>Events</div>`;
      for (const evt of events) {
        eventsHtml += `
          <div style="margin-bottom:6px;padding-left:8px;border-left:2px solid ${typeInfo.color};">
            ${evt.date ? `<div style="font-size:9px;color:#888;">${evt.date}</div>` : ""}
            ${evt.name ? `<div style="font-size:11px;color:#e8e8e8;font-weight:500;">${evt.name}</div>` : ""}
            ${evt.description ? `<div style="font-size:10px;color:#b0b0b0;">${evt.description}</div>` : ""}
          </div>`;
      }
      eventsHtml += `</div>`;
    }

    tip.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:10px;color:#888;">${fromItem.name}</span>
        <i class="fas fa-arrow-right" style="color:${typeInfo.color};font-size:10px;"></i>
        <span style="font-size:10px;color:#888;">${toItem.name}</span>
      </div>
      <div style="font-weight:600;color:${typeInfo.color};margin-bottom:4px;">${conn.name || "Unnamed"}</div>
      <div style="font-size:10px;color:#888;margin-bottom:4px;">Type: ${typeInfo.label}</div>
      ${tagsHtml ? `<div style="margin:4px 0;">${tagsHtml}</div>` : ""}
      ${conn.description ? `<div style="font-size:11px;color:#b0b0b0;margin-top:4px;">${conn.description}</div>` : ""}
      ${eventsHtml}
    `;

    const rect = anchorEl.getBoundingClientRect();
    tip.style.left = `${rect.left + 20}px`;
    tip.style.top = `${rect.bottom + 10}px`;

    document.body.appendChild(tip);
    this._tooltip = tip;
  }

  _hideTooltip() {
    if (this._tooltip) {
      this._tooltip.remove();
      this._tooltip = null;
    }
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  async _onAddBoard() {
    const defaultName = game.settings.get(MODULE_ID, "defaultBoardName") || "Investigation Board";
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: "New Board" },
      content: `<div class="form-group"><label>Name</label><input type="text" name="name" value="${defaultName}" autofocus></div>`,
      ok: { callback: (_, btn) => btn.form.elements.name.value },
      rejectClose: false
    });

    if (name) {
      const board = new Board({ name, actorId: this.actor.id, userId: game.userId });
      this.boards.push(board);
      this.activeBoardId = board.id;
      await this._persistBoards();
      this._renderTabs();
      this._renderContent();
    }
  }

  async _onDeleteBoard(boardId) {
    const board = this.boards.find(b => b.id === boardId);
    if (!board) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete Board" },
      content: `<p>Delete "${board.name}"? This cannot be undone.</p>`,
      yes: { label: "Delete", classes: ["danger"] }
    });

    if (!confirmed) return;

    this.boards = this.boards.filter(b => b.id !== boardId);
    if (this.activeBoardId === boardId) {
      this.activeBoardId = this.boards.length > 0 ? this.boards[0].id : null;
    }
    await this._persistBoards();
    this._renderTabs();
    this._renderContent();
  }

  async _onSwitchBoard(boardId) {
    this.activeBoardId = boardId;
    this._renderTabs();
    this._renderContent();
  }

  async _onRenameBoard(boardId, nameSpan, tabEl) {
    const board = this.boards.find(b => b.id === boardId);
    if (!board) return;

    const input = document.createElement("input");
    input.type = "text";
    input.value = board.name;
    input.style.cssText = "background:#0f3460;border:1px solid #c9a227;color:#e8e8e8;border-radius:3px;padding:2px 6px;font-size:12px;width:100px;";
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const finish = async () => {
      const newName = input.value.trim();
      if (newName && newName !== board.name) {
        board.name = newName;
        board.updated = Date.now();
        await this._persistBoards();
      }
      this._renderTabs();
    };

    input.addEventListener("blur", finish, { once: true });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  }

  async _onBoardSettings(boardId) {
    const board = this.boards.find(b => b.id === boardId);
    if (!board) return;
    const result = await BoardSettingsDialog(board);
    if (result) {
      Object.assign(board, result);
      board.updated = Date.now();
      await this._persistBoards();
      if (this.activeBoardId === boardId) {
        this._renderContent();
      }
    }
  }

  async _deleteItem(itemId) {
    const board = this.getCurrentBoard();
    if (!board) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete Item" },
      content: `<p>Delete this item and its connections?</p>`,
      yes: { label: "Delete" }
    });
    if (!confirmed) return;

    // Remove item
    board.items = (board.items || []).filter(i => i.id !== itemId);
    // Remove connections involving this item
    board.connections = (board.connections || []).filter(c => c.fromId !== itemId && c.toId !== itemId);
    board.updated = Date.now();
    await this._persistBoards();
    this._renderContent();
  }

  async _onAddItemAt(x, y) {
    const board = this.getCurrentBoard();
    if (!board) return;

    // Snap to grid if enabled
    if (this.snapToGrid) {
      const gridSize = 50;
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }

    // Open item dialog
    const { ItemDialog } = await import("./dialogs/item-dialog.js");
    const data = await ItemDialog();
    if (!data) return;

    const item = new BoardItem({
      boardId: board.id,
      type: data.type || "placeholder",
      name: data.name || "New Item",
      img: data.img || "",
      description: data.description || "",
      x, y,
      width: ITEM_SIZE,
      height: ITEM_SIZE
    });

    if (!board.items) board.items = [];
    board.items.push(item);
    board.updated = Date.now();
    await this._persistBoards();
    this._renderItem(item);
  }

  async _onCreateConnection(fromItem, toItem) {
    try {
      console.log(`[${MODULE_ID}] _onCreateConnection START: ${fromItem?.name} (${fromItem?.id}) → ${toItem?.name} (${toItem?.id})`);
      const board = this.getCurrentBoard();
      if (!board) { console.warn(`[${MODULE_ID}] No current board`); return null; }
      console.log(`[${MODULE_ID}] Current board: ${board.name}, items=${board.items?.length}, connections=${board.connections?.length}`);

      console.log(`[${MODULE_ID}] Importing ConnectionDialog...`);
      const { ConnectionDialog } = await import("./dialogs/connection-dialog.js");
      console.log(`[${MODULE_ID}] Calling ConnectionDialog...`);
      const data = await ConnectionDialog(null, fromItem, toItem);
      console.log(`[${MODULE_ID}] Dialog returned:`, data === null ? "null (cancelled)" : data === false ? "false (deleted)" : typeof data === "object" ? `object with name="${data.name}"` : data);
      if (!data) { console.log(`[${MODULE_ID}] No data, aborting`); return null; }

    const conn = new Connection({
      boardId: board.id,
      fromId: fromItem.id,
      toId: toItem.id,
      name: data.name || "",
      type: data.type || "unknown",
      icon: data.icon || "fa-question-circle",
      iconSize: data.iconSize || 24,
      iconColor: data.iconColor || "#c9a227",
      tags: data.tags || [],
      description: data.description || "",
      events: data.events || [],
      lineColor: data.lineColor || "",
      lineStyle: data.lineStyle || "straight",
      lineWidth: data.lineWidth || 2,
      arrowStyle: data.arrowStyle || "none",
      arrowDirection: data.arrowDirection || "end",
      arrowSize: data.arrowSize || 10
    });

      if (!board.connections) board.connections = [];
      board.connections.push(conn);
      board.updated = Date.now();
      console.log(`[${MODULE_ID}] Saving board with ${board.connections.length} connections...`);
      await this._persistBoards();
      console.log(`[${MODULE_ID}] Board saved, rendering connection...`);
      this._renderConnection(conn, board);
      console.log(`[${MODULE_ID}] Connection created successfully: ${conn.id}`);
      return conn;
    } catch (err) {
      console.error(`[${MODULE_ID}] _onCreateConnection error:`, err);
      ui.notifications.error("Connection failed: " + err.message);
      return null;
    }
  }

  async _onConnectionClick(conn) {
    const board = this.getCurrentBoard();
    if (!board) return;
    const fromItem = board.items?.find(i => i.id === conn.fromId);
    const toItem = board.items?.find(i => i.id === conn.toId);
    if (!fromItem || !toItem) return;

    const { ConnectionDialog } = await import("./dialogs/connection-dialog.js");
    const data = await ConnectionDialog(conn, fromItem, toItem);
    if (data === false) {
      // Delete connection
      board.connections = board.connections.filter(c => c.id !== conn.id);
    } else if (data) {
      // Update — copy all scalar fields, then rehydrate events
      conn.name = data.name ?? conn.name;
      conn.type = data.type ?? conn.type;
      conn.icon = data.icon ?? conn.icon;
      conn.iconSize = data.iconSize ?? conn.iconSize;
      conn.iconColor = data.iconColor ?? conn.iconColor;
      conn.lineColor = data.lineColor ?? conn.lineColor;
      conn.lineStyle = data.lineStyle ?? conn.lineStyle;
      conn.lineWidth = data.lineWidth ?? conn.lineWidth;
      conn.arrowStyle = data.arrowStyle ?? conn.arrowStyle;
      conn.arrowDirection = data.arrowDirection ?? conn.arrowDirection;
      conn.arrowSize = data.arrowSize ?? conn.arrowSize;
      conn.description = data.description ?? conn.description;
      // Rehydrate events
      if (data.events) {
        conn.events = data.events.map(e =>
          e instanceof ConnectionEvent ? e : ConnectionEvent.fromJSON(e)
        );
      }
    }
    await this._persistBoards();
    this._refreshConnections();
  }

  _onToolbarAction(action, btn) {
    switch (action) {
      case "zoom-in": this._zoom(0.9); break;
      case "zoom-out": this._zoom(1.1); break;
      case "zoom-reset": this._zoomReset(); break;
      case "toggle-grid":
        this.showGrid = !this.showGrid;
        game.settings.set(MODULE_ID, "showGrid", this.showGrid);
        btn.classList.toggle("active", this.showGrid);
        if (this._gridLayer) this._gridLayer.style.display = this.showGrid ? "" : "none";
        break;
      case "snap-grid":
        this.snapToGrid = !this.snapToGrid;
        game.settings.set(MODULE_ID, "snapToGrid", this.snapToGrid);
        btn.classList.toggle("active", this.snapToGrid);
        break;
      case "add-item": {
        const board = this.getCurrentBoard();
        if (board) this._onAddItemAt(0, 0);
        break;
      }
    }
  }

  _zoom(factor) {
    if (!this._svgEl) return;
    const vb = this._svgEl.getAttribute("viewBox").split(" ").map(Number);
    const nw = vb[2] * factor;
    const nh = vb[3] * factor;
    const dx = vb[2] - nw;
    const dy = vb[3] - nh;
    this._svgEl.setAttribute("viewBox", `${vb[0] + dx / 2} ${vb[1] + dy / 2} ${nw} ${nh}`);
    this._saveCanvasView();
  }

  _zoomReset() {
    if (!this._svgEl) return;
    this._svgEl.setAttribute("viewBox", "-400 -280 800 560");
    this._saveCanvasView();
  }

  _refreshConnections() {
    if (!this._connLayer) return;
    this._connLayer.innerHTML = "";
    if (this._arrowLayer) this._arrowLayer.innerHTML = "";
    const board = this.getCurrentBoard();
    if (!board?.connections) return;
    for (const conn of board.connections) {
      this._renderConnection(conn, board);
    }
  }

  _updateToolbarInfo(board) {
    const info = this._toolbarEl?.querySelector(".cc-tb-info");
    if (info && board) {
      info.innerHTML = `${board.name} &nbsp;|&nbsp; <i class="fas fa-cubes"></i> ${board.items?.length || 0} &nbsp; <i class="fas fa-link"></i> ${board.connections?.length || 0}`;
    }
  }

  /**
   * Save the current SVG viewBox (pan/zoom position) to the active board.
   * Called after pan or zoom so the canvas position is remembered.
   */
  _saveCanvasView() {
    const board = this.getCurrentBoard();
    if (!board || !this._svgEl) return;
    const vb = this._svgEl.getAttribute("viewBox")?.split(" ").map(Number);
    if (!vb || vb.length !== 4) return;
    board.viewBox.x = vb[0];
    board.viewBox.y = vb[1];
    board.viewBox.zoom = 800 / vb[2]; // viewW = 800 / zoom
    // Persist without full re-render (debounced)
    if (this._viewSaveTimeout) clearTimeout(this._viewSaveTimeout);
    this._viewSaveTimeout = setTimeout(() => this._persistBoards(), 500);
  }

  /**
   * Draw an arrow head at a specific position on the connection line.
   * Uses direct SVG paths instead of markers (avoids currentColor issues).
   * @param {string} svgNS - SVG namespace
   * @param {number} x - Arrow tip X position
   * @param {number} y - Arrow tip Y position
   * @param {number} dirX - Normalized direction X (line direction)
   * @param {number} dirY - Normalized direction Y
   * @param {string} style - arrow | filled | diamond | circle
   * @param {string} color - Arrow color
   * @param {number} lineWidth - Connection line width (scales arrow)
   * @param {string} connId - Connection ID for data attribute
   * @param {string} which - "start" or "end"
   */
  _drawArrowHead(svgNS, x, y, dirX, dirY, style, color, lineWidth, arrowSize, connId, which) {
    const g = document.createElementNS(svgNS, "g");
    g.dataset.arrowFor = connId;
    g.dataset.arrowWhich = which;

    const s = Math.max(4, Math.min(24, arrowSize || 10));
    // Perpendicular vector (rotate dir 90 degrees CCW)
    const px = -dirY;
    const py = dirX;

    let strokeW = Math.max(1, lineWidth * 0.5);

    // Base point: s pixels back from tip along the line direction
    const bx = x - dirX * s;
    const by = y - dirY * s;
    // Wing points: half size back, half size out perpendicular
    const wx = bx + dirX * s * 0.5; // = x - dirX * s * 0.5
    const wy = by + dirY * s * 0.5; // = y - dirY * s * 0.5
    const wing = s * 0.6;
    // Left and right wing tips
    const lx = wx + px * wing;
    const ly = wy + py * wing;
    const rx = wx - px * wing;
    const ry = wy - py * wing;

    switch (style) {
      case "arrow": { // Open chevron — two strokes from wings to tip
        const leftLine = document.createElementNS(svgNS, "line");
        leftLine.setAttribute("x1", lx); leftLine.setAttribute("y1", ly);
        leftLine.setAttribute("x2", x); leftLine.setAttribute("y2", y);
        leftLine.setAttribute("stroke", color);
        leftLine.setAttribute("stroke-width", strokeW);
        leftLine.setAttribute("stroke-linecap", "round");
        g.appendChild(leftLine);
        const rightLine = document.createElementNS(svgNS, "line");
        rightLine.setAttribute("x1", rx); rightLine.setAttribute("y1", ry);
        rightLine.setAttribute("x2", x); rightLine.setAttribute("y2", y);
        rightLine.setAttribute("stroke", color);
        rightLine.setAttribute("stroke-width", strokeW);
        rightLine.setAttribute("stroke-linecap", "round");
        g.appendChild(rightLine);
        break;
      }
      case "filled": { // Solid filled triangle
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", `M ${x} ${y} L ${lx} ${ly} L ${bx} ${by} L ${rx} ${ry} Z`);
        path.setAttribute("fill", color);
        path.setAttribute("stroke", "none");
        g.appendChild(path);
        break;
      }
      case "diamond": { // Filled diamond
        const mx2 = x - dirX * s; // back point
        const my2 = y - dirY * s;
        const dx2 = x - dirX * s * 0.5;
        const dy2 = y - dirY * s * 0.5;
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", `M ${x} ${y} L ${dx2 + px * s * 0.5} ${dy2 + py * s * 0.5} L ${mx2} ${my2} L ${dx2 - px * s * 0.5} ${dy2 - py * s * 0.5} Z`);
        path.setAttribute("fill", color);
        path.setAttribute("stroke", "none");
        g.appendChild(path);
        break;
      }
      case "circle": { // Ring + dot
        const cx = x - dirX * s * 0.5;
        const cy = y - dirY * s * 0.5;
        const r = s * 0.35;
        const ring = document.createElementNS(svgNS, "circle");
        ring.setAttribute("cx", cx); ring.setAttribute("cy", cy);
        ring.setAttribute("r", r); ring.setAttribute("fill", "none");
        ring.setAttribute("stroke", color); ring.setAttribute("stroke-width", strokeW);
        g.appendChild(ring);
        const dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("cx", cx); dot.setAttribute("cy", cy);
        dot.setAttribute("r", r * 0.5); dot.setAttribute("fill", color);
        g.appendChild(dot);
        break;
      }
    }

    this._arrowLayer?.appendChild(g);
  }

  /**
   * Find where a line from (x1,y1) to (x2,y2) intersects a square box
   * centered at (cx,cy) with half-size `half`.
   * Uses Liang-Barsky clipping against the box edges.
   * Returns the entry intersection point closest to (x1,y1).
   */
  _lineBoxIntersection(x1, y1, x2, y2, cx, cy, half) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // If source is inside the box, return source
    if (Math.abs(x1 - cx) <= half && Math.abs(y1 - cy) <= half) {
      return { x: x1, y: y1 };
    }

    // Liang-Barsky: find t where line enters the box
    // P(t) = (x1 + t*dx, y1 + t*dy), t in [0,1]
    let tEnter = 0;
    let tExit = 1;

    const edges = [
      { p: -dx, q: x1 - (cx - half) }, // left
      { p:  dx, q: (cx + half) - x1 }, // right
      { p: -dy, q: y1 - (cy - half) }, // top
      { p:  dy, q: (cy + half) - y1 }, // bottom
    ];

    for (const edge of edges) {
      if (edge.p === 0) {
        if (edge.q < 0) return { x: x2, y: y2 }; // parallel and outside
      } else {
        const t = edge.q / edge.p;
        if (edge.p < 0) {
          tEnter = Math.max(tEnter, t);
        } else {
          tExit = Math.min(tExit, t);
        }
      }
    }

    if (tEnter > tExit) return { x: x2, y: y2 }; // no intersection

    // Return entry point (where line enters the box)
    return {
      x: x1 + tEnter * dx,
      y: y1 + tEnter * dy
    };
  }

  _mapBgPosition(pos) {
    const map = {
      "top-left": "top left", "top": "top center", "top-right": "top right",
      "left": "center left", "center": "center center", "right": "center right",
      "bottom-left": "bottom left", "bottom": "bottom center", "bottom-right": "bottom right"
    };
    return map[pos] || "center center";
  }

  /* -------------------------------------------- */
  /*  Persistence                                 */
  /* -------------------------------------------- */

  async _loadBoards() {
    // GM mode: load from world settings
    if (this.actor?.isGM) {
      const stored = game.settings.get(MODULE_ID, "gmBoards");
      this.boards = (stored || []).map(d => Board.fromJSON(d));
    } else if (this.actor) {
      const stored = await this.actor.getFlag(MODULE_ID, "boards");
      this.boards = stored?.map(d => Board.fromJSON(d)) || [];
    } else {
      this.boards = [];
    }
    if (!this.activeBoardId || !this.boards.find(b => b.id === this.activeBoardId)) {
      this.activeBoardId = this.boards[0]?.id || null;
    }
  }

  async _persistBoards() {
    // GM mode: save to world settings
    if (this.actor?.isGM) {
      await game.settings.set(MODULE_ID, "gmBoards", this.boards.map(b => b.toJSON()));
    } else if (this.actor) {
      await this.actor.setFlag(MODULE_ID, "boards", this.boards.map(b => b.toJSON()));
    }
  }

  getCurrentBoard() {
    return this.boards.find(b => b.id === this.activeBoardId) || null;
  }

  /* -------------------------------------------- */
  /*  Panel Position Save / Restore               */
  /* -------------------------------------------- */

  /**
   * Get the storage key for this actor's position.
   * GM uses "gm", players use their actor ID.
   */
  _positionKey() {
    return this.actor?.isGM ? "gm" : (this.actor?.id || "default");
  }

  /**
   * Save the panel's screen position and size to a registered client setting.
   * Uses a single Object setting keyed by actor ID.
   */
  async _savePosition() {
    if (!this.element || !this.actor) return;
    const top = parseInt(this.element.style.top) || 100;
    const left = parseInt(this.element.style.left) || 100;
    const width = parseInt(this.element.style.width) || 800;
    const height = parseInt(this.element.style.height) || 600;

    try {
      const allPositions = game.settings.get(MODULE_ID, "panelPosition") || {};
      allPositions[this._positionKey()] = { top, left, width, height };
      await game.settings.set(MODULE_ID, "panelPosition", allPositions);
      console.log(`[${MODULE_ID}] Saved position:`, this._positionKey(), { top, left, width, height });
    } catch (err) {
      console.warn(`[${MODULE_ID}] Failed to save panel position:`, err);
    }
  }

  /**
   * Load the previously saved panel position and size.
   */
  _loadSavedPosition() {
    if (!this.actor) { this._savedPosition = null; return; }
    try {
      const allPositions = game.settings.get(MODULE_ID, "panelPosition") || {};
      this._savedPosition = allPositions[this._positionKey()] || null;
      console.log(`[${MODULE_ID}] Loaded position:`, this._positionKey(), this._savedPosition);
    } catch {
      this._savedPosition = null;
    }
  }

  /* -------------------------------------------- */
  /*  Visibility / Lifecycle                      */
  /* -------------------------------------------- */

  show() {
    this._isVisible = true;
    if (this.element) this.element.style.display = "flex";
  }

  hide() {
    this._isVisible = false;
    if (this.element) this.element.style.display = "none";
  }

  bringToFront() {
    if (!this.element) return;
    // Increment z-index above all other panels but below Foundry app windows
    const allPanels = document.querySelectorAll(".cc-panel");
    let maxZ = 50;
    allPanels.forEach(p => { maxZ = Math.max(maxZ, parseInt(p.style.zIndex) || 50); });
    this.element.style.zIndex = `${maxZ + 1}`;
  }



  /**
   * Show a modal dialog with controls help / keyboard shortcuts.
   */
  _showControlsHelp() {
    // Remove any existing help dialog
    document.querySelectorAll(".cc-help-overlay").forEach(m => m.remove());

    const overlay = document.createElement("div");
    overlay.className = "cc-help-overlay";
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); z-index: 2000;
      display: flex; align-items: center; justify-content: center;
      padding: 20px; font-family: var(--font-primary,'Signika',sans-serif);
    `;

    const dialog = document.createElement("div");
    dialog.style.cssText = `
      background: linear-gradient(180deg,#1a1a2e,#16213e);
      border: 1px solid #2a2a4a; border-radius: 8px;
      width: 480px; max-width: 95vw; max-height: 85vh;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      font-size: 13px; color: #e8e8e8;
      display: flex; flex-direction: column; overflow: hidden;
    `;

    dialog.innerHTML = `
      <div style="padding:12px 16px;background:linear-gradient(90deg,#0f3460,#1a1a2e);border-bottom:1px solid #2a2a4a;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-weight:600;color:#c9a227;font-size:14px;"><i class="fas fa-info-circle" style="margin-right:8px;color:#3a8fd4;"></i>Controls Help</span>
        <button id="ccHelpClose" style="background:none;border:none;color:#b0b0b0;cursor:pointer;font-size:14px;padding:2px 6px;"><i class="fas fa-times"></i></button>
      </div>
      <div style="padding:16px;overflow-y:auto;">

        <div style="margin-bottom:14px;">
          <div style="font-weight:600;color:#c9a227;margin-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;"><i class="fas fa-mouse" style="margin-right:6px;"></i>Canvas Navigation</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Left-Click Hold + Drag</kbd> on empty space</span>
              <span>Pan the canvas</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Mouse Wheel</kbd></span>
              <span>Zoom in / out</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Click</kbd> on empty space</span>
              <span>Does nothing</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-weight:600;color:#c9a227;margin-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;"><i class="fas fa-cubes" style="margin-right:6px;"></i>Items</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Left-Click Hold + Drag</kbd></span>
              <span>Move item</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Double-Click</kbd> item</span>
              <span>Start connection</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Right-Click</kbd> item</span>
              <span>Edit item dialog</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Left-Click</kbd> item (tap)</span>
              <span>Does nothing</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;">Hover item</span>
              <span>Show tooltip</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-weight:600;color:#c9a227;margin-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;"><i class="fas fa-link" style="margin-right:6px;"></i>Connections</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;">Double-click item A → click item B</span>
              <span>Create connection</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Escape</kbd></span>
              <span>Cancel connect mode</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Right-Click</kbd> connection icon</span>
              <span>Edit connection</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;">Hover connection</span>
              <span>Show tooltip</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-weight:600;color:#c9a227;margin-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;"><i class="fas fa-table-columns" style="margin-right:6px;"></i>Boards & Tabs</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Click</kbd> tab</span>
              <span>Switch board</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Right-Click</kbd> tab</span>
              <span>Board settings</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
              <span style="color:#b0b0b0;"><kbd style="background:#2a2a4a;padding:2px 6px;border-radius:3px;font-family:inherit;">Double-Click</kbd> tab name</span>
              <span>Rename board</span>
            </div>
          </div>
        </div>

        <div>
          <div style="font-weight:600;color:#c9a227;margin-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;"><i class="fas fa-hand-paper" style="margin-right:6px;"></i>Drag & Drop</div>
          <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(15,52,96,0.2);border-radius:4px;">
            <span style="color:#b0b0b0;">Cypher Taskbar blue hand → canvas</span>
            <span>Drop Actor, Item, Journal, Scene</span>
          </div>
        </div>

      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Close handlers
    dialog.querySelector("#ccHelpClose")?.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }

  async close() {
    this._exitConnectMode(); // Clean up any active connect mode
    await this._savePosition(); // Remember where the panel was
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    _panels.delete(this.actor?.id);
    this._hideTooltip();
  }
}
