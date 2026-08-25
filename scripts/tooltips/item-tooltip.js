/**
 * @fileoverview ItemTooltip - Custom HTML tooltip for BoardItem hover.
 * Positions absolutely near the anchor element with fade in/out animations.
 */

import { ITEM_TYPES, MODULE_ID } from "../constants.js";

/**
 * Tooltip displayed on item hover. Auto-hides on mouse leave unless pinned.
 * Uses custom HTML element positioned absolutely (not a Foundry Application).
 */
export class ItemTooltip {
  /**
   * @param {Object} itemData - BoardItem data object.
   */
  constructor(itemData) {
    this.itemData = itemData;
    this.element = null;
    this.anchorElement = null;
    this._mouseLeaveHandler = null;
    this._fadeTimeout = null;
    this._visible = false;
  }

  /* -------------------------------------------- */

  /**
   * Show the tooltip near the anchor element with a fade-in effect.
   * @param {HTMLElement} anchorElement - The element to position near.
   */
  async show(anchorElement) {
    if (this._visible) return;

    this.anchorElement = anchorElement;

    // Build tooltip HTML
    const templatePath = "modules/cypher-connections/templates/tooltips/item-tooltip.hbs";
    const typeData = ITEM_TYPES[this.itemData.type] || ITEM_TYPES.placeholder;

    const context = {
      item: this.itemData,
      typeData: {
        label: typeData.label,
        color: typeData.color,
        defaultIcon: typeData.defaultIcon
      }
    };

    const html = await renderTemplate(templatePath, context);

    // Create and position tooltip element
    this.element = document.createElement("div");
    this.element.innerHTML = html;
    this.element = this.element.firstElementChild;
    this.element.style.position = "absolute";
    this.element.style.zIndex = "var(--z-index-tooltip, 1000)";
    this.element.style.opacity = "0";
    this.element.style.transition = "opacity 200ms ease-out, transform 200ms ease-out";
    this.element.style.transform = "translateY(4px)";
    this.element.style.pointerEvents = "none"; // Let mouse events pass through

    // Append to document body (outside any overflow-hidden containers)
    document.body.appendChild(this.element);

    // Position after append so dimensions are known
    this._position();

    // Fade in
    requestAnimationFrame(() => {
      if (this.element) {
        this.element.style.opacity = "1";
        this.element.style.transform = "translateY(0)";
      }
    });

    this._visible = true;

    // Auto-hide on mouse leave of anchor
    this._mouseLeaveHandler = () => this.hide();
    anchorElement.addEventListener("mouseleave", this._mouseLeaveHandler);
  }

  /* -------------------------------------------- */

  /**
   * Hide the tooltip with a fade-out effect, then destroy.
   */
  hide() {
    if (!this._visible || !this.element) return;

    this._visible = false;

    // Remove mouse leave listener
    if (this.anchorElement && this._mouseLeaveHandler) {
      this.anchorElement.removeEventListener("mouseleave", this._mouseLeaveHandler);
      this._mouseLeaveHandler = null;
    }

    // Fade out
    this.element.style.opacity = "0";
    this.element.style.transform = "translateY(4px)";

    // Remove from DOM after transition
    this._fadeTimeout = setTimeout(() => {
      this.destroy();
    }, 200);
  }

  /* -------------------------------------------- */

  /**
   * Immediately remove the tooltip from the DOM without animation.
   */
  destroy() {
    if (this._fadeTimeout) {
      clearTimeout(this._fadeTimeout);
      this._fadeTimeout = null;
    }

    if (this.anchorElement && this._mouseLeaveHandler) {
      this.anchorElement.removeEventListener("mouseleave", this._mouseLeaveHandler);
      this._mouseLeaveHandler = null;
    }

    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.element = null;
    this.anchorElement = null;
    this._visible = false;
  }

  /* -------------------------------------------- */
  /*  Positioning                                 */
  /* -------------------------------------------- */

  /**
   * Position the tooltip near the anchor element.
   * Prefers right side, falls back to left/below as needed.
   * @private
   */
  _position() {
    if (!this.element || !this.anchorElement) return;

    const anchorRect = this.anchorElement.getBoundingClientRect();
    const tooltipRect = this.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;

    let left = anchorRect.right + margin;
    let top = anchorRect.top;

    // If tooltip would overflow right edge, place to the left
    if (left + tooltipRect.width > viewportWidth - margin) {
      left = anchorRect.left - tooltipRect.width - margin;
    }

    // If still overflowing left, place below
    if (left < margin) {
      left = anchorRect.left;
      top = anchorRect.bottom + margin;
    }

    // If tooltip would overflow bottom, place above
    if (top + tooltipRect.height > viewportHeight - margin) {
      top = anchorRect.top - tooltipRect.height - margin;
    }

    // Ensure minimum top margin
    top = Math.max(margin, top);

    this.element.style.left = `${left + window.scrollX}px`;
    this.element.style.top = `${top + window.scrollY}px`;
  }
}
