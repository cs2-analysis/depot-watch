try { require('dotenv/config'); } catch (error) {}
const SteamUser = require("steam-user");
const fs = require('fs');
const axios = require('axios');

const APP_ID = 730;
const DEPOT_IDS = {'2347771': 'windows', '2347773': 'linux'}
const BRANCH = 'public';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || 'cs2-analysis/cs2-analysis';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'master';
const GITHUB_WORKFLOW = process.env.GITHUB_WORKFLOW || 'update.yml';
const VERSION_FILE = process.env.VERSION_FILE || 'version.json';

if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}

const versions = JSON.parse(fs.readFileSync(VERSION_FILE));
Object.keys(DEPOT_IDS).forEach(depotId => {
  const manifest = versions[depotId];
  if (manifest == null || isNaN(manifest)) {
    console.error(`Manifest for depot ${depotId} not found in ${VERSION_FILE}`);
    process.exit(1);
  }
});

function mapAppInfo(appinfo) {
  return Object.entries(appinfo.depots)
    .filter(([depotId, depot]) => Number(depotId) && depot.manifests)
    .flatMap(([depotId, depot]) => {
      return Object.entries(depot.manifests).map(([branch, manifest]) => [branch, depotId, manifest.gid]);
    }).reduce((acc, [branch, depotId, gid]) => {
      acc[branch] ??= {};
      acc[branch][depotId] = gid;
      return acc;
    }, {});
}

const client = new SteamUser({
  picsCacheAll: true,
  enablePicsCache: true,
  changelistUpdateInterval: 10000,
});

client.on('appUpdate', (appId, data) => {
  if (!data.appinfo.depots) {
    return;
  }

  onAppUpdate(appId, mapAppInfo(data.appinfo)).catch(error => {
    console.error(error);
    process.exit(2);
  });
});

client.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

let initPromiseResolve;
const initPromise = new Promise(resolve => initPromiseResolve = resolve);

client.on('loggedOn', async () => {
  try {
    console.log('Logged into Steam');
    const res = await client.getProductInfo([APP_ID], [], true);

    const data = mapAppInfo(res.apps[APP_ID].appinfo)[BRANCH];

    Object.entries(versions).forEach(([depotId, manifest]) => {
      if (data[depotId] !== manifest) {
        console.error(`Manifest for depot ${depotId} changed while offline (expected: ${manifest}, found: ${data[depotId]})`);
        process.exit(2);
      }
    });

    console.log('Manifests match, starting...');
    initPromiseResolve();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})

client.logOn({anonymous: true});

async function onAppUpdate(appId, depots) {
  if (appId != APP_ID) {
    return;
  }
  console.log(`App ${appId} updated`);
  console.dir(depots, {depth: null});

  await initPromise;

  const data = depots[BRANCH];
  if (!data) {
    console.warn(`No data for branch ${BRANCH}`);
    return;
  }

  for (const [depotId, manifest] of Object.entries(data)) {
    const oldManifest = versions[depotId];
    if (oldManifest == null || oldManifest === manifest) {
      continue;
    }

    console.log(`Depot ${depotId} updated (old: ${oldManifest}, new: ${manifest})`, versions);
    await onDepotUpdate(appId, depotId, manifest);
    
    versions[depotId] = manifest;
    fs.writeFileSync(VERSION_FILE, JSON.stringify(versions, null, 2));
  }
}

async function onDepotUpdate(appId, depotId, manifestId) {
  const res = await axios.request({
    method: 'POST',
    url: `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      "User-Agent": 'curl/8.11.0', // probably placebo, but I think we look more legit this way :)
    },
    data: {
      ref: GITHUB_BRANCH,
      inputs: {
        depotId: depotId,
        manifestId: manifestId,
        gitBranch: DEPOT_IDS[depotId],
      },
    },
  });
  console.log(`Dispatched workflow for depot ${depotId} with manifest ${manifestId} (status: ${res.status})`);
}