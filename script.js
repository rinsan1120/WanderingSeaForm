const DRAFT_STORAGE_KEY = "hyohaku-letter-form-draft-v1";
const LANGUAGE_STORAGE_KEY = "hyohaku-letter-form-language";
const DRAFT_SAVE_DELAY_MS = 450;
const MOCK_SUBMISSION_DELAY_MS = 2400;
const NG_WORDS_URL = "content/ng-words.json";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyRZ1l4rEFJvz3SGcsuk-SsCowSwEanLV4GqdNfR-TmV5XSrKzX63ahiJaZdRFfSGOysQ/exec";
const LANGUAGE_CONTENT_URL = "content/language.json";
const FAQ_CONTENT_URLS = {
  ja: "content/faq-ja.txt",
  en: "content/faq-en.txt"
};
const LETTER_RULES_URLS = {
  ja: "content/letter-guidelines-ja.html",
  en: "content/letter-guidelines-en.html"
};
const PUBLICATION_STATUS_API_URL =
  "https://script.google.com/macros/s/AKfycbx7OJKTtHheVcQHut7tBKR2t0PB_dGoQvbW18eagfLOEuoBhspQMSnYMfXsCp6Wao2-GQ/exec";
const PUBLICATION_STATUS_CALLBACK_NAME =
  "handlePublicationStatusResponse";

const PUBLICATION_STATUS_TIMEOUT_MS = 15000;
const PUBLICATION_STATUS_MAX_RETRIES = 3;
const PUBLICATION_STATUS_RETRY_DELAY_MS = 1500;
const PUBLICATION_STATUS_CACHE_KEY =
  "hyohaku-publication-status-cache-v1";
const PUBLICATION_STATUS_CACHE_BUCKET_MS = 5 * 60 * 1000;
const LETTER_SEARCH_API_URL =
  "https://script.google.com/macros/s/AKfycbxkSc8MyUuOV_kRmEEx_xThmehCWpShYOpqnP4fbLdjVpwx5njr5A3lneQlS__bD-Wurg/exec";
const LETTER_SEARCH_TIMEOUT_MS = 15000;
const COPY_FEEDBACK_DURATION_MS = 2000;

const DEFAULT_TRANSLATIONS = {
  publication_loading: "掲載状況を確認しています……",
  publication_error: "掲載状況を取得できませんでした",
  publication_success: "掲載状況：　{date}　までに投函されたお手紙を掲載しています。",
  draft_none: "下書き未保存",
  draft_saved: "この端末に下書きを保存しました",
  draft_unavailable: "下書き保存は利用できません",
  draft_saving: "下書きを保存しています……",
  draft_restored: "保存されていた下書きを復元しました",
  draft_deleted: "下書きを削除しました",
  draft_clear_confirm: "この端末に保存された下書きと入力内容を消しますか？",
  validation_sender_required: "差出人を入力してください。",
  validation_title_required: "標題を入力してください。",
  validation_body_required: "本文を入力してください。",
  validation_body_min: "本文は10文字以上で入力してください。",
  validation_manager_max: "駅長へのご要望・ご連絡事項は500文字以内で入力してください。",
  validation_agreement: "内容を確認し、同意欄にチェックを入れてください。",
  validation_ng_word: "使用できない単語が含まれています。内容をご確認ください。",
  turnstile_expired: "確認の有効期限が切れました。もう一度確認してください。",
  turnstile_error: "確認処理に失敗しました。もう一度お試しください。",
  search_loading: "お手紙を探しています……",
  search_required: "差出人またはタイトルを入力してください。",
  search_no_results: "該当するお手紙は見つかりませんでした。",
  search_failed: "お手紙の検索に失敗しました。時間をおいて再度お試しください。",
  search_result_id: "ID",
  search_result_date: "投稿日",
  field_sender: "差出人",
  field_title: "タイトル",
  copy: "コピー",
  copy_success: "コピーしました",
  copy_failed: "コピーできません",
  faq_loading: "よくあるご質問を読み込んでいます……",
  faq_empty: "現在、掲載中のよくあるご質問はありません。",
  faq_error: "よくあるご質問を読み込めませんでした。\n時間をおいて再度お試しください。",
  guidelines_loading: "注意事項を読み込んでいます。",
  guidelines_error: "注意事項を読み込めませんでした。時間をおいて再度お試しください。",
  preview_sender: "差出人　{name}",
  preview_anonymous: "差出人　名もなき旅人",
  submission_failed: "GASへの保存に失敗しました。"
};

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

