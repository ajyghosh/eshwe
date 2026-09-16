import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";

const pageUrl = "https://eshwe.com/saree-culture/";
const title = "Saree Culture: Kerala Sarees & Indian Saree Types";
const description = "Explore Kerala kasavu sarees, Onam traditions, cotton, tissue and silk saree styles. An eshwe guide to choosing, styling and caring for your next drape.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: pageUrl },
  robots: { index: true, follow: true },
  openGraph: {
    title: `${title} | eshwe`,
    description,
    url: pageUrl,
    type: "article",
    publishedTime: "2026-09-16",
    modifiedTime: "2026-09-16",
    images: [{ url: "/hero.webp", width: 1536, height: 1024, alt: "Sarees in soft green, ivory and pink" }]
  },
  twitter: { card: "summary_large_image", title, description, images: ["/hero.webp"] }
};

const everydayStyles = [
  {
    title: "Mul cotton sarees",
    text: "Mul cotton is often chosen for its soft, airy feel. For an everyday saree, look at the fabric's transparency as well as its weight: a light drape may need a matching underskirt. Simple jewellery and a comfortable blouse let the texture take centre stage.",
    filter: "Mul Cotton"
  },
  {
    title: "Kanchi cotton sarees",
    text: "A cotton option for someone who enjoys defined borders and a more structured drape. Kanchi cotton and Kanchipuram silk are different purchases; check the stated fibre rather than assuming that a regional name means silk. Think about how crisp or relaxed you want your pleats to feel.",
    filter: "Kanchi Cotton"
  },
  {
    title: "Sungudi cotton sarees",
    text: "Sungudi is associated with Madurai and a tradition of tied-and-dyed cotton. Its small dotted patterns bring detail to a simple outfit. Check the individual description for how a piece is made: a similar-looking print does not necessarily use the traditional tie-dye process.",
    filter: "Sungudi Cotton"
  },
  {
    title: "Soft silk sarees",
    text: "Soft silk describes a style of supple drape rather than a single regional weaving tradition. It can be a starting point for wedding-guest outfits and family celebrations. Read the composition carefully: the words soft silk alone do not establish silk purity, weight or the way a saree was woven.",
    filter: "Soft Silk"
  },
  {
    title: "Tissue silk sarees",
    text: "Tissue-style fabrics are recognised for a luminous, light-catching finish. A tissue silk saree can bring subtle shine to festive dressing, but composition and stiffness vary. Look at close-up photographs of the body and border, and choose a blouse that feels comfortable against the fabric.",
    filter: "Tissue Silk"
  }
];

const regionalStyles = [
  { name: "Kanchipuram / Kanjeevaram", place: "Tamil Nadu", detail: "A silk-weaving tradition associated with Kanchipuram. Often explored for wedding sarees and richly bordered festive drapes." },
  { name: "Banarasi", place: "Varanasi, Uttar Pradesh", detail: "Known for brocade weaving and ornamental detail. Look closely at the motifs, weave and composition when comparing occasion sarees." },
  { name: "Chanderi", place: "Madhya Pradesh", detail: "A regional weaving tradition often associated with a light, sheer appearance. Compare the fibre blend and opacity of the individual piece." },
  { name: "Maheshwari", place: "Maheshwar, Madhya Pradesh", detail: "Known for lightweight fabrics and distinctive borders. A useful style to explore when you enjoy a defined border without a heavy-looking outfit." },
  { name: "Paithani", place: "Maharashtra", detail: "A celebrated regional saree tradition. Consider the pallu and border together when planning a blouse and accessories." },
  { name: "Pochampally ikat", place: "Telangana", detail: "Ikat creates patterns by dyeing yarn before weaving. Cotton and silk versions offer different textures and ways to wear the pattern." }
];

