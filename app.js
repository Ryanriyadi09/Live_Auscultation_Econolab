// ==========================
// FIREBASE SETUP
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc,
  collection, addDoc, onSnapshot, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtBcx08j86yGohxoMdIFmze71bRpvNTDk",
  authDomain: "econolab-live-auscultation.firebaseapp.com",
  projectId: "econolab-live-auscultation"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const roomId = "LAB-001";
const roomRef = doc(db, "rooms", roomId);
const candidatesRef = collection(roomRef, "candidates");

// ==========================
// GLOBAL STATE
// ==========================
let pc = null;
let startTime = null;
let timerInterval = null;

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const statusEl = document.getElementById("status");
const timerEl = document.getElementById("timer");

// ==========================
// TIMER
// ==========================
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const sec = Math.floor((Date.now() - startTime) / 1000);
    timerEl.innerText = `Running time: ${sec} sec`;
  }, 1000);
}

// ==========================
// AUDIO PIPELINE (MEDICAL)
// ==========================
async function getProcessedAudioTrack() {
  const rawStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      googEchoCancellation: false,
      googNoiseSuppression: false,
      googAutoGainControl: false,
      googHighpassFilter: false
    }
  });

  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const source = audioCtx.createMediaStreamSource(rawStream);

  // BANDPASS (JANTUNG)
  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 80;
  bandpass.Q.value = 1;

  // GAIN (PREAMP)
  const gain = audioCtx.createGain();
  gain.gain.value = 3;

  // COMPRESSOR (RINGAN)
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -30;
  compressor.ratio.value = 2;

  source.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(compressor);

  const dest = audioCtx.createMediaStreamDestination();
  compressor.connect(dest);

  return dest.stream.getAudioTracks()[0];
}

// ==========================
// BUTTON: START (NAKES)
// ==========================
document.getElementById("start").onclick = async () => {
  statusEl.innerText = "Status: Waiting for doctor...";
  pc = new RTCPeerConnection(rtcConfig);

  const audioTrack = await getProcessedAudioTrack();
  pc.addTrack(audioTrack);

  pc.onicecandidate = e => {
    if (e.candidate) {
      addDoc(candidatesRef, e.candidate.toJSON());
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await setDoc(roomRef, {
    offer,
    createdAt: Date.now(),
    doctorJoined: false
  });

  onSnapshot(roomRef, snap => {
    const data = snap.data();
    if (data?.answer && !pc.currentRemoteDescription) {
      pc.setRemoteDescription(data.answer);
      statusEl.innerText = "Status: Connection successful";
      startTimer();
    }
  });
};

// ==========================
// BUTTON: JOIN (DOKTER)
// ==========================
document.getElementById("join").onclick = async () => {
  statusEl.innerText = "Status: Connecting...";
  pc = new RTCPeerConnection(rtcConfig);

  const audio = document.getElementById("audio");

  pc.ontrack = e => {
    audio.srcObject = e.streams[0];
  };

  pc.onicecandidate = e => {
    if (e.candidate) {
      addDoc(candidatesRef, e.candidate.toJSON());
    }
  };

  const snap = await getDoc(roomRef);
  if (!snap.exists()) {
    alert("Room belum dibuat");
    return;
  }

  await pc.setRemoteDescription(snap.data().offer);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await setDoc(roomRef, {
    answer,
    doctorJoined: true
  }, { merge: true });

  statusEl.innerText = "Status: Connection successful";
  startTimer();

  onSnapshot(candidatesRef, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(change.doc.data()).catch(() => {});
      }
    });
  });
};
