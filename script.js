const DRAFT_STORAGE_KEY = "hyohaku-letter-form-draft-v1";
const DRAFT_SAVE_DELAY_MS = 450;
const MOCK_SUBMISSION_DELAY_MS = 2400;
const NG_WORDS_URL = "content/ng-words.json";
const NG_WORD_ERROR_MESSAGE = "使用できない単語が含まれています。内容をご確認ください。";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzXF5NHG1mrkaOJBqbXRmlotvcX9If5d_lqa2xnDSSzA3LzJF4rishV5KLZmndcasquQg/exec";
const FAQ_CONTENT_URL = "content/faq.txt";
const PUBLICATION_STATUS_API_URL =
  "https://script.google.com/macros/s/AKfycbxKP3hYT3CVaqZRCS8b8qvOK_41JCf5ADt9xr-I7TICG0t4YdlmFNtTXxXfKSI4CqqAtQ/exec";
const PUBLICATION_STATUS_CALLBACK_NAME =
  "handlePublicationStatusResponse";
const PUBLICATION_STATUS_TIMEOUT_MS = 10000;

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
const turnstileError = document.getElementById("turnstileError");

let turnstileToken = "";
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
const faqList = document.getElementById("faqList");
const faqStatus = document.getElementById("faqStatus");
const publicationStatusText =
  document.getElementById("publicationStatusText");
const openLetterRulesButton =
  document.getElementById("openLetterRulesButton");

const closeLetterRulesButton =
  document.getElementById("closeLetterRulesButton");

const letterRulesModal =
  document.getElementById("letterRulesModal");

const letterRulesModalContent =
  document.getElementById("letterRulesModalContent");

const LETTER_RULES_URL = "content/letter-guidelines.html";

let letterRulesLoaded = false;
let saveTimer = null;
let isSubmitting = false;
let hasAttemptedSubmit = false;
let ngWordsStatus = "loading";
let normalizedNgWords = [];
let publicationStatusScript = null;
let publicationStatusTimer = null;
let publicationStatusSettled = false;

function cleanupPublicationStatusRequest() {
  window.clearTimeout(publicationStatusTimer);
  publicationStatusTimer = null;

  publicationStatusScript?.remove();
  publicationStatusScript = null;
}

function showPublicationStatusError() {
  if (publicationStatusSettled) return;

  publicationStatusSettled = true;
  cleanupPublicationStatusRequest();

  if (publicationStatusText) {
    publicationStatusText.textContent =
      "掲載状況を取得できませんでした";
  }
}

