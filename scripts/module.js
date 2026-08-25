/**
 * Cypher Connections — Main Entry Point
 *
 * Visual investigation board with items, connections, and relationship mapping
 * for the Cypher System. Integrates with the Cypher Taskbar module as a panel.
 *
 * @module cypher-connections
 */

import { MODULE_ID, SOCKET_EVENTS } from "./constants.js";
import { Board, BoardItem, Connection } from "./data-model.js";
import { SETTINGS, registerSettings } from "./settings.js";
import { SocketHandler } from "./socket-handler.js";

// ============================================================================
// Hook: init — Register settings
// ============================================================================

Hooks.once("init", () => {
  console.log(`[${MODULE_ID}] Initialising Cypher Connections…`);
  registerSettings();
});

// ============================================================================
// Hook: ready — Initialise sockets, register global API
// ============================================================================

Hooks.once("ready", () => {
  SocketHandler.init();

  // Subscribe to remote board-change events so other users' edits reflect here
  for (const [, eventName] of Object.entries(SOCKET_EVENTS)) {
    SocketHandler.on(eventName, (data) => {
      Hooks.callAll(`${MODULE_ID}.${eventName}`, data);
    });
  }

  console.log(`[${MODULE_ID}] Cypher Connections ready.`);
});

// ============================================================================
// Taskbar Integration — Multiple strategies for maximum compatibility
// ============================================================================

/**
 * Register the Connections panel with the Cypher Taskbar.
 * Tries multiple integration strategies:
 *  1. Hook: "cypherTaskbar.registerPanels" (registry.register)
 *  2. Hook: "cypherTaskbar.ready" (direct API)
 *  3. Global: window.CypherTaskbar.registerPanel()
 *  4. Global: game.modules.get("cypher-taskbar")?.api?.registerPanel()
 *  5. DOM Injection: directly append a button to the taskbar element
 */
