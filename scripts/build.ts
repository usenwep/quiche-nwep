#!/usr/bin/env tsx
/**
 * Interactive Cross-Platform Build Script for quiche-nwep
 *
 * Features:
 * - Multi-select platform targets
 * - Interactive CLI with nice UI
 * - Progress tracking
 * - Parallel builds option
 * - Build summary
 */

import { intro, outro, confirm, multiselect, select, spinner, note, cancel, isCancel, log } from '@clack/prompts';
import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { bold, cyan, green, red, yellow, dim, magenta, gray } from 'colorette';

interface Platform {
  id: string;
  label: string;
  description: string;
  target?: string;
  buildCommand: (options: BuildOptions) => string;
  requiresDocker?: boolean;
  requiresCross?: boolean;
}

interface BuildOptions {
  mode: 'debug' | 'release';
  features: string[];
  parallel: boolean;
  verbose: boolean;
}

interface BuildResult {
  platform: Platform;
  success: boolean;
  duration: number;
  error?: string;
  outputPath?: string;
}

const PLATFORMS: Platform[] = [
  // Windows
  {
    id: 'windows-x64-gnu',
    label: 'Windows x64 (GNU)',
    description: 'Windows 64-bit with MinGW-w64 toolchain',
    target: 'x86_64-pc-windows-gnu',
    requiresCross: true,
    buildCommand: (opts) =>
      `cross build ${opts.mode === 'release' ? '--release' : ''} --target x86_64-pc-windows-gnu --features ${opts.features.join(',')}`,
  },
  {
    id: 'windows-x64-msvc',
    label: 'Windows x64 (MSVC)',
    description: 'Windows 64-bit with MSVC toolchain',
    target: 'x86_64-pc-windows-msvc',
    requiresCross: true,
    buildCommand: (opts) =>
      `cross build ${opts.mode === 'release' ? '--release' : ''} --target x86_64-pc-windows-msvc --features ${opts.features.join(',')}`,
  },

  // Android
  {
    id: 'android-arm64',
    label: 'Android ARM64',
    description: 'Android ARM64 (modern phones)',
    target: 'aarch64-linux-android',
    requiresDocker: true,
    buildCommand: (opts) =>
      `docker build -f Dockerfile.android --build-arg ANDROID_TARGET=aarch64-linux-android --build-arg CARGO_FEATURES=${opts.features.join(',')} -t quiche-nwep-android-arm64 .`,
  },
  {
    id: 'android-arm32',
    label: 'Android ARM32',
    description: 'Android ARMv7 (older devices)',
    target: 'armv7-linux-androideabi',
    requiresDocker: true,
    buildCommand: (opts) =>
      `docker build -f Dockerfile.android --build-arg ANDROID_TARGET=armv7-linux-androideabi --build-arg CARGO_FEATURES=${opts.features.join(',')} -t quiche-nwep-android-arm32 .`,
  },
  {
    id: 'android-x64',
    label: 'Android x86_64',
    description: 'Android x86_64 (emulators)',
    target: 'x86_64-linux-android',
    requiresDocker: true,
    buildCommand: (opts) =>
      `docker build -f Dockerfile.android --build-arg ANDROID_TARGET=x86_64-linux-android --build-arg CARGO_FEATURES=${opts.features.join(',')} -t quiche-nwep-android-x64 .`,
  },
  {
    id: 'android-x86',
    label: 'Android x86',
    description: 'Android x86 (older emulators)',
    target: 'i686-linux-android',
    requiresDocker: true,
    buildCommand: (opts) =>
      `docker build -f Dockerfile.android --build-arg ANDROID_TARGET=i686-linux-android --build-arg CARGO_FEATURES=${opts.features.join(',')} -t quiche-nwep-android-x86 .`,
  },

  // Linux ARM
  {
    id: 'linux-arm64',
    label: 'Linux ARM64',
    description: 'Linux AArch64 (ARM servers, Raspberry Pi)',
    target: 'aarch64-unknown-linux-gnu',
    requiresCross: true,
    buildCommand: (opts) =>
      `cross build ${opts.mode === 'release' ? '--release' : ''} --target aarch64-unknown-linux-gnu --features ${opts.features.join(',')}`,
  },
  {
    id: 'linux-armv7',
    label: 'Linux ARMv7',
    description: 'Linux ARMv7 (Raspberry Pi 32-bit)',
    target: 'armv7-unknown-linux-gnueabihf',
    requiresCross: true,
    buildCommand: (opts) =>
      `cross build ${opts.mode === 'release' ? '--release' : ''} --target armv7-unknown-linux-gnueabihf --features ${opts.features.join(',')}`,
  },

  // Native
  {
    id: 'native',
    label: 'Native (current platform)',
    description: 'Build for your current platform',
    buildCommand: (opts) =>
      `cargo build ${opts.mode === 'release' ? '--release' : ''} --features ${opts.features.join(',')} --workspace`,
  },
];

