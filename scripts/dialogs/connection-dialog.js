/**
 * ConnectionDialog — Simple DOM-based dialog for creating/editing connections.
 */

import { CONNECTION_TYPES, CONNECTION_ICONS, MODULE_ID } from "../constants.js";

function _esc(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/**
 * Open a modal dialog to create or edit a connection.
 * @param {Object|null} connData - Existing connection data, null for create
 * @param {Object} fromItem - Source item
 * @param {Object} toItem - Target item
 * @returns {Promise<Object|null|false>} Connection data, null if cancelled, false if deleted
 */
export function ConnectionDialog(connData, fromItem, toItem) {
  console.log(`[${MODULE_ID}] ConnectionDialog opening: ${fromItem?.name} → ${toItem?.name}, edit=${!!connData}`);

  return new Promise((resolve) => {
    const isEdit = connData !== null && connData !== undefined;
    const conn = isEdit
      ? foundry.utils.mergeObject({
          name: "", type: "unknown", icon: "fa-question-circle",
          iconSize: 24, iconColor: "#c9a227", tags: [],
          description: "", events: []
        }, connData)
      : { name: "", type: "unknown", icon: "fa-question-circle", iconSize: 24, iconColor: "#c9a227", tags: [], description: "", events: [] };

    // ====== Build HTML ======
    let typeOptions = "";
    for (const t of CONNECTION_TYPES) {
      const sel = t.id === conn.type ? "selected" : "";
      typeOptions += `<option value="${_esc(t.id)}" ${sel}>${_esc(t.label)}</option>`;
    }

    const lineColor = conn.lineColor || CONNECTION_TYPES.find(t => t.id === conn.type)?.color || "#c9a227";
    let lineStyleOpts = "";
    for (const s of [{id:"curved",l:"Curved"},{id:"straight",l:"Straight"},{id:"dotted",l:"Dotted"},{id:"dashed",l:"Dashed"},{id:"dashdot",l:"Dash-Dot"}]) {
      lineStyleOpts += `<option value="${_esc(s.id)}" ${s.id === (conn.lineStyle || "straight") ? "selected" : ""}>${_esc(s.l)}</option>`;
    }

    let iconGrid = "";
    for (const ic of CONNECTION_ICONS) {
      const selClass = ic.id === conn.icon ? "selected" : "";
      const selBorder = ic.id === conn.icon ? "#c9a227" : "#2a2a4a";
      iconGrid += `<div class="cc-icon-opt ${selClass}" data-icon="${_esc(ic.id)}" title="${_esc(ic.label)}" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border:1px solid ${selBorder};border-radius:4px;cursor:pointer;font-size:10px;color:#b0b0b0;"><i class="fas ${_esc(ic.icon)}" style="font-size:16px;color:#c9a227;"></i><span style="font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:44px;">${_esc(ic.label)}</span></div>`;
    }

    let eventsHtml = "";
    for (let i = 0; i < (conn.events || []).length; i++) {
      const ev = conn.events[i];
      eventsHtml += `<div class="cc-event-row" data-ev-idx="${i}" style="display:flex;flex-direction:column;gap:4px;padding:8px;background:rgba(15,52,96,0.3);border-radius:4px;border:1px solid #2a2a4a;">
        <div style="display:flex;gap:8px;"><input type="text" class="ev-name" value="${_esc(ev.name)}" placeholder="Event name" style="flex:1;background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:4px 8px;font-size:12px;"><input type="text" class="ev-date" value="${_esc(ev.date)}" placeholder="Date" style="width:100px;background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:4px 8px;font-size:12px;"></div>
        <textarea class="ev-desc" placeholder="Description" rows="2" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:4px 8px;font-size:12px;resize:vertical;">${_esc(ev.description)}</textarea>
        <button type="button" class="ev-del" style="align-self:flex-end;background:transparent;border:1px solid #f44336;color:#f44336;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;"><i class="fas fa-trash"></i></button>
      </div>`;
    }

    // ====== Create DOM ======
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;";

    const dialog = document.createElement("div");
    dialog.id = "cc-conn-dialog";
    dialog.style.cssText = "background:linear-gradient(180deg,#1a1a2e,#16213e);border:1px solid #2a2a4a;border-radius:8px;width:520px;max-width:90vw;max-height:90vh;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:var(--font-primary,'Signika',sans-serif);font-size:13px;color:#e8e8e8;display:flex;flex-direction:column;overflow:hidden;";

    dialog.innerHTML = `
      <div style="padding:12px 16px;background:linear-gradient(90deg,#0f3460,#1a1a2e);border-bottom:1px solid #2a2a4a;border-radius:8px 8px 0 0;font-weight:600;color:#c9a227;font-size:14px;flex-shrink:0;">
        ${isEdit ? "Edit Connection" : "New Connection"}
      </div>
      <div style="padding:16px;overflow-y:auto;flex:1;">

        <!-- Preview -->
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:8px;background:rgba(15,52,96,0.3);border-radius:6px;border:1px solid #2a2a4a;margin-bottom:12px;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="width:40px;height:40px;border-radius:50%;background:#1a1a2e;border:2px solid #4a9eff;display:flex;align-items:center;justify-content:center;font-size:16px;"><i class="fas fa-user"></i></div><span style="font-size:10px;color:#b0b0b0;max-width:80px;overflow:hidden;text-overflow:ellipsis;">${_esc(fromItem?.name || "?")}</span></div>
          <i class="fas fa-arrow-right" style="color:#c9a227;font-size:18px;"></i>
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="width:40px;height:40px;border-radius:50%;background:#1a1a2e;border:2px solid #4caf50;display:flex;align-items:center;justify-content:center;font-size:16px;"><i class="fas fa-user"></i></div><span style="font-size:10px;color:#b0b0b0;max-width:80px;overflow:hidden;text-overflow:ellipsis;">${_esc(toItem?.name || "?")}</span></div>
        </div>

        <form id="cc-conn-form" style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="color:#b0b0b0;font-size:11px;">Name</label><input type="text" name="connName" value="${_esc(conn.name)}" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;"></div>

          <!-- Settings toggle button -->
          <button type="button" id="connSettingsToggle" style="display:flex;align-items:center;gap:8px;background:rgba(15,52,96,0.2);border:1px solid #2a2a4a;color:#b0b0b0;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:12px;font-family:inherit;width:fit-content;">
            <i class="fas fa-cog" style="color:#c9a227;"></i> Settings
          </button>

          <!-- Collapsible settings panel: Type, Line Appearance, Icon, Size, Color -->
          <div id="connSettingsPanel" style="display:none;flex-direction:column;gap:14px;padding:12px;background:rgba(15,52,96,0.1);border-radius:6px;border:1px solid #2a2a4a;">

            <div style="display:flex;flex-direction:column;gap:4px;"><label style="color:#b0b0b0;font-size:11px;">Type</label><select name="connType" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;">${typeOptions}</select></div>

            <!-- Line Appearance -->
            <div style="display:flex;flex-direction:column;gap:8px;padding:10px;background:rgba(15,52,96,0.15);border-radius:6px;border:1px solid #2a2a4a;">
              <label style="color:#c9a227;font-size:11px;font-weight:600;">Line Appearance</label>
              <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <label style="color:#b0b0b0;font-size:11px;">Color:</label>
                  <input type="color" name="connLineColor" value="${_esc(lineColor)}" style="width:32px;height:24px;border:none;background:transparent;cursor:pointer;">
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <label style="color:#b0b0b0;font-size:11px;">Style:</label>
                  <select name="connLineStyle" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:4px 8px;font-family:inherit;font-size:12px;">${lineStyleOpts}</select>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <label style="color:#b0b0b0;font-size:11px;">Width:</label>
                  <input type="range" name="connLineWidth" min="1" max="12" value="${conn.lineWidth || 2}" style="width:60px;">
                  <span id="lineWidthVal" style="color:#c9a227;font-size:11px;min-width:12px;">${conn.lineWidth || 2}</span>
                </div>
              </div>

              <!-- Arrow heads -->
              <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:4px;border-top:1px solid rgba(42,42,74,0.5);padding-top:8px;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <label style="color:#b0b0b0;font-size:11px;">Arrow:</label>
                  <select name="connArrowStyle" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:4px 8px;font-family:inherit;font-size:12px;">
                    <option value="none" ${(conn.arrowStyle || "none") === "none" ? "selected" : ""}>None</option>
                    <option value="arrow" ${(conn.arrowStyle || "none") === "arrow" ? "selected" : ""}>Arrow</option>
                    <option value="filled" ${(conn.arrowStyle || "none") === "filled" ? "selected" : ""}>Filled</option>
                    <option value="diamond" ${(conn.arrowStyle || "none") === "diamond" ? "selected" : ""}>Diamond</option>
                    <option value="circle" ${(conn.arrowStyle || "none") === "circle" ? "selected" : ""}>Circle</option>
                  </select>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <label style="color:#b0b0b0;font-size:11px;">Direction:</label>
                  <select name="connArrowDir" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:4px 8px;font-family:inherit;font-size:12px;">
                    <option value="none" ${(conn.arrowDirection || "end") === "none" ? "selected" : ""}>None</option>
                    <option value="start" ${(conn.arrowDirection || "end") === "start" ? "selected" : ""}>Start</option>
                    <option value="end" ${(conn.arrowDirection || "end") === "end" ? "selected" : ""}>End</option>
                    <option value="both" ${(conn.arrowDirection || "end") === "both" ? "selected" : ""}>Both</option>
                  </select>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <label style="color:#b0b0b0;font-size:11px;">Size:</label>
                  <input type="range" name="connArrowSize" min="4" max="24" value="${conn.arrowSize || 10}" style="width:80px;">
                  <span id="arrowSizeVal" style="color:#c9a227;font-size:11px;min-width:20px;">${conn.arrowSize || 10}</span>
                </div>
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:6px;">
              <label style="color:#b0b0b0;font-size:11px;">Icon</label>
              <input type="hidden" name="connIcon" id="connIconInput" value="${_esc(conn.icon)}">
              <div id="connIconGrid" style="display:grid;grid-template-columns:repeat(10,1fr);gap:4px;max-height:120px;overflow-y:auto;padding:4px;background:rgba(15,52,96,0.2);border-radius:4px;border:1px solid #2a2a4a;">${iconGrid}</div>
              <div style="display:flex;gap:12px;align-items:center;">
                <div style="display:flex;align-items:center;gap:6px;"><label style="color:#b0b0b0;font-size:11px;">Size:</label><input type="range" name="connIconSize" min="16" max="64" value="${conn.iconSize}" style="width:80px;"><span id="iconSizeVal" style="color:#c9a227;font-size:11px;min-width:20px;">${conn.iconSize}</span></div>
                <div style="display:flex;align-items:center;gap:6px;"><label style="color:#b0b0b0;font-size:11px;">Color:</label><input type="color" name="connIconColor" value="${_esc(conn.iconColor)}" style="width:32px;height:24px;border:none;background:transparent;cursor:pointer;"></div>
              </div>
            </div>

          </div><!-- end connSettingsPanel -->

          <div style="display:flex;flex-direction:column;gap:4px;"><label style="color:#b0b0b0;font-size:11px;">Description</label><textarea name="connDesc" rows="3" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;resize:vertical;">${_esc(conn.description)}</textarea></div>

          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;"><label style="color:#b0b0b0;font-size:11px;">Events</label><button type="button" id="addEventBtn" style="background:#2a2a4a;border:1px solid #3a3a5a;color:#c9a227;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;"><i class="fas fa-plus"></i> Add</button></div>
            <div id="connEventsBox" style="display:flex;flex-direction:column;gap:8px;">${eventsHtml}</div>
          </div>
        </form>
      </div>
      <div style="padding:12px 16px;border-top:1px solid #2a2a4a;display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;">
        ${isEdit ? `<button type="button" id="connDelBtn" style="background:transparent;border:1px solid #f44336;color:#f44336;border-radius:4px;padding:6px 14px;cursor:pointer;font-size:13px;margin-right:auto;"><i class="fas fa-trash"></i></button>` : ""}
        <button type="button" id="connCancelBtn" style="background:transparent;border:1px solid #2a2a4a;color:#b0b0b0;border-radius:4px;padding:6px 14px;cursor:pointer;font-size:13px;">Cancel</button>
        <button type="submit" form="cc-conn-form" id="connSaveBtn" style="background:linear-gradient(135deg,#c9a227,#b08d1f);border:none;color:#1a1a2e;border-radius:4px;padding:6px 14px;cursor:pointer;font-weight:600;font-size:13px;">Save</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    console.log(`[${MODULE_ID}] ConnectionDialog DOM created and appended`);

    // ====== State ======
    let currentEvents = (conn.events || []).map(e => ({...e}));
    let selectedIcon = conn.icon;

    // ====== Helpers ======
    const refreshEvents = () => {
      const box = dialog.querySelector("#connEventsBox");
      if (!box) return;
      box.innerHTML = currentEvents.map((ev, i) => `<div class="cc-event-row" data-ev-idx="${i}" style="display:flex;flex-direction:column;gap:4px;padding:8px;background:rgba(15,52,96,0.3);border-radius:4px;border:1px solid #2a2a4a;"><div style="display:flex;gap:8px;"><input type="text" class="ev-name" value="${_esc(ev.name)}" placeholder="Event name" style="flex:1;background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:4px 8px;font-size:12px;"><input type="text" class="ev-date" value="${_esc(ev.date)}" placeholder="Date" style="width:100px;background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:4px 8px;font-size:12px;"></div><textarea class="ev-desc" placeholder="Description" rows="2" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:4px 8px;font-size:12px;resize:vertical;">${_esc(ev.description)}</textarea><button type="button" class="ev-del" style="align-self:flex-end;background:transparent;border:1px solid #f44336;color:#f44336;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;"><i class="fas fa-trash"></i></button></div>`).join("");
      box.querySelectorAll(".ev-del").forEach(btn => {
        btn.addEventListener("click", () => {
          const row = btn.closest(".cc-event-row");
          const idx = parseInt(row?.dataset.evIdx);
          if (!isNaN(idx)) { currentEvents.splice(idx, 1); refreshEvents(); }
        });
      });
    };

    // ====== Wire Events ======

    // Icon selection
    dialog.querySelectorAll("#connIconGrid .cc-icon-opt").forEach(el => {
      el.addEventListener("click", () => {
        dialog.querySelectorAll("#connIconGrid .cc-icon-opt").forEach(o => { o.style.borderColor = "#2a2a4a"; o.classList.remove("selected"); });
        el.style.borderColor = "#c9a227"; el.classList.add("selected");
        selectedIcon = el.dataset.icon;
        document.getElementById("connIconInput").value = selectedIcon;
      });
    });

    // Icon size slider — updates text display and live-resizes the icon grid
    dialog.querySelector("input[name='connIconSize']")?.addEventListener("input", (e) => {
      const size = parseInt(e.target.value) || 24;
      const val = dialog.querySelector("#iconSizeVal");
      if (val) val.textContent = size;
      // Live-resize icons in the grid for visual feedback
      const grid = dialog.querySelector("#connIconGrid");
      if (grid) {
        grid.querySelectorAll(".cc-icon-opt i").forEach(icon => {
          icon.style.fontSize = `${Math.max(10, Math.min(32, Math.round(size * 0.6)))}px`;
        });
      }
    });

    // Line width slider
    dialog.querySelector("input[name='connLineWidth']")?.addEventListener("input", (e) => {
      const val = dialog.querySelector("#lineWidthVal"); if (val) val.textContent = e.target.value;
    });

    // Arrow size slider
    dialog.querySelector("input[name='connArrowSize']")?.addEventListener("input", (e) => {
      const val = dialog.querySelector("#arrowSizeVal"); if (val) val.textContent = e.target.value;
    });

    // Settings toggle
    dialog.querySelector("#connSettingsToggle")?.addEventListener("click", () => {
      const panel = dialog.querySelector("#connSettingsPanel");
      const btn = dialog.querySelector("#connSettingsToggle");
      if (!panel) return;
      const isHidden = panel.style.display === "none";
      panel.style.display = isHidden ? "flex" : "none";
      if (btn) btn.style.color = isHidden ? "#e8e8e8" : "#b0b0b0";
    });

    // Events
    dialog.querySelector("#addEventBtn")?.addEventListener("click", () => {
      currentEvents.push({ id: foundry.utils.randomID(), name: "", date: "", description: "" });
      refreshEvents();
    });
    refreshEvents();

    // Delete
    dialog.querySelector("#connDelBtn")?.addEventListener("click", () => {
      console.log(`[${MODULE_ID}] ConnectionDialog: Delete clicked`);
      overlay.remove(); resolve(false);
    });

    // Cancel
    dialog.querySelector("#connCancelBtn")?.addEventListener("click", () => {
      console.log(`[${MODULE_ID}] ConnectionDialog: Cancel clicked`);
      overlay.remove(); resolve(null);
    });

    // Overlay click
    overlay.addEventListener("click", (e) => { if (e.target === overlay) { console.log(`[${MODULE_ID}] ConnectionDialog: Overlay click (cancel)`); overlay.remove(); resolve(null); } });

    // ====== SAVE via form submit ======
    const form = dialog.querySelector("#cc-conn-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      console.log(`[${MODULE_ID}] ConnectionDialog: SAVE submit handler fired`);

      try {
        const getVal = (name) => {
          const el = form.querySelector(`[name="${name}"]`);
          return el ? el.value : "";
        };

        // Gather events from currentEvents state (preserves original IDs and order)
        // Merge DOM values back into currentEvents so edited text is captured
        const eventRows = dialog.querySelectorAll(".cc-event-row");
        eventRows.forEach((row, idx) => {
          if (currentEvents[idx]) {
            currentEvents[idx].name = row.querySelector(".ev-name")?.value || "";
            currentEvents[idx].date = row.querySelector(".ev-date")?.value || "";
            currentEvents[idx].description = row.querySelector(".ev-desc")?.value || "";
          }
        });
        // Filter out empty events and ensure each has an ID
        const events = currentEvents
          .filter(ev => (ev.name || ev.description))
          .map(ev => ({
            id: ev.id || foundry.utils.randomID(),
            name: ev.name || "",
            date: ev.date || "",
            description: ev.description || ""
          }));

        const result = {
          name: (getVal("connName") || "").trim(),
          type: getVal("connType") || "unknown",
          icon: selectedIcon,
          iconSize: parseInt(getVal("connIconSize")) || 24,
          iconColor: getVal("connIconColor") || "#c9a227",
          lineColor: getVal("connLineColor") || "",
          lineStyle: getVal("connLineStyle") || "straight",
          lineWidth: parseInt(getVal("connLineWidth")) || 2,
          arrowStyle: getVal("connArrowStyle") || "none",
          arrowDirection: getVal("connArrowDir") || "end",
          arrowSize: parseInt(getVal("connArrowSize")) || 10,
          description: (getVal("connDesc") || "").trim(),
          events
        };

        console.log(`[${MODULE_ID}] ConnectionDialog: resolving with data:`, result);
        overlay.remove();
        resolve(result);
      } catch (err) {
        console.error(`[${MODULE_ID}] ConnectionDialog save error:`, err);
        ui.notifications.error("Save failed: " + err.message);
      }
    });

    // Focus name input
    setTimeout(() => { const el = form.querySelector("[name='connName']"); if (el) el.focus(); }, 50);

    console.log(`[${MODULE_ID}] ConnectionDialog: all event listeners attached`);
  });
}
