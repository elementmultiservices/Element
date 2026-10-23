/**
 * Official "Where's my refund?" pages per state, with the steps to reach the
 * lookup form. Screenshots live in /public/refund-status/<shot>.webp and were
 * taken from each site; states whose sites block automated captures have none.
 * Button labels are kept in English because that is how they read on the site.
 */

export type RefundField =
  | "ssn"
  | "last7"
  | "taxYear"
  | "refundAmount"
  | "zip"
  | "address"
  | "filingStatus"
  | "lastName"
  | "accountType"
  | "howFiled"
  | "securityCode"
  | "declaration"
  | "captcha";

export type RefundStep =
  /** Click a link or button that reads exactly `label`. */
  | { kind: "click"; label: string; shot?: string }
  /** Fill the form, then press `submit` (or just submit it when unknown). */
  | { kind: "fill"; fields: RefundField[]; submit?: string; shot?: string }
  /** Portal without a capture: find the refund link on the home page. */
  | { kind: "find" }
  /** Form without a capture: the usual fields. */
  | { kind: "fillGeneric" };

export type StateRefund = { code: string; name: string; url: string; steps: RefundStep[] };

const find: RefundStep[] = [{ kind: "find" }, { kind: "fillGeneric" }];
const generic: RefundStep[] = [{ kind: "fillGeneric" }];

