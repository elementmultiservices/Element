// Generates supabase/snippets/sample-blog-posts.sql and remove-sample-blog-posts.sql:
// nine bilingual test posts (articles and quick updates) for previewing the blog.
// Usage: npm run blog:samples   (then paste the .sql file into the Supabase SQL editor)
import { writeFileSync } from "node:fs";

const NOTE = {
  es: "<p><em>Publicación de prueba: revisa y edita este contenido antes de usarlo.</em></p>",
  en: "<p><em>Test post: review and edit this content before using it.</em></p>",
};

const categories = [
  { key: "law", es: ["Cambios en la ley", "cambios-en-la-ley"], en: ["Law changes", "law-changes"] },
  { key: "itin", es: ["ITIN", "itin"], en: ["ITIN", "itin"] },
  { key: "refunds", es: ["Reembolsos", "reembolsos"], en: ["Refunds", "refunds"] },
  { key: "business", es: ["Negocios", "negocios"], en: ["Business", "business"] },
  { key: "dates", es: ["Fechas clave", "fechas-clave"], en: ["Key dates", "key-dates"] },
  { key: "guides", es: ["Guías prácticas", "guias-practicas"], en: ["How-to guides", "how-to-guides"] },
  { key: "news", es: ["Novedades", "novedades-element"], en: ["News", "element-news"] },
];

