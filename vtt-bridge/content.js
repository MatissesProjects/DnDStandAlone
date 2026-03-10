// Debug log to confirm extension is running
console.log("[VTT Bridge] Content script active. Probing for Excalidraw...");

// VISUAL INDICATOR: Add a small label to the corner of the iframe
const debugLabel = document.createElement("div");
debugLabel.innerHTML = "VTT Bridge: ACTIVE";
debugLabel.style.position = "fixed";
debugLabel.style.bottom = "10px";
debugLabel.style.right = "10px";
debugLabel.style.background = "red";
debugLabel.style.color = "white";
debugLabel.style.padding = "2px 5px";
debugLabel.style.fontSize = "10px";
debugLabel.style.zIndex = "999999";
debugLabel.style.fontWeight = "bold";
debugLabel.style.borderRadius = "3px";
debugLabel.style.pointerEvents = "none";
document.body.appendChild(debugLabel);

function injectScript(code) {
  const script = document.createElement('script');
  script.textContent = code;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Listen for messages from the parent VTT window
window.addEventListener("message", (event) => {
  if (event.data.type === "VTT_BRIDGE_MOVE") {
    const { x, y, zoom } = event.data;
    injectScript(`
      (function() {
        const api = window.excalidrawAPI;
        if (api) {
          api.updateScene({
            appState: { scrollX: ${x}, scrollY: ${y}, zoom: { value: ${zoom} } }
          });
        }
      })();
    `);
  }

  if (event.data.type === "VTT_BRIDGE_CAPTURE") {
    injectScript(`
      (function() {
        const api = window.excalidrawAPI;
        if (api) {
          const state = api.getAppState();
          window.postMessage({
            type: "VTT_BRIDGE_CAPTURE_RESULT",
            x: Math.round(state.scrollX),
            y: Math.round(state.scrollY),
            zoom: state.zoom.value
          }, "*");
        }
      })();
    `);
  }

  if (event.data.type === "VTT_BRIDGE_STREAM_REQUEST") {
    console.log("[VTT Bridge] Received stream request from VTT");
    // Try to find the static canvas (where Excalidraw draws the scene)
    const canvases = Array.from(document.querySelectorAll("canvas"));
    let targetCanvas = canvases.find(c => c.classList.contains("static")) || canvases[0];
    
    if (targetCanvas) {
      try {
        const dataUrl = targetCanvas.toDataURL("image/jpeg", 0.5);
        // Important: Post to self so the generic relay picks it up
        window.postMessage({
          type: "VTT_BRIDGE_STREAM_RESULT",
          image: dataUrl
        }, "*");
      } catch (e) {
        console.warn("[VTT Bridge] Canvas tainted, cannot stream.");
      }
    }
  }
});

// Relay ALL VTT_BRIDGE results back to the VTT parent window
window.addEventListener("message", (event) => {
    if (event.data && event.data.type && event.data.type.startsWith("VTT_BRIDGE_") && event.data.type.endsWith("_RESULT")) {
        window.parent.postMessage(event.data, "*");
    }
});
