from ai_agent.policy_rag.evaluate import load_questions


def test_evaluation_covers_all_policy_collections_and_out_of_scope():
    questions = load_questions()
    doc_ids = {
        expected["docId"]
        for question in questions
        for expected in question["expected"]
    }
    out_of_scope = [question for question in questions if question.get("out_of_scope")]
    bangla_or_mixed = [
        question
        for question in questions
        if any("\u0980" <= char <= "\u09ff" for char in question["question"])
        or "chattogram-e" in question["question"].casefold()
    ]

    assert len(questions) >= 40
    assert doc_ids == {"GT-POL-WS-01", "GT-POL-PR-01", "GT-POL-DS-01"}
    assert len(out_of_scope) >= 4
    assert len(bangla_or_mixed) >= 3
