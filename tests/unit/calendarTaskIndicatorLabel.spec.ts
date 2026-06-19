import { describe, expect, it } from "vitest";
import { getCalendarTaskIndicatorLabel } from "src/modules/task/utils/calendarTaskIndicatorLabel";

describe("getCalendarTaskIndicatorLabel", () => {
  it("uses hour digits before colon for timed tasks", () => {
    expect(
      getCalendarTaskIndicatorLabel({ name: "Meeting", eventTime: "17:00", timeMode: "event" }),
    ).toBe("17");
  });

  it("uses first two characters of the name when there is no time", () => {
    expect(getCalendarTaskIndicatorLabel({ name: "Tańce", timeMode: "prepare" })).toBe("Ta");
  });

  it("ignores event time for holidays", () => {
    expect(
      getCalendarTaskIndicatorLabel({ name: "Christmas", eventTime: "17:00", timeMode: "holiday" }),
    ).toBe("Ch");
  });
});
