const STORAGE_KEY = "qingya-genealogy-v1";
const COLLAPSE_KEY = "qingya-genealogy-collapsed-v1";
const MODE_KEY = "qingya-genealogy-mode-v1";
const FONT_KEY = "qingya-genealogy-font-v1";
const GENERATION_WORDS = [
  ["玄", "景"],
  ["渊", "清"],
  ["曦", "月"],
  ["承", "明"],
  ["周", "行"],
  ["绛", "阙"],
  ["遂", "语"],
  ["青", "元"],
  ["玉", "京"],
  ["映", "象"],
  ["唯", "见"],
  ["灵", "初"]
];
const SECOND_GENERATION_ORDER = ["伯", "仲", "叔", "季"];


let state = loadState();
let collapsed = loadCollapsed();
let mode = localStorage.getItem(MODE_KEY) || "view";
let fontMode = localStorage.getItem(FONT_KEY) || "serif";

const $ = (selector) => document.querySelector(selector);

const els = {
  treeView: $("#treeView"),
  summaryText: $("#summaryText"),
  memberForm: $("#memberForm"),
  memberDialog: $("#memberDialog"),
  marriageForm: $("#marriageForm"),
  dialog: $("#marriageDialog"),
  search: $("#searchInput"),
  importInput: $("#importInput"),
  fontInput: $("#fontInput"),
  moonMenuBtn: $("#moonMenuBtn"),
  moonMenuPanel: $("#moonMenuPanel")
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { members: [], marriages: [] };
  try {
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return { members: [], marriages: [] };
  }
}

function normalizeState(data) {
  const legacySampleIds = new Set(["m11", "m12", "m13"]);
  const legacySampleNames = new Set(["沈云蘅", "周砚", "周怀远"]);
  const members = Array.isArray(data.members)
    ? data.members
        .filter((member) => !(legacySampleIds.has(member.id) && legacySampleNames.has(member.name)))
        .map((member) => ({ birthStatus: "", deathCause: "", ...member }))
    : [];
  const removedIds = new Set(
    Array.isArray(data.members)
      ? data.members
          .filter((member) => legacySampleIds.has(member.id) && legacySampleNames.has(member.name))
          .map((member) => member.id)
      : []
  );
  const marriages = Array.isArray(data.marriages)
    ? data.marriages
        .filter((item) => item.id !== "r4" && !removedIds.has(item.husbandId) && !removedIds.has(item.wifeId))
        .map((item) => ({ residence: "patrilocal", ...item }))
    : [];

  return { members, marriages };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadCollapsed() {
  const raw = localStorage.getItem(COLLAPSE_KEY);
  if (!raw) return new Set();
  try {
    const ids = JSON.parse(raw);
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function saveCollapsed() {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsed]));
}