const languageStorage = {
  get() {
    try {
      return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set(value) {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
    } catch {
      // 言語保存が利用できなくても、現在のページでは切り替えを継続する。
    }
  }
};

const turnstileError = document.getElementById("turnstileError");
const metaDescription = document.querySelector('meta[name="description"]');
const languageButtons = document.querySelectorAll("[data-language]");

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
const letterSearchForm = document.getElementById("letterSearchForm");
const letterSearchNameInput =
  document.getElementById("letterSearchName");
const letterSearchTitleInput =
  document.getElementById("letterSearchTitleInput");
const letterSearchButton =
  document.getElementById("letterSearchButton");
const letterSearchStatus =
  document.getElementById("letterSearchStatus");
const letterSearchError =
  document.getElementById("letterSearchError");
const letterSearchModal =
  document.getElementById("letterSearchModal");
const closeLetterSearchModalButton =
  document.getElementById("closeLetterSearchModalButton");
const letterSearchResults =
  document.getElementById("letterSearchResults");
const openLetterRulesButton =
  document.getElementById("openLetterRulesButton");

const closeLetterRulesButton =
  document.getElementById("closeLetterRulesButton");

const letterRulesModal =
  document.getElementById("letterRulesModal");

const letterRulesModalContent =
  document.getElementById("letterRulesModalContent");

const htmlFallbackTranslations = {
  document_title: document.title,
  meta_description: metaDescription?.content ?? ""
};
document.querySelectorAll("[data-i18n]").forEach((element) => {
  htmlFallbackTranslations[element.dataset.i18n] = element.textContent.trim();
});
document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
  htmlFallbackTranslations[element.dataset.i18nPlaceholder] =
    element.getAttribute("placeholder") ?? "";
});
document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
  htmlFallbackTranslations[element.dataset.i18nAriaLabel] =
    element.getAttribute("aria-label") ?? "";
});

let translations = {
  ja: {
    ...htmlFallbackTranslations,
    ...DEFAULT_TRANSLATIONS
  }
};
let currentLanguage = "ja";
let preferredLanguage = "ja";
let languageDataLoaded = false;
let letterRulesLoadedLanguage = null;
const letterRulesCache = new Map();
const faqContentCache = new Map();
let saveTimer = null;
let isSubmitting = false;
let hasAttemptedSubmit = false;
let ngWordsStatus = "loading";
let normalizedNgWords = [];
let publicationStatusScript = null;
let publicationStatusTimer = null;
let publicationStatusSettled = false;
let publicationStatusState = "loading";
let publicationStatusValue = null;
let publicationStatusRetryCount = 0;
let letterSearchController = null;
let letterSearchStatusKey = "";
let letterSearchErrorKey = "";
let letterSearchRawError = "";
let lastLetterSearchResults = [];
let draftStatusKey = "draft_none";
let turnstileErrorKey = "";
let faqRequestId = 0;

function getPreferredLanguage() {
  const savedLanguage = languageStorage.get();
  if (savedLanguage === "ja" || savedLanguage === "en") {
    return savedLanguage;
  }

  return String(navigator.language || "")
    .toLowerCase()
    .startsWith("ja")
    ? "ja"
    : "en";
}

