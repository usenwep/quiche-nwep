#!/usr/bin/env tsx
/**
 * Interactive GitHub Release Script for quiche-nwep
 *
 * Features:
 * - Automatic version detection
 * - Package platform builds as .zip and .tar.gz
 * - Create GitHub release with assets
 * - Pre-release and draft options
 * - Release notes generation
 */

import { intro, outro, confirm, multiselect, select, text, note, cancel, isCancel, log, spinner } from '@clack/prompts';
import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, createWriteStream, writeFileSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { bold, cyan, green, red, yellow, dim, magenta, gray } from 'colorette';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import archiver from 'archiver';

interface ReleaseOptions {
  version: string;
  tag: string;
  name: string;
  notes: string;
  draft: boolean;
  prerelease: boolean;
  platforms: string[];
}

interface PlatformAsset {
  platform: string;
  zipPath: string;
  tarPath: string;
  size: number;
}

function exec(command: string, silent = true): string {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
    }).trim();
  } catch (error: any) {
    if (silent) {
      return '';
    }
    throw error;
  }
}

function getCurrentVersion(): string {
  const cargoToml = readFileSync(join(process.cwd(), 'quiche/Cargo.toml'), 'utf-8');
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : '1.0.0';
}

function checkGhCli(): boolean {
  const version = exec('gh --version');
  return version.includes('gh version');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = createWriteStream(outputPath);

  return new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function createTarballArchive(sourceDir: string, outputPath: string): Promise<void> {
  await tar.create(
    {
      gzip: true,
      file: outputPath,
      cwd: sourceDir,
    },
    ['.']
  );
}

function getAvailablePlatforms(version: string): string[] {
  const releasesDir = join(process.cwd(), 'releases', `v${version}`);

  if (!existsSync(releasesDir)) {
    return [];
  }

  const entries = readdirSync(releasesDir);
  return entries.filter(entry => {
    const fullPath = join(releasesDir, entry);
    return statSync(fullPath).isDirectory();
  });
}

function generateReleaseNotes(version: string, platforms: string[]): string {
  const date = new Date().toISOString().split('T')[0];

  return `# quiche-nwep v${version}

Release date: ${date}

## 📦 Pre-built Libraries

This release includes pre-built libraries for the following platforms:

${platforms.map(p => `- **${p}**`).join('\n')}

Each archive contains:
- Static libraries (\`.a\`)
- Dynamic libraries (\`.so\`, \`.dll\` where applicable)
- Import libraries (Windows \`.dll.a\`)

## 🚀 Features

- NWEP (New Web Exchange Protocol) support
- Full QUIC/HTTP/3 implementation based on Cloudflare's quiche
- Cross-platform compatibility
- C FFI for integration with other languages

## 📖 Documentation

- [QUICKSTART.md](https://github.com/usenwep/quiche-nwep/blob/main/QUICKSTART.md) - Quick setup guide
- [BUILD_CROSS_PLATFORM.md](https://github.com/usenwep/quiche-nwep/blob/main/BUILD_CROSS_PLATFORM.md) - Cross-compilation guide
- [CLAUDE.md](https://github.com/usenwep/quiche-nwep/blob/main/CLAUDE.md) - Development guide

## 🔧 Usage

### C/C++ Projects

**CMake:**
\`\`\`cmake
add_library(quiche STATIC IMPORTED)
set_target_properties(quiche PROPERTIES
    IMPORTED_LOCATION \${CMAKE_SOURCE_DIR}/lib/libquiche.a
)
target_link_libraries(your_app quiche)
\`\`\`

### Rust Projects

\`\`\`toml
[dependencies]
quiche = { git = "https://github.com/usenwep/quiche-nwep", features = ["ffi"] }
\`\`\`

## 📝 License

BSD-2-Clause

---

🥧 Generated with [quiche-nwep release script](https://github.com/usenwep/quiche-nwep)
`;
}

async function main() {
  console.clear();

  intro(cyan(bold('📦 quiche-nwep Release Manager')));

  // Check for gh CLI
  if (!checkGhCli()) {
    cancel(
      red('GitHub CLI (gh) is not installed.\n\n') +
      'Install it from: https://cli.github.com/'
    );
    process.exit(1);
  }

  // Check if authenticated
  const authStatus = exec('gh auth status 2>&1');
  if (!authStatus.includes('Logged in')) {
    log.warn(yellow('Not authenticated with GitHub CLI.'));
    const shouldAuth = await confirm({
      message: 'Would you like to authenticate now?',
      initialValue: true,
    });

    if (isCancel(shouldAuth) || !shouldAuth) {
      cancel('Release cancelled. Authenticate with: gh auth login');
      process.exit(1);
    }

    log.info('Running: gh auth login');
    exec('gh auth login', false);
  }

  // Get current version
  const version = getCurrentVersion();
  const releasesDir = join(process.cwd(), 'releases', `v${version}`);

  // Check if releases directory exists
  if (!existsSync(releasesDir)) {
    cancel(
      red(`No releases found for v${version}\n\n`) +
      `Expected directory: ${dim(releasesDir)}\n\n` +
      `Run ${cyan('npm run package')} to create release artifacts.`
    );
    process.exit(1);
  }

  // Get available platforms
  const availablePlatforms = getAvailablePlatforms(version);

  if (availablePlatforms.length === 0) {
    cancel(
      red(`No platform builds found in ${releasesDir}\n\n`) +
      `Run ${cyan('npm run package')} to create release artifacts.`
    );
    process.exit(1);
  }

  note(
    `${bold('Version:')} ${cyan(`v${version}`)}\n` +
    `${bold('Platforms:')} ${availablePlatforms.length} available\n` +
    `${bold('Location:')} ${dim(releasesDir)}`,
    'Release Information'
  );

  // Select platforms to include
  const selectedPlatforms = await multiselect({
    message: 'Select platforms to include in release:',
    options: availablePlatforms.map(p => ({
      value: p,
      label: p,
      hint: `Package ${p} build`,
    })),
    initialValues: availablePlatforms,
    required: true,
  });

  if (isCancel(selectedPlatforms)) {
    cancel('Release cancelled.');
    process.exit(0);
  }

  // Release name
  const releaseName = await text({
    message: 'Release name:',
    placeholder: `quiche-nwep v${version}`,
    initialValue: `quiche-nwep v${version}`,
  });

  if (isCancel(releaseName)) {
    cancel('Release cancelled.');
    process.exit(0);
  }

  // Generate release notes
  const defaultNotes = generateReleaseNotes(version, selectedPlatforms as string[]);

  const editNotes = await confirm({
    message: 'Edit release notes?',
    initialValue: false,
  });

  if (isCancel(editNotes)) {
    cancel('Release cancelled.');
    process.exit(0);
  }

  let releaseNotes = defaultNotes;

  if (editNotes) {
    log.info(gray('Opening editor for release notes...'));
    const tempFile = join(process.cwd(), '.release-notes.md');
    writeFileSync(tempFile, defaultNotes);

    try {
      exec(`${process.env.EDITOR || 'nano'} "${tempFile}"`, false);
      releaseNotes = readFileSync(tempFile, 'utf-8');
      unlinkSync(tempFile);
    } catch (error) {
      log.warn(yellow('Failed to open editor, using default notes'));
    }
  }

  // Draft or published
  const isDraft = await confirm({
    message: 'Create as draft?',
    initialValue: false,
  });

  if (isCancel(isDraft)) {
    cancel('Release cancelled.');
    process.exit(0);
  }

  // Pre-release
  const isPrerelease = await confirm({
    message: 'Mark as pre-release?',
    initialValue: false,
  });

  if (isCancel(isPrerelease)) {
    cancel('Release cancelled.');
    process.exit(0);
  }

  // Show summary
  note(
    `${bold('Tag:')} ${cyan(`v${version}`)}\n` +
    `${bold('Name:')} ${releaseName}\n` +
    `${bold('Platforms:')} ${(selectedPlatforms as string[]).join(', ')}\n` +
    `${bold('Draft:')} ${isDraft ? 'yes' : 'no'}\n` +
    `${bold('Pre-release:')} ${isPrerelease ? 'yes' : 'no'}`,
    'Release Configuration'
  );

  const confirmRelease = await confirm({
    message: 'Create release?',
    initialValue: true,
  });

  if (isCancel(confirmRelease) || !confirmRelease) {
    cancel('Release cancelled.');
    process.exit(0);
  }

  // Create archives directory
  const archivesDir = join(process.cwd(), 'dist');
  if (!existsSync(archivesDir)) {
    mkdirSync(archivesDir, { recursive: true });
  }

  // Package platforms
  const assets: PlatformAsset[] = [];
  const packagingSpinner = spinner();

  for (let i = 0; i < (selectedPlatforms as string[]).length; i++) {
    const platform = (selectedPlatforms as string[])[i];
    const platformDir = join(releasesDir, platform);

    packagingSpinner.start(`[${i + 1}/${(selectedPlatforms as string[]).length}] Packaging ${platform}...`);

    const zipPath = join(archivesDir, `quiche-nwep-v${version}-${platform}.zip`);
    const tarPath = join(archivesDir, `quiche-nwep-v${version}-${platform}.tar.gz`);

    try {
      // Create zip
      await createZipArchive(platformDir, zipPath);

      // Create tarball
      await createTarballArchive(platformDir, tarPath);

      const zipSize = statSync(zipPath).size;
      const tarSize = statSync(tarPath).size;

      assets.push({
        platform,
        zipPath,
        tarPath,
        size: zipSize + tarSize,
      });

      packagingSpinner.message(`[${i + 1}/${(selectedPlatforms as string[]).length}] Packaged ${platform} (${formatBytes(zipSize + tarSize)})`);
    } catch (error: any) {
      packagingSpinner.stop(red(`✗ Failed to package ${platform}`));
      log.error(error.message);
      process.exit(1);
    }
  }

  packagingSpinner.stop(green(`✓ Packaged ${assets.length} platform(s)`));

  // Show archive summary
  const archivesList = assets.map(a =>
    `${bold(a.platform)}:\n` +
    `  • ${basename(a.zipPath)} (${formatBytes(statSync(a.zipPath).size)})\n` +
    `  • ${basename(a.tarPath)} (${formatBytes(statSync(a.tarPath).size)})`
  ).join('\n\n');

  note(archivesList, 'Created Archives');

  // Check if release already exists
  const existingRelease = exec(`gh release view v${version} 2>&1`);
  let releaseExists = !existingRelease.includes('release not found');

  if (releaseExists) {
    log.warn(yellow(`Release v${version} already exists.`));

    const useExisting = await confirm({
      message: 'Use existing release and upload assets?',
      initialValue: true,
    });

    if (isCancel(useExisting) || !useExisting) {
      cancel('Release cancelled.');
      process.exit(0);
    }

    log.info(`Using existing release v${version}`);
  } else {
    // Create GitHub release
    const releaseSpinner = spinner();
    releaseSpinner.start('Creating GitHub release...');

    const notesFile = join(process.cwd(), '.release-notes-temp.md');
    writeFileSync(notesFile, releaseNotes);

    try {
      const releaseFlags = [
        `--title "${releaseName}"`,
        `--notes-file "${notesFile}"`,
        isDraft ? '--draft' : '',
        isPrerelease ? '--prerelease' : '',
      ].filter(Boolean).join(' ');

      exec(`gh release create v${version} ${releaseFlags}`, false);
      releaseSpinner.stop(green(`✓ Release v${version} created`));
    } catch (error: any) {
      releaseSpinner.stop(red('✗ Failed to create release'));
      if (existsSync(notesFile)) {
        unlinkSync(notesFile);
      }
      throw error;
    } finally {
      if (existsSync(notesFile)) {
        unlinkSync(notesFile);
      }
    }
  }

  // Upload assets
  const uploadSpinner = spinner();

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];

    uploadSpinner.start(`[${i * 2 + 1}/${assets.length * 2}] Uploading ${basename(asset.zipPath)}...`);
    try {
      exec(`gh release upload v${version} "${asset.zipPath}"`, false);
      uploadSpinner.message(`[${i * 2 + 1}/${assets.length * 2}] Uploaded ${basename(asset.zipPath)}`);
    } catch (error) {
      uploadSpinner.stop(red(`✗ Failed to upload ${basename(asset.zipPath)}`));
      throw error;
    }

    uploadSpinner.start(`[${i * 2 + 2}/${assets.length * 2}] Uploading ${basename(asset.tarPath)}...`);
    try {
      exec(`gh release upload v${version} "${asset.tarPath}"`, false);
      uploadSpinner.message(`[${i * 2 + 2}/${assets.length * 2}] Uploaded ${basename(asset.tarPath)}`);
    } catch (error) {
      uploadSpinner.stop(red(`✗ Failed to upload ${basename(asset.tarPath)}`));
      throw error;
    }
  }

  uploadSpinner.stop(green(`✓ Uploaded ${assets.length * 2} asset(s)`));

  // Get release URL
  const releaseUrl = exec(`gh release view v${version} --json url --jq .url`) ||
                     `https://github.com/usenwep/quiche-nwep/releases/tag/v${version}`;

  // Success
  outro(
    green(
      bold(
        `✓ Release v${version} ${releaseExists ? 'updated' : 'created'} successfully!\n\n` +
        `${cyan(releaseUrl)}\n\n` +
        `${assets.length} platform(s) packaged and uploaded`
      )
    )
  );
}

main().catch((error) => {
  console.error(red('Fatal error:'), error);
  process.exit(1);
});