function uid(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function memberName(id) {
  return state.members.find((member) => member.id === id)?.name || "未记载";
}

function genderText(gender) {
  return gender === "female" ? "女" : "男";
}

function statusText(member) {
  if (member.lifeStatus === "dead") {
    return member.deathRank ? `已故 · ${member.deathRank}` : "已故";
  }
  return "在世";
}

function lineageLabel(member) {
  const generation = Number(member.generation) || 1;
  if (generation === 1) return "始祖";
  if (generation === 2) return secondGenerationLabel(member);

  const pair = GENERATION_WORDS[generation - 3];
  if (!pair) return `第 ${generation} 代`;
  return pair.join("");
}

function secondGenerationLabel(member) {
  const siblings = siblingGroup(member);
  const index = siblings.findIndex((item) => item.id === member.id);
  return SECOND_GENERATION_ORDER[index] || `第${index + 1}序`;
}

function siblingGroup(member) {
  const parentId = lineageParentId(member);
  return state.members
    .filter((item) => (parentId ? lineageParentId(item) === parentId : Number(item.generation) === Number(member.generation)))
    .sort((a, b) => memberIndex(a.id) - memberIndex(b.id));
}

function memberIndex(id) {
  const index = state.members.findIndex((member) => member.id === id);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function roleText(role) {
  return role === "concubine" ? "妾" : "正妻";
}

function residenceText(residence) {
  return residence === "matrilocal" ? "入赘" : "外嫁";
}

function marriageOfParents(member) {
  if (!member.fatherId || !member.motherId) return null;
  return state.marriages.find((item) => item.husbandId === member.fatherId && item.wifeId === member.motherId) || null;
}

function lineageParentId(member) {
  const marriage = marriageOfParents(member);
  if (marriage?.residence === "matrilocal") return member.motherId;
  if (member.fatherId) return member.fatherId;
  if (member.motherId) return member.motherId;
  return "";
}

function isExternalSpouseOnly(member) {
  if (lineageParentId(member)) return false;
  return state.marriages.some((item) => {
    const residence = item.residence || "patrilocal";
    const wife = state.members.find((person) => person.id === item.wifeId);
    const wifeIsMarriedIntoAnotherLine = state.marriages.some((marriage) => {
      const wifeResidence = marriage.residence || "patrilocal";
      return (
        (wifeResidence === "patrilocal" && marriage.wifeId === wife?.id) ||
        (wifeResidence === "matrilocal" && marriage.husbandId === wife?.id)
      );
    });
    const wifeIsFamilyLine = wife && (lineageParentId(wife) || !wifeIsMarriedIntoAnotherLine);
    return (
      (residence === "patrilocal" && item.wifeId === member.id) ||
      (residence === "patrilocal" && item.husbandId === member.id && Boolean(wifeIsFamilyLine)) ||
      (residence === "matrilocal" && item.husbandId === member.id)
    );
  });
}

function legitimacyFor(member) {
  if (member.birthStatus === "legitimate") return "嫡出";
  if (member.birthStatus === "shu") return "庶出";
  if (member.birthStatus === "matrilocal") return "入赘支";
  if (member.birthStatus === "unknown") return "嫡庶未明";
  if (!member.fatherId || !member.motherId) return "嫡庶未明";
  const marriage = marriageOfParents(member);
  if (!marriage) return "嫡庶未明";
  if (marriage.residence === "matrilocal") return "入赘支";
  return marriage.role === "principal" ? "嫡出" : "庶出";
}

function spouseLines(memberId) {
  return state.marriages
    .filter((item) => item.husbandId === memberId || item.wifeId === memberId)
    .map((item) => {
      const isHusband = item.husbandId === memberId;
      const otherName = memberName(isHusband ? item.wifeId : item.husbandId);
      const residence = item.residence || "patrilocal";
      const role = residence === "matrilocal"
        ? (isHusband ? "入赘于" : "入赘夫")
        : (isHusband ? roleText(item.role) : "夫婿");
      const details = [];
      if (residence === "matrilocal" || !isHusband) details.push(residenceText(residence));
      if (item.notes) details.push(item.notes);
      return `${role}：${otherName}${details.length ? `（${details.join("，")}）` : ""}`;
    });
}

function childMembers(memberId) {
  return state.members
    .filter((member) => lineageParentId(member) === memberId)
    .sort((a, b) => {
      const legitimacyOrder = legitimacyFor(a).localeCompare(legitimacyFor(b), "zh-Hans-CN");
      return a.generation - b.generation || legitimacyOrder || memberIndex(a.id) - memberIndex(b.id);
    });
}

function hiddenDescendantCount(memberId) {
  return childMembers(memberId).reduce((total, child) => total + 1 + hiddenDescendantCount(child.id), 0);
}

function isSpouseOnly(member) {
  return isExternalSpouseOnly(member) && !childMembers(member.id).length;
}

function treeRoots(members) {
  const visibleIds = new Set(members.map((member) => member.id));
  return members
    .filter((member) => {
      const lineageParent = lineageParentId(member);
      const parentIsVisible = lineageParent && visibleIds.has(lineageParent);
      const parent = state.members.find((item) => item.id === lineageParent);
      const parentIsHiddenSpouse = parent && isSpouseOnly(parent);
      if (lineageParent && !parentIsVisible && parentIsHiddenSpouse) return false;
      return !parentIsVisible && !isSpouseOnly(member);
    })
    .sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

function filteredMembers() {
  const q = els.search.value.trim().toLowerCase();

  return state.members.filter((member) => {
    const haystack = [member.name, member.courtesy, member.styleName, member.notes, member.deathCause, lineageLabel(member)]
      .join(" ")
      .toLowerCase();
    return !q || haystack.includes(q);
  });
}

function render() {
  saveState();
  applyMode();
  applyFont();
  renderSelectors();
  renderTree();
}

function applyMode() {
  document.body.classList.toggle("view-mode", mode === "view");
  $("#viewModeBtn").classList.toggle("active", mode === "view");
  $("#editModeBtn").classList.toggle("active", mode === "edit");
}

function setMode(nextMode) {
  mode = nextMode;
  localStorage.setItem(MODE_KEY, mode);
  applyMode();
}

function applyFont() {
  document.body.classList.toggle("font-serif", fontMode === "serif");
  document.body.classList.toggle("font-kai", fontMode === "kai");
  document.body.classList.toggle("font-sans", fontMode === "sans");
  els.fontInput.value = fontMode;
}

function setFont(nextFont) {
  fontMode = nextFont;
  localStorage.setItem(FONT_KEY, fontMode);
  applyFont();
}

function renderSelectors() {
  const males = state.members.filter((member) => member.gender === "male");
  const females = state.members.filter((member) => member.gender === "female");
  fillSelect($("#fatherInput"), males, "未记载");
  fillSelect($("#motherInput"), females, "未记载");
  fillSelect($("#husbandInput"), males, "请选择男方", false);
  fillSelect($("#wifeInput"), females, "请选择女方", false);
}

function fillSelect(select, items, placeholder, includeBlank = true) {
  const current = select.value;
  select.innerHTML = includeBlank ? `<option value="">${placeholder}</option>` : `<option value="">${placeholder}</option>`;
  items
    .sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, "zh-Hans-CN"))
    .forEach((member) => {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = `${member.name}（${member.generation}世）`;
      select.appendChild(option);
    });
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function renderTree() {
  const members = filteredMembers().sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, "zh-Hans-CN"));

  if (!members.length) {
    els.summaryText.textContent = `${state.members.length} 位族人，${state.marriages.length} 条婚配，当前匹配 0 位`;
    els.treeView.innerHTML = `<div class="empty-state">暂无匹配族人。切换到编辑模式后，可以新增族人。</div>`;
    return;
  }

  const visibleIds = new Set(members.map((member) => member.id));
  const roots = treeRoots(members);
  const graphCount = countGraphMembers(roots, visibleIds);
  els.summaryText.textContent = `${state.members.length} 位族人，${state.marriages.length} 条婚配，匹配 ${members.length} 位，谱图显示 ${graphCount} 位`;
  els.treeView.innerHTML = `<div class="lineage-forest">${roots.map((member) => renderRootNode(member, visibleIds)).join("")}</div>`;
  centerTreeView();
}

