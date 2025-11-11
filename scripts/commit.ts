#!/usr/bin/env tsx
/**
 * Interactive Git Commit Script for quiche-nwep
 *
 * Features:
 * - Smart file staging with multi-select
 * - Conventional commit message formatting
 * - Automatic versioning and tagging
 * - Push to remote with confirmation
 */

import { intro, outro, confirm, multiselect, select, text, note, cancel, isCancel, log, spinner } from '@clack/prompts';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { bold, cyan, green, red, yellow, dim, magenta, gray } from 'colorette';

interface GitStatus {
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

interface CommitOptions {
  type: string;
  scope?: string;
  message: string;
  body?: string;
  breaking: boolean;
}

const COMMIT_TYPES = [
  { value: 'feat', label: 'feat', description: 'A new feature' },
  { value: 'fix', label: 'fix', description: 'A bug fix' },
  { value: 'docs', label: 'docs', description: 'Documentation only changes' },
  { value: 'style', label: 'style', description: 'Code style changes (formatting, etc)' },
  { value: 'refactor', label: 'refactor', description: 'Code refactoring' },
  { value: 'perf', label: 'perf', description: 'Performance improvements' },
  { value: 'test', label: 'test', description: 'Adding or updating tests' },
  { value: 'build', label: 'build', description: 'Build system or dependencies' },
  { value: 'ci', label: 'ci', description: 'CI/CD changes' },
  { value: 'chore', label: 'chore', description: 'Other changes (tooling, etc)' },
];

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

function getGitStatus(): GitStatus {
  const status = exec('git status --porcelain');
  const lines = status.split('\n').filter(l => l.trim());

  const modified: string[] = [];
  const added: string[] = [];
  const deleted: string[] = [];
  const untracked: string[] = [];

  for (const line of lines) {
    const statusCode = line.substring(0, 2);
    const file = line.substring(3);

    if (statusCode === '??') {
      untracked.push(file);
    } else if (statusCode.includes('M')) {
      modified.push(file);
    } else if (statusCode.includes('A')) {
      added.push(file);
    } else if (statusCode.includes('D')) {
      deleted.push(file);
    } else {
      // Handle other cases (renamed, etc)
      modified.push(file);
    }
  }

  return { modified, added, deleted, untracked };
}

function getCurrentVersion(): string {
  const cargoToml = readFileSync(join(process.cwd(), 'quiche/Cargo.toml'), 'utf-8');
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : '1.0.0';
}

function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

function bumpVersion(version: string, type: 'major' | 'minor' | 'patch'): string {
  const { major, minor, patch } = parseVersion(version);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

function formatCommitMessage(options: CommitOptions): string {
  let message = options.type;

  if (options.scope) {
    message += `(${options.scope})`;
  }

  if (options.breaking) {
    message += '!';
  }

  message += `: ${options.message}`;

  if (options.body) {
    message += `\n\n${options.body}`;
  }

  if (options.breaking) {
    message += '\n\nBREAKING CHANGE: This commit contains breaking changes';
  }

  return message;
}

async function main() {
  console.clear();

  intro(cyan(bold('🚀 quiche-nwep Git Commit Helper')));

  // Check if we're in a git repository
  const isGitRepo = exec('git rev-parse --git-dir') !== '';
  if (!isGitRepo) {
    cancel('Not a git repository!');
    process.exit(1);
  }

  // Check for uncommitted changes
  const status = getGitStatus();
  const allFiles = [
    ...status.modified,
    ...status.added,
    ...status.deleted,
    ...status.untracked,
  ];

  if (allFiles.length === 0) {
    outro(green('✓ No changes to commit. Working tree is clean!'));
    process.exit(0);
  }

  // Show current status
  const statusLines: string[] = [];
  if (status.modified.length > 0) {
    statusLines.push(`${yellow('Modified:')} ${status.modified.length} file(s)`);
  }
  if (status.added.length > 0) {
    statusLines.push(`${green('Added:')} ${status.added.length} file(s)`);
  }
  if (status.deleted.length > 0) {
    statusLines.push(`${red('Deleted:')} ${status.deleted.length} file(s)`);
  }
  if (status.untracked.length > 0) {
    statusLines.push(`${cyan('Untracked:')} ${status.untracked.length} file(s)`);
  }

  note(statusLines.join('\n'), 'Git Status');

  // Select files to stage
  const fileOptions = allFiles.map(file => {
    let prefix = '';
    let hint = '';

    if (status.modified.includes(file)) {
      prefix = yellow('M');
      hint = 'Modified';
    } else if (status.added.includes(file)) {
      prefix = green('A');
      hint = 'Added';
    } else if (status.deleted.includes(file)) {
      prefix = red('D');
      hint = 'Deleted';
    } else if (status.untracked.includes(file)) {
      prefix = cyan('?');
      hint = 'Untracked';
    }

    return {
      value: file,
      label: `${prefix} ${file}`,
      hint,
    };
  });

  const selectedFiles = await multiselect({
    message: 'Select files to stage:',
    options: fileOptions,
    initialValues: allFiles, // Select all by default
    required: true,
  });

  if (isCancel(selectedFiles)) {
    cancel('Commit cancelled.');
    process.exit(0);
  }

  // Stage selected files
  const s = spinner();
  s.start('Staging files...');
  for (const file of selectedFiles as string[]) {
    exec(`git add "${file}"`);
  }
  s.stop(green(`✓ Staged ${(selectedFiles as string[]).length} file(s)`));

  // Select commit type
  const commitType = await select({
    message: 'Select commit type:',
    options: COMMIT_TYPES,
  });

  if (isCancel(commitType)) {
    cancel('Commit cancelled.');
    process.exit(0);
  }

  // Ask for scope (optional)
  const scope = await text({
    message: 'Commit scope (optional):',
    placeholder: 'e.g., nwep, build, docs',
    validate: (value) => {
      if (value && !/^[a-z-]+$/.test(value)) {
        return 'Scope must be lowercase letters and hyphens only';
      }
    },
  });

  if (isCancel(scope)) {
    cancel('Commit cancelled.');
    process.exit(0);
  }

  // Ask for commit message
  const message = await text({
    message: 'Commit message:',
    placeholder: 'Brief description of changes',
    validate: (value) => {
      if (!value || value.length < 3) {
        return 'Message must be at least 3 characters';
      }
      if (value.length > 100) {
        return 'Message should be less than 100 characters';
      }
    },
  });

  if (isCancel(message)) {
    cancel('Commit cancelled.');
    process.exit(0);
  }

  // Ask for detailed body (optional)
  const body = await text({
    message: 'Detailed description (optional):',
    placeholder: 'Press enter to skip',
  });

  if (isCancel(body)) {
    cancel('Commit cancelled.');
    process.exit(0);
  }

  // Ask if breaking change
  const breaking = await confirm({
    message: 'Is this a breaking change?',
    initialValue: false,
  });

  if (isCancel(breaking)) {
    cancel('Commit cancelled.');
    process.exit(0);
  }

  // Format commit message
  const commitOptions: CommitOptions = {
    type: commitType as string,
    scope: scope as string || undefined,
    message: message as string,
    body: body as string || undefined,
    breaking: breaking as boolean,
  };

  const commitMessage = formatCommitMessage(commitOptions);

  // Show preview
  note(
    gray(commitMessage),
    'Commit Message Preview'
  );

  const confirmCommit = await confirm({
    message: 'Create this commit?',
    initialValue: true,
  });

  if (isCancel(confirmCommit) || !confirmCommit) {
    cancel('Commit cancelled.');
    process.exit(0);
  }

  // Create commit
  const commitSpinner = spinner();
  commitSpinner.start('Creating commit...');

  try {
    exec(`git commit -m "${commitMessage.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
    commitSpinner.stop(green('✓ Commit created successfully'));
  } catch (error) {
    commitSpinner.stop(red('✗ Failed to create commit'));
    throw error;
  }

  // Ask about tagging
  const shouldTag = await confirm({
    message: 'Create a version tag?',
    initialValue: false,
  });

  if (isCancel(shouldTag)) {
    outro(green('✓ Commit created (no tag)'));
    process.exit(0);
  }

  if (shouldTag) {
    const currentVersion = getCurrentVersion();

    const tagType = await select({
      message: `Current version: ${cyan(currentVersion)}. How to bump?`,
      options: [
        { value: 'patch', label: `Patch (${bumpVersion(currentVersion, 'patch')})`, hint: 'Bug fixes, minor changes' },
        { value: 'minor', label: `Minor (${bumpVersion(currentVersion, 'minor')})`, hint: 'New features, backward compatible' },
        { value: 'major', label: `Major (${bumpVersion(currentVersion, 'major')})`, hint: 'Breaking changes' },
        { value: 'custom', label: 'Custom version', hint: 'Specify your own version' },
        { value: 'current', label: `Use current (v${currentVersion})`, hint: 'Tag current version' },
      ],
    });

    if (isCancel(tagType)) {
      outro(green('✓ Commit created (no tag)'));
      process.exit(0);
    }

    let newVersion: string;

    if (tagType === 'custom') {
      const customVersion = await text({
        message: 'Enter version:',
        placeholder: 'e.g., 1.2.3',
        validate: (value) => {
          if (!/^\d+\.\d+\.\d+$/.test(value)) {
            return 'Version must be in format: major.minor.patch (e.g., 1.2.3)';
          }
        },
      });

      if (isCancel(customVersion)) {
        outro(green('✓ Commit created (no tag)'));
        process.exit(0);
      }

      newVersion = customVersion as string;
    } else if (tagType === 'current') {
      newVersion = currentVersion;
    } else {
      newVersion = bumpVersion(currentVersion, tagType as 'major' | 'minor' | 'patch');
    }

    const tagMessage = await text({
      message: 'Tag message (optional):',
      placeholder: `Release v${newVersion}`,
    });

    if (isCancel(tagMessage)) {
      outro(green('✓ Commit created (no tag)'));
      process.exit(0);
    }

    const tagSpinner = spinner();
    tagSpinner.start(`Creating tag v${newVersion}...`);

    try {
      const tagMsg = (tagMessage as string) || `Release v${newVersion}`;
      exec(`git tag -a v${newVersion} -m "${tagMsg}"`);
      tagSpinner.stop(green(`✓ Tag v${newVersion} created`));
    } catch (error) {
      tagSpinner.stop(red('✗ Failed to create tag'));
      throw error;
    }
  }

  // Ask about pushing
  const shouldPush = await confirm({
    message: 'Push to remote?',
    initialValue: true,
  });

  if (isCancel(shouldPush)) {
    outro(green('✓ Commit created locally'));
    process.exit(0);
  }

  if (shouldPush) {
    const currentBranch = exec('git branch --show-current');

    // Check if origin remote exists
    const remotes = exec('git remote');
    if (!remotes.includes('origin')) {
      log.warn(yellow('No "origin" remote configured.'));

      const addRemote = await confirm({
        message: 'Would you like to add the origin remote now?',
        initialValue: true,
      });

      if (isCancel(addRemote) || !addRemote) {
        outro(green('✓ Commit created locally (not pushed)'));
        process.exit(0);
      }

      const remoteUrl = await text({
        message: 'Enter the remote URL:',
        placeholder: 'https://github.com/usenwep/quiche-nwep.git',
        validate: (value) => {
          if (!value || value.length < 5) {
            return 'Please enter a valid URL';
          }
        },
      });

      if (isCancel(remoteUrl)) {
        outro(green('✓ Commit created locally (not pushed)'));
        process.exit(0);
      }

      const addSpinner = spinner();
      addSpinner.start('Adding origin remote...');
      try {
        exec(`git remote add origin "${remoteUrl}"`);
        addSpinner.stop(green('✓ Remote added'));
      } catch (error) {
        addSpinner.stop(red('✗ Failed to add remote'));
        outro(yellow('⚠ Commit created locally but remote not configured'));
        process.exit(0);
      }
    }

    note(
      `Branch: ${cyan(currentBranch)}\n` +
      `Remote: ${cyan('origin')}`,
      'Push Configuration'
    );

    const confirmPush = await confirm({
      message: `Push to origin/${currentBranch}?`,
      initialValue: true,
    });

    if (isCancel(confirmPush) || !confirmPush) {
      outro(green('✓ Commit created locally (not pushed)'));
      process.exit(0);
    }

    const pushSpinner = spinner();
    pushSpinner.start(`Pushing to origin/${currentBranch}...`);

    try {
      exec(`git push origin ${currentBranch}`, false);
      pushSpinner.stop(green(`✓ Pushed to origin/${currentBranch}`));

      // Push tags if created
      if (shouldTag) {
        const pushTagSpinner = spinner();
        pushTagSpinner.start('Pushing tags...');
        exec('git push --tags', false);
        pushTagSpinner.stop(green('✓ Tags pushed'));
      }
    } catch (error: any) {
      pushSpinner.stop(red('✗ Failed to push'));

      // Check if it's an authentication or network error
      const errorMsg = error.message || '';
      if (errorMsg.includes('Permission denied') || errorMsg.includes('authentication')) {
        log.error(red('Authentication failed. You may need to:'));
        log.info('  • Set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh');
        log.info('  • Use a personal access token for HTTPS');
        log.info('  • Configure git credentials');
      } else if (errorMsg.includes('Could not resolve host')) {
        log.error(red('Network error. Check your internet connection.'));
      }

      outro(yellow('⚠ Commit and tag created locally but not pushed'));
      process.exit(1);
    }
  }

  // Success outro
  const commitHash = exec('git rev-parse --short HEAD');

  outro(
    green(
      bold(
        `✓ All done! Commit ${cyan(commitHash)}${shouldTag ? ` tagged and` : ''} ${shouldPush ? 'pushed' : 'created'} successfully`
      )
    )
  );
}

main().catch((error) => {
  console.error(red('Fatal error:'), error);
  process.exit(1);
});
