/**
 * Constants and enumerations for the Cypher Connections module.
 * @module constants
 */

/** @type {string} The module identifier used for flags, settings, and localization */
export const MODULE_ID = "cypher-connections";

/** @type {number} Default size for board items in pixels */
export const ITEM_SIZE = 80;

/**
 * Item type definitions with display labels, default Font Awesome icons, and type colors.
 * @type {Object<string, {label: string, defaultIcon: string, color: string}>}
 */
export const ITEM_TYPES = {
  person:      { label: "Person",       defaultIcon: "fa-user",            color: "#4a9eff" },
  place:       { label: "Place",        defaultIcon: "fa-map-marker-alt",  color: "#4caf50" },
  item:        { label: "Item",         defaultIcon: "fa-cube",            color: "#ff9800" },
  mystery:     { label: "Mystery",      defaultIcon: "fa-question-circle", color: "#9c27b0" },
  journal:     { label: "Journal",      defaultIcon: "fa-book",            color: "#795548" },
  image:       { label: "Image",        defaultIcon: "fa-image",           color: "#e91e63" },
  placeholder: { label: "Placeholder",  defaultIcon: "fa-question",        color: "#607d8b" }
};

/**
 * Connection type definitions with display labels and colors.
 * @type {Array<{id: string, label: string, color: string}>}
 */
export const CONNECTION_TYPES = [
  { id: "friendly",     label: "Friendly",     color: "#4caf50" },
  { id: "hostile",      label: "Hostile",      color: "#f44336" },
  { id: "suspicious",   label: "Suspicious",   color: "#ff9800" },
  { id: "romantic",     label: "Romantic",     color: "#e91e63" },
  { id: "family",       label: "Family",       color: "#9c27b0" },
  { id: "professional", label: "Professional", color: "#2196f3" },
  { id: "mysterious",   label: "Mysterious",   color: "#673ab7" },
  { id: "warning",      label: "Warning",      color: "#ff5722" },
  { id: "clue",         label: "Clue / Lead",  color: "#c9a227" },
  { id: "secret",       label: "Secret",       color: "#607d8b" },
  { id: "allied",       label: "Allied",       color: "#00bcd4" },
  { id: "enemy",        label: "Enemy",        color: "#d32f2f" },
  { id: "visited",      label: "Visited",      color: "#8bc34a" },
  { id: "unknown",      label: "Unknown",      color: "#9e9e9e" },
  { id: "torevisit",    label: "To Revisit",   color: "#ffeb3b" }
];

/**
 * Connection icon definitions — 50 Font Awesome icons organized by category.
 * @type {Array<{id: string, icon: string, category: string, label: string}>}
 */
