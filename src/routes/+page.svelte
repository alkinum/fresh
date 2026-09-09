<script lang="ts">
  import { resolve } from '$app/paths';
  import {
    ArrowDown,
    ArrowRight,
    Check,
    FileText,
    Fingerprint,
    Heart,
    Image,
    LayoutDashboard,
    LockKeyhole,
    Paperclip,
    PenLine,
    Sparkles,
    Star
  } from '@lucide/svelte';
  import GitHubIcon from '$lib/components/GitHubIcon.svelte';
  import LandingNoteDemo from '$lib/components/LandingNoteDemo.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let appHref = $derived(data.user ? resolve('/app') : resolve('/login'));
  let appLabel = $derived(data.user ? 'Open your notebook' : 'Make yourself at home');
</script>

<svelte:head>
  <title>Fresh | Notes, lists &amp; little plans</title>
  <meta
    name="description"
    content="A cheerful private notebook for Markdown notes, little plans, Kanban boards, and the files that belong with them. Try the editor right here."
  />
</svelte:head>

<div class="landing-page">
  <a class="skip-link" href="#landing-main">Skip to content</a>
  <header class="site-header page-width">
    <a class="wordmark" href={resolve('/')} aria-label="Fresh home"
      ><span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span><strong>Fresh</strong
      ></a
    >
    <nav aria-label="Main navigation">
      <a class="text-link" href="#inside">A look inside</a><a class="text-link" href="#playground">Try it out</a><a
        class="header-action"
        href={appHref}>{data.user ? 'Open app' : 'Sign in'}<ArrowRight size={16} /></a
      >
    </nav>
  </header>
  <main id="landing-main">
    <section class="hero page-width" aria-labelledby="landing-title">
      <div class="hero-copy">
        <span class="little-label"><span class="status-dot"></span>Your own happy corner of the internet</span>
        <h1 id="landing-title">
          Fresh<span class="title-spark" aria-hidden="true"><Sparkles size={35} strokeWidth={1.6} /></span>
        </h1>
        <h2>Notes, lists<br />&amp; little plans.</h2>
        <p>
          Catch a thought. Make a list. Keep a little something for later. A private notebook that makes the everyday
          feel a bit more you.
        </p>
        <div class="hero-actions">
          <a class="clay-button" href={appHref}>{appLabel}<ArrowRight size={17} /></a><a
            class="try-link"
            href="#playground">Take it for a scribble <ArrowDown size={15} /></a
          >
        </div>
        <span class="hero-footnote"><LockKeyhole size={13} /> Just for you. No public feed.</span>
      </div>
      <div class="desk-scene" aria-hidden="true">
        <div class="notebook-spine"></div>
        <div class="desk-caption"><span></span> A little peek at your notebook</div>
        <article class="paper-note">
          <div class="paper-top">
            <span><FileText size={14} /> PERSONAL NOTE</span><Star size={17} fill="currentColor" />
          </div>
          <h3>A nice little Saturday</h3>
          <p>Less rushing.<br />More of the good stuff.</p>
          <div class="paper-rule"></div>
          <div class="paper-task done"><span><Check size={12} /></span> Coffee, just the way I like it</div>
          <div class="paper-task"><span></span> A walk with no particular plan</div>
          <div class="paper-task"><span></span> Finally start that little project</div>
          <div class="paper-tags"><span>#weekend</span><span>#small-joys</span></div>
        </article>
        <div class="mascot-sticker">
          <img src="/icon-512x512.png" alt="" width="132" height="132" /><span>Hello, you!</span>
        </div>
        <article class="file-note">
          <span class="file-picture"><Image size={27} strokeWidth={1.5} /></span>
          <div><strong>A little inspiration</strong><span>keep-this-one.png</span></div>
          <Paperclip size={16} />
        </article>
        <article class="board-note">
          <header><LayoutDashboard size={15} /><strong>One thing at a time</strong><span>•••</span></header>
          <div class="tiny-board">
            <div><small><i></i> To do</small><span>A new idea</span><span>Make a start</span></div>
            <div><small><i></i> Doing</small><span>Something good</span></div>
            <div><small><i></i> Done</small><span><Check size={11} /> First step!</span></div>
          </div>
        </article>
        <div class="private-sticker"><Heart size={14} fill="currentColor" /> A space of your own</div>
      </div>
    </section>

    <section id="inside" class="inside-band" aria-labelledby="inside-title">
      <div class="page-width">
        <div class="section-intro">
          <span class="little-label">Small details. Thoughtfully kept.</span>
          <h2 id="inside-title">Everything you want to keep close.</h2>
        </div>
        <div class="feature-list">
          <article>
            <span class="feature-symbol blue"><PenLine size={25} strokeWidth={1.7} /></span>
            <div>
              <h3>A note that feels like you</h3>
              <p>
                Write in Markdown. Add a #tag. Your words become tidy pages, with lovely type and checklists you can
                actually tick.
              </p>
            </div>
          </article>
          <article>
            <span class="feature-symbol mint"><LayoutDashboard size={25} strokeWidth={1.7} /></span>
            <div>
              <h3>Little plans, moving along</h3>
              <p>
                Give a project its own board. Move cards from “someday” to “all done,” one satisfying step at a time.
              </p>
            </div>
          </article>
          <article>
            <span class="feature-symbol peach"><Paperclip size={25} strokeWidth={1.7} /></span>
            <div>
              <h3>The bits that go with it</h3>
              <p>
                A photo, a voice note, that very useful PDF. Keep your files with the thought that gives them meaning.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="playground" class="playground page-width" aria-labelledby="playground-title">
      <div class="playground-copy">
        <span class="little-label"><PenLine size={15} /> A tiny playground</span>
        <h2 id="playground-title">Go on.<br />Make a little mess.</h2>
        <p>
          This is the real editor. Change a sentence, tick a task, or add a file. See how it feels before making
          yourself at home.
        </p>
        <ol class="demo-steps">
          <li><span>1</span> Write a thought. Start with # for a title.</li>
          <li><span>2</span> Preview it, then save your note.</li>
          <li><span>3</span> Try a checkbox. Give it a little star.</li>
        </ol>
        <div class="demo-note">
          <Heart size={16} />
          <p>Just a practice page.<br /><strong>Your demo resets when you leave.</strong></p>
        </div>
      </div>
      <div class="playground-editor">
        <div class="playground-tab"><span class="status-dot"></span> Your practice notebook</div>
        <LandingNoteDemo initialNote={data.landingDemoNote} />
      </div>
    </section>

    <section class="privacy-band" aria-labelledby="privacy-title">
      <div class="privacy-layout page-width">
        <div class="privacy-keepsake" aria-hidden="true">
          <div class="keepsake-label"><LockKeyhole size={18} /><span>For your eyes only</span></div>
          <div class="passkey-row">
            <span><Fingerprint size={27} /></span>
            <div><strong>A familiar hello</strong><small>Your device. Your passkey.</small></div>
            <span class="keepsake-check"><Check size={16} /></span>
          </div>
          <div class="backup-row">
            <FileText size={23} />
            <div><strong>My notebook.freshup</strong><small>A password-encrypted backup</small></div>
            <LockKeyhole size={16} />
          </div>
          <p>Good thoughts, safely tucked away.</p>
        </div>
        <div class="privacy-copy">
          <span class="little-label">A little peace of mind</span>
          <h2 id="privacy-title">Personal means<br />personal.</h2>
          <p>
            Your notebook belongs to your account. Every note and file stays behind sign-in, with no sharing links or
            public feed.
          </p>
          <ul>
            <li><Fingerprint size={18} /><span>Start with GitHub, then add a passkey for next time.</span></li>
            <li>
              <LockKeyhole size={18} /><span
                >Download a backup encrypted in your browser. Keep it wherever you feel at home.</span
              >
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section class="closing page-width" aria-labelledby="closing-title">
      <div>
        <span class="little-label">A fresh page is waiting</span>
        <h2 id="closing-title">What’s on your mind?</h2>
      </div>
      <a class="clay-button" href={appHref}>{appLabel}<ArrowRight size={17} /></a>
    </section>
  </main>
  <footer class="site-footer page-width">
    <a class="wordmark" href={resolve('/')}
      ><span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span><strong>Fresh</strong
      ></a
    >
    <p>For notes, lists, and the lovely in-between.</p>
    <a class="source-link" href="https://github.com/alkinum/fresh" target="_blank" rel="noreferrer"
      ><GitHubIcon size={16} /> Open source <span>↗</span></a
    >
  </footer>
