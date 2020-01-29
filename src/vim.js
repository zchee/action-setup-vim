"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = require("os");
const path = __importStar(require("path"));
const fs_1 = require("fs");
const node_fetch_1 = __importDefault(require("node-fetch"));
const core = __importStar(require("@actions/core"));
const github_1 = require("@actions/github");
const io = __importStar(require("@actions/io"));
const shell_1 = require("./shell");
const utils_1 = require("./utils");
// Only available on macOS or Linux. Passing null to `version` means install HEAD
async function buildVim(version) {
    const installDir = path.join(os_1.homedir(), 'vim');
    core.debug(`Building and installing Vim to ${installDir} (version=${(version !== null && version !== void 0 ? version : 'HEAD')})`);
    const dir = path.join(await utils_1.makeTmpdir(), 'vim');
    const args = ['clone', '--depth=1', '--single-branch'];
    if (version === null) {
        args.push('--no-tags');
    }
    else {
        args.push('--branch', version);
    }
    args.push('https://github.com/vim/vim', dir);
    await shell_1.exec('git', args);
    const opts = { cwd: dir };
    await shell_1.exec('./configure', [`--prefix=${installDir}`, '--with-features=huge', '--enable-fail-if-missing'], opts);
    await shell_1.exec('make', ['-j'], opts);
    await shell_1.exec('make', ['install'], opts);
    core.debug(`Built and installed Vim to ${installDir} (version=${version})`);
    return installDir;
}
exports.buildVim = buildVim;
async function getVimRootDirAt(dir) {
    // Search root Vim directory such as 'vim82' in unarchived directory
    const entries = await fs_1.promises.readdir(dir);
    const re = /^vim\d+$/;
    for (const entry of entries) {
        if (!re.test(entry)) {
            continue;
        }
        const p = path.join(dir, entry);
        const s = await fs_1.promises.stat(p);
        if (!s.isDirectory()) {
            continue;
        }
        return p;
    }
    throw new Error(`Vim directory such as 'vim82' was not found in ${JSON.stringify(entries)} in unarchived directory '${dir}'`);
}
async function detectNightlyAssetUrl(token) {
    const client = new github_1.GitHub(token);
    const release = await client.repos.getLatestRelease({
        owner: 'vim',
        repo: 'vim-win32-installer',
    });
    const asset = release.data.assets.find(asset => asset.name.endsWith('_x64.zip'));
    if (!asset) {
        throw new Error(`Could not get installer asset in releases of vim/vim-win32-installer: ${JSON.stringify(release.data.assets, null, 2)}`);
    }
    core.debug(`Found installer asset: ${JSON.stringify(asset, null, 2)}`);
    return {
        file: asset.name,
        url: asset.browser_download_url,
    };
}
async function installVimAssetOnWindows(file, url) {
    const tmpdir = await utils_1.makeTmpdir();
    const dlDir = path.join(tmpdir, 'vim-installer');
    await io.mkdirP(dlDir);
    const assetFile = path.join(dlDir, file);
    try {
        core.debug(`Downloading asset at ${url} to ${dlDir}`);
        const response = await node_fetch_1.default(url);
        if (!response.ok) {
            throw new Error(`Downloading asset failed: ${response.statusText}`);
        }
        const buffer = await response.buffer();
        await fs_1.promises.writeFile(assetFile, buffer, { encoding: null });
        core.debug(`Downloaded installer from ${url} to ${assetFile}`);
        await shell_1.exec('unzip', [assetFile], { cwd: dlDir });
    }
    catch (err) {
        core.debug(err.stack);
        throw new Error(`Could not download and unarchive asset ${url} at ${dlDir}: ${err.message}`);
    }
    const unzippedDir = path.join(dlDir, 'vim'); // Unarchived to 'vim' directory
    const vimDir = await getVimRootDirAt(unzippedDir);
    core.debug(`Unzipped installer from ${url} and found Vim directory ${vimDir}`);
    const destDir = path.join(os_1.homedir(), 'vim');
    await io.mv(vimDir, destDir);
    core.debug(`Vim was installed to ${destDir}`);
    return destDir;
}
async function installNightlyVimOnWindows(token) {
    const { file, url } = await detectNightlyAssetUrl(token);
    return installVimAssetOnWindows(file, url);
}
exports.installNightlyVimOnWindows = installNightlyVimOnWindows;
async function installVimOnWindowsWithTag(tag) {
    const ver = tag.slice(1); // Strip 'v' prefix
    // e.g. https://github.com/vim/vim-win32-installer/releases/download/v8.2.0158/gvim_8.2.0158_x64.zip
    const url = `https://github.com/vim/vim-win32-installer/releases/download/${tag}/gvim_${ver}_x64.zip`;
    const file = `gvim_${ver}_x64.zip`;
    return installVimAssetOnWindows(file, url);
}
exports.installVimOnWindowsWithTag = installVimOnWindowsWithTag;
//# sourceMappingURL=vim.js.map