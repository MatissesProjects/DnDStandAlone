// Debug log to confirm extension is running
console.log("[VTT Bridge] Content script triggered on:", window.location.href);

// Safety: Only run logic on Excalidraw pages
if (window.location.host.includes("excalidraw.com")) {
  
  let isStreamingActive = false;

  function initDebugLabel() {
    if (!document.body) {
      setTimeout(initDebugLabel, 100);
      return;
    }
    const debugLabel = document.createElement("div");
    debugLabel.id = "vtt-debug-label";
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
    if (!document.getElementById("vtt-debug-label")) {
        document.body.appendChild(debugLabel);
    }
  }

  initDebugLabel();

  // Helper to inject code into the page context to access window.excalidrawAPI
  function getMetadata() {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).substring(7);
      
      const handler = (event) => {
        if (event.data.type === "VTT_INTERNAL_METADATA_REPLY" && event.data.requestId === requestId) {
          window.removeEventListener("message", handler);
          resolve(event.data.metadata);
        }
      };
      window.addEventListener("message", handler);

      const script = document.createElement('script');
      script.textContent = `
        (function() {
          const api = window.excalidrawAPI;
          if (api) {
            const elements = api.getSceneElements();
            const appState = api.getAppState();
            
            // Map world coordinates to viewport coordinates
            // Excalidraw stores elements in world space.
            // We need to know where they are relative to the canvas top-left.
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
              requestId: "${requestId}",
              metadata: { hitZones }
            }, "*");
          }
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    });
  }

  async function captureAndSend() {
    const canvases = Array.from(document.querySelectorAll("canvas"));
    let targetCanvas = canvases.find(c => c.classList.contains("static")) || 
                       canvases.find(c => c.width > 100);
    
    if (targetCanvas) {
      try {
        const dataUrl = targetCanvas.toDataURL("image/jpeg", 0.4);
        const metadata = await getMetadata();

        window.postMessage({
          type: "VTT_BRIDGE_STREAM_RESULT",
          image: dataUrl,
          hitZones: metadata.hitZones
        }, "*");
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  function injectScript(code) {
    const script = document.createElement('script');
    script.textContent = code;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  window.addEventListener("message", (event) => {
    if (event.data.type === "VTT_BRIDGE_MOVE") {
      const { x, y, zoom } = event.data;
      injectScript(`
        (function() {
          const api = window.excalidrawAPI;
          if (api) { api.updateScene({ appState: { scrollX: ${x}, scrollY: ${y}, zoom: { value: ${zoom} } } }); }
        })();
      `);
    }

    if (event.data.type === "VTT_BRIDGE_STREAM_REQUEST") {
      if (!isStreamingActive) {
        isStreamingActive = true;
        setInterval(() => {
            captureAndSend();
        }, 1000); 
      }
      captureAndSend();
    }
  });

  window.addEventListener("message", (event) => {
      if (event.data && event.data.type && event.data.type.startsWith("VTT_BRIDGE_") && event.data.type.endsWith("_RESULT")) {
          window.parent.postMessage(event.data, "*");
      }
  });
}
