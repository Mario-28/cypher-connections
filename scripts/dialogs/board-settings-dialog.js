/**
 * BoardSettingsDialog — DOM-based modal for editing board appearance.
 * Background color, background image, transparency, position, fit.
 */

function _esc(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

const IMG_FITS = [
  { id: "cover", label: "Cover" },
  { id: "contain", label: "Contain" },
  { id: "default", label: "Default" },
];

const IMG_POSITIONS = [
  { id: "top-left", label: "Top Left" },
  { id: "top", label: "Top Center" },
  { id: "top-right", label: "Top Right" },
  { id: "left", label: "Middle Left" },
  { id: "center", label: "Center" },
  { id: "right", label: "Middle Right" },
  { id: "bottom-left", label: "Bottom Left" },
  { id: "bottom", label: "Bottom Center" },
  { id: "bottom-right", label: "Bottom Right" },
];

/**
 * @param {Object} board - The Board instance to edit
 * @returns {Promise<Object|null>} Board appearance updates or null if cancelled
 */
export function BoardSettingsDialog(board) {
  return new Promise((resolve) => {
    const bgColor = board.bgColor || "#1a1a2e";
    const bgImage = board.bgImage || "";
    const trans = Math.round((board.bgImageTransparency ?? 1) * 100);
    const bgPos = board.bgImagePosition || "center";
    const bgFit = board.bgImageFit || "cover";

    let fitOpts = "";
    for (const f of IMG_FITS) {
      fitOpts += `<option value="${_esc(f.id)}" ${f.id === bgFit ? "selected" : ""}>${_esc(f.label)}</option>`;
    }

    let posOpts = "";
    for (const p of IMG_POSITIONS) {
      posOpts += `<option value="${_esc(p.id)}" ${p.id === bgPos ? "selected" : ""}>${_esc(p.label)}</option>`;
    }

    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background:linear-gradient(180deg,#1a1a2e,#16213e);border:1px solid #2a2a4a;border-radius:8px;width:420px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:var(--font-primary,'Signika',sans-serif);font-size:13px;color:#e8e8e8;display:flex;flex-direction:column;overflow:hidden;";

    dialog.innerHTML = `
      <div style="padding:12px 16px;background:linear-gradient(90deg,#0f3460,#1a1a2e);border-bottom:1px solid #2a2a4a;border-radius:8px 8px 0 0;font-weight:600;color:#c9a227;font-size:14px;">
        Board Settings: ${_esc(board.name)}
      </div>
      <div style="padding:16px;">
        <form id="cc-board-form" style="display:flex;flex-direction:column;gap:14px;">

          <!-- Background Color -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="color:#b0b0b0;font-size:11px;">Background Color</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="color" name="bgColor" value="${_esc(bgColor)}" style="width:36px;height:28px;border:none;background:transparent;cursor:pointer;">
              <button type="button" id="resetBgColor" style="background:transparent;border:1px solid #2a2a4a;color:#888;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:10px;">Reset</button>
            </div>
          </div>

          <!-- Background Image -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="color:#b0b0b0;font-size:11px;">Background Image</label>
            <div style="display:flex;gap:8px;">
              <input type="text" name="bgImage" id="bgImageInput" value="${_esc(bgImage)}" placeholder="https://... or /path/to/image.png" style="flex:1;background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;">
              <button type="button" id="bgBrowseBtn" style="background:#2a2a4a;border:1px solid #3a3a5a;color:#b0b0b0;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:12px;"><i class="fas fa-folder-open"></i></button>
            </div>
          </div>

          <!-- Image Transparency -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="color:#b0b0b0;font-size:11px;">Image Transparency: <span id="transVal" style="color:#c9a227;">${trans}%</span></label>
            <input type="range" name="bgTrans" min="0" max="100" value="${trans}" style="width:100%;">
          </div>

          <!-- Image Fit -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="color:#b0b0b0;font-size:11px;">Image Fit</label>
            <select name="bgFit" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;">${fitOpts}</select>
          </div>

          <!-- Image Position -->
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="color:#b0b0b0;font-size:11px;">Image Position</label>
            <select name="bgPos" style="background:#0f3460;border:1px solid #2a2a4a;color:#e8e8e8;border-radius:4px;padding:6px 10px;font-family:inherit;font-size:13px;">${posOpts}</select>
          </div>

        </form>
      </div>
      <div style="padding:12px 16px;border-top:1px solid #2a2a4a;display:flex;justify-content:flex-end;gap:8px;">
        <button type="button" id="boardCancelBtn" style="background:transparent;border:1px solid #2a2a4a;color:#b0b0b0;border-radius:4px;padding:6px 14px;cursor:pointer;font-size:13px;">Cancel</button>
        <button type="submit" form="cc-board-form" id="boardSaveBtn" style="background:linear-gradient(135deg,#c9a227,#b08d1f);border:none;color:#1a1a2e;border-radius:4px;padding:6px 14px;cursor:pointer;font-weight:600;font-size:13px;">Save</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Events
    dialog.querySelector("#resetBgColor")?.addEventListener("click", () => {
      dialog.querySelector("input[name='bgColor']").value = "#1a1a2e";
    });

    dialog.querySelector("#bgBrowseBtn")?.addEventListener("click", () => {
      const inp = dialog.querySelector("#bgImageInput");
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

    dialog.querySelector("input[name='bgTrans']")?.addEventListener("input", (e) => {
      const val = dialog.querySelector("#transVal"); if (val) val.textContent = e.target.value + "%";
    });

    dialog.querySelector("#boardCancelBtn")?.addEventListener("click", () => { overlay.remove(); resolve(null); });

    overlay.addEventListener("click", (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });

    const form = dialog.querySelector("#cc-board-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const getVal = (name) => { const el = form.querySelector(`[name="${name}"]`); return el ? el.value : ""; };
        overlay.remove();
        resolve({
          bgColor: getVal("bgColor") || "#1a1a2e",
          bgImage: (getVal("bgImage") || "").trim(),
          bgImageTransparency: parseInt(getVal("bgTrans") || "100") / 100,
          bgImagePosition: getVal("bgPos") || "center",
          bgImageFit: getVal("bgFit") || "cover"
        });
      } catch (err) {
        console.error("[cypher-connections] Board settings save error:", err);
      }
    });
  });
}
