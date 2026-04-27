// ======================================
// GitHub Manager Premium FINAL REBUILD
// app.js PART 3A
// LOGIN + CORE + REPO
// ======================================

const API = "https://api.github.com";

let token = localStorage.getItem("gh_token") || "";
let currentUser = null;
let repos = [];

let currentRepo = "";
let currentBranch = "main";
let currentPath = "";
let currentFile = "";
let currentSha = "";

let selectedFiles = [];
let editor = null;

// ======================================
// INIT
// ======================================
window.addEventListener("DOMContentLoaded", async () => {
  initEditor();
  bindGlobal();

  if (token) {
    await loginGitHub(true);
  }
});

// ======================================
// EDITOR INIT
// ======================================
function initEditor() {
  if (!window.ace) return;

  editor = ace.edit("aceEditor");
  editor.setTheme("ace/theme/github_dark");

  editor.session.setMode("ace/mode/html");

  editor.setOptions({
    fontSize: "15px",
    wrap: true,
    enableBasicAutocompletion: true,
    enableLiveAutocompletion: true,
    enableSnippets: true
  });
}

// ======================================
// GLOBAL EVENTS
// ======================================
function bindGlobal() {
  const fileUpload = document.getElementById("fileUpload");
  const folderUpload = document.getElementById("folderUpload");

  if (fileUpload) fileUpload.addEventListener("change", uploadFiles);
  if (folderUpload) folderUpload.addEventListener("change", uploadFolder);
}

// ======================================
// UTILITIES
// ======================================
function headers() {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json"
  };
}

function showLoading(state = true) {
  const el = document.getElementById("loadingOverlay");
  if (!el) return;
  el.classList.toggle("hidden", !state);
}

function toast(message = "") {
  const wrap = document.getElementById("toastWrap");
  if (!wrap) return alert(message);

  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = message;

  wrap.appendChild(div);

  setTimeout(() => {
    div.remove();
  }, 3200);
}

function safeEncode(text = "") {
  return btoa(unescape(encodeURIComponent(text)));
}

function safeDecode(text = "") {
  return decodeURIComponent(escape(atob(text)));
}

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ======================================
// LOGIN
// ======================================
async function loginGitHub(auto = false) {
  try {
    if (!auto) {
      token = document.getElementById("tokenInput").value.trim();
    }

    if (!token) {
      toast("Masukkan token GitHub.");
      return;
    }

    showLoading(true);

    const res = await fetch(`${API}/user`, {
      headers: headers()
    });

    if (!res.ok) {
      throw new Error("Token tidak valid / scope kurang.");
    }

    currentUser = await res.json();

    localStorage.setItem("gh_token", token);

    fillProfile();

    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("appPage").classList.remove("hidden");

    await loadRepos();

    toast("Login berhasil.");

  } catch (err) {
    localStorage.removeItem("gh_token");
    toast(err.message || "Login gagal.");
  } finally {
    showLoading(false);
  }
}

function logoutGitHub() {
  localStorage.removeItem("gh_token");
  location.reload();
}

function fillProfile() {
  document.getElementById("userAvatar").src =
    currentUser.avatar_url || "";

  document.getElementById("userName").textContent =
    currentUser.name || currentUser.login;

  document.getElementById("userLogin").textContent =
    "@" + currentUser.login;
}

// ======================================
// NAVIGATION
// ======================================
function showPage(id, btn = null) {
  document.querySelectorAll(".content")
    .forEach(el => el.classList.remove("active-page"));

  const page = document.getElementById(id);
  if (page) page.classList.add("active-page");

  document.querySelectorAll(".menu-btn")
    .forEach(el => el.classList.remove("active"));

  if (btn) btn.classList.add("active");

  const title = id.charAt(0).toUpperCase() + id.slice(1);
  document.getElementById("pageTitle").textContent = title;

  document.getElementById("sidebar")
    .classList.remove("show");
}