export const STATE_REFUNDS: StateRefund[] = [
  {
    code: "AL",
    name: "Alabama",
    url: "https://myalabamataxes.alabama.gov",
    steps: [
      { kind: "click", label: "Where's My Refund", shot: "al-1" },
      { kind: "fill", fields: ["ssn", "taxYear", "refundAmount", "captcha"], submit: "Search", shot: "al-2" },
    ],
  },
  { code: "AZ", name: "Arizona", url: "https://aztaxes.gov/Home/CheckRefund", steps: generic },
  {
    code: "AR",
    name: "Arkansas",
    url: "https://atap.arkansas.gov",
    steps: [
      { kind: "click", label: "Check Refund Status", shot: "ar-1" },
      { kind: "fill", fields: ["ssn", "refundAmount"], submit: "Search", shot: "ar-2" },
    ],
  },
  {
    code: "CA",
    name: "California",
    url: "https://www.ftb.ca.gov/refund/index.asp",
    steps: [
      { kind: "click", label: "Check refund", shot: "ca-1" },
      { kind: "fill", fields: ["ssn", "address", "zip", "refundAmount"], shot: "ca-2" },
    ],
  },
  {
    code: "CO",
    name: "Colorado",
    url: "https://www.colorado.gov/revenueonline",
    steps: [
      { kind: "click", label: "Where's My Refund?", shot: "co-1" },
      { kind: "fill", fields: ["taxYear", "accountType", "ssn", "refundAmount"], submit: "Get My Refund", shot: "co-2" },
    ],
  },
  {
    code: "CT",
    name: "Connecticut",
    url: "https://drs.ct.gov/eservices/_/",
    steps: [
      { kind: "click", label: "Where's my Refund?", shot: "ct-1" },
      { kind: "fill", fields: ["ssn", "taxYear", "refundAmount"], submit: "Search", shot: "ct-2" },
    ],
  },
  {
    code: "DE",
    name: "Delaware",
    url: "https://tax.delaware.gov",
    steps: [
      { kind: "click", label: "Where is my … Individual Refund?", shot: "de-1" },
      { kind: "fill", fields: ["ssn", "refundAmount"], submit: "Check Status", shot: "de-2" },
    ],
  },
  {
    code: "DC",
    name: "District of Columbia",
    url: "https://mytax.dc.gov/_/",
    steps: [
      { kind: "click", label: "Check the Status of My Refund", shot: "dc-1" },
      { kind: "fill", fields: ["ssn", "taxYear", "refundAmount", "captcha"], submit: "Search", shot: "dc-2" },
    ],
  },
  {
    code: "GA",
    name: "Georgia",
    url: "https://gtc.dor.ga.gov/_/",
    steps: [
      { kind: "click", label: "Check my Refund Status", shot: "ga-1" },
      { kind: "fill", fields: ["ssn", "refundAmount", "taxYear"], submit: "Next", shot: "ga-2" },
    ],
  },
  {
    code: "HI",
    name: "Hawaii",
    url: "https://hitax.hawaii.gov/_/",
    steps: [
      { kind: "click", label: "Where's My Individual Income Tax Refund?", shot: "hi-1" },
      { kind: "fill", fields: ["ssn", "refundAmount"], submit: "Submit", shot: "hi-2" },
    ],
  },
  { code: "ID", name: "Idaho", url: "https://tax.idaho.gov/refund", steps: generic },
  {
    code: "IL",
    name: "Illinois",
    url: "https://mytax.illinois.gov/_/",
    steps: [
      { kind: "click", label: "Where's My Refund?", shot: "il-1" },
      { kind: "fill", fields: ["ssn", "refundAmount"], submit: "Submit", shot: "il-2" },
    ],
  },
  { code: "IN", name: "Indiana", url: "https://intime.dor.in.gov/eServices/_/", steps: find },
  {
    code: "IA",
    name: "Iowa",
    url: "https://govconnect.iowa.gov/tap/_/",
    steps: [
      { kind: "click", label: "Where's My Refund?", shot: "ia-1" },
      { kind: "click", label: "Individual Income", shot: "ia-2" },
      { kind: "fillGeneric" },
    ],
  },
  { code: "KS", name: "Kansas", url: "https://www.kdor.ks.gov/Apps/kcsc/increfundstatus.aspx", steps: generic },
  {
    code: "KY",
    name: "Kentucky",
    url: "https://refund.ky.gov",
    steps: [{ kind: "fill", fields: ["ssn", "refundAmount"], submit: "Next", shot: "ky-1" }],
  },
  { code: "LA", name: "Louisiana", url: "https://latap.revenue.louisiana.gov/_/", steps: find },
  { code: "ME", name: "Maine", url: "https://portal.maine.gov/refundstatus/", steps: generic },
  {
    code: "MD",
    name: "Maryland",
    url: "https://interactive.marylandtaxes.gov/INDIV/refundstatus/home.aspx",
    steps: [
      { kind: "click", label: "Where's My Refund", shot: "md-1" },
      { kind: "fill", fields: ["ssn", "taxYear", "refundAmount"], submit: "Search", shot: "md-2" },
    ],
  },
  { code: "MA", name: "Massachusetts", url: "https://mtc.dor.state.ma.us/mtc/_/", steps: find },
  {
    code: "MI",
    name: "Michigan",
    url: "https://www.michigan.gov/wheresmyrefund",
    steps: [
      { kind: "click", label: "Michigan Treasury eServices", shot: "mi-1" },
      { kind: "click", label: "Access the MiTreasury eServices - Citizen Portal" },
      { kind: "click", label: "Where's My Refund?" },
      { kind: "fill", fields: ["ssn", "taxYear", "refundAmount"] },
    ],
  },
  {
    code: "MN",
    name: "Minnesota",
    url: "https://www.revenue.state.mn.us/wheres-my-refund",
    steps: [
      { kind: "click", label: "Where's My Refund? system", shot: "mn-1" },
      { kind: "fillGeneric" },
    ],
  },
  {
    code: "MS",
    name: "Mississippi",
    url: "https://tap.dor.ms.gov/_/",
    steps: [
      { kind: "click", label: "Where's My Refund?", shot: "ms-1" },
      { kind: "fill", fields: ["ssn", "refundAmount"], submit: "Submit", shot: "ms-2" },
    ],
  },
  {
    code: "MO",
    name: "Missouri",
    url: "https://dor.mo.gov/taxation/return-status",
    steps: [
      { kind: "click", label: "Get Started!", shot: "mo-1" },
      { kind: "fill", fields: ["ssn", "filingStatus", "refundAmount", "taxYear"], submit: "Check Status", shot: "mo-2" },
    ],
  },
  {
    code: "MT",
    name: "Montana",
    url: "https://tap.dor.mt.gov/_/",
    steps: [
      { kind: "click", label: "Where's My Refund?", shot: "mt-1" },
      { kind: "fill", fields: ["ssn", "refundAmount", "declaration"], shot: "mt-2" },
    ],
  },
  { code: "NE", name: "Nebraska", url: "https://ndr-refundstatus.ne.gov", steps: generic },
  {
    code: "NJ",
    name: "New Jersey",
    url: "https://www.nj.gov/treasury/taxation/checkrefundstatus.shtml",
    steps: [
      { kind: "click", label: "Where Is My Refund?", shot: "nj-1" },
      { kind: "fill", fields: ["ssn", "refundAmount", "taxYear"], shot: "nj-2" },
    ],
  },
  {
    code: "NM",
    name: "New Mexico",
    url: "https://tap.state.nm.us/tap/_/",
    steps: [
      { kind: "click", label: "Where's My Refund?", shot: "nm-1" },
      { kind: "fill", fields: ["ssn", "refundAmount"], submit: "Submit", shot: "nm-2" },
    ],
  },
  {
    code: "NY",
    name: "New York",
    url: "https://www8.tax.ny.gov/PRIS/prisStart",
    steps: [
      { kind: "fill", fields: ["securityCode"], submit: "Continue", shot: "ny-1" },
      { kind: "fillGeneric" },
    ],
  },
  {
    code: "NC",
    name: "North Carolina",
    url: "https://eservices.dor.nc.gov/wheresmyrefund/SelectionServlet",
    steps: generic,
  },
  {
    code: "ND",
    name: "North Dakota",
    url: "https://apps.nd.gov/tax/tap/_/",
    steps: [
      { kind: "click", label: "Where's My Refund?", shot: "nd-1" },
      { kind: "fill", fields: ["taxYear", "ssn", "filingStatus", "refundAmount"], shot: "nd-2" },
    ],
  },
  {
    code: "OH",
    name: "Ohio",
    url: "https://tax.ohio.gov/individual/refund-status",
    steps: [
      { kind: "click", label: "Check My Refund Status", shot: "oh-1" },
      {
        kind: "fill",
        fields: ["ssn", "accountType", "refundAmount", "taxYear"],
        submit: "Check My Refund Status",
        shot: "oh-2",
      },
    ],
  },
  {
    code: "OK",
    name: "Oklahoma",
    url: "https://oktap.tax.ok.gov/oktap/web/_/",
    steps: [
      { kind: "click", label: "Where's My Refund?", shot: "ok-1" },
      { kind: "fill", fields: ["last7", "refundAmount", "zip"], submit: "Search", shot: "ok-2" },
    ],
  },
  {
    code: "OR",
    name: "Oregon",
    url: "https://revenueonline.dor.oregon.gov/tap/_/",
    steps: [
      { kind: "click", label: "Where's My Refund?", shot: "or-1" },
      { kind: "fill", fields: ["ssn", "refundAmount"], submit: "Next", shot: "or-2" },
    ],
  },
  {
    code: "PA",
    name: "Pennsylvania",
    url: "https://mypath.pa.gov/_/",
    steps: [
      { kind: "click", label: "Where's My Refund?", shot: "pa-1" },
      { kind: "fill", fields: ["taxYear", "refundAmount", "ssn"], submit: "Search", shot: "pa-2" },
    ],
  },
  {
    code: "RI",
    name: "Rhode Island",
    url: "https://www.ri.gov/taxation/refund/",
    steps: [{ kind: "fill", fields: ["taxYear", "ssn", "refundAmount", "captcha"], submit: "Check Status", shot: "ri-1" }],
  },
  { code: "SC", name: "South Carolina", url: "https://mydorway.dor.sc.gov/_/", steps: find },
  { code: "UT", name: "Utah", url: "https://tap.tax.utah.gov/TaxExpress/_/", steps: find },
  {
    code: "VT",
    name: "Vermont",
    url: "https://myvtax.vermont.gov/_/",
    steps: [
      { kind: "click", label: "Check the Status of your Return", shot: "vt-1" },
      { kind: "click", label: "Personal Income Tax Return Status", shot: "vt-2" },
      { kind: "fill", fields: ["ssn", "lastName", "zip", "refundAmount"], submit: "Search", shot: "vt-3" },
    ],
  },
  {
    code: "VA",
    name: "Virginia",
    url: "https://www.tax.virginia.gov/wheres-my-refund",
    steps: [
      { kind: "click", label: "Check your refund status now", shot: "va-1" },
      { kind: "fill", fields: ["ssn", "taxYear", "refundAmount", "howFiled"], shot: "va-2" },
    ],
  },
  {
    code: "WV",
    name: "West Virginia",
    url: "https://mytaxes.wvtax.gov/_/",
    steps: [
      { kind: "click", label: "Search for a Refund", shot: "wv-1" },
      { kind: "fill", fields: ["ssn", "taxYear", "refundAmount"], shot: "wv-2" },
    ],
  },
  {
    code: "WI",
    name: "Wisconsin",
    url: "https://ww2.revenue.wi.gov/RefundInquiry/request.html",
    steps: [{ kind: "fill", fields: ["taxYear", "ssn", "refundAmount"], shot: "wi-1" }],
  },
];
