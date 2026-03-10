(function() {
  console.log("[VTT Injected] Script loaded, searching for Excalidraw API...");
  
  let api = null;
  
  function findAPI() {
    if (window.excalidrawAPI) {
      api = window.excalidrawAPI;
      console.log("[VTT Injected] API Found!");
      return true;
    }
    return false;
  }

  // Poll for API
  const pollInterval = setInterval(() => {
    if (findAPI()) {
      clearInterval(pollInterval);
    }
  }, 500);

  const handleMessage = (event) => {
    if (!api) return;
    
    if (event.data.type === "VTT_INTERNAL_INJECTED_REQUEST") {
      const { subType, payload, requestId } = event.data;
      
      if (subType === "MOVE") {
        api.updateScene({
          appState: { scrollX: payload.x, scrollY: payload.y, zoom: { value: payload.zoom } }
        });
      }

      if (subType === "METADATA") {
        const elements = api.getSceneElements();
        const appState = api.getAppState();
        
        // Use the canvas element directly to get its physical dimensions
        const canvas = document.querySelector("canvas.static") || document.querySelector("canvas");
        const canvasWidth = canvas ? canvas.width / window.devicePixelRatio : window.innerWidth;
        const canvasHeight = canvas ? canvas.height / window.devicePixelRatio : window.innerHeight;

        const zoom = typeof appState.zoom === 'number' ? appState.zoom : appState.zoom.value;

        const hitZones = elements
          .filter(el => el.link && el.link.startsWith("entity:"))
          .map(el => {
            // World to Viewport
            const vx = (el.x + appState.scrollX) * zoom;
            const vy = (el.y + appState.scrollY) * zoom;
            const vw = el.width * zoom;
            const vh = el.height * zoom;

            // Viewport to Percentage (relative to canvas container)
            // This is key: image on player side will be scaled, percentages keep links fixed to the image content
            return { 
              id: el.link.split(":")[1], 
              left: (vx / canvasWidth) * 100,
              top: (vy / canvasHeight) * 100,
              width: (vw / canvasWidth) * 100,
              height: (vh / canvasHeight) * 100
            };
          });

        window.postMessage({
          type: "VTT_INTERNAL_METADATA_REPLY",
          requestId: requestId,
          metadata: { hitZones }
        }, "*");
      }
    }
  };

  window.addEventListener("message", handleMessage);
  
  // Initial check
  findAPI();
})();
