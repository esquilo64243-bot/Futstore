import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDaX8q8oi79CfjB5zf4R92LomOxtU4q2Qc",
  authDomain: "futstore-7aaed.firebaseapp.com",
  projectId: "futstore-7aaed",
  storageBucket: "futstore-7aaed.firebasestorage.app",
  messagingSenderId: "722687951061",
  appId: "1:722687951061:web:b16fa728bf771f204f625c",
};

const ADMIN_EMAIL = "esquilo64243@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let isAdmin = false;
let products = [];
let editingId = null;
let currentCat = "todos";
let currentSearch = "";

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    isAdmin = user.email === ADMIN_EMAIL;
    showApp();
    await loadProducts();
  } else {
    isAdmin = false;
    showLogin();
  }
});

window.loginGoogle = async () => {
  setLoginError("");
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    setLoginError("Erro ao entrar com Google: " + e.message);
  }
};

window.loginEmail = async () => {
  setLoginError("");
  const email = document.getElementById("lEmail").value.trim();
  const pass = document.getElementById("lPass").value;
  if (!email || !pass) {
    setLoginError("Preencha email e senha.");
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    const msgs = {
      "auth/user-not-found": "Usuário não encontrado.",
      "auth/wrong-password": "Senha incorreta.",
      "auth/invalid-email": "Email inválido.",
      "auth/invalid-credential": "Email ou senha incorretos.",
    };
    setLoginError(msgs[e.code] || "Erro: " + e.message);
  }
};

window.logout = async () => {
  await signOut(auth);
};
function setLoginError(msg) {
  document.getElementById("loginError").textContent = msg;
}

async function loadProducts() {
  try {
    const snap = await getDocs(collection(db, "products"));
    products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    products = JSON.parse(localStorage.getItem("futstore_products") || "[]");
    notify("⚠️ Modo offline — dados locais", 5000);
  }
  render();
}

window.saveProduct = async () => {
  const titulo = document.getElementById("fTitulo").value.trim();
  const preco = parseFloat(document.getElementById("fPreco").value);
  const link = document.getElementById("fLink").value.trim();
  if (!titulo) {
    alert("Informe o título.");
    return;
  }
  if (isNaN(preco) || preco <= 0) {
    alert("Preço inválido.");
    return;
  }
  if (!link) {
    alert("Informe o link do Mercado Pago.");
    return;
  }
  const data = {
    titulo,
    preco,
    link,
    desc: document.getElementById("fDesc").value.trim(),
    cat: document.getElementById("fCat").value,
    img: document.getElementById("fImg").value.trim(),
    badge: document.getElementById("fBadge").value.trim().toUpperCase(),
  };
  try {
    if (editingId) {
      await updateDoc(doc(db, "products", editingId), data);
      notify("✅ Produto atualizado!");
    } else {
      await addDoc(collection(db, "products"), data);
      notify("✅ Produto adicionado!");
    }
  } catch (e) {
    if (editingId) {
      const i = products.findIndex((p) => p.id === editingId);
      products[i] = { ...products[i], ...data };
    } else {
      products.unshift({ id: "local_" + Date.now(), ...data });
    }
    localStorage.setItem("futstore_products", JSON.stringify(products));
    notify("✅ Salvo localmente!");
  }
  closeModal();
  await loadProducts();
};

window.deleteProduct = async (id) => {
  console.log("Tentando excluir produto ID:", id);

  if (!id || id === "undefined") {
    alert("Esse produto não tem ID.");
    return;
  }

  if (!confirm("Excluir este produto?")) return;

  try {
    await deleteDoc(doc(db, "products", id));

    products = products.filter((p) => p.id !== id);
    render();

    notify("🗑️ Produto excluído.");
    console.log("Produto excluído com sucesso:", id);
  } catch (e) {
    console.error("Erro ao excluir no Firebase:", e);
    alert("Erro ao excluir: " + e.message);
  }
};

window.editProduct = (id) => openModal(id);

function showLogin() {
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("appScreen").style.display = "none";
}
function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appScreen").style.display = "block";
  document.getElementById("userEmail").textContent = currentUser.email;
  document.getElementById("userBadge").textContent = isAdmin
    ? "👑 ADMIN"
    : "🛒 CLIENTE";
  document.getElementById("userBadge").className =
    "role-badge " + (isAdmin ? "admin" : "cliente");
  document.getElementById("adminBar").style.display = isAdmin ? "flex" : "none";
}

