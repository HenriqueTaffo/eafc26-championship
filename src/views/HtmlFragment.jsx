import { useEffect, useRef } from "react";
import App from "../../js/app.js";

function HtmlFragment({ html, as = "div", onRendered, ...props }) {
  const ref = useRef(null);
  const Component = as;

  useEffect(() => {
    App.dom.setHtml(ref.current, html || "");
    onRendered?.(ref.current);
  }, [html, onRendered]);

  return <Component ref={ref} {...props}></Component>;
}

export { HtmlFragment };