function centerTreeView() {
  requestAnimationFrame(() => {
    const overflow = els.treeView.scrollWidth - els.treeView.clientWidth;
    if (overflow > 0) els.treeView.scrollLeft = overflow / 2;
  });
}

function countGraphMembers(roots, visibleIds) {
  const seen = new Set();
  const visit = (member) => {
    if (!member || seen.has(member.id) || !visibleIds.has(member.id) || isSpouseOnly(member)) return;
    seen.add(member.id);
    childMembers(member.id).forEach(visit);
  };
  roots.forEach(visit);
  return seen.size;
}

function renderNode(member, visibleIds) {
  const children = childMembers(member.id).filter((child) => visibleIds.has(child.id));
  const isCollapsed = collapsed.has(member.id);
  const canCollapse = children.length > 0;
  const descendants = hiddenDescendantCount(member.id);
  const card = renderCard(member, { canCollapse, isCollapsed, descendants });
  const childTree =
    children.length && !isCollapsed
      ? renderMotherGroups(member, children, visibleIds)
      : "";
  return `<div class="lineage-node ${children.length ? "has-children has-mother-groups" : ""}">${card}${childTree}</div>`;
}

function renderMotherGroups(parent, children, visibleIds) {
  const groups = motherGroupsFor(parent, children);
  return `
    <div class="mother-groups">
      ${groups
        .map((group) => `
          <div class="mother-group ${collapsed.has(group.id) ? "collapsed" : ""}">
            <div class="mother-node">${escapeHtml(group.label)}</div>
            ${
              collapsed.has(group.id)
                ? `<div class="branch-note">此母支已收起，共 ${group.children.length} 位子嗣</div>`
                : `<div class="mother-children">${group.children.map((child) => renderNode(child, visibleIds)).join("")}</div>`
            }
          </div>
        `)
        .join("")}
    </div>
  `;
}