function toggleSidebar() {
  document.getElementById("sidebar")
    .classList.toggle("show");
}

// ======================================
// REPOSITORY LOAD
// ======================================
async function loadRepos() {
  try {
    showLoading(true);

    const res = await fetch(
      `${API}/user/repos?per_page=100&sort=updated`,
      { headers: headers() }
    );

    if (!res.ok) throw new Error();

    repos = await res.json();

    renderRepos(repos);
    fillRepoSelectors();
    updateStats();

  } catch {
    toast("Gagal memuat repository.");
  } finally {
    showLoading(false);
  }
}

function renderRepos(list = []) {
  const box = document.getElementById("repoList");
  if (!box) return;

  if (!list.length) {
    box.innerHTML = `<div class="item"><div class="item-left"><h4>Tidak ada repository</h4></div></div>`;
    return;
  }

  box.innerHTML = list.map(repo => `
    <div class="item">

      <div class="item-left">
        <h4>${escapeHtml(repo.name)}</h4>
        <p>
          ${repo.private ? "Private" : "Public"} •
          ${escapeHtml(repo.default_branch)}
        </p>
      </div>

      <div class="item-right">

        <button class="btn"
          onclick="openRepo('${repo.name}','${repo.default_branch}')">
          Open
        </button>

        <button class="btn danger"
          onclick="deleteRepo('${repo.name}')">
          Delete
        </button>

      </div>

    </div>
  `).join("");
}

function updateStats() {
  document.getElementById("totalRepo").textContent =
    repos.length;

  document.getElementById("publicRepo").textContent =
    repos.filter(r => !r.private).length;

  document.getElementById("privateRepo").textContent =
    repos.filter(r => r.private).length;
}

function fillRepoSelectors() {
  const html = repos.map(repo =>
    `<option value="${repo.name}">${repo.name}</option>`
  ).join("");

  const ids = ["repoSelector", "pagesRepo"];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });

  if (repos.length) {
    currentRepo = repos[0].name;
  }
}

// ======================================
// SEARCH REPO
// ======================================
function filterRepos(keyword = "") {
  keyword = keyword.toLowerCase().trim();

  if (!keyword) {
    renderRepos(repos);
    return;
  }

  const filtered = repos.filter(repo =>
    repo.name.toLowerCase().includes(keyword)
  );

  renderRepos(filtered);
}

// ======================================
// CREATE REPO
// ======================================
async function createRepo() {
  try {
    const name =
      document.getElementById("newRepoName").value.trim();

    const isPrivate =
      document.getElementById("repoVisibility").value === "true";

    if (!name) {
      toast("Nama repository kosong.");
      return;
    }

    showLoading(true);

    const res = await fetch(`${API}/user/repos`, {
      method: "POST",
      headers: {
        ...headers(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        private: isPrivate,
        auto_init: true
      })
    });

    if (!res.ok) {
      throw new Error("Gagal membuat repository.");
    }

    document.getElementById("newRepoName").value = "";

    toast("Repository berhasil dibuat.");

    await loadRepos();

  } catch (err) {
    toast(err.message || "Create repo gagal.");
  } finally {
    showLoading(false);
  }
}

// ======================================
// DELETE REPO
// ======================================
async function deleteRepo(name = "") {
  const verify = prompt(`Ketik nama repo:\n${name}`);

  if (verify !== name) {
    toast("Konfirmasi dibatalkan.");
    return;
  }

  try {
    showLoading(true);

    const res = await fetch(
      `${API}/repos/${currentUser.login}/${name}`,
      {
        method: "DELETE",
        headers: headers()
      }
    );

    if (![204, 200].includes(res.status)) {
      throw new Error("Gagal hapus repository.");
    }

    toast("Repository dihapus.");

    await loadRepos();

  } catch (err) {
    toast(err.message || "Delete gagal.");
  } finally {
    showLoading(false);
  }
}

