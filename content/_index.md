---
title: "Xifan"
description: "Less defined by any single technology, more a cross-domain problem solver — using tech to actually ship ideas."
# rawBody: true → body is raw HTML (hero lives in the body, same block format as the sections below)
rawBody: true
# useTypeit: true → the typewriter in the hero body needs the TypeIt library
useTypeit: true
---

<div class="apple-page">

  <!-- Hero: card mode — eyebrow / claim / method / tech pills / dual buttons -->
  <section class="ap-hero">
    <p class="ap-hero-eyebrow r">XIFAN</p>
    <h1 class="r">I solve real problems in data &amp; AI,<br>and build a few fun things too.</h1>
    <p class="ap-hero-sub r"><span id="hero-typeit"></span></p>
    <div class="ap-hero-tech r">
      <span>Python</span><span>LLM Agents</span><span>RAG</span><span>PostgreSQL</span><span>Next.js</span>
    </div>
    <div class="ap-hero-btns r">
      <a class="ap-btn" href="/portfolio/">See what I've built</a>
      <a class="ap-btn outline" href="mailto:xifan.zou@outlook.com">Get in touch ›</a>
    </div>
  </section>
  <script>
    document.addEventListener("DOMContentLoaded", function () {
      new TypeIt("#hero-typeit", {
        strings: ["Decompose → Learn → Design → Build"],
        speed: 110,
        lifeLike: true,
        loop: false,
        startDelay: 400,
        waitUntilVisible: true
      }).go();
    });
  </script>

  <div class="ap-how">
    <h2 class="r">How I work</h2>
    <p class="ap-works-lead r">What I'm actually good at isn't any one specific technology (technically it's Python) — it's taking a problem in a concrete scenario, finding a solution, and executing it.</p>

    <div class="ap-steps">
      <div class="ap-step r">
        <span class="n">01</span>
        <h4>Decompose</h4>
        <p>Understand the underlying logic. Take complex problems apart.</p>
      </div>
      <div class="ap-step r">
        <span class="n">02</span>
        <h4>Learn</h4>
        <p>Fill in the knowledge and skills the problem demands.</p>
      </div>
      <div class="ap-step r">
        <span class="n">03</span>
        <h4>Design</h4>
        <p>Design a system structure that fits.</p>
      </div>
      <div class="ap-step r">
        <span class="n">04</span>
        <h4>Build</h4>
        <p>Then actually build it.</p>
      </div>
    </div>
  </div>

  <div class="ap-works">
    <h2 class="r">Things I've built</h2>
    <p class="ap-works-lead r">Four projects, one causal chain — each one exists because the previous one stopped being enough.</p>

    <div class="ap-chain r">
      <div class="ap-cnode">
        <span class="cy">2023.06 – 2024.08</span>
        <b>An autonomous commercial vehicle company</b>
        <p>The starting point. The same analysis, every day, all by hand.</p>
      </div>
      <div class="ap-cnode">
        <span class="cy">2024 – 2025</span>
        <b>Dify consulting assistant</b>
        <p>After leaving, I redid the same workflow with multiple agents.</p>
      </div>
      <div class="ap-cnode hi">
        <span class="cy">2025 – now</span>
        <b>NL2SQL Agent</b>
        <p>The platform wasn't controllable enough — so I built the core query pipeline myself.</p>
      </div>
      <div class="ap-cnode">
        <span class="cy">2025.09 – 2026.04</span>
        <b>LeadX</b>
        <p>Took that toolkit to a startup and built a full-stack SaaS.</p>
      </div>
    </div>

    <p class="ap-works-tag r">The deliverables kept leveling up too: dashboards → libraries → systems → products.</p>
  </div>

  <div class="ap-btns r">
    <a class="ap-btn" href="/portfolio/">See more</a>
  </div>

</div>
