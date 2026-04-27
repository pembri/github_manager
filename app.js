// ======================================
// app.js PART 1 (NO ERROR)
// CORE + LOGIN + UI + REPO MANAGER
// tempel PART 2 di bawah file ini
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
// START
// ======================================
window.addEventListener("DOMContentLoaded", async () => {
  initEditor();
  bindEvents();

  if (token) {
    await loginGitHub(true);
  }
});

// ======================================
// ACE EDITOR
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
// EVENTS
// ======================================
function bindEvents() {
  const fileInput = document.getElementById("fileUpload");
  const folderInput = document.getElementById("folderUpload");

  if (fileInput) {
    fileInput.addEventListener("change", uploadFiles);
  }

  if (folderInput) {
    folderInput.addEventListener("change", uploadFolder);
  }

  document.addEventListener("keydown", function(e){

    // ctrl+s
    if (e.ctrlKey && e.key.toLowerCase() === "s") {
      e.preventDefault();

      const page = document.getElementById("editor");
      if (page.classList.contains("active-page")) {
        saveEditorFile();
      }
    }

    // esc close sidebar
    if (e.key === "Escape") {
      const side = document.getElementById("sidebar");
      side.classList.remove("show");
    }

  });
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

function showLoading(status = true) {
  const el = document.getElementById("loadingOverlay");
  if (!el) return;

  el.classList.toggle("hidden", !status);
}

function toast(msg = "") {
  const wrap = document.getElementById("toastWrap");

  if (!wrap) {
    alert(msg);
    return;
  }

  const box = document.createElement("div");
  box.className = "toast";
  box.textContent = msg;

  wrap.appendChild(box);

  setTimeout(() => {
    box.remove();
  }, 3200);
}

function encodeBase64(text = "") {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64(text = "") {
  return decodeURIComponent(escape(atob(text)));
}

function esc(str = "") {
  return String(str)
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
      throw new Error("Token tidak valid.");
    }

    currentUser = await res.json();

    localStorage.setItem("gh_token", token);

    fillProfile();

    document.getElementById("loginPage").style.display = "none";
    document.getElementById("appPage").style.display = "grid";

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
// PAGE UI
// ======================================
function showPage(id, btn = null) {

  document.querySelectorAll(".content")
    .forEach(el => el.classList.remove("active-page"));

  const page = document.getElementById(id);
  if (page) {
    page.classList.add("active-page");
  }

  document.querySelectorAll(".menu-btn")
    .forEach(el => el.classList.remove("active"));

  if (btn) {
    btn.classList.add("active");
  } else {
    autoMenuActive(id);
  }

  const title =
    id.charAt(0).toUpperCase() + id.slice(1);

  document.getElementById("pageTitle").textContent =
    title;

  document.getElementById("sidebar")
    .classList.remove("show");
}

function autoMenuActive(id) {
  const ids = [
    "dashboard",
    "repos",
    "files",
    "editor",
    "pages",
    "settings"
  ];

  const idx = ids.indexOf(id);

  const menus =
    document.querySelectorAll(".menu-btn");

  if (menus[idx]) {
    menus[idx].classList.add("active");
  }
}

function toggleSidebar() {
  document.getElementById("sidebar")
    .classList.toggle("show");
}

// ======================================
// REPOSITORY
// ======================================
async function loadRepos() {
  try {
    showLoading(true);

    const res = await fetch(
      `${API}/user/repos?per_page=100&sort=updated`,
      { headers: headers() }
    );

    if (!res.ok) {
      throw new Error();
    }

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

function renderRepos(data = []) {
  const box = document.getElementById("repoList");
  if (!box) return;

  if (!data.length) {
    box.innerHTML = `
      <div class="item">
        <div class="item-left">
          <h4>Tidak ada repository</h4>
        </div>
      </div>
    `;
    return;
  }

  box.innerHTML = data.map(repo => `
    <div class="item">

      <div class="item-left">
        <h4>${esc(repo.name)}</h4>
        <p>
          ${repo.private ? "Private" : "Public"} •
          ${esc(repo.default_branch)}
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
    repos.filter(x => !x.private).length;

  document.getElementById("privateRepo").textContent =
    repos.filter(x => x.private).length;
}

function fillRepoSelectors() {
  const html = repos.map(repo =>
    `<option value="${repo.name}">${repo.name}</option>`
  ).join("");

  ["repoSelector","pagesRepo"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });

  if (repos.length && !currentRepo) {
    currentRepo = repos[0].name;
  }
}

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

async function createRepo() {
  try {
    const name =
      document.getElementById("newRepoName").value.trim();

    const isPrivate =
      document.getElementById("repoVisibility").value === "true";

    if (!name) {
      toast("Nama repo kosong.");
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
        name: name,
        private: isPrivate,
        auto_init: true
      })
    });

    if (!res.ok) {
      throw new Error("Gagal membuat repo.");
    }

    document.getElementById("newRepoName").value = "";

    toast("Repository dibuat.");

    await loadRepos();

  } catch (err) {
    toast(err.message || "Create gagal.");
  } finally {
    showLoading(false);
  }
}

async function deleteRepo(name = "") {
  const confirmName =
    prompt("Ketik nama repository:\n" + name);

  if (confirmName !== name) {
    toast("Dibatalkan.");
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

    if (![204,200].includes(res.status)) {
      throw new Error("Gagal hapus repo.");
    }

    toast("Repository dihapus.");

    await loadRepos();

  } catch (err) {
    toast(err.message || "Delete gagal.");
  } finally {
    showLoading(false);
  }
}

function openRepo(name, branch = "main") {
  currentRepo = name;
  currentBranch = branch;
  currentPath = "";

  const select =
    document.getElementById("repoSelector");

  if (select) select.value = name;

  showPage("files");
  repoChanged();
}

// ======================================
// BRANCH
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

    const data = await res.json();

    const select =
      document.getElementById("branchSelector");

    select.innerHTML = data.map(branch => `
      <option value="${branch.name}">
        ${branch.name}
      </option>
    `).join("");

    currentBranch =
      data[0]?.name || "main";

    select.value = currentBranch;

    loadFiles("");

  } catch {
    toast("Gagal memuat branch.");
  } finally {
    showLoading(false);
  }
}

function branchChanged() {
  const select =
    document.getElementById("branchSelector");

  currentBranch =
    select.value || "main";

  loadFiles("");
}

// ======================================
// app.js PART 2 (NO ERROR)
// FILES + EDITOR + PAGES + SETTINGS
// tempel di bawah PART 1
// ======================================

// ======================================
// FILE EXPLORER
// ======================================
async function loadFiles(path = "") {
  try {
    if (!currentRepo) {
      toast("Pilih repository dulu.");
      return;
    }

    currentPath = path;
    selectedFiles = [];

    showLoading(true);

    const res = await fetch(
      `${API}/repos/${currentUser.login}/${currentRepo}/contents/${path}?ref=${currentBranch}`,
      { headers: headers() }
    );

    if (!res.ok) throw new Error();

    const data = await res.json();

    renderFiles(Array.isArray(data) ? data : []);

    const bc = document.getElementById("breadcrumb");
    if (bc) bc.textContent = path || "root";

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
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
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

        <h4>${esc(file.name)}</h4>
        <p>${file.type}</p>
      </div>

      <div class="item-right">

        ${
          file.type === "dir"
          ? `<button class="btn"
               onclick="loadFiles('${file.path}')">
               Open
             </button>`
          : `<button class="btn"
               onclick="openFile('${file.path}')">
               Edit
             </button>`
        }

        <button class="btn"
          onclick="renamePrompt('${file.path}','${file.type}')">
          Rename
        </button>

        <button class="btn danger"
          onclick="deleteFile('${file.path}','${file.sha || ""}')">
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
async function openFile(path = "") {
  try {
    showLoading(true);

    const res = await fetch(
      `${API}/repos/${currentUser.login}/${currentRepo}/contents/${path}?ref=${currentBranch}`,
      { headers: headers() }
    );

    if (!res.ok) throw new Error();

    const file = await res.json();

    currentFile = path;
    currentSha = file.sha || "";

    const content =
      decodeBase64((file.content || "").replace(/\n/g, ""));

    editor.setValue(content, -1);

    detectMode(path);

    const ep = document.getElementById("editorPath");
    if (ep) ep.textContent = path;

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
    if (!currentRepo || !currentFile) {
      toast("Tidak ada file aktif.");
      return;
    }

    showLoading(true);

    const content = editor.getValue();

    const body = {
      message: "Update via GitHub Manager",
      content: encodeBase64(content),
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

    currentSha =
      data.content?.sha || currentSha;

    toast("File disimpan.");

    loadFiles(currentPath);

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
  const name = prompt("Nama file:");

  if (!name) return;

  currentFile =
    currentPath ? currentPath + "/" + name : name;

  currentSha = "";

  editor.setValue("", -1);

  detectMode(name);

  document.getElementById("editorPath").textContent =
    currentFile;

  showPage("editor");
}

async function newFolderPrompt() {
  const name = prompt("Nama folder:");

  if (!name) return;

  currentFile =
    currentPath
      ? currentPath + "/" + name + "/.gitkeep"
      : name + "/.gitkeep";

  currentSha = "";

  editor.setValue("", -1);

  await saveEditorFile();

  toast("Folder dibuat.");
}

// ======================================
// DELETE
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
          sha: sha,
          branch: currentBranch
        })
      }
    );

    if (!res.ok) throw new Error();

    toast("Dihapus.");

    loadFiles(currentPath);

  } catch {
    toast("Gagal hapus.");
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
    const sha = await getShaIfExists(path);
    if (sha) {
      await deleteFile(path, sha);
    }
  }

  selectedFiles = [];
  loadFiles(currentPath);
}

// ======================================
// RENAME FILE
// ======================================
async function renamePrompt(oldPath, type) {
  const oldName = oldPath.split("/").pop();

  const newName = prompt("Nama baru:", oldName);

  if (!newName || newName === oldName) return;

  if (type === "dir") {
    toast("Rename folder manual.");
    return;
  }

  try {
    showLoading(true);

    const res = await fetch(
      `${API}/repos/${currentUser.login}/${currentRepo}/contents/${oldPath}?ref=${currentBranch}`,
      { headers: headers() }
    );

    const file = await res.json();

    const content =
      decodeBase64((file.content || "").replace(/\n/g, ""));

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
          content: encodeBase64(content),
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
// UPLOAD
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

    currentFile =
      currentPath
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
  const el = document.getElementById("aceEditor");
  if (el.requestFullscreen) {
    el.requestFullscreen();
  }
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
// GITHUB PAGES
// ======================================
async function enablePages() {
  try {
    const repo =
      document.getElementById("pagesRepo").value;

    const branch =
      document.getElementById("pagesBranch").value;

    if (!repo) {
      toast("Pilih repo.");
      return;
    }

    showLoading(true);

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

    toast("Pages diproses.");

    await checkPagesStatus(repo);

  } catch {
    toast("Gagal enable pages.");
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

    document.getElementById("pagesStatus").innerHTML = `
      <b>Status:</b> Active<br>
      <b>URL:</b> ${data.html_url || "-"}
    `;

  } catch {}
}

async function setCNAME() {
  const domain =
    document.getElementById("cnameInput").value.trim();

  const repo =
    document.getElementById("pagesRepo").value;

  const branch =
    document.getElementById("pagesBranch").value;

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

  toast("CNAME dibuat.");
}

// ======================================
// SETTINGS
// ======================================
function clearStorage() {
  localStorage.clear();
  toast("Storage dibersihkan.");
}

function toggleTheme() {
  document.body.classList.toggle("light");
}
