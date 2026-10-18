"""
Lists the English UI texts of the career feature and checks that si.js / ta.js translate them all.

Run from the repo root:  python frontend/src/features/career/i18n/check_keys.py
Exit code 1 (and a list) when a translation is missing, so it can be used as a quick check.
"""
import re
import sys
from pathlib import Path

FEATURE = Path(__file__).resolve().parents[1]
STRING = r'"((?:[^"\\]|\\.)*)"'


def literal_keys() -> set:
    """Every t("...") call, including both branches of t(cond ? "a" : "b")."""
    keys = set()
    for path in FEATURE.rglob("*.js*"):
        if "i18n" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        keys |= set(re.findall(r'\bt\(\s*' + STRING, text))
        for expr in re.findall(r'\bt\(([^()]*\?[^()]*)\)', text):  # t(x ? "a" : "b")
            keys |= set(re.findall(STRING, expr))
    return keys


def block_strings(path: str, start: str, end: str = "\n};") -> set:
    """String literals inside a constant block, e.g. OPTIONS = {...}."""
    text = (FEATURE / path).read_text(encoding="utf-8")
    i = text.index(start)
    j = text.index(end, i)
    return set(re.findall(STRING, text[i:j]))


def field_values(path: str, field: str) -> set:
    text = (FEATURE / path).read_text(encoding="utf-8")
    return set(re.findall(rf'\b{field}:\s*' + STRING, text))


def dynamic_keys() -> set:
    """Texts translated through a variable: t(option), t(step.label), t(GLOSSARY_EN.x) ..."""
    keys = set()
    keys |= block_strings("constants.js", "export const OPTIONS = {")
    keys |= {k for k in block_strings("constants.js", "export const FACULTY_CAREER_OPTIONS = {", "\n};")
             if k not in {"careerAreas", "roles"}}
    keys |= field_values("constants.js", "label")
    keys |= block_strings("constants.js", "const GLOSSARY_EN = {")
    keys |= block_strings("constants.js", "export const ETHICS_NOTES = [", "\n];")
    keys |= field_values("components/CareerStepper.jsx", "label")
    keys |= field_values("pages/CareerDashboard.jsx", "title") | field_values("pages/CareerDashboard.jsx", "desc")
    keys |= field_values("components/interview/InterviewSetup.jsx", "title")
    keys |= field_values("components/interview/InterviewSetup.jsx", "desc")
    keys |= block_strings("components/interview/InterviewSetup.jsx", "const CONSENT = {")
    keys |= block_strings("components/interview/AnswerPanel.jsx", "const MIC_STAGE = {")
    keys |= block_strings("hooks/useSpeechRecognition.js", "const ERROR_TEXT = {")
    keys |= block_strings("components/interview/FeedbackCard.jsx", "const STAR_LABEL = {", "};")
    keys |= block_strings("components/interview/InterviewReport.jsx", "const AREA_LABEL = {", "};")
    keys |= field_values("components/interview/SpeakerCheck.jsx", "label")
    keys |= block_strings("utils/roadmapProgress.js", "export const ROADMAP_PART_LABELS = {", "};")
    keys |= field_values("components/cv/CVDocument.jsx", "name") | field_values("components/cv/CVDocument.jsx", "best")
    keys |= set(re.findall(r'\] = ' + STRING, (FEATURE / "utils" / "cvModel.js").read_text(encoding="utf-8")))  # validation messages
    # API codes shown through t(): gap status, priority, question category
    keys |= {"Strong", "Needs Improvement", "Critical Gap", "High priority", "Medium priority",
             "Introduction", "Technical", "Behavioural"}
    # Labels made from field names by pretty() in the survey
    keys |= {"Academic status", "Employment status", "Preferred learning method"}
    # Survey props that the Select / Section / Chips / Rating components pass to t()
    survey = (FEATURE / "pages" / "CareerSurveyForm.jsx").read_text(encoding="utf-8")
    keys |= set(re.findall(r'\b(?:label|title|subtitle)=' + STRING, survey))
    for expr in re.findall(r'placeholder=\{([^}]*)\}', survey):
        keys |= set(re.findall(STRING, expr))
    keys |= {"Select…", "Listening…",  # default placeholder; fallback mic stage
             "raising {skill} from {from} to {to} adds about +{gain}% readiness, and fully closes that gap.",
             "raising {skill} from {from} to {to} adds about +{gain}% readiness."}
    return {k for k in keys if not re.fullmatch(r"[a-z_-]+|/[\w/-]*|bg-.*|text-.*|\W*", k)}


def dictionary_keys(name: str) -> set:
    text = (FEATURE / "i18n" / f"{name}.js").read_text(encoding="utf-8")
    return set(re.findall(r'^\s*' + STRING + r'\s*:', text, flags=re.M))


def main():
    wanted = {k for k in literal_keys() | dynamic_keys() if not re.fullmatch(r"[a-z]+-[a-z-]+", k)}
    if "--list" in sys.argv:
        for key in sorted(wanted):
            print(key)
        return 0
    status = 0
    for lang in ("si", "ta"):
        have = dictionary_keys(lang)
        missing = sorted(wanted - have)
        unused = sorted(have - wanted)
        print(f"{lang}: {len(wanted) - len(missing)}/{len(wanted)} translated; {len(unused)} unused")
        for key in missing:
            print(f"  MISSING: {key}")
        status |= bool(missing)
    return status


if __name__ == "__main__":
    sys.exit(main())
