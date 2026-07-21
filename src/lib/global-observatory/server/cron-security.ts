export function isAuthorizedCronRequest(request: Request, expectedSecret?: string) {
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(request.url).searchParams.get("secret");
  return Boolean(expectedSecret && provided && provided === expectedSecret);
}
