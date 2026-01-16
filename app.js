// ==========================
// FIREBASE IMPORT
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================
// FIREBASE CONFIG
// ==========================
const firebaseConfig = {
  apiKey: "AIzaSyCtBcx08j86yGohxoMdIFmze71bRpvNTDk",
  authDomain: "econolab-live-auscultation.firebaseapp.com",
  projectId: "econolab-live-auscultation",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================
// ROOM CONFIG
// ==========================
const roomId = "LAB-001"; // ganti sesuai ID pasien
const roomRef = doc(db, "rooms", roomId);

// ==========================
// GLOBAL WEBRTC
// ==========================
let pc = null;
let localStream = null;

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// ==========================
// BUTTON: START (NAKES)
// ==========================
document.getElementById("start").onclick = async () => {
  pc = new RTCPeerConnection(rtcConfig);

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = e => {
    if (e.candidate) {
      addDoc(collection(roomRef, "candidates"), e.candidate.toJSON());
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await setDoc(roomRef, { offer });
  console.log("Offer sent");
};

// ==========================
// BUTTON: JOIN (DOKTER)
// ==========================
document.getElementById("join").onclick = async () => {
  pc = new RTCPeerConnection(rtcConfig);

  const audio = document.getElementById("audio");
  audio.autoplay = true;

  pc.ontrack = e => {
    audio.srcObject = e.streams[0];
  };

  pc.onicecandidate = e => {
    if (e.candidate) {
      addDoc(collection(roomRef, "candidates"), e.candidate.toJSON());
    }
  };

  const snap = await getDoc(roomRef);
  if (!snap.exists()) {
    alert("Room belum dibuat oleh nakes");
    return;
  }

  await pc.setRemoteDescription(snap.data().offer);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await setDoc(roomRef, { answer }, { merge: true });
  console.log("Answer sent");
};

// ==========================
// LISTENER: ANSWER (NAKES)
// ==========================
onSnapshot(roomRef, snap => {
  const data = snap.data();
  if (data?.answer && pc && !pc.currentRemoteDescription) {
    pc.setRemoteDescription(data.answer);
    console.log("Answer received");
  }
});

// ==========================
// LISTENER: ICE CANDIDATE
// ==========================
onSnapshot(collection(roomRef, "candidates"), snap => {
  snap.docChanges().forEach(change => {
    if (change.type === "added" && pc) {
      pc.addIceCandidate(change.doc.data());
    }
  });
});

// ==========================
// DEBUG: LIST MIC DEVICES
// ==========================
navigator.mediaDevices.enumerateDevices().then(devices => {
  console.log("Audio devices:", devices);
});
