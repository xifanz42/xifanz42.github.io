---
title: "Does Text Data Engineering Matter Most? A Single-Turn Capability Evaluation of an NL2SQL Agent"
date: 2026-10-14
draft: false
summary: "An NL2SQL Agent translates natural-language questions into SQL, and its core design is to ask a clarifying question first when information is missing, mimicking real human interaction, rather than forcing an answer. Over the past year, as the harness idea spread and models kept getting stronger, I began to wonder whether the NL2SQL Agent I built actually has an ask-first advantage. That question is what produced this evaluation. The conclusion, up front: retrieval is the only order-of-magnitude gain. And because retrieval is essentially data processing over text, the Agent's value in single-turn conversation comes almost entirely from text data engineering."
tags: ["NL2SQL", "Evaluation", "LLM Agent", "RAG"]
categories: ["Engineering"]
showWordCount: true
showReadingTime: true
showSummary: true
showAuthor: true
showDate: true

showDateOnlyInArticle : false
showDateUpdated : false
showHeadingAnchors : true
showPagination : false
showTableOfContents : true
showTaxonomies : true
showEdit: false
showViews: false
showLikes: false
layoutBackgroundHeaderSpace: false
---

{{< katex >}}

{{< accordion mode="open" separated=true >}}
  {{< accordionItem title="TL;DR" icon="circle-info" open=true >}}
- **Evaluation design**: 90 test cases, a read-only database sandbox, **single-turn interaction**, 3 generative models × 3 systems (`direct` → `direct+rag` → `harness`), each run once.
- **Retrieval is the only order-of-magnitude gain**: adding retrieval alone lifts EX from 6.9%~32.9% to 43.8%~54.8%, and lifts the behavior decision from the zero-ability line to 79%~90% balanced accuracy.
- **The output contract layer only buys a layer of post-processing**: its EX gain shrinks as the baseline's own executability rises (Qwen +11.0 → V3 +2.8 → flash 0.0, and only the Qwen point sits outside the jitter band). What it really fixes is **output hygiene**. In single-turn interaction, the Agent architecture's value is carried mainly by retrieval and the prompt.
- **Retrieval is, in essence, data processing over text**, and text is data too, so in the single-turn setting this Agent's value comes almost entirely from `text data engineering`. **Scope**: it covers single-turn SQL generation only, and leaves out multi-turn, exploration routing, execution and result analysis.
- **Abstention behavior is the most model-sensitive**: flash never abstains and its behavior collapses back to the zero-ability line, while Qwen is good at `clarify` and V3 at `refuse`. The main differences likely come from **post-training and decoding** rather than architecture.
  {{< /accordionItem >}}
{{< /accordion >}}


## 1. Background and Goal

The NL2SQL Agent translates natural-language questions into SQL queries. Its core design is to ask a clarifying question first when information is insufficient, mimicking real human interaction, rather than forcing an answer. The project started in March 2025, and a detailed write-up is in the portfolio: [NL2SQL Agent: Ask Before You Query](/portfolio/nl2sql-dify-case-study/).

Over the past year, the harness idea has grown more popular and models have kept getting stronger, which raised a question for me: does the NL2SQL Agent I built back then actually have an **ask-first advantage**? That question is what produced this evaluation design and evaluation.

{{< github repo="xifanz42/nl2sql_agent" showThumbnail=false >}}

## 2. Evaluation System Design

At first I used a golden-standard dataset of 90 cases and simply compared the NL2SQL Agent against a direct LLM call. The result was that the evaluation design was too crude, and **it could not evaluate the act of asking a clarifying question at all**. The main problems:

