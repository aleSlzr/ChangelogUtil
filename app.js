const fs = require("fs");
const path = require("path");
const marked = require("marked");
const { prompt } = require("prompts");
const { Transform } = require("stream");

let questions;
const EOL = "\n";
const ROOT_PATH = path.dirname(__dirname);
const UNPUBLISHED_CHANGES = "Unpublished";
const IssueType = {
  // Upgrading vendored libs.
  LIBRARY_UPGRADES: "📚 3rd party library updates",
  // Changes in the API that may require users to change their code.
  BREAKING_CHANGES: "☢️ Breaking changes",
  // New features and non-breaking changes in the API.
  NEW_FEATURES: "🔬 New features",
  // Bug fixes and inconsistencies with the documentation.
  BUG_FIXES: "🐞 Bug fixes",
  // Changes that users should be aware of as they cause behavior changes in corner cases.
  NOTICES: "⚠️ Notices",
  // Anything that doesn't apply to other types.
  OTHERS: "💡 Others",
};
const PromptName = {
  TICKET: "issue-ticket",
  PULL_REQUEST: "issue-pull-request",
  CHANGELOG_MESSAGE: "issue-changelog-message",
  ISSUE_TYPE: "issue-type",
};
const SpecialItems = {
  SINGLE_HASH: "#",
  DOUBLE_HASH: "##",
  SPACE_HASH: "# ",
  EMPTY_SPACE: " ",
  ENCODING: "utf8",
  WRITE_FLAG: "w",
  SIMPLE_DASH: "-",
};

(async function () {
  const issue_log = [
    {
      type: "text",
      name: PromptName.TICKET,
      message: "What is the issue ticket?",
      style: "default",
      initial: `ABC-1234`,
    },
    {
      type: "text",
      name: PromptName.PULL_REQUEST,
      message: "What is the pull request?",
      style: "default",
      initial: `github.com/project/pull/`,
    },
    {
      type: "text",
      name: PromptName.CHANGELOG_MESSAGE,
      message: "What is the changelog message?",
      style: "default",
      onRender(kleur) {
        this.msg = `What is the changelog message? (${kleur
          .yellow()
          .bold()
          .underline(50 - this.value.length)}/50)`;
      },
      validate: (input) =>
        input.length > 50 ? `Sorry changelog message should be shorter` : true,
    },
    {
      type: "select",
      name: PromptName.ISSUE_TYPE,
      message: "What is the type?",
      choices: [
        { title: "Bug-Fix 🐞", value: "bug-fix" },
        { title: "New-Feature 🔬", value: "new-feature" },
        { title: "Breaking-Change ☢️", value: "breaking-change" },
        { title: "Library-Update 📚", value: "library-update" },
        { title: "Other 💡", value: "other" },
      ],
      initial: 0,
      hint: "(Use arrow keys)",
    },
  ];

  const answers = await prompt(issue_log, {
    onCancel: cleanup,
    onSubmit: cleanup,
  });
  createChangelogEntry(answers);
})();

function cleanup() {
  clearInterval(questions);
}

function createChangelogEntry(answers) {
  const message = answers[PromptName.CHANGELOG_MESSAGE];
  const issue = answers[PromptName.TICKET];
  const pullRequest = answers[PromptName.PULL_REQUEST];
  const issueType = answers[PromptName.ISSUE_TYPE];
  const logEntry = `- ${message} ([${issue}](https://url.to.jira.or.something/${issue}), [#${pullRequest}](https://github.com/repository/pull/${pullRequest}) by [@aleSlzr](https://github.com/aleSlzr)).${EOL}${EOL}`;
  var unpublishedFlag = true;

  // use this -> path.join(ROOT_PATH, "./CHANGELOG.md") because CHANGELOG.md file
  // is in the root of the main project
  const changelogReadStream = fs.createReadStream(
    "./CHANGELOG.md",
    SpecialItems.ENCODING
  );
  const changelogWriteStream = fs.createWriteStream("./CHANGELOG_temp.md", {
    flags: SpecialItems.WRITE_FLAG,
    encoding: SpecialItems.ENCODING,
  });

  const addEntryChangelog = new Transform({
    transform(data, encoding, callback) {
      let changelogArray = data.toString().split(SpecialItems.DOUBLE_HASH);
      let issue = issueType.split(SpecialItems.SIMPLE_DASH)[0];
      for (let item in changelogArray) {
        let changelogItem = changelogArray[item];
        let isIssueIncluded = changelogItem.toLowerCase().includes(issue);
        if (isIssueIncluded && unpublishedFlag) {
          changelogItem = changelogItem + logEntry;
          unpublishedFlag = false;
        }
        let startsEmptySpace = changelogArray[item].startsWith(
          SpecialItems.EMPTY_SPACE
        );
        let startWithHashMark = changelogArray[item].startsWith(
          SpecialItems.SPACE_HASH
        );
        if (startsEmptySpace || startWithHashMark) {
          changelogItem = `${SpecialItems.DOUBLE_HASH}${changelogItem}`;
        }
        if (changelogItem.includes("Changelog")) {
          changelogItem = changelogItem.slice(
            -Math.abs(changelogItem.length) + 2
          );
        }
        this.push(changelogItem);
      }
      callback();
    },
  });

  changelogReadStream
    .pipe(addEntryChangelog)
    .pipe(changelogWriteStream)
    .on("finish", () => {
      console.log("Data emitted and writed");
    });

  changelogReadStream.on("error", (error) => {
    console.log("Error" + error);
  });

  changelogReadStream.on("close", () => {
    console.log("File closed");
  });
}
