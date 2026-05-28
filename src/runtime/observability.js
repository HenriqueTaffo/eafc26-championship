import App from "../../js/app.js";

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: App.config?.assetVersion || "local",
      tracesSampleRate: Number(
        import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0,
      ),
      beforeSend(event) {
        const scrub = (value) =>
          String(value || "")
            .replace(
              /accessCode["':=\s]+[0-9a-zA-Z-]+/gi,
              "accessCode=[redacted]",
            )
            .replace(/PIN["':=\s]+\d+/gi, "PIN=[redacted]");

        if (event.message) event.message = scrub(event.message);
        if (event.request?.url) event.request.url = scrub(event.request.url);
        if (event.exception?.values) {
          event.exception.values = event.exception.values.map((item) => ({
            ...item,
            value: scrub(item.value),
          }));
        }
        return event;
      },
    });

    Sentry.setTag("app", "eafc26-championship");
  });
}