// ======================================
// OPEN REPO
// ======================================
function openRepo(name, branch = "main") {
  currentRepo = name;
  currentBranch = branch;
  currentPath = "";

  const selector = document.getElementById("repoSelector");
  if (selector) selector.value = name;

  showPage("files");

  repoChanged();
}

// ======================================
// BRANCHES
// ======================================
async function repoChanged() {
  if (!currentRepo) return;

  try {
    showLoading(true);

    const res = await fetch(
      `${API}/repos/${currentUser.login}/${currentRepo}/branches`,
      { headers: headers() }
    );

    if (!res.ok) throw new Error();

    const branches = await res.json();

    const select = document.getElementById("branchSelector");

    select.innerHTML = branches.map(branch => `
      <option value="${branch.name}">
        ${branch.name}
      </option>
    `).join("");

    currentBranch = branches[0]?.name || "main";
    select.value = currentBranch;

    if (typeof loadFiles === "function") {
      loadFiles("");
    }

  } catch {
    toast("Gagal load branch.");
  } finally {
    showLoading(false);
  }
}

function branchChanged() {
  const select = document.getElementById("branchSelector");
  currentBranch = select.value || "main";

  if (typeof loadFiles === "function") {
    loadFiles("");
  }
}

// ======================================
// GitHub Manager Premium FINAL REBUILD
// app.js PART 3B
// FILES + EDITOR + UPLOAD + RENAME
// ======================================

// ======================================
// FILE EXPLORER
// ======================================
async function loadFiles(path = "") {
  try {
    currentPath = path;
    selectedFiles = [];

    showLoading(true);

    const url =
      `${API}/repos/${currentUser.login}/${currentRepo}` +
      `/contents/${path}?ref=${currentBranch}`;

    const res = await fetch(url, {
      headers: headers()
    });

    if (!res.ok) throw new Error();

    const data = await res.json();

    renderFiles(Array.isArray(data) ? data : []);

    document.getElementById("breadcrumb").textContent =
      path || "root";

  } catch {
    toast("Gagal memuat file.");
  } finally {
    showLoading(false);
  }
}

function renderFiles(files = []) {
  const box = document.getElementById("fileList");
  if (!box) return;

  if (!files.length) {
    box.innerHTML = `
      <div class="item">
        <div class="item-left">
          <h4>Folder kosong</h4>
        </div>
      </div>
    `;
    return;
  }

  files.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "dir" ? -1 : 1;
  });

  box.innerHTML = files.map(file => `
    <div class="item">

      <div class="item-left">
        <label style="display:flex;gap:8px;align-items:center;">
          <input type="checkbox"
            onchange="toggleSelectFile('${file.path}',this.checked)">
          <span></span>
        </label>

        <h4>${escapeHtml(file.name)}</h4>
        <p>${file.type}</p>
      </div>

      <div class="item-right">

        ${
          file.type === "dir"
          ? `
          <button class="btn"
            onclick="loadFiles('${file.path}')">
            Open
          </button>
          `
          : `
          <button class="btn"
            onclick="openFile('${file.path}')">
            Edit
          </button>
          `
        }

        <button class="btn"
          onclick="renamePrompt('${file.path}','${file.type}')">
          Rename
        </button>

        <button class="btn danger"
          onclick="deleteFile('${file.path}','${file.sha}')">
          Delete
        </button>

      </div>

    </div>
  `).join("");
}

function toggleSelectFile(path, checked) {
  if (checked) {
    if (!selectedFiles.includes(path)) {
      selectedFiles.push(path);
    }
  } else {
    selectedFiles =
      selectedFiles.filter(x => x !== path);
  }
}

