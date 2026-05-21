const fs = require('node:fs');

const reporterModule = require('playwright-bdd/reporter/cucumber');
const CucumberReporter = reporterModule.default || reporterModule;

class PatchedCucumberReporter extends CucumberReporter {
  constructor(options = {}) {
    super({ $type: 'html', ...options });
    this.testLineCache = new Map();
  }

  onTestEnd(test, result) {
    super.onTestEnd(this.patchTestLocation(test), result);
  }

  patchTestLocation(test) {
    const filePath = test?.location?.file;
    const title = test?.title;

    if (!filePath || !title) {
      return test;
    }

    const expectedLine = this.findScenarioLine(filePath, title);
    if (!expectedLine || expectedLine === test.location.line) {
      return test;
    }

    return {
      ...test,
      location: {
        ...test.location,
        line: expectedLine,
      },
    };
  }

  findScenarioLine(filePath, title) {
    if (!this.testLineCache.has(filePath)) {
      this.testLineCache.set(filePath, this.buildLineIndex(filePath));
    }

    const fileIndex = this.testLineCache.get(filePath);
    return fileIndex.get(title);
  }

  buildLineIndex(filePath) {
    const titleToLine = new Map();
    const source = fs.readFileSync(filePath, 'utf8');
    const lines = source.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index].match(/^\s*test\((['"`])(.+?)\1,/);
      if (match && !titleToLine.has(match[2])) {
        titleToLine.set(match[2], index + 1);
      }
    }

    return titleToLine;
  }
}

module.exports = PatchedCucumberReporter;
