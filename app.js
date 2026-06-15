const STORAGE_KEY = "qingya-genealogy-v1";
const COLLAPSE_KEY = "qingya-genealogy-collapsed-v1";
const MODE_KEY = "qingya-genealogy-mode-v1";
const FONT_KEY = "qingya-genealogy-font-v1";
const TALISMAN_TOTAL_KEY = "qingya-genealogy-talisman-total-v1";
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
const CULTIVATION_LEVELS = ["凡人", "胎息", "练气", "筑基", "紫府", "金丹", "道胎", "仙人"];


let state = loadState();
let collapsed = loadCollapsed();
let mode = localStorage.getItem(MODE_KEY) || "view";
let fontMode = localStorage.getItem(FONT_KEY) || "kai";
let talismanTotal = Number(localStorage.getItem(TALISMAN_TOTAL_KEY)) || 0;

const $ = (selector) => document.querySelector(selector);

const els = {
  treeView: $("#treeView"),
  summaryText: $("#summaryText"),
  memberForm: $("#memberForm"),
  memberDialog: $("#memberDialog"),
  marriageForm: $("#marriageForm"),
  dialog: $("#marriageDialog"),
  search: $("#searchInput"),
  talismanTotalInput: $("#talismanTotalInput"),
  talismanAliveCount: $("#talismanAliveCount"),
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
        .map((member) => normalizeMember(member))
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
        .map((item) => ({ residence: "patrilocal", marriageStatus: "current", ...item }))
    : [];

  return { members, marriages };
}

function normalizeMember(member) {
  const normalized = {
    birthStatus: "",
    motherGroup: "",
    deathRank: "凡人",
    deathCause: "",
    talismanSeed: "",
    luqi: "",
    luqiText: "",
    xianji: "",
    shentong: "",
    jinxing: "",
    externalChildren: "",
    adoptiveParentId: "",
    adoptionType: "",
    adoptionNote: "",
    ...member
  };
  if (!CULTIVATION_LEVELS.includes(normalized.deathRank)) normalized.deathRank = "凡人";
  return normalized;
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
  const level = member.deathRank || "凡人";
  if (member.lifeStatus === "dead") {
    return `已故 · ${level}`;
  }
  return `生 · ${level}`;
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
  if (role === "successor") return "继妻";
  return role === "concubine" ? "妾" : "正妻";
}

function marriageStatusText(status) {
  if (status === "deceased") return "已故";
  if (status === "divorced") return "和离";
  return "";
}

function residenceText(residence) {
  return residence === "matrilocal" ? "入赘" : "外嫁";
}

function marriageOfParents(member) {
  if (!member.fatherId || !member.motherId) return null;
  return state.marriages.find((item) => item.husbandId === member.fatherId && item.wifeId === member.motherId) || null;
}

function lineageParentId(member) {
  if (member.adoptiveParentId) return member.adoptiveParentId;
  const marriage = marriageOfParents(member);
  if (marriage?.residence === "matrilocal") return member.motherId;
  if (member.fatherId) return member.fatherId;
  if (member.motherId) return member.motherId;
  return "";
}

function birthLineageParentId(member) {
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
  return marriage.role === "principal" || marriage.role === "successor" ? "嫡出" : "庶出";
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
      const status = marriageStatusText(item.marriageStatus);
      if (residence === "matrilocal" || !isHusband) details.push(residenceText(residence));
      if (status) details.push(status);
      if (item.notes) details.push(item.notes);
      return {
        id: item.id,
        text: `${role}：${otherName}${details.length ? `（${details.join("，")}）` : ""}`
      };
    });
}