function registerWithTaskbar() {
  const attempts = [];

  // Strategy 1: Hook-based registry (our preferred approach)
  Hooks.on("cypherTaskbar.registerPanels", (registry) => {
    attempts.push("Strategy 1: cypherTaskbar.registerPanels hook");
    import("./board-panel.js").then((mod) => {
      if (typeof registry?.register === "function") {
        registry.register({
          id: "connections",
          icon: "fa-project-diagram",
          label: game.i18n.localize("CYPHERCONNECTIONS.PANEL.title"),
          position: "right",
          panel: mod.BoardPanel,
          order: 50
        });
        console.log(`[${MODULE_ID}] Registered via Strategy 1 (registry.register)`);
      } else {
        console.warn(`[${MODULE_ID}] Strategy 1: registry.register is not a function`);
      }
    }).catch((err) => {
      console.warn(`[${MODULE_ID}] Strategy 1 failed:`, err);
    });
  });

  // Strategy 2: Taskbar ready hook with direct API
  Hooks.on("cypherTaskbar.ready", (api) => {
    attempts.push("Strategy 2: cypherTaskbar.ready hook");
    import("./board-panel.js").then((mod) => {
      if (typeof api?.registerPanel === "function") {
        api.registerPanel({
          id: "connections",
          icon: "fa-project-diagram",
          label: game.i18n.localize("CYPHERCONNECTIONS.PANEL.title"),
          position: "right",
          panel: mod.BoardPanel,
          order: 50
        });
        console.log(`[${MODULE_ID}] Registered via Strategy 2 (api.registerPanel)`);
      }
    }).catch((err) => {
      console.warn(`[${MODULE_ID}] Strategy 2 failed:`, err);
    });
  });

  // Strategy 3: Check for existing global taskbar object
  if (window.CypherTaskbar?.registerPanel) {
    attempts.push("Strategy 3: window.CypherTaskbar.registerPanel");
    import("./board-panel.js").then((mod) => {
      window.CypherTaskbar.registerPanel({
        id: "connections",
        icon: "fa-project-diagram",
        label: game.i18n.localize("CYPHERCONNECTIONS.PANEL.title"),
        position: "right",
        panel: mod.BoardPanel,
        order: 50
      });
      console.log(`[${MODULE_ID}] Registered via Strategy 3 (window.CypherTaskbar)`);
    }).catch((err) => {
      console.warn(`[${MODULE_ID}] Strategy 3 failed:`, err);
    });
  }

  // Strategy 4: Check game.modules API
  const taskbarModule = game.modules?.get("cypher-taskbar");
  if (taskbarModule?.api?.registerPanel) {
    attempts.push("Strategy 4: game.modules.get('cypher-taskbar').api");
    import("./board-panel.js").then((mod) => {
      taskbarModule.api.registerPanel({
        id: "connections",
        icon: "fa-project-diagram",
        label: game.i18n.localize("CYPHERCONNECTIONS.PANEL.title"),
        position: "right",
        panel: mod.BoardPanel,
        order: 50
      });
      console.log(`[${MODULE_ID}] Registered via Strategy 4 (game.modules api)`);
    }).catch((err) => {
      console.warn(`[${MODULE_ID}] Strategy 4 failed:`, err);
    });
  }

  // Strategy 5: DOM injection fallback — use MutationObserver to detect
  // when the taskbar appears in the DOM and inject a button immediately.
  // Also retry on every application render as a safety net.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList" && m.addedNodes.length > 0) {
        injectTaskbarButtonDOM();
      }
    }
  });
  // Start observing as soon as body is available
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Safety net: also try after a delay and on renders
  setTimeout(() => injectTaskbarButtonDOM(), 1000);
  setTimeout(() => injectTaskbarButtonDOM(), 3000);
  Hooks.on("renderApplication", () => injectTaskbarButtonDOM());

  // Watch for setting changes to add/remove the button dynamically
  Hooks.on("updateSetting", (setting) => {
    if (setting.key !== "showTaskbarButton") return;
    const showBtn = setting.value ?? true;
    const existing = document.getElementById("ct-btn-connections");
    if (showBtn && !existing) {
      injectTaskbarButtonDOM();
    } else if (!showBtn && existing) {
      existing.remove();
    }
  });
}

/**
 * Fallback: Inject a button directly into the Cypher Taskbar's DOM.
 * Uses the correct Cypher Taskbar v2.x DOM structure:
 *   .ct-section-1 contains: .ct-bar-meta → #ct-btn-stuff → #ct-btn-book
 *   We insert our button AFTER #ct-btn-book (right of JOURNAL).
 */
function injectTaskbarButtonDOM() {
  // Check setting — don't inject if user disabled the taskbar button
  const showBtn = game.settings?.get?.(MODULE_ID, "showTaskbarButton") ?? true;
  if (!showBtn) return;

  // Avoid injecting multiple times
  if (document.getElementById("ct-btn-connections")) return;

  // Find the Cypher Taskbar bar element
  const taskbarEl = document.querySelector("#cypher-taskbar-bar");
  if (!taskbarEl) return; // Taskbar not in DOM yet — will retry

  // Find section 1 which contains the STUFF and BOOK (JOURNAL) buttons
  const section1 = taskbarEl.querySelector(".ct-section-1");
  if (!section1) return;

  // Find the BOOK (JOURNAL) button to insert after it
  const bookBtn = section1.querySelector("#ct-btn-book, .ct-book-btn");

  // Create the Connections button using the same ct-btn class as native buttons
  const btn = document.createElement("button");
  btn.id = "ct-btn-connections";
  btn.className = "ct-btn ct-connections-btn";
  btn.title = "Connections";
  btn.setAttribute("aria-label", "Connections");
  btn.innerHTML = `<i class="fas fa-project-diagram"></i>`;

  // Click handler: toggle the connections panel
  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const { BoardPanel } = await import("./board-panel.js");
    const actorId = CypherConnections._getCurrentActorId();

    // Check if panel is already open → close it (toggle)
    const existing = BoardPanel.getOpenPanel(actorId);
    if (existing) {
      btn.classList.remove("ct-btn-active");
      await existing.close();
      return;
    }

    // Get button position for anchoring the panel above it
    const rect = btn.getBoundingClientRect();
    const anchor = { x: rect.left + rect.width / 2, y: rect.top };

    btn.classList.add("ct-btn-active");
    await CypherConnections.openBoard(anchor);
  });

  // Insert after the BOOK button, or append to section 1 as fallback
  if (bookBtn && bookBtn.nextSibling) {
    section1.insertBefore(btn, bookBtn.nextSibling);
  } else if (bookBtn) {
    section1.appendChild(btn);
  } else {
    section1.appendChild(btn); // Fallback: just append to section 1
  }

  console.log(`[${MODULE_ID}] Taskbar button injected into .ct-section-1 (right of JOURNAL)`);
}

