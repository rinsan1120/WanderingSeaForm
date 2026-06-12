const DRAFT_STORAGE_KEY = "hyohaku-letter-form-draft-v1";
const DRAFT_SAVE_DELAY_MS = 450;
const MOCK_SUBMISSION_DELAY_MS = 2400;
const NG_WORDS_URL = "content/ng-words.json";
const NG_WORD_ERROR_MESSAGE = "使用できない単語が含まれています。内容をご確認ください。";

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
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.warn("下書き保存を利用できない環境です。", error);
    }
  }
};

const form = document.getElementById("submissionForm");
const senderNameInput = document.getElementById("senderName");
const titleInput = document.getElementById("title");
const bodyInput = document.getElementById("body");
const messageToManagerInput = document.getElementById("messageToManager");
const agreementInput = document.getElementById("agreement");
const clearDraftButton = document.getElementById("clearDraftButton");
const confirmSubmissionButton = document.getElementById("confirmSubmissionButton");
const draftStatus = document.getElementById("draftStatus");
const ngWordsLoadError = document.getElementById("ngWordsLoadError");

const senderNameCount = document.getElementById("senderNameCount");
const titleCount = document.getElementById("titleCount");
const bodyCount = document.getElementById("bodyCount");
const messageToManagerCount = document.getElementById("messageToManagerCount");

const senderNameError = document.getElementById("senderNameError");
const titleError = document.getElementById("titleError");
const bodyError = document.getElementById("bodyError");
const messageToManagerError = document.getElementById("messageToManagerError");
const agreementError = document.getElementById("agreementError");

const previewModal = document.getElementById("previewModal");
const closePreviewButton = document.getElementById("closePreviewButton");
const editButton = document.getElementById("editButton");
const submitLetterButton = document.getElementById("submitLetterButton");
const previewLetterTitle = document.getElementById("previewLetterTitle");
const previewLetterBody = document.getElementById("previewLetterBody");
const previewLetterSender = document.getElementById("previewLetterSender");
const previewMessageToManagerWrapper = document.getElementById("previewMessageToManagerWrapper");
const previewMessageToManager = document.getElementById("previewMessageToManager");

const submissionScene = document.getElementById("submissionScene");
const submissionSceneStatus = document.getElementById("submissionSceneStatus");
const submissionResult = document.getElementById("submissionResult");
const writeAnotherButton = document.getElementById("writeAnotherButton");
const siteHeader = document.querySelector(".site-header");

let saveTimer = null;
let isSubmitting = false;
let hasAttemptedSubmit = false;
let ngWordsStatus = "loading";
let normalizedNgWords = [];

function getFormData() {
  return {
    senderName: senderNameInput.value.trim(),
    title: titleInput.value.trim(),
    body: bodyInput.value.trim(),
    messageToManager: messageToManagerInput.value.trim(),
    agreement: agreementInput.checked
  };
}

function updateCharacterCounts() {
  senderNameCount.textContent = String(senderNameInput.value.length);
  titleCount.textContent = String(titleInput.value.length);
  bodyCount.textContent = String(bodyInput.value.length);
  messageToManagerCount.textContent = String(messageToManagerInput.value.length);
}

function setFieldError(input, errorElement, message) {
  errorElement.textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function normalizeForNgWordCheck(value) {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "");
}

function containsNgWord(value) {
  if (ngWordsStatus !== "ready") return false;
  const normalizedValue = normalizeForNgWordCheck(value);
  return normalizedNgWords.some((word) => normalizedValue.includes(word));
}

function getValidationState() {
  const data = getFormData();
  const baseErrors = {
    senderName: data.senderName ? "" : "差出人を入力してください。",
    title: data.title ? "" : "標題を入力してください。",
    body: !data.body
      ? "本文を入力してください。"
      : data.body.length < 10
        ? "本文は10文字以上で入力してください。"
        : "",
    messageToManager: data.messageToManager.length > 500
      ? "駅長へのご要望・ご連絡事項は500文字以内で入力してください。"
      : "",
    agreement: data.agreement ? "" : "内容を確認し、同意欄にチェックを入れてください。"
  };
  const ngWordErrors = {
    senderName: containsNgWord(senderNameInput.value),
    title: containsNgWord(titleInput.value),
    body: containsNgWord(bodyInput.value),
    messageToManager: containsNgWord(messageToManagerInput.value)
  };
  const hasBaseError = Object.values(baseErrors).some(Boolean);
  const hasNgWordError = Object.values(ngWordErrors).some(Boolean);

  return {
    baseErrors,
    ngWordErrors,
    isValid: ngWordsStatus === "ready" && !hasBaseError && !hasNgWordError
  };
}

