
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";

import {
  getDatabase, ref, push, query, limitToLast,
  onChildAdded, serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

import {
  getAuth, signInAnonymously, onAuthStateChanged
} from
  "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  getStorage, ref as fileRef, uploadBytes, getDownloadURL
} from
  "https://www.gstatic.com/firebasejs/12.5.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);
const $ = id => document.getElementById(id);

let user = null;
let joined = false;
let chosenPhoto = null;
let stopMessages = null;
const seen = new Set();

onAuthStateChanged(auth, currentUser => {
  user = currentUser;
  $("status").textContent = user ? "Ready to chat" : "Connecting...";
});

signInAnonymously(auth).catch(error => {
  $("joinError").textContent = error.message;
});

$("joinBtn").onclick = () => {
  const name = $("nameInput").value.trim();

  if (!name) {
    $("joinError").textContent = "Enter your name.";
    return;
  }

  if (!user) {
    $("joinError").textContent = "Please wait for connection.";
    return;
  }

  localStorage.setItem("pharasiName", name);
  joined = true;
  $("joinScreen").classList.add("hidden");
  $("chatScreen").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");

  startMessages();
};

$("nameInput").value = localStorage.getItem("pharasiName") || "";

function startMessages() {
  if (stopMessages) stopMessages();

  seen.clear();
  $("messages").replaceChildren();

  const q = query(ref(db, "pharasi/messages"), limitToLast(100));

  stopMessages = onChildAdded(q, snapshot => {
    if (seen.has(snapshot.key)) return;
    seen.add(snapshot.key);
    showMessage(snapshot.val());
  }, error => {
    $("chatError").textContent = error.message;
  });
}

function showMessage(data) {
  const box = document.createElement("div");
  box.className = "bubble";

  if (data.uid === user?.uid) box.classList.add("mine");

  const sender = document.createElement("div");
  sender.className = "sender";
  sender.textContent = data.name || "Member";
  box.appendChild(sender);

  if (data.text) {
    const text = document.createElement("div");
    text.textContent = data.text;
    box.appendChild(text);
  }

  if (data.imageUrl) {
    const img = document.createElement("img");
    img.className = "chat-image";
    img.src = data.imageUrl;
    img.alt = "Group photo";
    img.loading = "lazy";
    img.onclick = () => window.open(img.src, "_blank", "noopener,noreferrer");
    box.appendChild(img);
  }

  const time = document.createElement("div");
  time.className = "time";
  time.textContent = data.createdAt
    ? new Date(data.createdAt).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit"
      })
    : "Sending...";
  box.appendChild(time);

  $("messages").appendChild(box);
  $("messages").scrollTop = $("messages").scrollHeight;
}

$("photoInput").onchange = () => {
  const file = $("photoInput").files[0];
  if (!file) return;

  if (!file.type.startsWith("image/") ||
      file.size > 5 * 1024 * 1024) {
    $("chatError").textContent = "Choose an image under 5 MB.";
    $("photoInput").value = "";
    return;
  }

  chosenPhoto = file;
  $("previewImage").src = URL.createObjectURL(file);
  $("preview").classList.remove("hidden");
  $("chatError").textContent = "";
};

$("cancelPhoto").onclick = () => {
  chosenPhoto = null;
  $("photoInput").value = "";
  $("previewImage").removeAttribute("src");
  $("preview").classList.add("hidden");
};

$("chatForm").onsubmit = async event => {
  event.preventDefault();

  if (!joined || !user) return;

  const text = $("messageInput").value.trim();
  if (!text && !chosenPhoto) return;

  $("sendBtn").disabled = true;

  try {
    let imageUrl = "";

    if (chosenPhoto) {
      const file = chosenPhoto;
      const path = `pharasi/${user.uid}/${crypto.randomUUID()}`;
      const uploadRef = fileRef(storage, path);

      await uploadBytes(uploadRef, file);
      imageUrl = await getDownloadURL(uploadRef);
    }

    await push(ref(db, "pharasi/messages"), {
      uid: user.uid,
      name: localStorage.getItem("pharasiName") || "Member",
      text,
      imageUrl,
      createdAt: serverTimestamp()
    });

    $("messageInput").value = "";
    chosenPhoto = null;
    $("photoInput").value = "";
    $("previewImage").removeAttribute("src");
    $("preview").classList.add("hidden");
    $("chatError").textContent = "";

  } catch (error) {
    $("chatError").textContent = "Send failed: " + error.message;
  } finally {
    $("sendBtn").disabled = false;
  }
};

$("logoutBtn").onclick = () => {
  joined = false;

  if (stopMessages) stopMessages();
  stopMessages = null;

  $("chatScreen").classList.add("hidden");
  $("joinScreen").classList.remove("hidden");
  $("logoutBtn").classList.add("hidden");
  $("messages").replaceChildren();
};