export const CONNECTION_ICONS = [
  // Navigation (5)
  { id: "nav-map",        icon: "fa-map",           category: "navigation", label: "Map" },
  { id: "nav-compass",    icon: "fa-compass",       category: "navigation", label: "Compass" },
  { id: "nav-route",      icon: "fa-route",         category: "navigation", label: "Route" },
  { id: "nav-location",   icon: "fa-map-pin",       category: "navigation", label: "Location Pin" },
  { id: "nav-globe",      icon: "fa-globe",         category: "navigation", label: "Globe" },

  // People (5)
  { id: "ppl-user",       icon: "fa-user",          category: "people", label: "User" },
  { id: "ppl-users",      icon: "fa-users",         category: "people", label: "Users" },
  { id: "ppl-crown",      icon: "fa-crown",         category: "people", label: "Crown" },
  { id: "ppl-mask",       icon: "fa-theater-masks", category: "people", label: "Masks" },
  { id: "ppl-handshake",  icon: "fa-handshake",     category: "people", label: "Handshake" },

  // Objects (5)
  { id: "obj-key",        icon: "fa-key",           category: "objects", label: "Key" },
  { id: "obj-lock",       icon: "fa-lock",          category: "objects", label: "Lock" },
  { id: "obj-envelope",   icon: "fa-envelope",      category: "objects", label: "Envelope" },
  { id: "obj-coins",      icon: "fa-coins",         category: "objects", label: "Coins" },
  { id: "obj-gem",        icon: "fa-gem",           category: "objects", label: "Gem" },

  // Nature (5)
  { id: "nat-tree",       icon: "fa-tree",          category: "nature", label: "Tree" },
  { id: "nat-leaf",       icon: "fa-leaf",          category: "nature", label: "Leaf" },
  { id: "nat-sun",        icon: "fa-sun",           category: "nature", label: "Sun" },
  { id: "nat-moon",       icon: "fa-moon",          category: "nature", label: "Moon" },
  { id: "nat-bolt",       icon: "fa-bolt",          category: "nature", label: "Bolt" },

  // Magic (5)
  { id: "mag-wand",       icon: "fa-magic",         category: "magic", label: "Magic Wand" },
  { id: "mag-star",       icon: "fa-star",          category: "magic", label: "Star" },
  { id: "mag-eye",        icon: "fa-eye",           category: "magic", label: "Eye" },
  { id: "mag-scroll",     icon: "fa-scroll",        category: "magic", label: "Scroll" },
  { id: "mag-fire",       icon: "fa-fire",          category: "magic", label: "Fire" },

  // Danger (5)
  { id: "dng-skull",      icon: "fa-skull",         category: "danger", label: "Skull" },
  { id: "dng-bomb",       icon: "fa-bomb",          category: "danger", label: "Bomb" },
  { id: "dng-exclamation",icon: "fa-exclamation-triangle", category: "danger", label: "Warning" },
  { id: "dng-biohazard",  icon: "fa-biohazard",     category: "danger", label: "Biohazard" },
  { id: "dng-radiation",  icon: "fa-radiation",     category: "danger", label: "Radiation" },

  // Knowledge (5)
  { id: "knl-book",       icon: "fa-book",          category: "knowledge", label: "Book" },
  { id: "knl-scroll",     icon: "fa-scroll",        category: "knowledge", label: "Scroll" },
  { id: "knl-graduation", icon: "fa-graduation-cap",category: "knowledge", label: "Graduation Cap" },
  { id: "knl-lightbulb",  icon: "fa-lightbulb",     category: "knowledge", label: "Lightbulb" },
  { id: "knl-puzzle",     icon: "fa-puzzle-piece",  category: "knowledge", label: "Puzzle Piece" },

  // Symbols (5)
  { id: "sym-heart",      icon: "fa-heart",         category: "symbols", label: "Heart" },
  { id: "sym-infinity",   icon: "fa-infinity",      category: "symbols", label: "Infinity" },
  { id: "sym-music",      icon: "fa-music",         category: "symbols", label: "Music" },
  { id: "sym-peace",      icon: "fa-dove",          category: "symbols", label: "Dove" },
  { id: "sym-balance",    icon: "fa-balance-scale", category: "symbols", label: "Balance Scale" },

  // Misc (10)
  { id: "msc-cog",        icon: "fa-cog",           category: "misc", label: "Cog" },
  { id: "msc-flag",       icon: "fa-flag",          category: "misc", label: "Flag" },
  { id: "msc-anchor",     icon: "fa-anchor",        category: "misc", label: "Anchor" },
  { id: "msc-bell",       icon: "fa-bell",          category: "misc", label: "Bell" },
  { id: "msc-clock",      icon: "fa-clock",         category: "misc", label: "Clock" },
  { id: "msc-comment",    icon: "fa-comment",       category: "misc", label: "Comment" },
  { id: "msc-fingerprint",icon: "fa-fingerprint",   category: "misc", label: "Fingerprint" },
  { id: "msc-gavel",      icon: "fa-gavel",         category: "misc", label: "Gavel" },
  { id: "msc-shield-alt", icon: "fa-shield-alt",    category: "misc", label: "Shield" },
  { id: "msc-question",   icon: "fa-question-circle",category: "misc", label: "Question" }
];

/**
 * Socket event names for real-time synchronization between connected clients.
 * @type {Object<string, string>}
 */
