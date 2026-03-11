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

  // CSP COMPLIANT INJECTION
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  (document.head || document.documentElement).appendChild(script);

  function getMetadata() {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).substring(7);
      
      // Safety timeout: don't hang the stream if inject.js is slow
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve({ hitZones: [] });
      }, 200);

      const handler = (event) => {
        if (event.data.type === "VTT_INTERNAL_METADATA_REPLY" && event.data.requestId === requestId) {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve(event.data.metadata);
        }
      };
      window.addEventListener("message", handler);

      window.postMessage({
        type: "VTT_INTERNAL_INJECTED_REQUEST",
        subType: "METADATA",
        requestId
      }, "*");
    });
  }

  // Listen for internal replies from inject.js and relay them to parent
  window.addEventListener("message", (event) => {
    if (event.data.type === "VTT_INTERNAL_SELECTED_REPLY") {
        window.parent.postMessage({
            type: "VTT_BRIDGE_SELECTED_RESULT",
            elements: event.data.elements
        }, "*");
    }
  });

  async function captureAndSend() {
    const canvases = Array.from(document.querySelectorAll("canvas"));
    let targetCanvas = canvases.find(c => c.classList.contains("static")) || 
                       canvases.find(c => c.width > 100);
    
    if (targetCanvas) {
      try {
        // Higher quality 0.8 (up from 0.4) for better visibility
        // Using image/jpeg as it is generally well-supported and efficient for this use case
        const dataUrl = targetCanvas.toDataURL("image/jpeg", 0.8);
        const metadata = await getMetadata();

        window.parent.postMessage({
          type: "VTT_BRIDGE_STREAM_RESULT",
          image: dataUrl,
          hitZones: metadata.hitZones
        }, "*");
        return true;
      } catch (e) {
        console.warn("[VTT Bridge] Capture failed:", e);
        return false;
      }
    }
    return false;
  }

  window.addEventListener("message", (event) => {
    if (event.data.type === "VTT_BRIDGE_MOVE") {
      window.postMessage({
        type: "VTT_INTERNAL_INJECTED_REQUEST",
        subType: "MOVE",
        payload: { x: event.data.x, y: event.data.y, zoom: event.data.zoom }
      }, "*");
    }

    if (event.data.type === "VTT_BRIDGE_STREAM_REQUEST") {
      if (!isStreamingActive) {
        console.log("[VTT Bridge] Activating Stream Loop");
        isStreamingActive = true;
        setInterval(captureAndSend, 1000); 
      }
      captureAndSend();
    }

    if (event.data.type === "VTT_BRIDGE_GET_SELECTED") {
        const requestId = Math.random().toString(36).substring(7);
        window.postMessage({
            type: "VTT_INTERNAL_INJECTED_REQUEST",
            subType: "GET_SELECTED",
            requestId
        }, "*");
    }
  });

  // Relay ALL VTT_BRIDGE results back to the VTT parent window
  window.addEventListener("message", (event) => {
      if (event.data && event.data.type && event.data.type.startsWith("VTT_BRIDGE_") && event.data.type.endsWith("_RESULT")) {
          window.parent.postMessage(event.data, "*");
      }
  });
}
