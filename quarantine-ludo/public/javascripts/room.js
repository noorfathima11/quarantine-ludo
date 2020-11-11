console.log(NAMESPACE);
var sc = io.connect("/" + NAMESPACE);

sc.on("message", function (data) {
  console.log(`${data}`);
});

var clientIs = {
  makingOffer: false,
  ignoringOffer: false,
  polite:false
}

var rtc_config = null;

//Setting basic to get peer connection
var pc = new RTCPeerConnection(rtc_config);


//video Streams
var media_constraints = {video: true, audio: false};

var selfVideo = document.querySelector('#self-video');
var selfStream = new MediaStream();
selfVideo.srcObject = selfStream;

var peerVideo = document.querySelector('#peer-video');
var peerStream = new MediaStream();
peerVideo.srcObject = peerStream;


async function startStream() {
  try{
    var stream = await navigator.mediaDevices.getUserMedia(media_constraints);
    for( var track of stream.getTracks()){
      pc.addTrack(track);
    }

    selfVideo.srcObject = stream;
  } catch(error){

  }
}


pc.ontrack = (track) => {
  peerStream.addTrack(track.track);
}

var callButton = document.querySelector('#call-button');

callButton.addEventListener('click', startCall);


function startCall(){
  console.log("Calling Side on the room");
  callButton.hidden = true;
  clientIs.polite = true;
  sc.emit('calling');
  startStream();
  negotiateConnection();
}

//handle calling event on the recevier side

sc.on('calling', () => {
  console.log("Receving Side on the room");
  negotiateConnection();
  callButton.innerText = "Answer Call";
  callButton.id = "answer-button";
  callButton.removeEventListener('click', startCall);
  callButton.addEventListener('click', ()=>{
    callButton.hidden = true;
    startStream();
    
  });
});


async function negotiateConnection() {
  pc.onnegotiationneeded = async function() {
    try {
      console.log("Making Offer");
      clientIs.makingOffer = true;
      await pc.setLocalDescription();
      sc.emit('signal', { description: pc.localDescription});

    } catch (error) {
      console.log(error);
    }finally{
      clientIs.makingOffer = false;
    }
  }
}

sc.on('signal', async function({candidate, description}){
  try {
    if(description){
      console.log("Received a description!!!");
      var OfferCollision = (description.type == 'offer')  && (clientIs.makingOffer  || pc.signalingState != 'stable');
      clientIs.ignoringOffer = !clientIs.polite && OfferCollision;
      if(clientIs.ignoringOffer){
        return;
      }

      // Set the remote decription
      await pc.setRemoteDescription(description);

      //if it's offer you need to answer
      if(description.type == 'offer'){
        console.log("Offer description");
        await pc.setLocalDescription();
        sc.emit('signal', {description: pc.localDescription});
      }

    }else if(candidate){
      console.log('Received a candidate:');
      console.log(candidate);
      //safari fix for the blank candidate
      if(candidate.candidate > 1){
        await pc.addIceCandidate(candidate);
      }
      
    }
  } catch (error) {
    console.log(error);
  }
});

//logic to send candidate
pc.onicecandidate = function({candidate}){
  sc.emit('signal', {candidate: candidate});
}