export const SOCKET_EVENTS = {
  BOARD_UPDATE:  "board.update",
  ITEM_CREATE:   "item.create",
  ITEM_UPDATE:   "item.update",
  ITEM_DELETE:   "item.delete",
  CONN_CREATE:   "connection.create",
  CONN_UPDATE:   "connection.update",
  CONN_DELETE:   "connection.delete"
};

/**
 * Default values for module settings.
 * @type {Object<string, *>}
 */
export const DEFAULT_SETTINGS = {
  defaultBoardName:  "Investigation Board",
  showGrid:          true,
  snapToGrid:        false,
  connectionIconSize: 24,
  maxBoards:         10,
  enableSync:        true,
  showTaskbarButton: true
};

// ============================================================================
// Font Awesome Unicode Lookup (for SVG text rendering inside foreignObject)
// Maps icon class suffix (e.g. "fa-home") to unicode codepoint string.
// ============================================================================

/** @type {Object<string, string>} */
export const ICON_UNICODE = {
  // Navigation
  "fa-map-marker-alt": "\uf3c5",
  "fa-map-marked-alt": "\uf5a0",
  "fa-compass":          "\uf14e",
  "fa-route":            "\uf4d7",
  "fa-map-pin":          "\uf276",
  "fa-globe":            "\uf0ac",
  // People
  "fa-user":             "\uf007",
  "fa-users":            "\uf0c0",
  "fa-crown":            "\uf521",
  "fa-theater-masks":    "\uf630",
  "fa-handshake":        "\uf2b5",
  // Objects
  "fa-key":              "\uf084",
  "fa-lock":             "\uf023",
  "fa-envelope":         "\uf0e0",
  "fa-coins":            "\uf51e",
  "fa-gem":              "\uf3a5",
  // Nature
  "fa-tree":             "\uf1bb",
  "fa-leaf":             "\uf06c",
  "fa-sun":              "\uf185",
  "fa-moon":             "\uf186",
  "fa-bolt":             "\uf0e7",
  // Magic
  "fa-magic":            "\uf0d0",
  "fa-star":             "\uf005",
  "fa-eye":              "\uf06e",
  "fa-fire":             "\uf06d",
  "fa-book-open":        "\uf518",
  // Danger
  "fa-skull-crossbones": "\uf714",
  "fa-exclamation-triangle": "\uf071",
  "fa-bomb":             "\uf1e2",
  "fa-radiation":        "\uf7b9",
  "fa-biohazard":        "\uf780",
  // Knowledge
  "fa-book":             "\uf02d",
  "fa-scroll":           "\uf70e",
  "fa-graduation-cap":   "\uf19d",
  "fa-university":       "\uf19c",
  "fa-balance-scale":    "\uf24e",
  // Symbols
  "fa-infinity":         "\uf534",
  "fa-yin-yang":         "\uf6ad",
  "fa-ankh":             "\uf644",
  "fa-cross":            "\uf654",
  "fa-om":               "\uf679",
  // Misc
  "fa-home":             "\uf015",
  "fa-heart":            "\uf004",
  "fa-music":            "\uf001",
  "fa-cog":              "\uf013",
  "fa-flag":             "\uf024",
  "fa-anchor":           "\uf13d",
  "fa-bell":             "\uf0f3",
  "fa-clock":            "\uf017",
  "fa-comment":          "\uf075",
  "fa-fingerprint":      "\uf577",
  "fa-gavel":            "\uf0e3",
  "fa-shield-alt":       "\uf3ed",
  "fa-question-circle":  "\uf059"
};

/**
 * Resolve an icon identifier (from CONNECTION_ICONS) to a displayable
 * unicode string for pure-SVG rendering.
 * @param {string} iconId - The CONNECTION_ICONS entry id
 * @returns {string} Unicode character or fallback
 */
export function resolveIconUnicode(iconId) {
  const entry = CONNECTION_ICONS.find(ic => ic.id === iconId);
  if (!entry) return ICON_UNICODE["fa-question-circle"];
  return ICON_UNICODE[entry.icon] || ICON_UNICODE["fa-question-circle"];
}
