import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc,
  onSnapshot, collection, addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyCtBcx08j86yGohxoMdIFmze71bRpvNTDk",
  authDomain: "econolab-live-auscultation.firebaseapp.com",
  projectId: "econolab-live-auscultation",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const roomId = "LAB-001";
const roomRef = doc(db, "rooms", roomId);


document.getElementById("start").onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const pc = new RTCPeerConnection();

  stream.getTracks().forEach(t => pc.addTrack(t, stream));

  pc.onicecandidate = e => {
    if (e.candidate) {
      addDoc(collection(roomRef, "candidates"), e.candidate.toJSON());
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await setDoc(roomRef, { offer });
};


document.getElementById("join").onclick = async () => {
  const pc = new RTCPeerConnection();
  const audio = document.getElementById("audio");

  pc.ontrack = e => {
    audio.srcObject = e.streams[0];
  };

  const snap = await getDoc(roomRef);
  await pc.setRemoteDescription(snap.data().offer);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await setDoc(roomRef, { answer }, { merge: true });

  onSnapshot(collection(roomRef, "candidates"), snap => {
    snap.docChanges().forEach(c => {
      if (c.type === "added") {
        pc.addIceCandidate(c.doc.data());
      }
    });
  });
};


onSnapshot(roomRef, snap => {
  const data = snap.data();
  if (data?.answer) {
    pc.setRemoteDescription(data.answer);
  }
});


const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});


navigator.mediaDevices.enumerateDevices()
