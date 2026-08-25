/**
 * Module settings registration for Cypher Connections.
 * Registers all client and world-scoped settings during the `init` hook.
 *
 * @module settings
 */

import { MODULE_ID, DEFAULT_SETTINGS } from "./constants.js";

/**
 * Setting key names exposed for use with game.settings.get/set.
 * @type {Object<string, string>}
 */
export const SETTINGS = {
  defaultBoardName:  "defaultBoardName",
  showGrid:          "showGrid",
  snapToGrid:        "snapToGrid",
  connectionIconSize:"connectionIconSize",
  maxBoards:         "maxBoards",
  enableSync:        "enableSync",
  showTaskbarButton: "showTaskbarButton"
};

/**
 * Register all module settings with Foundry.
 * Called during the `init` hook.
 */
export function registerSettings() {
  // --- Client-scoped settings ---

  game.settings.register(MODULE_ID, SETTINGS.defaultBoardName, {
    name: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.defaultBoardName.name"),
    hint: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.defaultBoardName.hint"),
    scope: "client",
    config: true,
    type: String,
    default: DEFAULT_SETTINGS.defaultBoardName,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, SETTINGS.showGrid, {
    name: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.showGrid.name"),
    hint: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.showGrid.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: DEFAULT_SETTINGS.showGrid,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, SETTINGS.snapToGrid, {
    name: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.snapToGrid.name"),
    hint: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.snapToGrid.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: DEFAULT_SETTINGS.snapToGrid,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, SETTINGS.connectionIconSize, {
    name: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.connectionIconSize.name"),
    hint: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.connectionIconSize.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 16, max: 64, step: 1 },
    default: DEFAULT_SETTINGS.connectionIconSize,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, SETTINGS.enableSync, {
    name: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.enableSync.name"),
    hint: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.enableSync.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: DEFAULT_SETTINGS.enableSync,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, SETTINGS.showTaskbarButton, {
    name: "Show Taskbar Button",
    hint: "Show the Connections button in the Cypher Taskbar. Disable to hide it.",
    scope: "client",
    config: true,
    type: Boolean,
    default: DEFAULT_SETTINGS.showTaskbarButton,
    requiresReload: false
  });

  // --- World-scoped settings ---

  game.settings.register(MODULE_ID, SETTINGS.maxBoards, {
    name: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.maxBoards.name"),
    hint: game.i18n.localize("CYPHERCONNECTIONS.SETTINGS.maxBoards.hint"),
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: 50, step: 1 },
    default: DEFAULT_SETTINGS.maxBoards,
    requiresReload: false
  });

  // GM boards storage (world-scoped, no actor needed)
  game.settings.register(MODULE_ID, "gmBoards", {
    name: "GM Boards",
    hint: "Internal storage for GM investigation boards.",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // Panel position storage (client-scoped, per-actor)
  // Stored as JSON: { [actorId]: { top, left, width, height } }
  game.settings.register(MODULE_ID, "panelPosition", {
    name: "Panel Position",
    hint: "Internal: stores panel position and size per actor.",
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
}
