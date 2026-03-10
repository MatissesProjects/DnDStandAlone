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
        
        // Excalidraw zoom value can be complex, ensure we have a number
        const zoom = typeof appState.zoom === 'number' ? appState.zoom : appState.zoom.value;

        const hitZones = elements
          .filter(el => el.link && el.link.startsWith("entity:"))
          .map(el => {
            // Correct coordinate transformation for the image stream
            // World to Viewport
            const x = (el.x + appState.scrollX) * zoom;
            const y = (el.y + appState.scrollY) * zoom;
            const w = el.width * zoom;
            const h = el.height * zoom;
            return { id: el.link.split(":")[1], x, y, w, h };
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
