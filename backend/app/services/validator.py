"""
Instant rule-based validator for Azure resource creation guides.

No LLM call — pure Python regex + string checks, runs in < 1 ms.
Only flags genuine structural problems (missing IaC blocks, unfilled
template placeholders from our own system prompt template).

Semantic concerns (security posture, SRE best practices) are covered
by the system prompt itself, not the validator.
"""

import re
from dataclasses import dataclass, field


# ── Patterns that indicate the AI copied our system prompt template verbatim ──
# These are specific to OUR templates in openai_service._DEFAULT_SYSTEM.
# We deliberately do NOT flag user-appropriate names like "mystorageaccount<unique>".
_TEMPLATE_LEFTOVERS = [
    (r"\[resource_type\]",        "Unfilled placeholder: [resource_type]"),
    (r"\[api-version\]",          "Unfilled placeholder: [api-version]"),
    (r"\[provider\]",             "Unfilled placeholder: [provider]"),
    (r"azurerm_\[",               "Unfilled Terraform resource type: azurerm_[..."),
    (r"Microsoft\.\[provider\]",  "Unfilled Bicep provider namespace"),
    (r"Microsoft\.\*/\[type\]",   "Unfilled Bicep resource type"),
    (r"\bmy-resource-name\b",     "Generic placeholder not replaced: my-resource-name"),
    (r"\[resource_group\]",       "Unfilled placeholder: [resource_group]"),
]

# ── Blocks every resource guide must contain ──────────────────────────────────
_REQUIRED_BLOCKS = {
    "```bash":    "Azure CLI code block",
    "```bicep":   "Bicep IaC block",
    "```hcl":     "Terraform IaC block",
    "SRE Checklist": "SRE Checklist",
}


@dataclass
class ValidationResult:
    valid: bool
    score: int
    issues: list[str] = field(default_factory=list)
    rules: dict = field(default_factory=dict)
    skipped: bool = False


def validate_response_fast(generated: str) -> ValidationResult:
    """
    Check a resource guide for structural completeness and template leftovers.
    Returns instantly — no I/O, no network calls.
    """
    issues: list[str] = []

    # 1. Completeness — all required blocks must be present
    for marker, label in _REQUIRED_BLOCKS.items():
        if marker not in generated:
            issues.append(f"Missing {label}")

    # 2. No template leftovers from our system prompt placeholders
    for pattern, message in _TEMPLATE_LEFTOVERS:
        if re.search(pattern, generated, re.IGNORECASE):
            issues.append(message)

    score = max(0, 10 - len(issues) * 2)
    return ValidationResult(
        valid=len(issues) == 0,
        score=score,
        issues=issues,
    )

