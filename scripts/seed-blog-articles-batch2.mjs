#!/usr/bin/env node
/**
 * Add 3 science-linked Articles posts (client content cadence examples).
 * Citations match links already used in the homepage Stories section.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = 'hnmtjh-0i.myshopify.com';
const BLOG_ID = 'gid://shopify/Blog/124494283124';
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const ARTICLES = [
  {
    handle: 'microplastics-detected-in-human-blood',
    title: 'Microplastics Detected in Human Blood',
    tags: ['Research', 'Microplastics', 'Science'],
    image: 'assets/tamarinse-photo-tap-water.webp',
    alt: 'Tap water pouring into a glass',
    summary:
      '<p>A 2022 study quantified plastic particles in human blood — one of the clearest signals that microplastics are not only an environmental issue.</p>',
    body: `
<p>For years, microplastics were discussed mainly as an ocean and wildlife problem. That framing is changing as researchers look inside the human body itself.</p>
<p>In 2022, Leslie and colleagues reported plastic particles in the blood of nearly 8 in 10 people tested — 17 of 22 donors in a small but widely cited analysis published in <em>Environment International</em>. You can read the paper here: <a href="https://www.sciencedirect.com/science/article/pii/S0160412022001258" target="_blank" rel="noopener noreferrer">Plastic particles in human blood (Leslie et al., 2022)</a>.</p>
<p>That finding does not tell us what every exposure pathway looks like for every person. It does help explain why everyday water, food packaging, and indoor dust keep showing up in public conversation.</p>
<h2>Where exposure research keeps pointing</h2>
<p>Separate work on drinking water has sharpened the picture. A 2024 study in <em>Proceedings of the National Academy of Sciences</em> reported that a single liter of bottled water can contain around 240,000 plastic particles on average: <a href="https://www.pnas.org/doi/10.1073/pnas.2300582121" target="_blank" rel="noopener noreferrer">Rapid single-particle chemical imaging of nanoplastics (Qian et al., PNAS, 2024)</a>.</p>
<p>Taken together, these papers are not product claims. They are part of the scientific backdrop for why Tamarinse™ focuses on daily environmental defense with plant-based ingredients designed to support digestive elimination pathways.</p>
<p><em>Educational only. Not medical advice. Study designs, sample sizes, and methods vary — always read the primary research.</em></p>
`.trim(),
  },
  {
    handle: 'microplastics-found-in-artery-plaque',
    title: 'Microplastics Found in Artery Plaque',
    tags: ['Research', 'Microplastics', 'Science'],
    image: 'assets/tamarinse-photo-takeout.webp',
    alt: 'Takeout food in plastic packaging',
    summary:
      '<p>A 2024 New England Journal of Medicine paper reported microplastics and nanoplastics in arterial plaque — and linked their presence to higher cardiovascular event rates in the study group.</p>',
    body: `
<p>One of the most discussed microplastics papers of the last few years did not come from an environmental journal. It came from cardiology.</p>
<p>In 2024, researchers writing in <em>The New England Journal of Medicine</em> reported microplastics and nanoplastics in human arterial plaque. In that study cohort, patients with detectable plastic in plaque had a higher rate of heart attack, stroke, or death during follow-up than those without: <a href="https://www.nejm.org/doi/full/10.1056/NEJMoa2309822" target="_blank" rel="noopener noreferrer">Microplastics and Nanoplastics in Atheromas (NEJM, 2024)</a>.</p>
<p>As with any single study, this is not a final verdict on cause and effect for every population. It is a serious data point in an expanding literature that treats plastic particles as biologically relevant — not just an outdoor pollution story.</p>
<h2>Why daily routines still matter</h2>
<p>Research on blood and plaque sits beside more familiar exposure routes: bottled drinks, heated takeout packaging, and kitchen plastics. A related PNAS analysis of bottled water remains a useful companion read: <a href="https://www.pnas.org/doi/10.1073/pnas.2300582121" target="_blank" rel="noopener noreferrer">Qian et al., PNAS, 2024</a>.</p>
<p>Tamarinse™ is built for people who want a consistent, plant-based daily ritual designed for modern environmental exposure — alongside practical habit changes, not instead of them.</p>
<p><em>Educational only. Not medical advice. This article summarizes published research and does not claim that any supplement treats or prevents cardiovascular disease.</em></p>
`.trim(),
  },
  {
    handle: 'fiber-and-microplastic-excretion-what-studies-suggest',
    title: 'Fiber and Microplastic Excretion: What Studies Suggest',
    tags: ['Research', 'Fiber', 'Digestion', 'Science'],
    image: 'assets/tamarinse-photo-lunch.webp',
    alt: 'Preparing a meal at home',
    summary:
      '<p>Animal research and plant-polymer studies are exploring how dietary fiber and natural polysaccharides interact with microplastics in digestive environments.</p>',
    body: `
<p>If microplastics are entering the body through food and water, a natural research question follows: what happens to those particles in the digestive tract — and can diet change how they move through?</p>
<p>A 2025 paper in <em>Scientific Reports</em> (Nature Portfolio) examined ingested fiber and microplastic excretion in animal studies: <a href="https://www.nature.com/articles/s41598-025-96393-w" target="_blank" rel="noopener noreferrer">Fiber increased microplastic excretion in animal studies (Scientific Reports, 2025)</a>. Findings in animals are not the same as proven outcomes in people, but they help map mechanisms researchers care about.</p>
<h2>Plant polymers enter the conversation</h2>
<p>Separately, work published in <em>ACS Omega</em> has looked at plant-derived polymers — including materials from tamarind, okra, and fenugreek — for removing microplastics from water: <a href="https://pubs.acs.org/doi/10.1021/acsomega.4c07476" target="_blank" rel="noopener noreferrer">Okra, fenugreek &amp; tamarind polymers and microplastics (ACS Omega, 2025)</a>.</p>
<p>That laboratory and water-treatment context is one reason tamarind seed extract sits at the center of Tamarinse™, alongside other plant-based ingredients designed to support healthy digestive function and the body’s natural elimination processes.</p>
<p>Activated charcoal’s binding behavior in the digestive tract is another long-studied topic in clinical toxicology references such as <a href="https://www.ncbi.nlm.nih.gov/books/NBK482294/" target="_blank" rel="noopener noreferrer">StatPearls / National Library of Medicine</a>. In Tamarinse, charcoal is included at a micro-dose intended for daily use — not as an acute medical intervention.</p>
<p><em>Educational only. Supplements are not intended to diagnose, treat, cure, or prevent any disease. Always review primary sources and speak with a qualified clinician about personal health decisions.</em></p>
`.trim(),
  },
];

function gql(query, variables = {}, { mutate = false } = {}) {
  const args = [
    'store',
    'execute',
    '-s',
    STORE,
    '-j',
    '-q',
    query,
    '-v',
    JSON.stringify(variables),
  ];
  if (mutate) args.push('--allow-mutations');
  let out;
  try {
    out = execFileSync('shopify', args, {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    out = `${err.stdout || ''}\n${err.stderr || ''}`;
    const startErr = out.indexOf('{');
    if (startErr === -1) throw err;
    try {
      return JSON.parse(out.slice(startErr).replace(/\x1B\[[0-9;]*[A-Za-z]/g, ''));
    } catch {
      throw err;
    }
  }
  const cleaned = out.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error(`No JSON in CLI output:\n${out}`);
  return JSON.parse(cleaned.slice(start));
}

async function uploadImage(localPath) {
  const filename = basename(localPath);
  const size = statSync(localPath).size;
  const mimeType = 'image/webp';

  const staged = gql(
    `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }`,
    {
      input: [
        {
          filename,
          mimeType,
          httpMethod: 'POST',
          resource: 'FILE',
          fileSize: String(size),
        },
      ],
    },
    { mutate: true }
  );

  const errors = staged.stagedUploadsCreate?.userErrors || [];
  if (errors.length) throw new Error(`stagedUploadsCreate: ${JSON.stringify(errors)}`);
  const target = staged.stagedUploadsCreate.stagedTargets[0];

  const form = new FormData();
  for (const { name, value } of target.parameters) form.append(name, value);
  form.append('file', new Blob([readFileSync(localPath)], { type: mimeType }), filename);

  const uploadRes = await fetch(target.url, { method: 'POST', body: form });
  if (!uploadRes.ok) throw new Error(`Upload failed ${uploadRes.status}: ${await uploadRes.text()}`);

  const fileResult = gql(
    `mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          ... on MediaImage {
            id
            image { url }
          }
        }
        userErrors { field message }
      }
    }`,
    {
      files: [
        {
          originalSource: target.resourceUrl,
          contentType: 'IMAGE',
          filename,
          alt: filename,
        },
      ],
    },
    { mutate: true }
  );

  const fileErrors = fileResult.fileCreate?.userErrors || [];
  if (fileErrors.length) throw new Error(`fileCreate: ${JSON.stringify(fileErrors)}`);

  let imageUrl = fileResult.fileCreate.files?.[0]?.image?.url;
  const fileId = fileResult.fileCreate.files?.[0]?.id;

  for (let i = 0; i < 12 && !imageUrl && fileId; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = gql(
      `query ($id: ID!) {
        node(id: $id) {
          ... on MediaImage { image { url } }
        }
      }`,
      { id: fileId }
    );
    imageUrl = poll.node?.image?.url;
  }

  return imageUrl || target.resourceUrl;
}

async function createArticle(article, imageUrl) {
  const result = gql(
    `mutation articleCreate($article: ArticleCreateInput!) {
      articleCreate(article: $article) {
        article {
          id
          title
          handle
          image { url altText }
        }
        userErrors { field message code }
      }
    }`,
    {
      article: {
        blogId: BLOG_ID,
        title: article.title,
        handle: article.handle,
        author: { name: 'Tamarinse' },
        body: article.body,
        summary: article.summary,
        tags: article.tags,
        isPublished: true,
        image: {
          url: imageUrl,
          altText: article.alt,
        },
      },
    },
    { mutate: true }
  );

  const errors = result.articleCreate?.userErrors || [];
  if (errors.length) throw new Error(`articleCreate (${article.handle}): ${JSON.stringify(errors)}`);
  return result.articleCreate.article;
}

async function main() {
  console.log('Creating 3 science-linked articles…');
  for (const article of ARTICLES) {
    console.log(`\n→ ${article.title}`);
    const imageUrl = await uploadImage(join(ROOT, article.image));
    console.log(`  image: ${imageUrl}`);
    const post = await createArticle(article, imageUrl);
    console.log(`  created: /blogs/articles/${post.handle}`);
  }
  console.log('\nDone. Blog now has 7 articles for cadence reference.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
