#!/usr/bin/env tsx
/**
 * Workflow Orchestrator for quiche-nwep
 *
 * Features:
 * - Version management (updates Cargo.toml files)
 * - Orchestrates build → package → commit → release workflow
 * - Interactive prompts for each step
 * - Skippable steps for flexibility
 */

import { intro, outro, confirm, select, text, note, cancel, isCancel, log, spinner } from '@clack/prompts';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { bold, cyan, green, red, yellow, dim, magenta } from 'colorette';

interface Version {
  major: number;
  minor: number;
  patch: number;
}

function exec(command: string, silent = true): string {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
      cwd: process.cwd(),
    }).trim();
  } catch (error: any) {
    if (silent) {
      return '';
    }
    throw error;
  }
}

function parseVersion(versionStr: string): Version {
  const [major, minor, patch] = versionStr.split('.').map(Number);
  if ([major, minor, patch].some(isNaN)) {
    throw new Error(`Invalid version format: ${versionStr}`);
  }
  return { major, minor, patch };
}

function formatVersion(v: Version): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

function getCurrentVersion(): string {
  const cargoToml = readFileSync(join(process.cwd(), 'quiche/Cargo.toml'), 'utf-8');
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : '1.0.0';
}

function updateQuicheVersion(newVersion: string): void {
  const path = join(process.cwd(), 'quiche/Cargo.toml');
  const content = readFileSync(path, 'utf-8');
  const updated = content.replace(
    /^(version\s*=\s*")[^"]+(")/m,
    `$1${newVersion}$2`
  );
  writeFileSync(path, updated, 'utf-8');
}

function updateWorkspaceVersion(newVersion: string): void {
  const path = join(process.cwd(), 'Cargo.toml');
  const content = readFileSync(path, 'utf-8');

  // Update workspace dependency: quiche = { version = "x.x.x", path = "./quiche" }
  const updated = content.replace(
    /^(quiche\s*=\s*\{\s*version\s*=\s*")[^"]+(")/m,
    `$1${newVersion}$2`
  );
  writeFileSync(path, updated, 'utf-8');
}

function bumpVersion(current: Version, type: 'major' | 'minor' | 'patch'): Version {
  switch (type) {
    case 'major':
      return { major: current.major + 1, minor: 0, patch: 0 };
    case 'minor':
      return { major: current.major, minor: current.minor + 1, patch: 0 };
    case 'patch':
      return { major: current.major, minor: current.minor, patch: current.patch + 1 };
  }
}

function checkGitClean(): boolean {
  const status = exec('git status --porcelain');
  return status === '';
}

async function runScript(scriptName: string, npmScript: string): Promise<boolean> {
  const shouldRun = await confirm({
    message: `Run ${cyan(scriptName)}?`,
    initialValue: true,
  });

  if (isCancel(shouldRun)) {
    cancel('Workflow cancelled.');
    process.exit(0);
  }

  if (!shouldRun) {
    log.info(dim(`Skipped ${scriptName}`));
    return false;
  }

  log.info(cyan(`\n▶ Running ${scriptName}...\n`));

  try {
    exec(`npm run ${npmScript}`, false);
    log.info(green(`✓ ${scriptName} completed\n`));
    return true;
  } catch (error: any) {
    log.error(red(`✗ ${scriptName} failed`));

    const continueAnyway = await confirm({
      message: 'Continue with workflow despite error?',
      initialValue: false,
    });

    if (isCancel(continueAnyway) || !continueAnyway) {
      cancel(`Workflow stopped at ${scriptName}`);
      process.exit(1);
    }

    return false;
  }
}

async function main() {
  console.clear();

  intro(cyan(bold('🔧 quiche-nwep Workflow Orchestrator')));

  note(
    `This script will guide you through:\n\n` +
    `${dim('1.')} ${cyan('Version management')} - Update project version\n` +
    `${dim('2.')} ${cyan('Build')} - Cross-platform compilation\n` +
    `${dim('3.')} ${cyan('Package')} - Organize release artifacts\n` +
    `${dim('4.')} ${cyan('Commit')} - Git commit with conventional format\n` +
    `${dim('5.')} ${cyan('Release')} - Create GitHub release with assets`,
    'Workflow Steps'
  );

  // Check git status
  if (!checkGitClean()) {
    log.warn(yellow('⚠ Git working directory has uncommitted changes'));

    const proceedDirty = await confirm({
      message: 'Continue anyway?',
      initialValue: false,
    });

    if (isCancel(proceedDirty) || !proceedDirty) {
      cancel('Workflow cancelled. Commit or stash your changes first.');
      process.exit(0);
    }
  } else {
    log.info(green('✓ Git working directory is clean'));
  }

  // ========================================
  // Step 1: Version Management
  // ========================================

  const currentVersion = getCurrentVersion();
  const currentParsed = parseVersion(currentVersion);

  note(
    `${bold('Current version:')} ${cyan(currentVersion)}\n` +
    `${dim('Location:')} quiche/Cargo.toml`,
    'Version Information'
  );

  const versionAction = await select({
    message: 'Version update:',
    options: [
      { value: 'skip', label: 'Skip (keep current)', hint: `v${currentVersion}` },
      { value: 'patch', label: `Patch (${formatVersion(bumpVersion(currentParsed, 'patch'))})`, hint: 'Bug fixes' },
      { value: 'minor', label: `Minor (${formatVersion(bumpVersion(currentParsed, 'minor'))})`, hint: 'New features' },
      { value: 'major', label: `Major (${formatVersion(bumpVersion(currentParsed, 'major'))})`, hint: 'Breaking changes' },
      { value: 'custom', label: 'Custom version', hint: 'Specify manually' },
    ],
  });

  if (isCancel(versionAction)) {
    cancel('Workflow cancelled.');
    process.exit(0);
  }

  let newVersion = currentVersion;
  let versionChanged = false;

  if (versionAction !== 'skip') {
    if (versionAction === 'custom') {
      const customVersion = await text({
        message: 'Enter version:',
        placeholder: 'e.g., 2.0.0',
        validate: (value) => {
          if (!/^\d+\.\d+\.\d+$/.test(value)) {
            return 'Version must be in format: major.minor.patch';
          }
        },
      });

      if (isCancel(customVersion)) {
        cancel('Workflow cancelled.');
        process.exit(0);
      }

      newVersion = customVersion as string;
    } else {
      const bumped = bumpVersion(currentParsed, versionAction as 'major' | 'minor' | 'patch');
      newVersion = formatVersion(bumped);
    }

    // Update version in files
    const updateSpinner = spinner();
    updateSpinner.start('Updating version in Cargo.toml files...');

    try {
      updateQuicheVersion(newVersion);
      updateWorkspaceVersion(newVersion);
      updateSpinner.stop(green(`✓ Updated version to ${cyan(newVersion)}`));
      versionChanged = true;
    } catch (error: any) {
      updateSpinner.stop(red('✗ Failed to update version'));
      log.error(error.message);
      process.exit(1);
    }

    note(
      `${bold('Updated files:')}\n` +
      `  • quiche/Cargo.toml (package version)\n` +
      `  • Cargo.toml (workspace dependency)`,
      'Version Update'
    );
  }

  // ========================================
  // Step 2: Build
  // ========================================

  log.info(cyan('\n═══ Build Phase ═══'));

  const buildRan = await runScript('build script', 'build');

  // ========================================
  // Step 3: Package
  // ========================================

  if (buildRan) {
    log.info(cyan('\n═══ Package Phase ═══'));
    await runScript('package script', 'package');
  }

  // ========================================
  // Step 4: Commit
  // ========================================

  if (versionChanged || buildRan) {
    log.info(cyan('\n═══ Commit Phase ═══'));

    const hasChanges = !checkGitClean();

    if (!hasChanges) {
      log.info(dim('No changes to commit'));
    } else {
      await runScript('commit script', 'commit');
    }
  }

  // ========================================
  // Step 5: Release
  // ========================================

  log.info(cyan('\n═══ Release Phase ═══'));

  const shouldRelease = await confirm({
    message: `Create GitHub release for ${cyan(`v${newVersion}`)}?`,
    initialValue: true,
  });

  if (isCancel(shouldRelease)) {
    cancel('Workflow cancelled.');
    process.exit(0);
  }

  if (shouldRelease) {
    await runScript('release script', 'release');
  } else {
    log.info(dim('Skipped release creation'));
  }

  // ========================================
  // Complete
  // ========================================

  const summary: string[] = [];

  if (versionChanged) {
    summary.push(`${green('✓')} Version updated to ${cyan(newVersion)}`);
  }
  if (buildRan) {
    summary.push(`${green('✓')} Build completed`);
  }
  if (!checkGitClean()) {
    summary.push(`${yellow('⚠')} Uncommitted changes remain`);
  } else {
    summary.push(`${green('✓')} All changes committed`);
  }

  outro(
    green(
      bold(
        '\n✨ Workflow complete!\n\n' +
        summary.join('\n')
      )
    )
  );
}

main().catch((error) => {
  console.error(red('\nFatal error:'), error);
  process.exit(1);
});