function t(key, parameters = {}) {
  const template =
    translations[currentLanguage]?.[key] ??
    translations.ja?.[key] ??
    DEFAULT_TRANSLATIONS[key] ??
    key;

  return Object.entries(parameters).reduce(
    (text, [name, value]) =>
      text.replaceAll(`{${name}}`, String(value)),
    template
  );
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLanguage;
  document.title = t("document_title");
  if (metaDescription) {
    metaDescription.content = t("meta_description");
  }

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute(
      "placeholder",
      t(element.dataset.i18nPlaceholder)
    );
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute(
      "aria-label",
      t(element.dataset.i18nAriaLabel)
    );
  });

  languageButtons.forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.language === currentLanguage)
    );
  });
}

function setDraftStatus(key) {
  draftStatusKey = key;
  draftStatus.textContent = t(key);
}

function setLetterSearchStatus(key = "") {
  letterSearchStatusKey = key;
  letterSearchStatus.textContent = key ? t(key) : "";
}

function setLetterSearchError(message = "", key = "") {
  letterSearchErrorKey = key;
  letterSearchRawError = key ? "" : message;
  letterSearchError.textContent = key ? t(key) : message;
}

function renderPublicationStatus() {
  if (publicationStatusState === "success" && publicationStatusValue) {
    const formattedDate = formatPublicationStatusDate(
      publicationStatusValue,
      currentLanguage
    );
    publicationStatusText.textContent = formattedDate
      ? t("publication_success", { date: formattedDate })
      : t("publication_error");
    return;
  }

  publicationStatusText.textContent = t(
    publicationStatusState === "error"
      ? "publication_error"
      : "publication_loading"
  );
}

function renderDynamicTranslations() {
  setDraftStatus(draftStatusKey);
  turnstileError.textContent = turnstileErrorKey
    ? t(turnstileErrorKey)
    : "";
  setLetterSearchStatus(letterSearchStatusKey);
  setLetterSearchError(letterSearchRawError, letterSearchErrorKey);
  renderPublicationStatus();
  updateValidationState();

  if (lastLetterSearchResults.length > 0) {
    renderLetterSearchResults(lastLetterSearchResults);
  }
  if (previewModal.open) {
    updatePreviewContent();
  }
}

async function setLanguage(language, { save = true } = {}) {
  if (!languageDataLoaded || !translations[language]) {
    language = "ja";
  }

  currentLanguage = language;
  if (save) {
    languageStorage.set(language);
  }

  applyStaticTranslations();
  renderDynamicTranslations();
  await loadFaqContent(language);

  if (letterRulesModal.open) {
    await loadLetterRulesContent(language);
  } else {
    letterRulesLoadedLanguage = null;
  }
}

