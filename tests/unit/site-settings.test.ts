import { describe, expect, it } from "vitest";
import { lines, phoneHrefFor, whatsappHrefFor } from "@/lib/business";
import { siteSettingsSchema } from "@/lib/validation/admin";

const valid = {
  phone: "+1 (917) 890-0892",
  whatsapp: "+1 917 890 0892",
  email: "Hola@Element.com",
  address: "123 Main St, Bronx, NY 10451",
  mapsUrl: "https://maps.app.goo.gl/abc",
  bookingUrl: "",
  hoursRegularEs: "  Lun – Vie · 10–6 \n\n Sábados · con cita ",
  hoursRegularEn: "Mon – Fri · 10–6",
  hoursSeasonEs: "",
  hoursSeasonEn: "",
  announcementEnabled: "on",
  announcementLabelEs: "15 OCT",
  announcementLabelEn: "OCT 15",
  announcementTextEs: "Texto",
  announcementTextEn: "Text",
};

describe("business links", () => {
  it("builds tel: and WhatsApp links from formatted numbers", () => {
    expect(phoneHrefFor("+1 (917) 890-0892")).toBe("tel:+19178900892");
    expect(whatsappHrefFor("+1 917-890-0892")).toBe("https://wa.me/19178900892");
  });

  it("falls back to the question form when a number is missing", () => {
    expect(phoneHrefFor("")).toBe("/location#contact-form");
    expect(whatsappHrefFor("12")).toBe("/location#contact-form");
  });

  it("splits multi-line hours into trimmed, non-empty lines", () => {
    expect(lines(" a \n\n b\r\n")).toEqual(["a", "b"]);
  });
});

describe("siteSettingsSchema", () => {
  it("normalizes the WhatsApp number, email and hours", () => {
    const r = siteSettingsSchema.parse(valid);
    expect(r.whatsapp).toBe("19178900892");
    expect(r.email).toBe("hola@element.com");
    expect(r.hoursRegularEs).toBe("Lun – Vie · 10–6\nSábados · con cita");
    expect(r.announcementEnabled).toBe(true);
  });

  it("treats a missing checkbox as disabled", () => {
    const { announcementEnabled: _omit, ...rest } = valid;
    expect(siteSettingsSchema.parse(rest).announcementEnabled).toBe(false);
  });

  it("rejects non-https links and bad emails", () => {
    const r = siteSettingsSchema.safeParse({ ...valid, mapsUrl: "http://maps.example.com", email: "nope" });
    expect(r.success).toBe(false);
    const fields = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["mapsUrl", "email"]));
  });
});
