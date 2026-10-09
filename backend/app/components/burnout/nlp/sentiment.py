"""VADER sentiment - fast lexicon method tuned for informal text."""
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_an = SentimentIntensityAnalyzer()


def sentiment(text: str) -> float:
    return _an.polarity_scores(text)["compound"]
