---
title: "LeadX: Building a Full-Stack Web3 Compliance Sales Intelligence SaaS from 0 to 1"
date: 2026-09-03
draft: false
summary: "As the sole technical lead, I built a Web3 compliance sales intelligence SaaS from 0 to 1—independently delivering the frontend, backend, database, and row-level security architecture, validating the product with real paying B2B customers, and developing practical lessons around technical decision-making and demand validation."
translationKey: "leadx-showcase"
tags: ["project retrospective", "backend", "b2b-saas", "indie development"]
categories: ["Project Case Studies"]
# menu: footer
showDate : false
showDateOnlyInArticle : false
showDateUpdated : false
showHeadingAnchors : false
showPagination : false
showReadingTime : false
showTableOfContents : true
showTaxonomies : false
showWordCount : false
showSummary : true
showAuthor: false
sharingLinks : false
showEdit: false
showViews: false
showLikes: false
layoutBackgroundHeaderSpace: false
---

{{< keywordList >}}
{{< keyword icon="check" >}} Translated by **AI** {{< /keyword >}}
{{< keyword icon="edit" >}} Reviewed by **Human** {{< /keyword >}}
{{< /keywordList >}}


## In One Sentence

{{< lead >}}
As the sole technical lead, I independently delivered the full-stack architecture for a Web3 compliance sales intelligence SaaS from 0 to 1 (PostgreSQL + row-level security + Next.js) and validated it with real paying B2B customers—making this a practical retrospective on technical decisions and commercialization trade-offs.
{{< /lead >}}


## Product Demo

> All data shown has been anonymized.

<video controls muted playsinline preload="metadata" width="100%" poster="/img/leadx/demo-cover.png">
  <source src="/video/leadx-demo.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

{{< carousel images="gallery/*" aspectRatio="16.5-9" interval="2500" >}}

---

## About the Project

### 1. Background

**Why did we build it?** Between 2024 and 2025, major crypto regulatory frameworks gradually moved from the **legislation** stage into **mandatory enforcement**. As regulations became clearer, two new customer groups emerged: companies that needed compliance services (buyers), and companies that made money by selling compliance services (sellers).

However, the latter still relied on manual prospect lists and generic CRMs for customer acquisition. These traditional approaches could not answer questions created by the new regulatory environment, such as:

> What licenses does this company hold?
> Is the license currently active, pending, or expired?

**Who was it built for?** Given these limitations, we focused on the **sell side** of the Web3 compliance ecosystem—BD and sales teams at custodians, on-chain auditing and KYT providers, compliance consultancies, cross-border payment companies, and blockchain security firms.

Their daily work is not simply about *finding companies*. It is about determining whether **a company currently has a compliance need, who it is connected to, and where the risks are**.

### 2. What We Built

{{< feature-grid columns="5" >}}

{{< feature icon="lock" title="Compliance-Anchored Profiles" >}}
Using Hong Kong SFC-licensed institutions as anchors, we centralized information such as license status and sanctions matches instead of leaving it scattered across raw source lists.
{{< /feature >}}

{{< feature icon="link" title="Entity Relationship Graph" >}}
Starting from a licensed entity, users could trace parent companies, subsidiaries, and investment relationships, with relationship weights inherited based on license relevance.
{{< /feature >}}

{{< feature icon="wand-magic-sparkles" title="Structured Intelligence Profiles" >}}
A company's basic information, licensing and compliance records, related entities, and relevant contacts were consolidated into a searchable profile.
{{< /feature >}}

{{< feature icon="star" title="Staged Lead Delivery" >}}
Users entered their target industries and customers, and trial leads were unlocked in three batches based on account age, with all leads unlocked within 15 days.
{{< /feature >}}

{{< feature icon="envelope" title="Behavior Tracking & Feedback" >}}
Searches, saves, dismissals, and recommendation ratings were stored to provide data for the next iteration of ranking and recommendation.
{{< /feature >}}

{{< /feature-grid >}}

### 3. My Role

{{< badge >}}Sole Technical Lead{{< /badge >}}

