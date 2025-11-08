#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, existsSync } from 'fs';
import { dirname, join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import prompts from 'prompts';

// colors for terminal output
const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  dim: chalk.dim,
};

// paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const CARGO_TOML_PATH = join(ROOT_DIR, 'quiche', 'Cargo.toml');
const RELEASES_DIR = join(ROOT_DIR, 'releases');

interface Version {
  major: number;
  minor: number;
  patch: number;
}

// parse version string to object
function parseVersion(version: string): Version {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`invalid version format: ${version}`);
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

// format version object to string
function formatVersion(v: Version): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

// get current version from Cargo.toml
function getVersion(): Version {
  const content = readFileSync(CARGO_TOML_PATH, 'utf-8');
  const versionMatch = content.match(/^\s*version\s*=\s*"([^"]+)"/m);
  if (!versionMatch || !versionMatch[1]) {
    console.error(colors.error('✗ version not found in Cargo.toml'));
    process.exit(1);
  }
  try {
    return parseVersion(versionMatch[1]);
  } catch (error) {
    console.error(colors.error('✗ failed to parse version from Cargo.toml:'), error);
    process.exit(1);
  }
}

// update version in Cargo.toml
function updateVersion(newVersion: Version): void {
  try {
    const content = readFileSync(CARGO_TOML_PATH, 'utf-8');
    const versionString = formatVersion(newVersion);

    // use regex to update version while preserving formatting
    const versionRegex = /^(\s*version\s*=\s*")[^"]+(".*)$/m;
    if (!versionRegex.test(content)) {
      throw new Error('could not find version line in Cargo.toml');
    }

    const updated = content.replace(versionRegex, `$1${versionString}$2`);
    writeFileSync(CARGO_TOML_PATH, updated, 'utf-8');
    console.log(colors.success(`✓ updated version to ${versionString}`));
  } catch (error) {
    console.error(colors.error('✗ failed to update version:'), error);
    process.exit(1);
  }
}

// check if git working directory is clean
function checkGitClean(): boolean {
  try {
    execSync('git diff --quiet --exit-code', { cwd: ROOT_DIR, stdio: 'ignore' });
    execSync('git diff --cached --quiet --exit-code', { cwd: ROOT_DIR, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// run command and show output
function runCommand(command: string, cwd: string = ROOT_DIR): void {
  try {
    console.log(colors.dim(`$ ${command}`));
    execSync(command, { cwd, stdio: 'inherit' });
  } catch (error) {
    console.error(colors.error(`✗ command failed: ${command}`));
    throw error;
  }
}

// copy library files (.a, .so, .h) to releases directory
function copyReleaseArtifacts(version: string, target: string): string {
  const releaseDir = join(RELEASES_DIR, `v${version}`);
  mkdirSync(releaseDir, { recursive: true });

  const targetDir = join(ROOT_DIR, 'target', 'debug');
  const artifacts: string[] = [];

  // Find and copy library files
  const findLibraryFiles = (dir: string) => {
    if (!existsSync(dir)) return;

    const files = readdirSync(dir);
    for (const file of files) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);

      if (stat.isFile()) {
        const ext = extname(file);
        // Copy .a, .so, .h files and lib* files
        if (['.a', '.so', '.h'].includes(ext) || file.startsWith('lib')) {
          const destPath = join(releaseDir, file);
          copyFileSync(fullPath, destPath);
          artifacts.push(file);
          console.log(colors.dim(`  copied: ${file}`));
        }
      }
    }
  };

  console.log(colors.info(`\n📦 copying release artifacts to releases/v${version}/...`));
  findLibraryFiles(targetDir);

  // Also check in quiche subdirectory if it exists
  const quicheDir = join(targetDir, 'quiche');
  if (existsSync(quicheDir)) {
    findLibraryFiles(quicheDir);
  }

  if (artifacts.length === 0) {
    console.log(colors.warning('⚠ no library artifacts found'));
  } else {
    console.log(colors.success(`✓ copied ${artifacts.length} artifacts`));
  }

  return releaseDir;
}

// create tarball from release directory
function createTarball(releaseDir: string, version: string, target: string): string {
  const tarballName = `nwep-v${version}-${target}.tar.gz`;
  const tarballPath = join(RELEASES_DIR, tarballName);

  console.log(colors.info(`\n📦 creating tarball ${tarballName}...`));
  runCommand(`tar -czf ${tarballPath} -C ${releaseDir} .`);
  console.log(colors.success(`✓ created ${tarballName}`));

  return tarballPath;
}

// create GitHub release
function createGitHubRelease(version: string, releaseNotes: string, tarballPath: string): void {
  console.log(colors.info(`\n🚀 creating GitHub release v${version}...`));

  const notesArg = releaseNotes ? `--notes "${releaseNotes}"` : '--generate-notes';

  try {
    runCommand(`gh release create v${version} ${notesArg} ${tarballPath}`);
    console.log(colors.success(`✓ GitHub release v${version} created`));
  } catch (error) {
    console.error(colors.error('✗ failed to create GitHub release'));
    console.log(colors.dim('Make sure gh CLI is installed and authenticated'));
    throw error;
  }
}

// build target
async function buildTarget(target: string, useDocker: boolean): Promise<void> {
  console.log(colors.info(`\n🔨 building for ${target}${useDocker ? ' (using Docker)' : ''}...`));

  if (useDocker) {
    // Docker builds with artifact extraction
    if (target === 'android' || target === 'ios') {
      console.log(colors.warning(`⚠ Docker builds for ${target} require additional cross-compilation setup`));
      console.log(colors.dim('Falling back to native build...'));
      // Fall back to native build for mobile platforms
      await buildTarget(target, false);
      return;
    }

    const cargoCommand = 'cargo build --features ffi';
    const containerName = `nwep-build-${target}-${Date.now()}`;

    // Build in Docker
    console.log(colors.dim('Building in Docker container...'));
    runCommand(`docker build -t nwep-build --build-arg CARGO_CMD="${cargoCommand}" .`);

    // Create a temporary container to extract artifacts
    console.log(colors.dim('Extracting build artifacts...'));
    runCommand(`docker create --name ${containerName} nwep-build`);

    try {
      // Ensure target directory exists
      runCommand(`mkdir -p ${ROOT_DIR}/target`);

      // Copy entire target directory from container to host
      // This preserves the directory structure including debug/release subdirs
      runCommand(`docker cp ${containerName}:/nwep/target/. ${ROOT_DIR}/target/`);
      console.log(colors.success(`✓ extracted build artifacts to target/`));
    } finally {
      // Clean up container
      runCommand(`docker rm ${containerName}`);
    }
  } else {
    // Native builds
    let command: string;
    switch (target) {
      case 'android':
        command = 'cargo build --features ffi --target aarch64-linux-android';
        break;
      case 'ios':
        command = 'cargo build --features ffi --target aarch64-apple-ios';
        break;
      case 'computer':
        command = 'cargo build --features ffi';
        break;
      default:
        throw new Error(`unknown target: ${target}`);
    }
    runCommand(command);
  }

  console.log(colors.success(`✓ ${target} build completed`));
}

// main function
async function main() {
  console.log(colors.info('\n🚀 quiche release automation\n'));

  // safety check: ensure git is clean
  if (!checkGitClean()) {
    console.error(colors.error('✗ git working directory is not clean'));
    console.error(colors.dim('please commit or stash your changes before running this script'));
    process.exit(1);
  }
  console.log(colors.success('✓ git working directory is clean'));

  // get current version
  const currentVersion = getVersion();
  console.log(colors.info(`current version: ${formatVersion(currentVersion)}`));

  // prompt for version bump
  const versionChoice = await prompts({
    type: 'select',
    name: 'bump',
    message: 'bump version?',
    choices: [
      { title: 'major', value: 'major' },
      { title: 'minor', value: 'minor' },
      { title: 'patch', value: 'patch' },
      { title: 'skip', value: 'skip' },
    ],
  });

  if (!versionChoice.bump) {
    console.log(colors.warning('cancelled'));
    process.exit(0);
  }

  let newVersion = { ...currentVersion };
  if (versionChoice.bump !== 'skip') {
    switch (versionChoice.bump) {
      case 'major':
        newVersion.major += 1;
        newVersion.minor = 0;
        newVersion.patch = 0;
        break;
      case 'minor':
        newVersion.minor += 1;
        newVersion.patch = 0;
        break;
      case 'patch':
        newVersion.patch += 1;
        break;
    }
    updateVersion(newVersion);
  } else {
    newVersion = currentVersion;
  }

  const versionString = formatVersion(newVersion);
  console.log(colors.info(`\nversion: ${versionString}`));

  // prompt for build method
  const buildMethodChoice = await prompts({
    type: 'select',
    name: 'method',
    message: 'build method',
    choices: [
      { title: 'Docker (recommended, no system dependencies)', value: 'docker' },
      { title: 'Native (requires system dependencies)', value: 'native' },
    ],
    initial: 0,
  });

  if (!buildMethodChoice.method) {
    console.log(colors.warning('cancelled'));
    process.exit(0);
  }

  const useDocker = buildMethodChoice.method === 'docker';

  // prompt for build targets
  const targetChoice = await prompts({
    type: 'multiselect',
    name: 'targets',
    message: 'select build targets',
    choices: [
      { title: 'android', value: 'android', selected: false },
      { title: 'ios', value: 'ios', selected: false },
      { title: 'computer', value: 'computer', selected: false },
    ],
  });

  let releaseTarget = 'computer';
  let tarballPath = '';

  if (!targetChoice.targets || targetChoice.targets.length === 0) {
    console.log(colors.warning('no targets selected, skipping builds'));
  } else {
    // build all selected targets sequentially
    for (const target of targetChoice.targets) {
      await buildTarget(target, useDocker);
      releaseTarget = target; // Use last built target for release
    }
    console.log(colors.success('\n✓ all builds completed'));

    // Copy release artifacts and create tarball
    const releaseDir = copyReleaseArtifacts(versionString, releaseTarget);
    tarballPath = createTarball(releaseDir, versionString, releaseTarget);
  }

  // git commit and tag
  if (versionChoice.bump !== 'skip') {
    console.log(colors.info('\n📝 committing changes...'));
    try {
      // Add all changes including releases directory
      runCommand('git add -A');
      runCommand(`git commit -m "chore: release v${versionString}"`);
      console.log(colors.success('✓ changes committed'));

      runCommand(`git tag v${versionString}`);
      console.log(colors.success(`✓ tagged as v${versionString}`));

      // ask about pushing
      const pushChoice = await prompts({
        type: 'confirm',
        name: 'push',
        message: 'push commit and tag to remote?',
        initial: false,
      });

      if (pushChoice.push) {
        console.log(colors.info('\n📤 pushing to remote...'));
        try {
          // Try to push normally first
          runCommand('git push');
        } catch (error) {
          // If push fails, check if it's due to missing upstream
          console.log(colors.warning('⚠ no upstream branch set, setting upstream...'));
          runCommand('git push --set-upstream origin main');
        }
        runCommand('git push --tags');
        console.log(colors.success('✓ pushed to remote'));
      } else {
        console.log(colors.dim('skipped push'));
      }

      // Ask about creating GitHub release
      const releaseChoice = await prompts({
        type: 'confirm',
        name: 'createRelease',
        message: 'create GitHub release?',
        initial: true,
      });

      if (releaseChoice.createRelease && tarballPath) {
        const notesChoice = await prompts({
          type: 'text',
          name: 'notes',
          message: 'release notes (leave empty to auto-generate):',
          initial: '',
        });

        createGitHubRelease(versionString, notesChoice.notes || '', tarballPath);
      }
    } catch (error) {
      console.error(colors.error('✗ git operations failed:'), error);
      process.exit(1);
    }
  }

  console.log(colors.success('\n✨ release automation complete!\n'));
}

// run main
main().catch((error) => {
  console.error(colors.error('✗ fatal error:'), error);
  process.exit(1);
});