// ======================================
// OPEN FILE
// ======================================
async function openFile(path) {
  try {
    showLoading(true);

    const res = await fetch(
      `${API}/repos/${currentUser.login}/${currentRepo}/contents/${path}?ref=${currentBranch}`,
      { headers: headers() }
    );

    if (!res.ok) throw new Error();

    const file = await res.json();

    currentFile = path;
    currentSha = file.sha;

    const content =
      safeDecode(file.content.replace(/\n/g, ""));

    editor.setValue(content, -1);

    detectMode(path);

    document.getElementById("editorPath").textContent =
      path;

    showPage("editor");

  } catch {
    toast("Gagal membuka file.");
  } finally {
    showLoading(false);
  }
}

// ======================================
// SAVE FILE
// ======================================
async function saveEditorFile() {
  try {
    if (!currentFile) {
      toast("Tidak ada file aktif.");
      return;
    }

    showLoading(true);

    const content = editor.getValue();

    const body = {
      message: "Update via GitHub Manager",
      content: safeEncode(content),
      branch: currentBranch
    };

    if (currentSha) {
      body.sha = currentSha;
    }

    const res = await fetch(
      `${API}/repos/${currentUser.login}/${currentRepo}/contents/${currentFile}`,
      {
        method: "PUT",
        headers: {
          ...headers(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    if (!res.ok) throw new Error();

    const data = await res.json();

    currentSha = data.content?.sha || "";

    toast("File berhasil disimpan.");

    if (typeof loadFiles === "function") {
      loadFiles(currentPath);
    }

  } catch {
    toast("Gagal menyimpan file.");
  } finally {
    showLoading(false);
  }
}

// ======================================
// NEW FILE / FOLDER
// ======================================
function newFilePrompt() {
  const name = prompt("Nama file baru:");
  if (!name) return;

  currentFile = currentPath
    ? currentPath + "/" + name
    : name;

  currentSha = "";

  editor.setValue("", -1);

  detectMode(name);

  document.getElementById("editorPath").textContent =
    currentFile;

  showPage("editor");
}

async function newFolderPrompt() {
  const name = prompt("Nama folder baru:");
  if (!name) return;

  currentFile = currentPath
    ? currentPath + "/" + name + "/.gitkeep"
    : name + "/.gitkeep";

  currentSha = "";

  editor.setValue("", -1);

  await saveEditorFile();

  toast("Folder berhasil dibuat.");
}

// ======================================
// DELETE FILE
// ======================================
async function deleteFile(path, sha) {
  if (!confirm("Hapus item ini?")) return;

  try {
    showLoading(true);

    const res = await fetch(
      `${API}/repos/${currentUser.login}/${currentRepo}/contents/${path}`,
      {
        method: "DELETE",
        headers: {
          ...headers(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Delete via GitHub Manager",
          sha,
          branch: currentBranch
        })
      }
    );

    if (!res.ok) throw new Error();

    toast("Berhasil dihapus.");

    loadFiles(currentPath);

  } catch {
    toast("Gagal menghapus.");
  } finally {
    showLoading(false);
  }
}

async function deleteSelectedFiles() {
  if (!selectedFiles.length) {
    toast("Tidak ada file dipilih.");
    return;
  }

  if (!confirm("Hapus file terpilih?")) return;

  for (const path of selectedFiles) {
    try {
      const res = await fetch(
        `${API}/repos/${currentUser.login}/${currentRepo}/contents/${path}?ref=${currentBranch}`,
        { headers: headers() }
      );

      const file = await res.json();

      await deleteFile(path, file.sha);

    } catch {}
  }

  selectedFiles = [];
  loadFiles(currentPath);
}

// ======================================
// RENAME
// ======================================
async function renamePrompt(oldPath, type) {
  const oldName = oldPath.split("/").pop();

  const newName = prompt("Nama baru:", oldName);
  if (!newName || newName === oldName) return;

  if (type === "dir") {
    toast("Rename folder gunakan manual copy.");
    return;
  }

  try {
    showLoading(true);

    const getRes = await fetch(
      `${API}/repos/${currentUser.login}/${currentRepo}/contents/${oldPath}?ref=${currentBranch}`,
      { headers: headers() }
    );

    const file = await getRes.json();

    const content =
      safeDecode(file.content.replace(/\n/g, ""));

    const parent =
      oldPath.includes("/")
      ? oldPath.substring(0, oldPath.lastIndexOf("/")) + "/"
      : "";

    const newPath = parent + newName;

    // create new
    await fetch(
      `${API}/repos/${currentUser.login}/${currentRepo}/contents/${newPath}`,
      {
        method: "PUT",
        headers: {
          ...headers(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Rename file",
          content: safeEncode(content),
          branch: currentBranch
        })
      }
    );

    // delete old
    await fetch(
      `${API}/repos/${currentUser.login}/${currentRepo}/contents/${oldPath}`,
      {
        method: "DELETE",
        headers: {
          ...headers(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Delete old file",
          sha: file.sha,
          branch: currentBranch
        })
      }
    );

    toast("Rename berhasil.");

    loadFiles(currentPath);

  } catch {
    toast("Rename gagal.");
  } finally {
    showLoading(false);
  }
}

// ======================================
// UPLOAD FILES
// ======================================
function triggerUpload() {
  document.getElementById("fileUpload").click();
}

function triggerFolderUpload() {
  document.getElementById("folderUpload").click();
}

async function uploadFiles(e) {
  const files = [...e.target.files];

  for (const file of files) {
    const text = await file.text();

    currentFile = currentPath
      ? currentPath + "/" + file.name
      : file.name;

    currentSha = await getShaIfExists(currentFile);

    editor.setValue(text, -1);

    await saveEditorFile();
  }

  e.target.value = "";
  toast("Upload file selesai.");
}

async function uploadFolder(e) {
  const files = [...e.target.files];

  for (const file of files) {
    const text = await file.text();

    currentFile = file.webkitRelativePath;

    currentSha = await getShaIfExists(currentFile);

    editor.setValue(text, -1);

    await saveEditorFile();
  }

  e.target.value = "";
  toast("Upload folder selesai.");
}

async function getShaIfExists(path) {
  try {
    const res = await fetch(
      `${API}/repos/${currentUser.login}/${currentRepo}/contents/${path}?ref=${currentBranch}`,
      { headers: headers() }
    );

    if (!res.ok) return "";

    const data = await res.json();

    return data.sha || "";

  } catch {
    return "";
  }
}

// ======================================
// EDITOR TOOLS
// ======================================
function findReplace() {
  editor.execCommand("replace");
}

function fullscreenEditor() {
  document.getElementById("aceEditor")
    .requestFullscreen();
}

function detectMode(path = "") {
  const ext =
    path.split(".").pop().toLowerCase();

  const map = {
    html: "html",
    css: "css",
    js: "javascript",
    json: "json",
    md: "markdown",
    txt: "text",
    xml: "xml",
    yml: "yaml",
    yaml: "yaml"
  };

  editor.session.setMode(
    "ace/mode/" + (map[ext] || "text")
  );
}

// ======================================
// GitHub Manager Premium FINAL REBUILD
// app.js PART 3C
// PAGES + SETTINGS + FINAL PATCH
// ======================================

// ======================================
// GITHUB PAGES
// ======================================
async function enablePages() {
  try {
    const repo =
      document.getElementById("pagesRepo").value;

    const branch =
      document.getElementById("pagesBranch").value;

    if (!repo) {
      toast("Pilih repository.");
      return;
    }

    showLoading(true);

    currentRepo = repo;
    currentBranch = branch;

    const res = await fetch(
      `${API}/repos/${currentUser.login}/${repo}/pages`,
      {
        method: "POST",
        headers: {
          ...headers(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source: {
            branch: branch,
            path: "/"
          }
        })
      }
    );

    if (![201,202,204,409].includes(res.status)) {
      throw new Error();
    }

    toast("GitHub Pages diproses.");

    await checkPagesStatus(repo);

  } catch {
    toast("Gagal mengaktifkan Pages.");
  } finally {
    showLoading(false);
  }
}

async function checkPagesStatus(repo) {
  try {
    const res = await fetch(
      `${API}/repos/${currentUser.login}/${repo}/pages`,
      { headers: headers() }
    );

    if (!res.ok) return;

    const data = await res.json();

    const url =
      data.html_url ||
      `https://${currentUser.login}.github.io/${repo}/`;

    document.getElementById("pagesStatus").innerHTML = `
      <b>Status:</b> Active<br>
      <b>URL:</b> 
      <a href="${url}" target="_blank">${url}</a>
    `;

  } catch {}
}

// ======================================
// CNAME
// ======================================
async function setCNAME() {
  try {
    const repo =
      document.getElementById("pagesRepo").value;

    const branch =
      document.getElementById("pagesBranch").value;

    const domain =
      document.getElementById("cnameInput").value.trim();

    if (!repo || !domain) {
      toast("Repo / domain kosong.");
      return;
    }

    currentRepo = repo;
    currentBranch = branch;
    currentFile = "CNAME";

    currentSha = await getShaIfExists("CNAME");

    editor.setValue(domain, -1);

    await saveEditorFile();

    toast("CNAME berhasil dibuat.");

    document.getElementById("pagesStatus").innerHTML = `
      <b>Custom Domain:</b> ${escapeHtml(domain)}
    `;

  } catch {
    toast("Gagal set CNAME.");
  }
}

// ======================================
// SETTINGS
// ======================================
function clearStorage() {
  localStorage.clear();
  toast("Local storage dibersihkan.");
}

function toggleTheme() {
  document.body.classList.toggle("light");

  if (document.body.classList.contains("light")) {
    toast("Light mode aktif.");
  } else {
    toast("Dark mode aktif.");
  }
}

// ======================================
// PATCH NAV MENU
// ======================================
function activateMenuByPage(id) {
  const map = {
    dashboard: 0,
    repos: 1,
    files: 2,
    editor: 3,
    pages: 4,
    settings: 5
  };

  document.querySelectorAll(".menu-btn")
    .forEach(btn => btn.classList.remove("active"));

  const buttons =
    document.querySelectorAll(".menu-btn");

  const idx = map[id];

  if (buttons[idx]) {
    buttons[idx].classList.add("active");
  }
}

// overwrite showPage supaya menu sync
const __oldShowPage = showPage;

showPage = function(id, btn = null) {
  __oldShowPage(id, btn);
  activateMenuByPage(id);
};

// ======================================
// EXTRA SHORTCUTS
// ======================================
document.addEventListener("keydown", e => {

  // CTRL + S
  if (e.ctrlKey && e.key.toLowerCase() === "s") {
    e.preventDefault();

    if (
      document.getElementById("editor")
      .classList.contains("active-page")
    ) {
      saveEditorFile();
    }
  }

  // ESC close sidebar mobile
  if (e.key === "Escape") {
    document.getElementById("sidebar")
      .classList.remove("show");
  }

});

// ======================================
// AUTO REFRESH PAGES STATUS
// ======================================
setInterval(() => {
  const page =
    document.getElementById("pages");

  if (
    page &&
    page.classList.contains("active-page")
  ) {
    const repo =
      document.getElementById("pagesRepo").value;

    if (repo && currentUser) {
      checkPagesStatus(repo);
    }
  }
}, 15000);

// ======================================
// STARTUP PATCH
// ======================================
window.addEventListener("load", () => {

  // default page
  activateMenuByPage("dashboard");

  // safety editor
  if (!editor && window.ace) {
    initEditor();
  }

});

// ======================================
// FINAL READY FLAG
// ======================================
console.log(
  "GitHub Manager Premium Final Rebuild Loaded"
);