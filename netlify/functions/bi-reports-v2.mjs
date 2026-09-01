import { getStore } from "@netlify/blobs";
import reportsModule from "./bi-reports.js";

const STORE_NAME = "datareports-bi";

const handler = reportsModule.createHandler({
  getReportsStore: () => getStore({
    name: STORE_NAME,
    consistency: "strong",
  }),
});

function toLegacyEvent(request) {
  const url = new URL(request.url);

  return request.text().then((body) => ({
    httpMethod: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body,
    rawUrl: request.url,
  }));
}

export default async function biReports(request) {
  const event = await toLegacyEvent(request);
  const response = await handler(event);

  return new Response(response.body || "", {
    status: response.statusCode || 200,
    headers: response.headers || {},
  });
}
