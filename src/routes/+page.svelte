<script lang="ts">
  import { resolve } from '$app/paths';
  import {
    ArrowRight,
    Bold,
    Braces,
    Check,
    Cloud,
    Code2,
    Fingerprint,
    Heading1,
    Image,
    Italic,
    KeyRound,
    ListChecks,
    LockKeyhole,
    Paperclip,
    ShieldCheck,
    Star
  } from '@lucide/svelte';
  import GitHubIcon from '$lib/components/GitHubIcon.svelte';
  import LandingNoteDemo from '$lib/components/LandingNoteDemo.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let appHref = $derived(data.user ? resolve('/app') : resolve('/login'));
  let appLabel = $derived(data.user ? 'Open Fresh' : 'Start writing');
</script>

<svelte:head>
  <title>Fresh | A clear place for every note</title>
  <meta
    name="description"
    content="A private, cheerful notebook for Markdown, media, living task lists, passkeys, and encrypted backups."
  />
</svelte:head>

<div class="landing-page">
  <header class="landing-nav-shell">
    <nav class="landing-nav" aria-label="Main navigation">
      <a class="landing-brand" href={resolve('/')} aria-label="Fresh home">
        <span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span>
        <strong>Fresh</strong>
      </a>

      <div class="landing-nav-links">
        <a href="#features">Features</a>
        <a href="#security">Security</a>
        <a class="landing-nav-action" href={appHref}>
          <span>{data.user ? 'Open app' : 'Sign in'}</span>
          <ArrowRight size={15} />
        </a>
      </div>
    </nav>
  </header>

  <main>
    <section class="landing-hero" aria-labelledby="landing-title">
      <div class="hero-canvas" aria-hidden="true">
        <div class="hero-toolbar">
          <span><Bold size={15} /></span>
          <span><Italic size={15} /></span>
          <span><Heading1 size={15} /></span>
          <span><ListChecks size={15} /></span>
          <span><Braces size={15} /></span>
          <span><Paperclip size={15} /></span>
          <div class="hero-mode"><span>Write</span><span>Preview</span></div>
        </div>
        <div class="hero-writing-line"></div>
        <div class="hero-writing-line short"></div>
      </div>

      <aside class="hero-rail" aria-hidden="true">
        <div class="hero-rail-brand">
          <span class="brand-mark"><img src="/favicon-256x256.png" alt="" /></span>
          <strong>Fresh</strong>
        </div>
        <div class="hero-rail-item active"><Code2 size={16} /><span>All notes</span></div>
        <div class="hero-rail-item"><Star size={16} /><span>Favorites</span></div>
        <small>Tags</small>
        <div class="hero-rail-tag"><i></i><span>ideas</span><b>8</b></div>
        <div class="hero-rail-tag"><i></i><span>weekend</span><b>3</b></div>
        <div class="hero-rail-user">
          <span>F</span>
          <div><strong>Fresh writer</strong><small>private notebook</small></div>
        </div>
      </aside>

      <div class="hero-copy">
        <span class="hero-kicker"><ShieldCheck size={15} /> Private by design</span>
        <h1 id="landing-title">Fresh</h1>
        <p>A clear, cheerful notebook where Markdown becomes tidy notes, living checklists, and a home for every file worth keeping.</p>
        <div class="hero-actions">
          <a class="landing-primary" href={appHref}>{appLabel}<ArrowRight size={17} /></a>
          <a class="landing-secondary" href="#features">See what fits inside</a>
        </div>
        <div class="hero-trust" aria-label="Fresh capabilities">
          <span><Fingerprint size={15} /> Passkeys</span>
          <span><LockKeyhole size={15} /> Encrypted backup</span>
          <span><Cloud size={15} /> Your private cloud</span>
        </div>
      </div>

      <div class="hero-notes" aria-hidden="true">
        <article class="hero-note hero-note-main">
          <header>
            <span class="hero-note-accent"></span>
            <div><strong>Slow Sunday</strong><small>Updated today</small></div>
            <Star size={15} fill="currentColor" />
          </header>
          <div class="hero-note-body">
            <p>A little room for the things that make the week feel lighter.</p>
            <div class="fake-task"><span class="fake-check checked"><Check size={11} /></span> Pick up fresh flowers</div>
            <div class="fake-task"><span class="fake-check"></span> Finish the window-seat chapter</div>
            <div class="fake-task"><span class="fake-check"></span> Make lemon pasta</div>
          </div>
          <footer><span>#weekend</span><span>#soft-plans</span></footer>
        </article>

        <article class="hero-note hero-note-side">
          <header>
            <span class="hero-note-accent coral"></span>
            <div><strong>Small ideas</strong><small>Yesterday</small></div>
          </header>
          <div class="hero-note-body">
            <code>const room = 'for wonder';</code>
            <div class="hero-image-placeholder"><Image size={18} /><span>cover-study.png</span></div>
          </div>
          <footer><span>#ideas</span></footer>
        </article>
      </div>
    </section>

    <section id="features" class="landing-feature-band" aria-labelledby="features-title">
      <div class="landing-section-inner">
        <div class="section-heading">
          <span>Everything in its place</span>
          <h2 id="features-title">Write once. Keep it alive.</h2>
          <p>Fresh keeps the structure of Markdown while giving every note the polish of a finished page.</p>
        </div>

        <div class="feature-grid">
          <article>
            <span class="feature-icon blue"><Heading1 size={19} /></span>
            <h3>Your first H1 is the title</h3>
            <p>No separate title field. Start writing naturally and Fresh keeps the notebook organized for you.</p>
          </article>
          <article>
            <span class="feature-icon green"><ListChecks size={19} /></span>
            <h3>Checklists stay live</h3>
            <p>Tick a task in the finished note and the saved Markdown updates with it, including nested lists.</p>
          </article>
          <article>
            <span class="feature-icon coral"><Paperclip size={19} /></span>
            <h3>Files belong with the thought</h3>
            <p>Keep images, audio, video, PDFs, documents, and archives beside the note that gives them context.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="landing-workflow" aria-labelledby="workflow-title">
      <div class="landing-section-inner workflow-layout">
        <div class="workflow-copy">
          <span>Markdown, softened</span>
          <h2 id="workflow-title">The speed of plain text, with a calmer finish.</h2>
          <p>Write with familiar Markdown, preview rich typography, math, code, alerts, tags, and tables, then return to the source whenever you need it.</p>
          <ul>
            <li><Check size={15} /> KaTeX math and focused syntax highlighting</li>
            <li><Check size={15} /> Fast filters for favorites, tags, and loaded notes</li>
            <li><Check size={15} /> Responsive from a wide desk to a small phone</li>
          </ul>
        </div>

        <LandingNoteDemo initialNote={data.landingDemoNote} />
      </div>
    </section>

    <section id="security" class="landing-security" aria-labelledby="security-title">
      <div class="landing-section-inner security-layout">
        <div class="security-copy">
          <span>Quiet security</span>
          <h2 id="security-title">Your notes open for you, not a password.</h2>
          <p>Sign in with a passkey protected by your device, then keep a password-encrypted Fresh backup wherever you trust.</p>
          <div class="security-points">
            <div><Fingerprint size={18} /><span><strong>Passkey sign-in</strong><small>Face ID, Touch ID, Windows Hello, or a security key</small></span></div>
            <div><LockKeyhole size={18} /><span><strong>AES-256-GCM backups</strong><small>Encryption happens in your browser before download</small></span></div>
            <div><ShieldCheck size={18} /><span><strong>Private attachments</strong><small>Every file request is checked against your account</small></span></div>
          </div>
        </div>

        <div class="security-tool" aria-label="Passkey management preview">
          <header><span><Fingerprint size={18} /> Passkeys</span><small>2 registered</small></header>
          <div class="security-passkey active">
            <span><KeyRound size={17} /></span>
            <div><strong>MacBook Touch ID</strong><small>Synced passkey - Added today</small></div>
            <i><Check size={13} /></i>
          </div>
          <div class="security-passkey">
            <span><KeyRound size={17} /></span>
            <div><strong>Travel security key</strong><small>Device passkey - Added Jul 12</small></div>
            <i><Check size={13} /></i>
          </div>
          <div class="security-backup">
            <span><LockKeyhole size={17} /></span>
            <div><strong>fresh-2026-07-18.freshup</strong><small>Encrypted backup ready</small></div>
          </div>
        </div>
      </div>
    </section>

    <section class="landing-closing" aria-labelledby="closing-title">
      <div class="landing-section-inner closing-inner">
        <div>
          <span>A little room to think</span>
          <h2 id="closing-title">Make something fresh.</h2>
        </div>
        <a class="landing-primary" href={appHref}>{appLabel}<ArrowRight size={17} /></a>
      </div>
    </section>
  </main>

  <footer class="landing-footer">
    <div class="landing-section-inner">
      <a class="landing-brand" href={resolve('/')} aria-label="Fresh home">
        <span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span>
        <strong>Fresh</strong>
      </a>
      <p>Markdown, media, and private backups in one clear notebook.</p>
      <a href="https://github.com/alkinum/fresh" target="_blank" rel="noreferrer"><GitHubIcon size={15} /> Apache-2.0</a>
    </div>
  </footer>