// Run registration on init
registerWithTaskbar();

// ============================================================================
// CypherConnections API
// ============================================================================

/**
 * Primary public API for Cypher Connections.
 * All boards are persisted as actor flags (`actor.flags[MODULE_ID].boards`).
 */
class CypherConnections {

  /**
   * Open the connections panel for the given actor.
   * If no actor is provided, uses the currently controlled/token actor.
   *
   * @param {string} [actorId] - Actor document ID
   * @returns {Promise<foundry.applications.api.ApplicationV2|null>} The opened panel instance
   */
  static async openBoard(anchor) {
    // Use the user's assigned character, or fall back to the single owned actor
    const id = this._getCurrentActorId();

    if (!id) {
      ui.notifications.warn("No actor assigned. Please assign a character to your user.");
      return null;
    }

    // GM mode: pass a special GM object (no actor needed)
    if (id === "gm") {
      const { BoardPanel } = await import("./board-panel.js");
      return BoardPanel.open({ id: "gm", name: "GM", isGM: true }, anchor);
    }

    const actor = game.actors.get(id);
    if (!actor) {
      ui.notifications.warn("Assigned actor not found.");
      return null;
    }

    // Open via BoardPanel static factory, passing anchor for positioning
    const { BoardPanel } = await import("./board-panel.js");
    return BoardPanel.open(actor, anchor);
  }

  /**
   * Retrieve all investigation boards stored on an actor.
   *
   * @param {string} actorId - Actor document ID
   * @returns {Board[]} Array of Board instances (may be empty)
   */
  static getBoards(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return [];
    const raw = actor.getFlag(MODULE_ID, "boards") ?? [];
    return raw.map(b => Board.fromJSON(b));
  }

