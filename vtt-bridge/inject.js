(function() {
  const api = window.excalidrawAPI;
  if (!api) return;

  const handleMessage = (event) => {
    if (event.data.type === "VTT_INTERNAL_INJECTED_REQUEST") {
      const { subType, payload } = event.data;
      
      if (subType === "MOVE") {
        api.updateScene({
          appState: { scrollX: payload.x, scrollY: payload.y, zoom: { value: payload.zoom } }
        });
      }

      if (subType === "METADATA") {
        const elements = api.getSceneElements();
        const appState = api.getAppState();
        const hitZones = elements
          .filter(el => el.link && el.link.startsWith("entity:"))
          .map(el => {
            const x = (el.x + appState.scrollX) * appState.zoom.value;
            const y = (el.y + appState.scrollY) * appState.zoom.value;
            const w = el.width * appState.zoom.value;
            const h = el.height * appState.zoom.value;
            return { id: el.link.split(":")[1], x, y, w, h };
          });

        window.postMessage({
          type: "VTT_INTERNAL_METADATA_REPLY",
          requestId: event.data.requestId,
          metadata: { hitZones }
        }, "*");
      }
    }
  };

  window.addEventListener("message", handleMessage);
  console.log("[VTT Bridge] Injection core initialized.");
})();
