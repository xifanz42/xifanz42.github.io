---
title: "NL2SQL Agent: Ask Before You Query"
date: 2026-09-11
draft: false
summary: "A self-built agent that pauses to ask clarifying questions before generating SQL — instead of guessing at ambiguous requests like most NL2SQL chatbots do. Built on a small classifier, a dedicated SQL coder, and a business-context database dictionary to handle real-world schema ambiguity."
tags: ["Indie Dev", "showcase"]
categories: ["Project"]
showWordCount : true
showReadingTime : true
showSummary : true
showAuthor: true

showDate : false
showDateOnlyInArticle : false
showDateUpdated : false
showHeadingAnchors : false
showPagination : false
showTableOfContents : true
showTaxonomies : false 
showEdit: false
showViews: false
showLikes: false
layoutBackgroundHeaderSpace: false
---

{{< keywordList >}}
{{< keyword icon="edit" >}} Written by **Human** {{< /keyword >}}
{{< /keywordList >}}

## TL;DR

A self-built agent that pauses to ask clarifying questions before generating SQL — instead of guessing at ambiguous requests like most NL2SQL chatbots do. Built on a small classifier, a dedicated SQL coder, and a business-context database dictionary to handle real-world schema ambiguity.


{{< carousel images="gallery/*" aspectRatio="16.5-9" interval="2500" >}}

{{< github repo="xifanz42/nl2sql_agent" showThumbnail=false >}}

## 1. Background

### Inspiration

This project was inspired by my first start-up trial project, where we meant to build a multi-agent consulting system using [Dify](https://github.com/langgenius/dify) in late 2024. I explored the full functionality of [Dify](https://github.com/langgenius/dify) back then, and realized a core limitation: 

>It doesn't support a true agentic loop. 

Chatflow lets you design a rich sequence of nodes and branches, but that sequence has to be hand-drawn in advance. The model itself has no way to decide, at runtime, whether it has enough information to act or needs to pause and ask the user something first.

Therefore, the multi-agent system I built on top of it is actually a sequential chatflow, with each step being an LLM equipped with some external tools or MCPs, rather than an agentic system that can interact with users back and forth.

The problem is even more obvious when users' inputs can only be answered by querying a relational database (PostgreSQL, etc.), since a chatbot with no way to pause and clarify has only one option: guess.

A typical failed case looks like this:

> User: I want to know the average stopping time
>
> Chatbot: The average stopping time of *red cars in Thailand* is ...

Apparently, the user failed to give a definition for `the average stopping time`. Because the flow had no way to pause and ask what that meant, the chatbot filled the gap itself using its own assumptions. Though the result looks like a hallucination, it isn't really one — the model didn't invent this out of nowhere; it did the only thing the architecture let it do.


### Assumption

Here I have to introduce a vital assumption (or reality):

> [!quote] Consumers are ignorant and fail at asking correct questions
> Consumers are incapable of clarifying their core needs because they inherently have limited information. Therefore, they typically fail to input a clear and correct question (prompt) in the initial few rounds.


### Causal Analysis

Under the above assumption, it becomes clear that the first cause of our system's failure is the well-known term in data science — **garbage in, garbage out**. Garbage here is no longer *data*, but *text*.

The second cause of failure is more systemic and critical. From late 2024 to early 2025, [Dify](https://github.com/langgenius/dify) was still under active development. A complex system built on top of it would inevitably inherit [Dify](https://github.com/langgenius/dify)'s flaws as systemic flaws of its own. Without a true **agentic loop**, our system was unable to clarify the true problem behind users' incorrect inputs, further weakening its response reliability.


### Summary

All in all, the root cause stems from two aspects:

1. unclear inputs
2. systemic failure

As a result, this **NL2SQL Agent** project aims to fix the core module of our multi-agent system, making the database query task more reliable.

The project is aiming for anyone who wants to interact with a database without knowing its details.

## 2. Solution

In early 2025, I thought the best solution was to self-develop a minimal agent architecture — one with conversational memory that could itself determine whether the user's input was sufficient to generate SQL.

So the first thing I designed was that the agent would be powered by multiple large language models, each with a specific purpose. I pre-defined three kinds of tasks — or roles, I should say:

1. A small helper for two simple tasks:
   - to classify the user's question
   - to determine if the user needs to clarify further
2. A coder responsible only for generating SQL
3. A reasoner for syntheic response

Besides this, there's also a context engineering piece. Apart from normal RAG (embedding, chunking, retrieving etc.), how to clarify database schemas is another key point.

In reality, a single database could contain multiple columns with similar column names but slightly different business meanings. This is another source of the LLM fabricating its own response. To address this problem, my design back then was to prepare a human-written **database dictionary** and feed it into the RAG pipeline by default. The dictionary should at least contain the following information:

- data field name (column name)
- data type
- data unit
- example value (few-shot examples)
- a short business explanation

Later, I found that the following information is optional but can improve performance by more clearly defining the data boundary:

- data category (if it's categorical)
- data range (if it's numerical)

By design, the agent now has a better ability to ask follow-up questions for query clarification, and is equipped with a better understanding of the database from a business perspective.

## 3. Architecture

Here's a more detailed system architecture:

{{< figure src="/img/nl2sql/system_arch_en.png" alt="" >}}

The agent supports both a web interface and a CLI. Beyond its core workflow, it also supports general exploratory interaction.

## 4. Demo Walkthrough

Finally, here's a demo walkthrough.

In this video, I deliberately asked a vague question about `error logs` at first. Instead of calling the coder to generate SQL and query the database, the agent asked a follow-up: `whether I was looking for general error logs or logs for a specific vehicle`. I replied that I was looking for a specific vehicle. The agent then asked further questions to narrow down the scope.

<video controls muted playsinline preload="metadata" width="100%" poster="/img/nl2sql/cover.png">
  <source src="/video/nl2sql-demo.mp4" type="video/mp4">
  你的浏览器不支持 video 标签。
</video>

{{< github repo="xifanz42/nl2sql_agent" showThumbnail=false >}}