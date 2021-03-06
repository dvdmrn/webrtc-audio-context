// Map All HTML Elements
const videoGrid = document.getElementById('video-grid');
const messagesEl = document.querySelector('.messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('message-button');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

const iceConfiguration = {}
iceConfiguration.iceServers = [
  {
    urls: [
      'stun:stun1.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun3.l.google.com:19302'
    ]
  },
  {
    urls: 'turn:132.206.74.208:3478',
    credential: 'ecAK8id7Rb6Q0qVJtZrsY+joKVM=',
    username: '1621283332'
  },
];

// //stun server
// iceConfiguration.iceServers.push({
//   urls: 'stun:stun1.l.google.com:19302'
// })
// iceConfiguration.iceServers.push({
//   urls: 'stun:stun3.l.google.com:19302'
// })

// iceConfiguration.iceServers.push({
//   urls: 'stun:stun4.l.google.com:19302'
// })

console.log("ice configuration set...", iceConfiguration)

const logMessage = (message) => {
  const newMessage = document.createElement('div');
  newMessage.innerText = message;
  messagesEl.appendChild(newMessage);
};




// Open Camera To Capture Audio and Video
// navigator.mediaDevices.getUserMedia({ video: true, audio: true })
//   .then(stream => {
//     // Show My Video
//     videoGrid.style.display = 'grid';
//     localVideo.srcObject = stream;

//     // Start a Peer Connection to Transmit Stream
//        initConnection(stream)
//   })
//   .catch(error => console.log(error));


const findSource = () => {
  let canvasSource = document.getElementById('canvas-viz');
  videoGrid.style.display = 'grid';
  console.log("local vid: ", localVideo)
  if (canvasSource) {
    console.log("found canvas!")
    console.log("canvas: ", canvasSource)
    navigator.mediaDevices.getUserMedia({
      audio: true
    }).then(audioStream => {
      let audioTracks = []
      audioStream.getAudioTracks().forEach(
        track => { 
          console.log("grabbing audio track: ",track);
          audioTracks.push(track)
        }
        )
        
        setupSource(canvasSource, audioTracks)
        
    })

  }
  else {
    console.log("searching for canvas...")
    setTimeout(findSource, 500);
  }
}



const setupSource = (canvasSource, audio) => {
  let mixedStream = new MediaStream([
    canvasSource.captureStream().getVideoTracks()[0],
    audio[0]
  ])
  console.log(mixedStream)
  // let stream = source.captureStream()
  localVideo.srcObject = canvasSource.captureStream();
  initConnection(mixedStream)
}

const initConnection = (stream) => {
  const socket = io('/');
  let localConnection;

  let remoteConnection;
  let localChannel;
  let remoteChannel;

  // Start a RTCPeerConnection to each client
  socket.on('other-users', (otherUsers) => {
    // Ignore when not exists other users connected
    if (!otherUsers || !otherUsers.length) return;

    const socketId = otherUsers[0];

    // Ininit peer connection
    localConnection = new RTCPeerConnection(iceConfiguration);

    // Add all tracks from stream to peer connection
    stream.getTracks().forEach(track => localConnection.addTrack(track, stream));

    // Send Candidtates to establish a channel communication to send stream and data
    localConnection.onicecandidate = ({ candidate }) => {
      candidate && socket.emit('candidate', socketId, candidate);
    };

    // Receive stream from remote client and add to remote video area
    localConnection.ontrack = ({ streams: [stream] }) => {
      remoteVideo.srcObject = stream;
    };

    // Start the channel to chat
    localChannel = localConnection.createDataChannel('chat_channel');

    // Function Called When Receive Message in Channel
    localChannel.onmessage = (event) => logMessage(`Receive: ${event.data}`);
    // Function Called When Channel is Opened
    localChannel.onopen = (event) => logMessage(`Channel Changed: ${event.type}`);
    // Function Called When Channel is Closed
    localChannel.onclose = (event) => logMessage(`Channel Changed: ${event.type}`);

    // Create Offer, Set Local Description and Send Offer to other users connected
    localConnection
      .createOffer()
      .then(offer => localConnection.setLocalDescription(offer))
      .then(() => {
        socket.emit('offer', socketId, localConnection.localDescription);
      });
  });

  // Receive Offer From Other Client
  socket.on('offer', (socketId, description) => {
    console.log("✨ received offer! ", description)
    // Ininit peer connection
    remoteConnection = new RTCPeerConnection(iceConfiguration);

    // Add all tracks from stream to peer connection
    stream.getTracks().forEach(track => remoteConnection.addTrack(track, stream));

    // Send Candidtates to establish a channel communication to send stream and data
    remoteConnection.onicecandidate = ({ candidate }) => {
      candidate && socket.emit('candidate', socketId, candidate);
    };

    // Receive stream from remote client and add to remote video area
    remoteConnection.ontrack = ({ streams: [stream] }) => {
      remoteVideo.srcObject = stream;
    };

    // Chanel Received
    remoteConnection.ondatachannel = ({ channel }) => {
      // Store Channel
      remoteChannel = channel;

      // Function Called When Receive Message in Channel
      remoteChannel.onmessage = (event) => logMessage(`Receive: ${event.data}`);
      // Function Called When Channel is Opened
      remoteChannel.onopen = (event) => logMessage(`Channel Changed: ${event.type}`);
      // Function Called When Channel is Closed
      remoteChannel.onclose = (event) => logMessage(`Channel Changed: ${event.type}`);
    }

    // Set Local And Remote description and create answer
    remoteConnection
      .setRemoteDescription(description)
      .then(() => remoteConnection.createAnswer())
      .then(answer => remoteConnection.setLocalDescription(answer))
      .then(() => {
        socket.emit('answer', socketId, remoteConnection.localDescription);
      });
  });

  // Receive Answer to establish peer connection
  socket.on('answer', (description) => {
    console.log("✨ received answer! ", description)
    localConnection.setRemoteDescription(description);
  });

  // Receive candidates and add to peer connection
  socket.on('candidate', (candidate) => {
    // GET Local or Remote Connection
    const conn = localConnection || remoteConnection;
    conn.addIceCandidate(new RTCIceCandidate(candidate));
  });

  // Map the 'message-button' click
  sendButton.addEventListener('click', () => {
    // GET message from input
    const message = messageInput.value;
    // Clean input
    messageInput.value = '';
    // Log Message Like Sended
    logMessage(`Send: ${message}`);

    // GET the channel (can be local or remote)
    const channel = localChannel || remoteChannel;
    // Send message. The other client will receive this message in 'onmessage' function from channel
    channel.send(message);
  });
}


findSource()