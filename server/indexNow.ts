/**
 * IndexNow Integration
 *
 * IndexNow is a protocol that allows websites to instantly notify
 * participating search engines (Bing, Yandex, Seznam, Naver) about
 * new or updated content. Since ChatGPT search uses Bing's index,
 * this also helps with ChatGPT discoverability.
 *
 * Usage: Import and call submitToIndexNow() after content updates,
 * or use the admin API endpoint to trigger manually.
 */

const INDEXNOW_KEY = "5425278fc9ee461db205ab9468d6e56c";
const SITE_HOST = "stsdashboard.com";
const KEY_LOCATION = `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`;

// All public pages that should be indexed
const PUBLIC_URLS = [
  `https://${SITE_HOST}/`,
  `https://${SITE_HOST}/pricing`,
  `https://${SITE_HOST}/overview`,
  `https://${SITE_HOST}/compare`,
  `https://${SITE_HOST}/my-dashboard`,
  `https://${SITE_HOST}/terms`,
  `https://${SITE_HOST}/privacy`,
];

interface IndexNowResponse {
  engine: string;
  status: number;
  success: boolean;
  message: string;
}

/**
 * Submit URLs to a specific IndexNow endpoint
 */
async function submitToEngine(
  engineUrl: string,
  engineName: string,
  urls: string[]
): Promise<IndexNowResponse> {
  try {
    const payload = {
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList: urls,
    };

    const response = await fetch(engineUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    return {
      engine: engineName,
      status: response.status,
      success: response.status >= 200 && response.status < 300,
      message:
        response.status === 200
          ? "URLs submitted successfully"
          : response.status === 202
            ? "URLs accepted for processing"
            : `Response: ${response.statusText}`,
    };
  } catch (error) {
    return {
      engine: engineName,
      status: 0,
      success: false,
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Submit all public URLs to all IndexNow-participating search engines
 */
export async function submitToIndexNow(
  urls?: string[]
): Promise<IndexNowResponse[]> {
  const urlsToSubmit = urls || PUBLIC_URLS;

  console.log(
    `[IndexNow] Submitting ${urlsToSubmit.length} URLs to search engines...`
  );

  const engines = [
    { url: "https://api.indexnow.org/indexnow", name: "IndexNow (Bing)" },
    { url: "https://yandex.com/indexnow", name: "Yandex" },
    { url: "https://searchadvisor.naver.com/indexnow", name: "Naver" },
  ];

  const results = await Promise.all(
    engines.map(engine => submitToEngine(engine.url, engine.name, urlsToSubmit))
  );

  results.forEach(result => {
    console.log(
      `[IndexNow] ${result.engine}: ${result.success ? "✓" : "✗"} (${result.status}) ${result.message}`
    );
  });

  return results;
}

/**
 * Get the IndexNow key for verification
 */
export function getIndexNowKey(): string {
  return INDEXNOW_KEY;
}

/**
 * Get the list of public URLs
 */
export function getPublicUrls(): string[] {
  return PUBLIC_URLS;
}
