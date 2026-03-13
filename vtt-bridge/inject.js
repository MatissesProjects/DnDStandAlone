(function() {
  console.log("[VTT Injected] Script active, polling for API...");
  
  let api = null;
  
  function findAPI() {
    if (window.excalidrawAPI) {
      api = window.excalidrawAPI;
      console.log("[VTT Injected] API Hooked successfully.");
      return true;
    }
    return false;
  }

  const pollInterval = setInterval(() => {
    if (findAPI()) {
      clearInterval(pollInterval);
    }
  }, 500);

  const handleMessage = (event) => {
    if (!api) return;
    
    if (event.data.type === "VTT_INTERNAL_INJECTED_REQUEST") {
      const { subType, payload, requestId } = event.data;
      console.log(`[VTT Injected] Internal Request: ${subType}`, payload);
      
      if (subType === "MOVE") {
        api.updateScene({
          appState: { scrollX: payload.x, scrollY: payload.y, zoom: { value: payload.zoom } }
        });
      }

      if (subType === "INSERT") {
        const { elements } = payload;
        const currentElements = api.getSceneElements();
        const appState = api.getAppState();
        
        // Calculate center of current view
        const centerX = -appState.scrollX + (window.innerWidth / 2) / (appState.zoom.value || 1);
        const centerY = -appState.scrollY + (window.innerHeight / 2) / (appState.zoom.value || 1);

        // Find the bounding box of new elements to center them
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        elements.forEach(el => {
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y);
          maxX = Math.max(maxX, el.x + el.width);
          maxY = Math.max(maxY, el.y + el.height);
        });
        const width = maxX - minX;
        const height = maxY - minY;
        const offsetX = centerX - (minX + width / 2);
        const offsetY = centerY - (minY + height / 2);

        const newElements = elements.map(el => ({
          ...el,
          id: `${el.id}_${Date.now()}`, // Simple ID suffix to avoid immediate collision
          x: el.x + offsetX,
          y: el.y + offsetY,
          seed: Math.floor(Math.random() * 100000) // New seed for variety
        }));

        api.updateScene({
          elements: [...currentElements, ...newElements],
          appState: {
            ...appState,
            selectedElementIds: newElements.reduce((acc, el) => ({ ...acc, [el.id]: true }), {})
          }
        });
      }

      if (subType === "GET_SELECTED") {
        const appState = api.getAppState();
        const selectedIds = appState.selectedElementIds || {};
        
        const selectedElements = api.getSceneElements()
            .filter(el => selectedIds[el.id] && !el.isDeleted)
            .map(el => ({ ...el })); // Shallow clone to be safe
        
        console.log(`[VTT Injected] Elements selected for capture: ${selectedElements.length}`);
        
        if (selectedElements.length > 0) {
            window.postMessage({
                type: "VTT_INTERNAL_SELECTED_REPLY",
                requestId: requestId,
                elements: selectedElements
            }, "*");
        } else {
            console.warn("[VTT Injected] Capture requested but no valid elements are selected.");
            // Send empty reply so the chain doesn't hang
            window.postMessage({
                type: "VTT_INTERNAL_SELECTED_REPLY",
                requestId: requestId,
                elements: []
            }, "*");
        }
      }

      if (subType === "METADATA") {
        const elements = api.getSceneElements();
        const appState = api.getAppState();
        
        const canvas = document.querySelector("canvas.static") || document.querySelector("canvas");
        const canvasWidth = canvas ? canvas.width / window.devicePixelRatio : window.innerWidth;
        const canvasHeight = canvas ? canvas.height / window.devicePixelRatio : window.innerHeight;

        const zoom = typeof appState.zoom === 'number' ? appState.zoom : appState.zoom.value;

        const hitZones = elements
          .filter(el => el.link && el.link.startsWith("entity:"))
          .map(el => {
            const vx = (el.x + appState.scrollX) * zoom;
            const vy = (el.y + appState.scrollY) * zoom;
            const vw = el.width * zoom;
            const vh = el.height * zoom;

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
  findAPI();
})();
