#!/usr/bin/env node
/**
 * Seed Tamarinse Articles blog with educational posts + theme photo images.
 * Uses: shopify store execute (GraphQL) + staged upload (multipart PUT/POST).
 *
 * Run: node scripts/seed-blog-articles.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = 'hnmtjh-0i.myshopify.com';
const BLOG_ID = 'gid://shopify/Blog/124494283124';
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

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
    // Prefer throwing GraphQL userErrors below if JSON parsed
    try {
      return JSON.parse(out.slice(startErr).replace(/\x1B\[[0-9;]*[A-Za-z]/g, ''));
    } catch {
      throw err;
    }
  }
  // CLI prints progress lines before JSON — grab the first JSON object
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
  if (!target) throw new Error('No staged target returned');

  const form = new FormData();
  for (const { name, value } of target.parameters) {
    form.append(name, value);
  }
  const bytes = readFileSync(localPath);
  form.append('file', new Blob([bytes], { type: mimeType }), filename);

  const uploadRes = await fetch(target.url, { method: 'POST', body: form });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Upload failed ${uploadRes.status}: ${text}`);
  }

  const fileResult = gql(
    `mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          ... on MediaImage {
            id
            status
            image { url }
          }
          ... on GenericFile {
            id
            url
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
          alt: filename.replace(/\.webp$/, '').replace(/tamarinse-photo-/, '').replace(/-/g, ' '),
        },
      ],
    },
    { mutate: true }
  );

  const fileErrors = fileResult.fileCreate?.userErrors || [];
  if (fileErrors.length) throw new Error(`fileCreate: ${JSON.stringify(fileErrors)}`);

  // Image processing can lag — poll for URL
  let imageUrl = fileResult.fileCreate.files?.[0]?.image?.url || fileResult.fileCreate.files?.[0]?.url;
  const fileId = fileResult.fileCreate.files?.[0]?.id;

  for (let i = 0; i < 12 && !imageUrl && fileId; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = gql(
      `query ($id: ID!) {
        node(id: $id) {
          ... on MediaImage {
            status
            image { url }
          }
        }
      }`,
      { id: fileId }
    );
    imageUrl = poll.node?.image?.url;
    if (imageUrl) break;
  }

  if (!imageUrl) {
    // Fall back to staged resource URL — articleCreate can ingest it
    imageUrl = target.resourceUrl;
  }

  return imageUrl;
}

const ARTICLES = [
  {
    handle: 'everyday-sources-of-microplastics',
    title: 'Everyday Sources of Microplastics',
    tags: ['Microplastics', 'Daily Exposure'],
    image: 'assets/tamarinse-photo-bottled-water.webp',
    alt: 'Plastic water bottles on a kitchen counter',
    summary:
      '<p>From bottled water to takeout lids, microplastics show up in routines that feel ordinary. Here is where exposure often starts.</p>',
    body: `
<p>Microplastics are tiny plastic particles that can enter food, water, and air through everyday products. You do not need a laboratory to meet them — many of the most common sources are already in the kitchen, the commute, and the coffee run.</p>
<p>Research continues to map how widespread these particles are. One frequently cited study found plastic particles in the blood of nearly 8 in 10 people tested (Leslie et al., <em>Environment International</em>, 2022). Another reported that a single liter of bottled water can contain around 240,000 plastic particles (Qian et al., <em>Proceedings of the National Academy of Sciences</em>, 2024).</p>
<h2>Common daily touchpoints</h2>
<ul>
<li><strong>Bottled water and single-use drinks</strong> — plastic bottles and lids are a well-studied exposure route.</li>
<li><strong>Hot drinks through plastic-lined lids</strong> — heat can help particles migrate into beverages.</li>
<li><strong>Takeout and delivery packaging</strong> — hot food in contact with plastic containers is a frequent exposure pattern.</li>
<li><strong>Food storage and reheating</strong> — plastic containers, cling film, and microwaving in original packaging all add up.</li>
<li><strong>Kitchen tools</strong> — plastic cutting boards, utensils, and some non-stick cookware can shed particles during normal use.</li>
</ul>
<p>None of this means every meal is a crisis. It does mean environmental exposure is part of modern life — which is why more people are looking at both habits and daily defense.</p>
<p><em>Educational only. Not medical advice. Individual products and routines vary.</em></p>
`.trim(),
  },
  {
    handle: 'why-researchers-are-studying-tamarind',
    title: 'Why Researchers Are Studying Tamarind',
    tags: ['Tamarind', 'Research', 'Ingredients'],
    image: 'assets/tamarinse-photo-containers.webp',
    alt: 'Plant-based ingredients and kitchen materials',
    summary:
      '<p>Tamarind seed extract contains natural polysaccharides being studied for how they interact with particles in digestive environments.</p>',
    body: `
<p>Tamarind is more than a pantry flavor. The seed contains natural polysaccharides that researchers have been examining for their ability to interact with particles in aqueous and digestive environments — which is why tamarind sits at the center of the Tamarinse™ formula.</p>
<p>Published work from institutions including the American Chemical Society’s <em>ACS Omega</em> journal has explored plant polymers from tamarind, okra, and fenugreek in the context of removing microplastics from water. That research is ongoing, and findings in laboratory or water-treatment settings are not the same as clinical outcomes in people.</p>
<h2>How this connects to a daily supplement</h2>
<p>Tamarinse™ is built around tamarind seed extract and pairs it with other plant-based ingredients designed to support the body’s natural detoxification pathways and digestive elimination. The formula is physician formulated, with clinically studied ingredients, and is designed for everyday environmental exposure — not a one-time cleanse.</p>
<p>If you want the ingredient-by-ingredient rationale, the research organizations behind each selection are listed on the Tamarinse product page under ingredient science.</p>
<p><em>Educational only. Supplements are not intended to diagnose, treat, cure, or prevent any disease.</em></p>
`.trim(),
  },
  {
    handle: 'small-swaps-that-reduce-plastic-contact',
    title: 'Small Swaps That Reduce Plastic Contact',
    tags: ['Habits', 'Daily Exposure', 'Kitchen'],
    image: 'assets/tamarinse-photo-coffee.webp',
    alt: 'Morning coffee in a reusable cup',
    summary:
      '<p>You cannot eliminate every exposure, but a few kitchen and commute swaps can meaningfully change how often plastic meets heat and food.</p>',
    body: `
<p>Reducing plastic contact is less about perfection and more about repetition. The highest-leverage changes are usually the ones you make every day: how you drink, store, and reheat.</p>
<h2>High-impact habits</h2>
<ul>
<li><strong>Prefer glass or steel for drinks</strong> — especially for water you carry all day.</li>
<li><strong>Transfer takeout before reheating</strong> — move hot food into glass or ceramic instead of microwaving in plastic.</li>
<li><strong>Store leftovers in glass</strong> — fewer plastic containers and less cling film against warm food.</li>
<li><strong>Skip plastic lids when you can</strong> — or use a reusable cup for hot coffee and tea.</li>
<li><strong>Watch the microwave</strong> — avoid heating food in original plastic packaging whenever possible.</li>
</ul>
<p>These steps do not replace a broader look at environmental exposure, but they reduce some of the most frequent contact points. Many people pair habit changes with a daily routine designed for ongoing environmental defense.</p>
<p><em>Educational only. Not medical advice.</em></p>
`.trim(),
  },
  {
    handle: 'why-tamarinse-ships-in-glass',
    title: 'Why Tamarinse Ships in Glass',
    tags: ['Packaging', 'Brand', 'Quality'],
    image: 'assets/tamarinse-photo-takeout.webp',
    alt: 'Everyday packaging and food containers',
    summary:
      '<p>Putting a microplastic-defense supplement in a plastic bottle would miss the point. Here is why glass is part of the product story.</p>',
    body: `
<p>Packaging is part of the product. If the goal is daily defense against modern environmental exposure, the bottle should not quietly reintroduce the same material problem on the shelf.</p>
<p>That is why Tamarinse™ ships in glass. Glass is better aligned with the brand’s purpose, better for long-term storage of the capsules, and a clearer signal of what the formula stands for: thoughtful ingredients, transparent labeling, and fewer unnecessary plastics in the ritual.</p>
<h2>What else sits behind the bottle</h2>
<ul>
<li>Physician formulated</li>
<li>USDA Organic ingredients</li>
<li>Clinically studied ingredients</li>
<li>Manufactured in the USA</li>
<li>Third-party tested when available</li>
</ul>
<p>Two capsules daily with water — preferably with a meal — is the suggested use. Consistency matters more than intensity; Tamarinse is designed for daily long-term use, not a short cleanse cycle.</p>
<p><em>Educational only. See the product label for full directions and advisories.</em></p>
`.trim(),
  },
];

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
  console.log('Uploading images and creating articles…');
  const created = [];

  for (const article of ARTICLES) {
    const localPath = join(ROOT, article.image);
    console.log(`\n→ ${article.title}`);
    console.log(`  uploading ${article.image}`);
    const imageUrl = await uploadImage(localPath);
    console.log(`  image: ${imageUrl}`);
    const post = await createArticle(article, imageUrl);
    console.log(`  created: ${post.handle} (${post.id})`);
    created.push(post);
  }

  console.log('\nDone. Articles:');
  for (const post of created) {
    console.log(`- ${post.title}: /blogs/news/${post.handle}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
