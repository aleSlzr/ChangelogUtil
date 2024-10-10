const fs = require("fs-extra");
const path = require("path");
const marked = require("marked");
const { prompt } = require("prompts");
const { Transform } = require("stream");

const ROOT_PATH = path.dirname(__dirname);

async function getChangelog() {
  const markdown = await fs.readFile("./CHANGELOG.md", "utf8");
  const tokens = marked.lexer(markdown);
  console.log(tokens[0]);
}

getChangelog();
