// The connection, seeded before the chat app's first line runs. It is a blocking classic script, not a
// module, because the app's entry runs while a module is still being fetched: a visitor whose entry
// arrived first would be sent to the settings screen to add the connection this file already has.
// Ours, not the app's. `../` from here is the shell root, whatever subpath the site is published under.
(function () {
  var SERVERS = "hollama-servers";
  try {
    var stored = JSON.parse(localStorage.getItem(SERVERS) || "null");
    if (Array.isArray(stored) && stored.length) return;
    var shell = new URL("../", document.currentScript.src);
    localStorage.setItem(SERVERS, JSON.stringify([{
      id: "hologram",
      baseUrl: new URL("v1", shell).href,
      connectionType: "openai-compatible",
      isVerified: new Date().toISOString(),
      isEnabled: true,
      label: "Hologram",
      // The models this page answers from itself. The paid ones the endpoint also lists need a key,
      // which is given on the homepage, not here; a visitor can clear this filter in the settings.
      modelFilter: "webgpu:",
    }]));
  } catch (error) {}
})();
