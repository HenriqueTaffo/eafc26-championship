import { useEffect, useRef } from "react";
import App from "../../js/app.js";

function HtmlFragment({ html, as = "div", onRendered, ...props }) {
  const ref = useRef(null);
  const onRenderedRef = useRef(onRendered);
  const Component = as;

  useEffect(() => {
    onRenderedRef.current = onRendered;
  }, [onRendered]);

  useEffect(() => {
    App.dom.setHtml(ref.current, html || "");
    onRenderedRef.current?.(ref.current);
  }, [html]);

  return <Component ref={ref} {...props}></Component>;
}

export { HtmlFragment };
