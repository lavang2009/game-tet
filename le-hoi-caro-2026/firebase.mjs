import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { 
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getDocs,
  where
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { 
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

/* ================= FIREBASE CONFIG ================= */
const firebaseConfig = {
  apiKey: "AIzaSyD6n5xZCogdfnMSyumeh4gIcuCGAQGs_A4",
  authDomain: "le-hoi-caro.firebaseapp.com",
  projectId: "le-hoi-caro",
  storageBucket: "le-hoi-caro.firebasestorage.app",
  messagingSenderId: "455040796692",
  appId: "1:455040796692:web:bbab866003b039b5cfbf01",
  measurementId: "G-7F5XN9ZBN2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

/* ================= ĐĂNG KÝ ================= */
export const registerUser = async (email, password, username, phone = "") => {
  if (!email || !password || !username) {
    throw new Error("MISSING_FIELDS");
  }

  const uname = username.trim().toLowerCase();

  // 1️⃣ CHECK USERNAME TRÙNG
  const unameRef = doc(db, "usernames", uname);
  const unameSnap = await getDoc(unameRef);

  if (unameSnap.exists()) {
    throw new Error("USERNAME_EXISTS/ Tên đăng nhập đã tồn tại!");
  }

  // 2️⃣ TẠO AUTH
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // 3️⃣ LƯU USER
  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    username,
    username_lower: uname,
    phone,
    score: 0,
    high: 0,
    role: "USER",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 4️⃣ MAP USERNAME → UID (CHỐNG TRÙNG)
  await setDoc(unameRef, { uid });

  return cred.user;
};

/* ================= LOGIN CƠ BẢN (EMAIL) ================= */
export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

/* ================= LOGIN THÔNG MINH =================
   Email / Username / SĐT
======================================================= */
export const smartLogin = async (identity, password) => {

  // EMAIL
  if (identity.includes("@")) {
    return await signInWithEmailAndPassword(auth, identity, password);
  }

  const id = identity.trim().toLowerCase();

  // 1️⃣ TÌM QUA USERNAME MAP
  const unameSnap = await getDoc(doc(db, "usernames", id));
  if (unameSnap.exists()) {
    const uid = unameSnap.data().uid;
    const userSnap = await getDoc(doc(db, "users", uid));
    return await signInWithEmailAndPassword(
      auth,
      userSnap.data().email,
      password
    );
  }

  // 2️⃣ TÌM QUA SĐT
  const q = query(collection(db, "users"), where("phone", "==", identity));
  const snap = await getDocs(q);

  if (snap.empty) throw new Error("ACCOUNT_NOT_FOUND");

  return await signInWithEmailAndPassword(
    auth,
    snap.docs[0].data().email,
    password
  );
};
/* ================= LOGOUT ================= */
export const logoutUser = () => signOut(auth);

/* ================= AUTH STATE ================= */
export const onAuthReady = (callback) =>
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const snap = await getDoc(doc(db, "users", user.uid));
      callback({ auth: user, data: snap.exists() ? snap.data() : null });
    } else {
      callback(null);
    }
  });

/* ================= CẬP NHẬT ĐIỂM ================= */
export const updateUserScore = async (uid, newScore) => {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const currentHigh = snap.data()?.high || 0;

  await updateDoc(ref, {
    score: newScore,
    high: Math.max(newScore, currentHigh),
    updatedAt: serverTimestamp()
  });
};

/* ================= LEADERBOARD ================= */
export const listenLeaderboard = (callback) => {
  const q = query(
    collection(db, "users"),
    orderBy("score", "desc"),
    limit(20)
  );

  return onSnapshot(q, (snap) => {
    const users = [];
    snap.forEach((d) => users.push({ ...d.data(), uid: d.id }));
    callback(users);
  });
};
console.log("🔥 firebase.mjs READY — FULL EXPORTS OK");