1. **Full-Stack Technical Decisions & Architecture**: Defined the overall technology stack, deployment approach, and frontend/backend boundaries based on the permission, compliance, and responsiveness requirements of a B2B data SaaS.
2. **Core Data & Permission Design**: Designed the company relationship data model around Hong Kong SFC-licensed institutions and established quality standards for cleaning, validating, and ingesting data from multiple sources.
3. **Product UX & Admin Management**: Designed the overall information architecture, routing, and page structure for the product; separated the marketing website from the product console; and built an admin backend for data and permission management.

> My team also included two data engineering interns. I broke down their tasks and defined detailed acceptance criteria, and they did an excellent job with data collection, preprocessing, and initial quality validation.

### 4. System Architecture

{{< figure src="/img/leadx/system-arch.png" alt="" >}}

### 5. Results

{{< stats >}}
{{< stat value="12,388" label="License Data Records" >}}A company data foundation aligned around Hong Kong SFC-licensed institutions{{< /stat >}}
{{< stat value="732" label="Real User Actions" >}}Including 35 explicit ratings of recommendation results{{< /stat >}}
{{< stat value="31" label="Companies Delivered to Real Customers" >}}Across one paying B2B customer and one B2B trial customer{{< /stat >}}
{{< stat value="53 / 30 / 24 / 50+" label="Migrations / Tables / RPCs / RLS Policies" >}}Complete database-side delivery, with row-level security enabled on 30 tables{{< /stat >}}
{{< /stats >}}

---

## The Story Behind It

As the sole technical lead, I was responsible for both the frontend and backend. The most mentally demanding part was no longer writing code—it was deciding what to prioritize when resources were limited and information was incomplete.

At the beginning, I had a lot of questions: Should I build the backend from scratch or use an existing BaaS? As someone who had barely touched frontend development (unless Streamlit counts), how could I deliver something customer-facing within a realistic timeframe? What does a typical SaaS architecture actually look like?

So in this section, I want to discuss two backend and database-related decisions I made during this project.


### 1. Technical Decisions

#### 1.1 Using UUIDv5 for Cross-Source Entity Resolution

Back when I was building toy projects at university, I would often receive a dataset and immediately add an auto-incrementing primary key. But that approach obviously does not work in a real product.

For our data assets in particular, building multidimensional intelligence about a company required combining information from multiple sources. The same entity could appear in different batches, different data sources, and under different source IDs in the main table.

So how could we ensure that newly ingested data would still correctly match entities already in the database instead of creating duplicates?

My first idea was to use UUIDv5 to create deterministic primary keys. As long as the logic used to generate the ID was unique, this could avoid the problem above.

But that immediately raised another question: **Which attributes should be used to construct the ID so that it is both uniquely deterministic and useful for aligning entities across sources?**

My approach was to define a priority order for each data source:

> Use the most deterministic and unique identifier available in that source as the first choice for constructing the logical primary key.

For example, the CE Reference number in the SFC licensed entity list is issued by the regulator and globally unique, so it could be used as the unique identifier in the ID generation logic.

If a source did not contain a unique identifier—for example, an SFC alert list containing only a company name—we would fall back to a cleaned combination of **company name + country code**. Of course, when company names are used as a fallback, they need to be standardized consistently. For example, `"Tencent Co. Ltd."` and `"tencent"` must first be normalized into the same string before they can generate the same ID.

Once the IDs for company entities in the main table are deterministic, generating IDs for child tables becomes much simpler. I will not go into that in detail here.

There is one important caveat, though: while deterministic IDs solve the problem of **uniqueness**, they do not automatically solve **cross-source entity matching**.

For cross-source matching, we used a separate approach in the data cleaner: exact matching combined with substring-based fuzzy matching.

#### 1.2 Moving Trial Lead Distribution Logic into the Database

During onboarding, our product asked new users to enter their target customers or companies they had already worked with. Based on that information, the system selected 15 companies from the database and recommended them as trial sales leads.

These leads were not released all at once. Instead, they were progressively unlocked in three batches over the lifecycle of the account.

At the time, I spent quite a while deciding which layer this lead distribution logic should live in.

