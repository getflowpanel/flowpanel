const getReleaseLine = async (changeset) =>
  changeset.summary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("#")) return `\n${line}\n`;
      return line.startsWith("- ") ? line : `- ${line}`;
    })
    .join("\n")
    .trim();

const getDependencyReleaseLine = async () => "";

module.exports = { getReleaseLine, getDependencyReleaseLine };
