import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";

/**
 * Institutional email layout shared by every transactional message.
 * All copy arrives already translated; this component contains no strings.
 */
export type ActionEmailProps = {
  locale: "en" | "es";
  preview: string;
  heading: string;
  greeting: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  expiry?: string;
  ignore?: string;
  linkFallback: string;
  automatedNotice: string;
  footerAddress: string;
};

const colors = {
  primary: "#0b2545",
  accent: "#1d5b8f",
  text: "#111827",
  muted: "#5b6573",
  border: "#dde1e7",
  surface: "#f6f7f9",
};

const font = "'IBM Plex Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

export function ActionEmail(props: ActionEmailProps) {
  return (
    <Html lang={props.locale}>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={{ backgroundColor: colors.surface, fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", border: `1px solid ${colors.border}`, maxWidth: 560, margin: "0 auto" }}>
          <Section style={{ backgroundColor: colors.primary, padding: "18px 32px" }}>
            <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: 500, letterSpacing: "0.04em", margin: 0 }}>Element</Text>
          </Section>
          <Section style={{ padding: "28px 32px 8px" }}>
            <Heading as="h1" style={{ color: colors.primary, fontSize: 20, fontWeight: 600, margin: "0 0 16px" }}>
              {props.heading}
            </Heading>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: "24px" }}>{props.greeting}</Text>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: "24px" }}>{props.body}</Text>
            <Section style={{ margin: "24px 0" }}>
              <Button
                href={props.ctaUrl}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 4,
                  color: "#ffffff",
                  fontSize: 15,
                  fontWeight: 500,
                  padding: "12px 22px",
                  textDecoration: "none",
                }}
              >
                {props.ctaLabel}
              </Button>
            </Section>
            {props.expiry ? <Text style={{ color: colors.muted, fontSize: 13, lineHeight: "20px" }}>{props.expiry}</Text> : null}
            {props.ignore ? <Text style={{ color: colors.muted, fontSize: 13, lineHeight: "20px" }}>{props.ignore}</Text> : null}
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: "18px", wordBreak: "break-all" }}>
              {props.linkFallback}{" "}
              <Link href={props.ctaUrl} style={{ color: colors.accent }}>
                {props.ctaUrl}
              </Link>
            </Text>
          </Section>
          <Hr style={{ borderColor: colors.border, margin: 0 }} />
          <Section style={{ padding: "16px 32px" }}>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: "18px", margin: "0 0 4px" }}>{props.automatedNotice}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: "18px", margin: 0 }}>{props.footerAddress}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