</div>

<style>
  .landing-page {
    min-height: 100dvh;
    overflow: hidden;
    color: var(--text);
    background: var(--bg);
  }

  .landing-nav-shell {
    position: relative;
    z-index: 20;
    border-bottom: 1px solid var(--border-soft);
    background: var(--glass-panel-strong);
    backdrop-filter: blur(18px) saturate(135%);
  }

  .landing-nav,
  .landing-section-inner {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
  }

  .landing-nav {
    min-height: 72px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .landing-brand {
    display: inline-flex;
    align-items: center;
    gap: 11px;
    color: var(--text);
    text-decoration: none;
  }

  .landing-brand strong {
    font-size: 16px;
  }

  .landing-nav-links {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .landing-nav-links > a:not(.landing-nav-action) {
    color: var(--muted);
    font-size: 13px;
    font-weight: 650;
    text-decoration: none;
  }

  .landing-nav-links > a:not(.landing-nav-action):hover {
    color: var(--text);
  }

  .landing-nav-action,
  .landing-primary,
  .landing-secondary {
    min-height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: var(--radius-control);
    font-size: 13px;
    font-weight: 720;
    text-decoration: none;
    transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }

  .landing-nav-action {
    padding: 8px 13px;
    color: var(--primary-on);
    background: var(--primary);
    box-shadow: 0 8px 20px var(--primary-ring);
  }

  .landing-hero {
    position: relative;
    min-height: clamp(540px, calc(100svh - 220px), 790px);
    overflow: hidden;
    border-bottom: 1px solid var(--border-soft);
    background: var(--workspace-start);
  }

  .hero-canvas {
    position: absolute;
    inset: 28px -60px 28px max(270px, calc((100vw - 1180px) / 2 + 248px));
    overflow: hidden;
    border-radius: 24px 0 0 24px;
    background: var(--surface-editor);
    box-shadow: var(--shadow-lg);
  }

  .hero-toolbar {
    min-height: 50px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 8px 14px;
    background: var(--surface-toolbar);
  }

  .hero-toolbar > span {
    width: 31px;
    height: 31px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-icon);
    color: var(--muted);
  }

  .hero-toolbar > span:last-of-type {
    color: var(--primary-hover);
    background: var(--primary-soft);
  }

  .hero-mode {
    margin-left: auto;
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-control);
    background: var(--surface-subtle);
    color: var(--muted);
    font-size: 10px;
  }

  .hero-mode span {
    padding: 6px 9px;
    border-radius: var(--radius-icon);
  }

  .hero-mode span:first-child {
    color: var(--text);
    background: var(--surface-raised);
    box-shadow: var(--shadow-sm);
  }

  .hero-writing-line {
    width: 34%;
    height: 8px;
    margin: 84px 0 0 70px;
    border-radius: 5px;
    background: var(--surface-subtle);
  }

  .hero-writing-line.short {
    width: 23%;
    margin-top: 14px;
  }

  .hero-rail {
    position: absolute;
    inset: 18px auto 18px max(20px, calc((100vw - 1180px) / 2));
    z-index: 4;
    width: 238px;
    display: flex;
    flex-direction: column;
    padding: 16px 12px 12px;
    border-radius: var(--radius-shell);
    background: var(--sidebar);
    box-shadow: var(--shadow);
  }

  .hero-rail-brand {
    min-height: 50px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 8px 12px;
  }

  .hero-rail-brand .brand-mark {
    width: 32px;
    height: 32px;
  }

  .hero-rail-item,
  .hero-rail-tag {
    min-height: 39px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: var(--radius-control);
    color: var(--muted);
    font-size: 12px;
  }

  .hero-rail-item.active {
    color: var(--primary-hover);
    border: 1px solid var(--nav-active-border);
    background: var(--nav-active-bg);
    box-shadow: inset 0 1px 0 var(--glass-highlight), 0 8px 20px var(--nav-active-shadow);
  }

  .hero-rail > small {
    margin: 22px 10px 7px;
    color: var(--faint);
    font-size: 9px;
    font-weight: 750;
    text-transform: uppercase;
  }

  .hero-rail-tag i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #79a9f3;
  }

  .hero-rail-tag:nth-of-type(4) i {
    background: #67be9a;
  }

  .hero-rail-tag span {
    flex: 1;
  }

  .hero-rail-tag b {
    color: var(--faint);
    font-size: 10px;
  }

  .hero-rail-user {
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 9px;
    margin-top: auto;
    padding: 8px;
    border-radius: var(--radius-control);
    background: var(--glass-control);
    box-shadow: inset 0 1px 0 var(--glass-highlight), var(--shadow-sm);
  }

  .hero-rail-user > span {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-icon);
    color: var(--primary-on);
    background: var(--primary);
    font-size: 11px;
    font-weight: 750;
  }

  .hero-rail-user div {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .hero-rail-user strong {
    font-size: 10px;
  }

  .hero-rail-user small {
    color: var(--faint);
    font-size: 8px;
  }

  .hero-copy {
    position: relative;
    z-index: 5;
    width: min(540px, calc(100% - 340px));
    margin-left: max(330px, calc((100vw - 1180px) / 2 + 310px));
    padding-top: clamp(86px, 13vh, 138px);
  }

  .hero-kicker,
  .section-heading > span,
  .workflow-copy > span,
  .security-copy > span,
  .closing-inner > div > span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--primary-hover);
    font-size: 11px;
    font-weight: 750;
    text-transform: uppercase;
  }

  .hero-copy h1 {
    margin: 17px 0 10px;
    color: var(--text);
    font-size: clamp(58px, 7vw, 92px);
    font-weight: 760;
    line-height: 0.92;
  }

  .hero-copy > p {
    max-width: 520px;
    margin: 0;
    color: var(--text-body);
    font-size: clamp(16px, 1.55vw, 20px);
    line-height: 1.58;
  }

  .hero-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 25px;
  }

  .landing-primary {
    min-height: 44px;
    padding: 10px 16px;
    color: var(--primary-on);
    background: var(--primary);
    box-shadow: 0 12px 28px var(--primary-ring);
  }

  .landing-primary:hover,
  .landing-nav-action:hover {
    transform: translateY(-1px);
    background: var(--primary-hover);
    box-shadow: 0 16px 34px var(--primary-ring);
  }

  .landing-secondary {
    min-height: 44px;
    padding: 10px 14px;
    color: var(--muted);
  }

  .landing-secondary:hover {
    color: var(--text);
    background: var(--surface-hover);
  }

  .hero-trust {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    margin-top: 21px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 650;
  }

  .hero-trust span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .hero-trust :global(svg) {
    color: var(--primary-hover);
  }

  .hero-notes {
    position: absolute;
    right: max(20px, calc((100vw - 1180px) / 2));
    bottom: 44px;
    z-index: 6;
    width: min(550px, 45vw);
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(190px, 0.75fr);
    align-items: end;
    gap: 12px;
  }

  .hero-note {
    overflow: hidden;
    border-radius: var(--radius-panel);
    background: var(--surface);
    box-shadow: inset 0 1px 0 var(--glass-highlight), var(--shadow);
  }

  .hero-note > header {
    min-height: 55px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 12px;
  }

  .hero-note > header > div {
    min-width: 0;
    flex: 1;
    display: grid;
    gap: 2px;
  }

  .hero-note > header strong {
    font-size: 12px;
  }

  .hero-note > header small {
    color: var(--faint);
    font-size: 8px;
  }

  .hero-note > header > :global(svg) {
    color: #f7c94e;
  }

  .hero-note-accent {
    width: 4px;
    height: 32px;
    border-radius: 3px;
    background: #67be9a;
  }

  .hero-note-accent.coral {
    background: #ee7e88;
  }

  .hero-note-body {
    padding: 0 14px 12px;
    color: var(--text-body);
    font-size: 10px;
    line-height: 1.55;
  }

  .hero-note-body p {
    margin: 0 0 10px;
  }

  .fake-task {
    min-height: 24px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .fake-check {
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--task-border);
    border-radius: 5px;
    background: var(--task-bg);
  }

  .fake-check.checked {
    border-color: var(--primary);
    color: var(--primary-on);
    background: var(--primary);
  }

  .hero-note footer {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 9px 13px 11px;
  }

  .hero-note footer span {
    padding: 3px 7px;
    border-radius: 999px;
    color: var(--primary-hover);
    background: var(--primary-soft);
    font-size: 8px;
  }

  .hero-note-side {
    transform: translateY(18px);
  }

  .hero-note-side code {
    display: block;
    padding: 8px;
    border-radius: var(--radius-icon);
    color: var(--code-text);
    background: var(--code-bg);
    font-size: 8px;
  }

  .hero-image-placeholder {
    min-height: 58px;
    display: grid;
    place-items: center;
    gap: 3px;
    margin-top: 8px;
    border-radius: var(--radius-icon);
    color: var(--muted);
    background: var(--surface-media);
    font-size: 8px;
  }

  .landing-feature-band,
  .landing-security {
    border-bottom: 1px solid var(--border-soft);
    background: var(--surface);
  }

  .landing-feature-band,
  .landing-workflow,
  .landing-security {
    padding: 92px 0;
  }

  .section-heading {
    max-width: 650px;
  }

  .section-heading h2,
  .workflow-copy h2,
  .security-copy h2,
  .closing-inner h2 {
    margin: 12px 0 10px;
    font-size: clamp(30px, 4vw, 48px);
    line-height: 1.08;
  }

  .section-heading p,
  .workflow-copy > p,
  .security-copy > p {
    margin: 0;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.7;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 42px;
    margin-top: 55px;
  }

  .feature-grid article {
    min-width: 0;
  }

  .feature-icon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-control);
  }

  .feature-icon.blue {
    color: var(--primary-hover);
    background: var(--primary-soft);
  }

  .feature-icon.green {
    color: var(--success);
    background: var(--success-soft);
  }

  .feature-icon.coral {
    color: var(--danger);
    background: var(--danger-soft);
  }

  .feature-grid h3 {
    margin: 17px 0 8px;
    font-size: 16px;
  }

  .feature-grid p {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.7;
  }

  .landing-workflow {
    border-bottom: 1px solid var(--border-soft);
    background: var(--workspace-start);
  }

  .workflow-layout,
  .security-layout {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(520px, 1.2fr);
    align-items: center;
    gap: 70px;
  }

  .workflow-copy ul {
    display: grid;
    gap: 12px;
    margin: 25px 0 0;
    padding: 0;
    color: var(--text-body);
    font-size: 12px;
    list-style: none;
  }

  .workflow-copy li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .workflow-copy li :global(svg) {
    color: var(--success);
  }

  .security-tool {
    overflow: hidden;
    border-radius: var(--radius-dialog);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
  }

  .security-tool > header {
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    background: var(--surface-toolbar);
  }

  .security-tool > header > span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 720;
  }

  .security-layout {
    grid-template-columns: minmax(0, 1fr) minmax(420px, 0.85fr);
  }

  .security-points {
    display: grid;
    gap: 18px;
    margin-top: 28px;
  }

  .security-points > div {
    display: flex;
    align-items: flex-start;
    gap: 11px;
  }

  .security-points > div > :global(svg) {
    flex: 0 0 auto;
    margin-top: 2px;
    color: var(--primary-hover);
  }

  .security-points span {
    display: grid;
    gap: 3px;
  }

  .security-points strong {
    font-size: 13px;
  }

  .security-points small {
    color: var(--muted);
    font-size: 11px;
    line-height: 1.5;
  }

  .security-tool {
    padding-bottom: 12px;
  }

  .security-tool > header small {
    color: var(--faint);
    font-size: 10px;
  }

  .security-passkey,
  .security-backup {
    min-height: 66px;
    display: flex;
    align-items: center;
    gap: 11px;
    margin: 10px 12px 0;
    padding: 10px 11px;
    border-radius: var(--radius-control);
    background: var(--surface-raised);
  }

  .security-passkey.active {
    border: 1px solid var(--nav-active-border);
    background: var(--nav-active-bg);
    box-shadow: inset 0 1px 0 var(--glass-highlight), var(--shadow-sm);
  }

  .security-passkey > span,
  .security-backup > span {
    width: 36px;
    height: 36px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border-radius: var(--radius-control);
    color: var(--primary-hover);
    background: var(--primary-soft);
  }

  .security-passkey > div,
  .security-backup > div {
    min-width: 0;
    flex: 1;
    display: grid;
    gap: 3px;
  }

  .security-passkey strong,
  .security-backup strong {
    overflow: hidden;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .security-passkey small,
  .security-backup small {
    color: var(--muted);
    font-size: 9px;
  }

  .security-passkey i {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--success-text);
    background: var(--success-soft);
  }

  .security-backup {
    border-top: 1px solid var(--border-soft);
    background: transparent;
  }

  .landing-closing {
    padding: 72px 0;
    background: var(--workspace-start);
  }

  .closing-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 28px;
  }

  .closing-inner h2 {
    margin-bottom: 0;
  }

  .landing-footer {
    border-top: 1px solid var(--border-soft);
    background: var(--sidebar);
  }

  .landing-footer .landing-section-inner {
    min-height: 92px;
    display: flex;
    align-items: center;
    gap: 26px;
  }

  .landing-footer .brand-mark {
    width: 30px;
    height: 30px;
  }

  .landing-footer p {
    flex: 1;
    color: var(--muted);
    font-size: 11px;
  }

  .landing-footer > div > a:last-child {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    text-decoration: none;
  }

  @media (max-width: 980px) {
    .hero-copy {
      width: min(520px, calc(100% - 300px));
      margin-left: 292px;
    }

    .hero-notes {
      width: 48vw;
      grid-template-columns: 1fr;
    }

    .hero-note-side {
      display: none;
    }

    .workflow-layout,
    .security-layout {
      grid-template-columns: 1fr;
      gap: 46px;
    }

    .workflow-copy,
    .security-copy {
      max-width: 680px;
    }
  }

  @media (max-width: 780px) {
    .landing-nav,
    .landing-section-inner {
      width: min(100% - 24px, 680px);
    }

    .landing-nav {
      min-height: 62px;
    }

    .landing-nav-links {
      gap: 8px;
    }

    .landing-nav-links > a:not(.landing-nav-action) {
      display: none;
    }

    .landing-hero {
      min-height: clamp(500px, calc(100svh - 170px), 650px);
    }

    .hero-rail {
      display: none;
    }

    .hero-canvas {
      inset: 330px -90px 18px 12px;
      border-radius: var(--radius-shell) 0 0 var(--radius-shell);
    }

    .hero-toolbar {
      padding-left: 12px;
    }

    .hero-toolbar > span:nth-child(n + 5) {
      display: none;
    }

    .hero-mode {
      margin-right: 72px;
    }

    .hero-writing-line {
      display: none;
    }

    .hero-copy {
      width: calc(100% - 40px);
      margin-left: 20px;
      padding-top: 35px;
    }

    .hero-copy h1 {
      margin-top: 12px;
      font-size: clamp(50px, 18vw, 72px);
    }

    .hero-copy > p {
      max-width: 530px;
      font-size: 15px;
      line-height: 1.48;
    }

    .hero-actions {
      margin-top: 18px;
    }

    .hero-trust {
      display: none;
    }

    .hero-notes {
      right: 12px;
      bottom: 27px;
      width: min(330px, calc(100% - 42px));
      grid-template-columns: 1fr;
    }

    .hero-note-main {
      transform: rotate(-1.2deg);
    }

    .hero-note-body p {
      display: none;
    }

    .hero-note-body .fake-task {
      min-height: 22px;
    }

    .landing-feature-band,
    .landing-workflow,
    .landing-security {
      padding: 66px 0;
    }

    .feature-grid {
      grid-template-columns: 1fr;
      gap: 34px;
      margin-top: 40px;
    }

    .feature-grid article {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      column-gap: 14px;
    }

    .feature-grid h3 {
      margin: 2px 0 6px;
    }

    .feature-grid p {
      grid-column: 2;
    }

    .landing-closing {
      padding: 56px 0;
    }

    .closing-inner {
      align-items: flex-start;
      flex-direction: column;
    }

    .landing-footer .landing-section-inner {
      min-height: 118px;
      flex-wrap: wrap;
      gap: 12px 20px;
      padding-block: 18px;
    }

    .landing-footer p {
      flex-basis: 100%;
      order: 3;
      margin: 0;
    }

    .landing-footer > div > a:last-child {
      margin-left: auto;
    }
  }

  @media (max-width: 430px) {
    .landing-nav-action span {
      display: none;
    }

    .landing-nav-action {
      width: 38px;
      padding: 0;
    }

    .hero-copy {
      width: calc(100% - 28px);
      margin-left: 14px;
      padding-top: 26px;
    }

    .hero-copy > p {
      max-width: 350px;
      font-size: 14px;
    }

    .hero-actions {
      gap: 5px;
    }

    .landing-primary,
    .landing-secondary {
      padding-inline: 12px;
      font-size: 12px;
    }

    .hero-notes {
      right: 8px;
      bottom: 18px;
      width: calc(100% - 34px);
    }

    .hero-note > header {
      min-height: 48px;
      padding-block: 8px;
    }

    .hero-note-body {
      padding-bottom: 7px;
    }

    .hero-note footer {
      padding-block: 6px 9px;
    }

    .security-tool {
      margin-inline: -2px;
    }

    .security-passkey,
    .security-backup {
      margin-inline: 8px;
    }
  }

  @media (prefers-reduced-transparency: reduce) {
    .landing-nav-shell {
      background: var(--surface);
      backdrop-filter: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-note-main {
      transform: none;
    }
  }
</style>
