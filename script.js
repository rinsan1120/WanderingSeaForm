const DRAFT_STORAGE_KEY = "hyohaku-letter-form-draft-v1";
const DRAFT_SAVE_DELAY_MS = 450;
const MOCK_SUBMISSION_DELAY_MS = 2400;

const draftStorage = {
  get() {
    try {
      return window.localStorage.getItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.warn("下書き保存を利用できない環境です。", error);
      return null;
    }
  },
  set(value) {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, value);
      return true;
    } catch (error) {
      console.warn("下書き保存を利用できない環境です。", error);
      return false;
    }
  },
  remove() {
    try {
      window.draftStorage.remove();
    } catch (error) {
      console.warn("下書き保存を利用できない環境です。", error);
    }
  }
};

const form = document.getElementById("submissionForm");
const senderNameInput = document.getElementById("senderName");
const titleInput = document.getElementById("title");
const bodyInput = document.getElementById("body");
const agreementInput = document.getElementById("agreement");
const clearDraftButton = document.getElementById("clearDraftButton");
const draftStatus = document.getElementById("draftStatus");

const senderNameCount = document.getElementById("senderNameCount");
const titleCount = document.getElementById("titleCount");
const bodyCount = document.getElementById("bodyCount");

const senderNameError = document.getElementById("senderNameError");
const titleError = document.getElementById("titleError");
const bodyError = document.getElementById("bodyError");
const agreementError = document.getElementById("agreementError");

const previewModal = document.getElementById("previewModal");
const closePreviewButton = document.getElementById("closePreviewButton");
const editButton = document.getElementById("editButton");
const submitLetterButton = document.getElementById("submitLetterButton");
const previewLetterTitle = document.getElementById("previewLetterTitle");
const previewLetterBody = document.getElementById("previewLetterBody");
const previewLetterSender = document.getElementById("previewLetterSender");

const submissionScene = document.getElementById("submissionScene");
const submissionSceneStatus = document.getElementById("submissionSceneStatus");
const submissionResult = document.getElementById("submissionResult");
const writeAnotherButton = document.getElementById("writeAnotherButton");
const siteHeader = document.querySelector(".site-header");

let saveTimer = null;
let isSubmitting = false;

function getFormData() {
  return {
    senderName: senderNameInput.value.trim(),
    title: titleInput.value.trim(),
    body: bodyInput.value.trim(),
    agreement: agreementInput.checked
  };
}

function updateCharacterCounts() {
  senderNameCount.textContent = String(senderNameInput.value.length);
  titleCount.textContent = String(titleInput.value.length);
  bodyCount.textContent = String(bodyInput.value.length);
}

function setFieldError(input, errorElement, message) {
  errorElement.textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validateForm() {
  const data = getFormData();
  let isValid = true;

  setFieldError(senderNameInput, senderNameError, "");
  setFieldError(titleInput, titleError, "");
  setFieldError(bodyInput, bodyError, "");
  agreementError.textContent = "";

  if (!data.title) {
    setFieldError(titleInput, titleError, "標題を入力してください。");
    isValid = false;
  }

  if (!data.body) {
    setFieldError(bodyInput, bodyError, "本文を入力してください。");
    isValid = false;
  } else if (data.body.length < 10) {
    setFieldError(bodyInput, bodyError, "本文は10文字以上で入力してください。");
    isValid = false;
  }

  if (!data.agreement) {
    agreementError.textContent = "内容を確認し、同意欄にチェックを入れてください。";
    isValid = false;
  }

  if (!isValid) {
    const firstInvalid = form.querySelector('[aria-invalid="true"], input:invalid');
    firstInvalid?.focus();
  }

  return isValid;
}

function saveDraft() {
  const data = getFormData();
  const hasDraft = data.senderName || data.title || data.body || data.agreement;

  if (!hasDraft) {
    draftStorage.remove();
    draftStatus.textContent = "下書き未保存";
    return;
  }

  const saved = draftStorage.set(JSON.stringify(data));
  draftStatus.textContent = saved ? "この端末に下書きを保存しました" : "下書き保存は利用できません";
}

function scheduleDraftSave() {
  draftStatus.textContent = "下書きを保存しています……";
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveDraft, DRAFT_SAVE_DELAY_MS);
}

