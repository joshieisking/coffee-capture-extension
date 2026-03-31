import {
  EXTENSION_MESSAGES,
  type DedupeCheckResponse,
  type EnrichWebsiteResponse,
  type ExtensionMessage,
  type PlaceDraft,
  type ResolvePlaceResponse,
  type ReviewDataResponse,
  type SavePlaceResponse
} from "@coffee-capture/shared";
import { dedupeCheck, enrichWebsite, resolvePlace, savePlace } from "../lib/api";

let currentDraft: PlaceDraft | null = null;
let currentResolvePlace: ResolvePlaceResponse | null = null;
let currentDedupe: DedupeCheckResponse | null = null;
let currentEnrichment: EnrichWebsiteResponse | null = null;
let currentSaveResult: SavePlaceResponse | null = null;
let currentError: string | null = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void handleMessage(message)
    .then((response) => sendResponse(response))
    .catch((error: Error) => {
      currentError = error.message;
      sendResponse(buildReviewResponse());
    });

  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<ReviewDataResponse> {
  switch (message.type) {
    case EXTENSION_MESSAGES.CAPTURE_PLACE_DRAFT: {
      currentDraft = message.payload;
      currentSaveResult = null;
      currentEnrichment = null;
      currentError = null;

      currentResolvePlace = await safelyResolvePlace(currentDraft);
      if (currentResolvePlace?.data?.place_id) {
        currentDraft = {
          ...currentDraft,
          google_place_id: currentResolvePlace.data.place_id
        };
      }

      currentEnrichment = await safelyEnrichWebsite(currentDraft);
      if (currentDraft && currentEnrichment?.data) {
        currentDraft = mergeEnrichmentIntoDraft(currentDraft, currentEnrichment);
      }

      currentDedupe = await safelyCheckDuplicates(currentDraft);

      return buildReviewResponse();
    }
    case EXTENSION_MESSAGES.REQUEST_REVIEW_DATA: {
      return buildReviewResponse();
    }
    case EXTENSION_MESSAGES.UPDATE_DRAFT: {
      currentDraft = message.payload;
      currentError = null;
      return buildReviewResponse();
    }
    case EXTENSION_MESSAGES.SAVE_APPROVED_PLACE: {
      currentSaveResult = await savePlace({
        record: message.payload
      });
      currentError = null;
      return buildReviewResponse();
    }
  }
}

function buildReviewResponse(): ReviewDataResponse {
  return {
    draft: currentDraft,
    resolvePlace: currentResolvePlace,
    dedupe: currentDedupe,
    saveResult: currentSaveResult,
    error: currentError
  };
}

async function safelyResolvePlace(draft: PlaceDraft): Promise<ResolvePlaceResponse | null> {
  try {
    return await resolvePlace({
      name: draft.name,
      address: draft.address,
      google_maps_url: draft.google_maps_url,
      latitude: draft.latitude,
      longitude: draft.longitude
    });
  } catch (error) {
    currentError = error instanceof Error ? error.message : "Failed to resolve place";
    return null;
  }
}

async function safelyCheckDuplicates(draft: PlaceDraft): Promise<DedupeCheckResponse | null> {
  try {
    return await dedupeCheck({
      google_maps_url: draft.google_maps_url,
      place_id: draft.google_place_id,
      normalized_name: draft.name,
      city: draft.city,
      country: draft.country,
      latitude: draft.latitude,
      longitude: draft.longitude
    });
  } catch (error) {
    currentError = error instanceof Error ? error.message : "Failed to check duplicates";
    return null;
  }
}

async function safelyEnrichWebsite(draft: PlaceDraft): Promise<EnrichWebsiteResponse | null> {
  if (!draft.website) {
    return null;
  }

  try {
    return await enrichWebsite({
      website: draft.website,
      name: draft.name,
      place_id: draft.google_place_id
    });
  } catch (error) {
    currentError = error instanceof Error ? error.message : "Failed to enrich website";
    return null;
  }
}

function mergeEnrichmentIntoDraft(draft: PlaceDraft, enrichment: EnrichWebsiteResponse): PlaceDraft {
  const nextDraft: PlaceDraft = {
    ...draft
  };

  if (!nextDraft.instagram && enrichment.data.instagram) {
    nextDraft.instagram = enrichment.data.instagram;
    nextDraft.field_meta.instagram = {
      confidence: "medium",
      source: "backend",
      note: "Discovered from the business website."
    };
  }

  if (nextDraft.brew_methods.length === 0 && enrichment.data.brew_methods.length > 0) {
    nextDraft.brew_methods = enrichment.data.brew_methods;
    nextDraft.field_meta.brew_methods = {
      confidence: "medium",
      source: "backend",
      note: "Detected from website copy."
    };
  }

  if (nextDraft.roaster_partners.length === 0 && enrichment.data.roaster_partners.length > 0) {
    nextDraft.roaster_partners = enrichment.data.roaster_partners;
    nextDraft.field_meta.roaster_partners = {
      confidence: "medium",
      source: "backend",
      note: "Detected from website copy."
    };
  }

  if (nextDraft.roasts_in_house === null && enrichment.data.roasts_in_house !== null) {
    nextDraft.roasts_in_house = enrichment.data.roasts_in_house;
    nextDraft.field_meta.roasts_in_house = {
      confidence: "medium",
      source: "backend",
      note: "Inferred from website copy."
    };
  }

  if (nextDraft.confidence_score === null) {
    nextDraft.confidence_score = Math.round(enrichment.confidence * 100);
  }

  return nextDraft;
}