const questions = [
  { question: "What is the difference between a Kerala saree and set mundu?", answer: "A Kerala saree is a single continuous drape, commonly in white or cream with a contrasting border. Set mundu, also called mundum neriyathum, is a two-piece ensemble. Confirm which format a listing includes before ordering for Onam or another celebration." },
  { question: "Does kasavu mean that a saree contains pure gold?", answer: "Do not infer metal purity from the name or colour. Kasavu refers to the decorative border tradition, and the materials used in contemporary sarees vary. Ask for the stated border and fibre composition when those details matter to your purchase." },
  { question: "Which saree should I choose for everyday wear?", answer: "Start with the weight, feel and care requirements you find comfortable. Mul cotton and other cotton sarees are useful options to compare. Check transparency, blouse requirements and wash instructions, particularly if you plan to wear the saree for a full working day." },
  { question: "Are tissue silk and soft silk the same?", answer: "No. Tissue-style sarees are usually selected for their luminous finish, while soft silk describes a supple feel and drape. Neither name alone tells you the complete fibre composition. The individual product details are more useful than the category name when comparing two sarees." },
  { question: "How can I find sarees under ₹1,000 at eshwe?", answer: "Open Affordable Elegance to see sarees with a current selling price from ₹399 to ₹999, inclusive. You can combine that price range with category and fabric filters. The selection changes as products and prices are updated." }
];

const sections = [
  ["kerala-sarees", "Kerala & kasavu"],
  ["saree-types", "Cotton, silk & tissue"],
  ["regional-weaves", "Regional sarees"],
  ["choosing-a-saree", "Find your drape"],
  ["saree-care", "Care & keeping"],
  ["questions", "Common questions"]
];