async function initializeI18n() {
  preferredLanguage = getPreferredLanguage();

  try {
    const response = await fetch(LANGUAGE_CONTENT_URL, {
      cache: "no-cache"
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (
      !data ||
      typeof data.ja !== "object" ||
      typeof data.en !== "object"
    ) {
      throw new Error("Invalid language data.");
    }

    translations = data;
    languageDataLoaded = true;
  } catch (error) {
    console.error("翻訳データの読み込みに失敗しました。", error);
    preferredLanguage = "ja";
  }

  await setLanguage(preferredLanguage, { save: false });
}
function getCachedPublicationStatus() {
  try {
    const cachedValue =
      window.localStorage.getItem(PUBLICATION_STATUS_CACHE_KEY);

    return formatPublicationStatusDate(cachedValue)
      ? cachedValue
      : null;
  } catch {
    return null;
  }
}

function saveCachedPublicationStatus(value) {
  try {
    window.localStorage.setItem(
      PUBLICATION_STATUS_CACHE_KEY,
      value
    );
  } catch {
    // 保存できない環境でも表示処理は継続する。
  }
}
function cleanupPublicationStatusRequest() {
  window.clearTimeout(publicationStatusTimer);
  publicationStatusTimer = null;

  publicationStatusScript?.remove();
  publicationStatusScript = null;
}

function handlePublicationStatusFailure() {
  if (publicationStatusSettled) return;

  cleanupPublicationStatusRequest();

  if (
    publicationStatusRetryCount <
    PUBLICATION_STATUS_MAX_RETRIES
  ) {
    const retryDelay =
      PUBLICATION_STATUS_RETRY_DELAY_MS *
      (publicationStatusRetryCount + 1);

    publicationStatusRetryCount += 1;

    window.setTimeout(() => {
      requestPublicationStatus();
    }, retryDelay);

    return;
  }

  const cachedValue = getCachedPublicationStatus();

  publicationStatusSettled = true;

  if (cachedValue) {
    publicationStatusState = "success";
    publicationStatusValue = cachedValue;
  } else {
    publicationStatusState = "error";
    publicationStatusValue = null;
  }

  renderPublicationStatus();
}

function formatPublicationStatusDate(value, language = currentLanguage) {
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

  if (language === "en") {
    const dateText = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
    const hourNumber = Number(hour);
    const period = hourNumber >= 12 ? "PM" : "AM";
    const displayHour = hourNumber % 12 || 12;
    return `${dateText} at ${displayHour}:${minute} ${period}`;
  }

  return `${year}年${month}月${day}日 ${hour}:${minute}`;
}

function handlePublicationStatusResponse(data) {
  if (publicationStatusSettled) return;

  const value = data?.last_updated;
  const formattedDate = formatPublicationStatusDate(value);

  if (!formattedDate) {
    handlePublicationStatusFailure();
    return;
  }

  publicationStatusSettled = true;
  publicationStatusState = "success";
  publicationStatusValue = value;

  saveCachedPublicationStatus(value);
  cleanupPublicationStatusRequest();
  renderPublicationStatus();
}

window[PUBLICATION_STATUS_CALLBACK_NAME] =
  handlePublicationStatusResponse;

function requestPublicationStatus() {
  if (publicationStatusSettled) return;

  try {
    cleanupPublicationStatusRequest();

    const url = new URL(PUBLICATION_STATUS_API_URL);

    url.searchParams.set(
      "callback",
      PUBLICATION_STATUS_CALLBACK_NAME
    );

    const cacheBucket = Math.floor(
      Date.now() / PUBLICATION_STATUS_CACHE_BUCKET_MS
    );

    url.searchParams.set("_", String(cacheBucket));

    publicationStatusScript =
      document.createElement("script");

    publicationStatusScript.src = url.href;
    publicationStatusScript.async = true;

    publicationStatusScript.addEventListener(
      "error",
      handlePublicationStatusFailure,
      { once: true }
    );

    publicationStatusTimer = window.setTimeout(
      handlePublicationStatusFailure,
      PUBLICATION_STATUS_TIMEOUT_MS
    );

    document.head.append(publicationStatusScript);
  } catch (error) {
    console.error(
      "掲載状況の取得処理を開始できませんでした。",
      error
    );

    handlePublicationStatusFailure();
  }
}

function loadPublicationStatus() {
  if (!publicationStatusText) return;

  publicationStatusSettled = false;
  publicationStatusState = "loading";
  publicationStatusRetryCount = 0;

  const cachedValue = getCachedPublicationStatus();

  if (cachedValue) {
    publicationStatusValue = cachedValue;
    publicationStatusState = "success";
    renderPublicationStatus();
  }

  requestPublicationStatus();
}

function createLetterSearchResultField(label, value) {
  const field = document.createElement("p");
  const labelElement = document.createElement("span");
  labelElement.className = "letter-search-result__label";
  labelElement.textContent = `${label}：`;
  field.append(labelElement, document.createTextNode(value));
  return field;
}

async function copyLetterId(id, button) {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API is unavailable.");
    }

    await navigator.clipboard.writeText(id);
    button.textContent = t("copy_success");
    window.setTimeout(() => {
      button.textContent = t("copy");
    }, COPY_FEEDBACK_DURATION_MS);
  } catch {
    button.textContent = t("copy_failed");
    window.setTimeout(() => {
      button.textContent = t("copy");
    }, COPY_FEEDBACK_DURATION_MS);
  }
}

