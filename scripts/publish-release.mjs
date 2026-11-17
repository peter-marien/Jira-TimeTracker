import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

function runGitHub(args) {
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

export function publishRelease(root = process.cwd(), run = runGitHub) {
    const { version, build } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const expand = (value, productName = build.productName) => value
        .replaceAll('${version}', version)
        .replaceAll('${productName}', productName)
        .replaceAll('${ext}', 'exe');
    const output = path.resolve(root, expand(build.directories.output));
    const installer = expand(build.win.artifactName);
    // Match electron-builder's GitHub-safe names referenced by latest.yml.
    const uploadedInstaller = expand(build.win.artifactName, build.productName.replaceAll(' ', '-'));
    const files = [
        { local: installer, name: uploadedInstaller },
        { local: `${installer}.blockmap`, name: `${uploadedInstaller}.blockmap` },
        { local: 'latest.yml', name: 'latest.yml' },
    ];

    // Validate every file before creating a release or uploading anything.
    for (const file of files) {
        const source = path.join(output, file.local);
        let stats;
        try {
            stats = statSync(source);
        } catch (error) {
            throw new Error(`Required release file is missing: ${source}`, { cause: error });
        }
        if (!stats.isFile() || stats.size === 0) {
            throw new Error(`Required release file is empty or not a file: ${source}`);
        }
        file.size = stats.size;
    }

    const staging = path.join(output, 'github-upload');
    mkdirSync(staging, { recursive: true });
    for (const file of files) {
        file.upload = path.join(staging, file.name);
        copyFileSync(path.join(output, file.local), file.upload);
    }

    const tag = `v${version}`;
    const releases = JSON.parse(run(['api', 'repos/{owner}/{repo}/releases', '--paginate', '--slurp'])).flat();
    if (releases.some(release => release.tag_name === tag)) {
        throw new Error(`Release ${tag} already exists; refusing to create a duplicate draft.`);
    }
    // Create exactly once, then upload to that draft without replacing assets.
    run(['release', 'create', tag, '--draft', '--verify-tag', '--title', version, '--notes-from-tag']);
    run(['release', 'upload', tag, ...files.map(file => file.upload)]);
    const release = JSON.parse(run(['release', 'view', tag, '--json', 'assets']));
    for (const file of files) {
        const asset = release.assets.find(asset => asset.name === file.name);
        if (!asset || asset.size !== file.size) {
            throw new Error(`Missing or incomplete uploaded release file: ${file.name}`);
        }
    }
    console.log(`Verified all ${files.length} files in draft release ${tag}. Ready for publication.`);
}

if (import.meta.main) {
    try {
        publishRelease();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
