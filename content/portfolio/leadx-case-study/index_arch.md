---
title: "LeadX"
date: 2026-09-03
draft: true
summary: "From 0 to 1 as the sole engineer on a B2B sales intelligence SaaS: 53 SQL migrations, 30 tables, 50+ RLS policies, a 5,406-company / 12,388-licence data foundation, and 732 real user interactions. Shut down in April 2026 — the engineering loop closed, the market assumption did not."
description: "LeadX case study: a full-stack B2B sales intelligence SaaS built end to end as the sole engineer — 53 SQL migrations, 50+ RLS policies, validated with 1 paying and 1 trial customer. An honest post-mortem on building the wrong thing well."
translationKey: "leadx-showcase"
tags: ["B2B SaaS", "PostgreSQL", "Next.js", "Data Pipeline", "Case Study"]
categories: ["portfolio"]
showDate: false
showDateOnlyInArticle: false
showDateUpdated: false
showHeadingAnchors: false
showPagination: false
showReadingTime: false
showTableOfContents: true
showTaxonomies: false
showWordCount: false
showSummary: true
showAuthor: false
sharingLinks: false
showEdit: false
showViews: false
showLikes: false
layoutBackgroundHeaderSpace: false
showHero: false
heroStyle: "basic"
---

<!-- [翻译说明] 本文是 index.zh-cn.md 的英文版，本地化翻译（非逐字直译）。
     数字口径与中文版一致：53 migrations / 30 tables / 24 RPCs / 50+ RLS policies、
     30 张表启用 RLS（原"34"系笔误，2026-09-07 依 migration 解析修正，正文 stat 已同步）、5,406 家公司、12,388 张牌照、732 条行为（含 35 次评分）、
     1 个付费 + 1 个试用客户。
     定稿前待办：
     ① "eight months" 时长口径待核对 —— 权威事实约 2025-12~2026-04，起始有 09 vs 10-27 分歧
     ② /img/leadx/demo-cover.png 封面与 gallery/* 目录是否就绪，需确认
     ③ 中文版第 3 节技术段仍停在 "my answer is yes" 就断了 —— 若补"三件具体的事"，中英两版都要加
     ④ 两边 date 不一致（英文 2026-04-30 / 中文 2026-09-03），定稿时统一
     注意：HTML 注释必须放在 frontmatter 的 --- 之后，放进 YAML 里会导致 Hugo 解析失败。 -->

{{< badge >}}
start-up project
{{< /badge >}}

## TL;DR

{{< lead >}}
A B2B sales intelligence SaaS that I built end to end as the sole engineer: 5,406 licensed entities and 12,388 licence records turned into a searchable compliance knowledge base, with 732 real user interactions closing the feedback loop. The engineering worked. The market assumption did not — the project was shut down in April 2026. This post covers the architecture, the technical decisions behind it, and what I would do differently today.
{{< /lead >}}

## Demo

> All data shown here is anonymized.

<video controls muted playsinline preload="metadata" width="100%" poster="/img/leadx/demo-cover.png">
  <source src="/video/leadx-demo.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

{{< carousel images="gallery/*" aspectRatio="16.5-9" interval="2500" >}}

---

## The product

### 1. Background

**Why we built it**: Between 2024 and 2025 the major crypto regulatory frameworks moved from drafting into enforcement. As the rules became concrete, two new audiences appeared: companies that need compliance services (the buyers), and companies that make money selling those services (the sellers). The sellers, though, were still prospecting the old way — manual lists and generic CRMs — which cannot answer the questions the new regime actually raises:

> Which licences does this company hold?
> Is each licence active, pending, or lapsed?

**Who it's for**: Given that gap, we targeted the **sellers** in the Web3 compliance ecosystem — custody providers, on-chain audit and KYT vendors, compliance consultancies, cross-border payment firms, and blockchain security companies. Their daily job is not "find companies"; it is judging whether a company has a compliance need right now, who it is connected to, and where the risk sits.

### 2. What we built

{{< feature-grid columns="5" >}}

{{< feature icon="lock" title="Compliance-anchored profiles" >}}
Licence status and sanctions hits surfaced in one place, anchored on Hong Kong SFC licencees, instead of scattered across raw source lists
{{< /feature >}}

{{< feature icon="link" title="Entity relationship graph" >}}
Parent, subsidiary, and investment relationships traced back from a licensed entity, with inherited weights based on how usable each related entity's licence is
{{< /feature >}}

{{< feature icon="wand-magic-sparkles" title="Structured intelligence dossiers" >}}
Company basics, licences and compliance standing, related parties, and contacts merged into one searchable record
{{< /feature >}}

{{< feature icon="star" title="Batched lead delivery" >}}
You tell it your target industry and customer profile; trial leads unlock in three batches over your first 15 days
{{< /feature >}}

{{< feature icon="envelope" title="Behaviour capture and feedback" >}}
Searches, saves, dismissals, and recommendation ratings all persisted, to feed the next version's ranking
{{< /feature >}}

{{< /feature-grid >}}

### 3. My role

{{< badge >}}Sole technical owner{{< /badge >}}

1. **Full-stack architecture and technical decisions**: chose the stack, deployment model, and front-end/back-end boundaries against the permission, compliance, and freshness requirements of a B2B data SaaS.
2. **Core data and permission design**: designed the entity relationship model anchored on Hong Kong SFC licencees, and set the quality bar for multi-source cleaning, validation, and ingestion.
3. **Product UX and admin tooling**: owned the product's information architecture, routing, and page structure; decoupled the marketing site from the product console; and built the admin back office for data and permission management.

> Two data engineering interns worked with me. I broke down their tasks and wrote explicit acceptance criteria; their data collection, preprocessing, and first-pass quality checks were excellent.

### 4. System architecture

{{< figure src="/img/leadx/system-arch.png" alt="" >}}

### 5. Results

{{< stats >}}
{{< stat value="12,388" label="Licence records" >}}The data foundation, aligned on Hong Kong SFC licencees{{< /stat >}}
{{< stat value="732" label="Real user interactions" >}}Including 35 explicit ratings of recommendation results{{< /stat >}}
{{< stat value="31" label="Companies delivered" >}}From 1 paying B2B customer and 1 trial customer{{< /stat >}}
{{< stat value="53 / 30 / 24 / 50+" label="migrations / tables / RPCs / RLS policies" >}}The entire database-side deliverable, with row-level security enabled on 34 tables{{< /stat >}}
{{< /stats >}}

## Behind the scenes

As the only engineer, I owned both front end and back end. The expensive part stopped being writing code — it was making calls with limited resources and incomplete information. Early on I burned a lot of time on questions like: build our own back end or use an off-the-shelf BaaS? How does someone who has barely touched front end (does Streamlit count?) ship something presentable to customers in the time available? What does a typical SaaS architecture even look like?

So in this section I want to walk through two decisions I made that live closest to the database.
<!-- [改动 2026-09-07] "one decision" 改为 "two decisions"：下方新增第二个技术决策小节
     （trial-lead delivery pushed down into the database），与中文版新增小节对应。 -->

### 1. Technical decisions

> **Entity resolution across data sources with UUIDv5**

Back in school, toy projects taught me to reach for an auto-increment integer primary key the moment I saw a table. That obviously does not survive a real product — especially ours, where the data asset means stitching multiple sources together to build a multi-dimensional picture of one company. The same real-world entity can arrive in the master table from different batches, different sources, and under different identifiers.

So the question became: when new data lands, how does it reliably find and match the entity already in the database, instead of inserting a duplicate?

My first instinct was UUIDv5 — a deterministic primary key. If the logic that builds the ID is unique, the problem goes away. But that just moves the question: which fields do you feed into the ID so that it is both unique and stable enough to align across sources?

My answer was to rank each source by one rule:

> Whatever identifier in this source is the most deterministic and the most unique — use that first.

The CE Reference number in the SFC licencee list, for instance, is issued by the regulator and globally unique, so it goes straight into the ID. When a source has no such identifier — the SFC alert list, for example, only carries company names — I fall back to a normalised "company name + country code". And because names are the fallback, they have to be normalised consistently: "Tencent Co. Ltd." and "tencent" must collapse to the same string before they hash to the same ID. Once the parent entity's ID is deterministic, child rows are straightforward — I will not go into that here.

One thing I have to be honest about: the ID solves uniqueness, not cross-source alignment. Because the key carries a source prefix, the same company arriving from SFC and from another source really is two IDs. Alignment is a separate mechanism — exact and substring fuzzy matching inside the cleaners.

<!-- [改动 2026-09-07] 新增小节：第二个技术决策（trial-lead delivery pushed down into the database），
     为中文版 2026-09-07 新增小节的对应翻译（非逐字直译）。
     内容依据 leadx_backend migration 20251222131621_implement_trial_campaign_and_key_accounts.sql
     中的 generate_trial_leads / get_trial_leads 实际代码，数字与中文版一致。 -->

> **pushing trial-lead delivery down into the database**

The moment a new account finishes onboarding and fills in its target customers, the system's first job is to pick 15 companies as trial recommendations and unlock them in three batches over the account's early lifetime. Where this logic should live was a decision I went back and forth on.

The obvious answer was the application layer: query logic in Node.js, plus a cron job to unlock batches "when due". But push the design a little and it creaks — at heart this is a pure data transformation over data already sitting in Postgres. Doing it in the app layer means either opening a privileged API that bypasses RLS (the recommendations table is tenant-isolated), or persisting an intermediate state — "which batches are unlocked" — and paying a cron job to maintain it. Every extra state makes consistency more expensive.

The principle I settled on:

> Distribution logic over data should live as close to the data as possible.

So the whole thing became two PostgreSQL functions. `generate_trial_leads` builds a two-tier candidate pool in a CTE: tier one filters ACTIVE companies by the user's target industries, tier two backfills high-registered-capital companies — so even when a user targets a niche with thin coverage, the pool still fills to 15. Candidates are ranked by priority plus a random shuffle, tagged into trial_batch_1/2/3, and written with ON CONFLICT DO NOTHING so reruns stay idempotent.

The batch unlocking needs no scheduler at all: `get_trial_leads` computes the account's active days on the fly — now minus account creation — and gates visibility accordingly: days 0–1 return an empty set (the UI shows "analysing"), days 2–6 expose batch 1, days 7–11 the first two, day 12+ everything. Unlocking is not a state to maintain; it is a pure function of time — no cron, no intermediate state, and any recomputation agrees with itself.

Both functions are declared SECURITY DEFINER with search_path pinned to public: the former lets them write past RLS as the table owner while collapsing the client-facing attack surface into a single function signature; the latter is the classic PostgreSQL defence — without a pinned search_path, a caller can in principle manipulate the session's schema resolution and make the function execute a same-named hostile object.

And here, too, I have to be honest: both functions trust the org_id parameter passed in by the caller. The stricter design derives the org from auth.uid() instead of exposing it as a parameter — otherwise, in theory, any logged-in user could read another tenant's recommendations by passing someone else's org_id. That is the price of SECURITY DEFINER: in bypassing RLS, it hands the job of authenticating the caller from the database back to the function itself. I only caught this in the post-shutdown post-mortem — if I did it again, org_id would not be in the parameter list at all.

<!-- [改动 2026-09-07] 小节编号顺延：原 "### 2. How it ended" 改为 "### 3."（中文版同位置已顺延）。 -->

### 2. How it ended

**After eight months of exploration, the project was shut down in April 2026.** Talking it through with my co-founder, we concluded the business direction itself had too many problems. We had answered "**who is safe to work with**"; what customers wanted was "**who is ready to buy**". We shipped "**who exists**". We delivered structured entity and compliance intelligence; customers expected sales leads they could act on immediately. That is not a technical mistake — it is a mismatch between what we built and what was actually in demand.

<!-- [改动 2026-09-07] 修复重号：本节原编号 "### 3." 与 "How it ended" 重号，
     因上方新增第二个技术决策小节，顺延为 "### 4."。 -->

### 3. What I'd do differently

This is still the startup project I have poured the most into, the one that ran the longest, and the one where I had the most autonomy — and it did end up with real paying B2B customers. So it is the one I keep coming back to: what did I get out of it? What did I get right? What would I do better?

I will split this into business and technology.

The clearest lesson on the business side: **validate demand broadly before you write a line of code**. Early on I kept positioning myself as the engineer, forgetting that as a co-founder the first job is validating that a market want exists — and learning to tell real buying signals from politeness. If you are an engineer with the same blind spot, read [*The Mom Test*](https://www.momtestbook.com/). It is a very practical book about which signals in a conversation are real buying signals, and how to phrase your questions so you are actually testing demand. Had I read it sooner, I might have skipped the data sources, the back end, and the front end, and started with something much lighter — a single landing page.

Now to the technical side.

I fell into the classic developer trap: expanding endlessly inside the area I was already comfortable with, polishing details, trying to ship a version 1 that was robust enough for anything. I sank a lot of time into database design and data management. To be fair, the data foundation matters — for a data-product company, for the AI applications everyone is building now, for internet products generally. But given how tight that development window was: was there a lighter database design? Could the fancier recommendation algorithms have waited for v2? Looking back now, my answer is yes.

In an early-stage startup, technology's job is to serve the business goal as a tool and a means of delivery. Only once the business survives does it make sense to optimise, iterate, and add anything more high-tech.

---

**Code**: [leadx_backend](https://github.com/xifanz42/leadx_backend) · [XLead_Demo (early prototype)](https://github.com/xifanz42/XLead_Demo)