function renderValidationErrors(validationState, showBaseErrors = hasAttemptedSubmit) {
  const { baseErrors, ngWordErrors } = validationState;

  setFieldError(
    senderNameInput,
    senderNameError,
    ngWordErrors.senderName ? NG_WORD_ERROR_MESSAGE : showBaseErrors ? baseErrors.senderName : ""
  );
  setFieldError(
    titleInput,
    titleError,
    ngWordErrors.title ? NG_WORD_ERROR_MESSAGE : showBaseErrors ? baseErrors.title : ""
  );
  setFieldError(
    bodyInput,
    bodyError,
    ngWordErrors.body
      ? NG_WORD_ERROR_MESSAGE
      : (hasAttemptedSubmit || bodyInput.value.length > 0)
        ? baseErrors.body
        : ""
  );
  setFieldError(
    messageToManagerInput,
    messageToManagerError,
    ngWordErrors.messageToManager
      ? NG_WORD_ERROR_MESSAGE
      : baseErrors.messageToManager
  );
  agreementError.textContent = showBaseErrors ? baseErrors.agreement : "";
  agreementInput.setAttribute("aria-invalid", showBaseErrors && baseErrors.agreement ? "true" : "false");
}

function updateValidationState({ showBaseErrors = hasAttemptedSubmit } = {}) {
  const validationState = getValidationState();
  renderValidationErrors(validationState, showBaseErrors);
  confirmSubmissionButton.disabled = !validationState.isValid;
  return validationState;
}

function validateForm() {
  hasAttemptedSubmit = true;
  const validationState = updateValidationState({ showBaseErrors: true });

  if (!validationState.isValid) {
    const firstInvalid = form.querySelector('[aria-invalid="true"], input:invalid');
    firstInvalid?.focus();
  }

  return validationState.isValid;
}

async function loadNgWords() {
  ngWordsStatus = "loading";
  ngWordsLoadError.hidden = true;
  updateValidationState();

  try {
    const response = await fetch(NG_WORDS_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`NGワード一覧の取得に失敗しました（HTTP ${response.status}）。`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.words) || data.words.some((word) => typeof word !== "string")) {
      throw new Error("NGワード一覧のJSON形式が不正です。");
    }

    normalizedNgWords = [...new Set(data.words.map(normalizeForNgWordCheck).filter(Boolean))];
    ngWordsStatus = "ready";
  } catch (error) {
    console.error("NGワード一覧の読み込みに失敗しました。", error);
    normalizedNgWords = [];
    ngWordsStatus = "error";
    ngWordsLoadError.hidden = false;
  }

  updateValidationState();
}

function saveDraft() {
  const data = getFormData();
  const hasDraft = data.senderName || data.title || data.body || data.messageToManager || data.agreement;

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
    messageToManagerInput.value = data.messageToManager ?? "";
    agreementInput.checked = Boolean(data.agreement);
    draftStatus.textContent = "保存されていた下書きを復元しました";
  } catch (error) {
    console.error("下書きの復元に失敗しました。", error);
    draftStorage.remove();
    draftStatus.textContent = "下書き未保存";
  }

  updateCharacterCounts();
  updateValidationState();
}

function clearDraft({ askConfirmation = true } = {}) {
  const hasContent =
    senderNameInput.value ||
    titleInput.value ||
    bodyInput.value ||
    messageToManagerInput.value ||
    agreementInput.checked;

  if (askConfirmation && hasContent) {
    const shouldClear = window.confirm("この端末に保存された下書きと入力内容を消しますか？");
    if (!shouldClear) return;
  }

  form.reset();
  draftStorage.remove();
  draftStatus.textContent = "下書きを削除しました";
  hasAttemptedSubmit = false;
  updateCharacterCounts();
  updateValidationState({ showBaseErrors: false });
}

function openPreview() {
  const data = getFormData();

  previewLetterTitle.textContent = data.title;
  previewLetterBody.textContent = data.body;
  previewLetterSender.textContent = data.senderName ? `差出人　${data.senderName}` : "差出人　名もなき旅人";
  previewMessageToManagerWrapper.hidden = !data.messageToManager;
  previewMessageToManager.textContent = data.messageToManager;

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

[
  senderNameInput,
  titleInput,
  bodyInput,
  messageToManagerInput
].forEach((input) => {
  input.addEventListener("input", () => {
    updateCharacterCounts();
    updateValidationState();
    scheduleDraftSave();
  });
});

form.addEventListener("change", () => {
  updateValidationState();
  scheduleDraftSave();
});

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

// ブラウザ側の判定は即時フィードバック用。GAS連携時は要望欄を含め、同じ条件をサーバー側でも必ず検証する。
loadNgWords();