function motherGroupsFor(parent, children) {
  const groups = new Map();
  children.forEach((child) => {
    const key = child.motherId || "unknown";
    if (!groups.has(key)) {
      groups.set(key, {
        id: `${parent.id}:mother:${key}`,
        label: child.motherId ? memberName(child.motherId) : "母未记",
        children: []
      });
    }
    groups.get(key).children.push(child);
  });
  return [...groups.values()];
}

function renderRootNode(member, visibleIds) {
  return renderNode(member, visibleIds).replace('class="lineage-node', 'class="lineage-node lineage-root');
}

function renderCard(member, options = {}) {
  const { canCollapse = false, isCollapsed = false, descendants = 0 } = options;
  const tags = [
    genderText(member.gender),
    lineageLabel(member),
    legitimacyFor(member),
    statusText(member)
  ];
  const aliases = [member.courtesy && `字 ${member.courtesy}`, member.styleName && `号 ${member.styleName}`]
    .filter(Boolean)
    .join("，");
  const spouses = spouseLines(member.id);
  const relationRows = [
    aliases,
    member.lifeStatus === "dead" && member.deathCause ? `死因：${member.deathCause}` : "",
    member.notes
  ].filter(Boolean);

  return `
    <article class="member-card ${isCollapsed ? "collapsed" : ""}">
      <div class="member-top">
        <div class="member-name">${escapeHtml(member.name)}</div>
        ${
          canCollapse
            ? `<button class="branch-toggle ghost" type="button" data-action="toggle" data-id="${member.id}" aria-label="${isCollapsed ? "展开此脉" : "收起此脉"}">${isCollapsed ? "+" : "−"}</button>`
            : ""
        }
      </div>
      <div class="tags">
        ${tags
          .map((tag) => `<span class="${tagClass(tag)}">${escapeHtml(tag)}</span>`)
          .join("")}
      </div>
      ${spouses.length ? `<div class="spouse-row">${spouses.map((row) => `<div class="spouse-pill">${escapeHtml(row)}</div>`).join("")}</div>` : ""}
      <div class="relations">${relationRows.map((row) => `<div>${escapeHtml(row)}</div>`).join("")}</div>
      ${isCollapsed ? `<div class="branch-note">此脉已收起，共 ${descendants} 位后裔</div>` : ""}
      <div class="card-actions">
        <button class="small-button ghost" type="button" data-action="edit" data-id="${member.id}">编辑</button>
        ${
          member.gender === "male"
            ? `<button class="small-button" type="button" data-action="spouse" data-id="${member.id}">添妻妾</button>`
            : `<button class="small-button" type="button" data-action="spouse" data-id="${member.id}">添夫婿</button>`
        }
        <button class="small-button" type="button" data-action="child" data-id="${member.id}">添子女</button>
        <button class="small-button danger-button" type="button" data-action="delete" data-id="${member.id}">删除</button>
      </div>
    </article>
  `;
}

