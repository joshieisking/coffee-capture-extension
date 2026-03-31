import { useEffect, useState } from "react";
import {
  BREW_METHODS,
  EXTENSION_MESSAGES,
  createEmptyDraft,
  toNormalizedPlaceRecord,
  validateDraft,
  type BrewMethod,
  type PlaceDraft,
  type ReviewDataResponse
} from "@coffee-capture/shared";
import { FormField } from "../components/FormField";
import "./styles.css";

const defaultReviewData: ReviewDataResponse = {
  draft: null,
  resolvePlace: null,
  dedupe: null,
  saveResult: null,
  error: null
};

export function App() {
  const [reviewData, setReviewData] = useState<ReviewDataResponse>(defaultReviewData);
  const [draft, setDraft] = useState<PlaceDraft>(createEmptyDraft());
  const [openingHoursText, setOpeningHoursText] = useState("{}");
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState("Waiting for a Google Maps place page...");

  useEffect(() => {
    const refreshReviewData = () => chrome.runtime.sendMessage(
      { type: EXTENSION_MESSAGES.REQUEST_REVIEW_DATA },
      (response: ReviewDataResponse) => {
        setReviewData(response);
        if (response.draft) {
          setDraft(response.draft);
          setOpeningHoursText(JSON.stringify(response.draft.opening_hours, null, 2));
          setStatus("Draft captured from Google Maps.");
          return;
        }

        setOpeningHoursText("{}");
        setStatus("Waiting for a Google Maps place page...");
      }
    );

    refreshReviewData();
    const interval = window.setInterval(refreshReviewData, 1500);

    return () => window.clearInterval(interval);
  }, []);

  function updateField<K extends keyof PlaceDraft>(field: K, value: PlaceDraft[K]) {
    const nextDraft = {
      ...draft,
      [field]: value
    };
    setDraft(nextDraft);
    if (field === "opening_hours") {
      setOpeningHoursText(JSON.stringify(value, null, 2));
    }
    chrome.runtime.sendMessage({
      type: EXTENSION_MESSAGES.UPDATE_DRAFT,
      payload: nextDraft
    });
  }

  function handleOpeningHoursChange(value: string) {
    setOpeningHoursText(value);

    try {
      const parsed = JSON.parse(value) as Record<string, string>;
      const normalized = Object.fromEntries(
        Object.entries(parsed).map(([day, hours]) => [day.trim().toLowerCase(), String(hours).trim()])
      );
      updateField("opening_hours", normalized);
      setErrors((current) => current.filter((error) => error !== "opening_hours must be valid JSON"));
    } catch {
      setErrors((current) =>
        current.includes("opening_hours must be valid JSON")
          ? current
          : [...current, "opening_hours must be valid JSON"]
      );
    }
  }

  function handleRoasterPartnersChange(value: string) {
    updateField(
      "roaster_partners",
      value
        .split(",")
        .map((partner) => partner.trim())
        .filter(Boolean)
    );
  }

  function toggleBrewMethod(method: BrewMethod) {
    const nextMethods = draft.brew_methods.includes(method)
      ? draft.brew_methods.filter((current) => current !== method)
      : [...draft.brew_methods, method];

    updateField("brew_methods", nextMethods);
  }

  function handleApprove() {
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      setStatus("Fix validation errors before saving.");
      return;
    }

    setStatus("Saving approved place...");
    chrome.runtime.sendMessage(
      {
        type: EXTENSION_MESSAGES.SAVE_APPROVED_PLACE,
        payload: toNormalizedPlaceRecord(draft)
      },
      (response: ReviewDataResponse) => {
        setReviewData(response);
        setStatus(response.saveResult ? "Place saved successfully." : "Save failed.");
      }
    );
  }

  function handleCancel() {
    const empty = createEmptyDraft();
    setDraft(empty);
    setOpeningHoursText("{}");
    setErrors([]);
    setStatus("Draft cleared.");
    chrome.runtime.sendMessage({
      type: EXTENSION_MESSAGES.UPDATE_DRAFT,
      payload: empty
    });
  }

  async function handleRetryCapture() {
    setStatus("Retrying capture from the Google Maps page...");

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      setStatus("Could not find the active Google Maps tab.");
      return;
    }

    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        type: EXTENSION_MESSAGES.REQUEST_PAGE_CAPTURE
      });

      window.setTimeout(() => {
        chrome.runtime.sendMessage(
          { type: EXTENSION_MESSAGES.REQUEST_REVIEW_DATA },
          (response: ReviewDataResponse) => {
            setReviewData(response);
            if (response.draft) {
              setDraft(response.draft);
              setOpeningHoursText(JSON.stringify(response.draft.opening_hours, null, 2));
            }
            setStatus("Draft recaptured from Google Maps.");
          }
        );
      }, 500);
    } catch {
      setStatus("Retry failed. Refresh the Maps tab and try again.");
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Coffee Capture</p>
        <h1>Review Before Save</h1>
        <p className="hero__body">{status}</p>
      </section>

      {reviewData.dedupe?.duplicate ? (
        <section className="callout callout--warning">
          Possible duplicate: {reviewData.dedupe.match?.name ?? "existing record"}.
        </section>
      ) : null}

      <section className="panel">
        <FormField label="Name">
          <input value={draft.name} onChange={(event) => updateField("name", event.target.value)} />
        </FormField>

        <FormField label="Address">
          <textarea value={draft.address} onChange={(event) => updateField("address", event.target.value)} rows={3} />
        </FormField>

        <FormField label="City">
          <input value={draft.city} onChange={(event) => updateField("city", event.target.value)} />
        </FormField>

        <FormField label="Country">
          <input value={draft.country} onChange={(event) => updateField("country", event.target.value)} />
        </FormField>

        <FormField label="Website">
          <input value={draft.website} onChange={(event) => updateField("website", event.target.value)} />
        </FormField>

        <FormField label="Instagram">
          <input value={draft.instagram} onChange={(event) => updateField("instagram", event.target.value)} />
        </FormField>

        <FormField label="Google Maps URL">
          <textarea
            value={draft.google_maps_url}
            onChange={(event) => updateField("google_maps_url", event.target.value)}
            rows={3}
          />
        </FormField>

        <FormField label="Opening Hours JSON" hint='Review as JSON, for example { "monday": "8 am-5 pm" }'>
          <textarea value={openingHoursText} onChange={(event) => handleOpeningHoursChange(event.target.value)} rows={8} />
        </FormField>

        <FormField label="Roaster Partners" hint="Comma-separated if more than one">
          <input
            value={draft.roaster_partners.join(", ")}
            onChange={(event) => handleRoasterPartnersChange(event.target.value)}
          />
        </FormField>

        <FormField label="Roasts In House">
          <select
            value={draft.roasts_in_house === null ? "unknown" : String(draft.roasts_in_house)}
            onChange={(event) =>
              updateField(
                "roasts_in_house",
                event.target.value === "unknown" ? null : event.target.value === "true"
              )
            }
          >
            <option value="unknown">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </FormField>

        <FormField label="Confidence Score">
          <input
            value={draft.confidence_score ?? ""}
            onChange={(event) =>
              updateField("confidence_score", event.target.value ? Number(event.target.value) : null)
            }
          />
        </FormField>

        <FormField label="Brew Methods" hint="Select all that apply. Leave blank if unknown.">
          <div className="chips">
            {BREW_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                className={draft.brew_methods.includes(method) ? "chip chip--active" : "chip"}
                onClick={() => toggleBrewMethod(method)}
              >
                {method.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Notes">
          <textarea value={draft.notes} onChange={(event) => updateField("notes", event.target.value)} rows={4} />
        </FormField>

        <div className="inline-grid">
          <FormField label="Latitude">
            <input
              value={draft.latitude ?? ""}
              onChange={(event) => updateField("latitude", event.target.value ? Number(event.target.value) : null)}
            />
          </FormField>

          <FormField label="Longitude">
            <input
              value={draft.longitude ?? ""}
              onChange={(event) => updateField("longitude", event.target.value ? Number(event.target.value) : null)}
            />
          </FormField>
        </div>

        {errors.length > 0 ? (
          <section className="callout callout--error">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </section>
        ) : null}

        <div className="actions">
          <button type="button" className="button button--secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button type="button" className="button" onClick={handleApprove}>
            Approve & Save
          </button>
        </div>
      </section>
    </main>
  );
}
