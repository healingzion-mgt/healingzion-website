export async function onRequest(context) {
  const response = await context.next();

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  class BodyInjector {
    element(element) {
      element.append('<div style="background:red;color:white;padding:20px;font-size:20px;">MIDDLEWARE TEST — IF YOU SEE THIS, IT WORKS</div>', { html: true });
    }
  }

  return new HTMLRewriter()
    .on("body", new BodyInjector())
    .transform(response);
}