const FEATURE_OPTIONS = [
  { value: 'ffi', label: 'FFI', description: 'C Foreign Function Interface' },
  { value: 'qlog', label: 'QLOG', description: 'QUIC logging support' },
  { value: 'sfv', label: 'SFV', description: 'Structured Field Values' },
];

function checkPrerequisites(): { hasCross: boolean; hasDocker: boolean } {
  let hasCross = false;
  let hasDocker = false;

  try {
    execSync('cross --version', { stdio: 'ignore' });
    hasCross = true;
  } catch {
    // cross not installed
  }

  try {
    execSync('docker info', { stdio: 'ignore' });
    hasDocker = true;
  } catch {
    // docker not available
  }

  return { hasCross, hasDocker };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

async function buildPlatform(platform: Platform, options: BuildOptions): Promise<BuildResult> {
  const startTime = Date.now();
  const command = platform.buildCommand(options);

  if (options.verbose) {
    log.info(gray(`$ ${command}`));
  }

  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
      stdio: options.verbose ? 'inherit' : 'pipe',
      shell: true,
    });

    let output = '';
    let errorOutput = '';

    if (!options.verbose) {
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });
    }

    child.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        const outputPath = platform.target
          ? `target/${platform.target}/${options.mode}/`
          : `target/${options.mode}/`;

        resolve({
          platform,
          success: true,
          duration,
          outputPath,
        });
      } else {
        resolve({
          platform,
          success: false,
          duration,
          error: errorOutput || output || `Build failed with exit code ${code}`,
        });
      }
    });

    child.on('error', (error) => {
      resolve({
        platform,
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
      });
    });
  });
}