</div>

<style>
  .landing-page {
    --mint: #deefe7;
    --mint-ink: #326d57;
    --peach: #fbe8df;
    --peach-ink: #9a5946;
    --paper: #fffefa;
    --paper-line: #e9ece8;
    background: var(--bg);
    color: var(--text);
    overflow: clip;
  }
  .page-width {
    width: min(1160px, calc(100% - 64px));
    margin-inline: auto;
  }
  .site-header {
    min-height: 96px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
  }
  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: var(--text);
  }
  .wordmark strong {
    font-size: 22px;
    font-weight: 750;
  }
  .site-header nav {
    display: flex;
    align-items: center;
    gap: 30px;
  }
  .text-link,
  .source-link {
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }
  .text-link:hover,
  .source-link:hover {
    color: var(--primary-hover);
  }
  .header-action {
    display: inline-flex;
    align-items: center;
    gap: 13px;
    min-height: 43px;
    padding: 10px 18px;
    border: 1px solid var(--border);
    border-radius: 15px;
    background: var(--surface);
    color: var(--text-strong);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    box-shadow: 0 3px 0 var(--border-soft);
  }
  .hero {
    display: grid;
    grid-template-columns: 0.88fr 1.12fr;
    align-items: center;
    gap: 35px;
    min-height: 630px;
    padding-block: 24px 68px;
  }
  .little-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.6;
  }
  .status-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--success);
    flex: 0 0 auto;
  }
  .hero h1 {
    position: relative;
    display: inline-block;
    margin: 18px 0 12px;
    font-size: clamp(86px, 8.6vw, 126px);
    line-height: 1;
    font-weight: 800;
    color: var(--primary-hover);
  }
  .title-spark {
    position: absolute;
    top: 4px;
    right: -43px;
    transform: rotate(12deg);
    color: var(--primary);
  }
  .hero h2 {
    margin: 0;
    font-size: clamp(29px, 3vw, 40px);
    font-weight: 700;
    line-height: 1.2;
  }
  .hero-copy > p {
    max-width: 370px;
    margin: 20px 0 24px;
    color: var(--text-body);
    font-size: 15px;
    line-height: 1.85;
  }
  .hero-actions {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 20px;
  }
  .clay-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    gap: 18px;
    padding: 12px 21px;
    color: var(--primary-on);
    background: var(--action);
    border: 1px solid var(--primary-ring);
    border-radius: 16px;
    box-shadow:
      0 4px 0 color-mix(in srgb, var(--action), var(--text) 22%),
      inset 0 1px 0 var(--glass-highlight-soft),
      0 10px 22px var(--primary-ring);
    font-weight: 700;
    font-size: 13px;
    text-decoration: none;
    transition:
      transform 160ms ease,
      box-shadow 160ms ease;
  }
  .clay-button:hover {
    transform: translateY(-2px);
  }
  .clay-button:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--primary-hover);
  }
  .try-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--text-body);
    font-size: 12px;
    font-weight: 600;
    text-underline-offset: 5px;
    text-decoration-color: var(--border);
  }
  .hero-footnote {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 28px;
    color: var(--muted);
    font-size: 11px;
  }
  .desk-scene {
    position: relative;
    min-width: 0;
    height: 535px;
  }
  .desk-caption {
    position: absolute;
    top: 0;
    left: 47px;
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--muted);
    font-size: 11px;
    transform: rotate(-3deg);
  }
  .desk-caption > span {
    width: 32px;
    height: 1px;
    background: var(--border);
  }
  .notebook-spine {
    position: absolute;
    inset: 50px 36px 31px 24px;
    background: var(--primary-soft);
    border: 1px solid var(--primary-ring);
    border-radius: 29px;
    transform: rotate(-5deg);
    box-shadow: inset 0 2px 0 var(--glass-highlight);
  }
  .paper-note {
    position: absolute;
    top: 54px;
    left: 0;
    width: 83%;
    padding: 25px 25px 22px;
    border: 1px solid var(--border-soft);
    border-radius: 19px;
    background: var(--paper);
    transform: rotate(-4deg);
    box-shadow:
      0 5px 0 var(--surface-raised),
      0 7px 0 var(--border-soft),
      0 20px 40px var(--primary-ring);
  }
  .paper-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .paper-top > span {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 9px;
    font-weight: 700;
  }
  .paper-top > :global(svg) {
    color: #c88916;
  }
  .paper-note h3 {
    margin: 0 0 12px;
    font-size: 22px;
    line-height: 1.25;
  }
  .paper-note > p {
    margin: 0;
    color: var(--text-body);
    font-size: 13px;
    line-height: 1.7;
  }
  .paper-rule {
    height: 1px;
    margin: 18px 0;
    background: var(--paper-line);
  }
  .paper-task {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-top: 12px;
    color: var(--text-body);
    font-size: 11px;
  }
  .paper-task > span {
    width: 17px;
    height: 17px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border: 1px solid var(--task-border);
    border-radius: 6px;
  }
  .paper-task.done {
    color: var(--muted);
  }
  .paper-task.done > span {
    background: var(--action);
    border-color: var(--action);
    color: var(--primary-on);
  }
  .paper-tags {
    display: flex;
    gap: 7px;
    margin-top: 22px;
  }
  .paper-tags > span {
    padding: 5px 8px;
    border-radius: 8px;
    color: var(--mint-ink);
    background: var(--mint);
    font-size: 10px;
  }
  .mascot-sticker {
    position: absolute;
    top: 0;
    right: 1px;
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: rotate(9deg);
  }
  .mascot-sticker img {
    width: 128px;
    height: 128px;
    border: 5px solid var(--surface);
    border-radius: 35px;
    box-shadow:
      0 6px 0 var(--border-soft),
      var(--shadow);
  }
  .mascot-sticker > span {
    margin-top: 9px;
    padding: 5px 11px;
    border: 1px solid var(--border-soft);
    border-radius: 12px 12px 12px 3px;
    background: var(--surface);
    font-size: 11px;
    font-weight: 700;
  }
  .file-note {
    position: absolute;
    z-index: 2;
    right: -5px;
    top: 279px;
    width: 262px;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px;
    border: 1px solid var(--border-soft);
    border-radius: 15px;
    background: var(--paper);
    box-shadow:
      0 3px 0 var(--border-soft),
      var(--shadow-sm);
    transform: rotate(6deg);
  }
  .file-picture {
    display: grid;
    place-items: center;
    width: 47px;
    height: 48px;
    border-radius: 10px;
    background: var(--peach);
    color: var(--peach-ink);
  }
  .file-note > div {
    display: grid;
    gap: 5px;
  }
  .file-note strong {
    font-size: 11px;
  }
  .file-note div > span {
    color: var(--muted);
    font-size: 9px;
  }
  .file-note > :global(svg) {
    margin-left: auto;
    color: var(--muted);
  }
  .board-note {
    position: absolute;
    z-index: 3;
    bottom: 0;
    right: 8px;
    width: 86%;
    padding: 16px;
    border: 1px solid var(--border-soft);
    border-radius: 19px;
    background: var(--surface);
    box-shadow:
      0 4px 0 var(--border-soft),
      var(--shadow);
    transform: rotate(2deg);
  }
  .board-note header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    color: var(--text-body);
  }
  .board-note header strong {
    font-size: 12px;
  }
  .board-note header > span {
    margin-left: auto;
    color: var(--muted);
    font-size: 11px;
  }
  .tiny-board {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .tiny-board > div {
    min-height: 95px;
    padding: 8px;
    border-radius: 10px;
    background: var(--surface-subtle);
  }
  .tiny-board small {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 9px;
    font-size: 9px;
    font-weight: 650;
  }
  .tiny-board i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--primary);
  }
  .tiny-board > div:nth-child(2) i {
    background: #d39e52;
  }
  .tiny-board > div:nth-child(3) i {
    background: var(--success);
  }
  .tiny-board div > span {
    display: flex;
    gap: 3px;
    align-items: center;
    margin-top: 5px;
    padding: 7px 5px;
    border-radius: 6px;
    background: var(--surface);
    color: var(--text-body);
    box-shadow: 0 1px 1px var(--border-soft);
    font-size: 8px;
  }
  .private-sticker {
    position: absolute;
    bottom: -34px;
    right: 28px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--mint-ink);
    font-size: 11px;
    transform: rotate(-3deg);
  }
  .inside-band {
    border-block: 1px solid var(--border-soft);
    background: var(--surface);
    padding: 49px 0 52px;
  }
  .section-intro h2 {
    margin: 8px 0 30px;
    font-size: 27px;
    line-height: 1.3;
  }
  .feature-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 34px;
  }
  .feature-list article {
    display: flex;
    align-items: flex-start;
    gap: 15px;
  }
  .feature-symbol {
    display: grid;
    place-items: center;
    width: 52px;
    height: 54px;
    flex: 0 0 auto;
    border-radius: 18px 18px 18px 8px;
    box-shadow:
      inset 0 2px 0 var(--glass-highlight),
      0 3px 0 var(--border-soft);
  }
  .blue {
    background: var(--primary-soft);
    color: var(--primary-hover);
  }
  .mint {
    background: var(--mint);
    color: var(--mint-ink);
  }
  .peach {
    background: var(--peach);
    color: var(--peach-ink);
  }
  .feature-list h3 {
    margin: 1px 0 9px;
    font-size: 14px;
  }
  .feature-list p {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.85;
  }
  .playground {
    display: grid;
    grid-template-columns: 0.75fr 1.25fr;
    gap: 80px;
    padding-block: 100px;
    align-items: start;
    scroll-margin-top: 30px;
  }
  .playground-copy {
    padding-top: 37px;
  }
  .playground-copy h2,
  .privacy-copy h2 {
    margin: 16px 0 22px;
    font-size: 39px;
    line-height: 1.22;
  }
  .playground-copy > p,
  .privacy-copy > p {
    color: var(--text-body);
    font-size: 14px;
    line-height: 1.85;
  }
  .demo-steps {
    display: grid;
    gap: 16px;
    margin: 28px 0;
    padding: 0;
    list-style: none;
  }
  .demo-steps li {
    display: flex;
    gap: 9px;
    align-items: center;
    color: var(--text-body);
    font-size: 11px;
    line-height: 1.6;
  }
  .demo-steps li > span {
    display: grid;
    place-items: center;
    width: 23px;
    height: 25px;
    flex: 0 0 auto;
    border-radius: 8px;
    background: var(--surface);
    color: var(--primary-hover);
    border: 1px solid var(--border-soft);
    font-weight: 700;
  }
  .demo-note {
    display: flex;
    gap: 10px;
    align-items: center;
    color: var(--mint-ink);
  }
  .demo-note p {
    margin: 0;
    font-size: 11px;
    line-height: 1.8;
  }
  .demo-note strong {
    font-weight: 500;
  }
  .playground-editor {
    min-width: 0;
  }
  .playground-tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-left: 18px;
    padding: 10px 18px;
    border-radius: 14px 14px 0 0;
    background: var(--primary-soft);
    color: var(--text-body);
    font-size: 11px;
    font-weight: 650;
  }
  .privacy-band {
    padding-block: 67px;
    border-block: 1px solid var(--border-soft);
    background: var(--surface);
  }
  .privacy-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 100px;
  }
  .privacy-keepsake {
    position: relative;
    margin: 12px;
    padding: 25px;
    border: 1px solid var(--border-soft);
    border-radius: 25px;
    background: var(--bg);
    box-shadow:
      0 6px 0 var(--border-soft),
      var(--shadow-sm);
    transform: rotate(-2deg);
  }
  .keepsake-label {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 22px;
    color: var(--text-body);
    font-size: 13px;
    font-weight: 700;
  }
  .passkey-row,
  .backup-row {
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 16px;
    border-radius: 15px;
    background: var(--surface);
  }
  .passkey-row > span:first-child {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 15px;
    color: var(--primary-hover);
    background: var(--primary-soft);
  }
  .passkey-row > div,
  .backup-row > div {
    display: grid;
    flex: 1;
    gap: 5px;
  }
  .passkey-row strong,
  .backup-row strong {
    font-size: 12px;
  }
  .passkey-row small,
  .backup-row small {
    color: var(--muted);
    font-size: 10px;
  }
  .keepsake-check {
    color: var(--success-text);
  }
  .backup-row {
    margin-top: 12px;
    color: var(--text-body);
    background: var(--mint);
  }
  .privacy-keepsake > p {
    margin: 18px 0 0;
    text-align: center;
    color: var(--muted);
    font-size: 11px;
  }
  .privacy-copy ul {
    display: grid;
    gap: 18px;
    margin: 25px 0 0;
    padding: 0;
    list-style: none;
  }
  .privacy-copy li {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    color: var(--text-body);
    font-size: 12px;
    line-height: 1.7;
  }
  .privacy-copy li > :global(svg) {
    flex: 0 0 auto;
    color: var(--primary-hover);
    margin-top: 2px;
  }
  .closing {
    display: flex;
    justify-content: space-between;
    gap: 25px;
    align-items: center;
    padding-block: 75px;
  }
  .closing h2 {
    margin: 10px 0 0;
    font-size: 35px;
  }
  .site-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    min-height: 110px;
    border-top: 1px solid var(--border-soft);
  }
  .site-footer .wordmark strong {
    font-size: 17px;
  }
  .site-footer .brand-mark {
    width: 30px;
    height: 30px;
  }
  .site-footer p {
    margin: 0;
    color: var(--muted);
    font-size: 11px;
  }
  .source-link {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
  }

  @media (prefers-color-scheme: dark) {
    .landing-page {
      --mint: #203d37;
      --mint-ink: #9bd7b9;
      --peach: #443238;
      --peach-ink: #efb9a4;
      --paper: #19293a;
      --paper-line: #304254;
    }
    .hero h1 {
      color: #a8c7ff;
    }
    .paper-top > :global(svg) {
      color: #f0c16b;
    }
  }
  @media (max-width: 1000px) {
    .hero {
      gap: 20px;
      grid-template-columns: 0.85fr 1.15fr;
    }
    .hero-copy > p {
      font-size: 14px;
    }
    .desk-scene {
      height: 505px;
    }
    .paper-note {
      padding: 24px 18px;
      width: 91%;
    }
    .paper-note h3 {
      max-width: 220px;
      font-size: 20px;
    }
    .mascot-sticker {
      right: -6px;
      top: 7px;
    }
    .mascot-sticker img {
      width: 94px;
      height: 94px;
      border-radius: 28px;
    }
    .file-note {
      top: 289px;
      width: 225px;
    }
    .board-note {
      width: 94%;
    }
    .feature-list {
      gap: 22px;
    }
    .feature-list article {
      flex-direction: column;
    }
    .playground {
      gap: 36px;
      grid-template-columns: 0.7fr 1.3fr;
    }
    .privacy-layout {
      gap: 50px;
    }
  }
  @media (max-width: 760px) {
    .page-width {
      width: calc(100% - 40px);
    }
    .site-header {
      min-height: 78px;
    }
    .site-header nav {
      gap: 18px;
    }
    .site-header .text-link:first-child {
      display: none;
    }
    .wordmark strong {
      font-size: 20px;
    }
    .hero {
      grid-template-columns: 1fr;
      gap: 30px;
      padding-block: 26px 66px;
    }
    .hero-copy {
      max-width: 520px;
      text-align: center;
      margin-inline: auto;
    }
    .hero h1 {
      margin-block: 11px;
      font-size: 94px;
    }
    .hero h2 {
      font-size: 29px;
    }
    .hero h2 br {
      display: none;
    }
    .hero-copy > p {
      max-width: 395px;
      margin: 16px auto 22px;
    }
    .hero-actions {
      align-items: center;
      gap: 19px;
    }
    .hero-footnote {
      margin-top: 18px;
    }
    .desk-scene {
      width: min(480px, 100%);
      height: 477px;
      margin-inline: auto;
    }
    .paper-note {
      width: 83%;
      padding: 22px;
    }
    .desk-caption {
      left: 15px;
    }
    .paper-task {
      font-size: 10px;
    }
    .paper-tags {
      margin-top: 17px;
    }
    .file-note {
      top: 265px;
      right: 0;
    }
    .board-note {
      width: 88%;
      right: 0;
    }
    .mascot-sticker {
      right: 0;
    }
    .feature-list {
      grid-template-columns: 1fr;
      gap: 30px;
    }
    .feature-list article {
      flex-direction: row;
      gap: 19px;
    }
    .feature-list p {
      max-width: 440px;
    }
    .section-intro h2 {
      font-size: 25px;
    }
    .inside-band {
      padding-block: 40px;
    }
    .playground {
      grid-template-columns: 1fr;
      padding-block: 55px;
      gap: 30px;
    }
    .playground-copy {
      padding-top: 0;
    }
    .playground-copy h2,
    .privacy-copy h2 {
      font-size: 32px;
    }
    .playground-copy h2 br {
      display: none;
    }
    .demo-steps {
      gap: 10px;
      margin-block: 20px;
    }
    .privacy-layout {
      grid-template-columns: 1fr;
      gap: 34px;
    }
    .privacy-copy {
      grid-row: 1;
    }
    .privacy-band {
      padding-block: 45px;
    }
    .privacy-keepsake {
      max-width: 430px;
      margin-inline: auto;
      width: calc(100% - 20px);
    }
    .closing {
      flex-direction: column;
      text-align: center;
      padding-block: 55px;
      gap: 27px;
    }
    .closing h2 {
      font-size: 30px;
    }
    .site-footer {
      flex-wrap: wrap;
      justify-content: center;
      padding-block: 27px;
      gap: 20px 28px;
    }
    .site-footer p {
      flex-basis: 100%;
      order: 3;
      text-align: center;
    }
  }
  @media (max-width: 390px) {
    .page-width {
      width: calc(100% - 32px);
    }
    .site-header nav {
      gap: 13px;
    }
    .text-link {
      font-size: 11px;
    }
    .header-action {
      padding-inline: 12px;
      gap: 8px;
    }
    .hero .little-label {
      font-size: 10px;
    }
    .hero-copy > p {
      font-size: 13px;
    }
    .paper-note {
      width: 91%;
      padding: 22px 17px;
    }
    .paper-note h3 {
      max-width: 190px;
    }
    .mascot-sticker img {
      width: 82px;
      height: 82px;
    }
    .mascot-sticker > span {
      font-size: 9px;
    }
    .board-note {
      width: 95%;
      padding: 13px;
    }
    .tiny-board {
      gap: 6px;
    }
    .tiny-board > div {
      padding: 6px;
    }
    .file-note {
      width: 213px;
      top: 272px;
    }
    .privacy-keepsake {
      padding: 18px;
    }
    .passkey-row,
    .backup-row {
      padding: 12px;
      gap: 9px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .clay-button {
      transition: none;
    }
    .clay-button:hover,
    .clay-button:active {
      transform: none;
    }
  }
  @media (prefers-contrast: more) {
    .paper-note,
    .board-note,
    .file-note,
    .privacy-keepsake,
    .header-action {
      border-color: currentColor;
      box-shadow: none;
    }
  }
</style>