  /**
   * Create a new board on the specified actor.
   *
   * @param {string} actorId - Actor document ID
   * @param {string} [name]  - Board name (defaults to the setting `defaultBoardName`)
   * @returns {Promise<Board|null>} The created board, or null on failure
   */
  static async createBoard(actorId, name) {
    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("CYPHERCONNECTIONS.ERRORS.noActor"));
      return null;
    }

    const boards = this.getBoards(actorId);
    const max = game.settings.get(MODULE_ID, SETTINGS.maxBoards);
    if (boards.length >= max) {
      ui.notifications.error(
        game.i18n.format("CYPHERCONNECTIONS.ERRORS.maxBoardsReached", { max })
      );
      return null;
    }

    const boardName = name || game.settings.get(MODULE_ID, SETTINGS.defaultBoardName);
    const board = new Board({ name: boardName, actorId });
    boards.push(board);

    await actor.setFlag(MODULE_ID, "boards", boards.map(b => b.toJSON()));

    SocketHandler.emit(SOCKET_EVENTS.BOARD_UPDATE, { actorId, board: board.toJSON() });
    Hooks.callAll(`${MODULE_ID}.boardCreated`, board);

    return board;
  }

  /**
   * Delete a board from its owning actor.
   *
   * @param {string} boardId - Board UUID
   * @returns {Promise<boolean>} True if the board was removed
   */
  static async deleteBoard(boardId) {
    // Find the actor that owns this board
    const { actorId } = this._findBoardOwner(boardId);
    if (!actorId) {
      ui.notifications.error(game.i18n.localize("CYPHERCONNECTIONS.ERRORS.boardNotFound"));
      return false;
    }

    const actor = game.actors.get(actorId);
    if (!actor) return false;

    const boards = this.getBoards(actorId).filter(b => b.id !== boardId);
    await actor.setFlag(MODULE_ID, "boards", boards.map(b => b.toJSON()));

    SocketHandler.emit(SOCKET_EVENTS.BOARD_UPDATE, { actorId, boardId, deleted: true });
    Hooks.callAll(`${MODULE_ID}.boardDeleted`, { actorId, boardId });

    return true;
  }

  /**
   * Export a board to a JSON string (for file download / sharing).
   *
   * @param {string} boardId - Board UUID
   * @returns {string|null} JSON string, or null if board not found
   */
  static exportBoard(boardId) {
    const { board } = this._findBoardOwner(boardId);
    if (!board) {
      ui.notifications.error(game.i18n.localize("CYPHERCONNECTIONS.ERRORS.boardNotFound"));
      return null;
    }

    const exportData = {
      module: MODULE_ID,
      version: game.modules.get(MODULE_ID)?.version ?? "1.0.0",
      exportedAt: new Date().toISOString(),
      board: board.toJSON()
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import a board from a JSON string and attach it to an actor.
   *
   * @param {string} json - Raw JSON string (previously created by exportBoard)
   * @param {string} [actorId] - Target actor (defaults to current actor)
   * @returns {Promise<Board|null>} The imported board, or null on failure
   */
  static async importBoard(json, actorId) {
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      ui.notifications.error(game.i18n.localize("CYPHERCONNECTIONS.ERRORS.importFailed"));
      return null;
    }

    if (!data.board) {
      ui.notifications.error(game.i18n.localize("CYPHERCONNECTIONS.ERRORS.importFailed"));
      return null;
    }

    const targetActorId = actorId || this._getCurrentActorId();
    if (!targetActorId) {
      ui.notifications.warn(game.i18n.localize("CYPHERCONNECTIONS.ERRORS.noActor"));
      return null;
    }

    // Generate fresh IDs so the imported board doesn't collide with existing ones
    const raw = data.board;
    raw.id = foundry.utils.randomID(16);
    raw.actorId = targetActorId;
    raw.userId = game.userId;
    raw.created = Date.now();
    raw.updated = Date.now();

    // Remap item IDs and update connections accordingly
    const idMap = {};
    for (const item of raw.items ?? []) {
      const newId = foundry.utils.randomID(16);
      idMap[item.id] = newId;
      item.id = newId;
      item.boardId = raw.id;
    }
    for (const conn of raw.connections ?? []) {
      conn.id = foundry.utils.randomID(16);
      conn.boardId = raw.id;
      conn.fromId = idMap[conn.fromId] || conn.fromId;
      conn.toId = idMap[conn.toId] || conn.toId;
    }

    const board = Board.fromJSON(raw);

    // Persist
    const boards = this.getBoards(targetActorId);
    const max = game.settings.get(MODULE_ID, SETTINGS.maxBoards);
    if (boards.length >= max) {
      ui.notifications.error(
        game.i18n.format("CYPHERCONNECTIONS.ERRORS.maxBoardsReached", { max })
      );
      return null;
    }
    boards.push(board);

    const actor = game.actors.get(targetActorId);
    await actor.setFlag(MODULE_ID, "boards", boards.map(b => b.toJSON()));

    SocketHandler.emit(SOCKET_EVENTS.BOARD_UPDATE, { actorId: targetActorId, board: board.toJSON() });
    Hooks.callAll(`${MODULE_ID}.boardImported`, board);

    return board;
  }

  /**
   * Run diagnostics to help debug taskbar integration issues.
   * Call from browser console: CypherConnections.diagnose()
   */
  static diagnose() {
    console.group(`[${MODULE_ID}] Integration Diagnostics`);

    // 1. Check if module is loaded
    const mod = game.modules?.get(MODULE_ID);
    console.log("Module loaded:", !!mod, mod ? `(v${mod.version})` : "");

    // 2. Check if BoardPanel is available
    console.log("BoardPanel class:", typeof this._BoardPanel, "(call openBoard() to load)");

    // 3. Check for Cypher Taskbar module
    const taskbarMod = game.modules?.get("cypher-taskbar");
    console.log("Cypher Taskbar module:", !!taskbarMod, taskbarMod ? `(v${taskbarMod.version})` : "not installed/enabled");

    // 4. Check taskbar global objects
    console.log("window.CypherTaskbar:", typeof window.CypherTaskbar);
    console.log("window.CypherTaskbar?.registerPanel:", typeof window.CypherTaskbar?.registerPanel);
    console.log("game.cyphertaskbar:", typeof game.cyphertaskbar);

    // 5. Check taskbar DOM element
    const selectors = ["#cypher-taskbar", "#cypher-taskbar-container", ".cypher-taskbar", ".cypher-taskbar-container", "[data-cypher-taskbar]"];
    let found = false;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { console.log("Taskbar DOM found:", sel, el); found = true; break; }
    }
    if (!found) console.warn("Taskbar DOM element NOT found (tried selectors:", selectors.join(", "), ")");

    // 6. Check if our DOM-injected button exists
    const ourBtn = document.getElementById("cypher-connections-taskbar-btn");
    console.log("Our DOM-injected button:", !!ourBtn);

    // 7. Check if scene control button exists
    const sceneBtn = ui.controls?.controls?.find?.(c => c.name === "cypher-connections" || c.name === "cypher");
    console.log("Scene control button:", !!sceneBtn);

    // 8. List available hooks
    const knownHooks = ["cypherTaskbar.registerPanels", "cypherTaskbar.ready", "cypherTaskbar.render"];
    console.log("Known taskbar hooks:", knownHooks.join(", "));
    console.log("(Hooks._hooks contains:", Object.keys(Hooks._hooks || {}).filter(k => k.includes("cypher") || k.includes("taskbar")).join(", ") || "none registered yet", ")");

    console.groupEnd();

    ui.notifications.info(`[${MODULE_ID}] Diagnostics printed to console. Press F12 to view.`);
  }

  // -- Internal helpers -----------------------------------------------------

  /**
   * Find which actor owns a board with the given ID.
   * @param {string} boardId
   * @returns {{actorId: string|null, board: Board|null}}
   * @private
   */
  static _findBoardOwner(boardId) {
    for (const actor of game.actors) {
      const boards = this.getBoards(actor.id);
      const board = boards.find(b => b.id === boardId);
      if (board) return { actorId: actor.id, board };
    }
    return { actorId: null, board: null };
  }

  /**
   * Determine the "current" actor ID based on selected tokens or the user's character.
   * @returns {string|null}
   * @private
   */
  static _getCurrentActorId() {
    // GM users get a special "gm" ID — no actor needed
    if (game.user.isGM) return "gm";

    // 1. The user's assigned character is the primary active actor
    if (game.user.character) return game.user.character.id;

    // 2. Fallback: if only one actor is owned, use that
    const owned = game.actors.filter(a => a.isOwner);
    if (owned.length === 1) return owned[0].id;

    return null;
  }
}

// Expose the API globally so macros, other modules, and console users can access it
window.CypherConnections = CypherConnections;

// Also export the classes for internal module consumption
export { CypherConnections, Board, BoardItem, Connection };