function tagClass(tag) {
  const classes = ["tag"];
  if (tag === "男") classes.push("gender-male");
  if (tag === "女") classes.push("gender-female");
  if (tag === "始祖" || GENERATION_WORDS.some((pair) => pair.join("") === tag)) classes.push("generation-word");
  if (SECOND_GENERATION_ORDER.includes(tag) || tag.endsWith("序")) classes.push("birth-order");
  if (tag === "嫡出") classes.push("legitimate");
  if (tag === "庶出") classes.push("shu");
  if (tag.includes("未明")) classes.push("unknown");
  if (tag === "在世") classes.push("alive");
  if (tag.includes("已故")) classes.push("dead");
  if (tag === "入赘支") classes.push("legitimate");
  return classes.join(" ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetForm() {
  els.memberForm.reset();
  $("#editingId").value = "";
  $("#memberDialogTitle").textContent = "新增族人";
  $("#generationInput").value = 1;
  $("#birthStatusInput").value = "";
  $("#deathCauseInput").value = "";
}

function openMemberDialog(title = "新增族人") {
  $("#memberDialogTitle").textContent = title;
  els.memberDialog.showModal();
  $("#nameInput").focus();
}

function memberFromForm() {
  return {
    id: $("#editingId").value || uid("m"),
    name: $("#nameInput").value.trim(),
    gender: $("#genderInput").value,
    generation: Number($("#generationInput").value) || 1,
    courtesy: $("#courtesyInput").value.trim(),
    styleName: $("#styleInput").value.trim(),
    fatherId: $("#fatherInput").value,
    motherId: $("#motherInput").value,
    birthStatus: $("#birthStatusInput").value,
    lifeStatus: $("#lifeStatusInput").value,
    deathRank: $("#deathRankInput").value.trim(),
    deathCause: $("#deathCauseInput").value.trim(),
    notes: $("#notesInput").value.trim()
  };
}

function editMember(id) {
  const member = state.members.find((item) => item.id === id);
  if (!member) return;
  $("#editingId").value = member.id;
  $("#nameInput").value = member.name;
  $("#genderInput").value = member.gender;
  $("#generationInput").value = member.generation || 1;
  $("#courtesyInput").value = member.courtesy || "";
  $("#styleInput").value = member.styleName || "";
  $("#fatherInput").value = member.fatherId || "";
  $("#motherInput").value = member.motherId || "";
  $("#birthStatusInput").value = member.birthStatus || "";
  $("#lifeStatusInput").value = member.lifeStatus || "alive";
  $("#deathRankInput").value = member.deathRank || "";
  $("#deathCauseInput").value = member.deathCause || "";
  $("#notesInput").value = member.notes || "";
  openMemberDialog(`编辑：${member.name}`);
}

function deleteMember(id) {
  const name = memberName(id);
  if (!confirm(`确定删除「${name}」？相关婚配会一并移除，子女的父母记录会清空。`)) return;
  state.members = state.members
    .filter((member) => member.id !== id)
    .map((member) => ({
      ...member,
      fatherId: member.fatherId === id ? "" : member.fatherId,
      motherId: member.motherId === id ? "" : member.motherId
    }));
  state.marriages = state.marriages.filter((item) => item.husbandId !== id && item.wifeId !== id);
  collapsed.delete(id);
  saveCollapsed();
  render();
}

function prepareChild(parentId) {
  const parent = state.members.find((member) => member.id === parentId);
  if (!parent) return;
  resetForm();
  $("#generationInput").value = (Number(parent.generation) || 1) + 1;
  if (parent.gender === "male") $("#fatherInput").value = parent.id;
  if (parent.gender === "female") $("#motherInput").value = parent.id;
  openMemberDialog(`为 ${parent.name} 添子女`);
}

function prepareSpouse(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return;
  $("#husbandInput").value = member.gender === "male" ? member.id : "";
  $("#wifeInput").value = member.gender === "female" ? member.id : "";
  $("#spouseRoleInput").value = "principal";
  $("#residenceInput").value = "patrilocal";
  $("#marriageNotesInput").value = "";
  els.dialog.showModal();
}

els.memberForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const member = memberFromForm();
  if (!member.name) return;

  const index = state.members.findIndex((item) => item.id === member.id);
  if (index >= 0) {
    state.members[index] = member;
  } else {
    state.members.push(member);
  }
  resetForm();
  els.memberDialog.close();
  render();
});

