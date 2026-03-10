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

  function captureAndSend() {
    const canvases = Array.from(document.querySelectorAll("canvas"));
    // Look for static canvas, fallback to any canvas over 100px
    let targetCanvas = canvases.find(c => c.classList.contains("static")) || 
                       canvases.find(c => c.width > 100);
    
    if (targetCanvas) {
      try {
        const dataUrl = targetCanvas.toDataURL("image/jpeg", 0.4);
        window.postMessage({
          type: "VTT_BRIDGE_STREAM_RESULT",
          image: dataUrl
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

  // Listen for messages from the parent VTT window
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
      // If this is the first request, start a high-speed internal loop
      if (!isStreamingActive) {
        console.log("[VTT Bridge] Starting continuous stream loop...");
        isStreamingActive = true;
        setInterval(() => {
            captureAndSend();
        }, 1000); // 1 Frame Per Second
      }
      // Immediate response to the first request
      captureAndSend();
    }
  });

  // Relay ALL VTT_BRIDGE results back to the VTT parent window
  window.addEventListener("message", (event) => {
      if (event.data && event.data.type && event.data.type.startsWith("VTT_BRIDGE_") && event.data.type.endsWith("_RESULT")) {
          window.parent.postMessage(event.data, "*");
      }
  });
}
