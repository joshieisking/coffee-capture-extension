import { EXTENSION_MESSAGES } from "@coffee-capture/shared";
import { extractDraftFromPage, isGoogleMapsPlacePage } from "../lib/googleMaps";

let captureInFlight = false;
let pendingCapture = 0;

async function captureCurrentPage(): Promise<void> {
  if (!isGoogleMapsPlacePage(window.location.href)) {
    return;
  }

  if (captureInFlight) {
    pendingCapture = window.setTimeout(() => {
      void captureCurrentPage();
    }, 250);
    return;
  }

  captureInFlight = true;

  const draft = extractDraftFromPage(window.location.href);
  chrome.runtime.sendMessage({
    type: EXTENSION_MESSAGES.CAPTURE_PLACE_DRAFT,
    payload: draft
  });

  captureInFlight = false;
}

void captureCurrentPage();

const observer = new MutationObserver(() => {
  if (pendingCapture) {
    window.clearTimeout(pendingCapture);
  }
  pendingCapture = window.setTimeout(() => {
    void captureCurrentPage();
  }, 300);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
  if (message.type !== EXTENSION_MESSAGES.REQUEST_PAGE_CAPTURE) {
    return;
  }

  void captureCurrentPage().then(() => sendResponse({ ok: true }));
  return true;
});
