/**
 * @fileoverview ConnectionTooltip - Custom HTML tooltip for Connection hover/click.
 * Supports pinned mode (click to pin, click elsewhere or X to close).
 * Right-click emits an edit event.
 */

import { CONNECTION_TYPES, MODULE_ID } from "../constants.js";

/**
 * Event fired when the connection tooltip requests edit mode.
 * @event ConnectionTooltip#editConnection
 * @type {Object}
 * @property {string} connectionId
 */

/**
 * Tooltip displayed on connection icon hover or click.
 * Click pins the tooltip; right-click opens edit dialog.
 * Uses custom HTML element positioned absolutely (not a Foundry Application).
 */
export class ConnectionTooltip {
  /**
   * @param {Object} connectionData - Connection data object.
   * @param {Object} fromItem - Source BoardItem data.
   * @param {Object} toItem - Target BoardItem data.
   */
  constructor(connectionData, fromItem, toItem) {
    this.connectionData = connectionData;
    this.fromItem = fromItem;
    this.toItem = toItem;
    this.element = null;
    this.anchorElement = null;
    this._pinned = false;
    this._visible = false;
    this._fadeTimeout = null;
    this._mouseLeaveHandler = null;
    this._clickOutsideHandler = null;
    this._expandedEvents = false;
  }

  /* -------------------------------------------- */

  /**
   * Show the tooltip near the anchor element with a fade-in effect.
   * @param {HTMLElement} anchorElement - The connection icon element.
   */
  async show(anchorElement) {
    if (this._visible) return;

    this.anchorElement = anchorElement;

    const templatePath = "modules/cypher-connections/templates/tooltips/connection-tooltip.hbs";
    const typeData = CONNECTION_TYPES.find(t => t.id === this.connectionData.type)
      || CONNECTION_TYPES[CONNECTION_TYPES.length - 1];

    const context = {
      connection: this.connectionData,
      typeData: {
        label: typeData.label,
        color: typeData.color
      },
      fromItem: this.fromItem,
      toItem: this.toItem,
      pinned: this._pinned
    };

    const html = await renderTemplate(templatePath, context);

    this.element = document.createElement("div");
    this.element.innerHTML = html;
    this.element = this.element.firstElementChild;
    this.element.style.position = "absolute";
    this.element.style.zIndex = "var(--z-index-tooltip, 1000)";
    this.element.style.opacity = "0";
    this.element.style.transition = "opacity 200ms ease-out, transform 200ms ease-out";
    this.element.style.transform = "translateY(4px)";
    this.element.style.pointerEvents = this._pinned ? "auto" : "none";

    document.body.appendChild(this.element);

    this._position();
    this._setupEventListeners();

    requestAnimationFrame(() => {
      if (this.element) {
        this.element.style.opacity = "1";
        this.element.style.transform = "translateY(0)";
      }
    });

    this._visible = true;

    // Hover mode: hide on mouse leave of anchor
    if (!this._pinned) {
      this._mouseLeaveHandler = () => this.hide();
      anchorElement.addEventListener("mouseleave", this._mouseLeaveHandler);
    }
  }

  /* -------------------------------------------- */

  /**
   * Pin the tooltip so it stays open. Adds close button and enables pointer events.
   */
  pin() {
    if (this._pinned) return;

    this._pinned = true;

    // Remove hover auto-hide
    if (this.anchorElement && this._mouseLeaveHandler) {
      this.anchorElement.removeEventListener("mouseleave", this._mouseLeaveHandler);
      this._mouseLeaveHandler = null;
    }

    if (this.element) {
      this.element.style.pointerEvents = "auto";
      this.element.classList.add("pinned");

      // Update footer to show close button
      const footer = this.element.querySelector(".tooltip-footer");
      if (footer) {
        footer.classList.add("pinned");
      }
    }

    // Listen for clicks outside to close
    this._clickOutsideHandler = (evt) => {
      if (this.element && !this.element.contains(evt.target) &&
          this.anchorElement && !this.anchorElement.contains(evt.target)) {
        this.hide();
      }
    };
    // Delay to avoid immediate close from the click that triggered pin
    setTimeout(() => {
      document.addEventListener("click", this._clickOutsideHandler);
    }, 50);
  }

  /**
   * Unpin the tooltip, returning to hover mode.
   */
  unpin() {
    if (!this._pinned) return;

    this._pinned = false;

    if (this._clickOutsideHandler) {
      document.removeEventListener("click", this._clickOutsideHandler);
      this._clickOutsideHandler = null;
    }

    if (this.element) {
      this.element.style.pointerEvents = "none";
      this.element.classList.remove("pinned");

      const footer = this.element.querySelector(".tooltip-footer");
      if (footer) {
        footer.classList.remove("pinned");
      }
    }

    this.hide();
  }

  /* -------------------------------------------- */

  /**
   * Hide the tooltip with a fade-out effect, then destroy.
   */
  hide() {
    if (!this._visible || !this.element) return;

    this._visible = false;

    // Remove all listeners
    this._removeEventListeners();

    // Fade out
    this.element.style.opacity = "0";
    this.element.style.transform = "translateY(4px)";

    this._fadeTimeout = setTimeout(() => {
      this.destroy();
    }, 200);
  }

