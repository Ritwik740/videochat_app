const socket = io();
let peerConnection;
let localStream;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
  })
  .catch(error => {
    console.error('Error accessing media devices.', error);
  });

// Room creation logic
document.getElementById('createRoomButton').onclick = function () {
  socket.emit('create_room');
};

socket.on('room_created', data => {
  alert(`Room created! Room code: ${data.room_code}`);
  window.location.href = `/room/${data.room_code}`;  // Redirect to the room page
});

// Join a room when the user provides a room code
document.getElementById('joinRoomButton').onclick = function () {
  const roomCode = document.getElementById('roomCode').value;
  socket.emit('join_room', { room_code: roomCode });
};

socket.on('waiting_for_partner', data => {
  alert(`You are waiting for a partner in room: ${data.room_code}`);
});

socket.on('match', ({ room_code, peer }) => {
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('ice-candidate', { to: peer, candidate: e.candidate });
    }
  };

  peerConnection.ontrack = e => remoteVideo.srcObject = e.streams[0];

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

  peerConnection.ontrack = e => remoteVideo.srcObject = e.streams[0];

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

socket.on('skip_match', () => {
  alert('The other participant skipped the match!');
  window.location.reload(); // Reload the page to find a new partner
});

// Skip button logic to leave the current match
document.getElementById('skipButton').onclick = function () {
  const roomCode = document.getElementById('roomCode').value;
  socket.emit('skip', { room_code: roomCode });
};
