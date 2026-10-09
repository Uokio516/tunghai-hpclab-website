import React from "react";
import { useLocale } from "../../lib/locale";

function WebGLFallback() {
  const { t } = useLocale();
  return <div className="webgl-fallback" role="status"><span>2D MODE</span><strong>{t("互動運算網路", "Interactive computing network")}</strong><p>{t("此裝置目前無法啟動 WebGL，研究內容仍可完整瀏覽。", "WebGL is unavailable on this device. You can still browse all research content.")}</p></div>;
}

/* If the WebGL scene throws (no GPU, context creation failure, driver
   quirk), the page must still render its content rather than going dark.
   Renders nothing in place of the scene — the hero text sits above it and
   is readable on the plain background. */
export class WebGLBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <WebGLFallback />;
    return this.props.children;
  }
}