const posts = [
  {
    days: 5, kind: "article", featured: true, category: "law", source: "https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions",
    es: ["Propinas y horas extra: cómo funcionan las nuevas deducciones", "prueba-propinas-y-horas-extra",
      "Hasta $25,000 en propinas y hasta $12,500 de la parte adicional de tus horas extra. Quién califica y qué necesitas para reclamarlas.",
      "<h2>Qué cambió</h2><p>La nueva ley permite deducir parte de las propinas y del pago adicional por horas extra en la declaración federal, para los años 2025 a 2028.</p><h2>Qué necesitas</h2><ul><li>Tu W-2 o 1099 con las propinas reportadas.</li><li>Los registros de tus horas extra.</li></ul><p>Tráelos a tu cita y revisamos si calificas.</p>"],
    en: ["Tips and overtime: how the new deductions work", "test-tips-and-overtime",
      "Up to $25,000 in tips and up to $12,500 of the extra part of your overtime pay. Who qualifies and what you need to claim them.",
      "<h2>What changed</h2><p>The new law lets you deduct part of your tips and of your overtime premium on your federal return, for tax years 2025 through 2028.</p><h2>What you need</h2><ul><li>Your W-2 or 1099 showing reported tips.</li><li>Your overtime records.</li></ul><p>Bring them to your appointment and we'll check whether you qualify.</p>"],
  },
  {
    days: 11, kind: "article", category: "itin", source: "https://www.irs.gov/individuals/individual-taxpayer-identification-number",
    es: ["¿Tu ITIN venció sin que lo supieras?", "prueba-itin-vencido", "Si no usaste tu ITIN en una declaración federal durante tres años seguidos, vence. Así lo renuevas.",
      "<p>Un ITIN que no aparece en ninguna declaración federal durante tres años consecutivos vence al final del tercer año.</p><h2>Cómo renovarlo</h2><p>Se renueva con el Formulario W-7 y tus documentos de identidad. Podemos ayudarte a prepararlo junto con tu declaración.</p>"],
    en: ["Did your ITIN expire without you knowing?", "test-expired-itin", "If you didn't use your ITIN on a federal return for three years in a row, it expires. Here's how to renew it.",
      "<p>An ITIN that isn't used on any federal return for three consecutive years expires at the end of the third year.</p><h2>How to renew it</h2><p>You renew it with Form W-7 and your identity documents. We can help you prepare it along with your return.</p>"],
  },
  {
    days: 14, kind: "update", category: "news",
    es: ["Ya abrimos citas para la temporada de impuestos", "prueba-citas-temporada", "Reserva tu cita desde ahora y llega a la temporada con tus papeles listos.",
      "<p>Desde hoy puedes agendar tu cita para la próxima temporada de impuestos. Si subes tus documentos a Mi Archivo antes de venir, la cita es más rápida.</p>"],
    en: ["Appointments for tax season are now open", "test-season-appointments", "Book your appointment now and start tax season with your paperwork ready.",
      "<p>Starting today you can book your appointment for the upcoming tax season. If you upload your documents to My Files before coming in, the appointment goes faster.</p>"],
  },
  {
    days: 18, kind: "article", category: "refunds", source: "https://www.irs.gov/refunds",
    es: ["Tu reembolso, ahora por depósito directo", "prueba-deposito-directo", "El IRS está dejando los cheques en papel. Qué datos bancarios necesitas para recibir tu reembolso.",
      "<p>El depósito directo es la forma más rápida de recibir tu reembolso. Necesitarás tu número de ruta y tu número de cuenta.</p><blockquote>Revisa bien los números: un error puede retrasar tu reembolso varias semanas.</blockquote>"],
    en: ["Your refund, now by direct deposit", "test-direct-deposit", "The IRS is phasing out paper checks. The bank details you need to get your refund.",
      "<p>Direct deposit is the fastest way to get your refund. You'll need your routing number and your account number.</p><blockquote>Double-check the numbers: a mistake can delay your refund by several weeks.</blockquote>"],
  },
  {
    days: 22, kind: "article", category: "law", source: "https://www.irs.gov/newsroom",
    es: ["Lo que viene para 2027: proyección de los tramos", "prueba-tramos-2027", "Los tramos de impuestos se ajustan cada año por inflación. Qué esperar para tu próxima declaración.",
      "<p>Cada año el IRS ajusta los tramos y la deducción estándar por inflación. Te contamos cómo te puede afectar y cuándo se publican las cifras oficiales.</p>"],
    en: ["What's coming for 2027: projected brackets", "test-brackets-2027", "Tax brackets are adjusted for inflation every year. What to expect on your next return.",
      "<p>Every year the IRS adjusts the brackets and the standard deduction for inflation. Here's how it may affect you and when the official figures are published.</p>"],
  },
  {
    days: 27, kind: "article", category: "guides", source: "https://www.irs.gov/individuals/steps-to-take-now-to-get-a-jump-on-next-years-taxes",
    es: ["Qué traer a tu cita de impuestos: la lista completa", "prueba-que-traer", "Identificación, W-2, 1099, tu declaración anterior y datos bancarios. Todo lo que necesitas en una lista.",
      "<ul><li>Identificación con foto.</li><li>Seguro Social o ITIN de cada persona.</li><li>W-2, 1099 y 1095-A.</li><li>Tu declaración del año pasado.</li><li>Número de ruta y de cuenta para el depósito.</li></ul>"],
    en: ["What to bring to your tax appointment: the full list", "test-what-to-bring", "ID, W-2, 1099, last year's return and bank details. Everything you need in one list.",
      "<ul><li>Photo ID.</li><li>Social Security number or ITIN for each person.</li><li>W-2, 1099 and 1095-A.</li><li>Last year's tax return.</li><li>Routing and account number for direct deposit.</li></ul>"],
  },
  {
    days: 33, kind: "article", category: "business", source: "https://www.tax.ny.gov/bus/st/stidx.htm",
    es: ["Sales tax en Nueva York: lo básico para tu negocio", "prueba-sales-tax-ny", "Quién debe registrarse, cuánto se cobra y cada cuánto se declara.",
      "<p>Si vendes productos o ciertos servicios en Nueva York, debes registrarte para cobrar sales tax. La tasa combina la tasa estatal y la local, por eso cambia según el condado.</p>"],
    en: ["New York sales tax: the basics for your business", "test-ny-sales-tax", "Who needs to register, how much to charge and how often to file.",
      "<p>If you sell goods or certain services in New York, you must register to collect sales tax. The rate combines the state and local rates, so it varies by county.</p>"],
  },
  {
    days: 38, kind: "update", category: "news",
    es: ["Horario especial por el feriado", "prueba-horario-feriado", "Te avisamos los días en que la oficina tendrá horario reducido.",
      "<p>Durante el próximo feriado la oficina tendrá horario reducido. Puedes seguir escribiéndonos por WhatsApp y te responderemos el siguiente día hábil.</p>"],
    en: ["Special hours for the holiday", "test-holiday-hours", "The days our office will have reduced hours.",
      "<p>During the upcoming holiday the office will have reduced hours. You can still message us on WhatsApp and we'll reply the next business day.</p>"],
  },
  {
    days: 44, kind: "article", category: "dates", source: "https://www.irs.gov/faqs/estimated-tax",
    es: ["Impuestos estimados: las cuatro fechas que no puedes olvidar", "prueba-impuestos-estimados", "15 de abril, 15 de junio, 15 de septiembre y 15 de enero. Qué pagar en cada una.",
      "<p>Si trabajas por tu cuenta, el IRS espera pagos durante el año. Las fechas habituales son el 15 de abril, el 15 de junio, el 15 de septiembre y el 15 de enero del año siguiente.</p>"],
    en: ["Estimated taxes: the four dates you can't forget", "test-estimated-taxes", "April 15, June 15, September 15 and January 15. What to pay on each one.",
      "<p>If you're self-employed, the IRS expects payments during the year. The usual dates are April 15, June 15, September 15 and January 15 of the following year.</p>"],
  },
];