From a conventional engineering perspective, the obvious choice would be the application layer: write the company selection logic in Node.js and add a cron job to unlock additional leads at the appropriate time.

But given our actual situation, that approach had one major downside: **higher development cost**.

For a team with only one technical developer, adding another middle layer did not simply mean adding another layer. It also meant service integration, business workflow orchestration, deployment testing, and more—at least another week on the schedule.

That was difficult to justify when we were under significant time pressure and had limited resources. Our priority was not only to launch quickly, but also to ensure that data was distributed accurately to different users without cross-user contamination.

So I temporarily decided to:

> Put this business logic directly in the database layer and keep lead distribution logic as close to the data itself as possible.

The entire workflow was ultimately implemented as two PostgreSQL functions:

- `generate_trial_leads` was responsible for selecting companies and assigning batches. It first filtered company data based on the information users provided during onboarding, then ranked the remaining companies by priority and assigned them `"batch1"`, `"batch2"`, or `"batch3"` labels.
- `get_trial_leads` was responsible for deciding **which leads a user should see right now**. Instead of storing which batch had been unlocked, it calculated the account's age dynamically by subtracting the account creation time from the current time, then determined which batches should be available based on the number of active days.


### 2. How the Project Ended

**After eight months of exploration, the project was shut down in April 2026.**

After discussing it with my co-founder, we realized that the business direction still had several fundamental problems.

We had answered the question of **"who is safer?"**, but what customers actually wanted to know was **"who can become a customer?"**

We delivered **"who exists"**. They wanted sales leads they could directly act on.

We provided structured entity and compliance intelligence, while customers expected leads that could help move sales forward immediately.

This was not a technical failure. It was a **product-market and demand mismatch**.


### 3. Looking Back from Today

This has been the startup project into which I have invested the most effort, spent the longest amount of time, and had the greatest degree of autonomy. It also ultimately acquired real paying B2B customers. That is why it remains an experience I revisit repeatedly: What did I learn? What did I do right? What could I have done better?

I see the lessons from both a **business** and a **technical** perspective.

First thing first, the clearest **business** lesson was:

> **Validate demand broadly before you start writing code.**

At the beginning of this project, I consistently saw myself primarily as the technical person. But as a co-founder, I overlooked something more important: validating whether the market actually wanted the product, and distinguishing genuine purchase signals from polite encouragement.

For developers facing a similar problem, I highly recommend [*The Mom Test*](https://www.momtestbook.com/). It provides a very practical explanation of what genuine buying signals look like and how to design questions that actually test market demand. 

If I had read it earlier, perhaps instead of spending so much time researching data sources, building the backend, and designing the frontend, I would have started with something much lighter—perhaps just a single landing page.

Now, on to the **technical** side.

I also fell into a common trap for startup developers: endlessly expanding within the areas I already understood, diving deeper into details, and trying to make the first version robust enough from the beginning. I invested a great deal of time in database design and data management. To be fair, LeadX was itself a data product, so the data foundation was part of the product itself. The real problem was that I failed to distinguish between two kinds of variables:

- Things that should be standardized and established early because they are foundational.
- Things that will change rapidly as the product evolves and therefore need to remain flexible.

From a purely architectural perspective, our product followed a **thick frontend, no middle layer, database-heavy (BaaS)** architecture. This is a mainstream product architecture that has already been validated by many indie SaaS products, and if I were building the product again, I would still choose this overall architecture. 

However, I would not take the same shortcut when it came to **business logic orchestration**. I thought I was saving time by avoiding a middle layer. But by doing so, I accidentally placed the most frequently changing business logic inside the container with the highest cost of modification: **the database**.

So if I were doing it again, I would let the depth at which logic is pushed down follow the pace of validation:

> I would still build foundational infrastructure early and build it properly. But before receiving real payment signals, rapidly changing business logic and fancy algorithmic work should remain as shallow and flexible as possible.

Returning to the context of this startup: technology's most important role is to serve business goals as a tool and means of execution.

Only after the business survives does it make sense to optimize, iterate, and add more high-tech capabilities.