els.marriageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const husbandId = $("#husbandInput").value;
  const wifeId = $("#wifeInput").value;
  if (!husbandId || !wifeId) return;

  const existing = state.marriages.find((item) => item.husbandId === husbandId && item.wifeId === wifeId);
  const marriage = {
    id: existing?.id || uid("r"),
    husbandId,
    wifeId,
    role: $("#spouseRoleInput").value,
    residence: $("#residenceInput").value,
    notes: $("#marriageNotesInput").value.trim()
  };

  if (existing) {
    Object.assign(existing, marriage);
  } else {
    state.marriages.push(marriage);
  }
  els.dialog.close();
  els.marriageForm.reset();
  render();
});

els.treeView.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "toggle") {
    if (collapsed.has(id)) {
      collapsed.delete(id);
    } else {
      collapsed.add(id);
    }
    saveCollapsed();
    renderTree();
  }
  if (mode !== "edit" && action !== "toggle") return;
  if (action === "edit") editMember(id);
  if (action === "delete") deleteMember(id);
  if (action === "child") prepareChild(id);
  if (action === "spouse") prepareSpouse(id);
});

$("#expandAllBtn").addEventListener("click", () => {
  collapsed.clear();
  saveCollapsed();
  renderTree();
});
$("#collapseAllBtn").addEventListener("click", () => {
  state.members.forEach((member) => {
    if (childMembers(member.id).length) collapsed.add(member.id);
  });
  saveCollapsed();
  renderTree();
});
els.moonMenuBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  const willOpen = els.moonMenuPanel.hidden;
  els.moonMenuPanel.hidden = !willOpen;
  els.moonMenuBtn.setAttribute("aria-expanded", String(willOpen));
});
document.addEventListener("click", (event) => {
  if (event.target.closest(".moon-menu")) return;
  els.moonMenuPanel.hidden = true;
  els.moonMenuBtn.setAttribute("aria-expanded", "false");
});
els.fontInput.addEventListener("change", () => setFont(els.fontInput.value));
$("#viewModeBtn").addEventListener("click", () => setMode("view"));
$("#editModeBtn").addEventListener("click", () => setMode("edit"));
$("#addRootBtn").addEventListener("click", () => {
  resetForm();
  openMemberDialog("新增族人");
});
$("#closeMarriageBtn").addEventListener("click", () => els.dialog.close());
$("#closeMemberBtn").addEventListener("click", () => {
  resetForm();
  els.memberDialog.close();
});
$("#cancelEditBtn").addEventListener("click", () => {
  resetForm();
  els.memberDialog.close();
});
$("#resetBtn").addEventListener("click", () => {
  if (!confirm("确定清空全部族谱数据？")) return;
  state = { members: [], marriages: [] };
  collapsed.clear();
  saveCollapsed();
  resetForm();
  els.moonMenuPanel.hidden = true;
  els.moonMenuBtn.setAttribute("aria-expanded", "false");
  render();
});

$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `qingya-genealogy-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  els.moonMenuPanel.hidden = true;
  els.moonMenuBtn.setAttribute("aria-expanded", "false");
});

els.importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.members) || !Array.isArray(parsed.marriages)) {
      throw new Error("bad shape");
    }
    state = normalizeState(parsed);
    collapsed.clear();
    saveCollapsed();
    resetForm();
    els.moonMenuPanel.hidden = true;
    els.moonMenuBtn.setAttribute("aria-expanded", "false");
    render();
  } catch {
    alert("导入失败：请选择由本网站导出的 JSON 文件。");
  } finally {
    event.target.value = "";
  }
});

els.search.addEventListener("input", renderTree);

render();
