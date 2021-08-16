import './style.css'

import firebase from 'firebase/app'
import 'firebase/ firestore'


// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB0lDvhcNauBDLa-EC6poy1gC4X8981Um4",
  authDomain: "chat-208d1.firebaseapp.com",
  projectId: "chat-208d1",
  storageBucket: "chat-208d1.appspot.com",
  messagingSenderId: "904278834088",
  appId: "1:904278834088:web:6676a8d7733735c2157b9d",
  measurementId: "G-2SCEZQCV9R"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig)
}

const servers = {
  iceServers: [
    {
    urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
  },
],
icdCandidatePoolSize: 10,
}


// Global state
let pc = new RTCPeerConnection(servers)
let localStream = null
let remoteStream = null
 
// HTML elements
const webcamButton = document.getElementById('webcamButton')
const webcamVideo = document.getElementById('webcamVideo')
const callButton = document.getElementById('callButton')
const callInput = document.getElementById('callInput')
const answerButton = document.getElementById('answerButton')
const remoteVideo = document.getElementById('remoteVideo')
const hangupButton = document.getElementById('hangupButton')


// First set up madia sources
webcamButton.onclick = async () => {
   localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true})
   remoteStream = new MediaStream()
  // push tracks from local streem to peer connection
   localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream)
   })
   // get tracks from remote stream and add it to video
   pc.ontrack = event => {
     event.streams[0].getTracks().forEach(track => {
       remoteStream.addTrack(track )
     })
   }
   webcamVideo.srcObject = localStream
   remoteVideo.srcObject = remoteStream
}

// Second create an offer
callButton.onclick = async () => {
  //reference Firestore collection
  const callDoc = firestore.collection('calls').doc()
  const offerCandidates = callDoc.collection('offerCandidates')
  const answerCandidates = callDoc.collection('answerCandidates')
  
  callInput.value = callDoc.id 

// get candidates for caller , save to db
pc.onicecandidate = event => {
  event.candidate && offerCandidates.addTrack(event.candidate.toJSON())

}


  //create offer

  const offerDescription = await pc.createOffer()
  await pc.setLocalDescription(offerDescription )

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  }

  await callDoc.set ({ offer })
//listen for remote answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data()
    if(!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer)
      pc.setRemoteDescription(answerDescription)
    }
  })
  // When answered, add candidates to peer connection
  answerCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data())
        pc.addIceCandidate(candidate)
      }
    })
  })

}

// thirt answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value
  const callDoc = firestore.collection('calls').doc(callId)
  const answerCandidates = callDoc.collection('answerCandidates')

  pc.onicecandidate = event => {
    event.candidate && answerCandidates.addTrack(event.candidate.toJSON())

  }
  const callData = (await callDoc.getElementById()).data()
  const offerDescription = callData.offer
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription))

  const answerDescription = await pc.createAnswer()
  await pc.setLocalDescription(answerDescription)

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  }

  await callDoc.update({ answer })

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change)
      if (change.type === 'added') {
        let data = change.doc.data()
        pc.addIceCandidate(new RTCIceCandidate(data))
      }
    })
  })


}

/*
document.querySelector('#app').innerHTML = `
  <h1>Hello Vite!</h1>
  <a href="https://vitejs.dev/guide/features.html" target="_blank">Documentation</a>
`*/