function normalizeLetterSearchResult(item) {
  if (
    !item ||
    (typeof item.id !== "string" && typeof item.id !== "number") ||
    typeof item.date !== "string" ||
    typeof item.name !== "string" ||
    typeof item.title !== "string"
  ) {
    return null;
  }

  return {
    id: String(item.id),
    date: item.date,
    name: item.name,
    title: item.title
  };
}

function formatLetterSearchDate(value) {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value);
  if (!match || currentLanguage === "ja") {
    return value;
  }

  const [, yearText, monthText, dayText] = match;
  const date = new Date(Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText)
  ));
  if (
    date.getUTCFullYear() !== Number(yearText) ||
    date.getUTCMonth() !== Number(monthText) - 1 ||
    date.getUTCDate() !== Number(dayText)
  ) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function renderLetterSearchResults(results) {
  letterSearchResults.replaceChildren();

  results.forEach((result) => {
    const card = document.createElement("article");
    card.className = "letter-search-result";

    const idRow = document.createElement("div");
    idRow.className = "letter-search-result__id-row";
    idRow.append(
      createLetterSearchResultField(
        t("search_result_id"),
        result.id
      )
    );

    const copyButton = document.createElement("button");
    copyButton.className = "letter-search-copy-button";
    copyButton.type = "button";
    copyButton.textContent = t("copy");
    copyButton.addEventListener("click", () => {
      copyLetterId(result.id, copyButton);
    });
    idRow.append(copyButton);

    card.append(
      idRow,
      createLetterSearchResultField(
        t("search_result_date"),
        formatLetterSearchDate(result.date)
      ),
      createLetterSearchResultField(t("field_sender"), result.name),
      createLetterSearchResultField(t("field_title"), result.title)
    );
    letterSearchResults.append(card);
  });
}

function openLetterSearchModal() {
  letterSearchModal.showModal();
  document.body.classList.add("modal-open");

  requestAnimationFrame(() => {
    letterSearchModal.classList.add("is-visible");
  });
}

function closeLetterSearchModal() {
  letterSearchModal.classList.remove("is-visible");
  document.body.classList.remove("modal-open");

  window.setTimeout(() => {
    if (letterSearchModal.open) {
      letterSearchModal.close();
      letterSearchButton.focus();
    }
  }, 260);
}

