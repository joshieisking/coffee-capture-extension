import { describe, expect, it } from "vitest";
import { isGoogleMapsPlacePage, parseCityCountryFromAddress, parseLatLngFromUrl, parseOpeningHoursText } from "./googleMaps";

describe("googleMaps helpers", () => {
  it("parses lat/lng from @ URL segments", () => {
    expect(parseLatLngFromUrl("https://www.google.com/maps/place/Test/@1.3521,103.8198,17z")).toEqual({
      latitude: 1.3521,
      longitude: 103.8198
    });
  });

  it("returns null coordinates when absent", () => {
    expect(parseLatLngFromUrl("https://www.google.com/maps/place/Test")).toEqual({
      latitude: null,
      longitude: null
    });
  });

  it("identifies place pages based on Maps-like URLs", () => {
    document.body.innerHTML = "<h1>Example Coffee</h1>";
    expect(isGoogleMapsPlacePage("https://www.google.com/maps/place/Test")).toBe(true);
  });

  it("derives Singapore city and country from the address", () => {
    expect(parseCityCountryFromAddress("1 Venture Ave, #02 - 04, Singapore 608521")).toEqual({
      city: "Singapore",
      country: "Singapore"
    });
  });

  it("derives Japan city and country using plus-code context", () => {
    expect(
      parseCityCountryFromAddress(
        "Japan, 〒170-0013 Tokyo, Toshima City, Higashiikebukuro, 1 Chome−23−4 池袋ビル",
        "Toshima City, Tokyo, Japan"
      )
    ).toEqual({
      city: "Toshima City",
      country: "Japan"
    });
  });

  it("parses opening hours into a json-friendly object", () => {
    expect(
      parseOpeningHoursText([
        "Monday 8 am-5 pm Tuesday 8 am-5 pm Wednesday 8 am-5 pm Thursday 8 am-5 pm Friday 8 am-5 pm Saturday 9 am-5 pm Sunday Closed"
      ])
    ).toEqual({
      monday: "8 am-5 pm",
      tuesday: "8 am-5 pm",
      wednesday: "8 am-5 pm",
      thursday: "8 am-5 pm",
      friday: "8 am-5 pm",
      saturday: "9 am-5 pm",
      sunday: "Closed"
    });
  });

  it("ignores holiday noise in opening-hours values", () => {
    expect(
      parseOpeningHoursText([
        "Monday 8:30 am to 6 pm Tuesday 8:30 am to 6 pm Wednesday 8:30 am to 6 pm Thursday 8:30 am to 6 pm Friday (Good Friday), 8:30 am to 6 pm, Holiday, Copy open Saturday 8:30 am to 6 pm Sunday 8:30 am to 6 pm"
      ])
    ).toEqual({
      monday: "8:30 am to 6 pm",
      tuesday: "8:30 am to 6 pm",
      wednesday: "8:30 am to 6 pm",
      thursday: "8:30 am to 6 pm",
      friday: "8:30 am to 6 pm",
      saturday: "8:30 am to 6 pm",
      sunday: "8:30 am to 6 pm"
    });
  });

  it("strips trailing ui glyph noise from expanded-hours values", () => {
    expect(
      parseOpeningHoursText([
        "Tuesday 9 am-10 pm ≡ Wednesday 9 am-10 pm ≡ Thursday 9 am-10 pm ≡ Friday 9 am-10 pm ≡ Saturday 9 am-10 pm ≡ Sunday 9 am-10 pm ≡ Monday 9 am-10 pm ≡"
      ])
    ).toEqual({
      tuesday: "9 am-10 pm",
      wednesday: "9 am-10 pm",
      thursday: "9 am-10 pm",
      friday: "9 am-10 pm",
      saturday: "9 am-10 pm",
      sunday: "9 am-10 pm",
      monday: "9 am-10 pm"
    });
  });
});
