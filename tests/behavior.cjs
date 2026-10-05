const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class TFile {
  constructor(filePath) {
    this.path = filePath;
    this.basename = path.basename(filePath, '.md');
    this.extension = 'md';
    this.parent = { path: path.dirname(filePath) === '.' ? '/' : path.dirname(filePath) };
    this.stat = { mtime: 1000 };
  }
}
class Plugin {
  constructor(app, manifest) { this.app = app; this.manifest = manifest; }
  async loadData() { return {}; }
  async saveData() {}
  registerView() {}
  addRibbonIcon() {}
  addCommand() {}
  addSettingTab() {}
  registerEvent() {}
}
const obsidian = { Plugin, TFile, ItemView: class {}, PluginSettingTab: class {},
  Setting: class {}, Modal: class {}, Notice: class {} };
const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const context = { module: { exports: {} }, require: name => {
  assert.equal(name, 'obsidian'); return obsidian;
}, setTimeout, clearTimeout, console };
vm.runInNewContext(source + '\nmodule.exports.buildModelForCheck = buildModel;', context);
const Omega = context.module.exports;

async function main() {
  const home = new TFile('Home MOC.md');
  const kitchen = new TFile('Kitchen MOC.md');
  const citrus = new TFile('Citrus polvorones idea.md');
  const inbox = new TFile('Omega Inbox/Orange zest.md');
  const files = [home, kitchen, citrus, inbox];
  const byPath = new Map(files.map(file => [file.path, file]));
  const byName = new Map(files.map(file => [file.basename, file]));
  const contents = new Map();
  let inboxFolderExists = false;
  const frontmatter = {
    [home.path]: { type: 'moc' },
    [kitchen.path]: { type: 'moc' },
    [citrus.path]: {},
    [inbox.path]: {},
  };
  const app = {
    vault: {
      configDir: '.obsidian', on: () => ({}),
      getMarkdownFiles: () => files,
      getAbstractFileByPath: filePath => filePath === 'Omega Inbox'
        ? (inboxFolderExists ? { path: filePath } : null)
        : byPath.get(filePath) || null,
      cachedRead: async file => file === kitchen ? '↑ [[Home MOC]]' : '',
      createFolder: async folder => { assert.equal(folder, 'Omega Inbox'); inboxFolderExists = true; },
      create: async (filePath, content) => {
        const file = new TFile(filePath);
        files.push(file);
        byPath.set(filePath, file);
        byName.set(file.basename, file);
        frontmatter[filePath] = {};
        contents.set(filePath, content);
        return file;
      },
    },
    metadataCache: {
      getFileCache: file => ({ frontmatter: frontmatter[file.path], links: [] }),
      getFirstLinkpathDest: link => byPath.get(`${link}.md`) || byName.get(link) || null,
      resolvedLinks: {},
    },
    fileManager: {
      processFrontMatter: async (file, update) => { update(frontmatter[file.path]); file.stat.mtime++; },
    },
    workspace: { getLeavesOfType: () => [] },
  };
  const settings = { groupBy: 'moc', excludeFolders: '' };
  const groupOf = async file => {
    const model = await Omega.buildModelForCheck(app, settings);
    return model.nodes.find(node => node.file.path === file.path).group;
  };

  assert.equal(await groupOf(citrus), 'Unfiled');
  const plugin = new Omega(app, { id: 'omega-centaur' });
  await plugin.onload();
  assert.equal(plugin.unplacedInboxNotes().length, 1);
  assert.equal(plugin.mocWithName('Kitchen MOC'), kitchen);

  await plugin.attachNoteToMoc(citrus.path, kitchen.path);
  assert.equal(frontmatter[citrus.path].moc, '[[Kitchen MOC]]');
  assert.equal(await groupOf(citrus), 'Kitchen MOC');
  await plugin.undoPlacement();
  assert.equal(frontmatter[citrus.path].moc, undefined);
  assert.equal(await groupOf(citrus), 'Unfiled');

  await plugin.attachNoteToMoc(inbox.path, kitchen.path);
  assert.equal(plugin.unplacedInboxNotes().length, 0);
  assert.equal(await groupOf(inbox), 'Kitchen MOC');
  await assert.rejects(() => plugin.attachNoteToMoc(citrus.path, citrus.path), /MOC/);

  const captured = await plugin.captureIdea('# Lemon zest comparison\nTest the recipe.');
  assert.equal(captured.path, 'Omega Inbox/Lemon zest comparison.md');
  assert.equal(contents.get(captured.path), '# Lemon zest comparison\nTest the recipe.\n');
  assert.equal(plugin.unplacedInboxNotes().length, 1);
  const duplicate = await plugin.captureIdea('# Lemon zest comparison\nTry again.');
  assert.equal(duplicate.path, 'Omega Inbox/Lemon zest comparison 2.md');

  console.log('Behavior QA passed: capture, unfiled, placement, undo, Inbox, and MOC validation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
