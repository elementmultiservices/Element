import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { NewsletterEmail } from "@/lib/email/templates/newsletter-email";

describe("newsletter email", () => {
  it("includes the logo, the post link, the unsubscribe link and the postal address", async () => {
    const html = await render(
      <NewsletterEmail
        locale="es"
        eyebrow="Noticias de Element"
        title="Propinas y horas extra"
        excerpt="Resumen"
        logoUrl="https://element.test/brand/element-logo-email.png"
        coverUrl={null}
        ctaLabel="Leer el artículo"
        postUrl="https://element.test/es/updates/propinas"
        reason="Recibes este correo porque te suscribiste."
        unsubscribeLabel="Darte de baja"
        unsubscribeUrl="https://element.test/es/newsletter/unsubscribe?token=abc"
        footerAddress="Element Multiservices · 123 Main St, Bronx, NY"
      />,
    );
    expect(html).toContain("https://element.test/brand/element-logo-email.png");
    expect(html).toContain("https://element.test/es/updates/propinas");
    expect(html).toContain("https://element.test/es/newsletter/unsubscribe?token=abc");
    expect(html).toContain("123 Main St, Bronx, NY");
    expect(html).toContain('lang="es"');
  });
});