function childMembers(memberId) {
  return state.members
    .filter((member) => lineageParentId(member) === memberId)
    .sort((a, b) => {
      return a.generation - b.generation || memberIndex(a.id) - memberIndex(b.id);
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
  const rawQuery = els.search.value.trim();
  const q = rawQuery.toLowerCase();
  const compactQuery = rawQuery.replace(/\s+/g, "");
  const wantsAliveTalisman =
    compactQuery.includes("在世符种") ||
    compactQuery.includes("符种在世") ||
    compactQuery.includes("在世符咒") ||
    compactQuery.includes("符咒在世");

  return state.members.filter((member) => {
    if (wantsAliveTalisman) return isAliveTalismanMember(member);
    const haystack = [
      member.name,
      member.courtesy,
      member.styleName,
      member.notes,
      member.deathCause,
      member.deathRank,
      member.luqi,
      member.luqiText,
      member.xianji,
      member.shentong,
      member.jinxing,
      member.externalChildren,
      member.adoptionNote,
      member.adoptiveParentId ? `${adoptionTypeText(member.adoptionType)} 承嗣 嗣子 兼祧 出继 ${memberName(member.adoptiveParentId)}` : "",
      member.motherGroup,
      member.talismanSeed === "yes" ? "符种 已受符种" : "",
      isAliveTalismanMember(member) ? "在世符种 符种在世 在世符咒 符咒在世" : "",
      lineageLabel(member)
    ]
      .join(" ")
      .toLowerCase();
    return !q || haystack.includes(q);
  });
}

function render() {
  saveState();
  applyMode();
  applyFont();
  updateTalismanStats();
  renderSelectors();
  renderTree();
}

function isAliveTalismanMember(member) {
  return member.talismanSeed === "yes" && member.lifeStatus !== "dead";
}

function updateTalismanStats() {
  const aliveCount = state.members.filter(isAliveTalismanMember).length;
  els.talismanTotalInput.value = talismanTotal;
  els.talismanAliveCount.textContent = `已受在世符种 ${aliveCount}`;
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
  renderTree();
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
  renderMemberRelationSelectors();
  fillSelect($("#husbandInput"), males, "请选择男方", false);
  fillSelect($("#wifeInput"), females, "请选择女方", false);
}

function renderMemberRelationSelectors() {
  const editingId = $("#editingId").value;
  const generation = Number($("#generationInput").value) || 1;
  const olderMales = state.members.filter((member) => member.gender === "male" && member.id !== editingId && (Number(member.generation) || 1) < generation);
  fillSelect($("#fatherInput"), olderMales, "未记载");
  fillSelect($("#adoptiveParentInput"), olderMales, "无");
  const fatherId = $("#fatherInput").value;
  fillSelect($("#motherInput"), mothersForFather(fatherId), fatherId ? "未记载" : "请先选择父亲");
}

function mothersForFather(fatherId) {
  if (!fatherId) return [];
  const wifeIds = new Set(
    state.marriages
      .filter((item) => item.husbandId === fatherId)
      .map((item) => item.wifeId)
  );
  return state.members.filter((member) => wifeIds.has(member.id));
}

function fillSelect(select, items, placeholder, includeBlank = true, selectedValue = select.value) {
  const current = selectedValue;
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
  const outAdopted = outAdoptedChildren(member.id).filter((child) => visibleIds.has(child.id));
  const isCollapsed = collapsed.has(member.id);
  const canCollapse = children.length > 0 || outAdopted.length > 0;
  const descendants = hiddenDescendantCount(member.id) + outAdopted.length;
  const card = renderCard(member, { canCollapse, isCollapsed, descendants });
  const nodeClasses = ["lineage-node"];
  if (canCollapse) nodeClasses.push("has-children", "has-mother-groups");
  if (outAdopted.length && !children.length) nodeClasses.push("has-adoptive-only");
  const childTree = !isCollapsed
    ? (children.length || outAdopted.length ? renderMotherGroups(member, children, visibleIds, outAdopted) : "")
    : "";
  return `<div class="${nodeClasses.join(" ")}">${card}${childTree}</div>`;
}

function outAdoptedChildren(memberId) {
  return state.members
    .filter((member) => member.adoptiveParentId && birthLineageParentId(member) === memberId && member.adoptiveParentId !== memberId)
    .sort((a, b) => a.generation - b.generation || memberIndex(a.id) - memberIndex(b.id));
}

function renderOutAdoptedMark(parent, child) {
  const type = adoptionTypeText(child.adoptionType) || "嗣子";
  const target = memberName(child.adoptiveParentId);
  const note = child.adoptionNote ? ` · ${child.adoptionNote}` : "";
  const children = childMembers(child.id);
  return `
    <div class="out-adopted-mark">
      <div>
        <b>${escapeHtml(child.name)}</b>
        <span>${escapeHtml(type)}，承嗣于 ${escapeHtml(target)}${escapeHtml(note)}</span>
      </div>
      ${
        children.length
          ? `<div class="out-adopted-descendants">${children.map((item) => `<span>${escapeHtml(item.name)}</span>`).join("")}</div>`
          : ""
      }
    </div>
  `;
}

function renderMotherGroups(parent, children, visibleIds, outAdopted = []) {
  const groups = motherGroupsFor(parent, children, outAdopted);
  return `
    <div class="mother-groups">
      ${groups
        .map((group) => `
          <div class="mother-group ${collapsed.has(group.id) ? "collapsed" : ""}">
            <div class="mother-node ${group.nodeClass}">
              <span>${escapeHtml(group.label)}</span>
              ${group.role ? `<b class="${group.roleClass}">${escapeHtml(group.role)}</b>` : ""}
              ${group.status ? `<b class="${group.statusClass}">${escapeHtml(group.status)}</b>` : ""}
            </div>
            ${
              collapsed.has(group.id)
                ? `<div class="branch-note">此母支已收起，共 ${group.entries.length} 位</div>`
                : `<div class="mother-children">${group.entries.map((entry) => entry.outAdopted ? renderOutAdoptedMark(parent, entry.member) : renderNode(entry.member, visibleIds)).join("")}</div>`
            }
          </div>
        `)
        .join("")}
    </div>
  `;
}

function motherGroupsFor(parent, children, outAdopted = []) {
  const groups = new Map();
  const addChild = (child, outAdoptedChild = false) => {
    const isAdoptiveBranch = child.adoptiveParentId === parent.id;
    const key = outAdoptedChild
      ? (child.motherId || `unknown:${child.motherGroup || ""}`)
      : (isAdoptiveBranch ? "adoptive" : (child.motherId || `unknown:${child.motherGroup || ""}`));
    if (!groups.has(key)) {
      groups.set(key, {
        id: `${parent.id}:mother:${key}`,
        label: !outAdoptedChild && isAdoptiveBranch ? "承嗣" : motherGroupLabel(child),
        role: !outAdoptedChild && isAdoptiveBranch ? "" : motherGroupRole(child),
        roleClass: !outAdoptedChild && isAdoptiveBranch ? "" : motherGroupRoleClass(child),
        status: !outAdoptedChild && isAdoptiveBranch ? "" : motherGroupStatus(child),
        statusClass: !outAdoptedChild && isAdoptiveBranch ? "" : motherGroupStatusClass(child),
        nodeClass: !outAdoptedChild && isAdoptiveBranch ? "adoptive-mother-node" : "",
        entries: []
      });
    }
    groups.get(key).entries.push({ member: child, outAdopted: outAdoptedChild });
  };
  children.forEach((child) => addChild(child, false));
  outAdopted.forEach((child) => addChild(child, true));
  return [...groups.values()];
}

function motherGroupLabel(child) {
  if (child.motherId) return memberName(child.motherId);
  return child.motherGroup ? `母未记 · ${child.motherGroup}` : "母未记";
}

function motherGroupStatus(child) {
  if (!child.motherId) return "";
  const marriage = marriageOfParents(child);
  if (marriage?.marriageStatus === "divorced") return "和离";
  const mother = state.members.find((member) => member.id === child.motherId);
  if (mother?.lifeStatus === "dead" || marriage?.marriageStatus === "deceased") return "已故";
  return "在世";
}

function motherGroupStatusClass(child) {
  const status = motherGroupStatus(child);
  if (status === "和离") return "mother-status divorced";
  if (status === "已故") return "mother-status deceased";
  if (status === "在世") return "mother-status alive";
  return "mother-status";
}

function motherGroupRole(child) {
  if (!child.motherId) return "";
  const marriage = marriageOfParents(child);
  if (!marriage) return "";
  return roleText(marriage.role);
}

function motherGroupRoleClass(child) {
  const role = motherGroupRole(child);
  if (role === "妾") return "mother-role concubine";
  if (role === "继妻") return "mother-role successor";
  if (role === "正妻") return "mother-role principal";
  return "mother-role";
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
    adoptionTypeText(member.adoptionType),
    statusText(member),
    member.lifeStatus === "dead" && member.deathCause ? `死因：${member.deathCause}` : ""
  ].filter(Boolean);
  const aliases = [member.courtesy && `字 ${member.courtesy}`, member.styleName && `号 ${member.styleName}`]
    .filter(Boolean)
    .join("，");
  const spouses = spouseLines(member.id);
  const detailRows = memberDetailRows(member);
  const relationRows = [
    member.notes
  ].filter(Boolean);

  return `
    <article class="member-card ${isCollapsed ? "collapsed" : ""}" data-member-id="${member.id}">
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
      ${spouses.length ? `<div class="spouse-row">${spouses.map((row) => `
        <div class="spouse-pill">
          <span>${escapeHtml(row.text)}</span>
          <span class="spouse-actions edit-only">
            <button class="text-chip" type="button" data-action="editMarriage" data-id="${row.id}">编辑</button>
            <button class="text-chip danger-chip" type="button" data-action="deleteMarriage" data-id="${row.id}">删除</button>
          </span>
        </div>
      `).join("")}</div>` : ""}
      ${detailRows.length ? `<div class="detail-grid">${detailRows.join("")}</div>` : ""}
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

function siblingOrderInfo(member) {
  const siblings = siblingGroup(member);
  const index = siblings.findIndex((item) => item.id === member.id);
  return {
    index: index >= 0 ? index + 1 : 1,
    total: Math.max(1, siblings.length)
  };
}

function memberDetailRows(member) {
  const rows = [];
  const item = (label, value, extraClass = "") => {
    if (!value) return;
    return `<span class="detail-item ${extraClass}"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></span>`;
  };
  const pushRow = (items, extraClass = "") => {
    const content = items.filter(Boolean).join("");
    if (content) rows.push(`<div class="detail-row ${extraClass}">${content}</div>`);
  };

  pushRow([item("号", member.styleName)], "single");
  pushRow([item("符种", talismanText(member.talismanSeed)), item("箓气", luqiText(member), luqiClass(member.luqi))], "split");
  pushRow([item("仙基", member.xianji), item("神通", member.shentong)], "split");
  pushRow([item("金性", member.jinxing)], "single");
  if (member.gender === "female") pushRow([item("外嫁子嗣", member.externalChildren)], "single");
  if (member.adoptiveParentId) {
    pushRow([item("承嗣于", memberName(member.adoptiveParentId)), item("承嗣备注", member.adoptionNote)], "split");
  }
  pushRow([item("字", member.courtesy)], "single muted-row");
  return rows;
}

function adoptionTypeText(value) {
  if (value === "heir") return "嗣子";
  if (value === "jiao") return "兼祧";
  if (value === "out") return "出继";
  return "";
}

function talismanText(value) {
  if (value === "yes") return "是";
  return "";
}

function luqiText(member) {
  if (!member.luqi && !member.luqiText) return "";
  if (!member.luqiText) return "有箓气";
  return member.luqiText;
}

function luqiClass(value) {
  if (value === "练气") return "luqi lianqi";
  if (value === "筑基") return "luqi zhuji";
  if (value === "紫府") return "luqi zifu";
  if (value === "金丹") return "luqi jindan";
  return "";
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
  if (tag.startsWith("生")) classes.push("alive");
  if (tag.includes("已故")) classes.push("dead");
  if (tag.startsWith("死因")) classes.push("death-cause");
  if (tag === "入赘支") classes.push("legitimate");
  if (tag === "嗣子" || tag === "兼祧" || tag === "出继") classes.push("adoptive-tag");
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
  $("#siblingOrderInput").value = 1;
  $("#birthStatusInput").value = "";
  $("#motherGroupInput").value = "";
  $("#adoptiveParentInput").value = "";
  $("#adoptionTypeInput").value = "";
  $("#adoptionNoteInput").value = "";
  $("#deathRankInput").value = "凡人";
  $("#talismanSeedInput").value = "";
  $("#luqiInput").value = "";
  $("#luqiTextInput").value = "";
  $("#xianjiInput").value = "";
  $("#shentongInput").value = "";
  $("#jinxingInput").value = "";
  $("#deathCauseInput").value = "";
  renderMemberRelationSelectors();
}

function openMemberDialog(title = "新增族人") {
  $("#memberDialogTitle").textContent = title;
  els.memberDialog.showModal();
  $("#nameInput").focus();
}

function memberFromForm() {
  const id = $("#editingId").value || uid("m");
  const existing = state.members.find((item) => item.id === id);
  return {
    id,
    name: $("#nameInput").value.trim(),
    gender: $("#genderInput").value,
    generation: Number($("#generationInput").value) || 1,
    courtesy: existing?.courtesy || "",
    styleName: $("#styleInput").value.trim(),
    fatherId: $("#fatherInput").value,
    motherId: $("#motherInput").value,
    motherGroup: $("#motherGroupInput").value.trim(),
    birthStatus: $("#birthStatusInput").value,
    adoptiveParentId: $("#adoptiveParentInput").value === id ? "" : $("#adoptiveParentInput").value,
    adoptionType: $("#adoptionTypeInput").value,
    adoptionNote: $("#adoptionNoteInput").value.trim(),
    lifeStatus: $("#lifeStatusInput").value,
    deathRank: $("#deathRankInput").value,
    talismanSeed: $("#talismanSeedInput").value,
    luqi: $("#luqiInput").value,
    luqiText: $("#luqiTextInput").value.trim(),
    xianji: $("#xianjiInput").value.trim(),
    shentong: $("#shentongInput").value.trim(),
    jinxing: $("#jinxingInput").value.trim(),
    externalChildren: existing?.externalChildren || "",
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
  $("#siblingOrderInput").value = siblingOrderInfo(member).index;
  renderMemberRelationSelectors();
  $("#styleInput").value = member.styleName || "";
  $("#fatherInput").value = member.fatherId || "";
  $("#adoptiveParentInput").value = member.adoptiveParentId || "";
  renderMemberRelationSelectors();
  $("#motherInput").value = member.motherId || "";
  $("#motherGroupInput").value = member.motherGroup || "";
  $("#birthStatusInput").value = member.birthStatus || "";
  $("#adoptiveParentInput").value = member.adoptiveParentId || "";
  $("#adoptionTypeInput").value = member.adoptionType || "";
  $("#adoptionNoteInput").value = member.adoptionNote || "";
  $("#lifeStatusInput").value = member.lifeStatus || "alive";
  $("#deathRankInput").value = CULTIVATION_LEVELS.includes(member.deathRank) ? member.deathRank : "凡人";
  $("#talismanSeedInput").value = member.talismanSeed || "";
  $("#luqiInput").value = member.luqi || "";
  $("#luqiTextInput").value = member.luqiText || "";
  $("#xianjiInput").value = member.xianji || "";
  $("#shentongInput").value = member.shentong || "";
  $("#jinxingInput").value = member.jinxing || "";
  $("#deathCauseInput").value = member.deathCause || "";
  $("#notesInput").value = member.notes || "";
  openMemberDialog(`编辑：${member.name}`);
}

function openDeleteDialog(id) {
  const name = memberName(id);
  $("#deleteKindInput").value = "member";
  $("#deleteMemberId").value = id;
  $("#deleteDialogTitle").textContent = "删除族人";
  $("#deleteMessage").textContent = `确定删除「${name}」？`;
  $("#deleteWarning").textContent = "相关婚配会一并移除，子女的父母记录会清空。";
  $("#deleteDialog").showModal();
}

function deleteMember(id) {
  const relatedMarriages = state.marriages.filter((item) => item.husbandId === id || item.wifeId === id);
  const removableSpouses = new Set();
  relatedMarriages.forEach((marriage) => {
    const otherId = marriage.husbandId === id ? marriage.wifeId : marriage.husbandId;
    if (canRemoveIsolatedSpouse(otherId, marriage.id)) removableSpouses.add(otherId);
  });
  state.members = state.members
    .filter((member) => member.id !== id && !removableSpouses.has(member.id))
    .map((member) => ({
      ...member,
      fatherId: member.fatherId === id ? "" : member.fatherId,
      motherId: member.motherId === id ? "" : member.motherId,
      adoptiveParentId: member.adoptiveParentId === id ? "" : member.adoptiveParentId
    }));
  state.marriages = state.marriages.filter((item) => item.husbandId !== id && item.wifeId !== id);
  collapsed.delete(id);
  saveCollapsed();
  render();
}

function prepareChild(parentId) {
  const parent = state.members.find((member) => member.id === parentId);
  if (!parent) return;
  if (parent.gender === "female") {
    openExternalChildrenDialog(parent.id);
    return;
  }
  resetForm();
  $("#generationInput").value = (Number(parent.generation) || 1) + 1;
  renderMemberRelationSelectors();
  $("#fatherInput").value = parent.id;
  renderMemberRelationSelectors();
  openMemberDialog(`为 ${parent.name} 添子女`);
}

function openExternalChildrenDialog(memberId) {
  const member = state.members.find((item) => item.id === memberId && item.gender === "female");
  if (!member) return;
  $("#externalChildrenMemberId").value = member.id;
  $("#externalChildrenTitle").textContent = `为 ${member.name} 记录外嫁子嗣`;
  $("#externalChildrenInput").value = member.externalChildren || "";
  $("#externalChildrenDialog").showModal();
  $("#externalChildrenInput").focus();
}

function prepareSpouse(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return;
  $("#marriageIdInput").value = "";
  $("#husbandInput").value = member.gender === "male" ? member.id : "";
  $("#wifeInput").value = member.gender === "female" ? member.id : "";
  $("#newHusbandInput").value = "";
  $("#newWifeInput").value = "";
  $("#spouseRoleInput").value = "principal";
  $("#marriageStatusInput").value = "current";
  $("#residenceInput").value = "patrilocal";
  $("#marriageNotesInput").value = "";
  els.dialog.showModal();
}

function editMarriage(id) {
  const marriage = state.marriages.find((item) => item.id === id);
  if (!marriage) return;
  $("#marriageIdInput").value = marriage.id;
  $("#husbandInput").value = marriage.husbandId || "";
  $("#wifeInput").value = marriage.wifeId || "";
  $("#newHusbandInput").value = "";
  $("#newWifeInput").value = "";
  $("#spouseRoleInput").value = marriage.role || "principal";
  $("#marriageStatusInput").value = marriage.marriageStatus || "current";
  $("#residenceInput").value = marriage.residence || "patrilocal";
  $("#marriageNotesInput").value = marriage.notes || "";
  els.dialog.showModal();
}

function deleteMarriage(id) {
  const marriage = state.marriages.find((item) => item.id === id);
  if (!marriage) return;
  $("#deleteKindInput").value = "marriage";
  $("#deleteMemberId").value = id;
  $("#deleteDialogTitle").textContent = "删除婚配";
  $("#deleteMessage").textContent = `确定删除「${memberName(marriage.husbandId)}」与「${memberName(marriage.wifeId)}」的婚配记录？`;
  $("#deleteWarning").textContent = "如果对方只是孤立的妻妾/夫婿，且没有子女或其他关系，会一并从图谱中移除。";
  $("#deleteDialog").showModal();
}

function confirmDeleteMarriage(id) {
  const marriage = state.marriages.find((item) => item.id === id);
  if (!marriage) return;
  const removableIds = removableSpouseIdsAfterMarriageDelete(marriage);
  state.marriages = state.marriages.filter((item) => item.id !== id);
  state.members = state.members.filter((member) => !removableIds.has(member.id));
  render();
}

function removableSpouseIdsAfterMarriageDelete(marriage) {
  const residence = marriage.residence || "patrilocal";
  const ids = [];
  if (residence === "patrilocal") ids.push(marriage.wifeId);
  if (residence === "matrilocal") ids.push(marriage.husbandId);
  return new Set(ids.filter((id) => canRemoveIsolatedSpouse(id, marriage.id)));
}

function canRemoveIsolatedSpouse(memberId, deletingMarriageId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return false;
  if (birthLineageParentId(member) || member.adoptiveParentId) return false;
  if (member.externalChildren || member.notes) return false;
  const hasOtherMarriage = state.marriages.some((item) => item.id !== deletingMarriageId && (item.husbandId === memberId || item.wifeId === memberId));
  if (hasOtherMarriage) return false;
  return !state.members.some((item) => item.fatherId === memberId || item.motherId === memberId || item.adoptiveParentId === memberId);
}

function createSpouseMember(name, gender, spouseId) {
  const spouse = state.members.find((member) => member.id === spouseId);
  const generation = spouse ? Number(spouse.generation) || 1 : 1;
  const member = {
    id: uid("m"),
    name,
    gender,
    generation,
    courtesy: "",
    styleName: "",
    fatherId: "",
    motherId: "",
    motherGroup: "",
    birthStatus: "",
    lifeStatus: "alive",
    deathRank: "凡人",
    talismanSeed: "",
    luqi: "",
    luqiText: "",
    xianji: "",
    shentong: "",
    jinxing: "",
    externalChildren: "",
    adoptiveParentId: "",
    adoptionType: "",
    adoptionNote: "",
    deathCause: "",
    notes: ""
  };
  state.members.push(member);
  return member.id;
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
  setMemberSiblingOrder(member.id, Number($("#siblingOrderInput").value), false);
  resetForm();
  els.memberDialog.close();
  render();
});

$("#externalChildrenForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const memberId = $("#externalChildrenMemberId").value;
  const member = state.members.find((item) => item.id === memberId && item.gender === "female");
  if (!member) return;
  member.externalChildren = $("#externalChildrenInput").value.trim();
  $("#externalChildrenDialog").close();
  render();
});

els.marriageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  let husbandId = $("#husbandInput").value;
  let wifeId = $("#wifeInput").value;
  const newHusbandName = $("#newHusbandInput").value.trim();
  const newWifeName = $("#newWifeInput").value.trim();

  if (!husbandId && newHusbandName) {
    husbandId = createSpouseMember(newHusbandName, "male", wifeId);
  }
  if (!wifeId && newWifeName) {
    wifeId = createSpouseMember(newWifeName, "female", husbandId);
  }
  if (!husbandId || !wifeId) {
    alert("请选择已有男方/女方，或填写新男方/新女方姓名。");
    return;
  }

  const marriageId = $("#marriageIdInput").value;
  const existing = marriageId
    ? state.marriages.find((item) => item.id === marriageId)
    : state.marriages.find((item) => item.husbandId === husbandId && item.wifeId === wifeId);
  const marriage = {
    id: existing?.id || uid("r"),
    husbandId,
    wifeId,
    role: $("#spouseRoleInput").value,
    residence: $("#residenceInput").value,
    marriageStatus: $("#marriageStatusInput").value,
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
  if (action === "delete") openDeleteDialog(id);
  if (action === "child") prepareChild(id);
  if (action === "spouse") prepareSpouse(id);
  if (action === "editMarriage") editMarriage(id);
  if (action === "deleteMarriage") deleteMarriage(id);
});

function setMemberSiblingOrder(memberId, nextOrder, shouldRender = true) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return;
  const siblings = siblingGroup(member);
  if (siblings.length <= 1) return;
  const currentIndex = siblings.findIndex((item) => item.id === memberId);
  const targetIndex = Math.min(Math.max(1, nextOrder || 1), siblings.length) - 1;
  if (currentIndex === targetIndex) return;
  const orderedIds = siblings.map((item) => item.id).filter((id) => id !== memberId);
  orderedIds.splice(targetIndex, 0, memberId);
  reorderSiblingGroup(orderedIds);
  if (shouldRender) render();
}

function reorderSiblingGroup(orderedIds) {
  const orderSet = new Set(orderedIds);
  const orderedMembers = orderedIds
    .map((id) => state.members.find((member) => member.id === id))
    .filter(Boolean);
  let cursor = 0;
  state.members = state.members.map((member) => {
    if (!orderSet.has(member.id)) return member;
    const next = orderedMembers[cursor];
    cursor += 1;
    return next;
  });
}

$("#expandAllBtn").addEventListener("click", () => {
  collapsed.clear();
  saveCollapsed();
  renderTree();
});
$("#collapseAllBtn").addEventListener("click", () => {
  state.members.forEach((member) => {
    if (childMembers(member.id).length || outAdoptedChildren(member.id).length) collapsed.add(member.id);
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
els.talismanTotalInput.addEventListener("input", () => {
  talismanTotal = Math.max(0, Number(els.talismanTotalInput.value) || 0);
  localStorage.setItem(TALISMAN_TOTAL_KEY, String(talismanTotal));
  updateTalismanStats();
});
$("#generationInput").addEventListener("input", renderMemberRelationSelectors);
$("#fatherInput").addEventListener("change", renderMemberRelationSelectors);
$("#viewModeBtn").addEventListener("click", () => setMode("view"));
$("#editModeBtn").addEventListener("click", () => setMode("edit"));
$("#addRootBtn").addEventListener("click", () => {
  resetForm();
  openMemberDialog("新增族人");
});
$("#closeMarriageBtn").addEventListener("click", () => {
  els.marriageForm.reset();
  $("#marriageIdInput").value = "";
  els.dialog.close();
});
$("#closeMemberBtn").addEventListener("click", () => {
  resetForm();
  els.memberDialog.close();
});
$("#cancelEditBtn").addEventListener("click", () => {
  resetForm();
  els.memberDialog.close();
});
$("#closeExternalChildrenBtn").addEventListener("click", () => $("#externalChildrenDialog").close());
$("#cancelExternalChildrenBtn").addEventListener("click", () => $("#externalChildrenDialog").close());
$("#deleteForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("#deleteMemberId").value;
  const kind = $("#deleteKindInput").value;
  $("#deleteDialog").close();
  if (kind === "marriage") {
    confirmDeleteMarriage(id);
  } else {
    deleteMember(id);
  }
});
$("#closeDeleteBtn").addEventListener("click", () => $("#deleteDialog").close());
$("#cancelDeleteBtn").addEventListener("click", () => $("#deleteDialog").close());
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

$("#exportTreeBtn").addEventListener("click", () => {
  exportTreeSvg();
  els.moonMenuPanel.hidden = true;
  els.moonMenuBtn.setAttribute("aria-expanded", "false");
});

function exportTreeSvg() {
  if (!els.treeView.querySelector(".lineage-forest")) {
    alert("当前没有可导出的谱图。");
    return;
  }
  const tree = els.treeView.cloneNode(true);
  const width = Math.max(900, els.treeView.scrollWidth);
  const height = Math.max(520, els.treeView.scrollHeight);
  tree.style.width = `${width}px`;
  tree.style.height = `${height}px`;
  tree.style.overflow = "visible";
  tree.style.padding = "48px 48px 56px";

  const css = [...document.styleSheets]
    .map((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");

  const html = `
    <div xmlns="http://www.w3.org/1999/xhtml" class="${document.body.className}" style="background:#fbf2e5;width:${width}px;min-height:${height}px;">
      <style>
        ${css}
        .tree-view { overflow: visible !important; border: 0 !important; margin: 0 !important; box-shadow: none !important; }
        .card-actions, .tree-tools { display: none !important; }
      </style>
      ${tree.outerHTML}
    </div>
  `;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">${html}</foreignObject>
    </svg>
  `;
  downloadBlob(svg.trim(), `zupu-tree-${new Date().toISOString().slice(0, 10)}.svg`, "image/svg+xml;charset=utf-8");
  alert("谱图 SVG 已开始导出。");
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}

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