const q = (s) => (s == null ? "null" : `$t$${s}$t$`);

let sql = `-- Element — sample blog posts for previewing the site (generated by \`npm run blog:samples\`).
-- Paste into the Supabase SQL editor of a DEVELOPMENT project. Requires migration
-- 20261013000100 and at least one admin account (used as the author).
-- Remove them with remove-sample-blog-posts.sql.

begin;

`;
for (const c of categories) {
  sql += `insert into public.post_categories (name_en, name_es, slug_en, slug_es) values (${q(c.en[0])}, ${q(c.es[0])}, ${q(c.en[1])}, ${q(c.es[1])})
  on conflict (slug_en) do nothing;\n`;
}
sql += `\n`;
for (const p of posts) {
  const cat = categories.find((c) => c.key === p.category);
  sql += `with new_post as (
  insert into public.posts (status, published_at, author_id, category_id, kind, is_featured, source_url)
  values (
    'published',
    now() - interval '${p.days} days',
    (select id from public.profiles where role = 'admin' order by created_at limit 1),
    (select id from public.post_categories where slug_en = ${q(cat.en[1])}),
    '${p.kind}'::public.post_kind,
    ${p.featured ? "true" : "false"},
    ${q(p.source ?? null)}
  )
  returning id
)
insert into public.post_translations (post_id, locale, title, slug, excerpt, content)
select id, 'es'::public.app_locale, ${q(p.es[0])}, ${q(p.es[1])}, ${q(p.es[2])}, ${q(NOTE.es + p.es[3])} from new_post
union all
select id, 'en'::public.app_locale, ${q(p.en[0])}, ${q(p.en[1])}, ${q(p.en[2])}, ${q(NOTE.en + p.en[3])} from new_post;

`;
}
sql += `commit;\n`;

const slugs = posts.flatMap((p) => [p.es[1], p.en[1]]);
const remove = `-- Element — removes the sample blog posts created by sample-blog-posts.sql.
-- Categories are kept (they may be in use); delete them from the admin if not needed.

delete from public.posts
 where id in (select post_id from public.post_translations where slug in (${slugs.map((s) => `'${s}'`).join(", ")}));
`;

writeFileSync("supabase/snippets/sample-blog-posts.sql", sql);
writeFileSync("supabase/snippets/remove-sample-blog-posts.sql", remove);
console.log(`Wrote ${posts.length} posts and ${categories.length} categories.`);
