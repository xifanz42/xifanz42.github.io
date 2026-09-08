---
title: "Xifan"
description: "比起用某一种技术来定义自己，我更愿意把自己看作一个跨领域的问题解决者——用技术把想法真正做出来。"
# rawBody: true → 正文按原始 HTML 输出（hero 也写在正文里，与下方区块格式统一）
rawBody: true
# useTypeit: true → 正文 hero 里的打字机需要 TypeIt 库
useTypeit: true
---

<div class="apple-page">

  <!-- Hero：卡片模式（同「现在在做」风格）—— 眉题 / 主张 / 方法 / 技术 pills / 双按钮 -->
  <section class="ap-hero">
    <p class="ap-hero-eyebrow r">XIFAN</p>
    <h1 class="r">解决数据、AI 的实际问题，<br>也做点有趣的东西。</h1>
    <p class="ap-hero-sub r"><span id="hero-typeit"></span></p>
    <div class="ap-hero-tech r">
      <span>Python</span><span>LLM Agents</span><span>RAG</span><span>PostgreSQL</span><span>Next.js</span>
    </div>
    <div class="ap-hero-btns r">
      <a class="ap-btn" href="/zh-cn/portfolio/">看看我做的项目</a>
      <a class="ap-btn outline" href="mailto:xifan.zou@outlook.com">联系我 ›</a>
    </div>
  </section>
  <script>
    document.addEventListener("DOMContentLoaded", function () {
      new TypeIt("#hero-typeit", {
        strings: ["拆解 → 学习 → 设计 → 构建"],
        speed: 110,
        lifeLike: true,
        loop: false,
        startDelay: 400,
        waitUntilVisible: true
      }).go();
    });
  </script>

  <div class="ap-how">
    <h2 class="r">我怎么工作</h2>
    <p class="ap-works-lead r">我真正擅长的不是某一项特定技术（technically最擅长python），而是面对具体场景下的问题时，如何找到解决方案并执行。</p>

    <div class="ap-steps">
      <div class="ap-step r">
        <span class="n">01</span>
        <h4>拆解</h4>
        <p>理解底层逻辑，把复杂问题拆开。</p>
      </div>
      <div class="ap-step r">
        <span class="n">02</span>
        <h4>学习</h4>
        <p>补齐解决问题所需要的知识和技能。</p>
      </div>
      <div class="ap-step r">
        <span class="n">03</span>
        <h4>设计</h4>
        <p>设计合适的系统结构。</p>
      </div>
      <div class="ap-step r">
        <span class="n">04</span>
        <h4>构建</h4>
        <p>然后真正把它做出来。</p>
      </div>
    </div>
  </div>

  <div class="ap-works">
    <h2 class="r">做过的东西</h2>
    <p class="ap-works-lead r">四个项目，一条因果链——每一个，都是因为上一个不够用才出现的。</p>

    <div class="ap-chain r">
      <div class="ap-cnode">
        <span class="cy">2023.06 – 2024.08</span>
        <b>一家无人驾驶商用车公司</b>
        <p>起点。每天重复的分析，全靠人。</p>
      </div>
      <div class="ap-cnode">
        <span class="cy">2024 – 2025</span>
        <b>Dify 咨询助手</b>
        <p>离职后，用多 Agent 把同一套流程重做一遍。</p>
      </div>
      <div class="ap-cnode hi">
        <span class="cy">2025 – 现在</span>
        <b>NL2SQL Agent</b>
        <p>平台可控性不够，核心查询链路我自己造一遍。</p>
      </div>
      <div class="ap-cnode">
        <span class="cy">2025.09 – 2026.04</span>
        <b>LeadX</b>
        <p>带着这套能力加入初创团队，做全栈 SaaS。</p>
      </div>
    </div>

    <p class="ap-works-tag r">交付物也在往上走：看板 → 库 → 系统 → 产品。</p>
  </div>

  <div class="ap-btns r">
    <a class="ap-btn" href="/zh-cn/portfolio/">查看更多</a>
  </div>

</div>