window.render = function () {
  const grid = document.getElementById("grid");
  let list = [...products];
  if (currentCat !== "todos") list = list.filter((p) => p.cat === currentCat);
  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase();
    list = list.filter(
      (p) =>
        p.titulo.toLowerCase().includes(q) ||
        (p.desc || "").toLowerCase().includes(q),
    );
  }
  document.getElementById("countLabel").textContent =
    list.length + " produto" + (list.length !== 1 ? "s" : "");
  if (!list.length) {
    grid.innerHTML = `<div class="empty"><span class="big">⚽</span><h3>Nenhuma camiseta encontrada</h3><p>Tente outro filtro ou adicione produtos.</p></div>`;
    return;
  }
  grid.innerHTML = list
    .map(
      (p) => `
    <div class="card">
      ${p.img ? `<img class="card-img" src="${esc(p.img)}" alt="${esc(p.titulo)}" onerror="this.style.display='none'">` : `<div class="card-img-placeholder">👕</div>`}
      ${p.badge ? `<span class="card-badge">${esc(p.badge)}</span>` : ""}
      ${
        isAdmin
          ? `<div class="card-actions-admin">
        <button class="btn-icon" onclick="editProduct('${p.id}')">✏️</button>
        <button class="btn-icon del" onclick="deleteProduct('${p.id}')">🗑️</button>
      </div>`
          : ""
      }
      <div class="card-body">
        <div class="card-title">${esc(p.titulo)}</div>
        <div class="card-desc">${esc(p.desc) || "Sem descrição."}</div>
        <div class="card-footer">
          <span class="card-price">R$ ${formatPrice(p.preco)}</span>
          <button class="btn-buy" onclick="comprarProduto('${p.id}')">🛒 COMPRAR</button>
        </div>
      </div>
    </div>`,
    )
    .join("");
};

window.openModal = function (id) {
  editingId = id || null;
  document.getElementById("modalTitle").textContent = id
    ? "Editar Produto"
    : "Novo Produto";
  if (id) {
    const p = products.find((x) => x.id === id);

    if (!p) {
      alert("Produto não encontrado.");
      return;
    }
    document.getElementById("fTitulo").value = p.titulo;
    document.getElementById("fDesc").value = p.desc;
    document.getElementById("fPreco").value = p.preco;
    document.getElementById("fCat").value = p.cat;
    document.getElementById("fImg").value = p.img;
    document.getElementById("fLink").value = p.link;
    document.getElementById("fBadge").value = p.badge || "";
    previewImg(p.img);
  } else {
    ["fTitulo", "fDesc", "fPreco", "fImg", "fLink", "fBadge"].forEach(
      (i) => (document.getElementById(i).value = ""),
    );
    document.getElementById("fCat").value = "nacional";
    document.getElementById("imgPreview").innerHTML = "<span>Sem imagem</span>";
  }
  document.getElementById("overlay").classList.add("active");
};

window.closeModal = () =>
  document.getElementById("overlay").classList.remove("active");
window.closeModalOutside = (e) => {
  if (e.target === document.getElementById("overlay")) closeModal();
};
window.previewImg = (url) => {
  document.getElementById("imgPreview").innerHTML =
    url && url.startsWith("http")
      ? `<img src="${url}" alt="preview">`
      : "<span>Sem imagem</span>";
};
window.filterCat = (cat, btn) => {
  currentCat = cat;
  document
    .querySelectorAll(".filter-chip")
    .forEach((el) => el.classList.remove("active"));
  btn.classList.add("active");
  render();
};
window.searchProducts = (q) => {
  currentSearch = q;
  render();
};

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function formatPrice(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}
function notify(msg, dur = 3000) {
  const el = document.getElementById("notif");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), dur);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("lPass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginEmail();
  });
});

let produtoAtual = null;

window.comprarProduto = function (id) {
  const produto = products.find((p) => p.id === id);

  if (!produto) {
    alert("Produto não encontrado.");
    return;
  }

  produtoAtual = produto;

  document.getElementById("produtoSelecionado").innerText =
    `${produto.titulo} - R$ ${formatPrice(produto.preco)}`;

  document.getElementById("modalPedido").style.display = "flex";
};

window.fecharModalPedido = function () {
  document.getElementById("modalPedido").style.display = "none";
};

window.confirmarPedido = async function () {
  const whatsapp = document.getElementById("clienteWhatsapp").value.trim();
  const tamanho = document.getElementById("clienteTamanho").value;
  const endereco = document.getElementById("clienteEndereco").value.trim();

  if (!whatsapp || !tamanho || !endereco) {
    alert("Preencha WhatsApp, tamanho e endereço antes de continuar.");
    return;
  }

  try {
    await emailjs.send("service_332mlam", "template_d2fvf3k", {
      nome: currentUser?.displayName || "Cliente não informado",
      email: currentUser?.email || "Email não informado",
      telefone: whatsapp,
      produto: produtoAtual.titulo,
      preco: `R$ ${formatPrice(produtoAtual.preco)}`,
      tamanho: tamanho,
      endereco: endereco,
      mensagem: `Cliente pediu: ${produtoAtual.titulo}`,
    });

    notify("📧 Pedido enviado! Abrindo pagamento...");
  } catch (error) {
    console.error("Erro EmailJS:", error);
    notify("⚠️ Não consegui enviar o email, mas vou abrir o pagamento.");
  }

  fecharModalPedido();
  window.open(produtoAtual.link, "_blank");
};
