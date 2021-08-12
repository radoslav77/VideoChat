import './style.css'
/*
document.querySelector('#app').innerHTML = `
  <h1>Hello Vite!</h1>
  <a href="https://vitejs.dev/guide/features.html" target="_blank">Documentation</a>
`
*/

import firebase  from 'firebase/app';
import 'firebase/firestore'

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBPBDq5h69bA6p4F1zbpD1b6BuxWsAQAV4",
  authDomain: "video-3d29a.firebaseapp.com",
  projectId: "video-3d29a",
  storageBucket: "video-3d29a.appspot.com",
  messagingSenderId: "494688305665",
  appId: "1:494688305665:web:2970aa77aa62d0efc3b600",
  measurementId: "G-5FQTKDT8KJ"
};

if(!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig)
}

const firestore = firebase.firestore()

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
}

//global state
let pc = new RTCPeerConnection(servers)
let localStream = null
let remoteStream = null

const webcamBtn = document.getElementById('webcamBtn')
const webcamVideo = document.getElementById('webcamVideo')
const callBtn = document.getElementById('callBtn')
const callInput = document.getElementById('callInput')
const answerBtn = document.getElementById('answerBtn')
const remoteVideo = document.getElementById('remoteVideo')
const hangupBtn = document.getElementById('hangupBtn')

// set media sources => local and remote 
webcamBtn.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true})
  remoteStream = new MediaStream()

  // Push track from local stream to peer connection
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream)
  })

  // Get (pull) tracks from remote stream, add to video stream
  pc.ontrack = event => {
    event.streams[0].getTracks().forEach(track =>{
      remoteStream.addTrack(track)
    })
  }

  // add the vide to the HTML
  webcamVideo.srcObject = localStream
  remoteVideo.srcObject = remoteStream

}

// call an offer - sending connectin pin
callBtn.onclick = async () => {
  // reference Firestore collection
  const callDoc = firestore.collection('calls').doc()
  const offerCandidates = callDoc.collection('offerCandidates')
  const answerCandidates = callDoc.collection('answerCandidates')

  callInput.value = callDoc.id

  // Get the candidates for caller, save to db
  pc.onicecandidate = event => {
    event.candidate && offerCandidates.add(event.candidate.toJSON())
  }

  const offerDescription = await pc.createOffer()
  await pc.setLocalDescription(offerDescription)

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  }

  await callDoc.set({ offer })

  callDoc.onSnapshot(snapshot => {
    const data = snapshot.data()
    if(!pc.currentRemoteDescription && data?.answer ) {
      const answerDescription = new RTCSessionDescription(data.answer)
      pc.setRemoteDescription(answerDescription) 
    }
  })

  // When answered, add candidate to peer connection
  answerCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if(change.type === 'added') {
         const candidate = new RTCIceCandidate(change.doc.data())
         pc.addIceCandidate(candidate)
      }
    })
  })

}

answerBtn.onclick = async () => {
  const callId = callInput.value
  const callDoc = firestore.collection('calls').doc(callId)
  const answerCandidates = callDoc.collection('answerCandidates')

  pc.onicecandidate = event => {
    event.candidate && answerCandidates.add(event.candidate.toJSON())

    const callData = (await callDoc.get()).data()

    const offerDescription = callData.offer
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription))

    const answerDescription = await pc.createAnswer()
    await pc.setLocalDescription(answerDescription)
    
    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    }

    await callDoc.update({ answer })

    offerCandidates.onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        console.log(change)
        if(change.type === 'added') {
          let data = change.doc.data()
          pc.addIceCandidate(new RTCIceCandidate(data))
        }
      })
    })

  }
}