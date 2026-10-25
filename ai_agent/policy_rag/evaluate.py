"""Evaluate the policy retriever against expected source sections."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from ai_agent.policy_rag.answer import answer_policy_question, is_out_of_scope
from ai_agent.policy_rag.embeddings import create_embeddings
from ai_agent.policy_rag.retriever import RetrievalOptions, retrieve


def load_questions(path: Path | None = None) -> list[dict[str, Any]]:
    source = path or Path(__file__).with_name("evaluation_questions.json")
    with source.open(encoding="utf-8") as question_file:
        data = json.load(question_file)
    if not isinstance(data, list) or len(data) < 40:
        raise ValueError("Evaluation dataset must contain at least 40 questions.")
    return data


def _expected_hit(
    expected: list[dict[str, str]],
    actual: set[tuple[str, str]],
    *,
    require_all: bool,
) -> bool:
    if not expected:
        return False
    matches = [
        (item["docId"], item["sectionNumber"]) in actual
        for item in expected
    ]
    return all(matches) if require_all else any(matches)


def evaluate() -> dict[str, Any]:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    questions = load_questions()
    policy_questions = 0
    policy_hits = 0
    out_of_scope_cases = 0
    out_of_scope_passes = 0
    failures: list[str] = []
    policy_items = [item for item in questions if not item.get("out_of_scope")]
    query_embeddings = create_embeddings().embed_documents(
        [item["question"] for item in policy_items]
    )
    if len(query_embeddings) != len(policy_items):
        raise RuntimeError("Ollama returned an unexpected number of query embeddings.")
    query_embeddings_by_question = {
        item["question"]: embedding
        for item, embedding in zip(policy_items, query_embeddings)
    }

    for index, item in enumerate(questions, start=1):
        question = item["question"]
        expected = item["expected"]
        if item.get("out_of_scope"):
            out_of_scope_cases += 1
            if not is_out_of_scope(question):
                failures.append(f"{index}: out-of-scope request was not detected: {question}")
                continue
            result = asyncio.run(answer_policy_question(question))
            answer_text = result["answer"].casefold()
            if "i don't know" in answer_text or "জানি না" in answer_text:
                out_of_scope_passes += 1
            else:
                failures.append(f"{index}: no explicit don't-know answer: {question}")
            continue

        policy_questions += 1
        chunks = retrieve(
            question,
            RetrievalOptions(top_k=5),
            query_embedding=query_embeddings_by_question[question],
        )
        actual = {
            (chunk["docId"], str(chunk["sectionNumber"]))
            for chunk in chunks
        }
        hit = _expected_hit(
            expected,
            actual,
            require_all=bool(item.get("require_all")),
        )
        if hit:
            policy_hits += 1
        else:
            failures.append(
                f"{index}: expected {expected}, retrieved {sorted(actual)}: {question}"
            )

    hit_rate = policy_hits / policy_questions if policy_questions else 0.0
    report = {
        "questions": len(questions),
        "policy_questions": policy_questions,
        "hit_rate_at_5": hit_rate,
        "out_of_scope_cases": out_of_scope_cases,
        "out_of_scope_passes": out_of_scope_passes,
        "passed": len(failures) == 0,
        "failures": failures,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return report


def main() -> None:
    report = evaluate()
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
