// Debug log to confirm extension is running
console.log("[VTT Bridge] Content script active. Probing for Excalidraw...");

// Function to find and expose the Excalidraw API if it exists
function probeForAPI() {
  // If it's already there, great
  if (window.excalidrawAPI) return true;

  // Try to find it via React internal properties on the container
  const container = document.querySelector(".excalidraw-container");
  if (container) {
    for (const key in container) {
      if (key.startsWith("__reactProps") || key.startsWith("__reactFiber")) {
        const props = container[key];
        // In some versions, the API might be nested in the props of a child
        // or passed down. This is speculative but worth a shot.
      }
    }
  }
  return false;
}

// Listen for messages from the parent VTT window
window.addEventListener("message", (event) => {
  if (event.data.type === "VTT_BRIDGE_MOVE") {
    const { x, y, zoom } = event.data;
    console.log("[VTT Bridge] Teleporting to:", { x, y, zoom });
    
    injectScript(`
      (function() {
        const api = window.excalidrawAPI;
        if (api) {
          api.updateScene({
            appState: { 
              scrollX: ${x}, 
              scrollY: ${y}, 
              zoom: { value: ${zoom} } 
            }
          });
        } else {
          console.error("[VTT Bridge] API not found. If this is excalidraw.com, ensure the 'Developer' version or a custom build is used that exposes 'window.excalidrawAPI'.");
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
});

// Relay results back to the VTT
window.addEventListener("message", (event) => {
    if (event.data.type === "VTT_BRIDGE_CAPTURE_RESULT") {
        window.parent.postMessage(event.data, "*");
    }
});

function injectScript(code) {
  const script = document.createElement('script');
  script.textContent = code;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Initial probe
probeForAPI();
