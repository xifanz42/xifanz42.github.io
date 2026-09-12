---
title: "NL2SQL Agent：先问清楚，再查数据库"
date: 2026-09-11
draft: false
summary: "一个自研的 agent：遇到含义模糊的提问，它会先停下来追问澄清，再生成 SQL——而不是像大多数 NL2SQL chatbot 那样直接靠猜。它由一个小分类器、一个专职的 SQL coder，以及一份业务视角的数据库字典构成，用来处理真实场景里的 schema 歧义。"
translationKey: ""
tags: ["项目复盘", "独立开发"]
categories: ["项目案例"]
# menu: footer
showDate : false
showDateOnlyInArticle : false
showDateUpdated : false
showHeadingAnchors : false
showPagination : false
showReadingTime : true
showTableOfContents : true
showTaxonomies : false 
showWordCount : true
showSummary : true
showAuthor: true
sharingLinks : false
showEdit: false
showViews: false
showLikes: false
layoutBackgroundHeaderSpace: false
---

{{< keywordList >}}
{{< keyword icon="check" >}} Translated by **AI** {{< /keyword >}}{{< keyword icon="edit" >}} Reviewed by **Human** {{< /keyword >}}
{{< /keywordList >}}

## TL;DR
一个自研的 agent：遇到含义模糊的提问，它会先停下来追问澄清，再生成 SQL——而不是像大多数 NL2SQL chatbot 那样直接靠猜。它由一个小分类器、一个专职的 SQL coder，以及一份业务视角的数据库字典构成，用来处理真实场景里的 schema 歧义。

{{< carousel images="gallery/*" aspectRatio="16.5-9" interval="2500" >}}

{{< github repo="xifanz42/nl2sql_agent" showThumbnail=false >}}


## 1. 项目背景

### 灵感来源

这个项目源自我第一次创业试水的那段经历——2024年底，我们打算用 [Dify](https://github.com/langgenius/dify) 搭一套多智能体咨询系统。当时我把 [Dify](https://github.com/langgenius/dify) 的能力从头到尾摸了一遍，发现了一个核心限制：

> 它并不支持真正的 agentic loop（智能体循环）。

Chatflow 可以让你设计出很丰富的节点和分支序列，但这条序列必须提前手工画好。模型本身没有能力在运行时判断：手上的信息够不够动手，还是应该先停下来询问用户。

所以，我基于它搭出来的那套"多智能体系统"，实际上只是一条顺序执行的 chatflow——每一步都是一个挂着若干外部工具或 MCP 的 LLM，而不是一个能和用户来回交互的 agentic system。

当用户的问题只能靠查询关系型数据库（PostgreSQL 等）来回答时，这个问题会更明显：一个无法暂停、无法追问的 chatbot，只剩一个选择——猜。

一个典型的翻车案例长这样：

> 用户：我想知道平均停止时长是多少
>
> Chatbot：*泰国红色车辆*的平均停止时长是……

显然，用户并没有给 `平均停止时长` 下定义。因为整条流程没有办法停下来追问澄清，chatbot就只能用自己的假设把这个缺口补上了。结果看起来像幻觉，但它其实不是——模型并非凭空编造，它只是做了这套架构允许它做的唯一一件事。


### 前提假设

这里我必须先引入一个关键假设（或者说现实）：

> [!quote] 消费者是无知的，并且提不出正确的问题
> 消费者没有能力澄清自己的核心需求，因为他们天然掌握的信息有限。因此，在最开始的几轮对话里，他们通常没法输入一个清晰、正确的问题（prompt）。


### 归因分析

在上述假设之下，这套系统失败的第一个原因就很清楚了——数据科学里那个著名的说法：**garbage in, garbage out**。只不过这里的 garbage 不再是*数据*，而是*文本*。

第二个原因更系统性、也更关键。从 2024 年底到 2025 年初，[Dify](https://github.com/langgenius/dify) 仍处在高速迭代中。搭在它之上的复杂系统，必然会把 [Dify](https://github.com/langgenius/dify) 自身的缺陷继承成自己的系统性缺陷。没有真正的 **agentic loop**，我们的系统就无法在用户给出错误输入时澄清真正的需求，响应可靠性也随之被进一步削弱。


### 小结

归根结底，根因来自两个方面：

1. 输入不清晰
2. 系统性缺陷

因此，这个 **NL2SQL Agent** 项目要解决的，就是前面那套多智能体系统里最核心的模块，让数据库查询这件事更可靠一些。

项目的目标用户是：任何想和数据库交互、但不了解数据库细节的人。

## 2. 解决方案

2025 年初，我认为最优解是自己手写一套最小化的 agent 架构——它要带对话记忆，并且能自行判断用户的输入是否足以生成 SQL。

所以我着手设计的第一件事，就是让这个 agent 由多个大模型驱动，每个模型各司其职。我预定义了三种任务——或者说是三种角色：

1. 一个小助手，负责两件简单的事：
   - 对用户的问题做分类
   - 判断用户是否需要进一步澄清
2. 一个 coder，只负责生成 SQL
3. 一个 reasoner，负责综合出最终回复

除此之外，还有一块 context engineering 的工作。除了常规的 RAG（embedding、chunking、retrieving 等），怎么把数据库 schema 讲清楚，是另一个关键点。

现实中，同一个数据库里可能存在多个列名相似、但业务含义略有差异的字段。这是 LLM 自造答案的另一个来源。为了解决它，我当时的方案是准备一份人工撰写的**数据库字典**，默认喂进 RAG 管线。这份字典至少应该包含以下信息：

- 数据字段名（列名）
- 数据类型
- 数据单位
- 示例值（few-shot 示例）
- 简短的业务解释

后来我发现，下面这些信息是可选的，但能把数据边界定义得更清楚，从而进一步提升表现：

- 数据类别（如果是分类字段）
- 数据范围（如果是数值字段）

按这个设计，agent现在既能更好地追问、澄清查询意图，也从业务视角对数据库有了更好的理解。

## 3. 系统架构

更详细的系统架构如下：

<!-- [改动 2026-09-11] 中文版换用中文架构图 system_arch_zh-cn.png（英文版对应 system_arch_en.png） -->
{{< figure src="/img/nl2sql/system_arch_zh-cn.png" alt="" >}}

这个 agent 同时支持 Web 界面和 CLI。除了核心工作流之外，它也支持一般的探索式交互。

## 4. Demo演示

最后，是一段Demo演示。

在这段视频里，我故意先问了一个关于 `error logs` 的模糊问题。agent 并没有直接调用 coder 去生成 SQL 并查询数据库，而是先反问了一句：`你找的是通用的错误日志，还是某台特定车辆的日志`。我回答说要找特定车辆的。随后 agent 继续追问，把范围一步步收窄。

<video controls muted playsinline preload="metadata" width="100%" poster="/img/nl2sql/cover.png">
  <source src="/video/nl2sql-demo.mp4" type="video/mp4">
  你的浏览器不支持 video 标签。
</video>

{{< github repo="xifanz42/nl2sql_agent" showThumbnail=false >}}