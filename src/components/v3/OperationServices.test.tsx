import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OperationServices } from "./OperationServices";

describe("tug count typography", () => {
  it.each([1, 2, 3, 4])("renders B%s as one baseline-aligned label", tugQuantity => {
    const html = renderToStaticMarkup(<OperationServices compact locale="da" operation={{ id: "tug-test", type: "arrival", label: "Arrival", state: "ordered", at: "2026-08-21T07:00:00+02:00", serviceCodes: ["B"], tugQuantity }} />);
    expect(html).toContain(`>B${tugQuantity}</b>`);
    expect(html).not.toContain("<sup");
    expect(html).toContain(`aria-label="Bugserbåd · Bestilt · ${tugQuantity}"`);
  });
});