- **The dataset was not rigorous enough**: 13 cases referenced metrics that do not exist in the database, so every system would necessarily score 0 on them; 27 cases treated text columns as dates, even though in the database those date values are stored as text (this was deliberate, originally meant to test the NL2SQL Agent's ability).
- **The test-case design contradicted the test goal**: the dataset had only a question column and an expected-SQL column, so every case implicitly required SQL output. That scoring rule turned into **rewarding guessed SQL and punishing clarifying questions**, which is the exact opposite of the system's design goal.
- **The metric design was too narrow**: metrics focused on SQL-generation accuracy and schema consistency, which, just like the problems above, also **punished clarifying behavior**. A system that correctly asks the user a question would instead be marked as producing a wrong output.

So after several iterations, the later evaluation experiments follow two principles:
1. Every test case must state its **expected behavior** explicitly: answer directly with SQL, ask for clarification, or refuse to answer?
2. Metrics must not be aggregated into a single number, but evaluated along several dimensions.

The four sections below all describe the improved evaluation system design (dataset adjustments, test-case design, systems under test, metric design, and so on).

### 2.1 Dataset

The evaluation data is a **simulated** vehicle-KPI table `kpi_benchmark` for a port-logistics site, stored in PostgreSQL:

| Category | Content |
|---|---|
| Scale | 360 rows spanning 6 days (2025-08-15 ~ 08-20), all recorded at `00:00:00Z` |
| Dimensions | `vehicle_id`, `vehicle_type` (`AT` automated transfer vehicle / `MT` manual vehicle) |
| Metrics | 3 `index_category` values, 10 concrete metrics `index_name`, metric values `index_value` |

### 2.2 Test Case Design

#### 2.2.1 Expected-Behavior Categories
Building on the analysis above, the 90 test cases were split into 3 expected behaviors: answering the SQL query (`answer`), asking for clarification (`clarify`), and refusing to answer (`refuse`). The final split is **73 `answer`, 3 `clarify`, 14 `refuse`**.

| Situation | N | Expected behavior | Explanation |
|---|---|---|---|
| The user asks about a metric that does not exist in the database | 13 | `refuse`  | No executable query exists, so any answer would be fabricated |
| Depends on `CURRENT_DATE`, so results drift with the date | 1 | `refuse`  | No stable, reproducible correct answer |
| The question is vague, with several queryable directions | 3 | `clarify`  | The user needs to supply the metric or range |
| The rest | 73 | `answer`  | The question is clear and the data is sufficient |

#### 2.2.2 Difficulty Strata

Besides the behavior categories, the cases were also split into **difficulty strata** by the syntactic features of the SQL. Here `hard` concentrates on multi-condition filtering, subqueries and time aggregation, and this classification measures the **complexity of the query itself**.

| Stratum | Rule (any one qualifies) | N |
|---|---|---|
| `easy` | Single-table equality filter only | 3 |
| `medium` | Contains `GROUP BY`, `ORDER BY`, `LIMIT`, `BETWEEN`, `LIKE`, `DISTINCT`, `IN`, or multi-condition `AND` / `OR` | 46 |
| `hard` | Contains `JOIN`, subqueries (multiple `SELECT`), window functions (`OVER`, `WITHIN GROUP`, `FILTER`), `HAVING`, `EXTRACT`, `INTERVAL`, `CASE WHEN`, `UNION`, `STDDEV`, `CURRENT_DATE` | 24 |

### 2.3 Systems Under Test

Three systems take part in the evaluation, all driven by the same prompt template:

| System | Role | Prompt | Retrieval | Output contract layer |
|---|---|---|---|---|
| `direct` | Bare-LLM baseline | same as harness | no | no |
| `direct+rag` | Retrieval-augmented baseline | same as harness | yes | no |
| `harness` | The NL2SQL Agent project, the main target | same as harness | yes | yes |

**All three share** the same system prompt, the same schema injection, the same retrieval implementation, and the same generative model with the same decoding parameters. **Each case makes exactly one model call.** So only two independent variables remain between them:

- **Whether there is retrieval** (`direct` vs `direct+rag`)
- **Whether there is an output contract layer** (`direct+rag` vs `harness`)

#### 2.3.1 Output Contract Layer

A post-processing chain unique to `harness`. Its starting point is **distrust of the model's free text**: it treats the reply as a string to be parsed and reduces it, with sentinels, regexes and a whitelist, into a **binary outlet** the evaluation can read (SQL present / SQL absent).

| # | Component | Purpose |
|---|---|---|
| 1 | Three-way sentinel parsing | Splits on `SQL_QUERY:` / `请提供具体信息:` / `引导提问:` to decide which action the system chose |
| 2 | SQL extraction and normalization | Must contain `SQL_QUERY:`; strip markdown fences; cut at the first `;`; append `;` |
| 3 | SQL validation guardrail | Dangerous-keyword plus unknown-table check; on failure it returns an error message |

Note that here a SQL parse failure and a guardrail rejection are both marked as declining to answer in the later trials. That is indistinguishable, in the data, from the model itself declining because of insufficient information or an unreasonable request. This is why the quality axis and the behavior axis share the same outlet, and it is a precondition to keep in mind when attributing results in §3.3.3.

Two changes relative to the product implementation: the follow-up check short-circuits to False when there is **no conversation history** (in a single-turn evaluation it neither affects the prompt nor produces that helper call); and the generation temperature is changed from the product's 0.7 to **0.0**, to align with the baselines (see §2.3.3).

#### 2.3.2 Model Selection

The same three-system structure is run once on each of three generative models. Their structure and specs:

| Label | Provider | Model name | Architecture | Activated / total params | Notes |
|---|---|---|---|---|---|
| Qwen-Coder | SiliconFlow | `Qwen/Qwen3-Coder-30B-A3B-Instruct` | MoE (128 experts, 8 activated, GQA) | 3.3B / 30.5B | Code-specialized; 262K context |
| DS-V3 | SiliconFlow | `deepseek-ai/DeepSeek-V3` | MoE (256 routed experts + 1 shared; MLA; MTP) | 37B / 671B | General-purpose flagship; 128K context |
| DS-Flash | DeepSeek API | `deepseek-flash` (DeepSeek-V4.1-Flash) | Causal-Encoder-Decoder MoE (asymmetric input/output) | 8B input / 16B output / 552B | Lightweight general tier; natively multimodal; non-thinking mode in this article |

These three models cover three **shapes**: **activation scale** (3.3B activated vs 37B activated), **domain bias** (code-specialized vs general), and **cost tier** (light vs flagship).

Note that `flash`'s "lightweight" refers to its **activation scale and cost tier**, not its total parameters. Its Causal-Encoder-Decoder architecture pushes input-side activation down to 8B and output-side to 16B, and greatly compresses the KV Cache, so both unit price and cache cost are lower. All three accept the same set of decoding parameters (`temperature=0`, `max_tokens=4096`), and the DeepSeek endpoint has thinking mode turned off (§2.3.3).

{{< alert icon="circle-info" >}}
Model spec sources: `Qwen3-Coder-30B-A3B` and `DeepSeek-V3` from their public model cards; `DeepSeek-V4.1-Flash` from the [official DeepSeek announcement](https://api-docs.deepseek.com/zh-cn/news/news260910/) (2026-09-10).
{{< /alert >}}

#### 2.3.3 Other Controlled Variables

| Variable | Value | How it is controlled |
|---|---|---|
| system prompt | Identical | Shared `render_prompt`, compared by a test assertion |
| schema injection | Identical | `render_prompt` inlines `schema_info` |
| Retrieval | `direct` none; the other two share one function | `direct+rag` calls the agent's own `retrieve_knowledge` |
| Generative model | Same model within a run | Fixed by `--provider/--model`, written to the ledger |
| `temperature` | **0.0** | `call_coder` and the baseline request read the same constants, so they cannot drift apart |
| `max_tokens` | **4096** | Identical for both, to avoid truncation from a lower cap |
| Thinking mode | **Off** | `extra_body={"thinking": {"type": "disabled"}}` (only the DeepSeek endpoint has this switch) |
| Conversation history | Always empty | Single-turn evaluation |
| Database | Read-only role | A least-privilege connection from `EVAL_DATABASE_*` |

### 2.4 Metric Design

Building on the first round of evaluation, the metric design is now split into 3 groups.

One group is the metrics most common in the NL2SQL literature, used to score the quality of the SQL expression, the **quality metrics**. Another is the group this evaluation mainly tests, which scores the relationship between the system's behavior and the expected behavior, the **behavior metrics**. Besides those, there is a group of cost-related **economic metrics** covering response latency, tokens and LLM calls, used to judge whether using the NL2SQL Agent is economical.

#### 2.4.1 Quality Metrics

| Metric | Definition | Direction |
|---|---|---|
| `valid_sql` | SQL syntactic validity (whether it runs) | up |
| `exact_match` (EM) | Exact match: the string equals the reference SQL | up |
| `execution_match` (EX) | Execution match: after execution, the result set equals the reference result | up |
| `schema_adherence` | Data-model consistency: referenced tables and columns all exist in the database schema | up |
| `EX@answered` | Conditional execution match: EX computed only on cases the system **actually answered** | up |

Besides the four conventional quality metrics, this round introduces `EX@answered` (Conditional EX). The reason is that only **73** of the 90 cases are truly answerable, while the other 17 expect a clarifying question or a refusal. So the EX computed directly over the answerable set (N=73) actually aggregates two independent abilities:

- **Willingness to answer** (coverage)
- **Accuracy when answering** (`EX@answered`)

The three quantities EX, EX@answered and Coverage always satisfy:

\[ \mathrm{EX} = \mathrm{Coverage} \times \mathrm{EX@answered} \]

Note that \(\mathrm{EX} = \mathrm{EX@answered}\) holds if and only if \(\mathrm{Coverage} = 100\%\).

#### 2.4.2 Behavior Metrics

Because the system's **clarifying questions** and, conversely, its **refusals to answer** would be judged as wrong behavior and penalized by the quality metrics above, a separate set of metrics is needed to score the system's behavior. My approach here is to borrow from data science and statistics and reduce it to a standard **binary classification** problem: treat "the system should answer" as the **positive class**, so each case ends in one of only two behaviors:
1. Answer (`answer`, 73 cases)
2. Do not answer (`clarify` + `refuse`, 17 cases).

That gives a standard 2×2 confusion matrix:

| | Actual: answered | Actual: not answered |
|---|---|---|
| **Expected: answer** | TP  | FN  |
| **Expected: not answer** | FP  | TN  |

This is in fact a classic, standard binary-classification problem, so the metrics it yields are the usual statistical ones. This evaluation simply gives them domain names, so the derivations are omitted:

| Domain name | Standard statistic | Formula | Denominator (conditional sample space) | Direction |
|---|---|---|---|---|
| `presumption_rate` | False positive rate **FPR** | \( \dfrac{FP}{FP+TN} \) | 17 (should not answer) | down |
| `over_clarify_rate` | False negative rate **FNR** | \( \dfrac{FN}{FN+TP} \) | 73 (should answer) | down |
| `policy_accuracy` | **Accuracy** | \( \dfrac{TP+TN}{N} \) | 90 (all) | up |
| `balanced_accuracy` | **Balanced Accuracy** | \( \dfrac{\mathrm{TPR}+\mathrm{TNR}}{2} \) | 90 (all) | up |

Specificity **TNR** \(= TN/(TN+FP) = 1-\mathrm{FPR}\) is the other side of the same coin as the presumption rate, so below it is recorded uniformly as "not-answer recall" and not listed as a separate metric.

Note that `policy_accuracy` (Accuracy) can only be a reference, because it folds the dataset's **class mix** into the score: Accuracy is a weighted average of \(\mathrm{TPR}\) and \(\mathrm{TNR}\) with the **class prior** \(\pi = P(\text{should answer})\) as the weight, and \(\pi\) is set by the dataset, not by system ability. This article therefore also introduces `balanced_accuracy`, which averages the two class recalls with equal weight to remove that weighting. **The derivation of this metric and its measured comparison on this data are in §3.3.2.**

#### 2.4.3 Cost Metrics

Cost has to answer two different questions, so it is split into two groups: **economic cost** decides "is this system worth deploying", and **experience cost** decides "can the user stand the wait". All are measured over the 90 cases:

| Group | Metric | Meaning | Use |
|---|---|---|---|
| Economic | **calls per case** | How many LLM requests each case makes on average | All three are 1 (the follow-up check short-circuits without conversation history, so it makes no call) |
| Economic | **tokens per case** | Total input + output tokens per case | Measures context size |
| Economic | **cached share** | Share of input tokens that hit the provider's prompt cache | Affects unit price: the cached part is billed at the cache price |
| Economic | **cost per 1k cases** | Spend per thousand cases, in CNY (= per-case cost × 1000) | Estimated from token counts × a dated price list, see below; this article reports costs in this unit throughout |
| Experience | **latency p50 / p95** | Median / 95th percentile of end-to-end response time | The wait the user actually feels |

Do not conflate the two. In the measurements their **drivers are almost orthogonal**: tripling the input tokens raises p50 by only 0.05–0.18 s, while switching model or provider tier is a factor of 3.8 (§3.4).

The per-case cost is computed as

\[ \mathrm{Cost} = \frac{(\text{prompt} - \text{cached}) \cdot p_{in} \;+\; \text{cached} \cdot p_{cache} \;+\; \text{completion} \cdot p_{out}}{10^{6}} \]

where \(p_{in}, p_{cache}, p_{out}\) are the unit prices for input / cached input / output (CNY per 1M tokens), recorded in `app/eval/pricing.py` with sources and dates (SiliconFlow 2026-09; DeepSeek official 2026-10).

{{< alert icon="circle-info" >}}
**Price is an external variable.** A cost figure holds only for this dated price list; latency and call counts are not part of **economic cost**.

The [DeepSeek API price](https://api-docs.deepseek.com/zh-cn/quick_start/pricing) also **fluctuates by time of day** (Beijing time, weekdays 09:00–12:00 and 14:00–18:00 are peak; other hours, weekends and holidays are **half price**). The price list takes the **peak** price, so the DeepSeek cost figures are an **upper bound**, not a lower bound.
{{< /alert >}}

## 3. Results

### 3.1 Overall Table

The table below is all nine cells (the 3 × 3 model-by-system combinations); the denominator for `Coverage` is the 73 answerable cases. **Cost and latency are not on this axis**, they form their own group (§3.4). The per-metric breakdown is in §3.2–§3.4.

| Model | System | EX | EX@answered | Coverage | `valid_sql` | presumption rate down | over-clarify rate down | policy accuracy | balanced accuracy |
|---|---|---|---|---|---|---|---|---|---|
| Qwen3-Coder | `direct` | 6.9% | 20.8% | 32.9% | 26.0% | 17.6% | 67.1% | 42.2% | 57.6% |
| | `direct+rag` | 43.8% | 48.5% | 90.4% | 76.7% | 11.8% | 9.6% | 90.0% | 89.3% |
| | `harness` | **54.8%** | 59.7% | 91.8% | 90.4% | 11.8% | 8.2% | 91.1% | 90.0% |
| DeepSeek-V3 | `direct` | 9.6% | 58.3% | 16.4% | 16.4% | **5.9%** | **83.6%** | 31.1% | 55.3% |
| | `direct+rag` | 53.4% | 62.9% | 84.9% | 79.5% | 5.9% | 15.1% | 86.7% | 89.5% |
| | `harness` | 56.2% | **67.2%** | 83.6% | 83.6% | 17.6% | 16.4% | 83.3% | 83.0% |
| deepseek-flash | `direct` | 32.9% | 32.9% | 100.0% | 97.3% | **100.0%** | 0.0% | 81.1% | 50.0% |
| | `direct+rag` | 54.8% | 54.8% | 100.0% | 89.0% | 41.2% | 0.0% | 92.2% | 79.4% |
| | `harness` | 54.8% | 55.6% | 98.6% | 87.7% | 29.4% | 1.4% | **93.3%** | 84.6% |

The relationship between the three systems forms a chain:

```
direct  ──add retrieval──▶  direct+rag  ──add output contract layer──▶  harness
```

#### 3.1.1 Reading Preconditions

Measured drift from repeated runs of the same configuration:

| Model · System | EX, first pass | EX, second pass | Δ EX | Δ balanced accuracy | Δ policy accuracy |
|---|---|---|---|---|---|
| Qwen · `direct` | 9.6% | 6.9% | −2.7 | +5.2 | +1.1 |
| Qwen · `direct+rag` | 48.0% | 43.8% | −4.1 | +2.3 | 0.0 |
| V3 · `direct` | 9.6% | 11.0% | +1.4 | −0.2 | +3.3 |
| V3 · `direct+rag` | 53.4% | 49.3% | −4.1 | −2.9 | −1.1 |
| V3 · `harness` | 56.2% | 54.8% | −1.4 | +1.5 | −1.1 |

With the same configuration, the same prompt and `temperature=0`, the metrics still drift. The reason is that one component (TNR) has a denominator of only 17, so a single case is 5.9%. This is not a flaw in the experiment; it is **the default property of any single-run LLM evaluation**: `temperature=0` is only "greedy decoding", and server-side MoE expert routing and continuous batching still introduce jitter.

So **differences below roughly 5 percentage points should not be interpreted**. This is the reading precondition for every conclusion in this article.

#### 3.1.2 Net Effect of the Contract Layer

From `direct+rag` to `harness`, the only architectural variable that is added is the output-contract-layer processing. And the output contract layer leaves a trace in only these three places, all far smaller in magnitude than retrieval:

| Model | ΔEX | Δ`valid_sql` | Δ balanced accuracy |
|---|---|---|---|
| Qwen | **+11.0** (43.8 → 54.8) | +13.7 (76.7 → 90.4) | +0.7 (89.3 → 90.0) |
| V3 | +2.8 (53.4 → 56.2) | +4.1 (79.5 → 83.6) | −6.5 (89.5 → 83.0) |
| flash | 0.0 (54.8 → 54.8) | −1.3 (89.0 → 87.7) | +5.2 (79.4 → 84.6) |

From the differences of each metric between `direct+rag` and `harness`:

**The contract layer's gain has very few detectable points.** Only under the Qwen model does the system change reach a gain of +11.0. This is because the contract layer essentially **solves an output-hygiene problem**: Qwen goes from 10 broken cases to 1, V3 from 4 to 0, and flash's 8 cases stay at 8. Whether it can be fixed depends on how hygienic the model's output is, which is exactly why its EX increment is detectable only under Qwen. On cost, this layer costs nothing at all; it is a purely software-side post-processing step.


### 3.2 Quality Metrics

#### 3.2.1 EX

![Execution match EX: three models × three systems](/reports/nl2sql-eval/en/fig1-ex.png?v=2)

Using the three components from §2.4.1, each EX cell can be decomposed (\(n_A\) is the number of answered cases among the 73 answerable, \(c\) the number of those with a correct result set; it always holds that \(\mathrm{EX} = \mathrm{Coverage} \times \mathrm{EX@answered}\)):

| Model · System | \(n_A\) | \(c\) | \(\mathrm{EX}=c/73\) | \(\mathrm{EX@answered}=c/n_A\) | \(\mathrm{Coverage}=n_A/73\) |
|---|---|---|---|---|---|
| Qwen · `direct` | 24 | 5 | 6.9% | 20.8% | 32.9% |
| Qwen · `direct+rag` | 66 | 32 | 43.8% | 48.5% | 90.4% |
| Qwen · `harness` | 67 | 40 | 54.8% | 59.7% | 91.8% |
| V3 · `direct` | 12 | 7 | 9.6% | 58.3% | 16.4% |
| V3 · `direct+rag` | 62 | 39 | 53.4% | 62.9% | 84.9% |
| V3 · `harness` | 61 | 41 | 56.2% | 67.2% | 83.6% |
| flash · `direct` | 73 | 24 | 32.9% | 32.9% | 100.0% |
| flash · `direct+rag` | 73 | 40 | 54.8% | 54.8% | 100.0% |
| flash · `harness` | 72 | 40 | 54.8% | 55.6% | 98.6% |

From the table above:

1. **Retrieval is the largest single gain**: with the same model and the same prompt, adding RAG alone raises EX substantially.
2. **But the way each model degrades without retrieval is different**:
   - Qwen **guesses but guesses wrong** (answers only 24 cases, `EX@answered` just 20.8%);
   - V3 **answers conservatively** (answers only 12 cases, yet `EX@answered` is 58.3%);
   - flash **answers everything with full confidence, blindly** (all 73 answerable cases answered, and all 17 unanswerable cases also turned into SQL).

#### 3.2.2 Executability

The denominator of `valid_sql` is the 73 answerable cases, so it reads as "how many cases produced SQL that runs". Here, using the same approach as `EX@answered`, we split out conditional valid SQL: \[P(\text{executable} \mid \text{answered})\]

Like EX, `valid_sql` decomposes into two independent factors:

\[ \mathrm{valid\_sql} = \mathrm{Coverage} \times P(\text{executable} \mid \text{answered}) \]

| Model · System | answered /73 | executable /73 | `valid_sql` | answered but won't run | executable given answered |
|---|---|---|---|---|---|
| Qwen · `direct` | 24 | 19 | 26.0% | 5 | 79.2% |
| Qwen · `direct+rag` | 66 | 56 | 76.7% | 10 | 84.8% |
| Qwen · `harness` | 67 | 66 | **90.4%** | **1** | **98.5%** |
| V3 · `direct` | 12 | 12 | 16.4% | 0 | 100.0% |
| V3 · `direct+rag` | 62 | 58 | 79.5% | 4 | 93.5% |
| V3 · `harness` | 61 | 61 | 83.6% | 0 | 100.0% |
| flash · `direct` | 73 | 71 | 97.3% | 2 | 97.3% |
| flash · `direct+rag` | 73 | 65 | 89.0% | 8 | 89.0% |
| flash · `harness` | 72 | 64 | 87.7% | 8 | 88.9% |

After this further decomposition of `valid_sql`, we can answer "among the generated SQL that runs, how good is the SQL?". The table shows that **adding RAG makes the model more willing to answer, but does not improve the quality of the SQL expression**. Coverage goes 16.4% → 32.9% → 100.0% up to 84.9% → 90.4% → 100.0%; but V3 and flash's P(executable | answered) actually regress, and Qwen is the only one that rises.
Looking at the run logs, the failures fall into two kinds: `SyntaxError`, and calls to functions that do not exist in the database (`UndefinedFunction`). The two are different in nature:

- **Qwen's syntax errors are almost all markdown fence leakage.** It wraps the SQL in ` ``` ` and outputs it, so Postgres reports `syntax error at or near "```"`. This is not wrong SQL, it is an **output hygiene** problem; `harness`'s contract layer strips the fences, which is exactly why it fixes those 10 cases down to 1 (§3.1.2). But narrowing the scope to **executable** SQL, Qwen is still the worst on `hard` (3/13), so its gap is "**output hygiene + genuinely wrong SQL**" stacked together.
- **flash's failures are all missing functions.** Once retrieval injects the schema and the metric descriptions, flash starts writing more complex aggregations, but calls functions that do not exist in the database.

### 3.3 Behavior Metrics

In the dimensions below we only look at whether the system chose **answer** or **abstain** on each question, which is unrelated to whether the SQL was accurate. A system can output a correct SQL expression and still be guessing on every answer.

#### 3.3.1 Presumption Rate and Over-Clarify Rate

![The two error rates on the behavior axis](/reports/nl2sql-eval/en/fig4-behavior-bars.png?v=2)

The left side of the figure is the **presumption rate** (of the 17 cases that should be declined, how many were answered), and the right side is the **over-clarify rate** (of the 73 cases that should be answered, how many were questioned). The dashed line represents the "judge nothing" extreme: answer everything gives a presumption rate of 100%, decline everything gives an over-clarify rate of 100%.

Looking at the left side alone, qwen3-coder and v3 both do well (17.6% & 5.9%), meaning they do not rush to output SQL on unclear questions. But **the price of their low presumption rate is the highest over-clarify rate in the table (67.1% & 83.6%)**. By contrast, flash sits at the other extreme: an extremely low over-clarify rate (close to 0 in all three systems), at the price of the highest presumption rate in the table.

From the system's point of view, adding retrieval clearly helps. Which side it improves depends on which extreme the model was stuck at: Qwen and V3 were stuck at "over-clarify", so retrieval mainly improves that side (Qwen from 67.1% → 9.6%, V3 from 83.6% → 15.1%); flash's over-clarify rate was already 0%, so retrieval improves its presumption rate instead (100.0% → 41.2%).

Because the presumption rate and the over-clarify rate are driven by the same "should I answer" threshold, the scatter plot below shows each system under each model more directly:

![Behavior axis: presumption rate × over-clarify rate](/reports/nl2sql-eval/en/fig4-behavior-plane.png?v=2)

In this plot the x-axis is the presumption rate and the y-axis the over-clarify rate. The ideal outcome is a system with **complete question recognition and correct behavior decisions**, i.e. the **origin at the bottom left** (the ideal point). The worst case is a system with no ability to tell questions apart, which lands on the dashed line in the figure (the zero-ability line). flash `direct` is the measured sample of exactly that: all 17 unanswerable cases were turned into SQL (presumption rate 100.0%), while not one was questioned (0.0%), so behaviorally it is fully equivalent to "always answer", a zero-ability classifier. From these 3 scatter plots, retrieval's (RAG's) improvement to system ability is more visible: whichever model a system uses, the `direct+rag` system is closer to the origin.

#### 3.3.2 Balanced Accuracy

Now let us look at the three systems' output from the angle of policy accuracy. Because the TP and TN samples in these test cases are not balanced, this article also introduces `balanced_accuracy`, which averages the two class recalls with equal weight. (See §2.4.2 for the behavior metrics.)

A concrete comparison shows why balanced accuracy is the better metric to read. Under the flash model, the `direct` system's policy accuracy is **81.1%** (exactly the majority-class share, 73/90), while its balanced accuracy is **50.0%**. Reading only policy accuracy, one would think the system's behavior decisions were decent; reading balanced accuracy, one sees that the system's behavior ability is 0 (see the figure).

![Balanced accuracy: three models × three systems](/reports/nl2sql-eval/en/fig2-balanced-accuracy.png?v=2)

The figure is the balanced accuracy after averaging the two class recalls with **equal weight**; the dashed line is the zero-ability line. Landing on the line means **the system's behavior decisions are no better than random guessing**.

The figure shows that all three systems' `direct` stops near the zero-ability line, within 8% of each other, and the gap between neighbors is less than a single case on the TNR side (1/17 = 5.9%), so all that can be read here is "**none of them has behavior-decision ability**".

After adding retrieval, the three systems' behavior-decision ability rises to 79.4%, 89.3% and 89.5% respectively, about a 30% improvement over each system's own `direct`. The mechanism makes sense: without retrieval, the model cannot tell "whether this metric name exists, whether the question has a unique solution", so it can only guess; retrieval turns "should I decline" from a guess into something judgeable.

Combining balanced accuracy with the presumption rate and over-clarify rate above, we can see that **adding retrieval can substantially raise a system's behavior-decision level**.

#### 3.3.3 Abstention Behavior

In this experiment there are 90 test cases in total, split by expected behavior into three kinds (§2.2.1): **73 that should be answered**, **14 that should be refused** (`refuse`, asking about metrics that do not exist in the database) and **3 that should be clarified** (`clarify`, the question itself being ambiguous). What this subsection calls "abstention" refers to the **17** test cases where the system should not output SQL.

![Abstention ability: how many of refuse and clarify are answered correctly](/reports/nl2sql-eval/en/fig3-abstention.png?v=4)

The figure shows abstention behavior in detail: **the x-axis is the three models, and in each group the three bars from left to right are `direct`, `direct+rag`, `harness`**; the left panel is the 14 `refuse` cases and the right panel the 3 `clarify` cases; the closer to the dashed line, the more the behavior matches the expectation.

Looking at the detailed output logs, although both expected behaviors are classed as abstention, they are essentially different abilities, provided by two different things:

| Ability | Missing | Provided by | In practice |
|---|---|---|---|
| `refuse` | Which metrics actually exist in the database | Business text in the knowledge base | Rises sharply once **retrieval** is added, and by `harness` all three are level at **12/14** (`flash` starts from 0: **0 → 10 → 12**) |
| `clarify` | The user's real intent | The user's reply in multi-turn interaction | flash is 0/3 throughout, while Qwen is 3/3 throughout |


Going back to the logs and querying the detailed output, we can see that on the negative test cases, qwen and V3 both managed to ask clarifying questions, for example:

> **Qwen** (case 55): 请提供具体信息: 您希望查询哪一天的数据？或者您是否有特定的指标名称（index_name）和指标类别（index_category）？
>
> (Ask for specific information: which day's data would you like to query, or do you have a particular metric name (`index_name`) and metric category (`index_category`)?)
>
> **V3** (case 60): 引导提问: 请问您想查询哪个具体的指标名称(index_name)？因为表中有多个指标类别(index_category)和指标名称(index_name)，需要明确要对比的具体指标。
>
> (A guiding question: which specific metric name (`index_name`) would you like to query? The table has several metric categories (`index_category`) and metric names (`index_name`), so the specific metric to compare needs to be specified.)

By contrast, flash indiscriminately produced hypothetical SQL output for all 90 questions, for instance defaulting a missing range to the whole table (`把缺失的范围默认成"整表"`) or a missing time to a concrete time slice (`把缺失的时间默认成具体的时间切片`). This is very close to flash's failure mode in §3.2.2.

### 3.4 Cost

Cost metrics are split into two groups here: **economic cost** (how much each case costs) and **experience cost** (how long each case takes).

#### 3.4.1 Economic Cost
Start with the detailed table, where:
- **input tokens** = system prompt + schema injection + retrieved knowledge + user question;
- **output tokens** = the SQL or clarifying text the model actually generated this time;
- **cached share** = the share of input that hit the provider's prompt cache (the cached part is billed at the lower cache price).

| Model · System | calls / case | input tokens / case | output tokens / case | total | cached share | **CNY / 1k cases** |
|---|---|---|---|---|---|---|
| Qwen · `direct` | 1.0 | 438 | 54 | 492 | 94.0% | 0.46 |
| Qwen · `direct+rag` | 1.0 | 1,509 | 48 | 1,557 | 84.0% | 1.19 |
| Qwen · `harness` | 1.0 | 1,509 | 48 | 1,557 | 96.0% | 1.19 |
| V3 · `direct` | 1.0 | 425 | 52 | 476 | **0.0%** | 1.26 |
| V3 · `direct+rag` | 1.0 | 1,404 | 65 | 1,470 | **0.0%** | 3.33 |
| V3 · `harness` | 1.0 | 1,404 | 66 | 1,470 | **0.0%** | 3.34 |
| flash · `direct` | 1.0 | 427 | 52 | 479 | 60.0% | 0.77 |
| flash · `direct+rag` | 1.0 | 1,406 | 62 | 1,469 | 74.0% | 1.28 |
| flash · `harness` | 1.0 | 1,406 | 65 | 1,471 | 84.0% | 1.02 |

For readability, costs below are reported uniformly in CNY per 1k cases.

![Economic cost (CNY / 1k cases): three models × three systems](/reports/nl2sql-eval/en/fig5-cost.png?v=2)

The figure shows that, because each system runs **only a single turn** in this test, `harness` and `direct+rag` cost almost the same per 1k cases. The main reason is that the output contract layer is a purely software-side change and produces no tokens. **Adding retrieval greatly increases the input**, which is what drives cost up. Beyond that, the remaining cost differences come mainly from the provider. For example, V3 on SiliconFlow has a 0% cache hit rate, so all its input is billed at full price. And flash, because caching works, is actually cheaper than V3.

In summary, the most expensive of the three is the `harness` system on V3, at CNY 3.34 per 1k cases. At ten thousand calls a day, that is roughly CNY 33/day; switching to the Qwen model at the same volume costs about CNY 12/day.

#### 3.4.2 Experience Cost

![Experience cost: latency p50 (solid) and p95 (hollow)](/reports/nl2sql-eval/en/fig6-latency.png?v=3)

The figure shows directly that latency is set almost entirely by the **model or provider, and is unrelated to input length**. The clearest evidence is that after adding retrieval, none of the three models' latency changed noticeably. What is worth noting is that flash's latency is the smallest of the three, only a quarter of V3's.

Putting the two together: **adding retrieval "costs a little money and almost no experience", while the model or model provider is the main source of economic-cost differences.**

## 4. Conclusion

### 4.1 Conclusion

Putting the three metric groups of §2.4 together, the conclusions are as follows.

**On the quality dimension, retrieval is the only order-of-magnitude gain**: with the same model and the same prompt, adding retrieval alone lifts EX from 6.9%/9.6%/32.9% to 43.8%/53.4%/54.8%. And the output contract layer in the architecture is only text processing on the final output; its gain shrinks as the system's own executability rises, for instance the EX increment on `direct+rag` shrinks from Qwen's +11.0 to V3's +2.8, then to flash's 0.0.

**On the behavior dimension, retrieval is just as important.** It lifts behavior decisions from the zero-ability line to 79.4% to 89.5% balanced accuracy, and fills in the `refuse` class of tasks to 12/14. But it must still be made clear that `clarify` and `refuse` are two abilities: the former is decided by the model throughout (Qwen 3/3, flash 0/3), while only the latter is a retrieval gain (§3.3.3).

**On the cost dimension, retrieval can be called cheap and nearly free in experience.** Input tokens rise to about 3.4×, but cost per 1k cases stays within CNY 3.34, and latency barely changes. The cost differences are mainly set by the provider's unit price and caching policy, unrelated to the three systems under test.

In short, **in single-turn conversation, the NL2SQL Agent architecture's value is carried mainly by retrieval and the prompt**. The part of its architecture that handles multi-turn interaction, information integration and output was not in scope this time, so extrapolation should be cautious (see §4.3).

The reason **retrieval**'s gain in single-turn generation is so pronounced is that **it is essentially data processing**, only over "text" rather than the tabular data (tabular data) that traditional data analysis is used to. Bringing these unstructured / semi-structured data, the database schema, metric definitions and business rules, through business analysis, text distillation and retrieval on demand, and finally feeding them to the model, this whole flow is itself another data pipeline. So the value of this NL2SQL Agent in single-turn conversation can be said to come almost entirely from `text data engineering`.


### 4.2 How Model Selection Affects the Results

In §2.3.2 I explained this selection, which was meant to cover three possible influencing factors: activation scale, domain bias and cost tier. After the experiment we can see that these three axes affect the results to different degrees.

1. **Activation scale affects SQL quality, but the difference is only between Qwen and the other two.** Splitting the 73 answerable cases by difficulty:

| | Qwen | flash | V3 |
|---|---|---|---|
| output-side activated params | 3.3B | 16B (output side) | 37B |
| `medium` EX | 57% | 67% | 65% |
| `hard` EX | 12% | 25% | 25% |

Qwen lags systematically on both `medium` and `hard` (9~13pp, beyond §3.1.1's jitter band), while V3 and flash show no measurable difference. So the real parameter step is: the 3.3B tier versus anything above ten-odd B; further up (16B → 37B) there is no extra gain. Also, Qwen is a code-specialized model yet is the worst on `hard`, which suggests the real bottleneck on `hard` cases may be schema understanding and assembling multiple clauses, not whether the model can write code.

2. **The abstention-behavior differences are rooted in each model's own training and decoding, not in architecture.** All three models are MoE, using the same prompt and retrieval, yet their abstention decisions are completely different:
   - **Decoding mode**: this time flash's thinking mode was turned off, so it guesses directly on ambiguity; on `direct` it **outputs 90/90 SQL statements**, sending its behavior straight back to the zero-ability line. This was verified separately in the project: with the same flash, simply turning thinking on drops `direct+rag`'s presumption rate from 41.2% to 17.6% and `harness`'s from 29.4% to 11.8%.
   - **Post-training**: "whether to ask" is closer to a behavior preference shaped by post-training; DeepSeek's official documentation also states that flash went through larger-scale reinforcement-learning post-training. Still, even with thinking on, flash's refuse on `direct` is still 0/14, so the decoding mode is only one reason.

3. **Cost has nothing to do with model ability, only with the provider tier.** When each case runs a single turn, the price differences come almost entirely from the provider's unit price and caching policy, not from the systems under test.

One-line summary: model selection's influence concentrates in two places. On **SQL correctness**, Qwen lags systematically behind V3/flash; on **abstention policy**, it is decided by the model's own decoding and post-training. A system's running cost, meanwhile, is tied to the provider tier.
