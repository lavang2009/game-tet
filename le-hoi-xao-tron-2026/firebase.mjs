// firebase.mjs — FINAL STABLE VERSION (MATCH he.html)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

/* ================= FIREBASE CONFIG ================= */
const firebaseConfig = {
  apiKey: "AIzaSyBV-rwEihSlcD8Bngtfxz0sEIlhU3gr8AM",
  authDomain: "le-hoi-xao-tron-2026.firebaseapp.com",
  projectId: "le-hoi-xao-tron-2026",
  storageBucket: "le-hoi-xao-tron-2026.appspot.com",
  messagingSenderId: "856717527178",
  appId: "1:856717527178:web:61c4376fec6b3a82164573"
};

/* ================= INIT ================= */
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

/* ================= AUTH PERSISTENCE ================= */
export async function initAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    console.log("✅ Auth persistence OK");
  } catch (e) {
    console.warn("⚠️ Persistence fallback", e);
  }
}

/* ================= REGISTER ================= */
export async function registerUser(email, password, username, phone = "") {
  if (!email || !password || !username) {
    throw new Error("Thiếu thông tin đăng ký");
  }

  const uname = username.trim().toLowerCase();
  const phoneClean = phone.replace(/\s+/g, "");

  // check username
  if ((await getDoc(doc(db, "usernames", uname))).exists()) {
    throw new Error("Username đã tồn tại");
  }

  // check phone
  if (phoneClean) {
    if ((await getDoc(doc(db, "phones", phoneClean))).exists()) {
      throw new Error("Số điện thoại đã tồn tại");
    }
  }

  const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const uid = res.user.uid;

  await setDoc(doc(db, "usernames", uname), { uid });

  if (phoneClean) {
    await setDoc(doc(db, "phones", phoneClean), { uid });
  }

  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    username,
    usernameLower: uname,
    phone: phoneClean || null,
    score: 0,
    high: 0,
    buff: 0,
    role: "USER",
    banned: false,
    createdAt: serverTimestamp()
  });

  return res.user;
}

/* ================= LOGIN ================= */
export async function loginUser(email, password) {
  return (await signInWithEmailAndPassword(auth, email.trim(), password)).user;
}

export async function loginByUsername(username, password) {
  const uname = username.trim().toLowerCase();
  const snap = await getDoc(doc(db, "usernames", uname));
  if (!snap.exists()) throw new Error("Username không tồn tại");

  const uid = snap.data().uid;
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) throw new Error("User lỗi dữ liệu");

  return loginUser(userSnap.data().email, password);
}

export async function loginByPhone(phone, password) {
  const p = phone.replace(/\s+/g, "");
  const snap = await getDoc(doc(db, "phones", p));
  if (!snap.exists()) throw new Error("SĐT không tồn tại");

  const uid = snap.data().uid;
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) throw new Error("User lỗi dữ liệu");

  return loginUser(userSnap.data().email, password);
}

/* 🔥 SMART LOGIN: email / username / phone */
export async function smartLogin(input, password) {
  input = input.trim();

  if (input.includes("@")) {
    return loginUser(input, password);
  }

  if (/^\d{9,15}$/.test(input)) {
    return loginByPhone(input, password);
  }

  return loginByUsername(input, password);
}
/* ================= ADMIN / QUERY ================= */
export async function getUserByUsername(username) {
  if (!username) return null;

  const uname = username.trim().toLowerCase();

  // tìm trong collection usernames
  const nameSnap = await getDoc(doc(db, "usernames", uname));
  if (!nameSnap.exists()) return null;

  const { uid } = nameSnap.data();
  if (!uid) return null;

  // lấy dữ liệu user
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) return null;

  return userSnap.data();
}
/* ================= ADMIN ================= */
export async function setBanByUsername(username, banned = true) {
  if (!username) throw new Error("Thiếu username");

  const uname = username.trim().toLowerCase();

  // tìm uid từ usernames
  const nameSnap = await getDoc(doc(db, "usernames", uname));
  if (!nameSnap.exists()) {
    throw new Error("Username không tồn tại");
  }

  const { uid } = nameSnap.data();

  // cập nhật user
  await updateDoc(doc(db, "users", uid), {
    banned: !!banned,
    canPlay: !banned,
    status: banned ? "BANNED" : "ACTIVE",
    updatedAt: serverTimestamp()
  });

  return true;
}
export async function setRoleByUsername(username, role = "USER") {
  if (!username) throw new Error("Thiếu username");

  const uname = username.trim().toLowerCase();
  const roleUpper = role.toUpperCase();

  // chỉ cho phép role hợp lệ
  const ALLOWED = ["USER", "ADMIN", "MOD"];
  if (!ALLOWED.includes(roleUpper)) {
    throw new Error("Role không hợp lệ");
  }

  // tìm uid từ usernames
  const nameSnap = await getDoc(doc(db, "usernames", uname));
  if (!nameSnap.exists()) {
    throw new Error("Username không tồn tại");
  }

  const { uid } = nameSnap.data();

  // cập nhật role
  await updateDoc(doc(db, "users", uid), {
    role: roleUpper,
    updatedAt: serverTimestamp()
  });

  return true;
}
export async function updateUserField(uid, data = {}) {
  if (!uid) throw new Error("Thiếu UID");
  if (typeof data !== "object") throw new Error("Data không hợp lệ");

  await updateDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: serverTimestamp()
  });

  return true;
}
/* ================= USER DATA ================= */
export async function getUserData(uid) {
  if (!uid) return null;

  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;

  return snap.data();
}
/* ================= AUTH LISTENER ================= */
export function onAuthReady(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }

    const snap = await getDoc(doc(db, "users", user.uid));
    callback({
      auth: user,
      data: snap.exists() ? snap.data() : null
    });
  });
}

/* alias – để he.html dùng listenAuth */
export const listenAuth = onAuthReady;

/* ================= OTHER EXPORTS (he.html cần) ================= */
export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => d.data());
}

export async function logoutUser() {
  await signOut(auth);
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

console.log("🔥 firebase.mjs READY — FULL EXPORTS OK");
