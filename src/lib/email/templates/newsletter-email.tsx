import { Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text } from "@react-email/components";

/**
 * Newsletter email for a published post. All copy arrives already translated;
 * the unsubscribe link is mandatory (CAN-SPAM) and unique per subscriber.
 */
export type NewsletterEmailProps = {
  locale: "en" | "es";
  eyebrow: string;
  title: string;
  excerpt: string;
  logoUrl: string;
  coverUrl: string | null;
  ctaLabel: string;
  postUrl: string;
  reason: string;
  unsubscribeLabel: string;
  unsubscribeUrl: string;
  footerAddress: string;
};

const colors = {
  ink: "#050d29",
  electric: "#1b83f4",
  graphite: "#4a5778",
  border: "#ddeefd",
  mist: "#f7fbff",
};

const font = "'Instrument Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

export function NewsletterEmail(props: NewsletterEmailProps) {
  return (
    <Html lang={props.locale}>
      <Head />
      <Preview>{props.excerpt || props.title}</Preview>
      <Body style={{ backgroundColor: colors.mist, fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", border: `1px solid ${colors.border}`, borderRadius: 20, maxWidth: 580, margin: "0 auto", overflow: "hidden" }}>
          <Section style={{ backgroundColor: colors.ink, padding: "20px 32px" }}>
            <Img src={props.logoUrl} alt="Element Multiservices" width="162" height="30" style={{ display: "block", border: 0, color: "#ffffff", fontSize: 18, fontWeight: 600 }} />
          </Section>
          {props.coverUrl ? <Img src={props.coverUrl} alt="" width="580" style={{ display: "block", width: "100%", height: "auto" }} /> : null}
          <Section style={{ padding: "28px 32px 8px" }}>
            <Text style={{ color: colors.electric, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", margin: "0 0 10px", textTransform: "uppercase" }}>
              {props.eyebrow}
            </Text>
            <Heading as="h1" style={{ color: colors.ink, fontSize: 26, fontWeight: 600, lineHeight: "32px", margin: "0 0 14px" }}>
              {props.title}
            </Heading>
            {props.excerpt ? <Text style={{ color: colors.graphite, fontSize: 16, lineHeight: "25px", margin: "0 0 8px" }}>{props.excerpt}</Text> : null}
            <Section style={{ margin: "22px 0 28px" }}>
              <Button
                href={props.postUrl}
                style={{
                  backgroundColor: colors.electric,
                  borderRadius: 999,
                  color: "#ffffff",
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "13px 26px",
                  textDecoration: "none",
                }}
              >
                {props.ctaLabel}
              </Button>
            </Section>
          </Section>
          <Hr style={{ borderColor: colors.border, margin: 0 }} />
          <Section style={{ padding: "16px 32px 20px" }}>
            <Text style={{ color: colors.graphite, fontSize: 12, lineHeight: "18px", margin: "0 0 6px" }}>
              {props.reason}{" "}
              <Link href={props.unsubscribeUrl} style={{ color: colors.electric }}>
                {props.unsubscribeLabel}
              </Link>
            </Text>
            <Text style={{ color: colors.graphite, fontSize: 12, lineHeight: "18px", margin: 0 }}>{props.footerAddress}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
