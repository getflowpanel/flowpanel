const getReleaseLine = async (changeset) =>
  changeset.summary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
    .join("\n");

const getDependencyReleaseLine = async () => "";

module.exports = { getReleaseLine, getDependencyReleaseLine };