function formatPublicationStatusDate(value) {
  if (typeof value !== "string") return null;

  const match =
    /^(\d{4})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hour, minute] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}年${month}月${day}日 ${hour}:${minute}`;
}

function handlePublicationStatusResponse(data) {
  if (publicationStatusSettled) return;

  const formattedDate =
    formatPublicationStatusDate(data?.last_updated);
  if (!formattedDate) {
    showPublicationStatusError();
    return;
  }

  publicationStatusSettled = true;
  cleanupPublicationStatusRequest();

  if (publicationStatusText) {
    publicationStatusText.textContent =
      `掲載状況：${formattedDate}頃までに投函されたお手紙を掲載しています。`;
  }
}

window[PUBLICATION_STATUS_CALLBACK_NAME] =
  handlePublicationStatusResponse;

function loadPublicationStatus() {
  if (!publicationStatusText) return;

  try {
    const url = new URL(PUBLICATION_STATUS_API_URL);
    url.searchParams.set(
      "callback",
      PUBLICATION_STATUS_CALLBACK_NAME
    );
    url.searchParams.set("_", String(Date.now()));

    publicationStatusScript = document.createElement("script");
    publicationStatusScript.src = url.href;
    publicationStatusScript.async = true;
    publicationStatusScript.addEventListener(
      "error",
      showPublicationStatusError,
      { once: true }
    );

    publicationStatusTimer = window.setTimeout(
      showPublicationStatusError,
      PUBLICATION_STATUS_TIMEOUT_MS
    );
    document.head.append(publicationStatusScript);
  } catch {
    showPublicationStatusError();
  }
}

function parseFaqContent(content) {
  const faqItems = [];
  let currentQuestion = null;
  let answerLines = null;

  function commitCurrentItem() {
    if (currentQuestion && answerLines) {
      const answer = answerLines.join("\n").trim();
      if (answer) {
        faqItems.push({
          question: currentQuestion,
          answer
        });
      }
    }

    currentQuestion = null;
    answerLines = null;
  }

  String(content).replace(/\r\n?/g, "\n").split("\n").forEach((line) => {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("(Q)")) {
      commitCurrentItem();
      currentQuestion = trimmedLine.slice(3).trim() || null;
      return;
    }

    if (trimmedLine.startsWith("(A)")) {
      if (currentQuestion) {
        answerLines = [trimmedLine.slice(3).trim()];
      }
      return;
    }

    if (currentQuestion && answerLines) {
      answerLines.push(trimmedLine);
    }
  });

  commitCurrentItem();
  return faqItems;
}

function createFaqBadge(label) {
  const badge = document.createElement("span");
  badge.className = "faq-badge";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = label;
  return badge;
}

function getSafeFaqUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function appendFaqAnswerContent(element, content) {
  const linkPattern = /\[([^\]\r\n]+)\]\(([^)\r\n]+)\)/g;
  let lastIndex = 0;

  for (const match of content.matchAll(linkPattern)) {
    element.append(document.createTextNode(content.slice(lastIndex, match.index)));

    const linkText = match[1].trim();
    const safeUrl = getSafeFaqUrl(match[2].trim());
    if (linkText && safeUrl) {
      const link = document.createElement("a");
      link.href = safeUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = linkText;
      element.append(link);
    } else {
      element.append(document.createTextNode(match[0]));
    }

    lastIndex = match.index + match[0].length;
  }

  element.append(document.createTextNode(content.slice(lastIndex)));
}

function renderFaqItems(faqItems) {
  faqList.replaceChildren();

  faqItems.forEach(({ question, answer }) => {
    const item = document.createElement("details");
    item.className = "faq-item";

    const questionSummary = document.createElement("summary");
    questionSummary.className = "faq-question";
    questionSummary.append(createFaqBadge("Q"));

    const questionText = document.createElement("span");
    questionText.textContent = question;
    questionSummary.append(questionText);

    const toggle = document.createElement("span");
    toggle.className = "faq-toggle";
    toggle.setAttribute("aria-hidden", "true");
    questionSummary.append(toggle);

    const answerWrapper = document.createElement("div");
    answerWrapper.className = "faq-answer";
    answerWrapper.append(createFaqBadge("A"));

    const answerContent = document.createElement("div");
    answerContent.className = "faq-answer-content";
    answer.split(/\n\s*\n/).forEach((paragraph) => {
      const paragraphElement = document.createElement("p");
      appendFaqAnswerContent(paragraphElement, paragraph);
      answerContent.append(paragraphElement);
    });
    answerWrapper.append(answerContent);

    item.append(questionSummary, answerWrapper);
    faqList.append(item);
  });
}

async function loadFaqContent() {
  try {
    const response = await fetch(FAQ_CONTENT_URL, {
      cache: "no-cache"
    });

    if (!response.ok) {
      throw new Error(`FAQの取得に失敗しました（HTTP ${response.status}）。`);
    }

    const faqItems = parseFaqContent(await response.text());
    if (faqItems.length === 0) {
      faqStatus.textContent = "現在、掲載中のよくあるご質問はありません。";
      return;
    }

    renderFaqItems(faqItems);
    faqStatus.hidden = true;
  } catch (error) {
    console.error("よくあるご質問の読み込みに失敗しました。", error);
    faqStatus.textContent =
      "よくあるご質問を読み込めませんでした。\n時間をおいて再度お試しください。";
  }
}

async function openLetterRulesModal() {
  letterRulesModal.showModal();

  requestAnimationFrame(() => {
    letterRulesModal.classList.add("is-visible");
  });

  if (letterRulesLoaded) {
    return;
  }

  letterRulesModalContent.innerHTML =
    '<p class="letter-rules-modal__loading">注意事項を読み込んでいます。</p>';

  try {
    const response = await fetch(LETTER_RULES_URL, {
      cache: "no-cache"
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    letterRulesModalContent.innerHTML =
      await response.text();

    letterRulesLoaded = true;
  } catch (error) {
    console.error(
      "お手紙に関する注意事項の読み込みに失敗しました。",
      error
    );

    letterRulesModalContent.innerHTML = `
      <p class="letter-rules-modal__error">
        注意事項を読み込めませんでした。時間をおいて再度お試しください。
      </p>
    `;
  }
}

function closeLetterRulesModal() {
  letterRulesModal.classList.remove("is-visible");

  window.setTimeout(() => {
    if (letterRulesModal.open) {
      letterRulesModal.close();
    }
  }, 280);
}
function handleTurnstileSuccess(token) {
  turnstileToken = token;
  turnstileError.textContent = "";
  updateValidationState();
}

function handleTurnstileExpired() {
  turnstileToken = "";
  turnstileError.textContent =
    "確認の有効期限が切れました。もう一度確認してください。";
  updateValidationState();
}

function handleTurnstileError() {
  turnstileToken = "";
  turnstileError.textContent =
    "確認処理に失敗しました。もう一度お試しください。";
  updateValidationState();
}
window.handleTurnstileSuccess = handleTurnstileSuccess;
window.handleTurnstileExpired = handleTurnstileExpired;
window.handleTurnstileError = handleTurnstileError;

function getFormData() {
  return {
    senderName: senderNameInput.value.trim(),
    title: titleInput.value.trim(),
    body: bodyInput.value.trim(),
    messageToManager: messageToManagerInput.value.trim(),
    agreement: agreementInput.checked,
    turnstileToken

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
    isValid:
      ngWordsStatus === "ready" &&
      !hasBaseError &&
      !hasNgWordError &&
      Boolean(turnstileToken)
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
async function sendLetterToGas() {
  const data = getFormData();

  const response = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`HTTPエラー: ${response.status}`);
  }

  const result = await response.json();

if (!result.success) {
  throw new Error(
    result.message || "GASへの保存に失敗しました。"
  );
}

  return result;
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
submitLetterButton.addEventListener("click", async () => {
  if (isSubmitting) return;

  submitLetterButton.disabled = true;

  try {
    await sendLetterToGas();

    // スプレッドシートへの保存成功後に投函演出を開始
    await runMockSubmission();
  } catch (error) {
    console.error("投函に失敗しました。", error);

   window.alert(error.message);

    submitLetterButton.disabled = false;
  }
});
writeAnotherButton.addEventListener("click", closeSubmissionScene);
/* ここから追加 */
openLetterRulesButton.addEventListener(
  "click",
  openLetterRulesModal
);

closeLetterRulesButton.addEventListener(
  "click",
  closeLetterRulesModal
);

letterRulesModal.addEventListener("click", (event) => {
  if (event.target === letterRulesModal) {
    closeLetterRulesModal();
  }
});

letterRulesModal.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeLetterRulesModal();
});
/* ここまで追加 */
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
loadFaqContent();
loadPublicationStatus();
