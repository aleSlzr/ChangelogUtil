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
  const { issueType, logEntry } = generateItemChangelogEntry(answers);
  // use this -> path.join(ROOT_PATH, "./CHANGELOG.md") because CHANGELOG.md file
  // is in the root of the main project
  // for testing purposes this is included here, also it can help to create a
  // CHANGELOG.md file for the main project
  const changelogReadStream = fs.createReadStream(
    "./CHANGELOG.md",
    SpecialItems.ENCODING
  );
  const changelogWriteStream = fs.createWriteStream("./CHANGELOG_temp.md", {
    flags: SpecialItems.WRITE_FLAG,
    encoding: SpecialItems.ENCODING,
  });

  const addEntryChangelogStream = tranformChangelogEntry(issueType, logEntry);

  changelogReadStream.on("error", (error) => {
    console.log("ErrorReadingFile: " + error);
  });

  changelogReadStream
    .pipe(addEntryChangelogStream)
    .pipe(changelogWriteStream)
    .on("finish", () => {
      console.log("Data emitted and writted");
      deleteAndRenameChangelog();
    });
}

function deleteAndRenameChangelog() {
  fs.unlink("./CHANGELOG.md", (error) => {
    if (error) {
      console.log("Error deleting file: " + error);
    }
  });
  fs.rename("./CHANGELOG_temp.md", "./CHANGELOG.md", (error) => {
    if (error) {
      console.log("Error renaming file: " + error);
    }
  });
}

function tranformChangelogEntry(issueType, logEntry) {
  return new Transform({
    transform(data, encoding, callback) {
      let unpublishedFlag = true;
      let issue = issueType.split(SpecialItems.SIMPLE_DASH)[0];
      let changelogArray = data.toString().split(SpecialItems.DOUBLE_HASH);

      for (let item in changelogArray) {
        let changelogItem = changelogArray[item];
        let isIssueIncluded = changelogItem.toLowerCase().includes(issue);
        let startsEmptySpace = changelogItem.startsWith(
          SpecialItems.EMPTY_SPACE
        );
        let startWithHashMark = changelogItem.startsWith(
          SpecialItems.SPACE_HASH
        );

        ({ unpublishedFlag, changelogItem } = insertEntryInUnpublishedSection(
          isIssueIncluded,
          unpublishedFlag,
          changelogItem,
          logEntry
        ));

        changelogItem = addDoubleDashInItems(
          startsEmptySpace,
          startWithHashMark,
          changelogItem
        );
        changelogItem = removeExtraDashInHeaderTitle(changelogItem);
        this.push(changelogItem);
      }
      callback();
    },
  });
}

function insertEntryInUnpublishedSection(
  isIssueIncluded,
  unpublishedFlag,
  changelogItem,
  logEntry
) {
  if (isIssueIncluded && unpublishedFlag) {
    changelogItem = changelogItem + logEntry;
    unpublishedFlag = false;
  }
  return { unpublishedFlag, changelogItem };
}

function addDoubleDashInItems(
  startsEmptySpace,
  startWithHashMark,
  changelogItem
) {
  if (startsEmptySpace || startWithHashMark) {
    changelogItem = `${SpecialItems.DOUBLE_HASH}${changelogItem}`;
  }
  return changelogItem;
}

function removeExtraDashInHeaderTitle(changelogItem) {
  if (changelogItem.includes("Changelog")) {
    changelogItem = changelogItem.slice(-Math.abs(changelogItem.length) + 2);
  }
  return changelogItem;
}

function generateItemChangelogEntry(answers) {
  const message = answers[PromptName.CHANGELOG_MESSAGE];
  const issue = answers[PromptName.TICKET];
  const pullRequest = answers[PromptName.PULL_REQUEST];
  const issueType = answers[PromptName.ISSUE_TYPE];
  const logEntry = `- ${message} ([${issue}](https://url.to.jira.or.something/${issue}), [#${pullRequest}](https://github.com/repository/pull/${pullRequest}) by [@aleSlzr](https://github.com/aleSlzr)).${EOL}${EOL}`;
  return { issueType, logEntry };
}
