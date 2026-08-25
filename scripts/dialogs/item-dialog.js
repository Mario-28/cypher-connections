/**
 * ItemDialog — DOM-based modal for creating/editing board items.
 * Supports: name, type, image, colors, shape, transparency, image fit/position.
 */

import { ITEM_TYPES, MODULE_ID } from "../constants.js";

function _esc(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

const SHAPES = [
  { id: "rect",     label: "Rectangle", icon: "fa-square" },
  { id: "circle",   label: "Circle",    icon: "fa-circle" },
  { id: "square",   label: "Square",    icon: "fa-square-full" },
  { id: "triangle", label: "Triangle",  icon: "fa-play fa-rotate-270" },
  { id: "diamond",  label: "Diamond",   icon: "fa-gem" },
  { id: "hexagon",  label: "Hexagon",   icon: "fa-hexagon" },
];

const IMG_FITS = [
  { id: "default", label: "Default" },
  { id: "cover",   label: "Cover" },
  { id: "contain", label: "Contain" },
];

const IMG_POSITIONS = [
  { id: "top-left",     label: "Top Left" },
  { id: "top",          label: "Top Center" },
  { id: "top-right",    label: "Top Right" },
  { id: "left",         label: "Middle Left" },
  { id: "center",       label: "Center" },
  { id: "right",        label: "Middle Right" },
  { id: "bottom-left",  label: "Bottom Left" },
  { id: "bottom",       label: "Bottom Center" },
  { id: "bottom-right", label: "Bottom Right" },
];

const POS_DOT_STYLES = {
  "top-left":     "top:4px;left:4px;",
  "top":          "top:4px;left:50%;transform:translateX(-50%);",
  "top-right":    "top:4px;right:4px;",
  "left":         "top:50%;left:4px;transform:translateY(-50%);",
  "center":       "top:50%;left:50%;transform:translate(-50%,-50%);",
  "right":        "top:50%;right:4px;transform:translateY(-50%);",
  "bottom-left":  "bottom:4px;left:4px;",
  "bottom":       "bottom:4px;left:50%;transform:translateX(-50%);",
  "bottom-right": "bottom:4px;right:4px;",
};

/**
 * @param {Object|null} itemData
 * @returns {Promise<Object|null>}
 */
export function ItemDialog(itemData = null) {
  return new Promise((resolve) => {
    const isEdit = itemData !== null;
    const item = isEdit
      ? foundry.utils.mergeObject({
          name: "", type: "placeholder", img: "", description: "",
          borderColor: "", bgColor: "", shape: "rect",
          imgTransparency: 1, imgFit: "default", imgPosition: "center"
        }, itemData)
      : { name: "", type: "placeholder", img: "", description: "",
          borderColor: "", bgColor: "", shape: "rect",
          imgTransparency: 1, imgFit: "default", imgPosition: "center" };

    // Type options
    let typeOpts = "";
    for (const [id, data] of Object.entries(ITEM_TYPES)) {
      const sel = id === item.type ? "selected" : "";
      typeOpts += `<option value="${_esc(id)}" ${sel}>${_esc(data.label)}</option>`;
    }

    // Shape options (as clickable grid)
    let shapeGrid = "";
    for (const s of SHAPES) {
      const sel = s.id === item.shape ? "selected" : "";
      const border = s.id === item.shape ? "#c9a227" : "#2a2a4a";
      const bg = s.id === item.shape ? "rgba(201,162,39,0.15)" : "transparent";
      shapeGrid += `<div class="cc-shape-opt ${sel}" data-shape="${_esc(s.id)}" style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px;border:1px solid ${border};border-radius:6px;cursor:pointer;background:${bg};font-size:10px;color:#b0b0b0;transition:all 0.15s;"><i class="fas ${_esc(s.icon)}" style="font-size:18px;color:#c9a227;"></i><span>${_esc(s.label)}</span></div>`;
    }

    // Image fit options
    let fitOpts = "";
    for (const f of IMG_FITS) {
      const sel = f.id === item.imgFit ? "selected" : "";
      fitOpts += `<option value="${_esc(f.id)}" ${sel}>${_esc(f.label)}</option>`;
    }

    // Image position grid (3x3)
    let posGrid = "";
    for (const p of IMG_POSITIONS) {
      const sel = p.id === item.imgPosition ? "selected" : "";
      const border = p.id === item.imgPosition ? "#c9a227" : "#2a2a4a";
      const dotStyle = POS_DOT_STYLES[p.id];
      posGrid += `<div class="cc-pos-opt ${sel}" data-pos="${_esc(p.id)}" style="position:relative;width:26px;height:26px;background:#0f3460;border:1px solid ${border};border-radius:3px;cursor:pointer;transition:all 0.15s;"><div style="position:absolute;${dotStyle}width:4px;height:4px;border-radius:50%;background:#c9a227;"></div></div>`;
    }

    const borderVal = _esc(item.borderColor || (ITEM_TYPES[item.type]?.color || "#607d8b"));
    const bgVal = _esc(item.bgColor || "#1a1a2e");

    // Build dialog
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background:linear-gradient(180deg,#1a1a2e,#16213e);border:1px solid #2a2a4a;border-radius:8px;width:480px;max-width:95vw;max-height:90vh;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:var(--font-primary,'Signika',sans-serif);font-size:13px;color:#e8e8e8;display:flex;flex-direction:column;overflow:hidden;";

    dialog.innerHTML = `
      <div style="padding:12px 16px;background:linear-gradient(90deg,#0f3460,#1a1a2e);border-bottom:1px solid #2a2a4a;border-radius:8px 8px 0 0;font-weight:600;color:#c9a227;font-size:14px;flex-shrink:0;">
        ${isEdit ? "Edit Item" : "Create Item"}
      </div>
      <div style="padding:16px;overflow-y:auto;flex:1;">
        <form id="cc-item-form" style="display:flex;flex-direction:column;gap:14px;">

          <!-- Name -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="color:#b0b0b0;font-size:11px;">Name *</label>
            <input type="text" name="itemName" value="${_esc(item.name)}" required style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;">
          </div>

          <!-- Type -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="color:#b0b0b0;font-size:11px;">Type</label>
            <select name="itemType" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;">${typeOpts}</select>
          </div>

          <!-- Image source tabs -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="color:#b0b0b0;font-size:11px;">Image</label>
            <div style="display:flex;gap:4px;margin-bottom:4px;">
              <button type="button" id="tabImgUrl" class="cc-img-tab active" style="flex:1;background:#0f3460;border:1px solid #c9a227;color:#c9a227;border-radius:4px 4px 0 0;padding:4px 8px;cursor:pointer;font-size:11px;">URL</button>
              <button type="button" id="tabImgUuid" class="cc-img-tab" style="flex:1;background:transparent;border:1px solid #2a2a4a;border-bottom:1px solid #0f3460;color:#888;border-radius:4px 4px 0 0;padding:4px 8px;cursor:pointer;font-size:11px;">UUID</button>
            </div>
            <!-- URL panel -->
            <div id="panelImgUrl" style="display:flex;flex-direction:column;gap:6px;">
              <div style="display:flex;gap:8px;">
                <input type="text" name="itemImg" id="itemImgInput" value="${_esc(item.img)}" placeholder="https://... or /path/to/image.png" style="flex:1;background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;">
                <button type="button" id="itemBrowseBtn" style="background:#2a2a4a;border:1px solid #3a3a5a;color:#b0b0b0;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:12px;"><i class="fas fa-folder-open"></i></button>
              </div>
            </div>
            <!-- UUID panel -->
            <div id="panelImgUuid" style="display:none;flex-direction:column;gap:6px;">
              <div style="display:flex;gap:8px;">
                <input type="text" name="itemUuid" id="itemUuidInput" value="" placeholder="Actor.xxx, Item.xxx, JournalEntry.xxx..." style="flex:1;background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;">
                <button type="button" id="itemResolveUuidBtn" style="background:#2a2a4a;border:1px solid #3a3a5a;color:#c9a227;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:12px;white-space:nowrap;"><i class="fas fa-search"></i> Resolve</button>
              </div>
              <div id="uuidPreview" style="display:none;align-items:center;gap:8px;padding:6px 10px;background:rgba(15,52,96,0.3);border-radius:4px;border:1px solid #2a2a4a;">
                <img id="uuidPreviewImg" src="" style="width:32px;height:32px;object-fit:cover;border-radius:4px;border:1px solid #2a2a4a;">
                <span id="uuidPreviewName" style="font-size:11px;color:#b0b0b0;"></span>
              </div>
            </div>
          </div>

          <!-- Colors row -->
          <div style="display:flex;gap:16px;">
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
              <label style="color:#b0b0b0;font-size:11px;">Border Color</label>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="color" name="itemBorderColor" value="${borderVal}" style="width:36px;height:28px;border:none;background:transparent;cursor:pointer;">
                <button type="button" id="resetBorderColor" style="background:transparent;border:1px solid #2a2a4a;color:#888;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:10px;">Reset</button>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
              <label style="color:#b0b0b0;font-size:11px;">Background Color</label>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="color" name="itemBgColor" value="${bgVal}" style="width:36px;height:28px;border:none;background:transparent;cursor:pointer;">
                <button type="button" id="resetBgColor" style="background:transparent;border:1px solid #2a2a4a;color:#888;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:10px;">Reset</button>
              </div>
            </div>
          </div>

          <!-- Shape -->
          <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="color:#b0b0b0;font-size:11px;">Shape</label>
            <input type="hidden" name="itemShape" id="itemShapeInput" value="${_esc(item.shape)}">
            <div id="itemShapeGrid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;">${shapeGrid}</div>
          </div>

          <!-- Image options row -->
          <div style="display:flex;gap:16px;">
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
              <label style="color:#b0b0b0;font-size:11px;">Image Fit</label>
              <select name="itemImgFit" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;">${fitOpts}</select>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              <label style="color:#b0b0b0;font-size:11px;">Image Position</label>
              <input type="hidden" name="itemImgPos" id="itemImgPosInput" value="${_esc(item.imgPosition)}">
              <div id="itemPosGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:90px;">${posGrid}</div>
            </div>
          </div>

          <!-- Transparency -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="color:#b0b0b0;font-size:11px;">Image Transparency: <span id="transVal" style="color:#c9a227;">${Math.round((item.imgTransparency ?? 1) * 100)}%</span></label>
            <input type="range" name="itemTrans" min="0" max="100" value="${Math.round((item.imgTransparency ?? 1) * 100)}" style="width:100%;">
          </div>

          <!-- Description -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="color:#b0b0b0;font-size:11px;">Description</label>
            <textarea name="itemDesc" rows="3" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;resize:vertical;">${_esc(item.description)}</textarea>
          </div>

        </form>
      </div>
      <div style="padding:12px 16px;border-top:1px solid #2a2a4a;display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;">
        ${isEdit ? `<button type="button" id="itemDelBtn" style="background:transparent;border:1px solid #f44336;color:#f44336;border-radius:4px;padding:6px 14px;cursor:pointer;font-size:13px;margin-right:auto;"><i class="fas fa-trash"></i></button>` : ""}
        <button type="button" id="itemCancelBtn" style="background:transparent;border:1px solid #2a2a4a;color:#b0b0b0;border-radius:4px;padding:6px 14px;cursor:pointer;font-size:13px;">Cancel</button>
        <button type="submit" form="cc-item-form" id="itemSaveBtn" style="background:linear-gradient(135deg,#c9a227,#b08d1f);border:none;color:#1a1a2e;border-radius:4px;padding:6px 14px;cursor:pointer;font-weight:600;font-size:13px;">Save</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // ---- Wire events ----

    // Shape selection
    const shapeInput = dialog.querySelector("#itemShapeInput");
    dialog.querySelectorAll("#itemShapeGrid .cc-shape-opt").forEach(el => {
      el.addEventListener("click", () => {
        dialog.querySelectorAll("#itemShapeGrid .cc-shape-opt").forEach(o => {
          o.style.borderColor = "#2a2a4a"; o.style.background = "transparent"; o.classList.remove("selected");
        });
        el.style.borderColor = "#c9a227"; el.style.background = "rgba(201,162,39,0.15)"; el.classList.add("selected");
        if (shapeInput) shapeInput.value = el.dataset.shape;
      });
    });

    // Image position selection
    const posInput = dialog.querySelector("#itemImgPosInput");
    dialog.querySelectorAll("#itemPosGrid .cc-pos-opt").forEach(el => {
      el.addEventListener("click", () => {
        dialog.querySelectorAll("#itemPosGrid .cc-pos-opt").forEach(o => {
          o.style.borderColor = "#2a2a4a"; o.classList.remove("selected");
        });
        el.style.borderColor = "#c9a227"; el.classList.add("selected");
        if (posInput) posInput.value = el.dataset.pos;
      });
    });

    // Transparency slider
    dialog.querySelector("input[name='itemTrans']")?.addEventListener("input", (e) => {
      const val = dialog.querySelector("#transVal"); if (val) val.textContent = e.target.value + "%";
    });

    // Reset color buttons
    dialog.querySelector("#resetBorderColor")?.addEventListener("click", () => {
      const sel = dialog.querySelector("select[name='itemType']");
      const typeId = sel ? sel.value : "placeholder";
      const color = ITEM_TYPES[typeId]?.color || "#607d8b";
      dialog.querySelector("input[name='itemBorderColor']").value = color;
    });
    dialog.querySelector("#resetBgColor")?.addEventListener("click", () => {
      dialog.querySelector("input[name='itemBgColor']").value = "#1a1a2e";
    });

    // Type change → update default border color if not customized
    dialog.querySelector("select[name='itemType']")?.addEventListener("change", (e) => {
      const typeColor = ITEM_TYPES[e.target.value]?.color || "#607d8b";
      const borderInput = dialog.querySelector("input[name='itemBorderColor']");
      // Only auto-update if current color matches a type default
      const currentMatchesType = Object.values(ITEM_TYPES).some(t => t.color === borderInput.value);
      if (currentMatchesType || !borderInput.value) borderInput.value = typeColor;
    });

    // ---- Image source tabs ----
    const tabUrl = dialog.querySelector("#tabImgUrl");
    const tabUuid = dialog.querySelector("#tabImgUuid");
    const panelUrl = dialog.querySelector("#panelImgUrl");
    const panelUuid = dialog.querySelector("#panelImgUuid");

    const activateTab = (tab) => {
      if (tab === "url") {
        tabUrl.style.background = "#0f3460"; tabUrl.style.borderColor = "#c9a227"; tabUrl.style.color = "#c9a227";
        tabUuid.style.background = "transparent"; tabUuid.style.borderColor = "#2a2a4a"; tabUuid.style.color = "#888";
        panelUrl.style.display = "flex"; panelUuid.style.display = "none";
      } else {
        tabUuid.style.background = "#0f3460"; tabUuid.style.borderColor = "#c9a227"; tabUuid.style.color = "#c9a227";
        tabUrl.style.background = "transparent"; tabUrl.style.borderColor = "#2a2a4a"; tabUrl.style.color = "#888";
        panelUuid.style.display = "flex"; panelUrl.style.display = "none";
      }
    };
    tabUrl?.addEventListener("click", () => activateTab("url"));
    tabUuid?.addEventListener("click", () => activateTab("uuid"));

    // Browse image
    dialog.querySelector("#itemBrowseBtn")?.addEventListener("click", () => {
      const inp = dialog.querySelector("#itemImgInput");
      const current = inp?.value || "";
      // Lower panel and dialog z-index so FilePicker appears fully on top
      const panels = document.querySelectorAll(".cc-panel");
      panels.forEach(p => p.style.zIndex = "1");
      overlay.style.zIndex = "1";
      new FilePicker({
        type: "image",
        current,
        callback: (path) => {
          if (inp) inp.value = path;
          // Restore z-index
          panels.forEach(p => p.style.zIndex = "");
          overlay.style.zIndex = "";
        }
      }).browse(current);
      // Fallback restore (if user cancels without selecting)
      setTimeout(() => {
        panels.forEach(p => p.style.zIndex = "");
        overlay.style.zIndex = "";
      }, 5000);
    });

    // Resolve UUID
    dialog.querySelector("#itemResolveUuidBtn")?.addEventListener("click", async () => {
      const inp = dialog.querySelector("#itemUuidInput");
      const uuid = inp?.value.trim();
      if (!uuid) { ui.notifications.warn("Enter a UUID first."); return; }

      try {
        ui.notifications.info(`Resolving UUID: ${uuid}...`);
        const doc = await fromUuid(uuid);
        if (!doc) { ui.notifications.error("Document not found."); return; }

        const img = doc.img || doc.texture?.src || doc.src || "";
        const name = doc.name || "Unknown";

        if (!img) { ui.notifications.warn("Document has no image."); return; }

        // Set the resolved image URL into the URL input
        const urlInput = dialog.querySelector("#itemImgInput");
        if (urlInput) urlInput.value = img;

        // Show preview
        const previewBox = dialog.querySelector("#uuidPreview");
        const previewImg = dialog.querySelector("#uuidPreviewImg");
        const previewName = dialog.querySelector("#uuidPreviewName");
        if (previewBox) previewBox.style.display = "flex";
        if (previewImg) previewImg.src = img;
        if (previewName) previewName.textContent = name;

        ui.notifications.info(`Resolved: ${name}`);
      } catch (err) {
        console.error("[cypher-connections] UUID resolve error:", err);
        ui.notifications.error("Failed to resolve UUID.");
      }
    });

    // Delete
    dialog.querySelector("#itemDelBtn")?.addEventListener("click", () => {
      overlay.remove(); resolve(false);
    });

    // Cancel
    dialog.querySelector("#itemCancelBtn")?.addEventListener("click", () => {
      overlay.remove(); resolve(null);
    });

    // Overlay click
    overlay.addEventListener("click", (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });

    // Save (form submit)
    const form = dialog.querySelector("#cc-item-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const getVal = (name) => { const el = form.querySelector(`[name="${name}"]`); return el ? el.value : ""; };
        const name = (getVal("itemName") || "").trim();
        if (!name) { ui.notifications.warn("Item name is required."); return; }

        overlay.remove();
        resolve({
          name: name,
          type: getVal("itemType") || "placeholder",
          img: (getVal("itemImg") || "").trim(),
          description: (getVal("itemDesc") || "").trim(),
          borderColor: getVal("itemBorderColor") || "",
          bgColor: getVal("itemBgColor") || "",
          shape: shapeInput?.value || "rect",
          imgTransparency: parseInt(getVal("itemTrans") || "100") / 100,
          imgFit: getVal("itemImgFit") || "default",
          imgPosition: getVal("itemImgPos") || "center"
        });
      } catch (err) {
        console.error("[cypher-connections] Item save error:", err);
      }
    });

    // Focus
    setTimeout(() => { const el = form.querySelector("[name='itemName']"); if (el) el.focus(); }, 50);
  });
}
