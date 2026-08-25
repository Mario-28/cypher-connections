/**
 * Socket handler for real-time synchronization between connected clients.
 * Uses Foundry's built-in socket system to broadcast board changes.
 *
 * @module socket-handler
 */

import { MODULE_ID, SOCKET_EVENTS } from "./constants.js";
import { SETTINGS } from "./settings.js";

/**
 * Central socket communication hub for the module.
 * All cross-client updates flow through this handler.
 */
export class SocketHandler {
  /** @type {Map<string, Set<Function>>} */
  static _listeners = new Map();

  /**
   * Initialise the socket listener on the Foundry socket channel.
   * Call once during the `ready` hook.
   */
  static init() {
    game.socket.on(`module.${MODULE_ID}`, (payload) => {
      if (!payload || !payload.eventType) return;

      // Only process packets from other users (ignore our own broadcasts)
      if (payload.userId === game.userId) return;

      // Notify local subscribers
      SocketHandler._notify(payload.eventType, payload.data);
    });
  }

  /**
   * Broadcast an event to every connected client.
   * Automatically suppressed when real-time sync is disabled.
   *
   * @param {string} eventType - One of the SOCKET_EVENTS values
   * @param {Object} [payload={}] - Serializable payload data
   */
  static emit(eventType, payload = {}) {
    try {
      const syncEnabled = game.settings.get(MODULE_ID, SETTINGS.enableSync);
      if (!syncEnabled) return;
    } catch {
      // Settings may not be ready yet; allow the emit
    }

    const packet = {
      eventType,
      userId: game.userId,
      data: payload
    };

    game.socket.emit(`module.${MODULE_ID}`, packet);
  }

  /**
   * Subscribe to a specific socket event.
   *
   * @param {string} eventType - Event name to listen for
   * @param {Function} callback - Handler invoked with (data) when the event fires
   * @returns {Function} Unsubscribe function
   */
  static on(eventType, callback) {
    if (!SocketHandler._listeners.has(eventType)) {
      SocketHandler._listeners.set(eventType, new Set());
    }
    SocketHandler._listeners.get(eventType).add(callback);

    // Return unsubscribe function
    return () => SocketHandler._listeners.get(eventType)?.delete(callback);
  }

  /**
   * Remove all listeners (useful on module teardown / reload).
   */
  static clearListeners() {
    SocketHandler._listeners.clear();
  }

  /**
   * Notify local subscribers of an incoming event.
   * @param {string} eventType
   * @param {Object} data
   * @private
   */
  static _notify(eventType, data) {
    const callbacks = SocketHandler._listeners.get(eventType);
    if (!callbacks) return;
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch (err) {
        console.error(`[${MODULE_ID}] Socket listener error for ${eventType}:`, err);
      }
    }
  }
}
