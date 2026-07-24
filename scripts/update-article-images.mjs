#!/usr/bin/env node
/**
 * Point each Articles post at a matching tamarinse-stories poster asset.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = 'hnmtjh-0i.myshopify.com';
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Stories section poster → article pairing */
const UPDATES = [
  {
    id: 'gid://shopify/Article/1004934005108',
    handle: 'everyday-sources-of-microplastics',
    image: 'assets/tamarinse-photo-bottled-water.webp',
    alt: 'Bottled water — a common everyday microplastic exposure source',
  },
  {
    id: 'gid://shopify/Article/1004934037876',
    handle: 'why-researchers-are-studying-tamarind',
    image: 'assets/tamarinse-story-lab.webp',
    alt: 'Botanical research lab studying plant polymers',
  },
  {
    id: 'gid://shopify/Article/1004934070644',
    handle: 'small-swaps-that-reduce-plastic-contact',
    image: 'assets/tamarinse-photo-coffee.webp',
    alt: 'Morning coffee ritual — a place for plastic-free swaps',
  },
  {
    id: 'gid://shopify/Article/1004934103412',
    handle: 'why-tamarinse-ships-in-glass',
    image: 'assets/tamarinse-story-member1.webp',
    alt: 'Member holding Tamarinse in an amber glass bottle',
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

async function main() {
  for (const update of UPDATES) {
    console.log(`\n→ ${update.handle}`);
    const imageUrl = await uploadImage(join(ROOT, update.image));
    console.log(`  ${update.image} → ${imageUrl}`);

    const result = gql(
      `mutation articleUpdate($id: ID!, $article: ArticleUpdateInput!) {
        articleUpdate(id: $id, article: $article) {
          article { id handle image { url altText } }
          userErrors { field message }
        }
      }`,
      {
        id: update.id,
        article: {
          image: {
            url: imageUrl,
            altText: update.alt,
          },
        },
      },
      { mutate: true }
    );

    const errors = result.articleUpdate?.userErrors || [];
    if (errors.length) throw new Error(JSON.stringify(errors));
    console.log(`  updated: ${result.articleUpdate.article.image?.url}`);
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
