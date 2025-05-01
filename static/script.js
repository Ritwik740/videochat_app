const socket = io();
let peerConnection;
let localStream;

const config = {
  iceServers: [
    {
      urls: ["stun:bn-turn2.xirsys.com"]
    },
    {
      username: "XEAjYPqSnkwjIwHp7LBoS2s2WE3YYhljVQ9XJAC_zwTQAXP0VY7Z9Uh_SwT7YtmNAAAAAGgTs_xyaXR3aWttaXNocmEwMw==",
      credential: "86c7cfec-26b4-11f0-af1e-0242ac140004",
      urls: [
        "turn:bn-turn2.xirsys.com:80?transport=udp",
        "turn:bn-turn2.xirsys.com:3478?transport=udp",
        "turn:bn-turn2.xirsys.com:80?transport=tcp",
        "turn:bn-turn2.xirsys.com:3478?transport=tcp",
        "turns:bn-turn2.xirsys.com:443?transport=tcp",
        "turns:bn-turn2.xirsys.com:5349?transport=tcp"
      ]
    }
  ]
};

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
    socket.emit('join');
  })
  .catch(error => {
    console.error("Error accessing media devices.", error);
  });

socket.on('match', ({ room, peer }) => {
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('ice-candidate', { to: peer, candidate: e.candidate });
    }
  };

  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  peerConnection.createOffer()
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => {
      socket.emit('offer', { to: peer, offer: peerConnection.localDescription });
    });
});

socket.on('offer', async ({ from, offer }) => {
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('ice-candidate', { to: from, candidate: e.candidate });
    }
  };

  peerConnection.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', { to: from, answer });
});

socket.on('answer', async ({ answer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async ({ candidate }) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error('Error adding received ICE candidate', e);
  }
});

function skip() {
  if (peerConnection) {
    peerConnection.close();
  }
  remoteVideo.srcObject = null;
  socket.emit('skip');
}
