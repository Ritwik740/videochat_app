const socket = io();  // Connect to the server using Socket.IO
let peerConnection;
let localStream;
const config = {
  iceServers: [
    { urls: ["stun:bn-turn2.xirsys.com"] },
    {
      username: "XEAjYPqSnkwjIwHp7LBoS2s2WE3YYhljVQ9XJAC_zwTQAXP0VY7Z9Uh_SwT7YtmNAAAAAGgTs_xyaXR3aWttaXNocmEwMw==",
      credential: "86c7cfec-26b4-11f0-af1e-0242ac140004",
      urls: [
        "turn:bn-turn2.xirsys.com:80?transport=udp",
        "turn:bn-turn2.xirsys.com:3478?transport=udp",
        "turn:bn-turn2.xirsys.com:80?transport=tcp",
        "turn:bn-turn2.xirsys.com:3478?transport=tcp",
        "turns:bn-turn2.xirsys.com:443?transport=tcp",
        "turns:bn-turn2.xirsys.com:5349?transport=tcp",
      ]
    }
  ]
};

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// Get access to the user's camera and microphone
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
    socket.emit('join');  // Emit join event to the server
  })
  .catch(err => console.log("Error accessing media devices:", err));

// When a match is found between users
socket.on('match', ({ room, peer }) => {
  peerConnection = new RTCPeerConnection(config);

  // Add local tracks to the peer connection
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // ICE candidate handling
  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('ice-candidate', { to: peer, candidate: e.candidate });
    }
  };

  // When a remote track is received, set it to the remote video element
  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  // Create offer for the peer connection
  peerConnection.createOffer().then(offer => {
    return peerConnection.setLocalDescription(offer);
  })
  .then(() => {
    socket.emit('offer', { to: peer, offer: peerConnection.localDescription });
  });
});

// When an offer is received from another user
socket.on('offer', async ({ from, offer }) => {
  peerConnection = new RTCPeerConnection(config);

  // Add local tracks to the peer connection
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // ICE candidate handling
  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('ice-candidate', { to: from, candidate: e.candidate });
    }
  };

  // When a remote track is received, set it to the remote video element
  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  // Set the remote offer and create an answer
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('answer', { to: from, answer });
});

// When an answer is received
socket.on('answer', async ({ answer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// When an ICE candidate is received
socket.on('ice-candidate', async ({ candidate }) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error('Error adding received ICE candidate', e);
  }
});

// Skip button logic to disconnect and find a new match
function skip() {
  if (peerConnection) {
    peerConnection.close();  // Close the current peer connection
    remoteVideo.srcObject = null;  // Clear the remote video display
  }
  socket.emit('skip');  // Emit skip event to the server to disconnect
}
