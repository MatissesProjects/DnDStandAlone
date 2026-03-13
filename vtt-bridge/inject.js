(function() {
  console.log("[VTT Injected] Script active, polling for API...");
  
  let api = null;
  
  function findAPI() {
    if (window.excalidrawAPI) {
      api = window.excalidrawAPI;
      console.log("[VTT Injected] API Hooked via global variable.");
      return true;
    }

    // Fallback: Search React Fiber tree for the API
    try {
        const canvas = document.querySelector("canvas.static") || document.querySelector("canvas");
        if (canvas) {
            const fiberKey = Object.keys(canvas).find(k => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
            if (fiberKey) {
                let curr = canvas[fiberKey];
                while (curr) {
                    // Check if this component has the excalidrawAPI in its props or state
                    if (curr.memoizedProps && curr.memoizedProps.excalidrawAPI) {
                        api = curr.memoizedProps.excalidrawAPI;
                        window.excalidrawAPI = api;
                        console.log("[VTT Injected] API Found and hooked via React Fiber props!");
                        return true;
                    }
                    // Check if it's a ref that looks like the API
                    if (curr.ref && curr.ref.current && typeof curr.ref.current.updateScene === 'function') {
                        api = curr.ref.current;
                        window.excalidrawAPI = api;
                        console.log("[VTT Injected] API Found and hooked via React Ref!");
                        return true;
                    }
                    curr = curr.return;
                }
            }
        }
    } catch (e) {
        console.error("[VTT Injected] Error searching for API in Fiber tree:", e);
    }

    return false;
  }

  const pollInterval = setInterval(() => {
    if (findAPI()) {
      clearInterval(pollInterval);
    }
  }, 500);

  const handleMessage = (event) => {
    console.log(`[VTT Injected] Incoming message: ${event.data.type}`);
    if (!api) {
        console.warn("[VTT Injected] API not ready, ignoring message.");
        return;
    }
    
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
