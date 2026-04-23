const { withAndroidManifest } = require("@expo/config-plugins");

function mergeToolsReplace(existing, value) {
  const entries = new Set(
    String(existing || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  entries.add(value);
  return Array.from(entries).join(",");
}

module.exports = function withAndroidCleartext(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = {
      ...manifest.$,
      "xmlns:tools": manifest.$?.["xmlns:tools"] || "http://schemas.android.com/tools",
    };

    const application = manifest.application?.[0];
    if (application?.$) {
      application.$["android:usesCleartextTraffic"] = "true";
      application.$["tools:replace"] = mergeToolsReplace(
        application.$["tools:replace"],
        "android:usesCleartextTraffic",
      );
    }

    return config;
  });
};