async function main() {
  console.clear();

  intro(cyan(bold('🥧 quiche-nwep Cross-Platform Builder')));

  // Check prerequisites
  const { hasCross, hasDocker } = checkPrerequisites();

  if (!hasCross || !hasDocker) {
    const missingTools = [];
    if (!hasCross) missingTools.push('cross-rs');
    if (!hasDocker) missingTools.push('Docker');

    note(
      yellow(
        `Missing tools: ${missingTools.join(', ')}\n\n` +
        `${!hasCross ? '• Install cross-rs: cargo install cross --git https://github.com/cross-rs/cross\n' : ''}` +
        `${!hasDocker ? '• Install Docker: https://docs.docker.com/get-docker/\n' : ''}` +
        '\nSome build targets will be unavailable.'
      ),
      'Prerequisites Check'
    );
  }

  // Filter platforms based on available tools
  const availablePlatforms = PLATFORMS.filter(p => {
    if (p.requiresCross && !hasCross) return false;
    if (p.requiresDocker && !hasDocker) return false;
    return true;
  });

  if (availablePlatforms.length === 0) {
    cancel('No build targets available. Please install cross-rs and/or Docker.');
    process.exit(1);
  }

  // Select platforms
  const selectedPlatformIds = await multiselect({
    message: 'Select platforms to build:',
    options: availablePlatforms.map(p => ({
      value: p.id,
      label: p.label,
      hint: p.description,
    })),
    required: true,
  });

  if (isCancel(selectedPlatformIds)) {
    cancel('Build cancelled.');
    process.exit(0);
  }

  const selectedPlatforms = availablePlatforms.filter(p =>
    (selectedPlatformIds as string[]).includes(p.id)
  );

  // Select build mode
  const buildMode = await select({
    message: 'Select build mode:',
    options: [
      { value: 'release', label: 'Release', hint: 'Optimized build' },
      { value: 'debug', label: 'Debug', hint: 'Faster compile, includes debug symbols' },
    ],
  });

  if (isCancel(buildMode)) {
    cancel('Build cancelled.');
    process.exit(0);
  }

  // Select features
  const features = await multiselect({
    message: 'Select features to enable:',
    options: FEATURE_OPTIONS.map(f => ({
      value: f.value,
      label: f.label,
      hint: f.description,
    })),
    initialValues: ['ffi'],
  });

  if (isCancel(features)) {
    cancel('Build cancelled.');
    process.exit(0);
  }

  // Ask about parallel builds
  const parallel = await confirm({
    message: 'Build platforms in parallel?',
    initialValue: false,
  });

  if (isCancel(parallel)) {
    cancel('Build cancelled.');
    process.exit(0);
  }

  // Ask about verbose logging
  const verbose = await confirm({
    message: 'Show detailed build output?',
    initialValue: true,
  });

  if (isCancel(verbose)) {
    cancel('Build cancelled.');
    process.exit(0);
  }

  // Build summary
  note(
    `${bold('Platforms:')} ${selectedPlatforms.map(p => p.label).join(', ')}\n` +
    `${bold('Build mode:')} ${buildMode}\n` +
    `${bold('Features:')} ${(features as string[]).join(', ') || 'none'}\n` +
    `${bold('Parallel:')} ${parallel ? 'yes' : 'no'}\n` +
    `${bold('Verbose:')} ${verbose ? 'yes' : 'no'}`,
    'Build Configuration'
  );

  const shouldContinue = await confirm({
    message: 'Start build?',
    initialValue: true,
  });

  if (isCancel(shouldContinue) || !shouldContinue) {
    cancel('Build cancelled.');
    process.exit(0);
  }

  // Start building
  const buildOptions: BuildOptions = {
    mode: buildMode as 'debug' | 'release',
    features: features as string[],
    parallel: parallel as boolean,
    verbose: verbose as boolean,
  };

  const results: BuildResult[] = [];
  const totalStartTime = Date.now();

  if (buildOptions.parallel) {
    // Parallel builds
    if (!buildOptions.verbose) {
      const s = spinner();
      s.start('Building all platforms in parallel...');

      const buildPromises = selectedPlatforms.map(platform =>
        buildPlatform(platform, buildOptions)
      );

      const parallelResults = await Promise.all(buildPromises);
      results.push(...parallelResults);

      s.stop('All builds completed');
    } else {
      log.info(cyan('Building all platforms in parallel (verbose mode)...\n'));

      const buildPromises = selectedPlatforms.map(async (platform, index) => {
        log.step(bold(`[${index + 1}/${selectedPlatforms.length}] ${platform.label}`));
        return buildPlatform(platform, buildOptions);
      });

      const parallelResults = await Promise.all(buildPromises);
      results.push(...parallelResults);

      log.success('All builds completed\n');
    }
  } else {
    // Sequential builds
    for (let i = 0; i < selectedPlatforms.length; i++) {
      const platform = selectedPlatforms[i];

      if (!buildOptions.verbose) {
        const s = spinner();
        s.start(`[${i + 1}/${selectedPlatforms.length}] Building ${platform.label}...`);

        const result = await buildPlatform(platform, buildOptions);
        results.push(result);

        if (result.success) {
          s.stop(green(`✓ ${platform.label} built successfully in ${formatDuration(result.duration)}`));
        } else {
          s.stop(red(`✗ ${platform.label} failed after ${formatDuration(result.duration)}`));
        }
      } else {
        log.step(bold(`[${i + 1}/${selectedPlatforms.length}] Building ${platform.label}...`));
        console.log(''); // Add spacing

        const result = await buildPlatform(platform, buildOptions);
        results.push(result);

        if (result.success) {
          log.success(green(`✓ ${platform.label} built successfully in ${formatDuration(result.duration)}\n`));
        } else {
          log.error(red(`✗ ${platform.label} failed after ${formatDuration(result.duration)}\n`));
        }
      }
    }
  }

  // Summary
  const totalDuration = Date.now() - totalStartTime;
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('');

  if (successful.length > 0) {
    note(
      successful.map(r =>
        `${green('✓')} ${bold(r.platform.label)}\n` +
        `  ${dim('Time:')} ${formatDuration(r.duration)}\n` +
        `  ${dim('Output:')} ${r.outputPath || 'N/A'}`
      ).join('\n\n'),
      green('Successful Builds')
    );
  }

  if (failed.length > 0) {
    note(
      failed.map(r =>
        `${red('✗')} ${bold(r.platform.label)}\n` +
        `  ${dim('Time:')} ${formatDuration(r.duration)}\n` +
        `  ${dim('Error:')} ${r.error?.split('\n')[0] || 'Unknown error'}`
      ).join('\n\n'),
      red('Failed Builds')
    );
  }

  const statusIcon = failed.length === 0 ? '🎉' : failed.length === results.length ? '❌' : '⚠️';
  const statusColor = failed.length === 0 ? green : failed.length === results.length ? red : yellow;

  outro(
    statusColor(
      bold(
        `${statusIcon} Build complete: ${successful.length} succeeded, ${failed.length} failed (${formatDuration(totalDuration)})`
      )
    )
  );

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(red('Fatal error:'), error);
  process.exit(1);
});
