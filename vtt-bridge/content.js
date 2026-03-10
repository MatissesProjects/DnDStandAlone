// Debug log to confirm extension is running
console.log("[VTT Bridge] Content script loaded inside iframe.");

// Listen for messages from the parent VTT window
window.addEventListener("message", (event) => {
  // Security: You might want to check event.origin here later
  
  if (event.data.type === "VTT_BRIDGE_MOVE") {
    const { x, y, zoom } = event.data;
    console.log("[VTT Bridge] Executing Move:", { x, y, zoom });
    
    injectScript(`
      (function() {
        const findAPI = () => {
          if (window.excalidrawAPI) return window.excalidrawAPI;
          // Search for API in hidden React props if necessary
          const root = document.querySelector(".excalidraw-container");
          if (root) {
            const keys = Object.keys(root);
            const reactKey = keys.find(k => k.startsWith("__reactInternalInstance") || k.startsWith("__reactFiber"));
            if (reactKey) {
              // This is a deep probe, may vary by Excalidraw version
              try {
                // Try to find the API through the component tree
                // For now, we assume the GM/User is using a version that might expose it
              } catch(e) {}
            }
          }
          return null;
        };

        const api = findAPI();
        if (api) {
          api.updateScene({
            appState: { 
              scrollX: ${x}, 
              scrollY: ${y}, 
              zoom: { value: ${zoom} } 
            }
          });
        } else {
          // FALLBACK: If no API, we can try manual DOM scrolling as a last resort
          // but Excalidraw uses Canvas, so scrollTo won't work.
          console.error("[VTT Bridge] Could not find Excalidraw API. Teleportation failed.");
        }
      })();
    `);
  }

  if (event.data.type === "VTT_BRIDGE_CAPTURE") {
    console.log("[VTT Bridge] Executing Capture Request...");
    injectScript(`
      (function() {
        if (window.excalidrawAPI) {
          const state = window.excalidrawAPI.getAppState();
          window.postMessage({
            type: "VTT_BRIDGE_CAPTURE_RESULT",
            x: Math.round(state.scrollX),
            y: Math.round(state.scrollY),
            zoom: state.zoom.value
          }, "*");
        } else {
           console.error("[VTT Bridge] API not found for capture.");
        }
      })();
    `);
  }
});

// Relay results from the injected script back to the parent VTT
window.addEventListener("message", (event) => {
    if (event.data.type === "VTT_BRIDGE_CAPTURE_RESULT") {
        console.log("[VTT Bridge] Relaying capture result to parent VTT");
        window.parent.postMessage(event.data, "*");
    }
});

function injectScript(code) {
  const script = document.createElement('script');
  script.textContent = code;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}
