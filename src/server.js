const { config, assertConfig } = require("./config");
assertConfig();
const app = require("./app");

app.listen(config.port, () => {
  console.log(`payu_sub_v2 test UI  -> http://localhost:${config.port}`);
  console.log(`backend under test   -> ${config.backendBaseUrl}`);
});
