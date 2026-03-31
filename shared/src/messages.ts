import type {
  DedupeCheckResponse,
  NormalizedPlaceRecord,
  PlaceDraft,
  ResolvePlaceResponse,
  SavePlaceResponse
} from "./place";

export const EXTENSION_MESSAGES = {
  CAPTURE_PLACE_DRAFT: "CAPTURE_PLACE_DRAFT",
  REQUEST_REVIEW_DATA: "REQUEST_REVIEW_DATA",
  REQUEST_PAGE_CAPTURE: "REQUEST_PAGE_CAPTURE",
  UPDATE_DRAFT: "UPDATE_DRAFT",
  SAVE_APPROVED_PLACE: "SAVE_APPROVED_PLACE"
} as const;

export interface CapturePlaceDraftMessage {
  type: typeof EXTENSION_MESSAGES.CAPTURE_PLACE_DRAFT;
  payload: PlaceDraft;
}

export interface RequestReviewDataMessage {
  type: typeof EXTENSION_MESSAGES.REQUEST_REVIEW_DATA;
}

export interface RequestPageCaptureMessage {
  type: typeof EXTENSION_MESSAGES.REQUEST_PAGE_CAPTURE;
}

export interface UpdateDraftMessage {
  type: typeof EXTENSION_MESSAGES.UPDATE_DRAFT;
  payload: PlaceDraft;
}

export interface SaveApprovedPlaceMessage {
  type: typeof EXTENSION_MESSAGES.SAVE_APPROVED_PLACE;
  payload: NormalizedPlaceRecord;
}

export type ExtensionMessage =
  | CapturePlaceDraftMessage
  | RequestReviewDataMessage
  | RequestPageCaptureMessage
  | UpdateDraftMessage
  | SaveApprovedPlaceMessage;

export interface ReviewDataResponse {
  draft: PlaceDraft | null;
  resolvePlace: ResolvePlaceResponse | null;
  dedupe: DedupeCheckResponse | null;
  saveResult: SavePlaceResponse | null;
  error: string | null;
}
