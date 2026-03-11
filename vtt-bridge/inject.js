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

      if (subType === "GET_SELECTED") {
        const selectedElements = api.getSceneElements().filter(el => {
            const selection = api.getAppState().selectedElementIds;
            return selection[el.id];
        });
        
        console.log(`[VTT Injected] Elements selected: ${selectedElements.length}`);
        
        if (selectedElements.length > 0) {
            window.postMessage({
                type: "VTT_INTERNAL_SELECTED_REPLY",
                requestId: requestId,
                elements: selectedElements
            }, "*");
        } else {
            console.warn("[VTT Injected] Capture requested but no elements are selected in Excalidraw.");
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