  /**
   * Immediately remove the tooltip from the DOM.
   */
  destroy() {
    if (this._fadeTimeout) {
      clearTimeout(this._fadeTimeout);
      this._fadeTimeout = null;
    }

    this._removeEventListeners();

    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.element = null;
    this.anchorElement = null;
    this._visible = false;
    this._pinned = false;
  }

  /* -------------------------------------------- */
  /*  Event Handling                              */
  /* -------------------------------------------- */

  /**
   * Set up event listeners on the tooltip element.
   * @private
   */
  _setupEventListeners() {
    if (!this.element) return;

    // Close button (when pinned)
    this.element.addEventListener("click", (evt) => {
      const closeBtn = evt.target.closest("[data-action='closeTooltip']");
      if (closeBtn) {
        evt.stopPropagation();
        this.hide();
        return;
      }

      // Events expand/collapse toggle
      const eventsToggle = evt.target.closest(".events-header-toggle");
      if (eventsToggle) {
        this._toggleEvents();
      }
    });
  }

  /**
   * Remove all event listeners.
   * @private
   */
  _removeEventListeners() {
    if (this.anchorElement && this._mouseLeaveHandler) {
      this.anchorElement.removeEventListener("mouseleave", this._mouseLeaveHandler);
      this._mouseLeaveHandler = null;
    }

    if (this._clickOutsideHandler) {
      document.removeEventListener("click", this._clickOutsideHandler);
      this._clickOutsideHandler = null;
    }
  }

  /**
   * Toggle the events list expand/collapse state.
   * @private
   */
  _toggleEvents() {
    this._expandedEvents = !this._expandedEvents;
    if (!this.element) return;

    const eventsList = this.element.querySelector(".events-list");
    const expandIcon = this.element.querySelector(".expand-icon");

    if (eventsList) {
      eventsList.classList.toggle("collapsed", !this._expandedEvents);
    }
    if (expandIcon) {
      expandIcon.style.transform = this._expandedEvents ? "rotate(180deg)" : "rotate(0deg)";
    }
  }

  /* -------------------------------------------- */
  /*  Positioning                                 */
  /* -------------------------------------------- */

  /**
   * Position the tooltip near the connection icon.
   * Prefers below, falls back to above/right/left as needed.
   * @private
   */
  _position() {
    if (!this.element || !this.anchorElement) return;

    const anchorRect = this.anchorElement.getBoundingClientRect();
    const tooltipRect = this.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;

    // Default: below the anchor
    let left = anchorRect.left + (anchorRect.width / 2) - (tooltipRect.width / 2);
    let top = anchorRect.bottom + margin;

    // Clamp horizontal
    left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));

    // If below overflows, place above
    if (top + tooltipRect.height > viewportHeight - margin) {
      top = anchorRect.top - tooltipRect.height - margin;
    }

    // If above overflows too, place to the right
    if (top < margin) {
      top = anchorRect.top;
      left = anchorRect.right + margin;

      // If right overflows, place to the left
      if (left + tooltipRect.width > viewportWidth - margin) {
        left = anchorRect.left - tooltipRect.width - margin;
      }
    }

    this.element.style.left = `${left + window.scrollX}px`;
    this.element.style.top = `${top + window.scrollY}px`;
  }

  /* -------------------------------------------- */
  /*  Static Factories                            */
  /* -------------------------------------------- */

  /**
   * Handle a click on the connection icon.
   * If tooltip is not visible, show and pin. If pinned, hide.
   * @param {ConnectionTooltip|null} currentTooltip - Currently active tooltip instance.
   * @param {Object} connectionData - Connection data.
   * @param {Object} fromItem - Source item data.
   * @param {Object} toItem - Target item data.
   * @param {HTMLElement} anchorElement - The clicked icon element.
   * @returns {ConnectionTooltip} The tooltip instance.
   */
  static async handleClick(currentTooltip, connectionData, fromItem, toItem, anchorElement) {
    // If clicking the same pinned tooltip, hide it
    if (currentTooltip && currentTooltip._pinned &&
        currentTooltip.connectionData.id === connectionData.id) {
      currentTooltip.hide();
      return null;
    }

    // Hide any existing tooltip
    if (currentTooltip) {
      currentTooltip.destroy();
    }

    // Create and show new tooltip, then pin it
    const tooltip = new ConnectionTooltip(connectionData, fromItem, toItem);
    await tooltip.show(anchorElement);
    tooltip.pin();
    return tooltip;
  }

  /**
   * Handle a right-click on the connection icon.
   * Emits an edit event via a custom event on the canvas container.
   * @param {string} connectionId - The connection ID to edit.
   * @param {HTMLElement} canvasContainer - Container to dispatch event on.
   */
  static handleRightClick(connectionId, canvasContainer) {
    if (canvasContainer) {
      const editEvent = new CustomEvent("editConnection", {
        detail: { connectionId },
        bubbles: true
      });
      canvasContainer.dispatchEvent(editEvent);
    }
  }
}
