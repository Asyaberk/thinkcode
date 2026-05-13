"""
prompts/__init__.py

Prompt template registry for all AI dialog nodes.

Each module in this package defines a single render() function that
takes a context dictionary and returns a system prompt string.

Why separate templates?
  - Switching the underlying model only requires editing the template,
    not the dialog logic in dialog_graph.py.
  - Prompts can be tested in isolation without running the full graph.
  - Different courses or deployments can swap templates via config.

Available templates:
  tutor_hint      — levelled Socratic hint delivery
  tutor_error     — error / confusion explanation
  tutor_grade     — student answer evaluation
  tutor_socratic  — default Socratic guiding conversation
  content_builder — instructor content generation system prompt
"""