export default function SareeCulturePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        headline: title,
        description,
        mainEntityOfPage: pageUrl,
        image: "https://eshwe.com/hero.webp",
        inLanguage: "en-IN",
        datePublished: "2026-09-16",
        dateModified: "2026-09-16",
        author: { "@type": "Organization", "@id": "https://eshwe.com/#organization", name: "eshwe Saree Studio", url: "https://eshwe.com/" },
        publisher: { "@id": "https://eshwe.com/#organization" },
        articleSection: ["Saree culture", "Kerala sarees", "Saree types", "Saree care"]
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://eshwe.com/" },
          { "@type": "ListItem", position: 2, name: "Saree culture", item: pageUrl }
        ]
      }
    ]
  };

  return (
    <main className="web-storefront min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />

      <article className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-10 lg:px-12">
        <nav aria-label="Breadcrumb" className="mb-7 flex gap-3 text-sm text-[#626e58]">
          <Link href="/" className="underline underline-offset-4">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Saree culture</span>
        </nav>

        <header className="overflow-hidden rounded-[1.6rem] border border-[#e3d8c9] bg-[#f8f0e3]">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="px-6 py-9 sm:p-10 lg:py-14">
              <p className="brand-caption text-xs font-semibold uppercase tracking-[0.16em] text-[#657260]">The eshwe journal · Culture & cloth</p>
              <h1 className="brand-copy mt-4 text-4xl leading-[1.08] text-[#354233] sm:text-5xl">Saree culture:<br />a story in every drape</h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#626e58]">
                Kerala kasavu, everyday cotton, luminous tissue and celebratory silk. Get to know the
                saree styles, traditions and textures behind the clothes we choose to wear.
              </p>
              <p className="mt-5 text-xs leading-6 text-[#626e58]">By eshwe Saree Studio · <time dateTime="2026-09-16">16 September 2026</time></p>
              <Link href="#kerala-sarees" className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-xl bg-[#5e684f] px-5 py-3 text-sm font-semibold !text-[#fbf4e8]">Begin with Kerala <span aria-hidden="true">↓</span></Link>
            </div>
            <div className="relative min-h-72 sm:min-h-96">
              <Image src="/hero.webp" alt="Three saree drapes in soft green, ivory and pink, with contrasting borders" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover object-center" />
            </div>
          </div>
        </header>

        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-14">
          <nav aria-label="In this guide" className="rounded-2xl border border-[#e3d8c9] bg-[#fffaf2] p-5 lg:sticky lg:top-24">
            <p className="brand-caption text-xs font-semibold uppercase tracking-wider">In this guide</p>
            <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {sections.map(([id, label]) => <li key={id}><a href={`#${id}`} className="flex min-h-11 items-center text-sm underline decoration-[#d1c3ae] underline-offset-4 hover:text-[#2f342d]">{label}</a></li>)}
            </ul>
          </nav>

          <div className="min-w-0 space-y-12 text-[0.96rem] leading-8 text-[#626e58]">
            <div>
              <h2 className="brand-copy text-3xl leading-tight text-[#354233]">More than an occasion outfit</h2>
              <p className="mt-4">A saree, also written as sari, can be a daily companion, a festive favourite or a garment kept for a family milestone. The experience changes with the fabric, the way you pleat it and the memories you attach to it. There is no single correct saree for every woman or every occasion.</p>
              <p className="mt-4">It helps to separate three things when browsing: the fibre, such as cotton or silk; the weave or finish; and the regional tradition. A place name and a fabric name tell different parts of the story. This guide introduces familiar styles rather than an exhaustive list of India&apos;s saree traditions.</p>
            </div>

            <section id="kerala-sarees" className="scroll-mt-28 rounded-2xl border border-[#dcd8c7] bg-[#edf0e5] p-6 sm:p-8">
              <p className="brand-caption text-xs uppercase tracking-wider">A Kerala favourite</p>
              <h2 className="brand-copy mt-2 text-3xl leading-tight text-[#354233]">Kerala sarees, kasavu & Onam</h2>
              <p className="mt-4">The familiar Kerala saree pairs a white or off-white body with a golden kasavu border. It is closely associated with celebrations, including Onam, and with a restrained palette that gives the border room to stand out. A Kerala set saree is a single drape; set mundu, or mundum neriyathum, is a two-piece outfit.</p>
              <p className="mt-4">For an Onam saree, begin with the silhouette you enjoy. A narrow border can keep the look understated, while a wider border gives the pleats and pallu more definition. A green, maroon or gold-toned blouse is one styling option; a cream blouse creates a quieter, tonal outfit.</p>
              <p className="mt-4">Kerala&apos;s weaving story also belongs to its makers. Kuthampully in Thrissur is known for its handloom tradition. When shopping for a handloom Kerala saree, ask about the weaving method and materials instead of relying on the name, a photograph or a gold-coloured border alone.</p>
              <p className="mt-4 text-sm">Read more from Kerala Tourism: <a href="https://www.keralatourism.org/faq/what-is-kerala-sari-and-mundu" className="underline underline-offset-4">Kerala saree and mundu</a> · <a href="https://www.keralatourism.org/campaigns/kerala365/kuthampully-thrissur" className="underline underline-offset-4">Kuthampully&apos;s weaving tradition</a>.</p>
            </section>

            <section id="saree-types" className="scroll-mt-28">
              <h2 className="brand-copy text-3xl leading-tight text-[#354233]">Cotton, soft silk & tissue: find your feel</h2>
              <p className="mt-4">Start with how you want the saree to feel through the day. These are the categories you can explore at eshwe; the current shop listings show which pieces are available.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {everydayStyles.map((style) => (
                  <div key={style.filter} className="rounded-2xl border border-[#e3d8c9] bg-[#fffaf2] p-5 sm:p-6">
                    <h3 className="brand-copy text-2xl leading-tight text-[#354233]">{style.title}</h3>
                    <p className="mt-3 text-sm leading-7">{style.text}</p>
                    <Link href={`/shop/?browse=curated&filter=${encodeURIComponent(style.filter)}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Explore {style.filter.toLowerCase()} <span aria-hidden="true" className="ml-2">→</span></Link>
                  </div>
                ))}
                <div className="rounded-2xl bg-[#5a6851] p-5 text-[#fbf4e8] sm:p-6">
                  <h3 className="brand-copy text-2xl leading-tight">A little everyday elegance</h3>
                  <p className="mt-3 text-sm leading-7">Shopping with a budget in mind? Affordable Elegance brings together sarees priced from ₹399 to ₹999. Compare the fabric and finish of each piece, then refine the selection by category.</p>
                  <Link href="/shop/?priceRange=affordable" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Browse sarees under ₹1,000 <span aria-hidden="true" className="ml-2">→</span></Link>
                </div>
              </div>
              <p className="mt-4 text-sm">For more on traditional Madurai Sungudi, see the Government of India&apos;s <a href="https://www.handicrafts.nic.in/CmsUpload/12222017102212GI%20BOOK%20FINAL%202-5-17_resized.pdf" className="underline underline-offset-4">compendium of regional handicrafts and handlooms (PDF)</a>.</p>
            </section>

            <section id="regional-weaves" className="scroll-mt-28">
              <h2 className="brand-copy text-3xl leading-tight text-[#354233]">A wider world of Indian sarees</h2>
              <p className="mt-4">Regional names are a starting point for learning about craftsmanship. The traditions below are included for discovery; they are not a list of products currently stocked by eshwe.</p>
              <dl className="mt-6 divide-y divide-[#e3d8c9] border-y border-[#e3d8c9]">
                {regionalStyles.map((style) => (
                  <div key={style.name} className="grid gap-2 py-5 sm:grid-cols-[190px_1fr] sm:gap-6">
                    <dt><span className="brand-copy block text-xl text-[#354233]">{style.name}</span><span className="text-xs">{style.place}</span></dt>
                    <dd className="text-sm leading-7">{style.detail}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4">You will also encounter linen, chiffon and georgette sarees. Those names describe fibres or fabric constructions rather than a single regional tradition. Check the actual composition, opacity and care instructions to understand what you are buying.</p>
              <p className="mt-4 text-sm">Explore the textile stories documented by Incredible India: <a href="https://www.incredibleindia.gov.in/en/tamil-nadu/kanchipuram" className="underline underline-offset-4">Kanchipuram</a>, <a href="https://www.incredibleindia.gov.in/en/uttar-pradesh/banaras-brocades-and-sarees" className="underline underline-offset-4">Banaras brocades</a>, <a href="https://www.incredibleindia.gov.in/en/madhya-pradesh/maheshwar-sarees-and-fabrics" className="underline underline-offset-4">Maheshwari fabrics</a> and <a href="https://www.incredibleindia.gov.in/en/telangana/pochampally-ikat" className="underline underline-offset-4">Pochampally ikat</a>.</p>
            </section>

            <section id="choosing-a-saree" className="scroll-mt-28">
              <h2 className="brand-copy text-3xl leading-tight text-[#354233]">How to choose a saree online</h2>
              <p className="mt-4">For daily wear or the office, compare weight, transparency and the time you want to spend on care. For a wedding or festival, consider how the border and pallu will look with your blouse and jewellery. For gifting, practical details such as the recipient&apos;s preferred fabric can matter more than an elaborate finish.</p>
              <ol className="mt-5 list-decimal space-y-3 pl-5">
                <li><strong className="text-[#354233]">Read the fabric details.</strong> Look for the stated fibre or blend. A glossy finish is not proof of pure silk, and a traditional motif is not proof of handloom weaving.</li>
                <li><strong className="text-[#354233]">Check what is included.</strong> Confirm saree length, whether there is a blouse piece, and whether accessories shown in photographs are included.</li>
                <li><strong className="text-[#354233]">Look beyond the first image.</strong> Compare the body, border and pallu. Screens and lighting can change the appearance of a colour.</li>
                <li><strong className="text-[#354233]">Plan for the occasion.</strong> Read the delivery and return information before ordering for a fixed date. Ask for help if a material or care detail is unclear.</li>
              </ol>
              <Link href="/contact/" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Ask eshwe about a saree →</Link>
            </section>

            <section id="saree-care" className="scroll-mt-28">
              <h2 className="brand-copy text-3xl leading-tight text-[#354233]">Saree care: keeping a favourite beautiful</h2>
              <p className="mt-4">Follow the instructions supplied with your saree first. Cotton, silk, metallic borders, dyes and embellishments can need different treatment. Do not assume that every cotton saree can be machine washed or that every silk blend should be handled the same way.</p>
              <p className="mt-4">Store a saree only when it is dry, away from strong sunlight and damp. Avoid snagging delicate yarns with jewellery or rough hangers. Before using heat, steam, starch or a stain treatment, check the care guidance; for an uncertain fabric or ornate border, ask the seller or a specialist cleaner.</p>
            </section>

            <section id="questions" className="scroll-mt-28">
              <h2 className="brand-copy text-3xl leading-tight text-[#354233]">Common saree questions</h2>
              <div className="mt-6 space-y-5">
                {questions.map((item) => <div key={item.question} className="rounded-2xl border border-[#e3d8c9] bg-[#fffaf2] p-5 sm:p-6"><h3 className="brand-copy text-xl leading-snug text-[#354233]">{item.question}</h3><p className="mt-3 text-sm leading-7">{item.answer}</p></div>)}
              </div>
            </section>

            <section className="rounded-2xl bg-[#edf0e5] p-6 sm:p-8">
              <h2 className="brand-copy text-3xl leading-tight text-[#354233]">Find a saree for your own story</h2>
              <p className="mt-3">Explore the current eshwe collection by fabric, occasion or price. Choose the drape that feels right for your day.</p>
              <Link href="/shop/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#5e684f] px-5 py-3 text-sm font-semibold !text-[#fbf4e8]">Explore the saree collection →</Link>
            </section>
          </div>
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
