/**
 * @fileoverview IconPicker - Dialog for selecting connection icons from 50 options.
 * Extends Foundry VTT 14+ DialogV2 with search and category filtering.
 */

import { CONNECTION_ICONS, MODULE_ID } from "../constants.js";

/**
 * Icon picker dialog with 50 Font Awesome icons organized by category.
 * @extends {foundry.applications.api.DialogV2}
 */
export class IconPicker extends foundry.applications.api.DialogV2 {
  /**
   * Default application options.
   * @static
   */
  static DEFAULT_OPTIONS = {
    id: "icon-picker",
    classes: ["cypher-connections", "icon-picker"],
    window: {
      title: "CYPHERCONNECTIONS.ChooseIcon",
      minimizable: true,
      resizable: true,
      contentClasses: ["dialog-content"]
    },
    position: {
      width: 560,
      height: 520
    },
    actions: {
      confirm: IconPicker._onConfirm,
      cancel: IconPicker._onCancel,
      filterCategory: IconPicker._onFilterCategory,
      clearSearch: IconPicker._onClearSearch
    },
    submitOnClose: false
  };

  /** @type {string} Template path */
  static TEMPLATE = "modules/cypher-connections/templates/dialogs/icon-picker.hbs";

  /**
   * Create and open the IconPicker dialog.
   * @param {string|null} currentIcon - Currently selected icon identifier (e.g. "fa-link").
   * @returns {Promise<string|null>} Selected icon ID or null if cancelled.
   */
  static async create(currentIcon = null) {
    const dialog = new IconPicker({
      modal: true,
      data: {
        currentIcon,
        selectedIconId: currentIcon
      }
    });

    return dialog.wait();
  }

  /* -------------------------------------------- */

  /**
   * Prepare template context with icons grouped by category.
   * @protected
   * @returns {Object}
   */
  _prepareContext() {
    const data = this.options.data || {};
    const selectedIconId = this._selectedIconId || data.selectedIconId || data.currentIcon || null;
    const activeCategory = this._activeCategory || "all";
    const searchQuery = (this._searchQuery || "").toLowerCase().trim();

    // Build categories list
    const categories = [
      { id: "all", label: game.i18n.localize("CYPHERCONNECTIONS.CategoryAll"), active: activeCategory === "all" },
      { id: "navigation", label: game.i18n.localize("CYPHERCONNECTIONS.CategoryNavigation"), active: activeCategory === "navigation" },
      { id: "people", label: game.i18n.localize("CYPHERCONNECTIONS.CategoryPeople"), active: activeCategory === "people" },
      { id: "objects", label: game.i18n.localize("CYPHERCONNECTIONS.CategoryObjects"), active: activeCategory === "objects" },
      { id: "nature", label: game.i18n.localize("CYPHERCONNECTIONS.CategoryNature"), active: activeCategory === "nature" },
      { id: "magic", label: game.i18n.localize("CYPHERCONNECTIONS.CategoryMagic"), active: activeCategory === "magic" },
      { id: "danger", label: game.i18n.localize("CYPHERCONNECTIONS.CategoryDanger"), active: activeCategory === "danger" },
      { id: "knowledge", label: game.i18n.localize("CYPHERCONNECTIONS.CategoryKnowledge"), active: activeCategory === "knowledge" },
      { id: "symbols", label: game.i18n.localize("CYPHERCONNECTIONS.CategorySymbols"), active: activeCategory === "symbols" }
    ];

    // Filter icons by category and search
    let icons = CONNECTION_ICONS.map(icon => ({
      ...icon,
      selected: icon.id === selectedIconId
    }));

    if (activeCategory !== "all") {
      icons = icons.filter(icon => icon.category === activeCategory);
    }

    if (searchQuery) {
      icons = icons.filter(icon =>
        icon.label.toLowerCase().includes(searchQuery) ||
        icon.id.toLowerCase().includes(searchQuery)
      );
    }

    const selectedIcon = CONNECTION_ICONS.find(i => i.id === selectedIconId) || null;

    return {
      currentIcon: data.currentIcon,
      selectedIcon,
      categories,
      icons,
      searchQuery
    };
  }

  /* -------------------------------------------- */

  /**
   * Called after rendering. Set up search, category filters, and icon grid selection.
   * @protected
   */
  _onRender() {
    // Search input handler
    const searchInput = this.element.querySelector("#icon-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (evt) => {
        this._searchQuery = evt.target.value;
        this.render({ parts: ["content"] });
      });

      // Enter to select first filtered result
      searchInput.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          const firstIcon = this.element.querySelector(".icon-cell:not(.hidden)");
          if (firstIcon) {
            const iconId = firstIcon.dataset.icon;
            this._selectIcon(iconId);
          }
        }
      });
    }

    // Icon grid click handler (event delegation)
    const iconGrid = this.element.querySelector("#icon-grid");
    if (iconGrid) {
      iconGrid.addEventListener("click", (evt) => {
        const cell = evt.target.closest(".icon-cell");
        if (cell) {
          const iconId = cell.dataset.icon;
          this._selectIcon(iconId);
        }
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Select an icon and update the UI.
   * @param {string} iconId
   * @private
   */
  _selectIcon(iconId) {
    this._selectedIconId = iconId;

    // Update visual selection
    const cells = this.element.querySelectorAll(".icon-cell");
    cells.forEach(cell => {
      cell.classList.toggle("selected", cell.dataset.icon === iconId);
    });

    // Update selected info area
    const selectedIcon = CONNECTION_ICONS.find(i => i.id === iconId);
    const infoArea = this.element.querySelector("#selected-icon-info");
    if (infoArea && selectedIcon) {
      infoArea.innerHTML = `
        <div class="selected-preview">
          <i class="fas ${selectedIcon.id}"></i>
          <span>${selectedIcon.label}</span>
        </div>
      `;
    }

    // Enable confirm button
    const confirmBtn = this.element.querySelector("[data-action='confirm']");
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }
  }

  /* -------------------------------------------- */

  /**
   * Return the selected icon ID.
   * @returns {string|null}
   */
  submit() {
    return this._selectedIconId || null;
  }

  /* -------------------------------------------- */
  /*  Static Action Handlers                      */
  /* -------------------------------------------- */

  /**
   * Handle confirm button click.
   * @this {IconPicker}
   */
  static _onConfirm() {
    const selected = this.submit();
    if (selected) {
      this.options.resolve(selected);
      this.close();
    }
  }

  /**
   * Handle cancel button click.
   * @this {IconPicker}
   */
  static _onCancel() {
    this.options.resolve(null);
    this.close();
  }

  /**
   * Handle category filter button click.
   * @this {IconPicker}
   * @param {Event} _event
   * @param {HTMLElement} target
   */
  static _onFilterCategory(_event, target) {
    this._activeCategory = target.dataset.category || "all";
    this.render({ parts: ["content"] });
  }

  /**
   * Handle clear search button click.
   * @this {IconPicker}
   */
  static _onClearSearch() {
    this._searchQuery = "";
    const searchInput = this.element.querySelector("#icon-search-input");
    if (searchInput) {
      searchInput.value = "";
    }
    this.render({ parts: ["content"] });
  }
}