async function searchLetters(event) {
  event.preventDefault();

  letterSearchController?.abort();
  setLetterSearchStatus();
  setLetterSearchError("");

  const name = letterSearchNameInput.value.trim();
  const title = letterSearchTitleInput.value.trim();
  if (!name && !title) {
    setLetterSearchError("", "search_required");
    return;
  }

  const controller = new AbortController();
  letterSearchController = controller;
  let timedOut = false;
  letterSearchButton.disabled = true;
  setLetterSearchStatus("search_loading");

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, LETTER_SEARCH_TIMEOUT_MS);

  try {
    const url = new URL(LETTER_SEARCH_API_URL);
    url.searchParams.set("name", name);
    url.searchParams.set("title", title);

    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data || typeof data.status !== "string") {
      throw new Error("Invalid response.");
    }

    if (data.status === "error") {
      if (typeof data.message !== "string") {
        throw new Error("Invalid error response.");
      }
      setLetterSearchStatus();
      setLetterSearchError(data.message);
      return;
    }

    if (data.status !== "success" || !Array.isArray(data.data)) {
      throw new Error("Invalid success response.");
    }

    const results = data.data.map(normalizeLetterSearchResult);
    if (results.some((result) => result === null)) {
      throw new Error("Invalid search result.");
    }

    setLetterSearchStatus();
    if (results.length === 0) {
      lastLetterSearchResults = [];
      setLetterSearchStatus("search_no_results");
      return;
    }

    lastLetterSearchResults = results;
    renderLetterSearchResults(results);
    openLetterSearchModal();
  } catch (error) {
    if (error.name === "AbortError" && !timedOut) {
      return;
    }

    setLetterSearchStatus();
    setLetterSearchError("", "search_failed");
  } finally {
    window.clearTimeout(timeoutId);
    if (letterSearchController === controller) {
      letterSearchController = null;
      letterSearchButton.disabled = false;
    }
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

async function loadFaqContent(language = currentLanguage) {
  const requestId = ++faqRequestId;
  const openFaqIndexes = [...faqList.querySelectorAll(".faq-item")]
    .map((item, index) => item.open ? index : -1)
    .filter((index) => index >= 0);

  faqStatus.hidden = false;
  faqStatus.textContent = t("faq_loading");

  try {
    let content = faqContentCache.get(language);
    if (!content) {
      const response = await fetch(FAQ_CONTENT_URLS[language], {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(`FAQ HTTP ${response.status}`);
      }

      content = await response.text();
      faqContentCache.set(language, content);
    }

    if (requestId !== faqRequestId || language !== currentLanguage) {
      return;
    }

    const faqItems = parseFaqContent(content);
    if (faqItems.length === 0) {
      faqList.replaceChildren();
      faqStatus.textContent = t("faq_empty");
      return;
    }

    renderFaqItems(faqItems);
    openFaqIndexes.forEach((index) => {
      const item = faqList.children[index];
      if (item) item.open = true;
    });
    faqStatus.hidden = true;
  } catch (error) {
    if (requestId !== faqRequestId || language !== currentLanguage) {
      return;
    }

    console.error("よくあるご質問の読み込みに失敗しました。", error);
    faqList.replaceChildren();
    faqStatus.textContent = t("faq_error");
  }
}

function renderLetterRulesMessage(className, message) {
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = message;
  letterRulesModalContent.replaceChildren(paragraph);
}

async function loadLetterRulesContent(language = currentLanguage) {
  if (letterRulesLoadedLanguage === language) return;

  renderLetterRulesMessage(
    "letter-rules-modal__loading",
    t("guidelines_loading")
  );

  try {
    let content = letterRulesCache.get(language);
    if (!content) {
      const response = await fetch(LETTER_RULES_URLS[language], {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      content = await response.text();
      letterRulesCache.set(language, content);
    }

    if (language !== currentLanguage) return;

    letterRulesModalContent.innerHTML = content;
    letterRulesLoadedLanguage = language;
  } catch (error) {
    console.error(
      "お手紙に関する注意事項の読み込みに失敗しました。",
      error
    );
    renderLetterRulesMessage(
      "letter-rules-modal__error",
      t("guidelines_error")
    );
    letterRulesLoadedLanguage = null;
  }
}

async function openLetterRulesModal() {
  letterRulesModal.showModal();

  requestAnimationFrame(() => {
    letterRulesModal.classList.add("is-visible");
  });

  await loadLetterRulesContent(currentLanguage);
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
  turnstileErrorKey = "";
  turnstileError.textContent = "";
  updateValidationState();
}

function handleTurnstileExpired() {
  turnstileToken = "";
  turnstileErrorKey = "turnstile_expired";
  turnstileError.textContent = t(turnstileErrorKey);
  updateValidationState();
}

function handleTurnstileError() {
  turnstileToken = "";
  turnstileErrorKey = "turnstile_error";
  turnstileError.textContent = t(turnstileErrorKey);
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
    senderName: data.senderName ? "" : t("validation_sender_required"),
    title: data.title ? "" : t("validation_title_required"),
    body: !data.body
      ? t("validation_body_required")
      : data.body.length < 10
        ? t("validation_body_min")
        : "",
    messageToManager: data.messageToManager.length > 500
      ? t("validation_manager_max")
      : "",
    agreement: data.agreement ? "" : t("validation_agreement")
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
    ngWordErrors.senderName ? t("validation_ng_word") : showBaseErrors ? baseErrors.senderName : ""
  );
  setFieldError(
    titleInput,
    titleError,
    ngWordErrors.title ? t("validation_ng_word") : showBaseErrors ? baseErrors.title : ""
  );
  setFieldError(
    bodyInput,
    bodyError,
    ngWordErrors.body
      ? t("validation_ng_word")
      : (hasAttemptedSubmit || bodyInput.value.length > 0)
        ? baseErrors.body
        : ""
  );
  setFieldError(
    messageToManagerInput,
    messageToManagerError,
    ngWordErrors.messageToManager
      ? t("validation_ng_word")
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
    setDraftStatus("draft_none");
    return;
  }

  const saved = draftStorage.set(JSON.stringify(data));
  setDraftStatus(saved ? "draft_saved" : "draft_unavailable");
}

function scheduleDraftSave() {
  setDraftStatus("draft_saving");
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
    setDraftStatus("draft_restored");
  } catch (error) {
    console.error("下書きの復元に失敗しました。", error);
    draftStorage.remove();
    setDraftStatus("draft_none");
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
    const shouldClear = window.confirm(t("draft_clear_confirm"));
    if (!shouldClear) return;
  }

  form.reset();
  draftStorage.remove();
  setDraftStatus("draft_deleted");
  hasAttemptedSubmit = false;
  updateCharacterCounts();
  updateValidationState({ showBaseErrors: false });
}

function updatePreviewContent() {
  const data = getFormData();

  previewLetterTitle.textContent = data.title;
  previewLetterBody.textContent = data.body;
  previewLetterSender.textContent = data.senderName
    ? t("preview_sender", { name: data.senderName })
    : t("preview_anonymous");
  previewMessageToManagerWrapper.hidden = !data.messageToManager;
  previewMessageToManager.textContent = data.messageToManager;
}

function openPreview() {
  updatePreviewContent();

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
    throw new Error(t("submission_failed"));
  }

  const result = await response.json();

if (!result.success) {
  throw new Error(
    result.message || t("submission_failed")
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

function getAccordionSection(hash) {
  if (!hash?.startsWith("#") || hash.length === 1) {
    return null;
  }

  const section = document.getElementById(hash.slice(1));
  if (!section) return;

  const details = [...section.children].find((element) =>
    element.matches(
      "details.letter-search-section, details.faq-section, details.contact-section"
    )
  );
  return details ? { section, details } : null;
}

function openAccordionSectionFromLink(event, link) {
  const target = getAccordionSection(link.getAttribute("href"));
  if (!target) return;

  const { section, details } = target;
  event.preventDefault();
  details.open = true;
  section.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start"
  });
}

function openAccordionSectionFromHash() {
  const target = getAccordionSection(window.location.hash);
  if (target) {
    target.details.open = true;
  }
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

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.language);
  });
});

document.addEventListener("click", (event) => {
  const link = event.target.closest?.("[data-accordion-section-link]");
  if (link) {
    openAccordionSectionFromLink(event, link);
  }
});

window.addEventListener("hashchange", openAccordionSectionFromHash);
openAccordionSectionFromHash();

letterSearchForm.addEventListener("submit", searchLetters);
closeLetterSearchModalButton.addEventListener(
  "click",
  closeLetterSearchModal
);
letterSearchModal.addEventListener("click", (event) => {
  if (event.target === letterSearchModal) {
    closeLetterSearchModal();
  }
});
letterSearchModal.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeLetterSearchModal();
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
loadPublicationStatus();
initializeI18n();
