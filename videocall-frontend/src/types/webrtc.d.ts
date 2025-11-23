// Global augmentations for prefixed RTCPeerConnection
declare global {
  interface Window {
    webkitRTCPeerConnection?: typeof RTCPeerConnection
    mozRTCPeerConnection?: typeof RTCPeerConnection
  }
}

export {}