function restoreDraft() {
  const savedDraft = draftStorage.get();
  if (!savedDraft) {
    updateCharacterCounts();
    return;
  }

  try {
    const data = JSON.parse(savedDraft);
    senderNameInput.value = data.senderName ?? "";
    titleInput.value = data.title ?? "";
    bodyInput.value = data.body ?? "";
    agreementInput.checked = Boolean(data.agreement);
    draftStatus.textContent = "保存されていた下書きを復元しました";
  } catch (error) {
    console.error("下書きの復元に失敗しました。", error);
    draftStorage.remove();
    draftStatus.textContent = "下書き未保存";
  }

  updateCharacterCounts();
}

function clearDraft({ askConfirmation = true } = {}) {
  const hasContent = senderNameInput.value || titleInput.value || bodyInput.value || agreementInput.checked;

  if (askConfirmation && hasContent) {
    const shouldClear = window.confirm("この端末に保存された下書きと入力内容を消しますか？");
    if (!shouldClear) return;
  }

  form.reset();
  draftStorage.remove();
  draftStatus.textContent = "下書きを削除しました";
  updateCharacterCounts();

  [
    [senderNameInput, senderNameError],
    [titleInput, titleError],
    [bodyInput, bodyError]
  ].forEach(([input, errorElement]) => setFieldError(input, errorElement, ""));

  agreementError.textContent = "";
}

function openPreview() {
  const data = getFormData();

  previewLetterTitle.textContent = data.title;
  previewLetterBody.textContent = data.body;
  previewLetterSender.textContent = data.senderName ? `差出人　${data.senderName}` : "差出人　名もなき旅人";

  previewModal.showModal();
  document.body.classList.add("modal-open");

  requestAnimationFrame(() => {
    previewModal.classList.add("is-visible");
  });
}

function closePreview() {
  previewModal.classList.remove("is-visible");
  document.body.classList.remove("modal-open");

  window.setTimeout(() => {
    if (previewModal.open) previewModal.close();
  }, 260);
}

async function runMockSubmission() {
  if (isSubmitting) return;
  isSubmitting = true;
  submitLetterButton.disabled = true;

  previewModal.classList.remove("is-visible");
  if (previewModal.open) previewModal.close();

  submissionScene.hidden = false;
  submissionScene.setAttribute("aria-hidden", "false");
  submissionSceneStatus.hidden = false;
  submissionResult.hidden = true;
  submissionScene.classList.add("is-active", "is-sending");
  document.body.classList.add("modal-open");

  await new Promise((resolve) => window.setTimeout(resolve, MOCK_SUBMISSION_DELAY_MS));

  submissionSceneStatus.hidden = true;
  submissionResult.hidden = false;
  submissionScene.classList.remove("is-sending");
  draftStorage.remove();
  isSubmitting = false;
  submitLetterButton.disabled = false;
}

function closeSubmissionScene() {
  submissionScene.classList.remove("is-active", "is-sending");
  submissionScene.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");

  window.setTimeout(() => {
    clearDraft({ askConfirmation: false });
    submissionScene.hidden = true;
    document.getElementById("letterForm").scrollIntoView({ behavior: "smooth", block: "start" });
    titleInput.focus({ preventScroll: true });
  }, 500);
}

form.addEventListener("input", () => {
  updateCharacterCounts();
  scheduleDraftSave();
});

form.addEventListener("change", scheduleDraftSave);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateForm()) return;
  saveDraft();
  openPreview();
});

clearDraftButton.addEventListener("click", () => clearDraft());
closePreviewButton.addEventListener("click", closePreview);
editButton.addEventListener("click", closePreview);
submitLetterButton.addEventListener("click", runMockSubmission);
writeAnotherButton.addEventListener("click", closeSubmissionScene);

previewModal.addEventListener("click", (event) => {
  if (event.target === previewModal) closePreview();
});

previewModal.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePreview();
});

window.addEventListener("scroll", () => {
  siteHeader.classList.toggle("is-scrolled", window.scrollY > 30);
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((element) => {
  revealObserver.observe(element);
});

restoreDraft();
